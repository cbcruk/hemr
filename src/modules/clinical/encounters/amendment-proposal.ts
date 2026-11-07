import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { EncounterChangesPayload } from './encounter-changes-payload.ts'
import { EncounterId } from './encounter-id.ts'

export const AmendmentProposalId = Schema.String.pipe(
  Schema.refine((value): value is Id<'amendmentProposal'> => isId('amendmentProposal', value)),
)

export const AmendmentProposalStatus = Schema.Literals(['PENDING', 'APPLIED', 'DISMISSED'])
export type AmendmentProposalStatus = typeof AmendmentProposalStatus.Type

/**
 * 정정 제안입니다 (clinical.md 진료). 면허 없는 사용자나 시스템이 완료한 진료기록을 바꿔야 할 때 만들고, 의사가
 * `:apply`로 정정(`:amend`)과 같이 반영하거나 `:dismiss`로 버립니다.
 *
 * `baseRevision`은 제안을 만들 때의 진료기록 판입니다. 그 뒤 진료가 정정되면 제안이 낡은 내용 위에 있으므로
 * 반영하지 않습니다.
 */
export const AmendmentProposal = Schema.Struct({
  id: AmendmentProposalId,
  tenantId: TenantId,
  encounterId: EncounterId,
  patientId: PatientId,
  /** `PATCH`·`:amend`와 같은 형식의 바꿀 내용입니다. */
  changes: EncounterChangesPayload,
  reason: Schema.String,
  /** 누가 만들었는지입니다. 지금은 사용자(`USER`)만 있고, 청구 자동수정·보험구분 변경은 그 기능과 함께 더합니다. */
  source: Schema.Literals(['USER']),
  proposedBy: UserId,
  proposedAt: Schema.String,
  baseRevision: Schema.Int,
  status: AmendmentProposalStatus,
  /** 반영하거나 버린 기록입니다. 반영했으면 새 판 번호(`revision`), 버렸으면 사유(`reason`)가 있습니다. */
  resolution: Schema.NullOr(
    Schema.Struct({
      at: Schema.String,
      by: UserId,
      revision: Schema.NullOr(Schema.Int),
      reason: Schema.NullOr(Schema.String),
    }),
  ),
  version: Schema.Int,
})
export type AmendmentProposal = typeof AmendmentProposal.Type

/** 응답의 정정 제안입니다. 진료가 그 뒤 정정되어 반영할 수 없으면 `stale`입니다. */
export const AmendmentProposalView = Schema.Struct({ ...AmendmentProposal.fields, stale: Schema.Boolean })
export type AmendmentProposalView = typeof AmendmentProposalView.Type

export class AmendmentProposalNotFound extends HttpApiError.Problem<AmendmentProposalNotFound>()(
  'AmendmentProposalNotFound',
  { type: problemType('AMENDMENT_PROPOSAL_NOT_FOUND'), status: 404, title: 'Amendment proposal not found' },
  { code: Schema.tag('AMENDMENT_PROPOSAL_NOT_FOUND') },
) {}

/** 이미 반영했거나 버린 제안입니다. */
export class AmendmentProposalNotPending extends HttpApiError.Problem<AmendmentProposalNotPending>()(
  'AmendmentProposalNotPending',
  { type: problemType('AMENDMENT_PROPOSAL_NOT_PENDING'), status: 409, title: 'Amendment proposal is not pending' },
  { code: Schema.tag('AMENDMENT_PROPOSAL_NOT_PENDING'), currentStatus: AmendmentProposalStatus },
) {}

/** 제안을 만든 뒤 진료가 정정되어 제안이 낡은 내용 위에 있습니다. 새로 제안하거나 버립니다. */
export class AmendmentProposalStale extends HttpApiError.Problem<AmendmentProposalStale>()(
  'AmendmentProposalStale',
  {
    type: problemType('AMENDMENT_PROPOSAL_STALE'),
    status: 409,
    title: 'Encounter was amended after the proposal was made',
  },
  { code: Schema.tag('AMENDMENT_PROPOSAL_STALE'), baseRevision: Schema.Int, currentRevision: Schema.Int },
) {}

/** 진료를 바꾸지 않는 제안입니다. */
export class AmendmentProposalEmpty extends HttpApiError.Problem<AmendmentProposalEmpty>()(
  'AmendmentProposalEmpty',
  { type: problemType('AMENDMENT_PROPOSAL_EMPTY'), status: 422, title: 'Amendment proposal changes nothing' },
  { code: Schema.tag('AMENDMENT_PROPOSAL_EMPTY') },
) {}
