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

describe('copayBasis', () => {
  it('reads NHIS without a copay code and refuses codes it does not interpret', () => {
    expect(copayBasis(visit('NHIS'))).toEqual({ kind: 'NHIS' })
    expect(copayBasis(visit('NHIS', { nhisCopayCode: '  ' }))).toEqual({ kind: 'NHIS' })
    expect(copayBasis(visit('NHIS', { nhisCopayCode: 'C' }))).toEqual({ kind: 'UNSUPPORTED' })
  })

  it('charges the full insured amount to full self-pay and benefit-restricted patients', () => {
    expect(copayBasis(visit('NHIS', { fullSelfPay: true }))).toEqual({ kind: 'FULL' })
    expect(copayBasis(visit('NHIS', { restricted: true, nhisCopayCode: 'C' }))).toEqual({ kind: 'FULL' })
    expect(copayBasis(visit('MEDICAL_AID', { fullSelfPay: true }))).toEqual({ kind: 'FULL' })
  })

  it('reads medical aid flat, referral and exempt codes; the staff choice comes first', () => {
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

  it('does not price other coverages', () => {
    expect(copayBasis(visit('AUTO_INSURANCE'))).toEqual({ kind: 'UNSUPPORTED' })
    expect(copayBasis(visit('SELF_PAY'))).toEqual({ kind: 'UNSUPPORTED' })
  })
})

const nhis = (amount: number, overrides: Partial<InsuredCopayInput> = {}) =>
  insuredCopay({ basis: { kind: 'NHIS' }, age: 40, pregnant: false, dispensed: false, amount, ...overrides })

describe('insuredCopay', () => {
  it('takes 30% of the total, dropping under 10 won from the total and under 100 won from the copay', () => {
    // 12,345 → 총액 12,340 → 3,702 → 3,700
    expect(nhis(12_345)).toEqual({ total: 12_340, copay: 3_700 })
    expect(nhis(0)).toEqual({ total: 0, copay: 0 })
  })

  it('lowers the rate for infants, pregnant patients and children under six', () => {
    expect(nhis(20_000, { age: 0 }).copay).toBe(1_000)
    expect(nhis(20_000, { age: 30, pregnant: true }).copay).toBe(2_000)
    // 21%: 18,890 × 0.21 = 3,966.9 → 3,900
    expect(nhis(18_890, { age: 1 }).copay).toBe(3_900)
    expect(nhis(18_890, { age: 5 }).copay).toBe(3_900)
    expect(nhis(18_890, { age: 6 }).copay).toBe(5_600)
  })

  it('applies the senior brackets from 65, with the boundary in the lower bracket', () => {
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

  it('never charges more than the total', () => {
    expect(nhis(1_200, { age: 70 })).toEqual({ total: 1_200, copay: 1_200 })
    const aid = { kind: 'MEDICAL_AID', exempt: false } as const
    expect(nhis(800, { basis: aid }).copay).toBe(800)
  })

  it('charges medical aid a flat fee per visit, more when dispensing, nothing when exempt or under one', () => {
    const aid = (overrides: Partial<InsuredCopayInput>) =>
      nhis(25_000, { basis: { kind: 'MEDICAL_AID', exempt: false }, ...overrides }).copay
    expect(aid({})).toBe(1_000)
    expect(aid({ dispensed: true })).toBe(1_500)
    expect(aid({ age: 70 })).toBe(1_000)
    expect(aid({ age: 0 })).toBe(0)
    expect(aid({ basis: { kind: 'MEDICAL_AID', exempt: true } })).toBe(0)
  })

  it('charges the whole total under full self-pay', () => {
    expect(nhis(12_345, { basis: { kind: 'FULL' }, age: 70 })).toEqual({ total: 12_340, copay: 12_340 })
  })
})
