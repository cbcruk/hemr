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
const 의료급여1종면제코드 = /^M0(0[3-9]|1[0-8])$/

/**
 * 내원의 자격에서 본인부담 근거를 정합니다. 직원이 고른 본인부담여부가 공단 조회 값보다 앞섭니다.
 *
 * - 건보: 본인부담여부가 없을 때만 계산합니다. 코드가 있으면 차상위 등일 수 있어 계산하지 않습니다. 산정특례·조산아는
 *   접수가 아직 받지 않아 일반 부담률로 계산됩니다(insured-copay.md 서버 구현)
 * - 의료급여: 없음과 의뢰(`B005`)는 정액, 1종 면제(`M003`–`M018`)는 0원입니다. 선택기관(`M001`·`M002`)은 우리 기관이
 *   몇 차 선택기관인지에 따라 달라 아직 계산하지 않습니다
 */
export function copayBasis(visit: Pick<Visit, 'coverage' | 'eligibility' | 'benefitFlags'>): CopayBasis {
  if (visit.coverage !== 'NHIS' && visit.coverage !== 'MEDICAL_AID') return { kind: 'UNSUPPORTED' }
  if (visit.benefitFlags.fullSelfPay || visit.eligibility.benefitRestricted) return { kind: 'FULL' }
  const code = blankToNull(visit.eligibility.copayCode) ?? blankToNull(visit.eligibility.nhis?.copayCode ?? null)
  if (visit.coverage === 'NHIS') return code === null ? { kind: 'NHIS' } : { kind: 'UNSUPPORTED' }
  if (code === null || code === 'B005') return { kind: 'MEDICAL_AID', exempt: false }
  if (의료급여1종면제코드.test(code)) return { kind: 'MEDICAL_AID', exempt: true }
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
  const 요양급여비용총액 = floorTo(input.amount, 10)
  return { total: 요양급여비용총액, copay: 본인부담금(input, 요양급여비용총액) }
}

/**
 * 근거별 본인부담입니다. 건보는 시행령 [별표 2]의 본인일부부담금, 의료급여는 시행령 [별표 1]의 본인부담금이고, 어느
 * 쪽이든 총액보다 크지 않습니다.
 */
function 본인부담금(input: InsuredCopayInput, 요양급여비용총액: number): number {
  return Math.min(요양급여비용총액, 상한전본인부담(input, 요양급여비용총액))
}

function 상한전본인부담({ basis, age, pregnant, dispensed }: InsuredCopayInput, 총액: number): number {
  switch (basis.kind) {
    case 'FULL':
      return 총액
    case 'MEDICAL_AID':
      // 1세 미만 외래는 1종·2종 모두 기금이 냅니다. 직접조제(투약)는 1,500원, 그 밖은 1,000원입니다
      if (basis.exempt || age < 1) return 0
      return dispensed ? 1_500 : 1_000
    case 'NHIS':
      if (age < 1) return 정률(총액, 5)
      if (pregnant) return 정률(총액, 10)
      if (age < 6) return 정률(총액, 21)
      if (age >= 65) return 노인외래본인부담(총액, dispensed)
      return 정률(총액, 30)
  }
}

/**
 * 65세 이상 한의원 외래입니다 (시행규칙 [별표 3]). 식별자가 숫자로 시작할 수 없어 "노인"이라 했습니다. 경계값은 아래
 * 구간에 들어갑니다. 투약하면 10%·20% 구간이 5,000원씩 넓어집니다. 별표 3의 구간을 넘으면 별표 2의 30%입니다.
 */
function 노인외래본인부담(총액: number, 투약: boolean): number {
  const 투약구간확장 = 투약 ? 5_000 : 0
  if (총액 <= 15_000) return 1_500
  if (총액 <= 20_000 + 투약구간확장) return 정률(총액, 10)
  if (총액 <= 25_000 + 투약구간확장) return 정률(총액, 20)
  return 정률(총액, 30)
}

/** 총액에 백분율을 곱하고 100원 미만을 버립니다. 정수끼리 한 번만 나눠 부동소수 오차가 없습니다. */
const 정률 = (총액: number, 백분율: number) => Math.floor((총액 * 백분율) / 10_000) * 100

const floorTo = (value: number, unit: number) => Math.floor(value / unit) * unit
