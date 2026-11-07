import { describe, expect, it } from 'vitest'
import { clinicDate, clinicDayRange, clinicTime } from './clinic-date.ts'

describe('clinicDate', () => {
  it('uses the clinic time zone, not UTC', () => {
    // UTC 2026-11-04 15:00은 서울 2026-11-05 00:00입니다.
    expect(clinicDate(Date.UTC(2026, 10, 4, 15, 0))).toBe('2026-11-05')
    expect(clinicDate(Date.UTC(2026, 10, 4, 14, 59))).toBe('2026-11-04')
  })
})

describe('clinicTime', () => {
  it('uses the clinic time zone and a 24-hour clock', () => {
    expect(clinicTime(Date.UTC(2026, 10, 4, 15, 0))).toBe('00:00')
    expect(clinicTime(Date.UTC(2026, 10, 4, 14, 59))).toBe('23:59')
  })
})

describe('clinicDayRange', () => {
  it('covers the clinic day from midnight in Seoul up to the next midnight', () => {
    const range = clinicDayRange('2026-11-07')
    expect(range).toEqual({ from: '2026-11-06T15:00:00.000Z', to: '2026-11-07T15:00:00.000Z' })
    expect(clinicDate(Date.parse('2026-11-07T14:59:59.999Z'))).toBe('2026-11-07')
    expect(clinicDate(Date.parse(range.to))).toBe('2026-11-08')
  })
})
