import { describe, expect, it } from 'vitest'
import {
  elapseDueTimers,
  adjustProcedureDuration,
  migratedProcedure,
  setProcedureDuration,
  startProcedures,
  timerEndsAt,
} from './procedure-timer.ts'
import type { ProcedureTimer } from './procedure-timer.ts'

const START = '2026-11-01T01:00:00.000Z'
const at = (iso: string) => Date.parse(iso)

const running = (procedureId: string, durationSeconds: number): ProcedureTimer => ({
  procedureId,
  status: 'RUNNING',
  durationSeconds,
  startedAt: START,
  timerEndsAt: timerEndsAt(START, durationSeconds),
  completedAt: null,
})
const pending = (procedureId: string): ProcedureTimer => ({
  procedureId,
  status: 'PENDING',
  durationSeconds: 600,
  startedAt: null,
  timerEndsAt: null,
  completedAt: null,
})

describe('만료 처리 (elapseDueTimers)', () => {
  it('남은 시간이 정확히 0초면 만료하고 나머지는 그대로 둡니다', () => {
    const result = elapseDueTimers([running('a', 300), running('b', 301)], at('2026-11-01T01:05:00.000Z'))
    expect(result.elapsedIds).toEqual(['a'])
    expect(result.procedures.map((each) => each.status)).toEqual(['TIMER_ELAPSED', 'RUNNING'])
  })
})

describe('시술 시작 (startProcedures)', () => {
  const now = at('2026-11-01T01:10:00.000Z')

  it('타이머가 끝나지 않은 진행 중 시술은 그대로 두고 ALREADY_RUNNING입니다', () => {
    expect(startProcedures([running('a', 900)], ['a'], now)).toEqual({
      changed: false,
      reason: 'ALREADY_RUNNING',
      elapsedIds: [],
    })
  })

  it('없는 대상은 NOT_FOUND로 따로 알립니다', () => {
    expect(startProcedures([pending('a')], ['x'], now)).toEqual({ changed: false, reason: 'NOT_FOUND', elapsedIds: [] })
  })

  it('정책이 켜져 있을 때만 베드의 만료 시술을 완료하고 늦게 만료한 시술을 알립니다', () => {
    const procedures = [running('a', 300), pending('b')]
    expect(startProcedures(procedures, ['b'], now)).toMatchObject({
      changed: true,
      startedIds: ['b'],
      autoCompletedIds: ['a'],
      elapsedIds: ['a'],
    })
    const off = startProcedures(procedures, ['b'], now, { autoCompleteElapsedOnNextStart: false })
    expect(off).toMatchObject({ changed: true, autoCompletedIds: [], elapsedIds: ['a'] })
    if (off.changed) expect(off.procedures[0]!.status).toBe('TIMER_ELAPSED')
  })

  it('만료된 대상은 새 종료 시각으로 다시 시작합니다', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const result = startProcedures([elapsed], ['a'], now)
    expect(result.changed && result.procedures[0]).toMatchObject({
      status: 'RUNNING',
      startedAt: '2026-11-01T01:10:00.000Z',
      timerEndsAt: '2026-11-01T01:15:00.000Z',
    })
  })

  it('세트를 시작할 때 세트 안의 만료 시술은 완료하지 않고 다시 시작하며 세트 밖 만료 시술은 완료합니다', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const outside: ProcedureTimer = { ...running('c', 300), status: 'TIMER_ELAPSED' }
    const result = startProcedures([elapsed, pending('b'), outside], ['a', 'b'], now)
    expect(result).toMatchObject({ changed: true, startedIds: ['a', 'b'], autoCompletedIds: ['c'] })
  })

  it('완료된 시술을 한 번에 다시 시작하고 완료 시각을 지웁니다', () => {
    const done: ProcedureTimer = { ...running('a', 300), status: 'DONE', completedAt: '2026-11-01T01:05:00.000Z' }
    const result = startProcedures([done], ['a'], now)
    expect(result.changed && result.procedures[0]).toEqual({
      procedureId: 'a',
      status: 'RUNNING',
      durationSeconds: 300,
      startedAt: '2026-11-01T01:10:00.000Z',
      timerEndsAt: '2026-11-01T01:15:00.000Z',
      completedAt: null,
    })
  })
})

describe('시술 시간 변경 (setProcedureDuration)', () => {
  const now = at('2026-11-01T01:05:00.000Z')

  it('진행 중 시술의 종료 시각을 옮깁니다', () => {
    const result = setProcedureDuration(running('a', 600), 900, now)
    expect(result.ok && result.procedure.timerEndsAt).toBe('2026-11-01T01:15:00.000Z')
  })

  it('거부마다 다른 오류 코드를 줍니다', () => {
    expect(setProcedureDuration(running('a', 600), 300, now)).toEqual({
      ok: false,
      error: 'PROCEDURE_DURATION_TOO_SHORT',
    })
    expect(setProcedureDuration(running('a', 600), 0, now)).toEqual({ ok: false, error: 'PROCEDURE_DURATION_INVALID' })
    const done: ProcedureTimer = { ...running('a', 600), status: 'DONE' }
    expect(setProcedureDuration(done, 600, now)).toEqual({ ok: false, error: 'PROCEDURE_ALREADY_DONE' })
  })

  it('만료된 시술은 만료 상태와 실제 종료 시각을 그대로 둡니다', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const result = setProcedureDuration(elapsed, 900, now)
    expect(result.ok && result.procedure).toMatchObject({
      status: 'TIMER_ELAPSED',
      durationSeconds: 900,
      timerEndsAt: '2026-11-01T01:05:00.000Z',
    })
  })

  it('종료 시각이 지난 진행 중 타이머는 시간을 늘려도 되살리지 않고 만료합니다', () => {
    const result = setProcedureDuration(running('a', 300), 900, at('2026-11-01T01:10:00.000Z'))
    expect(result).toMatchObject({ ok: true, changed: true, elapsed: true })
    expect(result.ok && result.procedure).toMatchObject({ status: 'TIMER_ELAPSED', durationSeconds: 900 })
  })
})

describe('시술 시간 증감 (adjustProcedureDuration)', () => {
  const now = at('2026-11-01T01:05:00.000Z')

  it('0이나 소수 증감은 거부하고 결과 시간은 변경과 같이 검사합니다', () => {
    expect(adjustProcedureDuration(running('a', 600), 1.5, now)).toEqual({
      ok: false,
      error: 'PROCEDURE_DURATION_INVALID',
    })
    expect(adjustProcedureDuration(running('a', 600), -300, now)).toEqual({
      ok: false,
      error: 'PROCEDURE_DURATION_TOO_SHORT',
    })
    const done: ProcedureTimer = { ...running('a', 600), status: 'DONE' }
    expect(adjustProcedureDuration(done, 60, now)).toEqual({ ok: false, error: 'PROCEDURE_ALREADY_DONE' })
  })
})

describe('현행 시술 이관 (migratedProcedure)', () => {
  it('타이머가 끝나지 않은 대기 행과 시작 시각 없는 행은 대기로 두고, 타이머가 끝난 대기 행은 만료입니다', () => {
    const row = {
      procedureId: 'a',
      status: 'pending' as const,
      timerEnded: false,
      startedAt: START,
      completedAt: null,
      durationSeconds: 300,
    }
    expect(migratedProcedure(row)).toMatchObject({ status: 'PENDING', startedAt: null, timerEndsAt: null })
    expect(migratedProcedure({ ...row, status: 'running', startedAt: null })).toMatchObject({ status: 'PENDING' })
    expect(migratedProcedure({ ...row, timerEnded: true, startedAt: null })).toMatchObject({ status: 'PENDING' })
    expect(migratedProcedure({ ...row, timerEnded: true })).toMatchObject({
      status: 'TIMER_ELAPSED',
      timerEndsAt: '2026-11-01T01:05:00.000Z',
    })
  })
})
