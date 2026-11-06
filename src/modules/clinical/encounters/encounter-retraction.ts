import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Encounter } from './encounter.ts'

/**
 * 철회(`ENTERED_IN_ERROR`)한 진료와 `encounter.retracted` 이벤트입니다. 진료의 `:retract`와 내원 연쇄 취소가 같이
 * 씁니다. 기록은 지우지 않고 사유와 함께 남깁니다. 고정 여부는 호출하는 쪽이 판단합니다.
 */
export function retractEncounter(
  encounter: Encounter,
  input: { reason: string; at: string; by: Id<'user'>; tenantId: Id<'tenant'> },
): { encounter: Encounter; event: DomainEvent } {
  const next: Encounter = {
    ...encounter,
    status: 'ENTERED_IN_ERROR',
    retraction: { reason: input.reason, retractedAt: input.at, retractedBy: input.by },
    updatedAt: input.at,
    version: encounter.version + 1,
  }
  const event = domainEvent(
    'encounter.retracted',
    next.id,
    input.at,
    { encounterId: next.id, visitId: next.visitId, patientId: next.patientId, from: encounter.status },
    { tenantId: input.tenantId, actor: { kind: 'USER', id: input.by } },
  )
  return { encounter: next, event }
}
