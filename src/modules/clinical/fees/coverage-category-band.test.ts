import { describe, expect, it } from 'vitest'
import { coverageMismatchLineIds } from './coverage-category-band.ts'
import type { CoverageContext } from './coverage-category-band.ts'

const NHIS: CoverageContext = { coverage: 'NHIS', herbalPilot: false, telemedicinePilot: false }

describe('보험구분에서 쓸 수 없는 처방 줄 (coverageMismatchLineIds)', () => {
  it('첩약 시범사업이 아니면 한약재를 포함한 시범사업 카테고리를 모두 막습니다', () => {
    const lines = ['35001001', '35001002', '35002001', '35003001', '35004001'].map((category) => ({
      lineId: category,
      category,
      feeCode: null,
    }))
    expect(coverageMismatchLineIds(lines, NHIS)).toHaveLength(5)
    expect(coverageMismatchLineIds(lines, { ...NHIS, herbalPilot: true })).toEqual([])
  })

  it('비대면 코드는 건보·의료급여의 비대면 시범사업 진료에서만 씁니다', () => {
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

  it('카테고리는 대역이 아니라 정확히 일치로 판정합니다', () => {
    const lines = [{ lineId: 'x', category: '73009999', feeCode: null }]
    expect(coverageMismatchLineIds(lines, NHIS)).toEqual([])
  })
})
