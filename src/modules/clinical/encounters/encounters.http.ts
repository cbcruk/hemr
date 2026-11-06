import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiSchema } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { expectedVersion, withEtag } from '../../../shared/http/etag.ts'
import { Encounters } from './encounters.ts'

/** `If-Match` 헤더의 버전입니다. 헤더는 필수라 늘 있고, 숫자가 아니면 어떤 버전과도 맞지 않는 `NaN`입니다. */
const versionOf = (headers: { 'if-match': string }) => expectedVersion(headers['if-match']).expectedVersion ?? NaN

/** 진료를 버전 `ETag`와 함께 돌려줍니다. */
const withEncounterEtag = <A extends { encounter: { version: number } }>(body: A) =>
  HttpApiSchema.withHeaders({ body, headers: { etag: `"${body.encounter.version}"` } })

/** 진료 조회, 초안 저장, 완료, 정정·철회·고정, 판 조회 핸들러입니다. */
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
          .update(params.id, payload, { expectedVersion: versionOf(headers) })
          .pipe(Effect.map(withEncounterEtag)),
      complete: ({ params, headers, payload }) =>
        encounters
          .complete(params.id, { ...payload, expectedVersion: versionOf(headers) })
          .pipe(Effect.map(withEncounterEtag)),
      amend: ({ params, headers, payload }) =>
        encounters
          .amend(params.id, { ...payload, expectedVersion: versionOf(headers) })
          .pipe(Effect.map(withEncounterEtag)),
      retract: ({ params, headers, payload }) =>
        encounters
          .retract(params.id, { reason: payload.reason, expectedVersion: versionOf(headers) })
          .pipe(Effect.map(withEtag)),
      lock: ({ params, headers }) =>
        encounters.setLocked(params.id, true, { expectedVersion: versionOf(headers) }).pipe(Effect.map(withEtag)),
      unlock: ({ params, headers }) =>
        encounters.setLocked(params.id, false, { expectedVersion: versionOf(headers) }).pipe(Effect.map(withEtag)),
      listRevisions: ({ params }) => encounters.revisions(params.id).pipe(Effect.map((items) => ({ items }))),
      getRevision: ({ params }) => encounters.revision(params.id, params.n),
    })
  }),
)
