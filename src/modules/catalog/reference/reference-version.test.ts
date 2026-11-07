import { describe, expect, it } from 'vitest'
import {
  effectiveAsOf,
  isCalendarDate,
  migrateAvailableDates,
  selectReferenceVersion,
  serviceDateOf,
  versionsFromStartDates,
} from './reference-version.ts'

describe('진료일 (serviceDateOf)', () => {
  it('시점의 오프셋과 상관없이 병원 시간대 날짜를 씁니다', () => {
    expect(serviceDateOf('2025-12-31T15:30:00Z')).toBe('2026-01-01')
    expect(serviceDateOf('2025-12-31T23:59:00+09:00')).toBe('2025-12-31')
    expect(serviceDateOf('2025-12-31T08:00:00-08:00')).toBe('2026-01-01')
  })

  it('RFC 3339가 아니거나 없는 날짜면 null입니다', () => {
    expect(serviceDateOf('2026-01-01')).toBeNull()
    expect(serviceDateOf('2026-01-01T10:00:00')).toBeNull()
    expect(serviceDateOf('2026-01-01T10:00Z')).toBeNull()
    expect(serviceDateOf('2026-02-30T10:00:00+09:00')).toBeNull()
  })
})

describe('달력 날짜 (isCalendarDate)', () => {
  it('2월 29일은 윤년에만 받고 YYYY-MM-DD 형식만 받습니다', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2027-02-29')).toBe(false)
    expect(isCalendarDate('20260101')).toBe(false)
    expect(isCalendarDate('0050-01-01')).toBe(true)
  })
})

describe('참조데이터 버전 선택 (selectReferenceVersion)', () => {
  const versions = versionsFromStartDates(['2026-01-01', '2025-01-01', '2026-01-01'])

  it('유효 종료일은 제외하고 같은 시작일은 하나로 합칩니다', () => {
    expect(versions).toEqual([
      { versionId: '20250101', validFrom: '2025-01-01', validTo: '2026-01-01' },
      { versionId: '20260101', validFrom: '2026-01-01', validTo: null },
    ])
    expect(selectReferenceVersion(versions, '2025-12-31')).toEqual({ version: versions[0] })
    expect(selectReferenceVersion(versions, '2026-01-01')).toEqual({ version: versions[1] })
  })

  it('기준일이 유효 기간 사이의 빈틈에 있으면 REFERENCE_DATA_UNAVAILABLE입니다', () => {
    const gapped = [{ versionId: 'a', validFrom: '2025-01-01', validTo: '2025-06-01' }]
    expect(selectReferenceVersion(gapped, '2025-07-01')).toEqual({ error: 'REFERENCE_DATA_UNAVAILABLE' })
  })

  it('형식이 틀린 기준일은 스키마가 먼저 막으므로 예외를 던집니다', () => {
    expect(() => selectReferenceVersion(versions, '20260101')).toThrow(RangeError)
  })
})

describe('조회 기준일 (effectiveAsOf)', () => {
  it('기준일이 없으면 병원 시간대의 오늘이고 있으면 그 날짜입니다', () => {
    expect(effectiveAsOf(undefined, Date.parse('2026-11-04T16:00:00Z'))).toBe('2026-11-05')
    expect(effectiveAsOf('2025-01-01', 0)).toBe('2025-01-01')
  })
})

describe('적용일자목록 이관 (migrateAvailableDates)', () => {
  it('날짜가 아닌 값은 버리지 않고 rejected로 돌려줍니다', () => {
    expect(migrateAvailableDates(['2025-04-01', 'N/A', '20251301'])).toEqual({
      dates: ['2025-04-01'],
      rejected: ['N/A', '20251301'],
    })
  })
})
