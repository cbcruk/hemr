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
  EncounterNotEditable,
  EncounterNotFound,
  EncounterVisitCanceled,
} from './encounter.ts'
import type { Encounter, EncounterWarning } from './encounter.ts'
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
        const lines = changes.prescriptionLines
        const needed: Permission[] = []
        if ((lines?.upsert?.length ?? 0) > 0 || (lines?.remove?.length ?? 0) > 0) needed.push('prescription:write')
        if (lines?.upsert?.some((each) => each.prn === true)) needed.push('prescription:write_prn')
        // 빠진 권한을 한 번에 모두 알립니다
        if (Arr.isArrayNonEmpty(needed)) yield* requirePermissions(...needed)
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
            yield* repository.save(next, { expectedVersion: current.version, events: [event] })
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

      return Encounters.of({ get, listForPatient, update, complete })
    }),
  )
}
