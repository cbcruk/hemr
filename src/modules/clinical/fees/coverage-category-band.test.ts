import { describe, expect, it } from 'vitest'
import { coverageMismatchLineIds } from './coverage-category-band.ts'
import type { CoverageContext } from './coverage-category-band.ts'

const NHIS: CoverageContext = { coverage: 'NHIS', herbalPilot: false, telemedicinePilot: false }

describe('coverageMismatchLineIds', () => {
  it('blocks every herbal pilot category including 한약재 outside the pilot', () => {
    const lines = ['35001001', '35001002', '35002001', '35003001', '35004001'].map((category) => ({
      lineId: category,
      category,
      feeCode: null,
    }))
    expect(coverageMismatchLineIds(lines, NHIS)).toHaveLength(5)
    expect(coverageMismatchLineIds(lines, { ...NHIS, herbalPilot: true })).toEqual([])
  })

  it('allows telemedicine codes only in a national-coverage telemedicine visit', () => {
    const lines = [
      { lineId: 'm', category: '31001001', feeCode: '91004' },
      { lineId: 'p', category: '31001001', feeCode: '91000001' },
    ]
    expect(coverageMismatchLineIds(lines, { ...NHIS, coverage: 'MEDICAL_AID', telemedicinePilot: true })).toEqual([])
    expect(coverageMismatchLineIds(lines, { ...NHIS, coverage: 'AUTO_INSURANCE', telemedicinePilot: true })).toEqual([
      'm',
      'p',
    ])
  })

  it('matches categories exactly rather than by band', () => {
    const lines = [{ lineId: 'x', category: '73009999', feeCode: null }]
    expect(coverageMismatchLineIds(lines, NHIS)).toEqual([])
  })
})
