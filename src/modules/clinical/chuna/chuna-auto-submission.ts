import type { Coverage } from '../../../shared/coverage.ts'
import type { ServiceAt } from '../fees/consultation-fee-code.ts'
import { CHUNA_CATEGORY, DEFAULT_CHUNA_LIMITS, chunaUsageSummary } from './chuna-annual-limit.ts'
import type { HiraChunaUsage } from './chuna-annual-limit.ts'

/**
 * 심평원 사전 제출 상태입니다. `docs/design/claims.md`의 `HiraPreSubmission.status`입니다. 청구 모듈이 생기면
 * 그쪽으로 옮깁니다.
 */
export type HiraPreSubmissionStatus =
  'QUEUED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCEL_REQUESTED' | 'CANCELED' | 'FAILED' | 'OUTCOME_UNKNOWN'

/** 자동 제출을 판정할 처방 줄입니다. */
export interface ChunaSubmissionLine {
  lineId: string
  feeCode: string | null
  category: string
  /** 심평원 승인 상태가 `APPROVED`인지입니다. */
  approved: boolean
  /** 시술 의사입니다. 없으면 기본 추나 시술자로 제출합니다. */
  performerId: string | null
}

/** 진료 완료 때 자동 제출 작업을 만들지 판정하는 입력입니다. */
export interface ChunaAutoSubmissionInput {
  coverage: Coverage
  serviceAt: ServiceAt
  /** 진료 정책 `encounter-policy.autoSubmitChuna`입니다. */
  autoSubmit: boolean
  lines: readonly ChunaSubmissionLine[]
  /** 저장된 심평원 추나 사용량입니다. 없으면 한도·당일 이력을 모르는 것으로 보고 진행합니다(현행과 같음). */
  hiraUsage: HiraChunaUsage | null
  /** 같은 환자·같은 진료일의 추나 사전 제출 상태입니다. 현재 진료의 제출도 포함합니다. */
  sameDaySubmissions: readonly HiraPreSubmissionStatus[]
  limits?: Readonly<Partial<Record<Coverage, number>>>
}

/**
 * 자동 제출을 건너뛴 사유입니다.
 *
 * - `POLICY_OFF`: 진료 정책이 꺼져 있습니다
 * - `COVERAGE_NOT_SUBMITTABLE`: 심평원에 추나를 내지 않는 보험구분(산재·일반)입니다
 * - `ANNUAL_LIMIT`: 건보·의료급여 한도를 다 썼습니다. 이때는 chuna-annual-limit의 `CHUNA_ANNUAL_LIMIT`가 완료를
 *   막으므로 여기까지 오지 않습니다. 판정 순서가 바뀌어도 한도를 넘는 제출을 만들지 않게 한 번 더 확인합니다
 * - `SAME_DAY`: 진료일에 삭제되지 않은 심평원 이력이나 취소되지 않은 제출이 있습니다 (결정 1)
 * - `NO_UNAPPROVED_LINE`: 승인되지 않은 추나 줄이 없거나 그 줄에 수가코드가 없습니다
 */
export type ChunaAutoSubmissionSkip =
  'POLICY_OFF' | 'COVERAGE_NOT_SUBMITTABLE' | 'ANNUAL_LIMIT' | 'SAME_DAY' | 'NO_UNAPPROVED_LINE'

/** 제출 작업을 만들 줄이거나, 만들지 않은 사유입니다. */
export type ChunaAutoSubmissionDecision =
  { action: 'QUEUE'; lineId: string } | { action: 'SKIP'; reason: ChunaAutoSubmissionSkip }

/** 심평원에 추나를 사전 제출하는 보험구분입니다. 보험자구분코드 `4`·`5`·`8`에 대응합니다. */
const 추나사전제출보험구분: ReadonlySet<Coverage> = new Set(['NHIS', 'MEDICAL_AID', 'AUTO_INSURANCE'])

/**
 * 진료 완료 트랜잭션에서 추나 제출 작업(`QUEUED`)을 만들지 판정합니다 (결정 1·2·3·5).
 *
 * 큐 조건은 정책·한도·같은 날 이력뿐입니다. 페이로드 검증과 심평원 호출은 트랜잭션 밖에서 하고, 실패는 제출
 * 작업의 상태로 남깁니다. 어떤 결과도 완료를 막지 않습니다. 에이전트가 지금 연결돼 있지 않아도 작업은 만들고,
 * 에이전트가 연결되면 처리합니다.
 *
 * 1. 정책이 꺼져 있거나 심평원에 내지 않는 보험구분이면 건너뜁니다
 * 2. 건보·의료급여가 한도를 다 썼으면 건너뜁니다. 자보는 사례별 인정이라 계속합니다 (결정 5)
 * 3. 진료일에 삭제되지 않은 심평원 이력이나 `CANCELED`가 아닌 제출이 있으면 건너뜁니다 (결정 1)
 * 4. 승인되지 않은 첫 추나 줄을 제출합니다. 진료 하나에 제출은 1건입니다 (결정 2)
 */
export function chunaAutoSubmission(input: ChunaAutoSubmissionInput): ChunaAutoSubmissionDecision {
  if (!input.autoSubmit) return { action: 'SKIP', reason: 'POLICY_OFF' }
  if (!추나사전제출보험구분.has(input.coverage)) return { action: 'SKIP', reason: 'COVERAGE_NOT_SUBMITTABLE' }
  if (input.hiraUsage !== null) {
    const 한도 = (input.limits ?? DEFAULT_CHUNA_LIMITS)[input.coverage] ?? Number.POSITIVE_INFINITY
    const 사용량 = chunaUsageSummary(input.hiraUsage, { serviceAt: input.serviceAt, limit: 한도 })
    const 소진시건너뜀 = input.coverage === 'NHIS' || input.coverage === 'MEDICAL_AID'
    if (소진시건너뜀 && input.hiraUsage.complete && 사용량.exhausted) return { action: 'SKIP', reason: 'ANNUAL_LIMIT' }
    if (사용량.sameDay) return { action: 'SKIP', reason: 'SAME_DAY' }
  }
  if (input.sameDaySubmissions.some((상태) => 상태 !== 'CANCELED')) return { action: 'SKIP', reason: 'SAME_DAY' }
  const 제출할줄 = input.lines.find((줄) => 줄.category === CHUNA_CATEGORY && !줄.approved)
  if (제출할줄 === undefined || !제출할줄.feeCode) return { action: 'SKIP', reason: 'NO_UNAPPROVED_LINE' }
  return { action: 'QUEUE', lineId: 제출할줄.lineId }
}

/** 자격조회 결과 중 제출에 쓰는 값입니다. */
export interface ChunaEligibility {
  /** 자격조회의 `자격여부`입니다. `1`–`6` 건강보험, `7`·`8` 의료급여입니다. */
  qualification: string | null
  disabled: boolean
  /** 차상위 대상자 21자(특정기호 4, 시작일 8, 종료일 8, 구분 1)입니다. */
  nearPoverty: string | null
  /** 희귀난치 의료비 지원 대상자 20자(특정기호 4, 승인일 8, 종료일 8)입니다. */
  rareDiseaseSupportTarget: string | null
}

/** 추나를 시행한 의사와 그 면허번호입니다. 승인 상태를 맞출 때 줄의 시술 의사로 씁니다. */
export interface ChunaPerformer {
  doctorId: string
  licenseNumber: string
}

/** 페이로드를 만들 진료 정보입니다. */
export interface ChunaPayloadInput {
  clinicCode: string | null
  coverage: Coverage
  serviceAt: ServiceAt
  patient: { name: string; rrnFront: string; rrnBack: string }
  diagnosisCodes: readonly string[]
  /** 큐 판정이 고른 줄입니다. 수가코드가 있는 줄만 큐에 들어옵니다. */
  line: ChunaSubmissionLine & { feeCode: string }
  defaultPerformerId: string | null
  doctors: readonly { doctorId: string; licenseNumber: string | null }[]
  /** 건보·의료급여 자격조회입니다. 없으면 `null`입니다. */
  eligibility: ChunaEligibility | null
  accidentNumber: string | null
  /** 희귀난치 의료비 지원 진료인지입니다. */
  rareDiseaseSupport: boolean
}

/** 심평원 추나 제출 내용입니다. 전문 형식(`yyyyMMdd`, 필드 이름)은 에이전트가 맞춥니다. */
export interface ChunaSubmissionPayload {
  clinicCode: string
  patientName: string
  rrn: string
  licenseNumber: string
  diagnosisCodes: string[]
  serviceDate: string
  /** 보험자구분코드입니다. 건강보험 `4`, 의료급여 `5`, 자보 `8`입니다. */
  insurerType: '4' | '5' | '8'
  /** 의료급여종별코드입니다. 자격여부 `7` → `1`, `8` → `2`입니다. */
  medicalAidType?: '1' | '2'
  feeCodes: string[]
  accidentNumber?: string
  /** 공상구분코드입니다. 건보·의료급여에만 붙입니다. */
  benefitCategory?: 'C' | 'E' | 'F' | 'H' | '0'
}

/**
 * 페이로드 검증 실패 사유입니다. 제출 작업을 `FAILED`로 남깁니다 (결정 3).
 *
 * 순서는 현행과 같아 여러 개가 빠지면 처음 것을 줍니다. 진료 시각은 진료에 늘 있어 검사하지 않습니다.
 */
export type ChunaPayloadFailure =
  | 'DIAGNOSIS_MISSING'
  | 'PATIENT_INFO_MISSING'
  | 'LICENSE_MISSING'
  | 'CLINIC_CODE_MISSING'
  | 'COVERAGE_NOT_SUBMITTABLE'
  | 'ACCIDENT_NUMBER_MISSING'
  | 'ELIGIBILITY_MISSING'

export type ChunaPayloadResult =
  { payload: ChunaSubmissionPayload; performer: ChunaPerformer } | { failure: ChunaPayloadFailure }

/** 추나 제출 페이로드를 만듭니다. 시술자는 줄의 시술 의사, 없으면 기본 추나 시술자입니다. */
export function chunaSubmissionPayload(input: ChunaPayloadInput): ChunaPayloadResult {
  const 시술자Id = input.line.performerId || input.defaultPerformerId
  const 면허번호 = input.doctors.find((의사) => 의사.doctorId === 시술자Id)?.licenseNumber
  const 환자 = input.patient
  if (input.diagnosisCodes.length === 0) return { failure: 'DIAGNOSIS_MISSING' }
  if (!환자.name || !환자.rrnFront || !환자.rrnBack) return { failure: 'PATIENT_INFO_MISSING' }
  if (!시술자Id || !면허번호) return { failure: 'LICENSE_MISSING' }
  if (!input.clinicCode) return { failure: 'CLINIC_CODE_MISSING' }
  const 보험자구분코드 = 보험자구분판정(input.coverage, input.eligibility?.qualification ?? null)
  if (보험자구분코드 === null) return { failure: 'COVERAGE_NOT_SUBMITTABLE' }

  const payload: ChunaSubmissionPayload = {
    clinicCode: input.clinicCode,
    patientName: 환자.name,
    rrn: 환자.rrnFront + 환자.rrnBack,
    licenseNumber: 면허번호,
    diagnosisCodes: [...input.diagnosisCodes],
    serviceDate: input.serviceAt.date,
    insurerType: 보험자구분코드,
    feeCodes: [input.line.feeCode],
  }
  const 자격여부 = input.eligibility?.qualification
  if (자격여부 === '7') payload.medicalAidType = '1'
  if (자격여부 === '8') payload.medicalAidType = '2'
  if (input.coverage === 'AUTO_INSURANCE') {
    if (!input.accidentNumber) return { failure: 'ACCIDENT_NUMBER_MISSING' }
    payload.accidentNumber = input.accidentNumber
  } else {
    if (input.eligibility === null) return { failure: 'ELIGIBILITY_MISSING' }
    payload.benefitCategory = 공상구분코드(input.eligibility, input.serviceAt.date, input.rareDiseaseSupport)
  }
  return { payload, performer: { doctorId: 시술자Id, licenseNumber: 면허번호 } }
}

function 보험자구분판정(보험구분: Coverage, 자격여부: string | null): '4' | '5' | '8' | null {
  if (보험구분 === 'AUTO_INSURANCE') return '8'
  if (!추나사전제출보험구분.has(보험구분)) return null
  if (!자격여부) return 보험구분 === 'NHIS' ? '4' : 보험구분 === 'MEDICAL_AID' ? '5' : null
  if (/^[1-6]$/.test(자격여부)) return '4'
  if (자격여부 === '7' || 자격여부 === '8') return '5'
  return null
}

/**
 * 공상구분코드입니다. 차상위가 진료일에 유효하면 `C`, `E`(장애면 `F`)이고, 아니면 희귀난치 지원 대상이 유효하고
 * 희귀난치 지원 진료일 때 `H`, 그 밖은 `0`입니다. 종료일이 비어 있으면 끝이 없는 것으로 봅니다.
 */
function 공상구분코드(자격: ChunaEligibility, 진료일: string, 희귀난치지원진료: boolean) {
  const compact = 진료일.replaceAll('-', '')
  const 진료일유효 = (start: string, end: string) =>
    start.trim() !== '' && start <= compact && (end.trim() === '' || compact <= end)
  const 차상위대상자 = 자격.nearPoverty ?? ''
  if (진료일유효(차상위대상자.slice(4, 12), 차상위대상자.slice(12, 20))) {
    if (차상위대상자.startsWith('C')) return 'C'
    if (차상위대상자.startsWith('E')) return 자격.disabled ? 'F' : 'E'
  }
  const 희귀난치대상자 = 자격.rareDiseaseSupportTarget ?? ''
  if (!희귀난치대상자.startsWith('H') || !희귀난치지원진료) return '0'
  return 진료일유효(희귀난치대상자.slice(4, 12), 희귀난치대상자.slice(12, 20)) ? 'H' : '0'
}

/** 에이전트 처리 결과로 바뀌는 제출 작업 상태입니다. */
export type ChunaSubmissionOutcome =
  | { status: 'APPROVED'; performer: ChunaPerformer | null }
  | { status: 'FAILED'; reason: ChunaPayloadFailure | 'DIAGNOSIS_MISMATCH' | 'PRECHECK_UNAVAILABLE' }
  | { status: 'REJECTED'; reason: string }
  | { status: 'OUTCOME_UNKNOWN'; reason: string }

/** 심평원에서 찾은 같은 날 기제출 건입니다. */
export interface ExistingChunaSubmission {
  /** 쉼표로 나눈 상병기호입니다. */
  diagnosisCodes: string
  licenseNumber: string | null
}

/**
 * 기제출 건이 있을 때의 결과입니다 (결정 4). 기제출 상병이 모두 현재 상병에 있으면 그 건의 면허번호로 시술자를
 * 찾아 승인 상태로 맞추고(못 찾으면 시술자 없이), 아니면 `DIAGNOSIS_MISMATCH`로 남겨 삭제 후 재제출을 안내합니다.
 * 기제출 상병이 비어 있으면 같은 진료인지 확인할 수 없어 `DIAGNOSIS_MISMATCH`입니다.
 */
export function existingSubmissionOutcome(
  existing: ExistingChunaSubmission,
  diagnosisCodes: readonly string[],
  doctors: ChunaPayloadInput['doctors'],
): ChunaSubmissionOutcome {
  const 현재상병집합 = new Set(diagnosisCodes)
  const 기제출상병 = existing.diagnosisCodes
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
  if (기제출상병.length === 0 || !기제출상병.every((code) => 현재상병집합.has(code)))
    return { status: 'FAILED', reason: 'DIAGNOSIS_MISMATCH' }
  const 시술자 = doctors.find((의사) => 의사.licenseNumber !== null && 의사.licenseNumber === existing.licenseNumber)
  return {
    status: 'APPROVED',
    performer: 시술자?.licenseNumber ? { doctorId: 시술자.doctorId, licenseNumber: 시술자.licenseNumber } : null,
  }
}

/**
 * 제출 전 기제출 확인 결과입니다. 기제출 건이 없으면(`null`) 새로 제출하므로 `null`을 돌려줍니다. 조회가
 * 실패하면(`UNAVAILABLE`) 중복 제출을 피하려고 제출하지 않고 `PRECHECK_UNAVAILABLE`로 남깁니다 (결정 3).
 */
export function precheckOutcome(
  existing: ExistingChunaSubmission | 'UNAVAILABLE' | null,
  diagnosisCodes: readonly string[],
  doctors: ChunaPayloadInput['doctors'],
): ChunaSubmissionOutcome | null {
  if (existing === null) return null
  if (existing === 'UNAVAILABLE') return { status: 'FAILED', reason: 'PRECHECK_UNAVAILABLE' }
  return existingSubmissionOutcome(existing, diagnosisCodes, doctors)
}

/** 심평원 추나 목록의 한 행입니다. 기제출 건을 찾는 데 씁니다. */
export interface HiraChunaSubmissionRow {
  serviceDate: string
  patientName: string
  birthDate: string
  sex: number
  insurerType: string
  accidentNumber: string
  deleted: boolean
  serialNumber: number
}

export type HiraChunaSubmissionKey = Omit<HiraChunaSubmissionRow, 'deleted' | 'serialNumber'>

/**
 * 같은 날 기제출 건을 찾습니다. 삭제되지 않은 행 중 키가 모두 같은 행의 가장 큰 일련번호입니다. 없으면 보험자구분을
 * 뺀 키로 찾되, 후보의 보험자구분이 한 종류일 때만 고릅니다. 이름은 공백을 빼고 비교합니다.
 */
export function matchHiraChunaSubmission(
  rows: readonly HiraChunaSubmissionRow[],
  key: HiraChunaSubmissionKey,
): HiraChunaSubmissionRow | null {
  const name = (value: string) => value.replace(/\s/g, '')
  const 보험자구분뺀일치 = rows.filter(
    (row) =>
      !row.deleted &&
      row.serviceDate === key.serviceDate &&
      name(row.patientName) === name(key.patientName) &&
      row.birthDate === key.birthDate &&
      row.sex === key.sex &&
      row.accidentNumber === key.accidentNumber,
  )
  const 키모두일치 = 보험자구분뺀일치.filter((row) => row.insurerType === key.insurerType)
  const 보험자구분한종류 = new Set(보험자구분뺀일치.map((row) => row.insurerType)).size === 1
  const 후보 = 키모두일치.length > 0 ? 키모두일치 : 보험자구분한종류 ? 보험자구분뺀일치 : []
  return 후보.reduce<HiraChunaSubmissionRow | null>(
    (best, row) => (best === null || row.serialNumber > best.serialNumber ? row : best),
    null,
  )
}

/**
 * 에이전트가 심평원에 제출한 결과입니다. `REJECTED`는 심평원이 거부한 것이고 `TRANSPORT`는 응답을 받지 못한
 * 것(통신 오류·시간 초과)입니다.
 */
export type ChunaCreateResult = { ok: true } | { ok: false; kind: 'REJECTED' | 'TRANSPORT'; reason: string }

/**
 * 새로 제출한 결과입니다 (결정 3). 성공하면 페이로드의 시술자로 승인 상태를 맞추고, 거부면 `REJECTED`입니다.
 * 응답을 받지 못했으면 심평원이 받았을 수도 있어 `OUTCOME_UNKNOWN`으로 두고 대조(`RECONCILE`)로 정합니다.
 */
export function submissionResultOutcome(result: ChunaCreateResult, performer: ChunaPerformer): ChunaSubmissionOutcome {
  if (result.ok) return { status: 'APPROVED', performer }
  return { status: result.kind === 'REJECTED' ? 'REJECTED' : 'OUTCOME_UNKNOWN', reason: result.reason }
}
