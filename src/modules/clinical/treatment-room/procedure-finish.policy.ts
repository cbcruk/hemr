import { Effect, Option } from 'effect'
import type { RecordedEvent } from '../../../shared/events/domain-event.ts'
import type { Policy } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { Procedures } from './procedures.ts'

/**
 * 진료 후 시술 종료 정책입니다(domain-model.md 정책, 결정 M2). 진료 완료(`encounter.completed`)가 내원을 대기·수납
 * (`nextVisitStatus`가 `WAITING`·`AWAITING_PAYMENT`)으로 보냈으면 그 내원의 진행 중·만료 시술을 완료합니다(현행
 * `치료완료` 호출 조건). 완료한 사람은 진료를 완료한 사람입니다.
 *
 * 내원 이동 정책과 따로 돌므로 내원이 실제로 옮겨졌는지는 보지 않습니다. 취소한 내원은 지나칩니다. 이미 완료한 시술은
 * 그대로라 같은 이벤트를 다시 받아도 같습니다.
 */
export const finishProceduresAfterEncounter: Policy<never, VisitRepository | Procedures> = {
  name: 'clinical.finish-procedures-after-encounter',
  handle: (event: RecordedEvent) =>
    Effect.gen(function* () {
      if (event.type !== 'encounter.completed') return
      const next = event.data['nextVisitStatus']
      if (next !== 'WAITING' && next !== 'AWAITING_PAYMENT') return
      const visitId = event.data['visitId'] as Id<'visit'> | null
      const tenantId = event.tenantId as Id<'tenant'> | undefined
      if (visitId === null) return
      if (tenantId === undefined || event.actor === undefined) {
        return yield* Effect.die(new Error(`encounter.completed ${event.id} has no tenant or actor`))
      }
      const visit = Option.getOrNull(yield* (yield* VisitRepository).findById(tenantId, visitId))
      if (visit === null || visit.status === 'CANCELED') return
      yield* (yield* Procedures).finishRunning(visit, { tenantId, actor: event.actor })
    }),
}
