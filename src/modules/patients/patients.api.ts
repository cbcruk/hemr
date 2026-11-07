import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
import { Page, PageCursor, PageLimit } from '../../shared/http/paging.ts'
import { ValidationFailed, VersionMismatch } from '../../shared/problem/problem.ts'
import { Access } from '../identity/auth/access.ts'
import { Authorization } from '../identity/auth/authorization.ts'
import {
  Address,
  ChartNumberInput,
  ChartNumberTaken,
  Consent,
  ConsentLockedByPatient,
  ConsentPurpose,
  ConsentStatus,
  Contact,
  DuplicateRrn,
  LocalDate,
  Patient,
  PatientId,
  PatientNotFound,
  RrnInput,
  Sex,
} from './patient.ts'

const params = { id: PatientId }
/** 공백만 있는 값은 받지 않습니다. */
const Text = (max: number) => Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(max))
const withEtag = HttpApiSchema.WithHeaders(Patient, {
  etag: Schema.String.annotate({ description: '환자의 버전입니다. 다음 수정의 `If-Match`에 씁니다.' }),
})

const RegisterPayload = Schema.Struct({
  name: Text(50).annotate({ description: '이름입니다. 50자까지이고 공백만은 안 됩니다.' }),
  // 보내지 않으면 서버가 숫자 차트번호 중 가장 큰 값 + 1로 채번합니다(설명은 본문에 있습니다)
  chartNumber: Schema.optionalKey(ChartNumberInput),
  rrn: Schema.optionalKey(RrnInput),
  birthDate: Schema.optionalKey(LocalDate),
  isLunarBirthday: Schema.optionalKey(Schema.Boolean),
  sex: Schema.optionalKey(Sex),
  contacts: Schema.optionalKey(Schema.Array(Contact).check(Schema.isMaxLength(10))),
  addresses: Schema.optionalKey(Schema.Array(Address).check(Schema.isMaxLength(5))),
  notes: Schema.optionalKey(Text(2000)),
}).annotate({
  description:
    '환자 등록 본문입니다. 차트번호를 보내지 않으면 서버가 숫자 차트번호 중 가장 큰 값 + 1로 채번합니다. 생년월일·성별이 비어 있으면 주민등록번호에서 채우고, 함께 보내면 맞아야 합니다(400 `VALIDATION_FAILED`의 `RRN_MISMATCH`). 대표 연락처·주소는 하나까지입니다(`MULTIPLE_PRIMARY`).',
})

const UpdatePayload = Schema.Struct({
  name: Schema.optionalKey(Text(50).annotate({ description: '이름입니다. 50자까지이고 공백만은 안 됩니다.' })),
  chartNumber: Schema.optionalKey(ChartNumberInput),
  rrn: Schema.optionalKey(Schema.NullOr(RrnInput)),
  birthDate: Schema.optionalKey(Schema.NullOr(LocalDate)),
  isLunarBirthday: Schema.optionalKey(Schema.Boolean),
  sex: Schema.optionalKey(Schema.NullOr(Sex)),
  contacts: Schema.optionalKey(Schema.Array(Contact).check(Schema.isMaxLength(10))),
  addresses: Schema.optionalKey(Schema.Array(Address).check(Schema.isMaxLength(5))),
  notes: Schema.optionalKey(Schema.NullOr(Text(2000))),
}).annotate({
  description:
    '환자 수정 본문입니다. 보낸 필드만 바꾸고 `null`은 지웁니다. 연락처·주소는 통째로 바꿉니다. 주민등록번호로 생년월일을 채우지 않고 맞는지만 보므로, 번호를 바꾸면 생년월일·성별도 함께 보냅니다. 바뀐 것이 없으면 버전을 올리지 않습니다.',
})

/**
 * 환자 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 조회는 `patient:read`, 등록과 다음 차트번호는 `patient:create`, 수정과 동의 기록은 `patient:update`, 주민등록번호
 * 원문은 `patient.rrn:read`가 필요합니다.
 */
export class PatientsApi extends HttpApiGroup.make('patients')
  .add(
    HttpApiEndpoint.get('search', '/patients', {
      query: {
        q: Schema.optionalKey(
          Schema.String.check(Schema.isMaxLength(50)).annotate({
            description:
              '검색어입니다. 숫자(`-` 허용)면 차트번호 앞부분이나 전화번호 뒷자리, 초성만이면 이름 초성, 그 밖이면 이름 일부(대소문자 무시)나 차트번호 앞부분으로 찾습니다.',
          }),
        ),
        limit: Schema.optionalKey(PageLimit),
        cursor: Schema.optionalKey(PageCursor(500)),
      },
      success: Page(Patient, '찾은 환자의 한 쪽입니다.'),
      error: ValidationFailed,
    })
      .annotate(Access, Access.requires('patient:read'))
      .annotate(OpenApi.Summary, '환자 검색 (이름 순서)'),
    HttpApiEndpoint.post('register', '/patients', {
      payload: RegisterPayload,
      success: withEtag.pipe(HttpApiSchema.status(201)),
      error: [ChartNumberTaken, DuplicateRrn, ValidationFailed],
    })
      .annotate(Access, Access.requires('patient:create'))
      .annotate(OpenApi.Summary, '환자 등록'),
    HttpApiEndpoint.get('nextChartNumber', '/patients::next-chart-number', {
      success: Schema.Struct({ chartNumber: Schema.String }).annotate({
        description: '지금 등록하면 받을 차트번호입니다.',
      }),
    })
      .annotate(Access, Access.requires('patient:create'))
      .annotate(OpenApi.Summary, '다음 차트번호')
      .annotate(OpenApi.Description, '지금 등록하면 받을 차트번호입니다. 보여 주기만 하고 잡아 두지 않습니다.'),
    HttpApiEndpoint.get('get', '/patients/:id', { params, success: withEtag, error: PatientNotFound })
      .annotate(Access, Access.requires('patient:read'))
      .annotate(OpenApi.Summary, '환자 조회'),
    HttpApiEndpoint.patch('update', '/patients/:id', {
      params,
      headers: {
        'if-match': Schema.optionalKey(
          Schema.String.annotate({
            description:
              '다른 사람의 변경을 덮어쓰지 않도록 보내는 버전입니다. 예: `"7"`. 선택이고, 없으면 서버가 다시 읽어 적용합니다.',
          }),
        ),
      },
      payload: UpdatePayload,
      success: withEtag,
      error: [PatientNotFound, VersionMismatch, ChartNumberTaken, DuplicateRrn, ValidationFailed],
    })
      .annotate(Access, Access.requires('patient:update'))
      .annotate(OpenApi.Summary, '환자 수정'),
    HttpApiEndpoint.get('revealRrn', '/patients/:id/rrn', {
      params,
      headers: {
        'x-access-reason': Schema.String.check(Schema.isMaxLength(600)).annotate({
          description:
            '열람 사유입니다. 필수이고 열람 기록에 남습니다. 헤더는 ASCII만 실을 수 있어 한글 사유는 `encodeURIComponent`로 보내고, 풀고 나서 1–200자여야 합니다.',
        }),
      },
      success: Schema.Struct({
        rrn: Schema.NullOr(Schema.String).annotate({
          description: '주민등록번호 원문입니다. 형식은 `900101-1234567`이고, 없으면 `null`입니다.',
        }),
      }).annotate({ description: '주민등록번호 원문입니다. 열람 기록을 남긴 뒤에 줍니다.' }),
      error: [PatientNotFound, ValidationFailed],
    })
      .annotate(Access, Access.requires('patient.rrn:read'))
      .annotate(OpenApi.Summary, '주민등록번호 원문 조회')
      .annotate(
        OpenApi.Description,
        '원문을 주기 전에 열람 기록(사유 포함)을 남깁니다. 기록이 실패하면 원문도 주지 않습니다.',
      ),
    HttpApiEndpoint.get('consents', '/patients/:id/consents', {
      params,
      success: Schema.Array(Consent).annotate({
        description: '목적마다 마지막 동의 기록입니다. 기록이 없는 목적은 빠집니다.',
      }),
      error: PatientNotFound,
    })
      .annotate(Access, Access.requires('patient:read'))
      .annotate(OpenApi.Summary, '현재 동의 (목적별 마지막 기록)'),
    HttpApiEndpoint.get('consentHistory', '/patients/:id/consents/history', {
      params,
      success: Schema.Array(Consent).annotate({ description: '환자의 동의 기록 전부입니다.' }),
      error: PatientNotFound,
    })
      .annotate(Access, Access.requires('patient:read'))
      .annotate(OpenApi.Summary, '동의 이력 (기록 순서)'),
    HttpApiEndpoint.post('recordConsent', '/patients/:id/consents', {
      params,
      payload: Schema.Struct({
        purpose: ConsentPurpose,
        status: ConsentStatus,
        evidenceDocumentId: Schema.optionalKey(Text(64)),
      }),
      success: Consent.pipe(HttpApiSchema.status(201)),
      error: [PatientNotFound, ConsentLockedByPatient],
    })
      .annotate(Access, Access.requires('patient:update'))
      .annotate(OpenApi.Summary, '동의 기록')
      .annotate(
        OpenApi.Description,
        '동의 기록을 하나 더합니다. 덮어쓰지 않고, 출처는 늘 `DESK`입니다. 환자가 080으로 거부한 목적은 환자 본인이 다시 동의하기 전까지 `GRANTED`로 기록할 수 없습니다(409).',
      ),
  )
  .annotate(
    OpenApi.Description,
    '환자 등록·검색·조회·수정과 동의입니다. 주민등록번호는 응답에 가린 값(`rrnMasked`)만 싣고, 원문은 사유와 함께 따로 조회합니다. 다른 병원의 환자는 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
