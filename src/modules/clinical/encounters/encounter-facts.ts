import { Array as Arr, Effect, Option } from 'effect'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { requirePermissions } from '../../identity/auth/access.ts'
import type { Permission } from '../../identity/permissions.ts'
import type { ReceiptRepository } from '../../front-desk/receipts/receipt-repository.ts'
import type { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { EncounterNotFound } from './encounter.ts'
import type { Encounter } from './encounter.ts'
import type { EncounterWrite } from './encounter.aggregate.ts'
import type { EncounterChanges, NewIds } from './encounter-changes.ts'
import type { EncounterRepository } from './encounter-repository.ts'

/**
 * 진료 판정(`encounter.aggregate.ts`)에 넘길 사실을 읽고 판정한 쓰기를 저장합니다. 진료 서비스와 정정 제안 서비스가 같이
 * 씁니다. 모두 같은 트랜잭션 안에서 부릅니다.
 */
export function encounterFacts(deps: {
  encounters: EncounterRepository['Service']
  visits: VisitRepository['Service']
  receipts: ReceiptRepository['Service']
}) {
  const find = (tenantId: Id<'tenant'>, id: Id<'encounter'>) =>
    deps.encounters
      .findById(tenantId, id)
      .pipe(
        Effect.flatMap(Option.match({ onNone: () => Effect.fail(new EncounterNotFound({})), onSome: Effect.succeed })),
      )

  /** 진료의 내원입니다. 내원 없는 진료는 `null`입니다. */
  const visitOf = (encounter: Encounter) =>
    encounter.visitId === null
      ? Effect.succeed(null)
      : deps.visits.findById(encounter.tenantId, encounter.visitId).pipe(Effect.map(Option.getOrNull))

  /** 이 진료를 담은 유효한 영수증입니다. */
  const billedBy = (encounter: Encounter) =>
    encounter.visitId === null
      ? Effect.succeed(null)
      : deps.receipts
          .listByVisit(encounter.tenantId, encounter.visitId)
          .pipe(
            Effect.map(
              (listed) =>
                listed.find((each) => each.status === 'ACTIVE' && each.encounterIds.includes(encounter.id))?.id ?? null,
            ),
          )

  /** 같은 환자의 진료입니다. */
  const othersOf = (encounter: Encounter) => deps.encounters.listByPatient(encounter.tenantId, encounter.patientId)

  /** 판정한 진료 쓰기입니다. 읽은 뒤 다른 요청이 먼저 저장했으면 저장소가 `VersionMismatch`로 거절합니다. */
  const write = (decided: EncounterWrite) =>
    deps.encounters.save(decided.encounter, {
      expectedVersion: decided.expectedVersion,
      events: [decided.event],
      ...(decided.revision === null ? {} : { revision: decided.revision }),
    })

  return { find, visitOf, billedBy, othersOf, write }
}

/** 판정에 넘기는 새 상병·처방 라인 ID입니다. */
export const NEW_IDS: NewIds = {
  diagnosis: () => newId('diagnosis'),
  prescriptionLine: () => newId('prescriptionLine'),
}

/** 변경에 처방 라인이 있을 때 더 필요한 권한입니다. 빠진 권한을 한 번에 모두 알립니다. */
export function requirePrescriptionPermissions(changes: EncounterChanges) {
  const lines = changes.prescriptionLines
  const needed: Permission[] = []
  if ((lines?.upsert?.length ?? 0) > 0 || (lines?.remove?.length ?? 0) > 0) needed.push('prescription:write')
  if (lines?.upsert?.some((each) => each.prn === true)) needed.push('prescription:write_prn')
  return Arr.isArrayNonEmpty(needed) ? requirePermissions(...needed) : Effect.void
}
