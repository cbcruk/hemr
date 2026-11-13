import { Result } from 'effect'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { decideVisitStatus } from '../visits/visit.aggregate.ts'
import type { VisitDecision } from '../visits/visit.aggregate.ts'
import type { Visit, VisitTransitionInvalid } from '../visits/visit.ts'
import { acceptSettlement, newReceipt, priceCheckout } from './receipt.aggregate.ts'
import type { CheckoutOptions, NewReceipt, PricingFacts, ReceiptIds, ReceiptOptions } from './receipt.aggregate.ts'
import { quoteIdOf } from './receipt-charges.ts'
import { QuoteStale } from './receipt.ts'
import type {
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  ReceiptAlreadyExists,
  ReceiptRecord,
} from './receipt.ts'

/**
 * 수납입니다. 영수증·결제·내원을 한 트랜잭션에 묶는 경계입니다(docs/design/domain-model.md 묶은 경계). 결제는 영수증
 * 하나에만 적용되고, 영수증이 있는 내원은 `COMPLETED`이며, 취소된 내원에는 영수증이 생기지 않습니다.
 */

/** 수납 입력입니다. 견적과 같은 선택에 견적 ID와 영수증 선택을 더합니다. */
export interface CheckoutCommand extends CheckoutOptions, ReceiptOptions {
  quoteId: Id<'quote'>
}

/** 수납을 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface CheckoutFacts extends PricingFacts {
  /** 이 내원의 유효한 영수증입니다. 없으면 `null`입니다. */
  activeReceipt: ReceiptRecord | null
}

export type CheckoutRejection =
  | VisitTransitionInvalid
  | ReceiptAlreadyExists
  | CheckoutEncounterInvalid
  | CheckoutCoverageUnsupported
  | CheckoutPaymentInvalid
  | QuoteStale
  | CheckoutRejected

/**
 * 수납을 판정합니다. 견적과 같이 계산하고, 금액이 견적(`quoteId`)과 다르면 409 `QUOTE_STALE`, 결산이 막으면 422
 * `CHECKOUT_REJECTED`입니다. 통과하면 내원을 `COMPLETED`로 옮기고(`visit.status_changed`) 영수증과
 * `receipt.created`를 만듭니다.
 */
export function decideCheckout(
  visit: Visit,
  input: CheckoutCommand,
  facts: CheckoutFacts,
  receiptIds: ReceiptIds,
  context: DecisionContext,
): Result.Result<{ visit: VisitDecision; receipt: NewReceipt }, CheckoutRejection> {
  const priced = priceCheckout(visit, facts.activeReceipt, input, facts)
  if (Result.isFailure(priced)) return Result.fail(priced.failure)
  const { ids, dues, applied, settled } = priced.success
  const quoted = quoteIdOf(dues)
  if (quoted !== input.quoteId) return Result.fail(new QuoteStale({ quoteId: quoted }))
  const settlement = acceptSettlement(settled)
  if (Result.isFailure(settlement)) return Result.fail(settlement.failure)

  // 수납할 수 있는 내원은 `CHECKOUT`을 늘 받습니다(지난 날짜도 받습니다). 어긋나면 결함입니다. `CHECKOUT`은 진료 내용
  // 사실을 보지 않아, 영수증까지 넓혀 읽지 않고 저장된 `hasClinicalData`를 넘깁니다
  const completed = decideVisitStatus(visit, 'CHECKOUT', {}, { hasClinicalData: visit.hasClinicalData }, context)
  if (Result.isFailure(completed)) throw new Error(`checkout of ${visit.id} was refused: ${completed.failure._tag}`)

  const receipt = newReceipt({
    visit,
    ids,
    dues,
    held: applied,
    payments: input.payments ?? [],
    settlement: settlement.success,
    options: input,
    correctionOf: null,
    receiptIds,
    context,
  })
  return Result.succeed({ visit: completed.success, receipt })
}
