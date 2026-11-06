import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { VisitId } from '../visits/visit.ts'

/** 영수증(수납) ID입니다. 예: `rcp_01J...` */
export const ReceiptId = Schema.String.pipe(Schema.refine((value): value is Id<'receipt'> => isId('receipt', value)))

/** 결제 ID입니다. 예: `pay_01J...` */
export const PaymentId = Schema.String.pipe(Schema.refine((value): value is Id<'payment'> => isId('payment', value)))

/** 견적 ID입니다. 견적 금액에서 계산하므로 금액이 같으면 같은 ID입니다. 예: `qt_...` */
export const QuoteId = Schema.String.pipe(Schema.refine((value): value is Id<'quote'> => isId('quote', value)))

/** 0 이상 정수 금액(원)입니다. */
export const Won = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(10_000_000_000))

/** 과세·비과세로 나눈 금액입니다. 수납이 계산한 값은 처방 수정으로 한쪽이 음수일 수 있어 부호를 막지 않습니다. */
export const SplitAmount = Schema.Struct({ taxable: Schema.Int, taxExempt: Schema.Int })

/** 결제 수단입니다 (`checkout-settlement.types.ts`의 `PaymentMethod`). */
export const PaymentMethod = Schema.Literals([
  'CARD',
  'CASH',
  'BANK_TRANSFER',
  'KAKAO_PAY',
  'LOCAL_CURRENCY',
  'ZERO_PAY',
  'PREPAID',
  'OVERPAID_CREDIT',
  'JEJU_SUBSIDY',
  'PACKAGE',
])

export const PrepaidKind = Schema.Literals(['CASH_LIKE', 'CARD_LIKE'])

/** 영수증에 적용한 결제입니다. 환불·외부 승인(`UNAPPLIED`)은 그 기능이 생길 때 더합니다. */
export const ReceiptPayment = Schema.Struct({
  id: PaymentId,
  method: PaymentMethod,
  prepaidKind: Schema.NullOr(PrepaidKind),
  amount: SplitAmount,
  status: Schema.Literals(['CAPTURED']),
})
export type ReceiptPayment = typeof ReceiptPayment.Type

/** 서버가 계산한 청구 금액입니다. 패키지 판매·할인은 그 기능이 생길 때 더합니다. */
export const ReceiptCharges = Schema.Struct({
  /** 급여 본인부담입니다. 지금은 일반 진료만 받아 늘 0입니다. */
  insuredCopay: Schema.Int,
  nonbenefit: SplitAmount,
  total: Schema.Int,
})
export type ReceiptCharges = typeof ReceiptCharges.Type

export const SettlementResult = Schema.Literals(['PAID', 'OUTSTANDING', 'OVERPAID', 'WRITTEN_OFF'])

/** 결산 결과입니다 (`settleCheckout`). `due − received`가 남은 금액입니다. */
export const ReceiptSettlement = Schema.Struct({
  due: SplitAmount,
  received: SplitAmount,
  result: SettlementResult,
  outstanding: Schema.Int,
  overpaid: Schema.Int,
  writtenOff: Schema.Int,
  /** 확인을 받고 넘어간 경고입니다. */
  acknowledged: Schema.Array(Schema.Literals(['OUTSTANDING'])),
})
export type ReceiptSettlement = typeof ReceiptSettlement.Type

/**
 * 영수증(수납)입니다. 한 내원의 진료를 한 번에 수납한 기록입니다.
 *
 * 내원 없는 수납, 환불·취소(`VOIDED`), 외부 승인 결제는 그 기능이 생길 때 더합니다. 전체 리소스는
 * `docs/design/front-desk.md`의 수납을 보세요.
 */
export const Receipt = Schema.Struct({
  id: ReceiptId,
  tenantId: TenantId,
  visitId: VisitId,
  patientId: PatientId,
  /** 수납한 날(병원 시간대)입니다. 시재가 이 날의 현금으로 셉니다. */
  date: Schema.String,
  cashierId: UserId,
  memo: Schema.String,
  encounterIds: Schema.Array(EncounterId),
  /** 이 영수증을 만든 견적입니다. */
  quoteId: QuoteId,
  charges: ReceiptCharges,
  payments: Schema.Array(ReceiptPayment),
  settlement: ReceiptSettlement,
  flags: Schema.Struct({ excludeFromTaxDeduction: Schema.Boolean }),
  status: Schema.Literals(['ACTIVE']),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
})
export type Receipt = typeof Receipt.Type

/** 결산 오류 코드입니다 (`checkout-settlement.types.ts`의 `CheckoutErrorCode`). */
export const CheckoutErrorCode = Schema.Literals([
  'PAYMENT_METHOD_NOT_ALLOWED',
  'PREPAID_KIND_REQUIRED',
  'PREPAID_BALANCE_INSUFFICIENT',
  'WRITE_OFF_OVERPAID',
])

/** 결산이 수납을 막았습니다. 결제 오류(`errors`)나 확인을 받지 않은 경고(`warnings`)를 모두 담습니다. */
export class CheckoutRejected extends HttpApiError.Problem<CheckoutRejected>()(
  'CheckoutRejected',
  { type: problemType('CHECKOUT_REJECTED'), status: 422, title: 'Checkout rejected' },
  {
    code: Schema.tag('CHECKOUT_REJECTED'),
    errors: Schema.Array(CheckoutErrorCode),
    warnings: Schema.Array(Schema.Literals(['OUTSTANDING'])),
  },
) {}

/** 견적 뒤 청구 금액이 바뀌었습니다. 새 견적을 받아 다시 수납합니다. */
export class QuoteStale extends HttpApiError.Problem<QuoteStale>()(
  'QuoteStale',
  { type: problemType('QUOTE_STALE'), status: 409, title: 'Charges changed after the quote' },
  { code: Schema.tag('QUOTE_STALE'), quoteId: QuoteId },
) {}

/**
 * 내원에 이미 유효한 영수증이 있습니다. 수납 뒤 `:reopen`한 내원을 다시 수납하려면 먼저 그 영수증을 취소하거나
 * 정정합니다(#35).
 */
export class ReceiptAlreadyExists extends HttpApiError.Problem<ReceiptAlreadyExists>()(
  'ReceiptAlreadyExists',
  { type: problemType('RECEIPT_ALREADY_EXISTS'), status: 409, title: 'Visit already has a receipt' },
  { code: Schema.tag('RECEIPT_ALREADY_EXISTS'), receiptId: ReceiptId },
) {}

/** 고른 진료가 이 내원의 수납할 수 있는 진료가 아닙니다(다른 내원, 철회, 없음). */
export class CheckoutEncounterInvalid extends HttpApiError.Problem<CheckoutEncounterInvalid>()(
  'CheckoutEncounterInvalid',
  { type: problemType('CHECKOUT_ENCOUNTER_INVALID'), status: 422, title: 'Encounter cannot be checked out here' },
  { code: Schema.tag('CHECKOUT_ENCOUNTER_INVALID'), encounterIds: Schema.Array(Schema.String) },
) {}

/** 급여 본인부담을 아직 계산하지 못합니다. 처방이 있는 보험 진료는 수납할 수 없습니다. */
export class CheckoutCoverageUnsupported extends HttpApiError.Problem<CheckoutCoverageUnsupported>()(
  'CheckoutCoverageUnsupported',
  {
    type: problemType('CHECKOUT_COVERAGE_UNSUPPORTED'),
    status: 422,
    title: 'Insured copay calculation is not available yet',
  },
  { code: Schema.tag('CHECKOUT_COVERAGE_UNSUPPORTED'), encounterIds: Schema.Array(EncounterId) },
) {}
