import { DateTime, Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { Procedures } from './procedures.ts'

const items = <A>(list: ReadonlyArray<A>) => ({ items: list })

/** 치료실 보드와 시술 핸들러입니다. */
export const ProceduresHttpLive = HttpApiBuilder.group(
  Api,
  'procedures',
  Effect.fn(function* (handlers) {
    const procedures = yield* Procedures

    return handlers.handleAll({
      board: ({ query }) =>
        Effect.gen(function* () {
          const entries = yield* procedures.board(query.date)
          return { serverTime: DateTime.formatIso(yield* DateTime.now), items: entries }
        }),
      listForVisit: ({ params }) => procedures.listForVisit(params.id).pipe(Effect.map(items)),
      add: ({ params, payload }) => procedures.add(params.id, payload),
      setDuration: ({ params, payload }) => procedures.setDuration(params.id, payload.durationSeconds),
      remove: ({ params }) => procedures.remove(params.id),
      start: ({ params }) => procedures.start(params.id).pipe(Effect.map(items)),
      complete: ({ params }) => procedures.complete(params.id),
      restartTimer: ({ params }) => procedures.restartTimer(params.id),
      reopen: ({ params }) => procedures.reopen(params.id),
      startAll: ({ params }) => procedures.startAll(params.id).pipe(Effect.map(items)),
      completeAll: ({ params }) => procedures.completeAll(params.id).pipe(Effect.map(items)),
      reorder: ({ params, payload }) => procedures.reorder(params.id, payload.ids).pipe(Effect.map(items)),
    })
  }),
)
