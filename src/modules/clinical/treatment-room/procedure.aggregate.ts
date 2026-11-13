import { Result } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import { elapseDueTimers, setProcedureDuration, startProcedures, timerEndsAt } from './procedure-timer.ts'
import type { ProcedureTimer, ProcedureTimerSettings } from './procedure-timer.ts'
import {
  MAX_PROCEDURES_PER_VISIT,
  ProcedureDurationRejected,
  ProcedureLimitExceeded,
  ProcedureOrderInvalid,
  ProcedureTransitionInvalid,
  ProcedureVisitClosed,
} from './procedure.ts'
import type { Procedure } from './procedure.ts'

/**
 * 시술 애그리거트입니다 (docs/design/domain-model.md, clinical.md 치료실). 시술 커맨드와 서버 타이머의 만료를
 * 판정합니다. 타이머 계산은 규칙 모듈(`procedure-timer.ts`)이 하고, 여기서는 상태·내원 조건을 보고 바뀐 시술과
 * 이벤트를 만듭니다. 판정 함수는 순수 함수이고, 서비스가 읽어 둔 시술·내원과 시각을 받습니다.
 *
 * 시작·완료처럼 같은 내원의 다른 시술을 함께 바꾸는 커맨드가 있어, 판정은 내원의 시술 목록을 받습니다. 내원 단위
 * 애그리거트(치료 세션)로 묶는 일은 M4(#70)에서 합니다.
 */

/** 판정 시각과 이벤트를 남길 행위자입니다. 서버 타이머는 `SYSTEM`입니다. */
export interface ProcedureContext {
  at: string
  event: Required<Pick<DomainEvent, 'tenantId' | 'actor'>>
}

/** 바뀐 시술과 그 쓰기·이벤트입니다. 한 트랜잭션에 씁니다. 바뀐 것이 없으면 모두 비어 있습니다. */
export interface ProcedureChanges {
  changed: ReadonlyArray<Procedure>
  writes: ReadonlyArray<{ procedure: Procedure; expectedVersion: number | null }>
  events: ReadonlyArray<DomainEvent>
}

const NO_CHANGES: ProcedureChanges = { changed: [], writes: [], events: [] }

const procedureEvent = (type: string, procedure: Procedure, context: ProcedureContext) =>
  domainEvent(
    type,
    procedure.id,
    context.at,
    { procedureId: procedure.id, visitId: procedure.visitId, patientId: procedure.patientId, status: procedure.status },
    context.event,
  )

/** 바꾼 시술을 새 버전으로 쓰고 시술마다 `procedure.updated`를 냅니다. `expectedVersion`은 읽은 버전입니다. */
function updates(changed: ReadonlyArray<Procedure>, current: ReadonlyArray<Procedure>, context: ProcedureContext) {
  const versions = new Map(current.map((each) => [each.id, each.version]))
  return {
    changed,
    writes: changed.map((procedure) => ({ procedure, expectedVersion: versions.get(procedure.id) ?? null })),
    events: changed.map((each) => procedureEvent('procedure.updated', each, context)),
  }
}

const timerOf = (procedure: Procedure): ProcedureTimer => ({
  procedureId: procedure.id,
  status: procedure.status,
  durationSeconds: procedure.durationSeconds,
  startedAt: procedure.startedAt,
  timerEndsAt: procedure.timerEndsAt,
  completedAt: procedure.completedAt,
})

/** 타이머 판정 결과(`timers`)가 바꾼 시술만 새 버전으로 씁니다. */
function applyTimers(
  current: ReadonlyArray<Procedure>,
  timers: ReadonlyArray<ProcedureTimer>,
  context: ProcedureContext,
): ProcedureChanges {
  const byId = new Map(timers.map((each) => [each.procedureId, each]))
  const changed: Procedure[] = []
  for (const procedure of current) {
    const timer = byId.get(procedure.id)
    if (timer === undefined || JSON.stringify(timerOf(procedure)) === JSON.stringify(timer)) continue
    const { procedureId: _, ...fields } = timer
    changed.push({ ...procedure, ...fields, updatedAt: context.at, version: procedure.version + 1 })
  }
  return updates(changed, current, context)
}

/** 시술을 진행할 수 있는 내원인지입니다. 취소했거나 수납까지 끝난 내원은 닫혔습니다(409 `PROCEDURE_VISIT_CLOSED`). */
function open(visit: Visit): Result.Result<void, ProcedureVisitClosed> {
  return visit.status === 'CANCELED' || visit.status === 'COMPLETED'
    ? Result.fail(new ProcedureVisitClosed({}))
    : Result.void
}

const invalid = (procedure: Pick<Procedure, 'status'>) =>
  Result.fail(new ProcedureTransitionInvalid({ currentStatus: procedure.status }))

/** 더할 시술입니다. */
export interface AddProcedureCommand {
  name: string
  /** 없으면 설정의 기본 시간(`defaultItemSeconds`)입니다. */
  durationSeconds?: number
  /** 없으면 `STAFF`입니다. */
  assignee?: Procedure['assignee']
  sourcePrescriptionLineId?: Id<'prescriptionLine'>
}

/**
 * 시술 더하기를 판정합니다. 닫힌 내원은 409 `PROCEDURE_VISIT_CLOSED`, 시술이 이미 `MAX_PROCEDURES_PER_VISIT`개면 422
 * `PROCEDURE_LIMIT_EXCEEDED`입니다. 대기 시술을 맨 뒤에 더하고 `procedure.created`를 냅니다.
 */
export function decideAdd(
  visit: Visit,
  existing: ReadonlyArray<Procedure>,
  input: AddProcedureCommand,
  procedureId: Id<'procedure'>,
  settings: Pick<ProcedureTimerSettings, 'defaultItemSeconds'>,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed | ProcedureLimitExceeded> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  if (existing.length >= MAX_PROCEDURES_PER_VISIT) return Result.fail(new ProcedureLimitExceeded({}))
  const procedure: Procedure = {
    id: procedureId,
    tenantId: visit.tenantId,
    visitId: visit.id,
    patientId: visit.patientId,
    name: input.name,
    sourcePrescriptionLineId: input.sourcePrescriptionLineId ?? null,
    order: existing.reduce((last, each) => Math.max(last, each.order + 1), 0),
    assignee: input.assignee ?? 'STAFF',
    durationSeconds: input.durationSeconds ?? settings.defaultItemSeconds,
    status: 'PENDING',
    startedAt: null,
    timerEndsAt: null,
    completedAt: null,
    createdAt: context.at,
    updatedAt: context.at,
    version: 1,
  }
  return Result.succeed({
    changed: [procedure],
    writes: [{ procedure, expectedVersion: null }],
    events: [procedureEvent('procedure.created', procedure, context)],
  })
}

/**
 * 시술 시간 바꾸기를 판정합니다(`setProcedureDuration`). 닫힌 내원은 409, 완료한 시술은 다른 상태 커맨드처럼 409
 * `PROCEDURE_TRANSITION_INVALID`(rule-decisions.md `PROCEDURE_ALREADY_DONE`), 진행 중인데 이미 지난 시간보다 1초 이상
 * 길지 않으면 422 `PROCEDURE_DURATION_REJECTED`입니다. 정수·하한은 엔드포인트 스키마가 먼저 막으므로 여기서 걸리면
 * 결함입니다.
 */
export function decideSetDuration(
  procedure: Procedure,
  visit: Visit,
  durationSeconds: number,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed | ProcedureTransitionInvalid | ProcedureDurationRejected> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  const result = setProcedureDuration(timerOf(procedure), durationSeconds, Date.parse(context.at))
  if (!result.ok) {
    if (result.error === 'PROCEDURE_DURATION_INVALID') throw new Error(`invalid duration ${durationSeconds}`)
    if (result.error === 'PROCEDURE_ALREADY_DONE') return invalid(procedure)
    return Result.fail(new ProcedureDurationRejected({ reason: result.error }))
  }
  return Result.succeed(applyTimers([procedure], [result.procedure], context))
}

/** 시술 지우기를 판정합니다. 대기 시술만 지우고, 그 밖의 상태는 409입니다. `procedure.removed`를 냅니다. */
export function decideRemove(
  procedure: Procedure,
  context: ProcedureContext,
): Result.Result<DomainEvent, ProcedureTransitionInvalid> {
  if (procedure.status !== 'PENDING') return invalid(procedure)
  return Result.succeed(
    domainEvent(
      'procedure.removed',
      procedure.id,
      context.at,
      { procedureId: procedure.id, visitId: procedure.visitId, patientId: procedure.patientId },
      context.event,
    ),
  )
}

/**
 * 시술 하나의 시작을 판정합니다(`startProcedures`). 닫힌 내원은 409입니다. 대기·만료·완료 시술을 시작하고, 정책에
 * 따라 같은 내원의 만료 시술을 함께 완료합니다. 이미 진행 중이면 409입니다. `current`는 내원의 시술입니다.
 */
export function decideStart(
  procedure: Procedure,
  visit: Visit,
  current: ReadonlyArray<Procedure>,
  settings: Pick<ProcedureTimerSettings, 'autoCompleteElapsedOnNextStart'>,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed | ProcedureTransitionInvalid> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  const result = startProcedures(current.map(timerOf), [procedure.id], Date.parse(context.at), settings)
  if (!result.changed) return invalid({ status: 'RUNNING' })
  return Result.succeed(applyTimers(current, result.procedures, context))
}

/** 내원의 완료하지 않은 시술을 모두 시작합니다. 닫힌 내원은 409입니다. 시작할 것이 없으면 바뀐 것이 없습니다. */
export function decideStartAll(
  visit: Visit,
  current: ReadonlyArray<Procedure>,
  settings: Pick<ProcedureTimerSettings, 'autoCompleteElapsedOnNextStart'>,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  const targets = current.filter((each) => each.status !== 'DONE').map((each) => each.id)
  if (targets.length === 0) return Result.succeed(NO_CHANGES)
  const result = startProcedures(current.map(timerOf), targets, Date.parse(context.at), settings)
  return Result.succeed(result.changed ? applyTimers(current, result.procedures, context) : NO_CHANGES)
}

/** 진행 중·만료 시술 중 `targets`를 완료로 바꿉니다. 판정 전에 서버 시계로 만료를 다시 봅니다. */
function finish(current: ReadonlyArray<Procedure>, targets: ReadonlySet<string>, context: ProcedureContext) {
  const timers = elapseDueTimers(current.map(timerOf), Date.parse(context.at)).procedures.map(
    (timer): ProcedureTimer =>
      targets.has(timer.procedureId) && (timer.status === 'RUNNING' || timer.status === 'TIMER_ELAPSED')
        ? { ...timer, status: 'DONE', completedAt: context.at }
        : timer,
  )
  return applyTimers(current, timers, context)
}

/** 시술 하나의 완료를 판정합니다. 진행 중이거나 만료한 시술만 완료하고, 그 밖의 상태는 409입니다. */
export function decideComplete(
  procedure: Procedure,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureTransitionInvalid> {
  if (procedure.status !== 'RUNNING' && procedure.status !== 'TIMER_ELAPSED') return invalid(procedure)
  return Result.succeed(finish([procedure], new Set([procedure.id]), context))
}

/**
 * 내원의 진행 중·만료 시술을 모두 완료합니다. 대기 시술은 그대로 둡니다. `:complete-all`과, 진료 완료가 내원을
 * 대기·수납으로 보낼 때(clinical.md 완료 커맨드 5) 씁니다. 거부하지 않습니다.
 */
export function decideFinishRunning(current: ReadonlyArray<Procedure>, context: ProcedureContext): ProcedureChanges {
  return finish(current, new Set(current.map((each) => each.id)), context)
}

/** 타이머 다시 재기를 판정합니다. 닫힌 내원은 409, 진행 중·만료가 아니면 409입니다. 지금부터 다시 잽니다. */
export function decideRestartTimer(
  procedure: Procedure,
  visit: Visit,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed | ProcedureTransitionInvalid> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  if (procedure.status !== 'RUNNING' && procedure.status !== 'TIMER_ELAPSED') return invalid(procedure)
  const timer: ProcedureTimer = {
    ...timerOf(procedure),
    status: 'RUNNING',
    startedAt: context.at,
    timerEndsAt: timerEndsAt(context.at, procedure.durationSeconds),
  }
  return Result.succeed(applyTimers([procedure], [timer], context))
}

/** 완료한 시술을 대기로 되돌리는 것을 판정합니다. 닫힌 내원은 409, 완료가 아니면 409입니다. */
export function decideReopen(
  procedure: Procedure,
  visit: Visit,
  context: ProcedureContext,
): Result.Result<ProcedureChanges, ProcedureVisitClosed | ProcedureTransitionInvalid> {
  const opened = open(visit)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  if (procedure.status !== 'DONE') return invalid(procedure)
  const timer: ProcedureTimer = {
    ...timerOf(procedure),
    status: 'PENDING',
    startedAt: null,
    timerEndsAt: null,
    completedAt: null,
  }
  return Result.succeed(applyTimers([procedure], [timer], context))
}

/**
 * 순서 바꾸기를 판정합니다. 내원의 시술을 모두 한 번씩 보내야 하고, 아니면 422 `PROCEDURE_ORDER_INVALID`입니다.
 * `ordered`는 바꾼 뒤 `order` 순서의 전체 목록입니다.
 */
export function decideReorder(
  current: ReadonlyArray<Procedure>,
  ids: ReadonlyArray<Id<'procedure'>>,
  context: ProcedureContext,
): Result.Result<ProcedureChanges & { ordered: ReadonlyArray<Procedure> }, ProcedureOrderInvalid> {
  const known = new Set<string>(current.map((each) => each.id))
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return Result.fail(new ProcedureOrderInvalid({}))
  }
  const position = new Map<string, number>(ids.map((id, index) => [id, index]))
  const changed = current
    .filter((each) => each.order !== position.get(each.id))
    .map((each) => ({
      ...each,
      order: position.get(each.id) ?? each.order,
      updatedAt: context.at,
      version: each.version + 1,
    }))
  const byId = new Map(changed.map((each) => [each.id, each]))
  return Result.succeed({
    ...updates(changed, current, context),
    ordered: current.map((each) => byId.get(each.id) ?? each).sort((a, b) => a.order - b.order),
  })
}

/** 서버 타이머가 시술 하나의 만료를 판정합니다. 아직 끝나지 않았으면 `null`입니다. */
export function decideElapse(procedure: Procedure, context: ProcedureContext): ProcedureChanges | null {
  const [timer] = elapseDueTimers([timerOf(procedure)], Date.parse(context.at)).procedures
  if (timer?.status !== 'TIMER_ELAPSED') return null
  return applyTimers([procedure], [timer], context)
}
