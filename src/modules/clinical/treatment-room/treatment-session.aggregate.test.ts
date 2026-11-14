import { rejected, success } from '../../../shared/decision/testing.ts'
import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import { testVisit } from '../../front-desk/visits/testing.ts'
import { DEFAULT_PROCEDURE_TIMER_SETTINGS } from './procedure-timer.ts'
import {
  decideAdd,
  decideComplete,
  decideElapse,
  decideFinishRunning,
  decideRemove,
  decideReopen,
  decideReorder,
  decideRestartTimer,
  decideSetDuration,
  decideStart,
  decideStartAll,
} from './treatment-session.aggregate.ts'
import type { ProcedureContext } from './treatment-session.aggregate.ts'
import { MAX_PROCEDURES_PER_VISIT } from './procedure.ts'
import type { Procedure } from './procedure.ts'

/**
 * 시술 판정 함수의 테스트입니다. given(내원과 그 시술) / when(커맨드) / then(쓸 시술과 이벤트, 또는 거부)으로 씁니다.
 * 타이머 계산 자체는 규칙 모듈 테스트(`procedure-timer.test.ts`)가, 저장·동시성은 서비스 테스트(`procedures.test.ts`)가
 * 봅니다.
 */

const AT = '2026-11-13T01:00:00.000Z'
const USER = 'usr_01JBQ000000000000000000001' as Id<'user'>
const context: ProcedureContext = { at: AT, event: { tenantId: TEST_TENANT.id, actor: { kind: 'USER', id: USER } } }
const visit = testVisit({ status: 'IN_TREATMENT', date: '2026-11-13' })
const ago = (seconds: number) => new Date(Date.parse(AT) - seconds * 1000).toISOString()

const procedure = (n: number, overrides: Partial<Procedure> = {}): Procedure => ({
  id: `prc_01JBQ00000000000000000000${n}` as Id<'procedure'>,
  tenantId: TEST_TENANT.id,
  visitId: visit.id,
  patientId: visit.patientId,
  name: `시술 ${n}`,
  sourcePrescriptionLineId: null,
  order: n - 1,
  assignee: 'STAFF',
  durationSeconds: 600,
  status: 'PENDING',
  startedAt: null,
  timerEndsAt: null,
  completedAt: null,
  createdAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
  version: 1,
  ...overrides,
})

/** 시작한 지 `seconds`초 지난 진행 중 시술입니다. */
const running = (n: number, seconds: number, overrides: Partial<Procedure> = {}) =>
  procedure(n, {
    status: 'RUNNING',
    startedAt: ago(seconds),
    timerEndsAt: new Date(Date.parse(ago(seconds)) + 600_000).toISOString(),
    ...overrides,
  })

const NEW_ID = 'prc_01JBQ000000000000000000009' as Id<'procedure'>

describe('decideAdd', () => {
  it('맨 뒤에 기본 시간의 대기 시술을 더하고 생성 이벤트를 냅니다', () => {
    const then = success(
      decideAdd(
        visit,
        [procedure(1), procedure(2)],
        { name: '부항' },
        NEW_ID,
        DEFAULT_PROCEDURE_TIMER_SETTINGS,
        context,
      ),
    )

    expect(then.changed).toMatchObject([
      { id: NEW_ID, order: 2, status: 'PENDING', assignee: 'STAFF', durationSeconds: 300, version: 1 },
    ])
    expect(then.removed).toEqual([])
    expect(then.events).toMatchObject([{ type: 'procedure.created', subject: NEW_ID, data: { status: 'PENDING' } }])
  })

  it('닫힌 내원과 시술이 가득 찬 내원에는 더하지 않습니다', () => {
    const full = Array.from({ length: MAX_PROCEDURES_PER_VISIT }, (_, index) => procedure(1, { order: index }))

    rejected(
      decideAdd(
        testVisit({ status: 'COMPLETED' }),
        [],
        { name: '부항' },
        NEW_ID,
        DEFAULT_PROCEDURE_TIMER_SETTINGS,
        context,
      ),
      { _tag: 'ProcedureVisitClosed' },
    )
    rejected(decideAdd(visit, full, { name: '부항' }, NEW_ID, DEFAULT_PROCEDURE_TIMER_SETTINGS, context), {
      _tag: 'ProcedureLimitExceeded',
    })
  })
})

describe('decideStart', () => {
  it('대기 시술을 시작하면서 같은 내원의 만료 시술을 함께 완료합니다', () => {
    const elapsed = running(2, 700, { status: 'TIMER_ELAPSED' })
    const given = [procedure(1), elapsed]

    const then = success(decideStart(given[0]!, visit, given, DEFAULT_PROCEDURE_TIMER_SETTINGS, context))

    expect(then.changed).toMatchObject([
      { id: given[0]!.id, status: 'RUNNING', startedAt: AT, timerEndsAt: '2026-11-13T01:10:00.000Z', version: 2 },
      { id: elapsed.id, status: 'DONE', completedAt: AT, version: 2 },
    ])
    expect(then.events.map((each) => each.type)).toEqual(['procedure.updated', 'procedure.updated'])
  })

  it('이미 진행 중인 시술은 거부합니다', () => {
    const given = running(1, 60)

    rejected(decideStart(given, visit, [given], DEFAULT_PROCEDURE_TIMER_SETTINGS, context), {
      _tag: 'ProcedureTransitionInvalid',
      currentStatus: 'RUNNING',
    })
  })

  it('모두 시작하기는 완료한 시술을 빼고 시작하고, 시작할 것이 없으면 바꾸지 않습니다', () => {
    const done = procedure(2, { status: 'DONE', completedAt: ago(60) })

    expect(
      success(decideStartAll(visit, [procedure(1), done], DEFAULT_PROCEDURE_TIMER_SETTINGS, context)).changed.map(
        (each) => each.id,
      ),
    ).toEqual([procedure(1).id])
    expect(success(decideStartAll(visit, [done], DEFAULT_PROCEDURE_TIMER_SETTINGS, context)).changed).toEqual([])
  })
})

describe('decideSetDuration', () => {
  it('진행 중인 시술은 종료 시각을 다시 계산합니다', () => {
    const then = success(decideSetDuration(running(1, 60), visit, 900, context))

    expect(then.changed).toMatchObject([{ durationSeconds: 900, timerEndsAt: '2026-11-13T01:14:00.000Z' }])
  })

  it('이미 지난 시간보다 짧게 줄이면 422, 완료한 시술은 409로 거부합니다', () => {
    rejected(decideSetDuration(running(1, 120), visit, 100, context), {
      _tag: 'ProcedureDurationRejected',
      reason: 'PROCEDURE_DURATION_TOO_SHORT',
    })
    rejected(decideSetDuration(procedure(1, { status: 'DONE' }), visit, 100, context), {
      _tag: 'ProcedureTransitionInvalid',
      currentStatus: 'DONE',
    })
  })

  it('스키마가 막는 시간이 오면 결함으로 멈춥니다', () => {
    expect(() => decideSetDuration(procedure(1), visit, 0, context)).toThrow('invalid duration')
  })
})

describe('decideComplete와 decideFinishRunning', () => {
  it('진행 중인 시술을 완료하고, 대기 시술은 완료하지 않습니다', () => {
    expect(success(decideComplete(running(1, 60), context)).changed).toMatchObject([
      { status: 'DONE', completedAt: AT },
    ])
    rejected(decideComplete(procedure(1), context), { _tag: 'ProcedureTransitionInvalid', currentStatus: 'PENDING' })
  })

  it('내원의 진행 중·만료 시술을 모두 완료하고 대기 시술은 그대로 둡니다', () => {
    const given = [running(1, 60), running(2, 700, { status: 'TIMER_ELAPSED' }), procedure(3)]

    const then = decideFinishRunning(given, context)

    expect(then.changed.map((each) => [each.id, each.status])).toEqual([
      [given[0]!.id, 'DONE'],
      [given[1]!.id, 'DONE'],
    ])
  })
})

describe('decideRestartTimer와 decideReopen', () => {
  it('타이머를 지금부터 다시 재고, 대기 시술은 거부합니다', () => {
    expect(success(decideRestartTimer(running(1, 300), visit, context)).changed).toMatchObject([
      { status: 'RUNNING', startedAt: AT, timerEndsAt: '2026-11-13T01:10:00.000Z' },
    ])
    rejected(decideRestartTimer(procedure(1), visit, context), {
      _tag: 'ProcedureTransitionInvalid',
      currentStatus: 'PENDING',
    })
  })

  it('완료한 시술을 대기로 되돌리고, 닫힌 내원에서는 거부합니다', () => {
    const done = procedure(1, { status: 'DONE', startedAt: ago(700), timerEndsAt: ago(100), completedAt: ago(60) })

    expect(success(decideReopen(done, visit, context)).changed).toMatchObject([
      { status: 'PENDING', startedAt: null, timerEndsAt: null, completedAt: null },
    ])
    rejected(decideReopen(done, testVisit({ status: 'CANCELED' }), context), { _tag: 'ProcedureVisitClosed' })
  })
})

describe('decideReorder', () => {
  const given = [procedure(1), procedure(2), procedure(3)]

  it('보낸 순서로 바꾸고 자리가 바뀐 시술만 씁니다', () => {
    const then = success(decideReorder(given, [given[0]!.id, given[2]!.id, given[1]!.id], context))

    expect(then.ordered.map((each) => each.id)).toEqual([given[0]!.id, given[2]!.id, given[1]!.id])
    expect(then.changed.map((each) => each.id)).toEqual([given[1]!.id, given[2]!.id])
  })

  it('시술을 빠뜨리거나 두 번 보내면 거부합니다', () => {
    rejected(decideReorder(given, [given[0]!.id, given[1]!.id], context), { _tag: 'ProcedureOrderInvalid' })
    rejected(decideReorder(given, [given[0]!.id, given[0]!.id, given[1]!.id], context), {
      _tag: 'ProcedureOrderInvalid',
    })
  })
})

describe('decideRemove', () => {
  it('대기 시술만 지우고 삭제 이벤트를 냅니다', () => {
    expect(success(decideRemove(procedure(1), context))).toMatchObject({
      changed: [],
      removed: [procedure(1).id],
      events: [{ type: 'procedure.removed' }],
    })
    rejected(decideRemove(running(1, 60), context), { _tag: 'ProcedureTransitionInvalid', currentStatus: 'RUNNING' })
  })
})

describe('decideElapse', () => {
  const system: ProcedureContext = {
    at: AT,
    event: { tenantId: TEST_TENANT.id, actor: { kind: 'SYSTEM', id: 'procedure-timer' } },
  }

  it('세션에서 종료 시각이 지난 진행 중 시술만 만료로 바꾸고 서버 타이머의 이벤트를 냅니다', () => {
    const then = decideElapse([running(1, 600), running(2, 599), procedure(3)], system)

    expect(then?.changed).toMatchObject([{ id: running(1, 600).id, status: 'TIMER_ELAPSED' }])
    expect(then?.events).toMatchObject([
      { type: 'procedure.updated', actor: { kind: 'SYSTEM', id: 'procedure-timer' } },
    ])
  })

  it('아직 끝나지 않은 시술은 그대로 둡니다', () => {
    expect(decideElapse([running(1, 599), procedure(2)], system)).toBeNull()
  })
})
