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

describe('부도 처리 여부 (isNoShowDue, 결정 1·3)', () => {
  it('시작 시각에서 정확히 N분이 지나면 부도 처리합니다', () => {
    expect(isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '10:29' })).toBe(false)
    expect(isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '10:30' })).toBe(true)
  })

  it.each(['ARRIVED', 'CANCELED', 'NO_SHOW'] as const)('%s 예약은 부도 처리하지 않습니다', (status) => {
    expect(isNoShowDue({ ...BOOKED, status }, THIRTY, '18:00', { date: '2026-11-03', time: '00:00' })).toBe(false)
  })

  it('시간 미정 예약과 진료 마감 모드는 진료 마감 시각에 부도 처리합니다', () => {
    const untimed = { ...BOOKED, startTime: null }
    expect(noShowDueTime(untimed, THIRTY, '18:00')).toBe('18:00')
    expect(noShowDueTime(BOOKED, AT_CLOSE, '18:00')).toBe('18:00')
  })

  it('자정을 넘는 부도 처리 시각을 다음 날까지 셉니다', () => {
    const late = { ...BOOKED, startTime: '23:45' }
    expect(noShowDueTime(late, THIRTY, '24:00')).toBe('24:15')
    expect(isNoShowDue(late, THIRTY, '24:00', { date: '2026-11-03', time: '00:14' })).toBe(false)
    expect(isNoShowDue(late, THIRTY, '24:00', { date: '2026-11-03', time: '00:15' })).toBe(true)
  })

  it('예약일 다음 날이면 어느 부도 처리 시각이든 지났습니다', () => {
    expect(isNoShowDue(BOOKED, AT_CLOSE, '24:00', { date: '2026-11-03', time: '00:00' })).toBe(true)
  })
})

describe('진료 마감 모드: 진료 마감 뒤 예약', () => {
  it('진료 마감 뒤에 시작하는 예약은 시작 + N분 전에 부도 처리하지 않습니다', () => {
    const afterClose = { ...BOOKED, startTime: '14:00' }
    expect(noShowDueTime(afterClose, AT_CLOSE, '12:00')).toBe('14:30')
    expect(isNoShowDue(afterClose, AT_CLOSE, '12:00', { date: '2026-11-02', time: '12:00' })).toBe(false)
  })
})

describe('입력 검증', () => {
  it('없는 날짜와 시각은 예외를 던집니다', () => {
    expect(() => isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-02-30', time: '10:00' })).toThrow(RangeError)
    expect(() => isNoShowDue(BOOKED, THIRTY, '18:00', { date: '2026-11-02', time: '25:00' })).toThrow(RangeError)
  })
})

describe('진료 마감 시각 (clinicCloseTime, 결정 2)', () => {
  it('구간이 없는 우선 일정은 건너뜁니다', () => {
    expect(clinicCloseTime({ doctorByDate: { closed: false, periods: {} }, clinicByWeekday: DAY })).toBe('18:00')
  })

  it('점심과 상관없이 마지막 구간의 종료 시각입니다', () => {
    expect(clinicCloseTime({ clinicByWeekday: DAY })).toBe('18:00')
  })

  it('진료의 일정과 날짜별 일정이 앞섭니다', () => {
    const morningOnly = { closed: false, periods: { MORNING: { start: '09:00', end: '12:00' } } }
    const late = { closed: false, periods: { EVENING: { start: '18:00', end: '21:00' } } }
    expect(clinicCloseTime({ doctorByWeekday: morningOnly, clinicByWeekday: DAY })).toBe('12:00')
    expect(clinicCloseTime({ doctorByDate: late, doctorByWeekday: morningOnly })).toBe('21:00')
    expect(clinicCloseTime({ clinicByDate: late, clinicByWeekday: DAY })).toBe('21:00')
  })

  it('휴진일이거나 일정이 없으면 24:00입니다', () => {
    expect(clinicCloseTime({ clinicByDate: { closed: true, periods: {} }, clinicByWeekday: DAY })).toBe('24:00')
    expect(clinicCloseTime({})).toBe('24:00')
  })
})

describe('부도 설정 이관 (migrateNoShowSettings, 결정 4)', () => {
  it.each([
    [45, false, { noShowAfterMinutes: 60, noShowAtClinicClose: false }],
    [null, false, { noShowAfterMinutes: 10, noShowAtClinicClose: false }],
    [30, false, { noShowAfterMinutes: 30, noShowAtClinicClose: false }],
    [90, false, { noShowAfterMinutes: 60, noShowAtClinicClose: true }],
    [45, true, { noShowAfterMinutes: 60, noShowAtClinicClose: true }],
  ] as const)('분 값 %s, 진료 마감 모드 %s를 이관합니다', (minutes, atClose, expected) => {
    expect(migrateNoShowSettings(minutes, atClose).settings).toEqual(expected)
  })

  it('값을 바꿨는지 알립니다', () => {
    expect(migrateNoShowSettings(30, false).adjusted).toBe(false)
    expect(migrateNoShowSettings(45, false).adjusted).toBe(true)
    expect(migrateNoShowSettings(90, false).adjusted).toBe(true)
  })

  it('유한하지 않은 분 값은 예외를 던집니다', () => {
    expect(() => migrateNoShowSettings(Number.NaN, false)).toThrow(RangeError)
  })
})

describe('부도 설정 변경 (applyNoShowPatch)', () => {
  it('10/30/60이 아닌 분 값은 거절합니다', () => {
    expect(applyNoShowPatch(THIRTY, { noShowAfterMinutes: 45 })).toEqual({ error: 'NO_SHOW_MINUTES_INVALID' })
  })

  it('진료 마감 모드를 켜고 꺼도 분 값은 남습니다', () => {
    const on = applyNoShowPatch(THIRTY, { noShowAtClinicClose: true })
    expect(on).toEqual({ settings: AT_CLOSE })
    expect(applyNoShowPatch(AT_CLOSE, { noShowAtClinicClose: false })).toEqual({ settings: THIRTY })
  })
})
