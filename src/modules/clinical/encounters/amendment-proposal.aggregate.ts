import { Result } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { AmendmentProposalEmpty, AmendmentProposalNotPending, AmendmentProposalStale } from './amendment-proposal.ts'
import type { AmendmentProposal } from './amendment-proposal.ts'
import { decideAmend } from './encounter.aggregate.ts'
import type { AmendDecision, AmendRejection, CompletionFacts } from './encounter.aggregate.ts'
import { applyChanges } from './encounter-changes.ts'
import type { EncounterChanges, NewIds } from './encounter-changes.ts'
import type { Acknowledgeable } from './encounter-completion.ts'
import { EncounterChangeInvalid, EncounterNotEditable } from './encounter.ts'
import type { Encounter } from './encounter.ts'

/**
 * 정정 제안 애그리거트입니다 (docs/design/domain-model.md, clinical.md 진료). 면허 없는 사용자가 완료한 진료기록의
 * 정정을 요청하고, 의사가 반영하거나 버립니다. 반영은 제안·진료를 한 트랜잭션에 묶는 경계이고, 진료의 정정 판정
 * (`decideAmend`)을 그대로 불러 검증·판 보존이 정정과 같습니다.
 */

/** 제안 쓰기 하나입니다. 새 제안이면 `expectedVersion`이 `null`입니다. */
export interface ProposalWrite {
  proposal: AmendmentProposal
  expectedVersion: number | null
  event: DomainEvent
}

const proposalEvent = (type: string, proposal: AmendmentProposal, context: DecisionContext) =>
  domainEvent(
    type,
    proposal.id,
    context.at,
    { proposalId: proposal.id, encounterId: proposal.encounterId, patientId: proposal.patientId },
    eventContext(context),
  )

/** 제안 입력입니다. */
export interface ProposeCommand {
  reason: string
  changes: EncounterChanges
}

/**
 * 제안을 판정합니다. 완료·정정한 진료가 아니면 409 `ENCOUNTER_NOT_EDITABLE`, 지금 진료에 적용할 수 없으면 422
 * `ENCOUNTER_CHANGE_INVALID`, 바뀌는 것이 없으면 422 `AMENDMENT_PROPOSAL_EMPTY`입니다. 고정한 진료에도 만들 수
 * 있습니다. `amendment_proposal.created`를 냅니다.
 */
export function decidePropose(
  encounter: Encounter,
  input: ProposeCommand,
  proposalId: Id<'amendmentProposal'>,
  ids: NewIds,
  context: DecisionContext,
): Result.Result<ProposalWrite, EncounterNotEditable | EncounterChangeInvalid | AmendmentProposalEmpty> {
  if (encounter.status !== 'COMPLETED' && encounter.status !== 'AMENDED') {
    return Result.fail(new EncounterNotEditable({ currentStatus: encounter.status }))
  }
  // 지금 진료에 적용되는지만 봅니다. 새 상병·처방 라인 ID는 반영할 때 정합니다
  const result = applyChanges(encounter, input.changes, ids)
  if (!result.ok) return Result.fail(new EncounterChangeInvalid({ errors: result.errors }))
  if (result.changed.length === 0) return Result.fail(new AmendmentProposalEmpty({}))
  const proposal: AmendmentProposal = {
    id: proposalId,
    tenantId: context.tenantId,
    encounterId: encounter.id,
    patientId: encounter.patientId,
    changes: input.changes,
    reason: input.reason,
    source: 'USER',
    proposedBy: context.userId,
    proposedAt: context.at,
    baseRevision: encounter.revision,
    status: 'PENDING',
    resolution: null,
    version: 1,
  }
  return Result.succeed({
    proposal,
    expectedVersion: null,
    event: proposalEvent('amendment_proposal.created', proposal, context),
  })
}

/**
 * 반영할 수 있는 제안인지입니다. 대기(`PENDING`) 제안이 아니면 409 `AMENDMENT_PROPOSAL_NOT_PENDING`, 제안 뒤 진료가
 * 정정되어 판이 달라졌으면 409 `AMENDMENT_PROPOSAL_STALE`입니다. 서비스는 처방 권한을 보기 전에 이것부터 봅니다.
 */
export function applicable(
  proposal: AmendmentProposal,
  encounter: Encounter,
): Result.Result<void, AmendmentProposalNotPending | AmendmentProposalStale> {
  if (proposal.status !== 'PENDING')
    return Result.fail(new AmendmentProposalNotPending({ currentStatus: proposal.status }))
  if (encounter.revision !== proposal.baseRevision) {
    return Result.fail(
      new AmendmentProposalStale({ baseRevision: proposal.baseRevision, currentRevision: encounter.revision }),
    )
  }
  return Result.void
}

/** 반영 판정 결과입니다. 정정한 진료와 반영한 제안을 한 트랜잭션에 씁니다. */
export interface ApplyDecision {
  amended: AmendDecision
  applied: ProposalWrite
}

/**
 * 제안의 반영을 판정합니다. `applicable`을 통과하면 제안의 사유·변경으로 정정을 판정하고(`decideAmend`, 진료 버전은
 * 같은 트랜잭션에서 읽은 버전), 제안을 `APPLIED`로 바꿔 정정한 판을 남깁니다. 오류는 `:amend`와 같습니다.
 * `amendment_proposal.applied`를 냅니다.
 */
export function decideApply(
  proposal: AmendmentProposal,
  encounter: Encounter,
  input: { acknowledge?: ReadonlyArray<Acknowledgeable> },
  facts: CompletionFacts,
  ids: NewIds,
  context: DecisionContext,
): Result.Result<ApplyDecision, AmendmentProposalNotPending | AmendmentProposalStale | AmendRejection> {
  const ok = applicable(proposal, encounter)
  if (Result.isFailure(ok)) return Result.fail(ok.failure)
  const amended = decideAmend(
    encounter,
    {
      reason: proposal.reason,
      changes: proposal.changes,
      ...(input.acknowledge === undefined ? {} : { acknowledge: input.acknowledge }),
      expectedVersion: encounter.version,
      proposalId: proposal.id,
    },
    facts,
    ids,
    context,
  )
  if (Result.isFailure(amended)) return Result.fail(amended.failure)
  const applied: AmendmentProposal = {
    ...proposal,
    status: 'APPLIED',
    resolution: { at: context.at, by: context.userId, revision: amended.success.encounter.revision, reason: null },
    version: proposal.version + 1,
  }
  return Result.succeed({
    amended: amended.success,
    applied: {
      proposal: applied,
      expectedVersion: proposal.version,
      event: proposalEvent('amendment_proposal.applied', applied, context),
    },
  })
}

/** 제안을 사유와 함께 버리는 것을 판정합니다. 대기 제안이 아니면 409 `AMENDMENT_PROPOSAL_NOT_PENDING`입니다. */
export function decideDismiss(
  proposal: AmendmentProposal,
  reason: string,
  context: DecisionContext,
): Result.Result<ProposalWrite, AmendmentProposalNotPending> {
  if (proposal.status !== 'PENDING')
    return Result.fail(new AmendmentProposalNotPending({ currentStatus: proposal.status }))
  const dismissed: AmendmentProposal = {
    ...proposal,
    status: 'DISMISSED',
    resolution: { at: context.at, by: context.userId, revision: null, reason },
    version: proposal.version + 1,
  }
  return Result.succeed({
    proposal: dismissed,
    expectedVersion: proposal.version,
    event: proposalEvent('amendment_proposal.dismissed', dismissed, context),
  })
}
