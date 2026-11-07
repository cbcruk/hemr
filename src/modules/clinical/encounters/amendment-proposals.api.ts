import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import {
  AmendmentProposalEmpty,
  AmendmentProposalId,
  AmendmentProposalNotFound,
  AmendmentProposalNotPending,
  AmendmentProposalStale,
  AmendmentProposalStatus,
  AmendmentProposalView,
} from './amendment-proposal.ts'
import { EncounterChangesPayload, PrescriptionLineRefs } from './encounter-changes-payload.ts'
import { EncounterId } from './encounter-id.ts'
import {
  Encounter,
  EncounterBilled,
  EncounterChangeInvalid,
  EncounterCompletionRejected,
  EncounterLocked,
  EncounterNotEditable,
  EncounterNotFound,
  EncounterVisitCanceled,
} from './encounter.ts'

const strict = { errors: 'all', onExcessProperty: 'error' } as const
const Reason = Schema.NonEmptyString.check(Schema.isMaxLength(500)).annotate({
  description: '사유입니다. 500자까지입니다.',
})
const proposalParams = { id: AmendmentProposalId }

/**
 * 정정 제안 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 만들기는 `encounter.amendment_proposal:create`(면허 없음), 보기는
 * `encounter:read`, 반영·버리기는 정정과 같은 면허 권한 `encounter:amend`입니다. 처방 라인을 바꾸는 제안의 반영은
 * 정정처럼 `prescription:write`(PRN은 `prescription:write_prn`도)가 더 필요합니다.
 */
export class AmendmentProposalsApi extends HttpApiGroup.make('amendmentProposals')
  .add(
    HttpApiEndpoint.post('propose', '/encounters/:id/amendment-proposals', {
      params: { id: EncounterId },
      payload: Schema.Struct({ reason: Reason, changes: EncounterChangesPayload }),
      success: AmendmentProposalView.pipe(HttpApiSchema.status(201)),
      error: [EncounterNotFound, EncounterNotEditable, EncounterChangeInvalid, AmendmentProposalEmpty],
    })
      .annotate(Access, Access.requires('encounter.amendment_proposal:create'))
      .annotate(OpenApi.Summary, '정정 제안')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('list', '/encounters/:id/amendment-proposals', {
      params: { id: EncounterId },
      query: { status: Schema.optionalKey(AmendmentProposalStatus) },
      success: Schema.Struct({ items: Schema.Array(AmendmentProposalView) }),
      error: EncounterNotFound,
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '진료의 정정 제안 목록'),
    HttpApiEndpoint.get('get', '/amendment-proposals/:id', {
      params: proposalParams,
      success: AmendmentProposalView,
      error: AmendmentProposalNotFound,
    })
      .annotate(Access, Access.requires('encounter:read'))
      .annotate(OpenApi.Summary, '정정 제안 조회'),
    HttpApiEndpoint.post('apply', '/amendment-proposals/:id::apply', {
      params: proposalParams,
      payload: Schema.Struct({
        acknowledge: Schema.optionalKey(
          Schema.Array(Schema.Literals(['DUPLICATE_CONSULTATION_FEE']))
            .check(Schema.isMaxLength(10))
            .annotate({ description: '확인하고 넘길 위반입니다. 같은 날 진찰료 중복만 넘길 수 있습니다.' }),
        ),
      }),
      success: HttpApiSchema.WithHeaders(
        Schema.Struct({
          proposal: AmendmentProposalView,
          encounter: Encounter,
          prescriptionLineRefs: PrescriptionLineRefs,
        }),
        {
          etag: Schema.String.annotate({
            description: '정정한 진료의 버전입니다. 다음 진료 요청의 `If-Match`에 씁니다.',
          }),
        },
      ),
      error: [
        AmendmentProposalNotFound,
        AmendmentProposalNotPending,
        AmendmentProposalStale,
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
      .annotate(OpenApi.Summary, '정정 제안 반영')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('dismiss', '/amendment-proposals/:id::dismiss', {
      params: proposalParams,
      payload: Schema.Struct({ reason: Reason }),
      success: AmendmentProposalView,
      error: [AmendmentProposalNotFound, AmendmentProposalNotPending],
    })
      .annotate(Access, Access.requires('encounter:amend'))
      .annotate(OpenApi.Summary, '정정 제안 버림')
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .annotate(
    OpenApi.Description,
    '정정 제안입니다. 면허 없는 사용자가 완료한 진료기록의 정정을 제안하고, 의사가 반영(`:apply`)하거나 버립니다(`:dismiss`). 반영은 정정(`:amend`)과 같은 검사를 거치고, 실패하면 제안은 대기로 남습니다. 제안 뒤 진료가 정정되면 낡은 제안(`stale`)이라 반영할 수 없습니다. 다른 병원의 제안은 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
