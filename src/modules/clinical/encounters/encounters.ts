import { Array as Arr, Context, DateTime, Effect, Layer, Option } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { CurrentAccess, requirePermissions } from '../../identity/auth/access.ts'
import type { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import type { Permission } from '../../identity/permissions.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import type { PatientNotFound } from '../../patients/patient.ts'
import { Patients } from '../../patients/patients.ts'
import type { PrescriptionLineRef } from '../prescriptions/prescription-line-changes.ts'
import { applyChanges, encounterWarnings } from './encounter-changes.ts'
import type { EncounterChanges } from './encounter-changes.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { EncounterChangeInvalid, EncounterNotEditable, EncounterNotFound, EncounterVisitCanceled } from './encounter.ts'
import type { Encounter, EncounterWarning } from './encounter.ts'
import { EncounterRepository } from './encounter-repository.ts'

/** 저장한 진료와, 완료 전에 고쳐야 하는 것과, 새 처방 라인의 `clientRef`와 서버 ID의 대응입니다. */
export interface SavedEncounter {
  encounter: Encounter
  warnings: ReadonlyArray<EncounterWarning>
  prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
}

export type UpdateEncounterError =
  | EncounterNotFound
  | EncounterNotEditable
  | EncounterVisitCanceled
  | EncounterChangeInvalid
  | VersionMismatch
  | PermissionDenied

/**
 * 접수한 내원의 빈 진료와 `encounter.created` 이벤트입니다. 접수(`Visits.checkIn`)가 내원과 같은 트랜잭션에서
 * 저장합니다. 보험구분·표시는 내원에서 복사하고, 진료 기준 시각은 접수 시각입니다.
 */
export function draftEncounter(
  visit: Visit & { encounterId: Id<'encounter'> },
  context: Required<Pick<DomainEvent, 'tenantId' | 'actor'>>,
): { encounter: Encounter; event: DomainEvent } {
  const encounter: Encounter = {
    id: visit.encounterId,
    tenantId: visit.tenantId,
    patientId: visit.patientId,
    visitId: visit.id,
    doctorId: null,
    encounterType: 'OFFICE',
    coverage: visit.coverage,
    serviceAt: visit.checkedInAt,
    note: { body: '' },
    diagnoses: [],
    prescriptionLines: [],
    benefitFlags: visit.benefitFlags,
    status: 'DRAFT',
    createdAt: visit.checkedInAt,
    updatedAt: visit.checkedInAt,
    version: 1,
  }
  const event = domainEvent(
    'encounter.created',
    encounter.id,
    encounter.createdAt,
    { encounterId: encounter.id, visitId: visit.id, patientId: visit.patientId },
    context,
  )
  return { encounter, event }
}

/**
 * 진료에 기록한 내용이 있는지입니다. 내원을 `cascade` 없이 취소할 수 있는지 정할 때 씁니다. 편집기가 비운 본문에 남기는
 * 빈 태그(`<p><br></p>`)와 공백은 내용으로 치지 않고, 그림(`<img>`)은 글자가 없어도 내용입니다. 상병이나 처방 라인이
 * 하나라도 있으면 내용입니다.
 */
export function hasClinicalContent(encounter: Encounter): boolean {
  const body = encounter.note.body
  const text = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text !== '' || /<img\b/i.test(body) || encounter.diagnoses.length > 0 || encounter.prescriptionLines.length > 0
}

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
  }
>()('hemr/clinical/Encounters') {
  static readonly layer = Layer.effect(
    Encounters,
    Effect.gen(function* () {
      const repository = yield* EncounterRepository
      const patients = yield* Patients
      const visits = yield* VisitRepository

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

      return Encounters.of({ get, listForPatient, update })
    }),
  )
}
