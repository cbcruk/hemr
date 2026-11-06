import { Array as Arr, Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { CurrentAccess, requirePermissions } from '../../identity/auth/access.ts'
import type { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import type { Permission } from '../../identity/permissions.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import type { VisitCommand } from '../../front-desk/visits/visit-status.types.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import type { PatientNotFound } from '../../patients/patient.ts'
import { Patients } from '../../patients/patients.ts'
import type { PrescriptionLineRef } from '../prescriptions/prescription-line-changes.ts'
import { applyChanges, encounterWarnings } from './encounter-changes.ts'
import type { EncounterChanges } from './encounter-changes.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { judgeCompletion } from './encounter-completion.ts'
import type { Acknowledgeable } from './encounter-completion.ts'
import {
  EncounterChangeInvalid,
  EncounterCompletionRejected,
  EncounterLocked,
  EncounterNotEditable,
  EncounterNotFound,
  EncounterRevisionNotFound,
  EncounterVisitCanceled,
} from './encounter.ts'
import type { Encounter, EncounterRevision, EncounterWarning } from './encounter.ts'
import { retractEncounter } from './encounter-retraction.ts'
import { EncounterRepository } from './encounter-repository.ts'

/** 저장한 진료와, 완료 전에 고쳐야 하는 것과, 새 처방 라인의 `clientRef`와 서버 ID의 대응입니다. */
export interface SavedEncounter {
  encounter: Encounter
  warnings: ReadonlyArray<EncounterWarning>
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

/** 완료한 뒤 내원을 보낼 상태입니다. */
export type NextVisitStatus = 'WAITING' | 'IN_TREATMENT' | 'AWAITING_PAYMENT'

export interface CompleteEncounterInput {
  /** 없으면 `IN_TREATMENT`(치료실로 보냄)입니다. */
  nextVisitStatus?: NextVisitStatus
  acknowledge?: ReadonlyArray<Acknowledgeable>
  expectedVersion: number
}

/** 완료한 진료와 그 내원입니다. 내원 없는 진료는 `visit`이 `null`입니다. */
export interface CompletedEncounter {
  encounter: Encounter
  visit: Visit | null
}

export type CompleteEncounterError =
  EncounterNotFound | EncounterNotEditable | EncounterVisitCanceled | EncounterCompletionRejected | VersionMismatch

/** 내원을 `nextVisitStatus`로 보내는 내원 커맨드입니다. */
const NEXT_VISIT_COMMANDS: Record<NextVisitStatus, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
  AWAITING_PAYMENT: 'SEND_TO_CHECKOUT',
}

export interface AmendEncounterInput {
  reason: string
  /** `PATCH`와 같은 형식의 바꿀 내용입니다. */
  changes: EncounterChanges
  acknowledge?: ReadonlyArray<Acknowledgeable>
  expectedVersion: number
}

/** 정정한 진료와 새 처방 라인의 `clientRef`와 서버 ID의 대응입니다. */
export interface AmendedEncounter {
  encounter: Encounter
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

export type AmendEncounterError =
  | EncounterNotFound
  | EncounterNotEditable
  | EncounterLocked
  | EncounterVisitCanceled
  | EncounterChangeInvalid
  | EncounterCompletionRejected
  | VersionMismatch
  | PermissionDenied

export type RetractEncounterError = EncounterNotFound | EncounterNotEditable | EncounterLocked | VersionMismatch

export type LockEncounterError = EncounterNotFound | EncounterNotEditable | VersionMismatch

/** 변경에 처방 라인이 있을 때 더 필요한 권한입니다. 빠진 권한을 한 번에 모두 알립니다. */
const requirePrescriptionPermissions = (changes: EncounterChanges) => {
  const lines = changes.prescriptionLines
  const needed: Permission[] = []
  if ((lines?.upsert?.length ?? 0) > 0 || (lines?.remove?.length ?? 0) > 0) needed.push('prescription:write')
  if (lines?.upsert?.some((each) => each.prn === true)) needed.push('prescription:write_prn')
  return Arr.isArrayNonEmpty(needed) ? requirePermissions(...needed) : Effect.void
}

/** 진료기록 판 하나입니다. 지금 내용을 그대로 담습니다. */
const revisionOf = (
  encounter: Encounter,
  input: Pick<EncounterRevision, 'source' | 'reason' | 'recordedBy' | 'recordedAt'>,
): EncounterRevision => ({
  encounterId: encounter.id,
  revision: encounter.revision,
  note: encounter.note,
  diagnoses: encounter.diagnoses,
  prescriptionLines: encounter.prescriptionLines,
  ...input,
})

export type UpdateEncounterError =
  | EncounterNotFound
  | EncounterNotEditable
  | EncounterVisitCanceled
  | EncounterChangeInvalid
  | VersionMismatch
  | PermissionDenied

/**
 * 진료 조회와 초안 저장입니다 (clinical.md 진료). 모든 작업은 현재 사용자(`CurrentAccess`)가 고른 병원 안에서 합니다.
 * 다른 병원의 진료는 404 `ENCOUNTER_NOT_FOUND`입니다. 담당 환자 범위(`scope: OWN`)는 담당 관계가 생길 때 확인합니다.
 */
export class Encounters extends Context.Service<
  Encounters,
  {
    get(id: Id<'encounter'>): Effect.Effect<Encounter, EncounterNotFound, CurrentAccess>

    /** 환자의 진료입니다. 최근 진료가 먼저입니다. 다른 병원의 환자는 404 `PATIENT_NOT_FOUND`입니다. */
    listForPatient(patientId: Id<'patient'>): Effect.Effect<ReadonlyArray<Encounter>, PatientNotFound, CurrentAccess>

    /**
     * 초안 진료에 `PATCH` 변경을 적용합니다(`applyChanges`). `expectedVersion`이 현재 버전과 다르면 412
     * `VERSION_MISMATCH`입니다. 진료기록은 다른 사람의 저장을 덮어쓰면 안 되므로 내원 커맨드와 달리 다시 시도하지
     * 않습니다.
     *
     * 처방 라인(`prescriptionLines`)을 하나라도 고치거나 지우면 `prescription:write`가, PRN 라인을 고치거나 더하면
     * `prescription:write_prn`도 있어야 합니다(403 `PERMISSION_DENIED`). 권한은 진료를 읽기 전에 봅니다.
     *
     * 초안이 아니면 409 `ENCOUNTER_NOT_EDITABLE`, 내원을 취소했으면 409 `ENCOUNTER_VISIT_CANCELED`, 적용할 수 없는
     * 변경은 422 `ENCOUNTER_CHANGE_INVALID`입니다. 주상병 개수나 보험구분에 맞지 않는 처방 같은 문제는 저장하고
     * `warnings`로 알립니다.
     *
     * 바뀐 것이 있으면 버전을 올리고 같은 트랜잭션에서 `encounter.updated`(바뀐 필드 이름)를 냅니다. 진료의가 비어
     * 있으면 저장한 사용자로 채웁니다. 바뀐 것이 없으면 그대로 돌려줍니다.
     */
    update(
      id: Id<'encounter'>,
      changes: EncounterChanges,
      options: { expectedVersion: number },
    ): Effect.Effect<SavedEncounter, UpdateEncounterError, CurrentAccess>

    /**
     * 완료·정정한 진료를 정정합니다 (clinical.md 진료, compliance.md 진료기록 정정). `changes`를 `PATCH`처럼 적용하고,
     * 결과가 완료 검증을 통과하면 `AMENDED`로 저장하고 다음 판을 남깁니다. 이전 판은 그대로 남습니다.
     *
     * 처방 라인 권한은 `update`와 같습니다. 완료·정정한 진료가 아니면 409 `ENCOUNTER_NOT_EDITABLE`, 고정했으면 409
     * `ENCOUNTER_LOCKED`, 내원을 취소했으면 409 `ENCOUNTER_VISIT_CANCELED`, 적용할 수 없으면 422
     * `ENCOUNTER_CHANGE_INVALID`, 결과가 완료 검증에 막히면 422 `ENCOUNTER_COMPLETION_REJECTED`입니다. 바뀐 것이
     * 없으면 판을 남기지 않고 그대로 돌려줍니다. 이벤트는 `encounter.amended`입니다.
     */
    amend(
      id: Id<'encounter'>,
      input: AmendEncounterInput,
    ): Effect.Effect<AmendedEncounter, AmendEncounterError, CurrentAccess>

    /**
     * 진료를 철회합니다(`ENTERED_IN_ERROR`). 기록은 사유와 함께 남고 진찰료 중복 같은 집계에서 빠집니다. 이미
     * 철회했으면 409 `ENCOUNTER_NOT_EDITABLE`, 고정했으면 409 `ENCOUNTER_LOCKED`입니다. 이벤트는
     * `encounter.retracted`입니다. 수납·청구한 진료의 409는 그 모듈이 생길 때 더합니다.
     */
    retract(
      id: Id<'encounter'>,
      input: { reason: string; expectedVersion: number },
    ): Effect.Effect<Encounter, RetractEncounterError, CurrentAccess>

    /**
     * 완료·정정한 진료를 고정하거나 풉니다. 그 밖의 상태는 409 `ENCOUNTER_NOT_EDITABLE`입니다. 이미 그 상태면 버전을
     * 올리지 않고 그대로 돌려줍니다. 이벤트는 `encounter.locked`·`encounter.unlocked`입니다.
     */
    setLocked(
      id: Id<'encounter'>,
      locked: boolean,
      options: { expectedVersion: number },
    ): Effect.Effect<Encounter, LockEncounterError, CurrentAccess>

    /** 진료기록의 판입니다. 1판(완료)부터 차례로입니다. 초안은 빈 목록입니다. */
    revisions(id: Id<'encounter'>): Effect.Effect<ReadonlyArray<EncounterRevision>, EncounterNotFound, CurrentAccess>

    /** 진료기록의 `n`판입니다. 없으면 404 `ENCOUNTER_REVISION_NOT_FOUND`입니다. */
    revision(
      id: Id<'encounter'>,
      n: number,
    ): Effect.Effect<EncounterRevision, EncounterNotFound | EncounterRevisionNotFound, CurrentAccess>

    /**
     * 초안 진료를 완료합니다 (clinical.md 완료 커맨드). 버전·상태·취소한 내원은 `update`와 같이 412·409입니다. 완료
     * 검증(`judgeCompletion`)이 막으면 422 `ENCOUNTER_COMPLETION_REJECTED`로 모든 이유를 돌려줍니다.
     *
     * 통과하면 한 트랜잭션에서 진료를 `COMPLETED`로 저장하고 `encounter.completed`를 내고, 내원을 `nextVisitStatus`로
     * 옮깁니다(`Visits.apply`, `visit.status_changed`). 내원이 이미 그 상태이거나, 진료가 끝난 상태(`COMPLETED`)이거나,
     * 지난 날짜의 내원이면 내원은 그대로 둡니다. `nextVisitStatus`를 고르지 않았으면 수납 대기(`AWAITING_PAYMENT`)인
     * 내원도 그대로 둡니다. 읽기와 판정도 같은 트랜잭션 안에서 합니다. 진료의가 비어 있으면 완료한 사용자로 채웁니다.
     */
    complete(
      id: Id<'encounter'>,
      input: CompleteEncounterInput,
    ): Effect.Effect<CompletedEncounter, CompleteEncounterError, CurrentAccess>
  }
>()('hemr/clinical/Encounters') {
  static readonly layer = Layer.effect(
    Encounters,
    Effect.gen(function* () {
      const repository = yield* EncounterRepository
      const patients = yield* Patients
      const visits = yield* VisitRepository
      const visitCommands = yield* Visits
      const transaction = yield* Transaction

      const find = (tenantId: Id<'tenant'>, id: Id<'encounter'>) =>
        repository
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new EncounterNotFound({})), onSome: Effect.succeed }),
            ),
          )

      const get = Effect.fn('Encounters.get')(function* (id: Id<'encounter'>) {
        const access = yield* CurrentAccess
        return yield* find(access.tenantId, id)
      })

      const listForPatient = Effect.fn('Encounters.listForPatient')(function* (patientId: Id<'patient'>) {
        const access = yield* CurrentAccess
        const patient = yield* patients.get(patientId)
        return yield* repository.listByPatient(access.tenantId, patient.id)
      })

      const update = Effect.fn('Encounters.update')(function* (
        id: Id<'encounter'>,
        changes: EncounterChanges,
        options: { expectedVersion: number },
      ) {
        const access = yield* CurrentAccess
        yield* requirePrescriptionPermissions(changes)
        // 읽기와 쓰기를 한 트랜잭션에서 해, 내원 취소가 진료 내용을 읽고 저장하는 사이에 끼어들지 못합니다
        return yield* transaction.run(save(access, id, changes, options))
      })

      const save = (
        access: CurrentAccess['Service'],
        id: Id<'encounter'>,
        changes: EncounterChanges,
        options: { expectedVersion: number },
      ) =>
        Effect.gen(function* () {
          const current = yield* find(access.tenantId, id)
          if (options.expectedVersion !== current.version) {
            return yield* new VersionMismatch({ currentVersion: current.version })
          }
          if (current.status !== 'DRAFT') return yield* new EncounterNotEditable({ currentStatus: current.status })
          if (current.visitId !== null) {
            const visit = yield* visits.findById(access.tenantId, current.visitId)
            if (Option.exists(visit, (each) => each.status === 'CANCELED')) return yield* new EncounterVisitCanceled({})
          }

          const result = applyChanges(current, changes, {
            diagnosis: () => newId('diagnosis'),
            prescriptionLine: () => newId('prescriptionLine'),
          })
          if (!result.ok) return yield* new EncounterChangeInvalid({ errors: result.errors })
          if (result.changed.length === 0) {
            return { encounter: current, warnings: encounterWarnings(current), prescriptionLineRefs: [] }
          }

          const updatedAt = DateTime.formatIso(yield* DateTime.now)
          const next: Encounter = {
            ...current,
            ...result.content,
            doctorId: current.doctorId ?? access.userId,
            updatedAt,
            version: current.version + 1,
          }
          const event = domainEvent(
            'encounter.updated',
            next.id,
            updatedAt,
            { encounterId: next.id, visitId: next.visitId, patientId: next.patientId, changed: result.changed },
            { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
          )
          // 읽은 뒤 다른 요청이 먼저 저장했으면 저장소가 `VersionMismatch`로 거절합니다
          yield* repository.save(next, { expectedVersion: current.version, events: [event] })
          return {
            encounter: next,
            warnings: encounterWarnings(next),
            prescriptionLineRefs: result.prescriptionLineRefs,
          }
        })

      /** 취소한 내원의 진료면 실패합니다. */
      const requireOpenVisit = (tenantId: Id<'tenant'>, encounter: Encounter) =>
        encounter.visitId === null
          ? Effect.void
          : visits
              .findById(tenantId, encounter.visitId)
              .pipe(
                Effect.flatMap((visit) =>
                  Option.exists(visit, (each) => each.status === 'CANCELED')
                    ? Effect.fail(new EncounterVisitCanceled({}))
                    : Effect.void,
                ),
              )

      /** 버전과 상태를 확인합니다. `statuses`에 없는 상태는 409 `ENCOUNTER_NOT_EDITABLE`입니다. */
      const guard = (current: Encounter, expectedVersion: number, statuses: ReadonlyArray<Encounter['status']>) =>
        expectedVersion !== current.version
          ? Effect.fail(new VersionMismatch({ currentVersion: current.version }))
          : !statuses.includes(current.status)
            ? Effect.fail(new EncounterNotEditable({ currentStatus: current.status }))
            : Effect.void

      /** 고정한 진료면 409 `ENCOUNTER_LOCKED`입니다. */
      const requireUnlocked = (current: Encounter) =>
        current.locked ? Effect.fail(new EncounterLocked({})) : Effect.void

      const actor = (access: CurrentAccess['Service']) => ({
        tenantId: access.tenantId,
        actor: { kind: 'USER' as const, id: access.userId },
      })

      const amend = Effect.fn('Encounters.amend')(function* (id: Id<'encounter'>, input: AmendEncounterInput) {
        const access = yield* CurrentAccess
        yield* requirePrescriptionPermissions(input.changes)
        return yield* transaction.run(
          Effect.gen(function* () {
            const current = yield* find(access.tenantId, id)
            yield* guard(current, input.expectedVersion, ['COMPLETED', 'AMENDED'])
            yield* requireUnlocked(current)
            yield* requireOpenVisit(access.tenantId, current)

            const result = applyChanges(current, input.changes, {
              diagnosis: () => newId('diagnosis'),
              prescriptionLine: () => newId('prescriptionLine'),
            })
            if (!result.ok) return yield* new EncounterChangeInvalid({ errors: result.errors })
            if (result.changed.length === 0) return { encounter: current, prescriptionLineRefs: [] }

            const amendedAt = DateTime.formatIso(yield* DateTime.now)
            const next: Encounter = {
              ...current,
              ...result.content,
              status: 'AMENDED',
              revision: current.revision + 1,
              updatedAt: amendedAt,
              version: current.version + 1,
            }
            const judgement = judgeCompletion({
              encounter: next,
              others: yield* repository.listByPatient(access.tenantId, current.patientId),
              acknowledge: input.acknowledge ?? [],
            })
            if (judgement.violations.length > 0) {
              return yield* new EncounterCompletionRejected({ violations: judgement.violations })
            }
            const event = domainEvent(
              'encounter.amended',
              next.id,
              amendedAt,
              {
                encounterId: next.id,
                visitId: next.visitId,
                patientId: next.patientId,
                revision: next.revision,
                changed: result.changed,
                reason: input.reason,
                acknowledged: judgement.acknowledged,
              },
              actor(access),
            )
            yield* repository.save(next, {
              expectedVersion: current.version,
              events: [event],
              revision: revisionOf(next, {
                source: 'AMENDMENT',
                reason: input.reason,
                recordedBy: access.userId,
                recordedAt: amendedAt,
              }),
            })
            return { encounter: next, prescriptionLineRefs: result.prescriptionLineRefs }
          }),
        )
      })

      const retract = Effect.fn('Encounters.retract')(function* (
        id: Id<'encounter'>,
        input: { reason: string; expectedVersion: number },
      ) {
        const access = yield* CurrentAccess
        return yield* transaction.run(
          Effect.gen(function* () {
            const current = yield* find(access.tenantId, id)
            yield* guard(current, input.expectedVersion, ['DRAFT', 'COMPLETED', 'AMENDED'])
            yield* requireUnlocked(current)
            const retracted = retractEncounter(current, {
              reason: input.reason,
              at: DateTime.formatIso(yield* DateTime.now),
              by: access.userId,
              tenantId: access.tenantId,
            })
            yield* repository.save(retracted.encounter, { expectedVersion: current.version, events: [retracted.event] })
            return retracted.encounter
          }),
        )
      })

      const setLocked = Effect.fn('Encounters.setLocked')(function* (
        id: Id<'encounter'>,
        locked: boolean,
        options: { expectedVersion: number },
      ) {
        const access = yield* CurrentAccess
        return yield* transaction.run(
          Effect.gen(function* () {
            const current = yield* find(access.tenantId, id)
            yield* guard(current, options.expectedVersion, ['COMPLETED', 'AMENDED'])
            if (current.locked === locked) return current
            const at = DateTime.formatIso(yield* DateTime.now)
            const next: Encounter = { ...current, locked, updatedAt: at, version: current.version + 1 }
            const event = domainEvent(
              locked ? 'encounter.locked' : 'encounter.unlocked',
              next.id,
              at,
              { encounterId: next.id, visitId: next.visitId, patientId: next.patientId },
              actor(access),
            )
            yield* repository.save(next, { expectedVersion: current.version, events: [event] })
            return next
          }),
        )
      })

      const revisions = Effect.fn('Encounters.revisions')(function* (id: Id<'encounter'>) {
        const access = yield* CurrentAccess
        const encounter = yield* find(access.tenantId, id)
        return yield* repository.listRevisions(access.tenantId, encounter.id)
      })

      const revision = Effect.fn('Encounters.revision')(function* (id: Id<'encounter'>, n: number) {
        const found = (yield* revisions(id)).find((each) => each.revision === n)
        if (found === undefined) return yield* new EncounterRevisionNotFound({})
        return found
      })

      const complete = Effect.fn('Encounters.complete')(function* (id: Id<'encounter'>, input: CompleteEncounterInput) {
        const access = yield* CurrentAccess
        // 읽기, 판정, 쓰기를 모두 한 트랜잭션에서 합니다. SQLite는 트랜잭션을 하나씩 실행하므로, 그 사이 내원 커맨드나
        // 같은 환자의 다른 완료가 끼어들어 읽은 값이 낡지 않습니다
        return yield* transaction.run(
          Effect.gen(function* () {
            const current = yield* find(access.tenantId, id)
            if (input.expectedVersion !== current.version) {
              return yield* new VersionMismatch({ currentVersion: current.version })
            }
            if (current.status !== 'DRAFT') return yield* new EncounterNotEditable({ currentStatus: current.status })
            const visit =
              current.visitId === null ? Option.none() : yield* visits.findById(access.tenantId, current.visitId)
            if (Option.exists(visit, (each) => each.status === 'CANCELED')) {
              return yield* new EncounterVisitCanceled({})
            }

            const judgement = judgeCompletion({
              encounter: current,
              others: yield* repository.listByPatient(access.tenantId, current.patientId),
              acknowledge: input.acknowledge ?? [],
            })
            if (judgement.violations.length > 0) {
              return yield* new EncounterCompletionRejected({ violations: judgement.violations })
            }

            const now = yield* DateTime.now
            const completedAt = DateTime.formatIso(now)
            const next: Encounter = {
              ...current,
              doctorId: current.doctorId ?? access.userId,
              status: 'COMPLETED',
              completedAt,
              revision: 1,
              updatedAt: completedAt,
              version: current.version + 1,
            }
            const event = domainEvent(
              'encounter.completed',
              next.id,
              completedAt,
              {
                encounterId: next.id,
                visitId: next.visitId,
                patientId: next.patientId,
                doctorId: next.doctorId,
                acknowledged: judgement.acknowledged,
              },
              { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
            )
            const target = input.nextVisitStatus ?? 'IN_TREATMENT'
            const move = Option.filter(
              visit,
              (each) =>
                each.status !== target &&
                each.status !== 'COMPLETED' &&
                // 데스크가 이미 수납으로 보낸 내원은 따로 고르지 않으면 치료실로 되돌리지 않습니다
                !(each.status === 'AWAITING_PAYMENT' && input.nextVisitStatus === undefined) &&
                each.date >= clinicDate(DateTime.toEpochMillis(now)),
            )

            // 실패할 수 있는 진료 쓰기(버전 비교)를 먼저 해, 되돌리지 못하는 메모리 저장소에서도 내원만 옮겨지지 않습니다
            yield* repository.save(next, {
              expectedVersion: current.version,
              events: [event],
              revision: revisionOf(next, {
                source: 'COMPLETION',
                reason: null,
                recordedBy: access.userId,
                recordedAt: completedAt,
              }),
            })
            const moved = yield* Option.match(move, {
              onNone: () => Effect.succeed(Option.getOrNull(visit)),
              // 같은 트랜잭션에서 방금 읽은 내원이라 이 전이는 늘 됩니다. 실패하면(요청 중 자정이 지나는 등) 결함이고
              // 진료도 되돌립니다
              onSome: (each) => visitCommands.apply(each.id, NEXT_VISIT_COMMANDS[target]).pipe(Effect.orDie),
            })
            return { encounter: next, visit: moved }
          }),
        )
      })

      return Encounters.of({ get, listForPatient, update, complete, amend, retract, setLocked, revisions, revision })
    }),
  )
}
