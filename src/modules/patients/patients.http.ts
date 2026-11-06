import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../api.ts'
import { expectedVersion, withEtag } from '../../shared/http/etag.ts'
import { ValidationFailed } from '../../shared/problem/problem.ts'
import { Patients } from './patients.ts'

/** 퍼센트 인코딩한 사유를 풉니다. 풀고 나서 비어 있거나 200자를 넘으면 받지 않습니다. */
function accessReason(header: string): Effect.Effect<string, ValidationFailed> {
  let reason: string | undefined
  try {
    reason = decodeURIComponent(header).trim()
  } catch {
    reason = undefined
  }
  return reason === undefined || reason === '' || [...reason].length > 200
    ? Effect.fail(new ValidationFailed({ violations: [{ field: 'x-access-reason', code: 'INVALID_VALUE' }] }))
    : Effect.succeed(reason)
}

/** 환자 핸들러입니다. */
export const PatientsHttpLive = HttpApiBuilder.group(
  Api,
  'patients',
  Effect.fn(function* (handlers) {
    const patients = yield* Patients

    return handlers.handleAll({
      search: ({ query }) => patients.search({ ...query, limit: query.limit ?? 50 }),
      register: ({ payload }) => patients.register(payload).pipe(Effect.map(withEtag)),
      nextChartNumber: () => patients.nextChartNumber(),
      get: ({ params }) => patients.get(params.id).pipe(Effect.map(withEtag)),
      update: ({ params, headers, payload }) =>
        patients.update(params.id, payload, expectedVersion(headers['if-match'])).pipe(Effect.map(withEtag)),
      revealRrn: ({ params, headers }) =>
        accessReason(headers['x-access-reason']).pipe(
          Effect.flatMap((reason) => patients.revealRrn(params.id, reason)),
        ),
      consents: ({ params }) => patients.get(params.id).pipe(Effect.map((patient) => patient.consents)),
      consentHistory: ({ params }) => patients.consentHistory(params.id),
      recordConsent: ({ params, payload }) => patients.recordConsent(params.id, payload),
    })
  }),
)
