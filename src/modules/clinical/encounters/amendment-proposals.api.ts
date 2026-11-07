import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
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
const Reason = Schema.NonEmptyString.check(Schema.isMaxLength(500))
const proposalParams = { id: AmendmentProposalId }

/**
 * 정정 제안입니다 (clinical.md 진료). 만들기는 `encounter.amendment_proposal:create`(면허 없음), 보기는
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
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('list', '/encounters/:id/amendment-proposals', {
      params: { id: EncounterId },
      query: { status: Schema.optionalKey(AmendmentProposalStatus) },
      success: Schema.Struct({ items: Schema.Array(AmendmentProposalView) }),
      error: EncounterNotFound,
    }).annotate(Access, Access.requires('encounter:read')),
    HttpApiEndpoint.get('get', '/amendment-proposals/:id', {
      params: proposalParams,
      success: AmendmentProposalView,
      error: AmendmentProposalNotFound,
    }).annotate(Access, Access.requires('encounter:read')),
    HttpApiEndpoint.post('apply', '/amendment-proposals/:id::apply', {
      params: proposalParams,
      payload: Schema.Struct({
        acknowledge: Schema.optionalKey(
          Schema.Array(Schema.Literals(['DUPLICATE_CONSULTATION_FEE'])).check(Schema.isMaxLength(10)),
        ),
      }),
      success: HttpApiSchema.WithHeaders(
        Schema.Struct({
          proposal: AmendmentProposalView,
          encounter: Encounter,
          prescriptionLineRefs: PrescriptionLineRefs,
        }),
        { etag: Schema.String },
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
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('dismiss', '/amendment-proposals/:id::dismiss', {
      params: proposalParams,
      payload: Schema.Struct({ reason: Reason }),
      success: AmendmentProposalView,
      error: [AmendmentProposalNotFound, AmendmentProposalNotPending],
    })
      .annotate(Access, Access.requires('encounter:amend'))
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .middleware(Authorization) {}
