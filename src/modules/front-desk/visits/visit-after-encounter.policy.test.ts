import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory } from '../../../persistence.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { runPolicyOnce } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import { testVisit } from './testing.ts'
import { moveVisitAfterEncounter } from './visit-after-encounter.policy.ts'
import { VisitRepository } from './visit-repository.ts'

const DOCTOR = 'usr_01JBQ000000000000000000001' as Id<'user'>

/** 그날(한국 시간 2026-01-01 14시) 진료를 완료한 이벤트입니다. */
const completedOn = (visitId: Id<'visit'>, nextVisitStatus: string | null) =>
  domainEvent(
    'encounter.completed',
    'enc_01JBQ000000000000000000001',
    '2026-01-01T05:00:00.000Z',
    { visitId, nextVisitStatus },
    { tenantId: TEST_TENANT.id, actor: { kind: 'USER', id: DOCTOR } },
  )

describe('진료 후 내원 이동 정책', () => {
  it('완료한 날짜로 판정해, 정책이 다음 날 돌아도 그날 내원을 옮기고 완료 시각을 남깁니다', async () => {
    const visit = testVisit({ date: '2026-01-01', status: 'IN_TREATMENT' })
    const moved = await Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* Outbox).append([completedOn(visit.id, 'AWAITING_PAYMENT')])
        yield* runPolicyOnce(moveVisitAfterEncounter)
        return Option.getOrThrow(yield* (yield* VisitRepository).findById(visit.tenantId, visit.id))
      }).pipe(Effect.provide(PersistenceMemory([visit]))),
    )

    expect(moved).toMatchObject({
      status: 'AWAITING_PAYMENT',
      statusChangedAt: '2026-01-01T05:00:00.000Z',
      version: 2,
    })
  })
})
