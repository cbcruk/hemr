import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { PatientId, PatientNotFound } from '../../patients/patient.ts'
import {
  Encounter,
  EncounterBilled,
  EncounterChangeInvalid,
  EncounterCompletionRejected,
  EncounterId,
  EncounterLocked,
  EncounterNotEditable,
  EncounterNotFound,
  EncounterRevision,
  EncounterRevisionNotFound,
  EncounterVisitCanceled,
  EncounterWarning,
} from './encounter.ts'
import { PrescriptionLineRefs, EncounterChangesPayload as UpdatePayload } from './encounter-changes-payload.ts'

const headers = {
  'if-match': Schema.String.annotate({
    description: '다른 사람의 변경을 덮어쓰지 않도록 보내는 진료 버전입니다. 필수이고, 빠지면 400입니다. 예: `"7"`',
  }),
}
const etag = {
  etag: Schema.String.annotate({ description: '바뀐 진료의 버전입니다. 다음 요청의 `If-Match`에 씁니다.' }),
}
const withETag = <S extends Schema.Top>(schema: S) => HttpApiSchema.WithHeaders(schema, etag)

const CompletePayload = Schema.Struct({
  nextVisitStatus: Schema.optionalKey(
    Schema.Literals(['WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT']).annotate({
      description:
        '완료한 뒤 내원을 보낼 상태입니다. 없으면 `IN_TREATMENT`(치료실로 보냄)이고, 수납 대기(`AWAITING_PAYMENT`)인 내원은 그대로 둡니다. 내원이 수납까지 끝났거나(`COMPLETED`) 지난 날짜면 옮기지 않습니다. `WAITING`·`AWAITING_PAYMENT`를 골라 내원이 그 상태면 진행 중·타이머 만료 시술을 완료합니다.',
    }),
  ),
  acknowledge: Schema.optionalKey(
    Schema.Array(Schema.Literals(['DUPLICATE_CONSULTATION_FEE']))
      .check(Schema.isMaxLength(10))
      .annotate({ description: '확인하고 넘길 위반입니다. 같은 날 진찰료 중복만 넘길 수 있습니다.' }),
  ),
}).annotate({ description: '진료 완료 본문입니다.' })

const Reason = Schema.NonEmptyString.check(Schema.isMaxLength(500)).annotate({
  description: '사유입니다. 500자까지입니다.',
})

const AmendPayload = Schema.Struct({
  reason: Reason,
  changes: UpdatePayload,
  acknowledge: CompletePayload.fields.acknowledge,
}).annotate({
  description:
    '정정 본문입니다. `changes`는 `PATCH` 본문과 같고, 바뀌는 것이 있으면 새 판을 한 번에 확정합니다. 바뀌는 것이 없으면 진료를 그대로 돌려줍니다.',
})

const lockEndpoint = (name: 'lock' | 'unlock') =>
  HttpApiEndpoint.post(name, `/encounters/:id::${name}`, {
    params: { id: EncounterId },
    headers,
    success: withETag(Encounter),
    error: [EncounterNotFound, EncounterNotEditable, VersionMismatch],
  })
    .annotate(Access, Access.requires('encounter:amend'))
    .annotate(OpenApi.Summary, name === 'lock' ? '진료기록 고정' : '진료기록 고정 풀기')

/**
 * 진료 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 조회는 `encounter:read`, 저장은 면허 권한 `encounter:write`가 필요합니다. 처방 라인을
 * 보내면 `prescription:write`(PRN 라인은 `prescription:write_prn`도)가 더 필요합니다.
 *
 * 완료(`:complete`)도 면허 권한 `encounter:write`이고, 내원을 옮기는 권한(`visit:update`)은 따로 보지 않습니다.
 *
 * 정정(`:amend`)과 고정(`:lock`·`:unlock`)은 면허 권한 `encounter:amend`, 철회(`:retract`)는 `encounter:retract`입니다.
 * 판(`/versions`)은 `encounter:read`로 엽니다.
 *
 * 저장·완료·정정·철회·고정은 `If-Match`가 필수입니다. 여러 진료실 단말이나 한의사가 함께 고칠 때 마지막 저장이 이기지 않게 합니다. 빠지면 400입니다.
 * 활력징후처럼 아직 받지 않는 필드는 조용히 버리지 않고 400으로 알립니다.
 */
export class EncountersApi extends HttpApiGroup.make('encounters')
  .add(
    HttpApiEndpoint.get('get', '/encounters/:id', {
      params: { id: EncounterId },
      success: withETag(Encounter),
      error: EncounterNotFound,
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '진료 조회'),
    HttpApiEndpoint.get('listForPatient', '/patients/:id/encounters', {
      params: { id: PatientId },
      success: Schema.Struct({ items: Schema.Array(Encounter) }).annotate({ description: '환자의 진료 전부입니다.' }),
      error: PatientNotFound,
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '환자의 진료 목록 (최신 진료부터)'),
    HttpApiEndpoint.patch('update', '/encounters/:id', {
      params: { id: EncounterId },
      headers,
      payload: UpdatePayload,
      success: withETag(
        Schema.Struct({
          encounter: Encounter,
          warnings: Schema.Array(EncounterWarning),
          prescriptionLineRefs: PrescriptionLineRefs,
        }).annotate({ description: '저장한 진료와 경고입니다.' }),
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterBilled,
        EncounterVisitCanceled,
        EncounterChangeInvalid,
        VersionMismatch,
        PermissionDenied,
      ],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(OpenApi.Summary, '초안 저장')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('complete', '/encounters/:id::complete', {
      params: { id: EncounterId },
      headers,
      payload: CompletePayload,
      success: withETag(
        Schema.Struct({ encounter: Encounter }).annotate({
          description: '완료한 진료입니다. 내원 이동과 시술 종료는 `encounter.completed`를 받는 정책이 뒤따라 합니다.',
        }),
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterVisitCanceled,
        EncounterCompletionRejected,
        VersionMismatch,
      ],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(OpenApi.Summary, '진료 완료')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('amend', '/encounters/:id::amend', {
      params: { id: EncounterId },
      headers,
      payload: AmendPayload,
      success: withETag(
        Schema.Struct({ encounter: Encounter, prescriptionLineRefs: PrescriptionLineRefs }).annotate({
          description: '정정한 진료입니다.',
        }),
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterLocked,
        EncounterBilled,
        EncounterVisitCanceled,
        EncounterChangeInvalid,
        EncounterCompletionRejected,
        VersionMismatch,
        PermissionDenied,
      ],
    })
      .annotate(Access, Access.requires('encounter:amend'))
      .annotate(OpenApi.Summary, '진료기록 정정')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('retract', '/encounters/:id::retract', {
      params: { id: EncounterId },
      headers,
      payload: Schema.Struct({ reason: Reason }),
      success: withETag(Encounter),
      error: [EncounterNotFound, EncounterNotEditable, EncounterLocked, EncounterBilled, VersionMismatch],
    })
      .annotate(Access, Access.requires('encounter:retract'))
      .annotate(OpenApi.Summary, '진료 철회')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    lockEndpoint('lock'),
    lockEndpoint('unlock'),
    HttpApiEndpoint.get('listRevisions', '/encounters/:id/versions', {
      params: { id: EncounterId },
      success: Schema.Struct({ items: Schema.Array(EncounterRevision) }).annotate({
        description: '진료기록의 판 전부입니다.',
      }),
      error: EncounterNotFound,
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '판 목록 (1판부터, 초안은 빈 목록)'),
    HttpApiEndpoint.get('getRevision', '/encounters/:id/versions/:n', {
      params: {
        id: EncounterId,
        // 변환 Schema는 문서에 인코딩 쪽(문자열)만 나오므로 설명을 그쪽에 답니다
        n: Schema.String.annotate({ description: '판 번호입니다. 1부터입니다.' }).pipe(
          Schema.decodeTo(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
        ),
      },
      success: EncounterRevision,
      error: [EncounterNotFound, EncounterRevisionNotFound],
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '판 조회'),
  )
  .annotate(
    OpenApi.Description,
    '진료 조회, 초안 저장, 완료, 정정·철회·고정, 판 조회입니다. 진료는 접수할 때 빈 초안으로 생깁니다. 초안만 저장(`PATCH`)·완료하고, 완료한 진료는 정정(`:amend`)으로 새 판을 남깁니다. 저장·완료·정정·철회·고정은 `If-Match`가 필수입니다. 받지 않는 필드는 버리지 않고 400입니다. 다른 병원의 진료는 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
