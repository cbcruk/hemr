import { createHash } from 'node:crypto'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import type { Payment } from '../receipts/receipt.ts'
import type { CashMovement } from './cash-drawer.ts'
import type { Expense } from './cash-drawer-model.ts'

/** 원장 기록 하나입니다. `ref`는 원장 지문에 쓰는 기록의 이름입니다. */
export type LedgerEntry = CashMovement & { ref: string }

const dayOf = (at: string) => clinicDate(Date.parse(at))
const total = (amount: { taxable: number; taxExempt: number }) => amount.taxable + amount.taxExempt

/**
 * 그날(병원 시간대) 오간 돈의 원장입니다 (front-desk.md 시재와 지출). 돈이 실제로 오간 날로 셉니다.
 *
 * - 수납에 쓴 결제는 받은 날의 `PAYMENT`입니다. 나중에 환불하거나 취소해도 받은 날 기록은 그대로입니다
 * - 결제의 환불 기록은 하나씩 환불한 날의 `REFUND`이고, 수단은 환불 기록의 수단입니다
 * - 취소(`VOIDED`)한 결제는 취소한 날 남은 금액(받은 금액 − 환불한 금액)을 돌려준 `REFUND`입니다. 수단은 결제
 *   수단입니다. 받은 날 취소했으면 남은 금액은 오가지 않은 돈이라 수납과 환불 어느 쪽에도 넣지 않습니다
 *   (`cash-drawer.ts`의 "같은 날 취소된 결제는 넣지 않습니다"). `VOIDED`는 끝 상태라 마지막으로 바꾼 시각
 *   (`updatedAt`)이 취소한 시각입니다
 * - 지우지 않은 지출은 그 날짜의 `EXPENSE`입니다
 *
 * 미적용 결제(`UNAPPLIED`)는 밖에서 받은 결제(카드 등)뿐이라 현금 흐름에 영향이 없지만, 현금으로 환불하면 들어갑니다.
 */
export function cashLedger(
  date: string,
  payments: ReadonlyArray<Payment>,
  expenses: ReadonlyArray<Expense>,
): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  for (const payment of payments) {
    const refunded = payment.refunds.reduce((sum, refund) => sum + total(refund.amount), 0)
    const voided = payment.status === 'VOIDED' ? dayOf(payment.updatedAt) : null
    if (payment.status !== 'UNAPPLIED' && dayOf(payment.createdAt) === date) {
      // 받은 날 취소했으면 남은 금액은 오가지 않은 돈이라, 그날 환불한 만큼만 받은 것으로 셉니다
      const received = voided === date ? refunded : total(payment.amount)
      if (received > 0) entries.push({ kind: 'PAYMENT', method: payment.method, amount: received, ref: payment.id })
    }
    payment.refunds.forEach((refund, index) => {
      if (dayOf(refund.at) === date) {
        entries.push({
          kind: 'REFUND',
          method: refund.method,
          amount: total(refund.amount),
          ref: `${payment.id}/${index}`,
        })
      }
    })
    if (voided === date && dayOf(payment.createdAt) !== date) {
      entries.push({
        kind: 'REFUND',
        method: payment.method,
        amount: total(payment.amount) - refunded,
        ref: `${payment.id}/void`,
      })
    }
  }
  for (const expense of expenses) {
    if (expense.deleted === null && expense.date === date) {
      entries.push({ kind: 'EXPENSE', amount: expense.amount, ref: expense.id })
    }
  }
  return entries
}

/**
 * 현금 원장의 지문입니다. 현금이 오간 기록(현금 수납·환불과 지출)만 넣어, 카드 결제처럼 시재와 상관없는 변경은
 * 지문을 바꾸지 않습니다. 기록 순서와 상관없습니다.
 */
export function ledgerFingerprint(entries: ReadonlyArray<LedgerEntry>): string {
  const cash = entries
    .filter((each) => each.kind === 'EXPENSE' || each.method === 'CASH')
    .map((each) => `${each.kind}:${each.ref}:${each.amount}`)
    .sort()
  return createHash('sha256').update(JSON.stringify(cash)).digest('base64url')
}
