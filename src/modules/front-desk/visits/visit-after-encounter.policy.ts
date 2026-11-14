import { DateTime, Effect, Option, Result } from 'effect'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import type { RecordedEvent } from '../../../shared/events/domain-event.ts'
import type { Policy } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { decideVisitAfterEncounter } from './visit.aggregate.ts'
import type { NextVisitStatus } from './visit.aggregate.ts'
import { VisitRepository } from './visit-repository.ts'

/**
 * 진료 후 내원 이동 정책입니다(domain-model.md 정책, 결정 M2). 진료 완료(`encounter.completed`)를 받아 내원을
 * `nextVisitStatus`로 옮깁니다(`decideVisitAfterEncounter`). 옮긴 사람과 시각은 진료를 완료한 사람과 시각입니다.
 *
 * 옮기지 않는 내원(이미 그 상태, 수납 완료, 취소, 지난 날짜)은 그대로 두고 진료 완료는 되돌리지 않습니다. 판정과 저장
 * 사이에 다른 요청이 내원을 바꾸면 결함으로 멈추고, 실행기가 다음 회차에 다시 읽어 판정합니다.
 */
export const moveVisitAfterEncounter: Policy<never, VisitRepository> = {
  name: 'front-desk.move-visit-after-encounter',
  handle: (event: RecordedEvent) =>
    Effect.gen(function* () {
      if (event.type !== 'encounter.completed') return
      const visitId = event.data['visitId'] as Id<'visit'> | null
      const tenantId = event.tenantId as Id<'tenant'> | undefined
      const userId = event.actor?.id as Id<'user'> | undefined
      if (visitId === null) return
      if (tenantId === undefined || userId === undefined) {
        return yield* Effect.die(new Error(`encounter.completed ${event.id} has no tenant or actor`))
      }
      const visits = yield* VisitRepository
      const visit = Option.getOrNull(yield* visits.findById(tenantId, visitId))
      if (visit === null) return
      // 완료한 시각으로 판정합니다. 자정 직전에 완료한 진료를 정책이 자정 뒤에 받아도 지난 날짜로 보지 않습니다
      const context = decisionContext({ tenantId, userId }, DateTime.toUtc(DateTime.makeUnsafe(event.time)))
      const next = (event.data['nextVisitStatus'] ?? null) as NextVisitStatus | null
      const moved = Result.getOrThrow(decideVisitAfterEncounter(visit, next, context))
      if (moved === null) return
      yield* visits.save(moved.visit, { expectedVersion: visit.version, events: moved.events }).pipe(Effect.orDie)
    }),
}
