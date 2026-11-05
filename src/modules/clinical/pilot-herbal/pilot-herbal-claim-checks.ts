import type { Coverage } from '../../../shared/coverage.ts'
import { daysBetween } from '../../../shared/time/calendar.ts'
import type { ServiceAt } from '../fees/consultation-fee-code.ts'
import { DEFAULT_PILOT_HERBAL_DISEASES } from './pilot-herbal-diagnosis-limit.ts'
import { isHiraApproved } from './pilot-herbal-approval.ts'
import type { HiraApprovalStatus } from './pilot-herbal-approval.ts'
import { PILOT_HERBAL_CATEGORY } from './pilot-herbal-categories.ts'

const HERBAL_MEDICINE_CATEGORY = '34001001'
const HERBAL_DISPENSING_CATEGORY = '34002001'

/** 첩약 시범사업과 함께 청구할 수 없는 수가코드 접두어입니다. 변증기술료·양도락·맥전도·경락기능검사입니다. */
const NOT_BILLABLE_PREFIXES = ['40400', '20010', '20020', '20030']
const DEEP_PATTERN_FEE = '90401'
/** 조제·탕전료(자체·공동이용 탕전 10일분·5일분)입니다 (결정 4). */
const DISPENSING_DECOCTION_FEES: ReadonlySet<string> = new Set(['90411', '90412', '90421', '90422'])
/** 다른 진료에 심층변증방제기술료가 있으면 경고하는 날짜 간격(양방향)입니다. */
const DEEP_PATTERN_INTERVAL_DAYS = 10

const COMMON_PRESCRIPTION = '00'
const CEREBROVASCULAR_SEQUELAE = '03'
const FUNCTIONAL_DYSPEPSIA = '06'
/** 기능성소화불량에 처방할 수 없는 처방명입니다. */
const DYSPEPSIA_EXCLUDED_PRESCRIPTIONS: ReadonlySet<string> = new Set(['마황정천탕', '보폐원탕'])

/**
 * 질환별로 인정되는 상병 접두어입니다. 뇌혈관질환후유증(`03`)은 제1부상병, 나머지는 주상병에 있어야 합니다.
 * 공통처방(`00`)은 없습니다. `herbal-applicable-diseases` 참조데이터로 옮길 값입니다.
 */
export const DEFAULT_PILOT_HERBAL_DIAGNOSES: ReadonlyMap<string, readonly string[]> = new Map([
  ['01', ['N944', 'N945', 'N946']],
  ['02', ['G510']],
  ['03', ['I69', 'U234']],
  ['04', ['J30']],
  ['05', ['M51']],
  ['06', ['K30']],
])

/** 청구 검사를 받는 처방 줄입니다. */
export interface PilotHerbalClaimLine {
  lineId: string
  category: string
  feeCode: string | null
  name: string
  /** 심평원 승인 상태입니다. C0005는 완료 검사와 같은 `isHiraApproved`로 판정합니다 (pilot-herbal-approval-required 결정 3·5). */
  hiraApproval: { status: HiraApprovalStatus } | null
  /** 첩약 줄의 특정내역입니다. 없으면 `null`입니다. */
  herbalDetails: { targetDisease: string | null; checklistSubmitted: boolean | null } | null
}

/** 같은 환자의 다른 진료입니다. 호출하는 쪽이 진료일 ±10일 범위를 조회합니다 (결정 3). */
export interface PilotHerbalOtherEncounter {
  encounterId: string
  serviceAt: ServiceAt
  lines: readonly Pick<PilotHerbalClaimLine, 'category' | 'feeCode'>[]
}

export interface Rrn {
  front: string
  back: string
}

/** 청구 검사 입력입니다. */
export interface PilotHerbalClaimInput {
  encounterId: string
  coverage: Coverage
  /** 내원의 `benefitFlags.pilotHerbal`입니다. 없으면 검사하지 않습니다 (결정 11). */
  pilotHerbal: { diseaseCode: string } | null
  serviceAt: ServiceAt
  lines: readonly PilotHerbalClaimLine[]
  /** 진료 상병을 입력 순서대로 둡니다. 첫 부상병이 제1부상병입니다 (결정 8). 코드의 점은 무시합니다(`U23.4` = `U234`). */
  diagnoses: readonly { code: string; kind: 'PRIMARY' | 'SECONDARY' }[]
  others: readonly PilotHerbalOtherEncounter[]
  patientRrn: Rrn | null
  /** 진료 담당 의사의 주민번호입니다 (결정 6). 모르면 `null`입니다. */
  doctorRrn: Rrn | null
  /** 질환 코드 → 질환명입니다. C0002가 특정내역의 대상 질환과 비교합니다. */
  diseases?: ReadonlyMap<string, string>
  diseaseDiagnoses?: ReadonlyMap<string, readonly string[]>
}

export type PilotHerbalClaimCode =
  'C0001' | 'C0002' | 'C0003' | 'C0004' | 'C0005' | 'C0006' | 'C0007' | 'C0008' | 'C0009' | 'C0010' | 'C0011' | 'C0012'

/**
 * 청구 검사 경고입니다. 진료 저장 응답 `warnings`와 청구 명세서 `issues[]`에 같은 값을 넣습니다 (결정 1).
 * 진료 전체에 걸린 검사(C0008·C0009·C0012)는 `lineIds`가 비어 있습니다.
 */
export interface PilotHerbalClaimIssue {
  code: PilotHerbalClaimCode
  lineIds: string[]
  /** 자동 수정 정정 제안이 지울 줄입니다. C0003은 한방보험약과 딸린 한방조제료를 함께 지웁니다 (결정 9). */
  fixRemovesLineIds?: string[]
}

/**
 * 첩약 시범사업 청구 검사 C0001–C0012입니다 (결정 1–12). 모두 warning이고 진료를 막지 않습니다.
 *
 * 건보·의료급여이고 첩약 시범사업 내원일 때만 검사합니다. 검사마다 독립적으로 판정하므로 한 검사의 입력이 빠져도
 * 다른 검사 결과는 남습니다 (결정 7). 결과는 코드 순서입니다.
 */
export function pilotHerbalClaimIssues(input: PilotHerbalClaimInput): PilotHerbalClaimIssue[] {
  const covered = input.coverage === 'NHIS' || input.coverage === 'MEDICAL_AID'
  if (!covered || input.pilotHerbal === null) return []
  const context = { ...input, diseaseCode: input.pilotHerbal.diseaseCode }
  return CHECKS.flatMap((check) => check(context) ?? [])
}

type CheckContext = PilotHerbalClaimInput & { diseaseCode: string }
type Check = (context: CheckContext) => PilotHerbalClaimIssue | null

const ids = (lines: readonly PilotHerbalClaimLine[]) => lines.map((line) => line.lineId)
const issue = (code: PilotHerbalClaimCode, lineIds: string[]): PilotHerbalClaimIssue | null =>
  lineIds.length > 0 ? { code, lineIds } : null
const encounterIssue = (code: PilotHerbalClaimCode, failed: boolean): PilotHerbalClaimIssue | null =>
  failed ? { code, lineIds: [] } : null
const herbalLines = <L extends Pick<PilotHerbalClaimLine, 'category'>>(lines: readonly L[]) =>
  lines.filter((line) => line.category === PILOT_HERBAL_CATEGORY)
const deepPatternLines = <L extends Pick<PilotHerbalClaimLine, 'feeCode'>>(lines: readonly L[]) =>
  lines.filter((line) => line.feeCode?.startsWith(DEEP_PATTERN_FEE) === true)

/** 질환에 인정되는 상병 접두어입니다. 표에 없으면 `undefined`이고, 빈 접두어는 버립니다. */
function diagnosisPrefixes(context: CheckContext): string[] | undefined {
  const prefixes = (context.diseaseDiagnoses ?? DEFAULT_PILOT_HERBAL_DIAGNOSES).get(context.diseaseCode)
  return prefixes?.map(normalizeDiagnosis).filter((prefix) => prefix !== '')
}

/** 상병코드를 점 없는 대문자로 맞춥니다. 서버 상병은 `U23.4`, 접두어 표는 `U234` 꼴입니다. */
const normalizeDiagnosis = (code: string) => code.replaceAll('.', '').trim().toUpperCase()

/** 상병이 접두어 중 하나로 시작하는지입니다. 상병이 없으면 거짓입니다. */
const diagnosisMatches = (code: string | undefined, prefixes: readonly string[]) =>
  code !== undefined && prefixes.some((prefix) => normalizeDiagnosis(code).startsWith(prefix))

/** 주민번호 앞·뒷자리가 모두 있을 때만 비교합니다. 하나라도 비면 모르는 것으로 봅니다. */
const completeRrn = (rrn: Rrn | null): rrn is Rrn => rrn !== null && rrn.front !== '' && rrn.back !== ''

/** 다른 진료 중 조건에 맞는 진료가 진료일과 `maxDays` 이내(양방향)에 있는지입니다 (결정 2·3·12). */
function nearbyEncounter(
  context: CheckContext,
  maxDays: number,
  matches: (other: PilotHerbalOtherEncounter) => boolean,
): boolean {
  return context.others.some(
    (other) =>
      other.encounterId !== context.encounterId &&
      matches(other) &&
      Math.abs(daysBetween(other.serviceAt.date, context.serviceAt.date)) <= maxDays,
  )
}

const CHECKS: readonly Check[] = [
  // C0001: 변증기술료·양도락·맥전도·경락기능검사는 함께 청구할 수 없습니다
  ({ lines }) =>
    issue(
      'C0001',
      ids(lines.filter((line) => NOT_BILLABLE_PREFIXES.some((prefix) => line.feeCode?.startsWith(prefix)))),
    ),
  // C0002: 첩약 특정내역의 대상 질환이 내원 질환과 다르면 인정되지 않는 처방입니다. 특정내역이 없으면 통과입니다
  ({ lines, diseaseCode, diseases }) => {
    const name = (diseases ?? DEFAULT_PILOT_HERBAL_DISEASES).get(diseaseCode)
    if (diseaseCode === COMMON_PRESCRIPTION || name === undefined) return null
    const target = (line: PilotHerbalClaimLine) => line.herbalDetails?.targetDisease
    return issue('C0002', ids(herbalLines(lines).filter((line) => !!target(line) && target(line) !== name)))
  },
  // C0003: 한방보험약과 같은 날 함께 청구할 수 없습니다. 정정 제안은 딸린 한방조제료도 지웁니다
  ({ lines }) => {
    const medicines = lines.filter((line) => line.category === HERBAL_MEDICINE_CATEGORY)
    if (medicines.length === 0) return null
    const dispensing = lines.filter((line) => line.category === HERBAL_DISPENSING_CATEGORY)
    return { code: 'C0003', lineIds: ids(medicines), fixRemovesLineIds: ids([...medicines, ...dispensing]) }
  },
  // C0004: 심층변증방제기술료는 10일당 1회입니다
  (context) => {
    const current = deepPatternLines(context.lines)
    if (current.length === 0) return null
    const repeated = nearbyEncounter(context, DEEP_PATTERN_INTERVAL_DAYS, (o) => deepPatternLines(o.lines).length > 0)
    return repeated ? issue('C0004', ids(current)) : null
  },
  // C0005: 심평원에 제출(승인)되지 않은 첩약 줄입니다 (결정 10)
  ({ lines }) => issue('C0005', ids(herbalLines(lines).filter((line) => !isHiraApproved(line)))),
  // C0006: 첩약 특정내역이 있는데 체크리스트를 제출하지 않았습니다. 제출 여부를 모르면 미제출로 봅니다
  ({ lines }) =>
    issue(
      'C0006',
      ids(
        herbalLines(lines).filter(
          (line) => line.herbalDetails !== null && line.herbalDetails.checklistSubmitted !== true,
        ),
      ),
    ),
  // C0007: 심층변증방제기술료와 조제·탕전료에는 가산을 붙일 수 없습니다. 가산은 6자리 이상 코드입니다 (결정 4·5)
  ({ lines }) => {
    const deep = deepPatternLines(lines)
    const decoction = lines.filter(
      (line) => line.feeCode !== null && DISPENSING_DECOCTION_FEES.has(line.feeCode.slice(0, 5)),
    )
    if (deep.length === 0 || decoction.length === 0) return null
    return issue('C0007', ids([...deep, ...decoction].filter((line) => (line.feeCode ?? '').length > 5)))
  },
  // C0008: 질환에 인정되는 상병이 주상병이어야 합니다. 공통처방과 뇌혈관질환후유증은 건너뜁니다 (결정 7)
  (context) => {
    const prefixes = diagnosisPrefixes(context)
    if (context.diseaseCode === CEREBROVASCULAR_SEQUELAE || prefixes === undefined) return null
    const primary = context.diagnoses.find((diagnosis) => diagnosis.kind === 'PRIMARY')
    return encounterIssue('C0008', !diagnosisMatches(primary?.code, prefixes))
  },
  // C0009: 뇌혈관질환후유증은 제1부상병이 인정 상병이어야 합니다 (결정 8)
  (context) => {
    const prefixes = diagnosisPrefixes(context)
    if (context.diseaseCode !== CEREBROVASCULAR_SEQUELAE || prefixes === undefined) return null
    const firstSecondary = context.diagnoses.find((diagnosis) => diagnosis.kind === 'SECONDARY')
    return encounterIssue('C0009', !diagnosisMatches(firstSecondary?.code, prefixes))
  },
  // C0010: 같은 진료일에 다른 진료의 첩약이 있으면 기준 처방을 2개 청구하게 됩니다 (결정 2)
  (context) => {
    const current = herbalLines(context.lines)
    if (current.length === 0) return null
    return nearbyEncounter(context, 0, (other) => herbalLines(other.lines).length > 0)
      ? issue('C0010', ids(current))
      : null
  },
  // C0011: 기능성소화불량에는 마황정천탕·보폐원탕을 처방할 수 없습니다. 원인은 그 처방 줄입니다
  ({ diseaseCode, lines }) =>
    diseaseCode === FUNCTIONAL_DYSPEPSIA
      ? issue('C0011', ids(lines.filter((line) => DYSPEPSIA_EXCLUDED_PRESCRIPTIONS.has(line.name))))
      : null,
  // C0012: 진료 의사 본인에게는 처방할 수 없습니다 (결정 6)
  ({ patientRrn, doctorRrn }) =>
    encounterIssue(
      'C0012',
      completeRrn(patientRrn) &&
        completeRrn(doctorRrn) &&
        patientRrn.front === doctorRrn.front &&
        patientRrn.back === doctorRrn.back,
    ),
]
