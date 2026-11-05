import { newId } from '../ids/ids.ts'
import type { Id } from '../ids/ids.types.ts'

/**
 * 도메인 이벤트 envelope입니다 (`docs/design/events.md`). 필드 이름은 CloudEvents를 따릅니다.
 *
 * `seq`는 outbox에 쓸 때 저장소가 붙이므로 여기에는 없습니다. 테넌트와 행위자는 인증이 생기기 전까지 비어 있을 수
 * 있습니다.
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
export function domainEvent(type: string, subject: string, time: string, data: Record<string, unknown>): DomainEvent {
  return { id: newId('event', Date.parse(time)), type, time, subject, data }
}
