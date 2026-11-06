import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { Payments } from './payments.ts'

/** 외부 승인 결제 핸들러입니다. */
export const PaymentsHttpLive = HttpApiBuilder.group(
  Api,
  'payments',
  Effect.fn(function* (handlers) {
    const payments = yield* Payments

    return handlers.handleAll({
      record: ({ headers, payload }) => payments.record({ ...payload, idempotencyKey: headers['idempotency-key'] }),
      get: ({ params }) => payments.get(params.id),
    })
  }),
)
