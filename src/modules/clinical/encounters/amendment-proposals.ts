import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { decisionContext } from '../../../shared/events/domain-event.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ReceiptRepository } from '../../front-desk/receipts/receipt-repository.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import {
  type AmendmentProposal,
  type AmendmentProposalEmpty,
  AmendmentProposalNotFound,
  type AmendmentProposalNotPending,
  type AmendmentProposalStale,
  type AmendmentProposalView,
} from './amendment-proposal.ts'
import { applicable, decideApply, decideDismiss, decidePropose } from './amendment-proposal.aggregate.ts'
import type { ProposalWrite, ProposeCommand } from './amendment-proposal.aggregate.ts'
import { AmendmentProposalRepository } from './amendment-proposal-repository.ts'
import type { Acknowledgeable } from './encounter-completion.ts'
import { encounterFacts, requirePrescriptionPermissions } from './encounter-facts.ts'
import { EncounterRepository } from './encounter-repository.ts'
import type { Encounter, EncounterChangeInvalid, EncounterNotEditable, EncounterNotFound } from './encounter.ts'
import type { PrescriptionLineRef } from '../prescriptions/prescription-line-changes.ts'
import { type AmendEncounterError, NEW_IDS } from './encounters.ts'

export type ProposeInput = ProposeCommand

export type ProposeError = EncounterNotFound | EncounterNotEditable | EncounterChangeInvalid | AmendmentProposalEmpty
export type ApplyError =
  AmendmentProposalNotFound | AmendmentProposalNotPending | AmendmentProposalStale | AmendEncounterError

/** 반영한 제안과 정정한 진료, 제안의 `clientRef`와 새 처방 라인 ID의 대응입니다. */
export interface AppliedProposal {
  proposal: AmendmentProposalView
  encounter: Encounter
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

/**
 * 정정 제안입니다 (clinical.md 진료). 면허 없는 사용자가 완료한 진료기록의 정정을 요청하고, 의사가 반영하거나
 * 버립니다. 반영은 정정 판정(`decideAmend`)을 그대로 불러(`decideApply`) 검증·판 보존·권한이 정정과 같습니다.
 */
export class AmendmentProposals extends Context.Service<
  AmendmentProposals,
  {
    /**
     * 완료·정정한 진료에 제안을 만듭니다. 그 밖의 상태는 409 `ENCOUNTER_NOT_EDITABLE`입니다. 지금 진료에 적용할 수
     * 없는 변경은 422 `ENCOUNTER_CHANGE_INVALID`, 바뀌는 것이 없으면 422 `AMENDMENT_PROPOSAL_EMPTY`입니다. 고정한
     * 진료에도 만들 수 있습니다. 반영하려면 의사가 먼저 고정을 풉니다.
     */
    propose(
      encounterId: Id<'encounter'>,
      input: ProposeInput,
    ): Effect.Effect<AmendmentProposalView, ProposeError, CurrentAccess>
    /** 진료의 제안입니다. 만든 순서입니다. */
    list(
      encounterId: Id<'encounter'>,
      status?: AmendmentProposal['status'],
    ): Effect.Effect<ReadonlyArray<AmendmentProposalView>, EncounterNotFound, CurrentAccess>
    get(id: Id<'amendmentProposal'>): Effect.Effect<AmendmentProposalView, AmendmentProposalNotFound, CurrentAccess>
    /**
     * 제안을 정정으로 반영합니다. 대기(`PENDING`) 제안이 아니면 409 `AMENDMENT_PROPOSAL_NOT_PENDING`, 제안 뒤 진료가
     * 정정되었으면 409 `AMENDMENT_PROPOSAL_STALE`입니다. 그 밖의 오류는 `:amend`와 같습니다(고정 409, 완료 검증 422
     * 등). 진료 버전은 같은 트랜잭션에서 읽은 버전입니다.
     */
    apply(
      id: Id<'amendmentProposal'>,
      input: { acknowledge?: ReadonlyArray<Acknowledgeable> },
    ): Effect.Effect<AppliedProposal, ApplyError, CurrentAccess>
    /** 제안을 사유와 함께 버립니다. 대기 제안이 아니면 409 `AMENDMENT_PROPOSAL_NOT_PENDING`입니다. */
    dismiss(
      id: Id<'amendmentProposal'>,
      reason: string,
    ): Effect.Effect<AmendmentProposalView, AmendmentProposalNotFound | AmendmentProposalNotPending, CurrentAccess>
  }
>()('hemr/clinical/AmendmentProposals') {
  static readonly layer = Layer.effect(
    AmendmentProposals,
    Effect.gen(function* () {
      const repository = yield* AmendmentProposalRepository
      const encounters = yield* EncounterRepository
      const transaction = yield* Transaction
      const facts = encounterFacts({
        encounters,
        visits: yield* VisitRepository,
        receipts: yield* ReceiptRepository,
      })

      const findProposal = (tenantId: Id<'tenant'>, id: Id<'amendmentProposal'>) =>
        repository
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new AmendmentProposalNotFound({})), onSome: Effect.succeed }),
            ),
          )

      /** 대기 제안의 진료가 제안 뒤 정정되어 판이 달라졌으면 낡은 제안입니다. */
      const viewOf = (proposal: AmendmentProposal, encounter: Encounter | undefined): AmendmentProposalView => ({
        ...proposal,
        stale: proposal.status === 'PENDING' && encounter?.revision !== proposal.baseRevision,
      })

      const save = (decided: ProposalWrite) =>
        repository.save(decided.proposal, { expectedVersion: decided.expectedVersion, events: [decided.event] })

      const propose = Effect.fn('AmendmentProposals.propose')(function* (
        encounterId: Id<'encounter'>,
        input: ProposeInput,
      ) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const encounter = yield* facts.find(access.tenantId, encounterId)
            const decided = yield* Effect.fromResult(
              decidePropose(encounter, input, newId('amendmentProposal'), NEW_IDS, context),
            )
            yield* save(decided)
            return viewOf(decided.proposal, encounter)
          }),
        )
      })

      const list = Effect.fn('AmendmentProposals.list')(function* (
        encounterId: Id<'encounter'>,
        status?: AmendmentProposal['status'],
      ) {
        const access = yield* CurrentAccess
        const encounter = yield* facts.find(access.tenantId, encounterId)
        const proposals = yield* repository.listByEncounter(access.tenantId, encounterId, status)
        return proposals.map((each) => viewOf(each, encounter))
      })

      const get = Effect.fn('AmendmentProposals.get')(function* (id: Id<'amendmentProposal'>) {
        const access = yield* CurrentAccess
        const proposal = yield* findProposal(access.tenantId, id)
        return viewOf(
          proposal,
          Option.getOrUndefined(yield* encounters.findById(access.tenantId, proposal.encounterId)),
        )
      })

      const apply = Effect.fn('AmendmentProposals.apply')(function* (
        id: Id<'amendmentProposal'>,
        input: { acknowledge?: ReadonlyArray<Acknowledgeable> },
      ) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const proposal = yield* findProposal(access.tenantId, id)
            const current = yield* facts.find(access.tenantId, proposal.encounterId)
            // 반영할 수 없는 제안(대기 아님·낡음)은 처방 권한보다 먼저 거부합니다
            yield* Effect.fromResult(applicable(proposal, current))
            yield* requirePrescriptionPermissions(proposal.changes)
            const known = {
              visit: yield* facts.visitOf(current),
              billedBy: yield* facts.billedBy(current),
              others: yield* facts.othersOf(current),
            }
            const decided = yield* Effect.fromResult(decideApply(proposal, current, input, known, NEW_IDS, context))
            // 정정이 업무 규칙으로 실패할 수 있으므로 판정을 마친 뒤 진료, 제안 순서로 씁니다. SQL에서는 한 트랜잭션이라
            // 함께 되돌립니다. 메모리 저장소는 반영·버림이 겹치면 정정만 남고 제안 쓰기가 결함으로 끝날 수 있습니다
            const { amended, applied } = decided
            if (amended.write !== null) yield* facts.write(amended.write)
            yield* save(applied)
            return {
              proposal: viewOf(applied.proposal, amended.encounter),
              encounter: amended.encounter,
              prescriptionLineRefs: amended.prescriptionLineRefs,
            }
          }),
        )
      })

      const dismiss = Effect.fn('AmendmentProposals.dismiss')(function* (id: Id<'amendmentProposal'>, reason: string) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const proposal = yield* findProposal(access.tenantId, id)
            const decided = yield* Effect.fromResult(decideDismiss(proposal, reason, context))
            yield* save(decided)
            return viewOf(decided.proposal, undefined)
          }),
        )
      })

      return AmendmentProposals.of({ propose, list, get, apply, dismiss })
    }),
  )
}
