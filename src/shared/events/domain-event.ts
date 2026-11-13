import { DateTime } from 'effect'
import { newId } from '../ids/ids.ts'
import type { Id } from '../ids/ids.types.ts'
import { clinicDate } from '../time/clinic-date.ts'

/**
 * 도메인 이벤트 envelope입니다 (`docs/design/events.md`). 필드 이름은 CloudEvents를 따릅니다.
 *
 * `seq`는 outbox에 쓸 때 저장소가 붙이므로 여기에는 없습니다. 병원 업무의 이벤트는 테넌트와 행위자를 채웁니다.
 * 테스트용 이벤트처럼 둘 다 없는 이벤트도 있어 선택 필드로 둡니다.
 */
export interface DomainEvent {
  id: Id<'event'>
  /** 예: `visit.status_changed` */
  type: string
  /** 발생 시각입니다. ISO 8601입니다. */
  time: string
  /** 주 리소스 ID입니다. */
  subject: string
  tenantId?: string
  actor?: { kind: 'USER' | 'SYSTEM'; id: string; deviceId?: string }
  /** 화면이 바로 반응하는 데 필요한 최소 필드입니다. 민감 정보는 넣지 않습니다. */
  data: Record<string, unknown>
}

/** outbox에 기록된 이벤트입니다. `seq`는 기록 순서대로 오르는 번호입니다. */
export interface RecordedEvent extends DomainEvent {
  seq: number
}

/** 새 이벤트를 만듭니다. ID는 발생 시각의 ULID입니다. */
export function domainEvent(
  type: string,
  subject: string,
  time: string,
  data: Record<string, unknown>,
  context: Pick<DomainEvent, 'tenantId' | 'actor'> = {},
): DomainEvent {
  return { id: newId('event', Date.parse(time)), type, time, subject, ...context, data }
}

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
