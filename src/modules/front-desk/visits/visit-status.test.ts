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

  it.each<VisitStatus>(['WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT', 'COMPLETED'])(
    'requires cascade to cancel from %s only when the visit has clinical data',
    (from) => {
      expect(transitionVisit(from, 'CANCEL')).toEqual({ ok: true, to: 'CANCELED' })
      expect(transitionVisit(from, 'CANCEL', { hasClinicalData: true })).toEqual({
        ok: false,
        code: 'VISIT_HAS_CLINICAL_DATA',
      })
      expect(transitionVisit(from, 'CANCEL', { hasClinicalData: true, cascade: true })).toEqual({
        ok: true,
        to: 'CANCELED',
      })
    },
  )
})

describe('transitionVisit on a past date', () => {
  it.each<[VisitStatus, VisitCommand]>([
    ['WAITING', 'START_TREATMENT'],
    ['IN_TREATMENT', 'RETURN_TO_WAITING'],
    ['IN_TREATMENT', 'SEND_TO_CHECKOUT'],
  ])('refuses %s --%s-->', (from, command) => {
    expect(transitionVisit(from, command, { isPastDate: true })).toEqual({ ok: false, code: 'VISIT_DATE_PAST' })
  })

  it.each<[VisitStatus, VisitCommand, VisitStatus]>([
    ['AWAITING_PAYMENT', 'CHECKOUT', 'COMPLETED'],
    ['COMPLETED', 'REOPEN', 'AWAITING_PAYMENT'],
    ['AWAITING_PAYMENT', 'CANCEL', 'CANCELED'],
  ])('still allows clean-up %s --%s--> %s', (from, command, to) => {
    expect(transitionVisit(from, command, { isPastDate: true })).toEqual({ ok: true, to })
  })

  it('reports an invalid transition before the past date', () => {
    expect(transitionVisit('COMPLETED', 'START_TREATMENT', { isPastDate: true })).toEqual({
      ok: false,
      code: 'VISIT_TRANSITION_INVALID',
    })
  })

  it('leaves only clean-up commands in allowed actions', () => {
    expect(allowedVisitCommands('IN_TREATMENT', { isPastDate: true })).toEqual(['CHECKOUT', 'CANCEL'])
  })
})
