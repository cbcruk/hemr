/** 과세·비과세로 나눈 금액입니다(원). `docs/design/front-desk.md`의 `Payment.amount`와 같습니다. */
export interface SplitAmount {
  taxable: number
  taxExempt: number
}

export type PaymentMethod =
  | 'CARD'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'KAKAO_PAY'
  | 'LOCAL_CURRENCY'
  | 'ZERO_PAY'
  | 'PREPAID'
  | 'OVERPAID_CREDIT'
  | 'JEJU_SUBSIDY'
  | 'PACKAGE'

/** 선수금 계열입니다. 환불 수단 제약 때문에 나눕니다 (`docs/design/patients.md`의 선수금). */
export type PrepaidKind = 'CASH_LIKE' | 'CARD_LIKE'

/** 수납 요청의 결제 하나입니다. */
export interface CheckoutPayment {
  method: PaymentMethod
  prepaidKind?: PrepaidKind
  amount: SplitAmount
}

/** 수납할 진료 하나의 받을 금액입니다. */
export interface EncounterDue {
  encounterId: string
  /** 받을 금액입니다. 비과세는 급여 본인부담과 비과세 비급여의 합입니다. */
  due: SplitAmount
  /** 비과세 중 급여 본인부담입니다. 제주 지원의 상한입니다 (결정 4). */
  insuredCopay: number
  /** 제주 지원(4·3 유족·해녀) 대상이면 그 진료의 지원금입니다. 상한은 진료별이 아니라 선택한 진료 전체의 급여 본인부담 합입니다. */
  jejuSubsidy: number
}

/** 과수납금을 쓸 부분입니다. 현행처럼 비과세와 과세 중 한쪽에만 씁니다. */
export type OverpaidCreditTarget = 'TAX_EXEMPT' | 'TAXABLE'

export interface CheckoutInput {
  encounters: readonly EncounterDue[]
  /** 화면에서 입력한 결제입니다. 제주 지원금과 과수납금은 서버가 만들므로 넣지 않습니다. */
  payments: readonly CheckoutPayment[]
  /** 환자의 과수납 잔액입니다. */
  overpaidCreditBalance: number
  useOverpaidCredit?: OverpaidCreditTarget | null
  /** 계열별 선수금 잔액입니다. */
  prepaidBalances: Record<PrepaidKind, number>
  writeOffRemainder?: boolean
  acknowledge?: readonly 'OUTSTANDING'[]
}

export type SettlementResult = 'PAID' | 'OUTSTANDING' | 'OVERPAID' | 'WRITTEN_OFF'

export type CheckoutErrorCode =
  'PAYMENT_METHOD_NOT_ALLOWED' | 'PREPAID_KIND_REQUIRED' | 'PREPAID_BALANCE_INSUFFICIENT' | 'WRITE_OFF_OVERPAID'

export interface CheckoutSettlement {
  /** 서버가 만든 제주 지원금 결제(비과세)입니다. 0이면 행을 만들지 않습니다. */
  jejuSubsidy: number
  /** 과수납 잔액에서 쓴 금액입니다. */
  overpaidCreditApplied: SplitAmount
  /** 선택한 진료의 받을 금액 합입니다. */
  due: SplitAmount
  /** 제주 지원금과 과수납금을 뺀 뒤 환자에게 받을 금액입니다. */
  effectiveDue: SplitAmount
  /** 화면에서 입력한 결제의 합입니다. */
  entered: SplitAmount
  /** 받은 금액입니다. 입력 결제에 제주 지원금·과수납금 결제를 더한 값이라 `due − received`가 남은 금액입니다. */
  received: SplitAmount
  /** `due − received`(= `effectiveDue − entered`)를 과세·비과세 합으로 본 값입니다 (결정 1·3). */
  remaining: number
  result: SettlementResult
  outstanding: number
  overpaid: number
  writtenOff: number
  errors: CheckoutErrorCode[]
  /** 확인을 받지 않은 경고입니다. 하나라도 있으면 저장하지 않습니다. */
  warnings: 'OUTSTANDING'[]
  /** 확인을 받고 넘어간 경고입니다. 이력에 남깁니다. */
  acknowledged: 'OUTSTANDING'[]
  accepted: boolean
}

/** 환자 등급 할인 입력입니다. 비급여 처방 한 줄입니다. */
export interface GradeDiscountInput {
  unitPrice: number
  tax: number
  dailyDose: number
  days: number
  /** 할인율(%)입니다. 0–100 정수입니다. */
  rate: number
}

export interface GradeDiscount {
  original: number
  discounted: number
  discount: number
}
