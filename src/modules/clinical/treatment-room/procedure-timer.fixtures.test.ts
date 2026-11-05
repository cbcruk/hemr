import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROCEDURE_TIMER_SETTINGS,
  adjustProcedureDuration,
  elapseDueTimers,
  migratedProcedure,
  procedureSetSeconds,
  remainingSeconds,
  setProcedureDuration,
  startProcedures,
  timerEndNotificationKey,
  timerEndNotificationTitle,
  timerEndsAt,
} from './procedure-timer.ts'
import type { ProcedureDurationResult, ProcedureStatus, ProcedureTimer } from './procedure-timer.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/procedure-timer.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 로컬 상태 `pending` + `타이머종료`는 서버 상태 `TIMER_ELAPSED`로 읽습니다 (결정 1). 만료 판정 결과가 같으면
 * 표현만 바뀐 것으로 보고 그대로 비교합니다. 현행 API 호출 순서(`uncomplete` → `start`, `restart` 실패 시 `start`)는
 * 서버 커맨드 하나(`:start`)로 합쳐지므로 비교하지 않고, 호출 뒤의 시술 상태만 비교합니다. 현행과 기대값이 다른
 * 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/procedure-timer.json'), 'utf8'),
) as { cases: FixtureCase[] }

function toProcedure(row: Record<string, any>, id = row['id'] ?? row['치료실시술Id'] ?? 'p'): ProcedureTimer {
  return migratedProcedure({
    procedureId: id,
    status: row['상태'],
    timerEnded: row['타이머종료'] ?? row['타이머종료여부'] ?? false,
    startedAt: row['시작일시'] ?? null,
    completedAt: row['완료일시'] ?? null,
    durationSeconds: row['duration_sec'],
  })
}

/** 현행 로컬 상태를 서버 상태로 읽습니다. */
function legacyStatus(row: Record<string, any>): ProcedureStatus {
  if (row['상태'] === 'running') return 'RUNNING'
  if (row['상태'] === 'done') return 'DONE'
  return row['타이머종료'] === true ? 'TIMER_ELAPSED' : 'PENDING'
}

/** 현행은 잘못된 값을 조용히 무시했고(`applied: false`), 서버는 오류 코드로 거부합니다. 같은 값은 둘 다 그대로입니다. */
const durationView = (result: ProcedureDurationResult, nowMs: number) => {
  if (!result.ok) return { applied: false, error: result.error }
  return result.changed
    ? {
        applied: true,
        durationSeconds: result.procedure.durationSeconds,
        remainingSeconds: remainingSeconds(result.procedure, nowMs),
      }
    : { applied: false }
}

const legacyDurationView = (expected: any) =>
  expected['applied']
    ? { applied: true, durationSeconds: expected['duration_sec'], remainingSeconds: expected['remaining_sec'] }
    : { applied: false }

const startView = (procedures: readonly ProcedureTimer[], nowMs: number) =>
  procedures.map((each) => ({
    id: each.procedureId,
    status: each.status,
    startedAt: each.startedAt,
    completedAt: each.completedAt,
    remainingSeconds: remainingSeconds(each, nowMs),
  }))

/** 픽스처 검사별로 서버 결과와 현행 기대값을 같은 모양으로 만듭니다. */
const RUN: Record<string, { server: (input: any) => unknown; legacy: (expected: any, input: any) => unknown }> = {
  mapServerProcedure: {
    server: (input) => {
      const row = input['procedure']
      const [procedure] = elapseDueTimers([toProcedure(row)], input['nowMs']).procedures
      return {
        id: procedure!.procedureId,
        status: procedure!.status,
        durationSeconds: procedure!.durationSeconds,
        remainingSeconds: remainingSeconds(procedure!, input['nowMs']),
      }
    },
    legacy: (expected) => ({
      id: expected['id'],
      status: legacyStatus(expected),
      durationSeconds: expected['duration_sec'],
      remainingSeconds: expected['remaining_sec'],
    }),
  },
  tick: {
    server: (input) => {
      const { procedures, elapsedIds } = elapseDueTimers(
        (input['procedures'] as any[]).map((row) => toProcedure(row)),
        input['nowMs'],
      )
      return {
        procedures: procedures.map((each) => ({
          id: each.procedureId,
          status: each.status,
          remainingSeconds: remainingSeconds(each, input['nowMs']),
        })),
        notificationKeys: procedures
          .filter((each) => elapsedIds.includes(each.procedureId))
          .flatMap((each) =>
            each.timerEndsAt === null ? [] : [timerEndNotificationKey({ ...each, timerEndsAt: each.timerEndsAt })],
          ),
      }
    },
    legacy: (expected) => ({
      procedures: (expected['procedures'] as any[]).map((row) => ({
        id: row['id'],
        status: legacyStatus(row),
        remainingSeconds: row['remaining_sec'],
      })),
      notificationKeys: (expected['notifyEnded'] as any[]).map(
        (each) => `timer-end:${each['시술Id']}:${each['종료시각Ms'] ?? ''}`,
      ),
    }),
  },
  startTreatment: {
    server: (input) => {
      const nowMs = Date.parse(input['nowIso'])
      const procedures = (input['procedures'] as any[]).map((row) => toProcedure(row))
      const result = startProcedures(procedures, [input['targetId']], nowMs)
      return startView(result.changed ? result.procedures : procedures, nowMs)
    },
    legacy: (expected) =>
      (expected['procedures'] as any[]).map((row) => {
        const status = legacyStatus(row)
        return {
          id: row['id'],
          status,
          // 서버 `PENDING`은 시작 시각을 비웁니다
          startedAt: status === 'PENDING' ? null : row['시작일시'],
          completedAt: row['완료일시'] ?? null,
          remainingSeconds: status === 'RUNNING' ? row['remaining_sec'] : null,
        }
      }),
  },
  setDuration: {
    server: (input) =>
      durationView(
        setProcedureDuration(toProcedure(input['procedure']), input['newSec'], input['nowMs']),
        input['nowMs'],
      ),
    legacy: legacyDurationView,
  },
  adjustTimer: {
    server: (input) =>
      durationView(
        adjustProcedureDuration(toProcedure(input['procedure']), input['delta'], input['nowMs']),
        input['nowMs'],
      ),
    legacy: legacyDurationView,
  },
  defaults: {
    server: () => ({ duration_sec: DEFAULT_PROCEDURE_TIMER_SETTINGS.defaultItemSeconds }),
    legacy: (expected) => expected,
  },
  groupDuration: {
    server: (input) => ({
      duration_sec: procedureSetSeconds(
        (input['items'] as any[]).map((each) => ({ durationSeconds: each['duration_sec'] })),
      ),
    }),
    legacy: (expected) => expected,
  },
  timerEndNotification: {
    server: (input) => {
      const items = (input['items'] as any[]).map((each) => ({
        procedureId: each['시술Id'] as string,
        timerEndsAt: timerEndsAt(each['시작일시'], each['duration_sec']),
      }))
      return {
        endAtMs: Date.parse(items[0]!.timerEndsAt),
        keys: items.map(timerEndNotificationKey),
        title: timerEndNotificationTitle(
          input['베드번호'],
          input['환자명'],
          (input['items'] as any[]).map((each) => each['카테고리']),
        ),
      }
    },
    legacy: (expected) => expected,
  },
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 4: 현행은 조용히 무시했고, 서버는 오류 코드로 거부합니다
  'setDuration: running: shorter than elapsed+1 rejected': { applied: false, error: 'PROCEDURE_DURATION_TOO_SHORT' },
  'setDuration: zero rejected': { applied: false, error: 'PROCEDURE_DURATION_INVALID' },
  'setDuration: non-integer rejected': { applied: false, error: 'PROCEDURE_DURATION_INVALID' },
  'setDuration: done procedure rejected': { applied: false, error: 'PROCEDURE_ALREADY_DONE' },
  'adjustTimer: -600s hits 0 and is rejected': { applied: false, error: 'PROCEDURE_DURATION_INVALID' },
  // 결정 1·4: 서버 시계로 01:05에 이미 만료된 시술이라, 01:10의 `:start`는 바꾸지 않는 대신 다시 시작합니다
  'startTreatment: already running is a no-op': [
    {
      id: 'r',
      status: 'RUNNING',
      startedAt: '2026-11-01T01:10:00.000Z',
      completedAt: null,
      remainingSeconds: 300,
    },
  ],
  // 결정 3: 시작 시각 없는 진행 중 행은 이관할 때 대기로 되돌립니다
  'mapServerProcedure: running without 시작일시 keeps running with null remaining': {
    id: 'p1',
    status: 'PENDING',
    durationSeconds: 600,
    remainingSeconds: null,
  },
  // 결정 3: 시작 시각 없는 d는 대기로 이관되어 만료되지 않고, 알림 키는 모두 종료 시각을 가집니다
  'tick: simultaneous expiries share one batch; no-start row counts down remaining': {
    procedures: [
      { id: 'a', status: 'TIMER_ELAPSED', remainingSeconds: null },
      { id: 'b', status: 'TIMER_ELAPSED', remainingSeconds: null },
      { id: 'c', status: 'RUNNING', remainingSeconds: 300 },
      { id: 'd', status: 'PENDING', remainingSeconds: null },
      { id: 'e', status: 'DONE', remainingSeconds: null },
    ],
    notificationKeys: ['timer-end:a:1793495100000', 'timer-end:b:1793495100000'],
  },
}

describe('procedure-timer fixture', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const run = RUN[input['check']]!
    expect(run.server(input)).toEqual(name in CHANGED ? CHANGED[name] : run.legacy(expected, input))
  })

  it('accounts for every fixture case', () => {
    expect(fixture.cases.filter((c) => !(c.input['check'] in RUN)).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
