import type { PaymentMethod } from '../receipts/checkout-settlement.types.ts'

/** 시재 상태입니다. `docs/design/front-desk.md`의 시재와 지출과 같습니다. */
export type CashDrawerStatus = 'NOT_OPENED' | 'OPEN' | 'CLOSED' | 'REOPENED'

/** 환불 수단입니다. 카드 승인 취소(`CARD_CANCEL`)는 시재에 영향이 없습니다. */
export type RefundMethod = PaymentMethod | 'CARD_CANCEL'

/**
 * 그날 시재에 영향을 주는 원장 기록 하나입니다. 현금이 실제로 오간 날의 시재에 넣습니다.
 *
 * - `PAYMENT`: 수납에 쓴 결제입니다. 같은 날 취소(`VOIDED`)된 결제는 넣지 않습니다
 * - `PREPAID_CHARGE`: 선수금 충전입니다. 취소된 충전(`CHARGE_CANCEL`)은 넣지 않습니다
 * - `REFUND`: 수납·선수금 환불입니다. 환불마다 기록한 수단(`Refund.method`)을 쓰고, 취소된 환불(`REFUND_CANCEL`)은 넣지 않습니다.
 *   지난 날짜 수납을 오늘 취소해 현금을 돌려주면 오늘의 현금 환불입니다. 지난 날짜 시재는 바뀌지 않습니다
 * - `EXPENSE`: 지출입니다. 지출은 시재에서 나가는 현금입니다
 */
export type CashMovement =
  | { kind: 'PAYMENT' | 'PREPAID_CHARGE'; method: PaymentMethod; amount: number }
  | { kind: 'REFUND'; method: RefundMethod; amount: number }
  | { kind: 'EXPENSE'; amount: number }

export interface CashFlow {
  /** 현금 수납과 선수금 현금 충전의 합입니다. */
  cashIn: number
  /** 현금 환불의 합입니다. */
  cashRefunds: number
  expenses: number
  expectedClosing: number
}

/**
 * 예상 마감 금액입니다 (결정 1·2·3).
 *
 * `시작 + 현금 수납 + 선수금 현금 충전 − 지출 − 현금 환불`을 같은 원장에서 함께 계산하므로 구성값과
 * 합계가 어긋날 수 없습니다. 현금 환불은 환불 기록의 수단이 `CASH`인 것만 세고, 원래 수납 행의 결제수단
 * 구성과 상관없습니다. 음수도 될 수 있습니다.
 */
export function cashFlow(openingAmount: number, movements: readonly CashMovement[]): CashFlow {
  let cashIn = 0
  let cashRefunds = 0
  let expenses = 0
  for (const movement of movements) {
    if (movement.kind === 'EXPENSE') expenses += movement.amount
    else if (movement.method !== 'CASH') continue
    else if (movement.kind === 'REFUND') cashRefunds += movement.amount
    else cashIn += movement.amount
  }
  return { cashIn, cashRefunds, expenses, expectedClosing: openingAmount + cashIn - expenses - cashRefunds }
}

/**
 * 마감 차이입니다 (결정 4). `세어 본 금액 − 예상 마감 금액`이고, 0이 아니면 화면이 차이로 보여 줍니다.
 * `:close` 때의 예상 마감 금액으로 계산해 `closing.difference`에 남기고, 다시 마감하면 새로 계산합니다.
 */
export function closingDifference(countedAmount: number, expectedClosing: number): number {
  return countedAmount - expectedClosing
}

/**
 * 시재 상태입니다 (결정 4·5).
 *
 * `:open`을 하지 않았으면 `NOT_OPENED`입니다. 시작 금액 0으로 연 시재도 `OPEN`입니다. 마지막 `:close` 뒤에
 * 다시 열렸으면 `REOPENED`입니다. 다시 열리는 경로는 `:reopen {reason}`과, 마감 뒤 그날 현금 원장이 바뀌어
 * 서버가 사유 `CHANGED_AFTER_CLOSE`로 자동으로 연 경우 둘입니다. 다시 `:close`하면 `CLOSED`입니다.
 */
export function cashDrawerStatus(drawer: {
  opened: boolean
  closed: boolean
  reopenedSinceLastClose: boolean
}): CashDrawerStatus {
  if (!drawer.opened) return 'NOT_OPENED'
  if (!drawer.closed) return 'OPEN'
  return drawer.reopenedSinceLastClose ? 'REOPENED' : 'CLOSED'
}
