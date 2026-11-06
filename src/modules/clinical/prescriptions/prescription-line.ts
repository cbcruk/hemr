import { Schema } from 'effect'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { decimalFraction } from '../../../shared/money/decimal.ts'

/** 처방 라인 ID입니다. 예: `pl_01J...` */
export const PrescriptionLineId = Schema.String.pipe(
  Schema.refine((value): value is Id<'prescriptionLine'> => isId('prescriptionLine', value)),
)

/** 처방 종류입니다 (clinical.md 처방 라인). 종류별 규칙은 완료 검증과 수납이 씁니다. */
export const PrescriptionKind = Schema.Literals([
  'CONSULTATION',
  'ACUPUNCTURE',
  'MOXIBUSTION',
  'CUPPING',
  'CHUNA',
  'PHARMACOPUNCTURE',
  'INSURED_MEDICINE',
  'PILOT_HERBAL',
  'HERBAL',
  'NONBENEFIT',
  'PACKAGE_SALE',
  'PACKAGE_USE',
  'HOME_VISIT',
  'OTHER',
])

/**
 * 소수점 아래 둘째 자리까지인 수입니다. 단가와 1일 횟수가 씁니다. 근삿값으로 비교하지 않고 센트 단위로 되돌린 값이 정확히
 * 같은지 봅니다. `1.000000001`처럼 아주 가까운 값을 받으면 금액 계산(`decimalFraction`)이 실패하기 때문입니다.
 */
const hasAtMostTwoDecimals = Schema.makeFilter((value: number) => Math.round(value * 100) / 100 === value, {
  title: 'up to 2 decimal places',
})

/** 투여·시술 양입니다. 금액은 `unitPrice × perDay × days`입니다. */
export const Dose = Schema.Struct({
  /** 1일 횟수입니다. 첩약 반 첩처럼 소수일 수 있습니다. */
  perDay: Schema.Number.check(Schema.isBetween({ minimum: 0.01, maximum: 1000 }), hasAtMostTwoDecimals),
  /** 일수입니다. */
  days: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 365 })),
})
export type Dose = typeof Dose.Type

/** 처방 시점의 단가(원)입니다. 소수점 아래 둘째 자리까지 받습니다. */
export const UnitPrice = Schema.Number.check(
  Schema.isBetween({ minimum: 0, maximum: 100_000_000 }),
  hasAtMostTwoDecimals,
)

/**
 * 진료의 처방 라인입니다.
 *
 * 지금은 저장과 금액 계산에 필요한 필드만 두었습니다. 침법·시간대 가산·부위·시술자·줄단위특정내역·패키지·심평원 승인·
 * 한약 처방은 그 기능이 생길 때 더합니다. 전체 리소스는 `docs/design/clinical.md`를 보세요.
 */
export const PrescriptionLine = Schema.Struct({
  id: PrescriptionLineId,
  kind: PrescriptionKind,
  /** 수가코드입니다. 비급여처럼 코드가 없으면 `null`입니다. */
  feeCode: Schema.NullOr(Schema.String),
  /** 처방 카테고리(현행 카테고리숫자코드) 8자리입니다. 보험구분 전용 카테고리 판정에 씁니다. */
  categoryCode: Schema.String,
  name: Schema.String,
  dose: Dose,
  /** 처방 시점 단가입니다. 설정 단가가 바뀌어도 이 진료의 금액은 변하지 않습니다. */
  unitPrice: Schema.Number,
  /** 서버가 계산한 금액(원)입니다. `unitPrice × perDay × days`를 반올림합니다. */
  amount: Schema.Int,
  /** 필요할 때 쓰는(PRN) 처방입니다. 쓰려면 `prescription:write_prn`이 필요합니다. */
  prn: Schema.Boolean,
})
export type PrescriptionLine = typeof PrescriptionLine.Type

/**
 * 처방 라인 금액입니다. `unitPrice × perDay × days`를 원 단위로 반올림(0.5는 올림)합니다. 소수를 정수 분수로 바꿔
 * 계산하므로 부동소수 오차가 없습니다.
 */
export function lineAmount(unitPrice: number, dose: Dose): number {
  const price = decimalFraction(unitPrice)
  const perDay = decimalFraction(dose.perDay)
  // 단가 1억 × 1일 1000회 × 365일은 정수 범위를 넘으므로 BigInt로 곱합니다
  const numerator = BigInt(price.numerator) * BigInt(perDay.numerator) * BigInt(dose.days)
  const denominator = BigInt(price.denominator) * BigInt(perDay.denominator)
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return Number(2n * remainder >= denominator ? quotient + 1n : quotient)
}
