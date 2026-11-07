import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiSchema } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { AmendmentProposals } from './amendment-proposals.ts'

/** 정정 제안 핸들러입니다. 반영 응답의 `ETag`는 정정한 진료의 버전입니다. */
export const AmendmentProposalsHttpLive = HttpApiBuilder.group(
  Api,
  'amendmentProposals',
  Effect.fn(function* (handlers) {
    const proposals = yield* AmendmentProposals

    return handlers.handleAll({
      propose: ({ params, payload }) => proposals.propose(params.id, payload),
      list: ({ params, query }) => proposals.list(params.id, query.status).pipe(Effect.map((items) => ({ items }))),
      get: ({ params }) => proposals.get(params.id),
      apply: ({ params, payload }) =>
        proposals
          .apply(params.id, payload)
          .pipe(
            Effect.map((body) => HttpApiSchema.withHeaders({ body, headers: { etag: `"${body.encounter.version}"` } })),
          ),
      dismiss: ({ params, payload }) => proposals.dismiss(params.id, payload.reason),
    })
  }),
)
