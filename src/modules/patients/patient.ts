import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../shared/ids/ids.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { problemType } from '../../shared/problem/problem.ts'
import { TenantId, UserId } from '../identity/identity.ts'
import { normalizeRrn } from './rrn.ts'

export const PatientId = Schema.String.annotate({ description: '환자 ID입니다. 예: `pat_01J...`' }).pipe(
  Schema.refine((value): value is Id<'patient'> => isId('patient', value)),
)

export const ChartNumber = Schema.String.check(Schema.isPattern(/^[0-9A-Za-z-]{1,20}$/)).annotate({
  description: '차트번호입니다. 병원 안에서 유일하고 영문·숫자·`-` 20자까지입니다. 예: `1024`',
})

// 자동 채번은 15자리까지 세어, 큰 수동 번호 하나 때문에 채번이 막히지 않습니다. 직접 만든 검사 뒤의 설명은 문서에서
// 빠지므로 앞에 답니다
export const ChartNumberInput = Schema.String.annotate({
  description: '직원이 입력하는 차트번호입니다. 영문·숫자·`-` 20자까지이고, 숫자로만 된 번호는 12자리까지입니다.',
}).check(
  Schema.isPattern(/^[0-9A-Za-z-]{1,20}$/),
  Schema.makeFilter((value: string) => !/^\d{13,}$/.test(value), { title: 'numeric chart number up to 12 digits' }),
)

export const LocalDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)).annotate({
  description: '날짜입니다. 형식은 `YYYY-MM-DD`입니다.',
})

// 끝자리 검증식은 2020년 10월부터 맞지 않아 보지 않습니다
export const RrnInput = Schema.String.annotate({
  description: '주민등록번호입니다. `900101-1234567` 또는 하이픈 없는 13자리이고, 생년월일이 실제 날짜여야 합니다.',
}).pipe(Schema.refine((value): value is string => normalizeRrn(value) !== null))

export const Sex = Schema.Literals(['MALE', 'FEMALE']).annotate({
  identifier: 'Sex',
  description: '성별입니다. 남(`MALE`), 여(`FEMALE`)입니다.',
})

export const Contact = Schema.Struct({
  kind: Schema.Literals(['MOBILE', 'HOME', 'GUARDIAN']).annotate({
    description: '연락처 종류입니다. 휴대전화(`MOBILE`), 집 전화(`HOME`), 보호자(`GUARDIAN`)입니다.',
  }),
  number: Schema.String.check(Schema.isPattern(/^[0-9-]{8,20}$/)).annotate({
    description: '전화번호입니다. 숫자와 `-`만 8–20자 받습니다. 예: `010-1234-5678`',
  }),
  isPrimary: Schema.Boolean.annotate({ description: '대표 연락처입니다. 하나까지입니다.' }),
}).annotate({ identifier: 'Contact', description: '환자 연락처입니다.' })
export type Contact = typeof Contact.Type

export const Address = Schema.Struct({
  roadAddress: Schema.NonEmptyString.check(Schema.isMaxLength(200)),
  detail: Schema.NullOr(Schema.String.check(Schema.isMaxLength(200))),
  zipCode: Schema.NullOr(Schema.String.check(Schema.isPattern(/^\d{5}$/))),
  isPrimary: Schema.Boolean.annotate({ description: '대표 주소입니다. 하나까지입니다.' }),
}).annotate({ identifier: 'Address', description: '환자 주소입니다. 우편번호는 5자리입니다.' })
export type Address = typeof Address.Type

export const ConsentPurpose = Schema.String.check(
  Schema.isPattern(
    /^(MARKETING_SMS|MARKETING_KAKAO|MARKETING_NIGHT|INFO_MESSAGE|THIRD_PARTY_PROVISION|TREATMENT_CONSENT:[A-Za-z0-9_-]{1,64})$/,
  ),
).annotate({
  description:
    '동의 목적입니다. 광고성 문자(`MARKETING_SMS`)·카카오(`MARKETING_KAKAO`), 야간(21:00–08:00) 광고성 정보(`MARKETING_NIGHT`), 알림성 정보(`INFO_MESSAGE`), 제3자 제공(`THIRD_PARTY_PROVISION`), 시술 동의서(`TREATMENT_CONSENT:{templateId}`, 서식마다 따로, `templateId`는 영문·숫자·`_`·`-` 1–64자)입니다.',
})
export const ConsentStatus = Schema.Literals(['GRANTED', 'DENIED', 'UNDECIDED', 'WITHDRAWN']).annotate({
  identifier: 'ConsentStatus',
  description: '동의(`GRANTED`), 거부(`DENIED`), 미정(`UNDECIDED`), 철회(`WITHDRAWN`)입니다.',
})
export const ConsentSource = Schema.Literals(['DESK', 'TABLET', 'PATIENT_080', 'IMPORT']).annotate({
  identifier: 'ConsentSource',
  description:
    '기록 출처입니다. 데스크(`DESK`), 환자 태블릿(`TABLET`), 080 수신거부(`PATIENT_080`, 병원이 되돌릴 수 없음), 이관(`IMPORT`)입니다. 직원이 기록하면 늘 `DESK`입니다.',
})

export const Consent = Schema.Struct({
  purpose: ConsentPurpose,
  status: ConsentStatus,
  source: ConsentSource,
  decidedAt: Schema.String,
  decidedBy: Schema.NullOr(UserId).annotate({
    description: '기록한 직원입니다. 080처럼 외부에서 온 기록은 `null`입니다.',
  }),
  evidenceDocumentId: Schema.NullOr(Schema.String).annotate({ description: '서명한 동의서 같은 근거 문서입니다.' }),
}).annotate({
  identifier: 'Consent',
  title: '동의',
  description: '목적별 동의 기록 하나입니다. 기록은 덮어쓰지 않고 쌓으며, 목적별 마지막 기록이 현재 상태입니다.',
})
export type Consent = typeof Consent.Type

// 가족·등급·내원경로·사진은 쓰는 기능이 생길 때 더합니다
export const Patient = Schema.Struct({
  id: PatientId,
  // 다른 병원의 환자는 없는 것과 같이 다룹니다(404)
  tenantId: TenantId,
  chartNumber: ChartNumber,
  name: Schema.String,
  rrnMasked: Schema.NullOr(Schema.String).annotate({
    description: '가린 주민등록번호입니다. 예: `900101-1******`. 원문은 `GET /patients/{id}/rrn`으로만 줍니다.',
  }),
  birthDate: Schema.NullOr(LocalDate).annotate({
    description: '생년월일입니다. 등록 때 비어 있으면 주민등록번호에서 채웁니다.',
  }),
  isLunarBirthday: Schema.Boolean.annotate({ description: '음력 생일이면 `true`입니다.' }),
  sex: Schema.NullOr(Sex),
  contacts: Schema.Array(Contact),
  addresses: Schema.Array(Address),
  notes: Schema.NullOr(Schema.String).annotate({ description: '메모입니다.' }),
  consents: Schema.Array(Consent).annotate({
    description: '목적별 현재 동의입니다. 목적 이름 순서입니다. 이력은 `GET /patients/{id}/consents/history`입니다.',
  }),
  // 내원 완료 때 서버가 정합니다(아직 없음)
  firstVisitDate: Schema.NullOr(LocalDate).annotate({
    description: '최초내원일입니다. 지금은 늘 `null`입니다.',
  }),
  status: Schema.Literal('ACTIVE'),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int.annotate({
    description:
      '낙관적 잠금 버전입니다. 응답의 `ETag`로 주고 `If-Match`로 받습니다. 동의 기록은 버전을 올리지 않습니다.',
  }),
}).annotate({
  identifier: 'Patient',
  title: '환자',
  description:
    '환자입니다. 지금은 신원·차트번호·연락처·주소·메모·동의를 둡니다. 전체 리소스는 `docs/design/patients.md`를 보세요.',
})
export type Patient = typeof Patient.Type

/**
 * 저장하는 환자입니다. 응답에 없는 주민등록번호 암호문과 중복 확인 색인을 가지며, 동의는 따로 저장합니다.
 */
export interface PatientRecord extends Omit<Patient, 'consents'> {
  rrnSealed: string | null
  rrnIndex: string | null
}

export class PatientNotFound extends HttpApiError.Problem<PatientNotFound>()(
  'PatientNotFound',
  { type: problemType('PATIENT_NOT_FOUND'), status: 404, title: 'Patient not found' },
  { code: Schema.tag('PATIENT_NOT_FOUND') },
  { description: '`PATIENT_NOT_FOUND`: 요청한 ID의 환자가 없습니다. 다른 병원의 환자도 없는 것과 같습니다.' },
) {}

export class ChartNumberTaken extends HttpApiError.Problem<ChartNumberTaken>()(
  'ChartNumberTaken',
  { type: problemType('CHART_NUMBER_TAKEN'), status: 409, title: 'Chart number is already taken' },
  { code: Schema.tag('CHART_NUMBER_TAKEN'), chartNumber: Schema.String },
  { description: '`CHART_NUMBER_TAKEN`: 병원에 이미 있는 차트번호입니다.' },
) {}

export class DuplicateRrn extends HttpApiError.Problem<DuplicateRrn>()(
  'DuplicateRrn',
  { type: problemType('PATIENT_DUPLICATE_RRN'), status: 409, title: 'A patient with this RRN already exists' },
  { code: Schema.tag('PATIENT_DUPLICATE_RRN'), patientId: PatientId },
  {
    description:
      '`PATIENT_DUPLICATE_RRN`: 병원에 같은 주민등록번호의 환자가 이미 있습니다. `patientId`는 그 환자입니다.',
  },
) {}

export class ConsentLockedByPatient extends HttpApiError.Problem<ConsentLockedByPatient>()(
  'ConsentLockedByPatient',
  { type: problemType('CONSENT_LOCKED_BY_PATIENT'), status: 409, title: 'Patient opted out through 080' },
  { code: Schema.tag('CONSENT_LOCKED_BY_PATIENT'), purpose: Schema.String },
  {
    description:
      '`CONSENT_LOCKED_BY_PATIENT`: 환자가 080으로 거부한 목적입니다. 병원이 동의로 되돌릴 수 없고, 환자가 다시 동의해야 합니다.',
  },
) {}

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'

/** 이름의 초성입니다. 한글 음절은 초성으로, 나머지 글자는 소문자로 둡니다. 예: `김원장` → `ㄱㅇㅈ` */
export function initialsOf(name: string): string {
  return [...name]
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00
      return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : char.toLowerCase()
    })
    .join('')
}

/** 검색에 쓰는 전화번호입니다. 번호마다 숫자만 남겨 앞뒤를 공백으로 감쌉니다. 예: ` 01012345678 0212345678 ` */
export function phoneDigitsOf(contacts: ReadonlyArray<Contact>): string {
  return ` ${contacts.map((each) => each.number.replaceAll('-', '')).join(' ')} `
}

/**
 * 검색어의 종류입니다 (patients.md 엔드포인트 `q`).
 *
 * - 숫자(`-` 포함 가능): 차트번호 앞부분이나 전화번호 뒷자리
 * - 초성만: 이름 초성
 * - 그 밖: 이름 일부나 차트번호 앞부분
 */
export type PatientQuery =
  /** `raw`는 입력 그대로(하이픈 포함)입니다. `2024-001` 같은 차트번호를 찾습니다. */
  | { kind: 'DIGITS'; digits: string; raw: string }
  | { kind: 'INITIALS'; initials: string }
  | { kind: 'TEXT'; text: string }

export function classifyQuery(q: string): PatientQuery | null {
  const trimmed = q.trim()
  if (trimmed === '') return null
  const digits = trimmed.replaceAll('-', '')
  if (/^\d+$/.test(digits)) return { kind: 'DIGITS', digits, raw: trimmed }
  if (/^[ㄱ-ㅎ]+$/.test(trimmed)) return { kind: 'INITIALS', initials: trimmed }
  return { kind: 'TEXT', text: trimmed.toLowerCase() }
}

/** 메모리 저장소의 검색 판정입니다. SQL 저장소는 같은 규칙을 조건문으로 씁니다. */
export function matchesQuery(record: PatientRecord, query: PatientQuery): boolean {
  switch (query.kind) {
    case 'DIGITS':
      return (
        record.chartNumber.startsWith(query.digits) ||
        record.chartNumber.startsWith(query.raw) ||
        phoneDigitsOf(record.contacts).includes(`${query.digits} `)
      )
    case 'INITIALS':
      return initialsOf(record.name).includes(query.initials)
    case 'TEXT':
      return record.name.toLowerCase().includes(query.text) || record.chartNumber.toLowerCase().startsWith(query.text)
  }
}
