import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiSchema } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { expectedVersion, withEtag } from '../../../shared/http/etag.ts'
import { Encounters } from './encounters.ts'

/** 진료 조회, 초안 저장, 완료 핸들러입니다. */
export const EncountersHttpLive = HttpApiBuilder.group(
  Api,
  'encounters',
  Effect.fn(function* (handlers) {
    const encounters = yield* Encounters

    return handlers.handleAll({
      get: ({ params }) => encounters.get(params.id).pipe(Effect.map(withEtag)),
      listForPatient: ({ params }) => encounters.listForPatient(params.id).pipe(Effect.map((items) => ({ items }))),
      update: ({ params, headers, payload }) =>
        encounters
          // 헤더는 필수라 버전이 늘 있습니다. 숫자가 아니면 어떤 버전과도 맞지 않는 `NaN`입니다
          .update(params.id, payload, { expectedVersion: expectedVersion(headers['if-match']).expectedVersion ?? NaN })
          .pipe(
            Effect.map((saved) =>
              HttpApiSchema.withHeaders({ body: saved, headers: { etag: `"${saved.encounter.version}"` } }),
            ),
          ),
      complete: ({ params, headers, payload }) =>
        encounters
          .complete(params.id, {
            ...payload,
            expectedVersion: expectedVersion(headers['if-match']).expectedVersion ?? NaN,
          })
          .pipe(
            Effect.map((completed) =>
              HttpApiSchema.withHeaders({ body: completed, headers: { etag: `"${completed.encounter.version}"` } }),
            ),
          ),
    })
  }),
)
