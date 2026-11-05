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

describe('elapseDueTimers', () => {
  it('elapses at exactly zero seconds left and keeps the rest', () => {
    const result = elapseDueTimers([running('a', 300), running('b', 301)], at('2026-11-01T01:05:00.000Z'))
    expect(result.elapsedIds).toEqual(['a'])
    expect(result.procedures.map((each) => each.status)).toEqual(['TIMER_ELAPSED', 'RUNNING'])
  })
})

describe('startProcedures', () => {
  const now = at('2026-11-01T01:10:00.000Z')

  it('keeps a running procedure whose timer has not ended', () => {
    expect(startProcedures([running('a', 900)], ['a'], now)).toEqual({
      changed: false,
      reason: 'ALREADY_RUNNING',
      elapsedIds: [],
    })
  })

  it('reports an unknown target separately', () => {
    expect(startProcedures([pending('a')], ['x'], now)).toEqual({ changed: false, reason: 'NOT_FOUND', elapsedIds: [] })
  })

  it('completes elapsed procedures on the bed only when the policy is on, and reports late expiries', () => {
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

  it('restarts an elapsed target with a new end time', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const result = startProcedures([elapsed], ['a'], now)
    expect(result.changed && result.procedures[0]).toMatchObject({
      status: 'RUNNING',
      startedAt: '2026-11-01T01:10:00.000Z',
      timerEndsAt: '2026-11-01T01:15:00.000Z',
    })
  })

  it('starts a set without completing its own elapsed members', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const outside: ProcedureTimer = { ...running('c', 300), status: 'TIMER_ELAPSED' }
    const result = startProcedures([elapsed, pending('b'), outside], ['a', 'b'], now)
    expect(result).toMatchObject({ changed: true, startedIds: ['a', 'b'], autoCompletedIds: ['c'] })
  })

  it('restarts a done procedure in one command and clears its completion', () => {
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

describe('setProcedureDuration', () => {
  const now = at('2026-11-01T01:05:00.000Z')

  it('moves the end time of a running procedure', () => {
    const result = setProcedureDuration(running('a', 600), 900, now)
    expect(result.ok && result.procedure.timerEndsAt).toBe('2026-11-01T01:15:00.000Z')
  })

  it('names each rejection', () => {
    expect(setProcedureDuration(running('a', 600), 300, now)).toEqual({
      ok: false,
      error: 'PROCEDURE_DURATION_TOO_SHORT',
    })
    expect(setProcedureDuration(running('a', 600), 0, now)).toEqual({ ok: false, error: 'PROCEDURE_DURATION_INVALID' })
    const done: ProcedureTimer = { ...running('a', 600), status: 'DONE' }
    expect(setProcedureDuration(done, 600, now)).toEqual({ ok: false, error: 'PROCEDURE_ALREADY_DONE' })
  })

  it('keeps an elapsed procedure elapsed with its real end time', () => {
    const elapsed: ProcedureTimer = { ...running('a', 300), status: 'TIMER_ELAPSED' }
    const result = setProcedureDuration(elapsed, 900, now)
    expect(result.ok && result.procedure).toMatchObject({
      status: 'TIMER_ELAPSED',
      durationSeconds: 900,
      timerEndsAt: '2026-11-01T01:05:00.000Z',
    })
  })

  it('does not revive a running timer that is already past its end', () => {
    const result = setProcedureDuration(running('a', 300), 900, at('2026-11-01T01:10:00.000Z'))
    expect(result).toMatchObject({ ok: true, changed: true, elapsed: true })
    expect(result.ok && result.procedure).toMatchObject({ status: 'TIMER_ELAPSED', durationSeconds: 900 })
  })
})

describe('adjustProcedureDuration', () => {
  const now = at('2026-11-01T01:05:00.000Z')

  it('rejects a zero or fractional delta and checks the result like a set', () => {
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

describe('migratedProcedure', () => {
  it('clears the start of a pending row whose timer did not end', () => {
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
