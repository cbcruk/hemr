import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { Receipts } from './receipts.ts'

/** 수납 견적과 수납 핸들러입니다. */
export const ReceiptsHttpLive = HttpApiBuilder.group(
  Api,
  'receipts',
  Effect.fn(function* (handlers) {
    const receipts = yield* Receipts

    return handlers.handleAll({
      quoteCheckout: ({ params, payload }) => receipts.quote(params.id, payload),
      checkout: ({ params, headers, payload }) =>
        receipts.checkout(params.id, { ...payload, idempotencyKey: headers['idempotency-key'] }),
    })
  }),
)
