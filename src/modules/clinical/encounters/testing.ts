import { Result } from 'effect'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import { testVisit } from '../../front-desk/visits/testing.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import type { NewIds } from './encounter-changes.ts'
import { draftEncounter } from './encounter-draft.ts'
import type { Encounter } from './encounter.ts'

/** 판정 함수 테스트의 시각과 행위자입니다. */
export const TEST_CONTEXT: DecisionContext = {
  at: '2026-11-13T01:00:00.000Z',
  today: '2026-11-13',
  tenantId: TEST_TENANT.id,
  userId: 'usr_01JBQ000000000000000000001' as Id<'user'>,
}

/** 시험용 새 상병·처방 라인 ID입니다. 부를 때마다 끝자리가 1씩 커집니다. */
export function testIds(): NewIds {
  let diagnosis = 0
  let line = 0
  return {
    diagnosis: () => `dx_01JBQ${'0'.repeat(19)}9${++diagnosis}` as Id<'diagnosis'>,
    prescriptionLine: () => `pl_01JBQ${'0'.repeat(19)}9${++line}` as Id<'prescriptionLine'>,
  }
}

/** 시험용 내원입니다. 오늘 진료 중인 내원이고, `overrides`로 바꿉니다. */
export const testVisitOf = (overrides: Partial<Visit> = {}) =>
  testVisit({
    date: TEST_CONTEXT.today,
    status: 'IN_TREATMENT',
    encounterId: 'enc_01JBQ000000000000000000001' as Id<'encounter'>,
    ...overrides,
  })

/** 시험용 초안 진료입니다. `testVisitOf()`에서 접수한 빈 진료이고, `overrides`로 바꿉니다. */
export function testDraft(overrides: Partial<Encounter> = {}): Encounter {
  const visit = testVisitOf()
  const { encounter } = draftEncounter(
    { ...visit, encounterId: visit.encounterId as Id<'encounter'> },
    eventContext(TEST_CONTEXT),
  )
  return { ...encounter, ...overrides }
}

/** 주상병 하나입니다. */
export const PRIMARY = {
  id: 'dx_01JBQ000000000000000000001' as Id<'diagnosis'>,
  code: 'U23.4',
  kind: 'PRIMARY',
} as const

/** 시험용 완료한 진료입니다. 주상병 하나로 1판을 남겼고, `overrides`로 바꿉니다. */
export const testCompleted = (overrides: Partial<Encounter> = {}): Encounter =>
  testDraft({
    diagnoses: [PRIMARY],
    status: 'COMPLETED',
    completedAt: '2026-11-13T00:30:00.000Z',
    revision: 1,
    version: 3,
    ...overrides,
  })

/** 판정이 받아들였으면 결과를, 거부했으면 테스트를 실패시킵니다. */
export function success<A, E>(result: Result.Result<A, E>): A {
  if (Result.isFailure(result)) throw new Error(`거부되었습니다: ${String(result.failure)}`)
  return result.success
}

/** 판정이 거부했으면 그 오류를, 받아들였으면 테스트를 실패시킵니다. */
export function failure<A, E>(result: Result.Result<A, E>): E {
  if (Result.isSuccess(result)) throw new Error('거부되지 않았습니다')
  return result.failure
}
