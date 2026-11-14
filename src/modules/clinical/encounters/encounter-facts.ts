import { Array as Arr, DateTime, Effect, Option, Result } from 'effect'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { CurrentAccess, requirePermissions } from '../../identity/auth/access.ts'
import type { Permission } from '../../identity/permissions.ts'
import type { ReceiptRepository } from '../../front-desk/receipts/receipt-repository.ts'
import type { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import { EncounterNotFound } from './encounter.ts'
import type { Encounter } from './encounter.ts'
import { decideDraft } from './encounter.aggregate.ts'
import type { EncounterWrite } from './encounter.aggregate.ts'
import type { EncounterChanges, NewIds } from './encounter-changes.ts'
import type { EncounterRepository } from './encounter-repository.ts'

/**
 * 진료 판정(`encounter.aggregate.ts`)에 넘길 사실을 읽고 판정한 쓰기를 저장합니다. 진료 서비스와 정정 제안 서비스가 같이
 * 씁니다. 모두 같은 트랜잭션 안에서 부릅니다.
 */
/**
 * 내원의 진료 초안을 만들어 저장하고 돌려줍니다(결정 M1). 정책과, 정책보다 먼저 그 진료를 연 요청이 같이 씁니다. 이미
 * 있으면(다른 쪽이 먼저 만듦) 저장된 진료를 돌려줍니다. 취소한 내원이면 `null`입니다.
 */
export function createDraft(
  encounters: EncounterRepository['Service'],
  visit: Visit & { encounterId: Id<'encounter'> },
  context: DecisionContext,
): Effect.Effect<Encounter | null> {
  return Effect.gen(function* () {
    const existing = yield* encounters.findById(visit.tenantId, visit.encounterId)
    if (Option.isSome(existing)) return existing.value
    const decided = Result.getOrThrow(decideDraft(visit, context))
    if (decided === null) return null
    // 읽은 뒤 다른 쪽이 먼저 만들었으면 저장소가 `VersionMismatch`로 거절하고, 그 진료를 다시 읽습니다
    return yield* encounters.save(decided.encounter, { expectedVersion: null, events: [decided.event] }).pipe(
      Effect.as(decided.encounter),
      Effect.catchTag('VersionMismatch', () =>
        encounters.findById(visit.tenantId, visit.encounterId).pipe(Effect.map(Option.getOrThrow)),
      ),
    )
  })
}

export function encounterFacts(deps: {
  encounters: EncounterRepository['Service']
  visits: VisitRepository['Service']
  receipts: ReceiptRepository['Service']
}) {
  /**
   * 진료입니다. 접수 정책이 아직 초안을 만들지 않았으면(결정 M1) 그 진료 ID의 내원으로 지금 만듭니다. 만든 사람은 이
   * 요청의 사용자입니다. 내원이 없거나 취소됐으면 404입니다.
   */
  const find = (tenantId: Id<'tenant'>, id: Id<'encounter'>) =>
    Effect.gen(function* () {
      const found = yield* deps.encounters.findById(tenantId, id)
      if (Option.isSome(found)) return found.value
      const visit = Option.getOrNull(yield* deps.visits.findByEncounterId(tenantId, id))
      if (visit === null || visit.encounterId === null) return yield* new EncounterNotFound({})
      const access = yield* CurrentAccess
      const created = yield* createDraft(
        deps.encounters,
        { ...visit, encounterId: visit.encounterId },
        decisionContext(access, yield* DateTime.now),
      )
      return created ?? (yield* new EncounterNotFound({}))
    })

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
