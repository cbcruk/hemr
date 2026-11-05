import type { Coverage } from '../../../shared/coverage.ts'

/** 산정특례 등록번호 앞 두 자리가 뜻하는 등록 구분입니다. */
export type RegistrationCategory =
  | 'CANCER'
  | 'RARE_INTRACTABLE'
  | 'TUBERCULOSIS'
  | 'SEVERE_BURN'
  | 'ULTRA_RARE'
  | 'UNSPECIFIED_RARE'
  | 'CHROMOSOMAL_ABNORMALITY'
  | 'SEVERE_DEMENTIA'
  | 'RARE'
  | 'LATENT_TUBERCULOSIS'
  | 'SEVERE_INTRACTABLE'

/** 진료의 산정특례 명세서 특정내역입니다. 현행 `MT002`(특정기호)와 `MT014`(등록번호)입니다. */
export interface SpecialCaseClaim {
  coverage: Coverage
  /** 희귀난치 의료비 지원 진료면 특정기호를 검사하지 않습니다. */
  rareDiseaseSupport: boolean
  specificCode: string | null
  registrationNumber: string | null
}

/** `rare-diseases` 참조데이터의 행입니다. 진료일 기준 버전에서 조회합니다 (결정 1). */
export interface RareDiseaseRow {
  specificCode: string
  /** 쉼표로 나눈 KCD 코드나 범위(`E70-E72`)입니다. */
  linkedDiagnoses: string
  diseaseName: string
}

/** 자격조회에서 읽은 산정특례 등록 하나입니다. */
export interface SpecialCaseRegistration {
  specificCode: string
  registrationNumber: string
}

/**
 * 특정기호 위반 사유입니다.
 *
 * - `SPECIFIC_CODE_MISSING`: 특정기호가 없습니다
 * - `SPECIFIC_CODE_INVALID`: 특정기호가 `V`+3자가 아닙니다 (결정 3)
 * - `NOT_IN_REFERENCE`: 특정기호가 기준자료에 없어 상병 일치를 판정할 수 없습니다 (결정 4)
 * - `LINKED_DIAGNOSIS_MISMATCH`: 진료 상병이 특정기호의 연계상병에 하나도 맞지 않습니다 (결정 1)
 */
export type SpecialCaseMismatchReason =
  'SPECIFIC_CODE_MISSING' | 'SPECIFIC_CODE_INVALID' | 'NOT_IN_REFERENCE' | 'LINKED_DIAGNOSIS_MISMATCH'

export interface SpecialCaseMismatch {
  code: 'SPECIAL_CASE_CODE_MISMATCH'
  reason: SpecialCaseMismatchReason
}

const CATEGORY_BY_PREFIX: Readonly<Record<string, RegistrationCategory>> = {
  '01': 'CANCER',
  '05': 'RARE_INTRACTABLE',
  '07': 'TUBERCULOSIS',
  '08': 'TUBERCULOSIS',
  '09': 'SEVERE_BURN',
  '11': 'ULTRA_RARE',
  '13': 'UNSPECIFIED_RARE',
  '14': 'CHROMOSOMAL_ABNORMALITY',
  '15': 'SEVERE_DEMENTIA',
  '21': 'RARE',
  '22': 'LATENT_TUBERCULOSIS',
  '23': 'SEVERE_INTRACTABLE',
}

/**
 * 특정기호를 적어야 하는 등록 구분입니다. 극희귀(11)·상세불명희귀(13)는 고시를 확인할 때까지 빼 둡니다 (결정 2, 임시).
 * 참조데이터로 옮기면 목록만 고칩니다.
 */
const SPECIFIC_CODE_CATEGORIES: ReadonlySet<RegistrationCategory> = new Set([
  'RARE_INTRACTABLE',
  'CHROMOSOMAL_ABNORMALITY',
  'RARE',
  'SEVERE_INTRACTABLE',
])

const SPECIFIC_CODE_FORMAT = /^V[0-9A-Z]{3}$/

/** 등록번호 앞 두 자리의 등록 구분입니다. 모르는 값이면 `null`입니다. */
export function registrationCategory(prefix: string): RegistrationCategory | null {
  return prefix.length === 2 ? (CATEGORY_BY_PREFIX[prefix] ?? null) : null
}

/** 특정기호를 정규화합니다. 앞뒤 공백을 지우고 대문자로 바꿉니다. 빈 값은 `null`입니다 (결정 3). */
export function normalizeSpecificCode(value: string | null): string | null {
  const normalized = (value ?? '').trim().toUpperCase()
  return normalized === '' ? null : normalized
}

/**
 * 특정기호를 적어야 하는 진료인지입니다 (결정 2·3).
 *
 * 건보 진료이고, 희귀난치 의료비 지원 진료가 아니고, 등록번호 구분이 05·14·21·23이면 참입니다. 현행처럼 특정기호가
 * `V`로 시작하는지는 보지 않습니다.
 */
export function requiresSpecificCode(claim: SpecialCaseClaim): boolean {
  if (claim.coverage !== 'NHIS' || claim.rareDiseaseSupport) return false
  const category = registrationCategory((claim.registrationNumber ?? '').trim().slice(0, 2))
  return category !== null && SPECIFIC_CODE_CATEGORIES.has(category)
}

/**
 * 특정기호 위반입니다. 저장은 warning, 완료는 422로 막습니다 (결정 1·6).
 *
 * 1. 특정기호를 적어야 하는 진료가 아니면 위반이 없습니다
 * 2. 특정기호가 없거나 `V`+3자가 아니면 위반입니다 (결정 3)
 * 3. 특정기호가 기준자료에 없으면 일치를 판정할 수 없어 위반입니다 (결정 4)
 * 4. 진료 상병이 그 특정기호의 연계상병에 하나도 맞지 않으면 위반입니다 (결정 1)
 */
export function specialCaseMismatch(input: {
  claim: SpecialCaseClaim
  diagnosisCodes: readonly string[]
  rareDiseases: readonly RareDiseaseRow[]
}): SpecialCaseMismatch | null {
  const reason = formatMismatch(input.claim) ?? diagnosisMismatch(input)
  return reason === null ? null : { code: 'SPECIAL_CASE_CODE_MISMATCH', reason }
}

/** 상병 일치를 빼고 특정기호 형식만 검사합니다. 현행 저장·완료 검사(`validateSpecialCaseCode`) 자리를 대신합니다. */
export function formatMismatch(claim: SpecialCaseClaim): SpecialCaseMismatchReason | null {
  if (!requiresSpecificCode(claim)) return null
  const code = normalizeSpecificCode(claim.specificCode)
  if (code === null) return 'SPECIFIC_CODE_MISSING'
  return SPECIFIC_CODE_FORMAT.test(code) ? null : 'SPECIFIC_CODE_INVALID'
}

function diagnosisMismatch(input: {
  claim: SpecialCaseClaim
  diagnosisCodes: readonly string[]
  rareDiseases: readonly RareDiseaseRow[]
}): SpecialCaseMismatchReason | null {
  if (!requiresSpecificCode(input.claim)) return null
  const code = normalizeSpecificCode(input.claim.specificCode)
  const rows = input.rareDiseases.filter((row) => row.specificCode.trim().toUpperCase() === code)
  if (rows.length === 0) return 'NOT_IN_REFERENCE'
  const matched = rows.some((row) =>
    input.diagnosisCodes.some((diagnosis) => matchesLinkedDiagnoses(row.linkedDiagnoses, diagnosis)),
  )
  return matched ? null : 'LINKED_DIAGNOSIS_MISMATCH'
}

/**
 * 상병코드가 연계상병에 맞는지입니다. 점을 지우고 대문자로 맞춘 뒤 비교합니다.
 *
 * - 단일 코드 `G12.2`: 같거나 그 코드로 시작하면(`G1221`) 맞습니다. 더 짧은 `G12`는 맞지 않습니다
 * - 범위 `E70-E72`: 상병코드 앞 3자가 사전순으로 `시작 ≤ 코드 ≤ 끝`이면 맞습니다. 첫 글자가 다른 범위
 *   (`Q00-R99`)도 같은 규칙입니다 (결정 5). 3자보다 짧은 상병코드는 맞지 않습니다
 */
export function matchesLinkedDiagnoses(linked: string, diagnosisCode: string): boolean {
  const code = normalizeDiagnosis(diagnosisCode)
  return linked
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .some((entry) => {
      const parts = entry.split('-').map(normalizeDiagnosis)
      if (parts.length === 1) return parts[0] !== '' && code.startsWith(parts[0]!)
      // `-B`, `A-`, `A-B-C`처럼 양 끝이 둘이 아닌 범위는 잘못된 기준자료라 맞지 않는 것으로 봅니다
      const [start, end] = parts
      if (parts.length !== 2 || start === '' || end === '' || code.length < 3) return false
      const head = code.slice(0, 3)
      return start!.slice(0, 3) <= head && head <= end!.slice(0, 3)
    })
}

/**
 * 진료 화면에 보일 특정기호 후보입니다.
 *
 * 1. 고를 특정기호는 진료에 적은 특정기호(`V`로 시작할 때)와 자격조회 등록의 특정기호입니다. 등록번호를 적었으면
 *    그 번호의 등록만 봅니다. 자격조회 등록은 건보 진료에서만 씁니다
 * 2. 후보 행은 자격조회 등록의 특정기호 행을 먼저 쓰고, 없으면 고를 특정기호 전체의 행을 씁니다. 기준자료에 없는
 *    특정기호면 후보가 없습니다. 현행처럼 희귀질환 전체로 대체하지 않습니다 (결정 4)
 * 3. 그 중 상병코드가 연계상병에 맞는 행의 특정기호를 중복 없이 돌려줍니다
 */
export function specialCaseCandidates(input: {
  claim: SpecialCaseClaim
  registrations: readonly SpecialCaseRegistration[]
  rareDiseases: readonly RareDiseaseRow[]
  diagnosisCode: string
}): { activeSpecificCode: string | null; candidates: { specificCode: string; diseaseName: string }[] } {
  const { claim } = input
  const written = normalizeSpecificCode(claim.specificCode)
  const activeSpecificCode = written !== null && written.startsWith('V') && written.length >= 2 ? written : null
  const registrationNumber = (claim.registrationNumber ?? '').trim()
  const registered = (claim.coverage === 'NHIS' ? input.registrations : [])
    .filter(
      (registration) => registrationNumber === '' || registration.registrationNumber.trim() === registrationNumber,
    )
    .map((registration) => registration.specificCode.trim().toUpperCase())
    .filter((code) => code.startsWith('V'))

  const rowsOf = (codes: readonly string[]) =>
    input.rareDiseases.filter((row) => codes.includes(row.specificCode.trim().toUpperCase()))
  const registeredRows = rowsOf(registered)
  const pool =
    registeredRows.length > 0
      ? registeredRows
      : rowsOf([...(activeSpecificCode ? [activeSpecificCode] : []), ...registered])

  const candidates: { specificCode: string; diseaseName: string }[] = []
  for (const row of pool) {
    if (!matchesLinkedDiagnoses(row.linkedDiagnoses, input.diagnosisCode)) continue
    if (candidates.some((candidate) => candidate.specificCode === row.specificCode)) continue
    candidates.push({ specificCode: row.specificCode, diseaseName: row.diseaseName })
  }
  return { activeSpecificCode, candidates }
}

function normalizeDiagnosis(code: string): string {
  return code.replaceAll('.', '').trim().toUpperCase()
}
