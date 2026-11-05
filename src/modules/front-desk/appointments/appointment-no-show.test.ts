import { describe, expect, it } from 'vitest'
import {
  applyNoShowPatch,
  clinicCloseTime,
  isNoShowDue,
  migrateNoShowSettings,
  noShowDueTime,
} from './appointment-no-show.ts'
import type { NoShowCandidate, NoShowSettings } from './appointment-no-show.ts'

const THIRTY: NoShowSettings = { noShowAfterMinutes: 30, noShowAtClinicClose: false }
const AT_CLOSE: NoShowSettings = { noShowAfterMinutes: 30, noShowAtClinicClose: true }
const BOOKED: NoShowCandidate = { status: 'BOOKED', date: '2026-11-02', startTime: '10:00' }
const DAY = {
  closed: false,
  periods: { MORNING: { start: '09:00', end: '13:00' }, AFTERNOON: { start: '14:00', end: '18:00' } },
}

describe('isNoShowDue (결정 1·3)', () => {
  it('turns due exactly N minutes after the start time', () => {
    expect(isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '10:29' })).toBe(false)
    expect(isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '10:30' })).toBe(true)
  })

  it.each(['ARRIVED', 'CANCELED', 'NO_SHOW'] as const)('skips %s appointments', (status) => {
    expect(isNoShowDue({ ...BOOKED, status }, THIRTY, '18:00', { date: '2026-11-03', time: '00:00' })).toBe(false)
  })

  it('uses the clinic close for untimed appointments and close mode', () => {
    const untimed = { ...BOOKED, startTime: null }
    expect(noShowDueTime(untimed, THIRTY, '18:00')).toBe('18:00')
    expect(noShowDueTime(BOOKED, AT_CLOSE, '18:00')).toBe('18:00')
  })

  it('handles a deadline that rolls past midnight', () => {
    const late = { ...BOOKED, startTime: '23:45' }
    expect(noShowDueTime(late, THIRTY, '24:00')).toBe('24:15')
    expect(isNoShowDue(late, THIRTY, '24:00', { date: '2026-11-03', time: '00:14' })).toBe(false)
    expect(isNoShowDue(late, THIRTY, '24:00', { date: '2026-11-03', time: '00:15' })).toBe(true)
  })

  it('treats a later day as past every deadline', () => {
    expect(isNoShowDue(BOOKED, AT_CLOSE, '24:00', { date: '2026-11-03', time: '00:00' })).toBe(true)
  })
})

describe('close mode after hours', () => {
  it('never marks an appointment that starts after close before it starts', () => {
    const afterClose = { ...BOOKED, startTime: '14:00' }
    expect(noShowDueTime(afterClose, AT_CLOSE, '12:00')).toBe('14:30')
    expect(isNoShowDue(afterClose, AT_CLOSE, '12:00', { date: '2026-11-02', time: '12:00' })).toBe(false)
  })
})

describe('input validation', () => {
  it('rejects impossible dates and times', () => {
    expect(() => isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-02-30', time: '10:00' })).toThrow(RangeError)
    expect(() => isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '25:00' })).toThrow(RangeError)
  })
})

describe('clinicCloseTime (결정 2)', () => {
  it('skips a higher-priority schedule with no periods', () => {
    expect(clinicCloseTime({ doctorByDate: { closed: false, periods: {} }, clinicByWeekday: DAY })).toBe('18:00')
  })

  it('uses the end of the last period, ignoring lunch', () => {
    expect(clinicCloseTime({ clinicByWeekday: DAY })).toBe('18:00')
  })

  it('prefers the doctor schedule and date-specific schedules', () => {
    const morningOnly = { closed: false, periods: { MORNING: { start: '09:00', end: '12:00' } } }
    const late = { closed: false, periods: { EVENING: { start: '18:00', end: '21:00' } } }
    expect(clinicCloseTime({ doctorByWeekday: morningOnly, clinicByWeekday: DAY })).toBe('12:00')
    expect(clinicCloseTime({ doctorByDate: late, doctorByWeekday: morningOnly })).toBe('21:00')
    expect(clinicCloseTime({ clinicByDate: late, clinicByWeekday: DAY })).toBe('21:00')
  })

  it('falls to midnight on a closed day', () => {
    expect(clinicCloseTime({ clinicByDate: { closed: true, periods: {} }, clinicByWeekday: DAY })).toBe('24:00')
    expect(clinicCloseTime({})).toBe('24:00')
  })
})

describe('migrateNoShowSettings (결정 4)', () => {
  it.each([
    [45, false, { noShowAfterMinutes: 60, noShowAtClinicClose: false }],
    [null, false, { noShowAfterMinutes: 10, noShowAtClinicClose: false }],
    [30, false, { noShowAfterMinutes: 30, noShowAtClinicClose: false }],
    [90, false, { noShowAfterMinutes: 60, noShowAtClinicClose: true }],
    [45, true, { noShowAfterMinutes: 60, noShowAtClinicClose: true }],
  ] as const)('migrates %s with close mode %s', (minutes, atClose, expected) => {
    expect(migrateNoShowSettings(minutes, atClose).settings).toEqual(expected)
  })

  it('reports whether the value changed', () => {
    expect(migrateNoShowSettings(30, false).adjusted).toBe(false)
    expect(migrateNoShowSettings(45, false).adjusted).toBe(true)
    expect(migrateNoShowSettings(90, false).adjusted).toBe(true)
  })

  it('throws on a non-finite value', () => {
    expect(() => migrateNoShowSettings(Number.NaN, false)).toThrow(RangeError)
  })
})

describe('applyNoShowPatch', () => {
  it('rejects minutes outside 10/30/60', () => {
    expect(applyNoShowPatch(THIRTY, { noShowAfterMinutes: 45 })).toEqual({ error: 'NO_SHOW_MINUTES_INVALID' })
  })

  it('keeps the minutes when close mode is toggled', () => {
    const on = applyNoShowPatch(THIRTY, { noShowAtClinicClose: true })
    expect(on).toEqual({ settings: AT_CLOSE })
    expect(applyNoShowPatch(AT_CLOSE, { noShowAtClinicClose: false })).toEqual({ settings: THIRTY })
  })
})
