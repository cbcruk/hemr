import { Result } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { decideVisitStatus } from '../../front-desk/visits/visit.aggregate.ts'
import type { VisitDecision } from '../../front-desk/visits/visit.aggregate.ts'
import type { VisitCommand } from '../../front-desk/visits/visit-status.types.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import type { PrescriptionLineRef } from '../prescriptions/prescription-line-changes.ts'
import { applyChanges, encounterWarnings } from './encounter-changes.ts'
import type { EncounterChanges, NewIds } from './encounter-changes.ts'
import { judgeCompletion } from './encounter-completion.ts'
import type { Acknowledgeable } from './encounter-completion.ts'
import { retractEncounter } from './encounter-retraction.ts'
import {
  EncounterBilled,
  EncounterChangeInvalid,
  EncounterCompletionRejected,
  EncounterLocked,
  EncounterNotEditable,
  EncounterVisitCanceled,
} from './encounter.ts'
import type { Encounter, EncounterRevision, EncounterWarning } from './encounter.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'

/**
 * 진료 애그리거트입니다 (docs/design/domain-model.md, clinical.md 진료). 초안 저장·완료·정정·철회·고정을 판정합니다.
 * 판정 함수는 순수 함수이고, 서비스가 읽어 둔 진료·내원·영수증과 시각을 받습니다. 새 상병·처방 라인 ID는 서비스가
 * 만드는 함수(`NewIds`)로 받습니다.
 *
 * 진료기록은 다른 사람의 저장을 덮어쓰면 안 되므로, 모든 커맨드가 `expectedVersion`을 먼저 봅니다(412
 * `VERSION_MISMATCH`).
 */

/** 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface EncounterFacts {
  /** 진료의 내원입니다. 내원 없는 진료이거나 내원을 찾지 못하면 `null`입니다. */
  visit: Visit | null
  /** 이 진료를 담은 유효한 영수증입니다. 없으면 `null`입니다. */
  billedBy: Id<'receipt'> | null
}

/** 완료·정정 판정이 더 읽는 사실입니다. */
export interface CompletionFacts extends EncounterFacts {
  /** 같은 환자의 진료입니다. 진찰료 중복 같은 검사에 씁니다. */
  others: ReadonlyArray<Encounter>
}

/** 진료 쓰기 하나입니다. `revision`이 있으면 진료기록 판을 함께 남깁니다. */
export interface EncounterWrite {
  encounter: Encounter
  expectedVersion: number
  event: DomainEvent
  revision: EncounterRevision | null
}

/** 버전과 상태를 확인합니다. `statuses`에 없는 상태는 409 `ENCOUNTER_NOT_EDITABLE`입니다. */
function guard(
  current: Encounter,
  expectedVersion: number,
  statuses: ReadonlyArray<Encounter['status']>,
): Result.Result<void, VersionMismatch | EncounterNotEditable> {
  if (expectedVersion !== current.version) return Result.fail(new VersionMismatch({ currentVersion: current.version }))
  if (!statuses.includes(current.status))
    return Result.fail(new EncounterNotEditable({ currentStatus: current.status }))
  return Result.void
}

/** 처방 라인을 바꾸는 변경인지입니다. 수납한 진료는 처방을 바꿀 수 없습니다. */
export const changesLines = (changes: EncounterChanges) =>
  (changes.prescriptionLines?.upsert?.length ?? 0) > 0 || (changes.prescriptionLines?.remove?.length ?? 0) > 0

const billed = (facts: EncounterFacts) =>
  facts.billedBy === null ? Result.void : Result.fail(new EncounterBilled({ receiptId: facts.billedBy }))

const openVisit = (facts: EncounterFacts) =>
  facts.visit?.status === 'CANCELED' ? Result.fail(new EncounterVisitCanceled({})) : Result.void

/** 진료기록 판 하나입니다. 지금 내용을 그대로 담습니다. */
function revisionOf(
  encounter: Encounter,
  input: Pick<EncounterRevision, 'source' | 'reason' | 'recordedBy' | 'recordedAt'>,
): EncounterRevision {
  return {
    encounterId: encounter.id,
    revision: encounter.revision,
    note: encounter.note,
    diagnoses: encounter.diagnoses,
    prescriptionLines: encounter.prescriptionLines,
    ...input,
  }
}

/** 초안 저장 결과입니다. 바뀐 것이 없으면 `write`가 `null`이고 `encounter`는 지금 진료입니다. */
export interface UpdateDecision {
  encounter: Encounter
  write: EncounterWrite | null
  warnings: ReadonlyArray<EncounterWarning>
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

/**
 * 초안 저장을 판정합니다. 초안이 아니면 409 `ENCOUNTER_NOT_EDITABLE`, 처방을 바꾸는데 수납했으면 409
 * `ENCOUNTER_BILLED`, 내원을 취소했으면 409 `ENCOUNTER_VISIT_CANCELED`, 적용할 수 없으면 422
 * `ENCOUNTER_CHANGE_INVALID`입니다. 완료를 막을 문제는 저장하고 `warnings`로 알립니다. 바뀐 것이 있으면 버전을 올리고
 * `encounter.updated`(바뀐 필드 이름)를 냅니다. 진료의가 비어 있으면 저장한 사용자로 채웁니다.
 */
export function decideUpdate(
  current: Encounter,
  changes: EncounterChanges,
  expectedVersion: number,
  facts: EncounterFacts,
  ids: NewIds,
  context: DecisionContext,
): Result.Result<
  UpdateDecision,
  VersionMismatch | EncounterNotEditable | EncounterBilled | EncounterVisitCanceled | EncounterChangeInvalid
> {
  const guarded = guard(current, expectedVersion, ['DRAFT'])
  if (Result.isFailure(guarded)) return Result.fail(guarded.failure)
  if (changesLines(changes)) {
    const unbilled = billed(facts)
    if (Result.isFailure(unbilled)) return Result.fail(unbilled.failure)
  }
  const open = openVisit(facts)
  if (Result.isFailure(open)) return Result.fail(open.failure)

  const result = applyChanges(current, changes, ids)
  if (!result.ok) return Result.fail(new EncounterChangeInvalid({ errors: result.errors }))
  if (result.changed.length === 0) {
    return Result.succeed({
      encounter: current,
      write: null,
      warnings: encounterWarnings(current),
      prescriptionLineRefs: [],
    })
  }

  const next: Encounter = {
    ...current,
    ...result.content,
    doctorId: current.doctorId ?? context.userId,
    updatedAt: context.at,
    version: current.version + 1,
  }
  const event = domainEvent(
    'encounter.updated',
    next.id,
    context.at,
    { encounterId: next.id, visitId: next.visitId, patientId: next.patientId, changed: result.changed },
    eventContext(context),
  )
  return Result.succeed({
    encounter: next,
    write: { encounter: next, expectedVersion: current.version, event, revision: null },
    warnings: encounterWarnings(next),
    prescriptionLineRefs: result.prescriptionLineRefs,
  })
}

/** 완료한 뒤 내원을 보낼 상태입니다. */
export type NextVisitStatus = 'WAITING' | 'IN_TREATMENT' | 'AWAITING_PAYMENT'

/** 완료 입력입니다. */
export interface CompleteCommand {
  /** 없으면 `IN_TREATMENT`(치료실로 보냄)입니다. */
  nextVisitStatus?: NextVisitStatus
  acknowledge?: ReadonlyArray<Acknowledgeable>
  expectedVersion: number
}

/** 내원을 `nextVisitStatus`로 보내는 내원 커맨드입니다. */
const NEXT_VISIT_COMMANDS: Record<NextVisitStatus, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
  AWAITING_PAYMENT: 'SEND_TO_CHECKOUT',
}

/** 완료 판정 결과입니다. 진료와 (옮길 때) 내원을 한 트랜잭션에 씁니다. */
export interface CompleteDecision {
  write: EncounterWrite
  /** 내원 전이입니다. 옮기지 않으면 `null`입니다. */
  moved: VisitDecision | null
  /** 완료 뒤의 내원입니다. 내원 없는 진료는 `null`입니다. */
  visit: Visit | null
  /** 그 내원의 진행 중·만료 시술을 완료할지입니다(`Procedures.finishRunning`). */
  finishProcedures: boolean
}

/**
 * 초안 진료의 완료를 판정합니다 (clinical.md 완료 커맨드). 진료·내원을 한 트랜잭션에 묶습니다. 버전·상태·취소한
 * 내원은 `decideUpdate`와 같고, 완료 검증(`judgeCompletion`)이 막으면 422 `ENCOUNTER_COMPLETION_REJECTED`로 모든
 * 이유를 돌려줍니다. 통과하면 `COMPLETED`, 1판과 `encounter.completed`입니다. 진료의가 비어 있으면 완료한 사용자로
 * 채웁니다.
 *
 * 내원은 `nextVisitStatus`로 옮깁니다(`visit.status_changed`). 이미 그 상태이거나, 진료가 끝난 상태(`COMPLETED`)이거나,
 * 지난 날짜의 내원이면 그대로 둡니다. `nextVisitStatus`를 고르지 않았으면 수납 대기(`AWAITING_PAYMENT`)인 내원도 그대로
 * 둡니다. 대기·수납을 골랐고 내원이 그 상태가 되었거나 이미 그 상태면 시술을 완료하라고 알립니다.
 */
export function decideComplete(
  current: Encounter,
  input: CompleteCommand,
  facts: Omit<CompletionFacts, 'billedBy'>,
  context: DecisionContext,
): Result.Result<
  CompleteDecision,
  VersionMismatch | EncounterNotEditable | EncounterVisitCanceled | EncounterCompletionRejected
> {
  const guarded = guard(current, input.expectedVersion, ['DRAFT'])
  if (Result.isFailure(guarded)) return Result.fail(guarded.failure)
  if (facts.visit?.status === 'CANCELED') return Result.fail(new EncounterVisitCanceled({}))

  const judgement = judgeCompletion({ encounter: current, others: facts.others, acknowledge: input.acknowledge ?? [] })
  if (judgement.violations.length > 0) {
    return Result.fail(new EncounterCompletionRejected({ violations: judgement.violations }))
  }

  const next: Encounter = {
    ...current,
    doctorId: current.doctorId ?? context.userId,
    status: 'COMPLETED',
    completedAt: context.at,
    revision: 1,
    updatedAt: context.at,
    version: current.version + 1,
  }
  const event = domainEvent(
    'encounter.completed',
    next.id,
    context.at,
    {
      encounterId: next.id,
      visitId: next.visitId,
      patientId: next.patientId,
      doctorId: next.doctorId,
      acknowledged: judgement.acknowledged,
    },
    eventContext(context),
  )
  const write: EncounterWrite = {
    encounter: next,
    expectedVersion: current.version,
    event,
    revision: revisionOf(next, {
      source: 'COMPLETION',
      reason: null,
      recordedBy: context.userId,
      recordedAt: context.at,
    }),
  }

  const target = input.nextVisitStatus ?? 'IN_TREATMENT'
  const { visit } = facts
  const shouldMove =
    visit !== null &&
    visit.status !== target &&
    visit.status !== 'COMPLETED' &&
    // 데스크가 이미 수납으로 보낸 내원은 따로 고르지 않으면 치료실로 되돌리지 않습니다
    !(visit.status === 'AWAITING_PAYMENT' && input.nextVisitStatus === undefined) &&
    visit.date >= context.today
  let moved: VisitDecision | null = null
  if (shouldMove) {
    // 걸러 낸 내원은 이 전이를 늘 받습니다. 어긋나면 결함입니다. 이 전이들은 진료 내용 사실을 보지 않습니다
    const decided = decideVisitStatus(
      visit,
      NEXT_VISIT_COMMANDS[target],
      {},
      { hasClinicalData: visit.hasClinicalData },
      context,
    )
    if (Result.isFailure(decided)) {
      throw new Error(`moving visit ${visit.id} after completion was refused: ${decided.failure._tag}`)
    }
    moved = decided.success
  }
  const after = moved?.visit ?? visit
  return Result.succeed({
    write,
    moved,
    visit: after,
    // 대기·수납으로 보내면 진행 중인 시술을 같은 트랜잭션에서 완료합니다. 데스크가 먼저 그 상태로 보낸 내원도 같습니다
    finishProcedures: after !== null && target !== 'IN_TREATMENT' && after.status === target,
  })
}

/** 정정 입력입니다. */
export interface AmendCommand {
  reason: string
  /** `PATCH`와 같은 형식의 바꿀 내용입니다. */
  changes: EncounterChanges
  acknowledge?: ReadonlyArray<Acknowledgeable>
  expectedVersion: number
  /** 정정 제안을 반영한 정정이면 그 제안입니다. `encounter.amended`에 남깁니다. */
  proposalId?: Id<'amendmentProposal'>
}

/** 정정 판정 결과입니다. 바뀐 것이 없으면 `write`가 `null`이고 `encounter`는 지금 진료입니다. */
export interface AmendDecision {
  encounter: Encounter
  write: EncounterWrite | null
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

export type AmendRejection =
  | VersionMismatch
  | EncounterNotEditable
  | EncounterLocked
  | EncounterVisitCanceled
  | EncounterBilled
  | EncounterChangeInvalid
  | EncounterCompletionRejected

/**
 * 완료·정정한 진료의 정정을 판정합니다 (compliance.md 진료기록 정정). 변경을 적용한 결과가 완료 검증을 통과하면
 * `AMENDED`, 다음 판과 `encounter.amended`입니다. 이전 판은 그대로 남습니다.
 *
 * 완료·정정한 진료가 아니면 409 `ENCOUNTER_NOT_EDITABLE`, 고정했으면 409 `ENCOUNTER_LOCKED`, 내원을 취소했으면 409
 * `ENCOUNTER_VISIT_CANCELED`, 처방을 바꾸는데 수납했으면 409 `ENCOUNTER_BILLED`, 적용할 수 없으면 422
 * `ENCOUNTER_CHANGE_INVALID`, 결과가 완료 검증에 막히면 422 `ENCOUNTER_COMPLETION_REJECTED`입니다.
 */
export function decideAmend(
  current: Encounter,
  input: AmendCommand,
  facts: CompletionFacts,
  ids: NewIds,
  context: DecisionContext,
): Result.Result<AmendDecision, AmendRejection> {
  const guarded = guard(current, input.expectedVersion, ['COMPLETED', 'AMENDED'])
  if (Result.isFailure(guarded)) return Result.fail(guarded.failure)
  if (current.locked) return Result.fail(new EncounterLocked({}))
  const open = openVisit(facts)
  if (Result.isFailure(open)) return Result.fail(open.failure)
  if (changesLines(input.changes)) {
    const unbilled = billed(facts)
    if (Result.isFailure(unbilled)) return Result.fail(unbilled.failure)
  }

  const result = applyChanges(current, input.changes, ids)
  if (!result.ok) return Result.fail(new EncounterChangeInvalid({ errors: result.errors }))
  if (result.changed.length === 0) return Result.succeed({ encounter: current, write: null, prescriptionLineRefs: [] })

  const next: Encounter = {
    ...current,
    ...result.content,
    status: 'AMENDED',
    revision: current.revision + 1,
    updatedAt: context.at,
    version: current.version + 1,
  }
  const judgement = judgeCompletion({ encounter: next, others: facts.others, acknowledge: input.acknowledge ?? [] })
  if (judgement.violations.length > 0) {
    return Result.fail(new EncounterCompletionRejected({ violations: judgement.violations }))
  }
  const event = domainEvent(
    'encounter.amended',
    next.id,
    context.at,
    {
      encounterId: next.id,
      visitId: next.visitId,
      patientId: next.patientId,
      revision: next.revision,
      changed: result.changed,
      reason: input.reason,
      acknowledged: judgement.acknowledged,
      ...(input.proposalId === undefined ? {} : { proposalId: input.proposalId }),
    },
    eventContext(context),
  )
  return Result.succeed({
    encounter: next,
    write: {
      encounter: next,
      expectedVersion: current.version,
      event,
      revision: revisionOf(next, {
        source: 'AMENDMENT',
        reason: input.reason,
        recordedBy: context.userId,
        recordedAt: context.at,
      }),
    },
    prescriptionLineRefs: result.prescriptionLineRefs,
  })
}

/**
 * 철회(`ENTERED_IN_ERROR`)를 판정합니다. 이미 철회했으면 409 `ENCOUNTER_NOT_EDITABLE`, 고정했으면 409
 * `ENCOUNTER_LOCKED`, 유효한 영수증에 들어갔으면 409 `ENCOUNTER_BILLED`입니다. `encounter.retracted`를 냅니다.
 */
export function decideRetract(
  current: Encounter,
  input: { reason: string; expectedVersion: number },
  facts: Pick<EncounterFacts, 'billedBy'>,
  context: DecisionContext,
): Result.Result<EncounterWrite, VersionMismatch | EncounterNotEditable | EncounterLocked | EncounterBilled> {
  const guarded = guard(current, input.expectedVersion, ['DRAFT', 'COMPLETED', 'AMENDED'])
  if (Result.isFailure(guarded)) return Result.fail(guarded.failure)
  if (current.locked) return Result.fail(new EncounterLocked({}))
  if (facts.billedBy !== null) return Result.fail(new EncounterBilled({ receiptId: facts.billedBy }))
  const retracted = retractEncounter(current, {
    reason: input.reason,
    at: context.at,
    by: context.userId,
    tenantId: context.tenantId,
  })
  return Result.succeed({ ...retracted, expectedVersion: current.version, revision: null })
}

/**
 * 완료·정정한 진료의 고정·풀기를 판정합니다. 그 밖의 상태는 409 `ENCOUNTER_NOT_EDITABLE`입니다. 이미 그 상태면
 * `null`이고 버전을 올리지 않습니다. `encounter.locked`·`encounter.unlocked`를 냅니다.
 */
export function decideLock(
  current: Encounter,
  locked: boolean,
  expectedVersion: number,
  context: DecisionContext,
): Result.Result<EncounterWrite | null, VersionMismatch | EncounterNotEditable> {
  const guarded = guard(current, expectedVersion, ['COMPLETED', 'AMENDED'])
  if (Result.isFailure(guarded)) return Result.fail(guarded.failure)
  if (current.locked === locked) return Result.succeed(null)
  const next: Encounter = { ...current, locked, updatedAt: context.at, version: current.version + 1 }
  const event = domainEvent(
    locked ? 'encounter.locked' : 'encounter.unlocked',
    next.id,
    context.at,
    { encounterId: next.id, visitId: next.visitId, patientId: next.patientId },
    eventContext(context),
  )
  return Result.succeed({ encounter: next, expectedVersion: current.version, event, revision: null })
}
