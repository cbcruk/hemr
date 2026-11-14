import { Result } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { retractEncounter } from '../../clinical/encounters/encounter-retraction.ts'
import { decideVoid } from '../receipts/receipt.aggregate.ts'
import type { VoidDecision } from '../receipts/receipt.aggregate.ts'
import { PaymentRefundRequired } from '../receipts/receipt.ts'
import type { Payment, ReceiptRecord } from '../receipts/receipt.ts'
import { validateCheckIn } from './check-in-validation.ts'
import type { AutoInsuranceGuarantee, NhisEligibility as EligibilityInput } from './check-in-validation.types.ts'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitStatus, VisitTransitionErrorCode } from './visit-status.types.ts'
import { CheckInRejected, VisitDatePast, VisitHasClinicalData, VisitTransitionInvalid } from './visit.ts'
import type { NhisEligibility, Visit } from './visit.ts'

/**
 * 내원 애그리거트입니다 (docs/design/domain-model.md). 커맨드 입력, 거부, 판정 함수(`decide…`)를 둡니다.
 *
 * 판정 함수는 순수 함수입니다. 저장소·권한·시계를 모르고, 서비스가 읽어 둔 사실과 시각은 `DecisionContext`·`…Facts`로
 * 받습니다. 결과는 다음 상태와 그 상태를 만든 이벤트이거나 거부입니다. 이벤트 ID만은 `domainEvent`가 새로 만들어
 * 같은 입력에도 다릅니다.
 *
 * 상태 전이표는 현행 규칙을 옮긴 규칙 모듈(`visit-status.ts`)에 그대로 두고 여기서 부릅니다.
 */

/** 판정 결과입니다. `events`는 `visit`과 같은 트랜잭션에 씁니다. */
export interface VisitDecision {
  visit: Visit
  events: DomainEvent[]
}

/** 상태 커맨드를 거부하는 이유입니다. */
export type VisitRejection = VisitTransitionInvalid | VisitHasClinicalData | VisitDatePast

/** 상태 커맨드의 입력입니다. */
export interface VisitStatusInput {
  /** 내원을 다시 열거나 취소한 사유입니다. */
  reason?: string
  /** 취소할 때 진료·수납 기록도 함께 무효로 할지 여부입니다. */
  cascade?: boolean
  /** `:reopen` 다음에 이어서 옮길 상태입니다. 두 전이를 한 번에 저장합니다. */
  then?: 'WAITING' | 'IN_TREATMENT'
}

/** 상태 커맨드를 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface VisitStatusFacts {
  /** 진료 내용이나 유효한 영수증이 있는지입니다. 저장된 `hasClinicalData`보다 넓게 봅니다. */
  hasClinicalData: boolean
}

/** `:reopen {then}`의 목표 상태로 가는 커맨드입니다. */
const THEN_COMMANDS: Record<NonNullable<VisitStatusInput['then']>, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
}

/**
 * 상태 커맨드를 판정합니다. 취소는 진료·영수증까지 보는 `decideCancel`을 씁니다.
 *
 * `:reopen {then}`은 두 전이를 차례로 판정하고, 중간 단계가 거부되면 아무것도 바꾸지 않습니다. 이벤트는 처음 상태에서
 * 마지막 상태로 가는 `visit.status_changed` 하나입니다. 중간 상태는 저장되지 않기 때문입니다.
 */
export function decideVisitStatus(
  visit: Visit,
  command: VisitCommand,
  input: VisitStatusInput,
  facts: VisitStatusFacts,
  context: DecisionContext,
): Result.Result<VisitDecision, VisitRejection> {
  const options = {
    hasClinicalData: facts.hasClinicalData,
    isPastDate: visit.date < context.today,
    ...(input.cascade === undefined ? {} : { cascade: input.cascade }),
  }
  const steps = command === 'REOPEN' && input.then !== undefined ? [command, THEN_COMMANDS[input.then]] : [command]

  let status = visit.status
  for (const step of steps) {
    const result = transitionVisit(status, step, options)
    if (!result.ok) return Result.fail(rejection(result.code, visit, status, step))
    status = result.to
  }

  const { statusReason: _, ...rest } = visit
  const next: Visit = {
    ...rest,
    status,
    statusChangedAt: context.at,
    version: visit.version + 1,
    ...(input.reason === undefined ? {} : { statusReason: input.reason }),
  }
  const event = domainEvent(
    'visit.status_changed',
    visit.id,
    context.at,
    { visitId: visit.id, patientId: visit.patientId, from: visit.status, to: status },
    eventContext(context),
  )
  return Result.succeed({ visit: next, events: [event] })
}

/** 진료 완료 뒤 내원을 보낼 수 있는 상태입니다(clinical.md 완료 커맨드 5). */
export type NextVisitStatus = 'WAITING' | 'IN_TREATMENT' | 'AWAITING_PAYMENT'

/** 내원을 `nextVisitStatus`로 보내는 내원 커맨드입니다. */
const NEXT_VISIT_COMMANDS: Record<NextVisitStatus, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
  AWAITING_PAYMENT: 'SEND_TO_CHECKOUT',
}

/**
 * 진료 완료 뒤 내원 이동을 판정합니다(정책 `moveVisitAfterEncounter`, 결정 M2). `nextVisitStatus`(고르지 않았으면
 * `null`, 그러면 `IN_TREATMENT`)로 가는 진료 흐름 커맨드를 판정합니다. 옮기지 않으면 `null`입니다.
 *
 * 그대로 두는 경우: 이미 그 상태, 수납까지 끝난 내원(`COMPLETED`), 취소한 내원, 지난 날짜의 내원, 고르지 않았는데
 * 데스크가 이미 수납 대기(`AWAITING_PAYMENT`)로 보낸 내원. 걸러 낸 내원은 이 전이를 늘 받으므로, 거부되면 결함입니다.
 */
export function decideVisitAfterEncounter(
  visit: Visit,
  nextVisitStatus: NextVisitStatus | null,
  context: DecisionContext,
): Result.Result<VisitDecision | null> {
  const target = nextVisitStatus ?? 'IN_TREATMENT'
  const stays =
    visit.status === target ||
    visit.status === 'COMPLETED' ||
    visit.status === 'CANCELED' ||
    // 데스크가 이미 수납으로 보낸 내원은 따로 고르지 않으면 치료실로 되돌리지 않습니다
    (visit.status === 'AWAITING_PAYMENT' && nextVisitStatus === null) ||
    visit.date < context.today
  if (stays) return Result.succeed(null)
  // 이 전이들은 진료 내용 사실을 보지 않습니다
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
  return Result.succeed(decided.success)
}

/** 사유 없이 취소한 내원의 사유입니다. 취소에 따른 진료 철회의 사유도 됩니다. */
export const DEFAULT_CANCEL_REASON = 'Visit canceled'

/** 취소를 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface CancelFacts extends VisitStatusFacts {
  /** 내원의 진료입니다. 진료가 없는 내원(마이그레이션 `0007` 전 접수)은 `null`입니다. 연쇄 취소만 씁니다. */
  encounter: Encounter | null
  /** 유효한 영수증과 그 결제입니다. 연쇄 취소일 때만 읽고, 없으면 `null`입니다. */
  activeReceipt: { receipt: ReceiptRecord; payments: ReadonlyArray<Payment> } | null
}

/** 취소 판정 결과입니다. 세 애그리거트를 한 트랜잭션에 씁니다. */
export interface CancelDecision extends VisitDecision {
  /** 연쇄 취소로 철회한 진료입니다. 연쇄가 아니거나 철회할 진료가 없으면 `null`입니다. */
  retracted: { encounter: Encounter; expectedVersion: number; event: DomainEvent } | null
  /** 취소한 영수증과 결제입니다. 연쇄 취소이고 유효한 영수증이 있을 때만 있습니다. */
  voided: VoidDecision | null
}

/**
 * 내원 취소를 판정합니다. 내원·진료·영수증을 한 트랜잭션에 묶는 경계입니다(domain-model.md 묶은 경계, D3).
 *
 * - 연쇄 취소면 유효한 영수증도 취소합니다(`decideVoid`). 밖에서 취소할 결제가 남았으면 내원 상태를 보기 전에 409
 *   `PAYMENT_REFUND_REQUIRED`입니다. 돈 기록이 남은 채 내원만 취소되면 시재가 취소한 내원의 돈을 세기 때문입니다
 * - 연쇄 취소면 진료도 철회합니다. 이미 철회한 진료는 그대로 둡니다. 연쇄가 아닌 취소의 빈 초안은 Clinical의 정책
 *   (`retractCanceledDraft`, M5)이 `visit.status_changed`를 받아 철회합니다
 */
export function decideCancel(
  visit: Visit,
  input: Pick<VisitStatusInput, 'reason' | 'cascade'>,
  facts: CancelFacts,
  context: DecisionContext,
): Result.Result<CancelDecision, VisitRejection | PaymentRefundRequired> {
  const reason = input.reason ?? DEFAULT_CANCEL_REASON

  let voided: CancelDecision['voided'] = null
  if (input.cascade === true && facts.activeReceipt !== null) {
    const { receipt, payments } = facts.activeReceipt
    const decision = decideVoid(receipt, payments, { reason }, context)
    if (Result.isFailure(decision)) {
      // 유효한 영수증만 받으므로 이미 취소한 영수증은 오지 않습니다
      if (decision.failure._tag === 'ReceiptVoided') throw new Error(`receipt ${receipt.id} is already voided`)
      return Result.fail(decision.failure)
    }
    voided = decision.success
  }

  const canceled = decideVisitStatus(visit, 'CANCEL', input, facts, context)
  if (Result.isFailure(canceled)) return Result.fail(canceled.failure)

  const encounter = facts.encounter
  const retracted =
    input.cascade === true && encounter !== null && encounter.status !== 'ENTERED_IN_ERROR'
      ? (() => {
          const result = retractEncounter(encounter, {
            reason,
            at: context.at,
            by: context.userId,
            tenantId: context.tenantId,
          })
          return { encounter: result.encounter, expectedVersion: encounter.version, event: result.event }
        })()
      : null

  return Result.succeed({ ...canceled.success, retracted, voided })
}

/** 접수 커맨드의 입력입니다 (front-desk.md 접수 커맨드). 진료일은 받지 않고 병원 시간대의 오늘로 정합니다. */
export interface CheckInInput {
  /** 엣지가 만든 내원 ID입니다(offline.md). 없으면 서버가 만듭니다. 같은 ID가 이미 있으면 409입니다. */
  id?: Id<'visit'>
  patientId: Id<'patient'>
  coverage: Visit['coverage']
  eligibility?: EligibilityInput | null
  autoInsurance?: AutoInsuranceGuarantee | null
  benefitFlags?: Partial<Visit['benefitFlags']>
  /** 직원이 고른 본인부담여부입니다. */
  copayCode?: string | null
  /** 직원이 고른 선택의료기관 기호입니다. */
  selectedInstitutionCode?: string | null
  /** 이번 접수에서 본인확인을 했는지입니다. */
  identityVerified?: boolean
  /** 접수 뒤 상태입니다. 바로 진료실로 들어가면 `IN_TREATMENT`입니다. */
  initialStatus?: 'WAITING' | 'IN_TREATMENT'
}

/** 접수를 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface CheckInFacts {
  patient: { id: Id<'patient'>; birthDate: string | null; firstVisitDate: string | null }
  /** 취소하지 않은 이전 내원에서 센 첫 내원일과 마지막 본인확인일입니다. */
  history: { firstVisitDate: string | null; lastIdentityVerifiedOn: string | null }
  /** 병원의 요양기관기호입니다. */
  clinicInstitutionCode: string | null
}

/** 접수가 새로 만드는 ID입니다. 서비스가 만들어 넘깁니다. */
export interface CheckInIds {
  visitId: Id<'visit'>
  encounterId: Id<'encounter'>
}

/**
 * 접수를 판정합니다. 접수 검증(`validateCheckIn`)이 막으면 422 `CHECK_IN_REJECTED`로 모든 이유를 돌려줍니다.
 *
 * 바로 진료로 들어가도(`initialStatus: IN_TREATMENT`) 이벤트는 `visit.checked_in` 하나입니다. 빈 초안 진료는 Clinical의
 * 애그리거트라 여기서 만들지 않습니다.
 */
export function decideCheckIn(
  input: CheckInInput,
  facts: CheckInFacts,
  ids: CheckInIds,
  context: DecisionContext,
): Result.Result<VisitDecision & { visit: Visit & { encounterId: Id<'encounter'> } }, CheckInRejected> {
  const date = context.today
  const flags = {
    fullSelfPay: input.benefitFlags?.fullSelfPay ?? false,
    pregnant: input.benefitFlags?.pregnant ?? false,
  }
  const firstVisitDate = facts.patient.firstVisitDate ?? facts.history.firstVisitDate
  // 현행 화면은 고르지 않으면 `없음`을 보냈습니다. 공백·`없음`은 고르지 않은 것으로 저장합니다
  const chosen = input.copayCode?.trim() ?? ''
  const copayCode = chosen === '' || chosen === '없음' ? null : chosen

  const validation = validateCheckIn({
    coverage: input.coverage,
    date,
    fullSelfPay: flags.fullSelfPay,
    eligibility: input.eligibility ?? null,
    clinicInstitutionCode: facts.clinicInstitutionCode,
    chosenCopayCode: copayCode,
    chosenInstitutionCode: input.selectedInstitutionCode ?? null,
    patient: {
      birthDate: facts.patient.birthDate,
      firstVisitDate,
      lastIdentityVerifiedOn: facts.history.lastIdentityVerifiedOn,
      pregnant: flags.pregnant,
    },
    identityVerified: input.identityVerified ?? false,
    autoInsurance: input.autoInsurance ?? null,
  })
  if (validation.errors.length > 0) return Result.fail(new CheckInRejected({ errors: validation.errors }))

  const national = input.coverage === 'NHIS' || input.coverage === 'MEDICAL_AID'
  const visit: Visit & { encounterId: Id<'encounter'> } = {
    id: ids.visitId,
    tenantId: context.tenantId,
    patientId: facts.patient.id,
    date,
    checkedInAt: context.at,
    coverage: input.coverage,
    isFirstVisit: firstVisitDate === null,
    eligibility: {
      status: national ? 'VERIFIED' : 'NOT_REQUIRED',
      // 건보·의료급여가 아니면 자격 결과를 남기지 않습니다. 판정에 쓰지 않은 값이기 때문입니다
      nhis: national ? storedEligibility(input.eligibility) : null,
      identityVerified: input.identityVerified ?? false,
      benefitRestricted: validation.benefitRestricted,
      copayCode: national ? copayCode : null,
      selectedInstitutionCode: national ? validation.selectedInstitutionCode : null,
    },
    benefitFlags: flags,
    encounterId: ids.encounterId,
    status: input.initialStatus ?? 'WAITING',
    statusChangedAt: context.at,
    hasClinicalData: false,
    version: 1,
  }
  const event = domainEvent(
    'visit.checked_in',
    visit.id,
    context.at,
    {
      visitId: visit.id,
      patientId: visit.patientId,
      date,
      coverage: visit.coverage,
      isFirstVisit: visit.isFirstVisit,
      status: visit.status,
    },
    eventContext(context),
  )
  return Result.succeed({ visit, events: [event] })
}

/** 저장할 자격 결과입니다. 빠진 코드는 `null`, 예외 여부는 `false`로 채웁니다. */
function storedEligibility(input: EligibilityInput | null | undefined): NhisEligibility | null {
  if (input === undefined || input === null) return null
  return {
    qualificationCode: input.qualificationCode,
    benefitRestrictionCode: input.benefitRestrictionCode ?? null,
    copayCode: input.copayCode ?? null,
    selectedInstitutionCodes: input.selectedInstitutionCodes,
    identityExempt: input.identityExempt ?? false,
  }
}

function rejection(
  code: VisitTransitionErrorCode,
  visit: Visit,
  currentStatus: VisitStatus,
  command: VisitCommand,
): VisitRejection {
  switch (code) {
    case 'VISIT_TRANSITION_INVALID':
      return new VisitTransitionInvalid({ currentStatus, command })
    case 'VISIT_HAS_CLINICAL_DATA':
      return new VisitHasClinicalData({ currentStatus })
    case 'VISIT_DATE_PAST':
      return new VisitDatePast({ date: visit.date })
  }
}
