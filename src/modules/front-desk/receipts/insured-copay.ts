import type { Visit } from '../visits/visit.ts'

/**
 * 급여 본인부담의 근거입니다. 접수 때 받은 자격에서 정하고, 정할 수 없으면 `UNSUPPORTED`입니다
 * (docs/reference/rules/insured-copay.md).
 */
export type CopayBasis =
  | { kind: 'NHIS' }
  | { kind: 'MEDICAL_AID'; exempt: boolean }
  /** 본인부담 100%이거나 체납 급여제한자입니다. 급여 총액을 모두 환자가 냅니다. */
  | { kind: 'FULL' }
  | { kind: 'UNSUPPORTED' }

/** 1종 면제 본인부담여부(`M003`–`M018`)입니다. 18세 미만·임산부·희귀난치 등입니다. */
const MEDICAL_AID_EXEMPT = /^M0(0[3-9]|1[0-8])$/

/**
 * 내원의 자격에서 본인부담 근거를 정합니다. 직원이 고른 본인부담여부가 공단 조회 값보다 앞섭니다.
 *
 * - 건보: 본인부담여부가 없을 때만 계산합니다. 차상위·산정특례처럼 부담률을 바꾸는 코드는 아직 해석하지 않습니다
 * - 의료급여: 없음과 의뢰(`B005`)는 정액, 1종 면제(`M003`–`M018`)는 0원입니다. 선택기관(`M001`·`M002`)은 우리 기관이
 *   몇 차 선택기관인지에 따라 달라 아직 계산하지 않습니다
 */
export function copayBasis(visit: Pick<Visit, 'coverage' | 'eligibility' | 'benefitFlags'>): CopayBasis {
  if (visit.coverage !== 'NHIS' && visit.coverage !== 'MEDICAL_AID') return { kind: 'UNSUPPORTED' }
  if (visit.benefitFlags.fullSelfPay || visit.eligibility.benefitRestricted) return { kind: 'FULL' }
  const code = blankToNull(visit.eligibility.copayCode) ?? blankToNull(visit.eligibility.nhis?.copayCode ?? null)
  if (visit.coverage === 'NHIS') return code === null ? { kind: 'NHIS' } : { kind: 'UNSUPPORTED' }
  if (code === null || code === 'B005') return { kind: 'MEDICAL_AID', exempt: false }
  if (MEDICAL_AID_EXEMPT.test(code)) return { kind: 'MEDICAL_AID', exempt: true }
  return { kind: 'UNSUPPORTED' }
}

const blankToNull = (value: string | null) => (value === null || value.trim() === '' ? null : value.trim())

export interface InsuredCopayInput {
  basis: Exclude<CopayBasis, { kind: 'UNSUPPORTED' }>
  /** 진료일 기준 만 나이입니다. */
  age: number
  pregnant: boolean
  /** 보험 한약제제를 투약했는지입니다. 65세 이상 구간과 의료급여 정액이 달라집니다. */
  dispensed: boolean
  /** 급여 라인 금액의 합입니다. 비급여는 넣지 않습니다. */
  amount: number
}

/**
 * 한의원 외래 진료 한 건의 급여 본인부담입니다 (docs/reference/rules/insured-copay.md). 요양급여비용 총액은 10원 미만을
 * 버리고, 정률 본인부담은 100원 미만을 버립니다. 본인부담은 총액보다 크지 않습니다.
 */
export function insuredCopay(input: InsuredCopayInput): { total: number; copay: number } {
  const total = floorTo(input.amount, 10)
  return { total, copay: Math.min(total, copayOf(input, total)) }
}

function copayOf({ basis, age, pregnant, dispensed }: InsuredCopayInput, total: number): number {
  switch (basis.kind) {
    case 'FULL':
      return total
    case 'MEDICAL_AID':
      // 1세 미만 외래는 1종·2종 모두 기금이 냅니다. 직접조제(투약)는 1,500원, 그 밖은 1,000원입니다
      if (basis.exempt || age < 1) return 0
      return dispensed ? 1_500 : 1_000
    case 'NHIS':
      if (age < 1) return rate(total, 5)
      if (pregnant) return rate(total, 10)
      if (age < 6) return rate(total, 21)
      if (age >= 65) return seniorCopay(total, dispensed)
      return rate(total, 30)
  }
}

/**
 * 65세 이상 한의원 외래입니다 (시행규칙 [별표 3]). 경계값은 아래 구간에 들어갑니다. 투약하면 10%·20% 구간이 5,000원씩
 * 넓어집니다.
 */
function seniorCopay(total: number, dispensed: boolean): number {
  const step = dispensed ? 5_000 : 0
  if (total <= 15_000) return 1_500
  if (total <= 20_000 + step) return rate(total, 10)
  if (total <= 25_000 + step) return rate(total, 20)
  return rate(total, 30)
}

/** 총액에 백분율을 곱하고 100원 미만을 버립니다. 정수끼리 한 번만 나눠 부동소수 오차가 없습니다. */
const rate = (total: number, percent: number) => Math.floor((total * percent) / 10_000) * 100

const floorTo = (value: number, unit: number) => Math.floor(value / unit) * unit
