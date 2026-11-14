import { DateTime, Effect, Option } from 'effect'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import type { RecordedEvent } from '../../../shared/events/domain-event.ts'
import type { Policy } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { createDraft } from './encounter-facts.ts'
import { EncounterRepository } from './encounter-repository.ts'

/**
 * 진료 초안 만들기 정책입니다(domain-model.md 정책, 결정 M1). 접수(`visit.checked_in`)를 받아, 접수가 내원에 정해 둔
 * 진료 ID로 빈 초안을 만듭니다. 만든 사람은 접수한 사람입니다.
 *
 * 정책보다 먼저 그 진료를 연 요청이 이미 만들었거나 같은 이벤트를 다시 받으면 아무것도 하지 않습니다. 그 사이 내원을
 * 취소했으면 만들지 않습니다. 접수는 되돌리지 않습니다.
 */
export const createVisitDraft: Policy<never, VisitRepository | EncounterRepository> = {
  name: 'clinical.create-visit-draft',
  handle: (event: RecordedEvent) =>
    Effect.gen(function* () {
      if (event.type !== 'visit.checked_in') return
      const tenantId = event.tenantId as Id<'tenant'> | undefined
      const userId = event.actor?.id as Id<'user'> | undefined
      if (tenantId === undefined || userId === undefined) {
        return yield* Effect.die(new Error(`visit.checked_in ${event.id} has no tenant or actor`))
      }
      const visit = Option.getOrNull(
        yield* (yield* VisitRepository).findById(tenantId, event.data['visitId'] as Id<'visit'>),
      )
      if (visit === null || visit.encounterId === null) return
      yield* createDraft(
        yield* EncounterRepository,
        { ...visit, encounterId: visit.encounterId },
        decisionContext({ tenantId, userId }, yield* DateTime.now),
      )
    }),
}
