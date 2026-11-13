import { DateTime, Effect, Option } from 'effect'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import type { RecordedEvent } from '../../../shared/events/domain-event.ts'
import type { Policy } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { decideRetractCanceledDraft } from './encounter.aggregate.ts'
import { EncounterRepository } from './encounter-repository.ts'
import type { EncounterNotEditable } from './encounter.ts'

/**
 * 빈 초안 철회 정책입니다(domain-model.md 정책, 결정 M5). 연쇄가 아닌 내원 취소(`visit.status_changed`, `to:
 * CANCELED`)를 받아 그 내원의 빈 진료 초안을 철회합니다. 철회 사유는 취소 사유이고, 철회한 사람은 취소한 사람입니다.
 *
 * 연쇄 취소는 같은 트랜잭션에서 이미 철회했으므로 아무것도 하지 않습니다. 같은 이벤트를 다시 받아도 같습니다. 초안이
 * 아니면 실행기가 거부를 기록하고 넘어갑니다. 내원 취소는 되돌리지 않습니다.
 */
export const retractCanceledDraft: Policy<EncounterNotEditable, VisitRepository | EncounterRepository> = {
  name: 'clinical.retract-canceled-draft',
  handle: (event: RecordedEvent) =>
    Effect.gen(function* () {
      if (event.type !== 'visit.status_changed' || event.data['to'] !== 'CANCELED') return
      const tenantId = event.tenantId as Id<'tenant'> | undefined
      const userId = event.actor?.id as Id<'user'> | undefined
      if (tenantId === undefined || userId === undefined) {
        return yield* Effect.die(new Error(`visit.status_changed ${event.id} has no tenant or actor`))
      }
      const visit = Option.getOrNull(
        yield* (yield* VisitRepository).findById(tenantId, event.data['visitId'] as Id<'visit'>),
      )
      if (visit === null || visit.encounterId === null) return
      const encounters = yield* EncounterRepository
      const encounter = Option.getOrNull(yield* encounters.findById(tenantId, visit.encounterId))
      if (encounter === null) return
      const context = decisionContext({ tenantId, userId }, yield* DateTime.now)
      const decided = yield* Effect.fromResult(
        decideRetractCanceledDraft(encounter, visit.statusReason ?? 'Visit canceled', context),
      )
      if (decided === null) return
      // 같은 트랜잭션에서 방금 읽은 진료라 버전이 어긋나면 결함입니다. 실행기가 되돌리고 다음 회차에 다시 합니다
      yield* encounters
        .save(decided.encounter, { expectedVersion: decided.expectedVersion, events: [decided.event] })
        .pipe(Effect.orDie)
    }),
}
