import { describe, expect, it } from 'vitest'
import {
  effectiveAsOf,
  isCalendarDate,
  migrateAvailableDates,
  selectReferenceVersion,
  serviceDateOf,
  versionsFromStartDates,
} from './reference-version.ts'

describe('serviceDateOf', () => {
  it('uses the clinic calendar date whatever offset the instant carries', () => {
    expect(serviceDateOf('2025-12-31T15:30:00Z')).toBe('2026-01-01')
    expect(serviceDateOf('2025-12-31T23:59:00+09:00')).toBe('2025-12-31')
    expect(serviceDateOf('2025-12-31T08:00:00-08:00')).toBe('2026-01-01')
  })

  it('rejects non RFC 3339 values and impossible dates', () => {
    expect(serviceDateOf('2026-01-01')).toBeNull()
    expect(serviceDateOf('2026-01-01T10:00:00')).toBeNull()
    expect(serviceDateOf('2026-01-01T10:00Z')).toBeNull()
    expect(serviceDateOf('2026-02-30T10:00:00+09:00')).toBeNull()
  })
})

describe('isCalendarDate', () => {
  it('accepts leap days only in leap years', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2027-02-29')).toBe(false)
    expect(isCalendarDate('20260101')).toBe(false)
    expect(isCalendarDate('0050-01-01')).toBe(true)
  })
})

describe('selectReferenceVersion', () => {
  const versions = versionsFromStartDates(['2026-01-01', '2025-01-01', '2026-01-01'])

  it('treats validTo as exclusive and merges duplicate start dates', () => {
    expect(versions).toEqual([
      { versionId: '20250101', validFrom: '2025-01-01', validTo: '2026-01-01' },
      { versionId: '20260101', validFrom: '2026-01-01', validTo: null },
    ])
    expect(selectReferenceVersion(versions, '2025-12-31')).toEqual({ version: versions[0] })
    expect(selectReferenceVersion(versions, '2026-01-01')).toEqual({ version: versions[1] })
  })

  it('reports a gap between explicit validity ranges as unavailable', () => {
    const gapped = [{ versionId: 'a', validFrom: '2025-01-01', validTo: '2025-06-01' }]
    expect(selectReferenceVersion(gapped, '2025-07-01')).toEqual({ error: 'REFERENCE_DATA_UNAVAILABLE' })
  })

  it('throws on a malformed asOf because the schema rejects it first', () => {
    expect(() => selectReferenceVersion(versions, '20260101')).toThrow(RangeError)
  })
})

describe('effectiveAsOf', () => {
  it('defaults to the clinic date of now', () => {
    expect(effectiveAsOf(undefined, Date.parse('2026-11-04T16:00:00Z'))).toBe('2026-11-05')
    expect(effectiveAsOf('2025-01-01', 0)).toBe('2025-01-01')
  })
})

describe('migrateAvailableDates', () => {
  it('reports values without a valid date instead of dropping them silently', () => {
    expect(migrateAvailableDates(['2025-04-01', 'N/A', '20251301'])).toEqual({
      dates: ['2025-04-01'],
      rejected: ['N/A', '20251301'],
    })
  })
})
