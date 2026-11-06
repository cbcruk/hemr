import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import type { Encounter } from './encounter.ts'

/**
 * 접수한 내원의 빈 진료와 `encounter.created` 이벤트입니다. 접수(`Visits.checkIn`)가 내원과 같은 트랜잭션에서
 * 저장합니다. 보험구분·표시는 내원에서 복사하고, 진료 기준 시각은 접수 시각입니다.
 */
export function draftEncounter(
  visit: Visit & { encounterId: Id<'encounter'> },
  context: Required<Pick<DomainEvent, 'tenantId' | 'actor'>>,
): { encounter: Encounter; event: DomainEvent } {
  const encounter: Encounter = {
    id: visit.encounterId,
    tenantId: visit.tenantId,
    patientId: visit.patientId,
    visitId: visit.id,
    doctorId: null,
    encounterType: 'OFFICE',
    coverage: visit.coverage,
    serviceAt: visit.checkedInAt,
    note: { body: '' },
    diagnoses: [],
    prescriptionLines: [],
    benefitFlags: visit.benefitFlags,
    status: 'DRAFT',
    completedAt: null,
    revision: 0,
    locked: false,
    retraction: null,
    createdAt: visit.checkedInAt,
    updatedAt: visit.checkedInAt,
    version: 1,
  }
  const event = domainEvent(
    'encounter.created',
    encounter.id,
    encounter.createdAt,
    { encounterId: encounter.id, visitId: visit.id, patientId: visit.patientId },
    context,
  )
  return { encounter, event }
}

/**
 * 진료에 기록한 내용이 있는지입니다. 내원을 `cascade` 없이 취소할 수 있는지 정할 때 씁니다. 편집기가 비운 본문에 남기는
 * 빈 태그(`<p><br></p>`)와 공백은 내용으로 치지 않고, 그림(`<img>`)은 글자가 없어도 내용입니다. 상병이나 처방 라인이
 * 하나라도 있으면 내용입니다.
 */
export function hasClinicalContent(encounter: Encounter): boolean {
  const body = encounter.note.body
  const text = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text !== '' || /<img\b/i.test(body) || encounter.diagnoses.length > 0 || encounter.prescriptionLines.length > 0
}
