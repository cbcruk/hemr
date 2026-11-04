import { describe, expect, it } from 'vitest'
import { allowedVisitCommands, transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitStatus } from './visit-status.types.ts'

describe('transitionVisit', () => {
  const allowed: [VisitStatus, VisitCommand, VisitStatus][] = [
    ['WAITING', 'START_TREATMENT', 'IN_TREATMENT'],
    ['IN_TREATMENT', 'RETURN_TO_WAITING', 'WAITING'],
    ['AWAITING_PAYMENT', 'RETURN_TO_WAITING', 'WAITING'],
    ['WAITING', 'SEND_TO_CHECKOUT', 'AWAITING_PAYMENT'],
    ['IN_TREATMENT', 'SEND_TO_CHECKOUT', 'AWAITING_PAYMENT'],
    ['AWAITING_PAYMENT', 'START_TREATMENT', 'IN_TREATMENT'],
    ['WAITING', 'CHECKOUT', 'COMPLETED'],
    ['IN_TREATMENT', 'CHECKOUT', 'COMPLETED'],
    ['AWAITING_PAYMENT', 'CHECKOUT', 'COMPLETED'],
    ['COMPLETED', 'REOPEN', 'AWAITING_PAYMENT'],
    ['WAITING', 'CANCEL', 'CANCELED'],
    ['AWAITING_PAYMENT', 'CANCEL', 'CANCELED'],
  ]

  it.each(allowed)('%s --%s--> %s', (from, command, to) => {
    expect(transitionVisit(from, command)).toEqual({ ok: true, to })
  })

  it('refuses a completed visit going straight back to waiting', () => {
    expect(transitionVisit('COMPLETED', 'RETURN_TO_WAITING')).toEqual({
      ok: false,
      code: 'VISIT_TRANSITION_INVALID',
    })
  })

  it('refuses any command on a canceled visit', () => {
    expect(allowedVisitCommands('CANCELED')).toEqual([])
    expect(transitionVisit('CANCELED', 'CHECKOUT').ok).toBe(false)
  })

  it.each<VisitStatus>(['IN_TREATMENT', 'COMPLETED'])('requires cascade to cancel from %s', (from) => {
    expect(transitionVisit(from, 'CANCEL')).toEqual({ ok: false, code: 'VISIT_HAS_CLINICAL_DATA' })
    expect(transitionVisit(from, 'CANCEL', { cascade: true })).toEqual({ ok: true, to: 'CANCELED' })
  })
})
