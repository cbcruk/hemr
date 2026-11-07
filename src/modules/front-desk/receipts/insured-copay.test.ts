import { describe, expect, it } from 'vitest'
import type { Visit } from '../visits/visit.ts'
import { copayBasis, insuredCopay, type InsuredCopayInput } from './insured-copay.ts'

const visit = (
  coverage: Visit['coverage'],
  options: {
    copayCode?: string | null
    nhisCopayCode?: string | null
    restricted?: boolean
    fullSelfPay?: boolean
  } = {},
): Pick<Visit, 'coverage' | 'eligibility' | 'benefitFlags'> => ({
  coverage,
  eligibility: {
    status: 'VERIFIED',
    nhis: {
      qualificationCode: coverage === 'MEDICAL_AID' ? '7' : '1',
      benefitRestrictionCode: null,
      copayCode: options.nhisCopayCode ?? null,
      selectedInstitutionCodes: [],
      identityExempt: false,
    },
    identityVerified: true,
    benefitRestricted: options.restricted ?? false,
    copayCode: options.copayCode ?? null,
    selectedInstitutionCode: null,
  },
  benefitFlags: { fullSelfPay: options.fullSelfPay ?? false, pregnant: false },
})

describe('본인부담 근거 (copayBasis)', () => {
  it('건보는 본인부담여부가 없을 때만 계산하고 해석하지 않는 코드는 거절합니다', () => {
    expect(copayBasis(visit('NHIS'))).toEqual({ kind: 'NHIS' })
    expect(copayBasis(visit('NHIS', { nhisCopayCode: '  ' }))).toEqual({ kind: 'NHIS' })
    expect(copayBasis(visit('NHIS', { nhisCopayCode: 'C' }))).toEqual({ kind: 'UNSUPPORTED' })
  })

  it('본인부담 100%와 급여제한자는 급여 총액을 모두 냅니다', () => {
    expect(copayBasis(visit('NHIS', { fullSelfPay: true }))).toEqual({ kind: 'FULL' })
    expect(copayBasis(visit('NHIS', { restricted: true, nhisCopayCode: 'C' }))).toEqual({ kind: 'FULL' })
    expect(copayBasis(visit('MEDICAL_AID', { fullSelfPay: true }))).toEqual({ kind: 'FULL' })
  })

  it('의료급여는 코드 없음·의뢰(B005)·1종 면제(M003–M018)를 읽고 직원이 고른 코드가 앞섭니다', () => {
    expect(copayBasis(visit('MEDICAL_AID'))).toEqual({ kind: 'MEDICAL_AID', exempt: false })
    expect(copayBasis(visit('MEDICAL_AID', { nhisCopayCode: 'M001', copayCode: 'B005' }))).toEqual({
      kind: 'MEDICAL_AID',
      exempt: false,
    })
    expect(copayBasis(visit('MEDICAL_AID', { nhisCopayCode: 'M003' }))).toEqual({ kind: 'MEDICAL_AID', exempt: true })
    expect(copayBasis(visit('MEDICAL_AID', { nhisCopayCode: 'M018' }))).toEqual({ kind: 'MEDICAL_AID', exempt: true })
    for (const code of ['M001', 'M002', 'M019', 'U001', 'B014']) {
      expect(copayBasis(visit('MEDICAL_AID', { nhisCopayCode: code }))).toEqual({ kind: 'UNSUPPORTED' })
    }
  })

  it('건보·의료급여가 아닌 보험구분은 계산하지 않습니다', () => {
    expect(copayBasis(visit('AUTO_INSURANCE'))).toEqual({ kind: 'UNSUPPORTED' })
    expect(copayBasis(visit('SELF_PAY'))).toEqual({ kind: 'UNSUPPORTED' })
  })
})

const nhis = (amount: number, overrides: Partial<InsuredCopayInput> = {}) =>
  insuredCopay({ basis: { kind: 'NHIS' }, age: 40, pregnant: false, dispensed: false, amount, ...overrides })

describe('급여 본인부담 (insuredCopay)', () => {
  it('총액의 30%이고 총액은 10원 미만, 본인부담은 100원 미만을 버립니다', () => {
    // 12,345 → 총액 12,340 → 3,702 → 3,700
    expect(nhis(12_345)).toEqual({ total: 12_340, copay: 3_700 })
    expect(nhis(0)).toEqual({ total: 0, copay: 0 })
  })

  it('1세 미만·임신부·6세 미만은 부담률이 낮습니다', () => {
    expect(nhis(20_000, { age: 0 }).copay).toBe(1_000)
    expect(nhis(20_000, { age: 30, pregnant: true }).copay).toBe(2_000)
    // 21%: 18,890 × 0.21 = 3,966.9 → 3,900
    expect(nhis(18_890, { age: 1 }).copay).toBe(3_900)
    expect(nhis(18_890, { age: 5 }).copay).toBe(3_900)
    expect(nhis(18_890, { age: 6 }).copay).toBe(5_600)
  })

  it('65세 이상은 총액 구간을 따르고 경계값은 아래 구간이며 투약하면 구간이 넓어집니다', () => {
    expect(nhis(15_000, { age: 64 }).copay).toBe(4_500)
    const senior = (amount: number, dispensed = false) => nhis(amount, { age: 65, dispensed }).copay
    expect(senior(15_000)).toBe(1_500)
    expect(senior(15_010)).toBe(1_500)
    expect(senior(20_000)).toBe(2_000)
    expect(senior(20_010)).toBe(4_000)
    expect(senior(25_000)).toBe(5_000)
    expect(senior(25_010)).toBe(7_500)
    // 투약하면 10%·20% 구간이 5,000원씩 넓어집니다
    expect(senior(25_000, true)).toBe(2_500)
    expect(senior(25_010, true)).toBe(5_000)
    expect(senior(30_000, true)).toBe(6_000)
    expect(senior(30_010, true)).toBe(9_000)
  })

  it('본인부담은 총액보다 크지 않습니다', () => {
    expect(nhis(1_200, { age: 70 })).toEqual({ total: 1_200, copay: 1_200 })
    const aid = { kind: 'MEDICAL_AID', exempt: false } as const
    expect(nhis(800, { basis: aid }).copay).toBe(800)
  })

  it('의료급여는 방문당 정액이고 투약하면 더 내며 면제·1세 미만은 0원입니다', () => {
    const aid = (overrides: Partial<InsuredCopayInput>) =>
      nhis(25_000, { basis: { kind: 'MEDICAL_AID', exempt: false }, ...overrides }).copay
    expect(aid({})).toBe(1_000)
    expect(aid({ dispensed: true })).toBe(1_500)
    expect(aid({ age: 70 })).toBe(1_000)
    expect(aid({ age: 0 })).toBe(0)
    expect(aid({ basis: { kind: 'MEDICAL_AID', exempt: true } })).toBe(0)
  })

  it('본인부담 100%는 총액을 모두 냅니다', () => {
    expect(nhis(12_345, { basis: { kind: 'FULL' }, age: 70 })).toEqual({ total: 12_340, copay: 12_340 })
  })
})
