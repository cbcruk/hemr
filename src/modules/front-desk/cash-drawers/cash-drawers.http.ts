import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { CashDrawers } from './cash-drawers.ts'

const items = <A>(list: ReadonlyArray<A>) => ({ items: list })

/** 시재와 지출 핸들러입니다. */
export const CashDrawersHttpLive = HttpApiBuilder.group(
  Api,
  'cashDrawers',
  Effect.fn(function* (handlers) {
    const drawers = yield* CashDrawers

    return handlers.handleAll({
      get: ({ params }) => drawers.get(params.date),
      open: ({ params, payload }) => drawers.open(params.date, payload),
      close: ({ params, payload }) => drawers.close(params.date, payload.countedAmount),
      reopen: ({ params, payload }) => drawers.reopen(params.date, payload.reason),
      listExpenses: ({ query }) => drawers.listExpenses(query).pipe(Effect.map(items)),
      recordExpense: ({ headers, payload }) =>
        drawers.recordExpense({ ...payload, idempotencyKey: headers['idempotency-key'] }),
      removeExpense: ({ params }) => drawers.removeExpense(params.id),
      listCategories: () => drawers.listCategories().pipe(Effect.map(items)),
      addCategory: ({ payload }) => drawers.addCategory(payload.name),
      removeCategory: ({ params }) => drawers.removeCategory(params.id),
    })
  }),
)
