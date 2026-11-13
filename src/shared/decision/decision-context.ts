import { DateTime } from 'effect'
import type { DomainEvent } from '../events/domain-event.ts'
import type { Id } from '../ids/ids.types.ts'
import { clinicDate } from '../time/clinic-date.ts'

/** 판정 함수(`decide…`)가 받는 시각과 행위자입니다 (docs/design/domain-model.md). */
export interface DecisionContext {
  /** 커맨드를 처리하는 시각입니다. ISO 8601입니다. */
  at: string
  /** 병원 시간대의 오늘입니다. 진료일·수납일과 지난 날짜 판정에 씁니다. */
  today: string
  tenantId: Id<'tenant'>
  userId: Id<'user'>
}

/** 판정 함수가 이벤트에 적는 병원과 행위자입니다. */
export function eventContext(context: DecisionContext): Required<Pick<DomainEvent, 'tenantId' | 'actor'>> {
  return { tenantId: context.tenantId, actor: { kind: 'USER', id: context.userId } }
}

/** 커맨드를 처리하는 사용자와 지금 시각으로 판정 문맥을 만듭니다. */
export function decisionContext(
  access: { tenantId: Id<'tenant'>; userId: Id<'user'> },
  now: DateTime.Utc,
): DecisionContext {
  return {
    at: DateTime.formatIso(now),
    today: clinicDate(DateTime.toEpochMillis(now)),
    tenantId: access.tenantId,
    userId: access.userId,
  }
}
