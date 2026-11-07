import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { draftEncounter, hasClinicalContent } from '../../clinical/encounters/encounter-draft.ts'
import { retractEncounter } from '../../clinical/encounters/encounter-retraction.ts'
import { CurrentAccess, requirePermissions } from '../../identity/auth/access.ts'
import type { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { IdentityRepository } from '../../identity/identity-repository.ts'
import type { PatientNotFound } from '../../patients/patient.ts'
import { Patients } from '../../patients/patients.ts'
import { voidReceipt } from '../receipts/receipt-adjustments.ts'
import { ReceiptRepository } from '../receipts/receipt-repository.ts'
import { PaymentRefundRequired, recordOf } from '../receipts/receipt.ts'
import { validateCheckIn } from './check-in-validation.ts'
import type { AutoInsuranceGuarantee, NhisEligibility as EligibilityInput } from './check-in-validation.types.ts'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitStatus, VisitTransitionErrorCode } from './visit-status.types.ts'
import {
  CheckInRejected,
  VisitAlreadyExists,
  VisitDatePast,
  VisitHasClinicalData,
  VisitNotFound,
  VisitTransitionInvalid,
} from './visit.ts'
import type { NhisEligibility, Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'
import type { VisitListQuery } from './visit-repository.ts'

/**
 * 접수 요청입니다 (front-desk.md 접수 커맨드). 진료일은 받지 않고 병원 시간대의 오늘로 서버가 정합니다.
 *
 * 자격 조회·자보 지급보증은 그 모듈이 생기기 전까지 조회 ID(`eligibilityLookupId`·`autoInsuranceCaseId`) 대신 결과를
 * 본문으로 받습니다.
 */
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

/** 접수가 실패할 수 있는 오류입니다. */
export type CheckInError = PatientNotFound | CheckInRejected | VisitAlreadyExists | PermissionDenied

/** 상태 커맨드에 커맨드 외로 함께 보내는 입력입니다. */
export interface VisitCommandInput {
  /** 내원을 다시 열거나 취소한 사유입니다. */
  reason?: string
  /** 취소할 때 진료·수납 기록도 함께 무효로 할지 여부입니다. */
  cascade?: boolean
  /** `:reopen` 다음에 이어서 옮길 상태입니다. 두 전이를 한 번에 저장합니다. */
  then?: 'WAITING' | 'IN_TREATMENT'
  /** `If-Match`로 받은 버전입니다. 없으면 버전을 검사하지 않습니다. */
  expectedVersion?: number
}

/** 상태 커맨드가 실패할 수 있는 오류입니다. */
export type VisitCommandError =
  | VisitNotFound
  | VisitTransitionInvalid
  | VisitHasClinicalData
  | PaymentRefundRequired
  | VisitDatePast
  | VersionMismatch
  | PermissionDenied

/** `:reopen {then}`의 목표 상태로 가는 커맨드입니다. */
const THEN_COMMANDS: Record<NonNullable<VisitCommandInput['then']>, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
}

/** 접수 데스크의 내원 작업입니다. */
export class Visits extends Context.Service<
  Visits,
  {
    /**
     * 내원에 상태 커맨드를 적용하고 새 상태를 저장합니다. 저장할 때마다 `version`이 1 오릅니다. 같은 트랜잭션에서
     * `visit.status_changed` 이벤트를 outbox에 씁니다. `:reopen {then}`은 두 전이를 이벤트 하나(처음 → 마지막
     * 상태)로 냅니다. 중간 상태는 저장되지 않기 때문입니다.
     *
     * `expectedVersion`을 받으면 읽은 뒤 다른 요청이 먼저 저장했을 때 412 `VERSION_MISMATCH`입니다. 받지 않았으면
     * 클라이언트가 잠금을 요청하지 않은 것이라, 새 상태로 다시 읽어 판정하고 저장하기를 3번까지 되풀이합니다.
     *
     * 현재 사용자(`CurrentAccess`)가 고른 병원의 내원만 찾습니다. 다른 병원의 내원은 404 `VISIT_NOT_FOUND`입니다.
     * 이벤트에는 그 병원과 사용자를 적습니다.
     *
     * 커맨드 자체의 권한(`visit:update`·`visit:cancel`)은 엔드포인트 선언이 확인합니다. 연쇄 취소는 본문에 따라
     * 정해지므로 여기서 `visit:cancel`·`receipt:void`·`encounter:retract`를 모두 확인합니다(D3). 내원을 읽기 전에
     * 확인해, 권한이 없으면 내원 상태와 상관없이 403 `PERMISSION_DENIED`입니다. 취소는 같은 트랜잭션에서 내원의 진료를
     * 철회합니다(`encounter.retracted`, 사유는 취소 사유). 연쇄가 아니면 내용이 없는 진료만 여기까지 오고, 연쇄 취소는
     * 고정한 진료도 철회합니다. 연쇄 취소는 유효한 영수증도 취소합니다(`voidReceipt`, `receipt.voided`). 카드·간편결제처럼
     * 밖에서 취소할 결제가 남았으면 409 `PAYMENT_REFUND_REQUIRED`이고 먼저 환불합니다. 담당 환자 범위(`scope: OWN`)는
     * 담당 관계가 생길 때 확인합니다.
     *
     * 읽기·판정·쓰기를 한 트랜잭션에서 해, 진료 저장이 취소의 진료 내용 판정과 저장 사이에 끼어들지 못합니다.
     *
     * 진료에 본문이나 상병이 있거나 유효한 영수증이 있으면 저장된 `hasClinicalData`와 상관없이 기록이 있는 내원으로
     * 판정합니다.
     */
    apply(
      id: Id<'visit'>,
      command: VisitCommand,
      input?: VisitCommandInput,
    ): Effect.Effect<Visit, VisitCommandError, CurrentAccess>

    /**
     * 환자를 오늘 진료로 접수합니다. 현재 사용자가 고른 병원의 환자만 받고, 없으면 404 `PATIENT_NOT_FOUND`입니다.
     *
     * 접수 검증(`validateCheckIn`)이 막으면 422 `CHECK_IN_REJECTED`로 모든 이유를 돌려줍니다. 본인확인 판정의 첫
     * 내원·마지막 확인일은 취소하지 않은 이전 내원에서 셉니다. 요양기관기호는 병원 설정입니다.
     *
     * 내원, 빈 초안 진료(`draftEncounter`), `visit.checked_in`·`encounter.created` 이벤트를 한 트랜잭션에서 씁니다.
     * 바로 진료로 들어가도(`initialStatus: IN_TREATMENT`) 내원 이벤트는 접수 하나입니다. 예약·제주 지원 스냅샷은 그
     * 모듈이 생길 때 같은 트랜잭션에 더합니다.
     */
    checkIn(input: CheckInInput): Effect.Effect<Visit, CheckInError, CurrentAccess>

    /** 고른 병원의 내원 하나입니다. 다른 병원의 내원은 404입니다. */
    get(id: Id<'visit'>): Effect.Effect<Visit, VisitNotFound, CurrentAccess>

    /** 고른 병원의 그날 내원입니다. 접수 시각 순서입니다. 날짜가 없으면 오늘입니다. */
    list(query: Partial<VisitListQuery>): Effect.Effect<ReadonlyArray<Visit>, never, CurrentAccess>
  }
>()('hemr/front-desk/Visits') {
  static readonly layer = Layer.effect(
    Visits,
    Effect.gen(function* () {
      const repository = yield* VisitRepository
      const encounters = yield* EncounterRepository
      const receipts = yield* ReceiptRepository
      const transaction = yield* Transaction

      /**
       * 저장된 값, 유효한 영수증, 진료 내용으로 판정합니다. 진료가 없는 내원(마이그레이션 `0007` 전 접수)은 진료 내용을
       * 보지 않습니다. 철회한 진료는 기록이 남아도 무효라 내용으로 치지 않습니다.
       */
      const hasClinicalData = (visit: Visit) =>
        receipts
          .listByVisit(visit.tenantId, visit.id)
          .pipe(
            Effect.flatMap((listed) =>
              listed.some((each) => each.status === 'ACTIVE') ? Effect.succeed(true) : hasEncounterData(visit),
            ),
          )

      const hasEncounterData = (visit: Visit) =>
        visit.hasClinicalData || visit.encounterId === null
          ? Effect.succeed(visit.hasClinicalData)
          : encounters.findById(visit.tenantId, visit.encounterId).pipe(
              Effect.map(
                Option.match({
                  onNone: () => false,
                  onSome: (each) => each.status !== 'ENTERED_IN_ERROR' && hasClinicalContent(each),
                }),
              ),
            )

      const attempt = Effect.fn('Visits.apply')(function* (
        id: Id<'visit'>,
        command: VisitCommand,
        input: VisitCommandInput = {},
      ) {
        const access = yield* CurrentAccess
        if (command === 'CANCEL' && input.cascade === true) {
          yield* requirePermissions('visit:cancel', 'receipt:void', 'encounter:retract')
        }
        return yield* transaction.run(transition(access, id, command, input))
      })

      const transition = (
        access: CurrentAccess['Service'],
        id: Id<'visit'>,
        command: VisitCommand,
        input: VisitCommandInput,
      ) =>
        Effect.gen(function* () {
          const visit = yield* repository.findById(access.tenantId, id).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new VisitNotFound({})),
                onSome: Effect.succeed,
              }),
            ),
          )
          if (input.expectedVersion !== undefined && input.expectedVersion !== visit.version) {
            return yield* new VersionMismatch({ currentVersion: visit.version })
          }

          const now = yield* DateTime.now

          // 연쇄 취소는 유효한 영수증도 취소합니다. 돈 기록이 남은 채 내원만 취소되면 시재가 취소한 내원의 돈을 셉니다.
          // 막힐 수 있는 판정을 저장 전에 합니다. 영수증 쓰기는 진료 철회처럼 맨 뒤라, 그 사이 다른 요청이 영수증을
          // 바꾸면 SQL은 모두 되돌리고 되돌리지 못하는 메모리 저장소는 내원만 취소된 채 남을 수 있습니다
          const voiding =
            command === 'CANCEL' && input.cascade === true
              ? yield* Effect.gen(function* () {
                  const active = (yield* receipts.listByVisit(visit.tenantId, visit.id)).find(
                    (each) => each.status === 'ACTIVE',
                  )
                  if (active === undefined) return null
                  const record = recordOf(active)
                  const decision = voidReceipt(record, yield* receipts.paymentsOf(visit.tenantId, active.id), {
                    reason: input.reason ?? 'Visit canceled',
                    at: DateTime.formatIso(now),
                    by: access.userId,
                  })
                  if (!decision.ok) {
                    return yield* new PaymentRefundRequired({ receiptId: active.id, paymentIds: decision.paymentIds })
                  }
                  return { before: record, decision }
                })
              : null

          const options = {
            hasClinicalData: yield* hasClinicalData(visit),
            isPastDate: visit.date < clinicDate(DateTime.toEpochMillis(now)),
            ...(input.cascade === undefined ? {} : { cascade: input.cascade }),
          }
          const steps =
            command === 'REOPEN' && input.then !== undefined ? [command, THEN_COMMANDS[input.then]] : [command]

          // 중간 단계가 실패하면 아무것도 저장하지 않습니다.
          let status = visit.status
          for (const step of steps) {
            const result = transitionVisit(status, step, options)
            if (!result.ok) return yield* toError(result.code, visit, status, step)
            status = result.to
          }

          const { statusReason: _, ...rest } = visit
          const next: Visit = {
            ...rest,
            status,
            statusChangedAt: DateTime.formatIso(now),
            version: visit.version + 1,
            ...(input.reason === undefined ? {} : { statusReason: input.reason }),
          }
          const event = domainEvent(
            'visit.status_changed',
            visit.id,
            next.statusChangedAt,
            { visitId: visit.id, patientId: visit.patientId, from: visit.status, to: status },
            { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
          )
          // 읽은 뒤 다른 요청이 먼저 저장했으면 저장소가 `VersionMismatch`로 거절합니다
          yield* repository.save(next, { expectedVersion: visit.version, events: [event] })
          // 취소한 내원의 진료는 철회합니다. 연쇄가 아니면 여기까지 온 진료는 내용이 없는 진료입니다
          if (status === 'CANCELED' && visit.encounterId !== null) {
            const encounter = yield* encounters.findById(access.tenantId, visit.encounterId)
            if (Option.isSome(encounter) && encounter.value.status !== 'ENTERED_IN_ERROR') {
              const retracted = retractEncounter(encounter.value, {
                reason: input.reason ?? 'Visit canceled',
                at: next.statusChangedAt,
                by: access.userId,
                tenantId: access.tenantId,
              })
              // 같은 트랜잭션에서 방금 읽은 진료라 버전이 어긋나지 않습니다. 어긋나면 결함이고 SQL 저장소는 취소도
              // 되돌립니다. 되돌리지 못하는 메모리 저장소(테스트·개발용)에서는 내원만 취소된 채 남을 수 있습니다
              yield* encounters
                .save(retracted.encounter, { expectedVersion: encounter.value.version, events: [retracted.event] })
                .pipe(Effect.orDie)
            }
          }
          if (voiding !== null) {
            const { before, decision } = voiding
            yield* receipts.commit({
              updateReceipts: [{ receipt: decision.receipt, expectedVersion: before.version }],
              updatePayments: decision.voided.map((each) => ({ payment: each, expectedVersion: each.version - 1 })),
              events: [
                domainEvent(
                  'receipt.voided',
                  before.id,
                  next.statusChangedAt,
                  {
                    receiptId: before.id,
                    visitId: visit.id,
                    patientId: visit.patientId,
                    date: before.date,
                    reason: input.reason ?? 'Visit canceled',
                    correctedBy: null,
                  },
                  { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
                ),
              ],
            })
          }
          return next
        })

      const apply = (id: Id<'visit'>, command: VisitCommand, input: VisitCommandInput = {}) =>
        input.expectedVersion === undefined
          ? attempt(id, command, input).pipe(
              Effect.retry({ while: (error) => error._tag === 'VersionMismatch', times: 3 }),
            )
          : attempt(id, command, input)

      const patients = yield* Patients
      const identity = yield* IdentityRepository

      const checkIn = Effect.fn('Visits.checkIn')(function* (input: CheckInInput) {
        const access = yield* CurrentAccess
        // 바로 진료로 들어가는 것은 `:start-treatment`와 같아, 본문에 따라 그 권한을 더 확인합니다 (D3와 같은 방식)
        if (input.initialStatus === 'IN_TREATMENT') yield* requirePermissions('visit:update')
        const patient = yield* patients.get(input.patientId)
        const now = yield* DateTime.now
        const date = clinicDate(DateTime.toEpochMillis(now))
        const history = yield* repository.historyOf(access.tenantId, patient.id)
        const tenant = yield* identity.findTenant(access.tenantId)
        const flags = {
          fullSelfPay: input.benefitFlags?.fullSelfPay ?? false,
          pregnant: input.benefitFlags?.pregnant ?? false,
        }
        const firstVisitDate = patient.firstVisitDate ?? history.firstVisitDate
        // 현행 화면은 고르지 않으면 `없음`을 보냈습니다. 공백·`없음`은 고르지 않은 것으로 저장합니다
        const chosen = input.copayCode?.trim() ?? ''
        const copayCode = chosen === '' || chosen === '없음' ? null : chosen

        const validation = validateCheckIn({
          coverage: input.coverage,
          date,
          fullSelfPay: flags.fullSelfPay,
          eligibility: input.eligibility ?? null,
          clinicInstitutionCode: Option.match(tenant, {
            onNone: () => null,
            onSome: (each) => each.hiraInstitutionCode,
          }),
          chosenCopayCode: copayCode,
          chosenInstitutionCode: input.selectedInstitutionCode ?? null,
          patient: {
            birthDate: patient.birthDate,
            firstVisitDate,
            lastIdentityVerifiedOn: history.lastIdentityVerifiedOn,
            pregnant: flags.pregnant,
          },
          identityVerified: input.identityVerified ?? false,
          autoInsurance: input.autoInsurance ?? null,
        })
        if (validation.errors.length > 0) return yield* new CheckInRejected({ errors: validation.errors })

        const national = input.coverage === 'NHIS' || input.coverage === 'MEDICAL_AID'
        const checkedInAt = DateTime.formatIso(now)
        const encounterId = newId('encounter', DateTime.toEpochMillis(now))
        const visit: Visit & { encounterId: Id<'encounter'> } = {
          id: input.id ?? newId('visit'),
          tenantId: access.tenantId,
          patientId: patient.id,
          date,
          checkedInAt,
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
          encounterId,
          status: input.initialStatus ?? 'WAITING',
          statusChangedAt: checkedInAt,
          hasClinicalData: false,
          version: 1,
        }
        const context = { tenantId: access.tenantId, actor: { kind: 'USER' as const, id: access.userId } }
        const event = domainEvent(
          'visit.checked_in',
          visit.id,
          checkedInAt,
          {
            visitId: visit.id,
            patientId: visit.patientId,
            date,
            coverage: visit.coverage,
            isFirstVisit: visit.isFirstVisit,
            status: visit.status,
          },
          context,
        )
        const draft = draftEncounter(visit, context)
        yield* transaction.run(
          Effect.gen(function* () {
            // 같은 ID가 이미 있으면 저장소가 `VersionMismatch`로 거절합니다. 새로 만드는 것이라 412가 아니라 409입니다.
            // 실패할 수 있는 내원을 먼저 써, 되돌리지 못하는 메모리 저장소에서도 진료만 남지 않습니다
            yield* repository
              .save(visit, { expectedVersion: null, events: [event] })
              .pipe(Effect.catchTag('VersionMismatch', () => Effect.fail(new VisitAlreadyExists({}))))
            // 진료 ID는 서버가 방금 만들어 겹치지 않습니다. 겹치면 결함입니다
            yield* encounters.save(draft.encounter, { expectedVersion: null, events: [draft.event] }).pipe(Effect.orDie)
          }),
        )
        return visit
      })

      const get = Effect.fn('Visits.get')(function* (id: Id<'visit'>) {
        const access = yield* CurrentAccess
        return yield* repository
          .findById(access.tenantId, id)
          .pipe(
            Effect.flatMap(Option.match({ onNone: () => Effect.fail(new VisitNotFound({})), onSome: Effect.succeed })),
          )
      })

      const list = Effect.fn('Visits.list')(function* (query: Partial<VisitListQuery>) {
        const access = yield* CurrentAccess
        const date = query.date ?? clinicDate(DateTime.toEpochMillis(yield* DateTime.now))
        return yield* repository.list(access.tenantId, {
          date,
          ...(query.status === undefined ? {} : { status: query.status }),
        })
      })

      return Visits.of({ apply, checkIn, get, list })
    }),
  )
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

function toError(
  code: VisitTransitionErrorCode,
  visit: Visit,
  currentStatus: VisitStatus,
  command: VisitCommand,
): VisitTransitionInvalid | VisitHasClinicalData | VisitDatePast {
  switch (code) {
    case 'VISIT_TRANSITION_INVALID':
      return new VisitTransitionInvalid({ currentStatus, command })
    case 'VISIT_HAS_CLINICAL_DATA':
      return new VisitHasClinicalData({ currentStatus })
    case 'VISIT_DATE_PAST':
      return new VisitDatePast({ date: visit.date })
  }
}
