/** 첩약 시범사업 질환 코드의 공통처방입니다. 다른 질환 개수에 세지 않습니다. */
const 공통처방코드 = '00'

/** 질환별 급여 투약일수 초기값입니다. 참조데이터 `regulatory-limits`에 유효기간과 함께 둘 값입니다 (결정 2). */
export const DEFAULT_PILOT_HERBAL_DAY_LIMIT = 20

/** 한 회계연도에 급여로 처방받을 수 있는 질환 수입니다. 공통처방은 세지 않습니다. */
const 질환수한도 = 2

/**
 * `herbal-applicable-diseases` 참조데이터의 초기값입니다. 이름은 문구에 쓰는 공백 없는 질환명입니다 (결정 9).
 * 진료일 기준 버전을 조회하기 전까지 이 표를 씁니다.
 */
export const DEFAULT_PILOT_HERBAL_DISEASES: ReadonlyMap<string, string> = new Map([
  ['00', '공통처방'],
  ['01', '월경통'],
  ['02', '안면신경마비'],
  ['03', '뇌혈관질환후유증'],
  ['04', '알레르기성비염'],
  ['05', '요추추간판탈출증'],
  ['06', '기능성소화불량'],
])

/**
 * 이 기관(`Y`)·다른 기관(`N`)·알 수 없음입니다. 대소문자와 앞뒤 공백을 가리지 않고, 그 밖의 값은 알 수 없음입니다
 * (결정 6).
 */
export type HiraRegistration = 'THIS_CLINIC' | 'OTHER_CLINIC' | 'UNKNOWN'

/** 심평원 첩약 누적 투약 이력의 한 행입니다(`selectPatPcmdList` 목록조회내역). */
export interface PilotHerbalHistoryRow {
  diseaseCode: string
  registration: HiraRegistration
  /** 누적 투약일수입니다. `pilotHerbalHistoryRow`가 숫자가 아닌 값을 0으로 읽습니다. */
  cumulativeDays: number
}

/** 심평원 응답의 원본 행입니다. */
export interface RawPilotHerbalHistoryRow {
  diseaseCode: string
  registration: string | null | undefined
  cumulativeDays: string | number | null | undefined
}

/** 원본 행을 읽습니다. 누적 투약일수가 숫자가 아니거나 음수면 현행처럼 0일입니다. */
export function pilotHerbalHistoryRow(raw: RawPilotHerbalHistoryRow): PilotHerbalHistoryRow {
  const 누적투약일수 = Number(raw.cumulativeDays)
  return {
    diseaseCode: raw.diseaseCode,
    registration: hiraRegistration(raw.registration),
    cumulativeDays: Number.isFinite(누적투약일수) && 누적투약일수 > 0 ? 누적투약일수 : 0,
  }
}

/** 심평원 등록 여부 값을 읽습니다 (결정 6). */
export function hiraRegistration(value: string | null | undefined): HiraRegistration {
  const 등록여부 = (value ?? '').trim().toUpperCase()
  return 등록여부 === 'Y' ? 'THIS_CLINIC' : 등록여부 === 'N' ? 'OTHER_CLINIC' : 'UNKNOWN'
}

/**
 * 선택 질환이 아닌 다른 질환을 이 기관에서 이미 2개 이상 처방받았는지입니다 (결정 1). 공통처방과 0일 행은 세지
 * 않습니다. 참조데이터에 없는 질환 코드도 개수에는 셉니다 (결정 9). 선택 질환이 공통처방이어도 현행 `R0e`처럼
 * 다른 질환이 2개 이상이면 참입니다.
 */
export function hasTwoOtherDiseases(history: readonly PilotHerbalHistoryRow[], diseaseCode: string): boolean {
  const 다른질환이력 = history.filter(
    (row) =>
      row.diseaseCode !== 공통처방코드 &&
      row.diseaseCode !== diseaseCode &&
      row.registration === 'THIS_CLINIC' &&
      row.cumulativeDays > 0,
  )
  return new Set(다른질환이력.map((row) => row.diseaseCode)).size >= 질환수한도
}

/** 선택 질환 이력을 등록 여부별로 합친 값입니다. */
export interface MergedDiseaseHistory {
  /** 이 기관 행이 하나라도 있는지입니다. 있으면 현행처럼 이 기관 이력으로 봅니다 (결정 3 보류). */
  thisClinic: boolean
  /** 이 기관 행이 있으면 모든 행의 최대 누적일수(현행과 같음), 없으면 0입니다. */
  thisClinicDays: number
  /** 이 기관 행이 없을 때 다른 기관 행의 최대 누적일수입니다. 이 기관 행이 있으면 0입니다. */
  otherClinicDays: number
  /** 이 기관 행이 없을 때 등록 여부를 알 수 없는 행의 최대 누적일수입니다. 이 기관 행이 있으면 0입니다. */
  unknownDays: number
}

/** 선택 질환의 이력 행을 합칩니다. 행이 없으면 `null`입니다. */
export function mergeDiseaseHistory(
  history: readonly PilotHerbalHistoryRow[],
  diseaseCode: string,
): MergedDiseaseHistory | null {
  const 선택질환행 = history.filter((row) => row.diseaseCode === diseaseCode)
  if (선택질환행.length === 0) return null
  const 최대누적일수 = (등록여부?: HiraRegistration) =>
    Math.max(
      0,
      ...선택질환행
        .filter((row) => 등록여부 === undefined || row.registration === 등록여부)
        .map((row) => (Number.isFinite(row.cumulativeDays) ? row.cumulativeDays : 0)),
    )
  if (선택질환행.some((row) => row.registration === 'THIS_CLINIC')) {
    return { thisClinic: true, thisClinicDays: 최대누적일수(), otherClinicDays: 0, unknownDays: 0 }
  }
  return {
    thisClinic: false,
    thisClinicDays: 0,
    otherClinicDays: 최대누적일수('OTHER_CLINIC'),
    unknownDays: 최대누적일수('UNKNOWN'),
  }
}

/**
 * 질환 이력 위반입니다.
 *
 * - `TWO_OTHER_DISEASES`: 다른 2개 질환으로 이미 처방받아 처방 불가입니다
 * - `OTHER_CLINIC`: 선택 질환을 다른 기관에서 처방받아 처방 불가입니다
 * - `DAY_LIMIT`: 이 기관 누적이 한도 이상이라 전액본인부담(`U`)입니다. 처방은 됩니다
 */
export interface PilotHerbalDiagnosisLimit {
  code: 'PILOT_HERBAL_DIAGNOSIS_LIMIT'
  reason: 'TWO_OTHER_DISEASES' | 'OTHER_CLINIC' | 'DAY_LIMIT'
  /** 선택 질환의 이름입니다. 질환 코드는 참조데이터로 먼저 검증하므로 늘 있습니다. */
  diseaseName: string
  cumulativeDays: number
  /** 이 판정을 받는 첩약 시범사업 처방 줄입니다. */
  lineIds: string[]
  blocksCompletion: boolean
}

/** 이력을 아직 받지 못했거나(`PILOT_HERBAL_HISTORY_UNKNOWN`, 결정 5) 등록 여부를 알 수 없는 이력이 있다는 경고입니다 (결정 6). */
export interface PilotHerbalHistoryWarning {
  code: 'PILOT_HERBAL_HISTORY_UNKNOWN' | 'PILOT_HERBAL_HISTORY_UNVERIFIED'
  lineIds: string[]
  blocksCompletion: false
}

export type PilotHerbalDiagnosisIssue = PilotHerbalDiagnosisLimit | PilotHerbalHistoryWarning

/** 판정할 첩약 처방의 질환과 그 환자의 이력입니다. */
export interface PilotHerbalDiagnosisInput {
  diseaseCode: string
  /** 첩약 시범사업 처방 줄(카테고리 `35001001`)입니다. 경고가 가리키는 줄입니다. */
  lineIds: readonly string[]
  /** 진료 연도(병원 시간대)의 전체 질환 이력입니다 (결정 4·8). 아직 받지 못했으면 `null`입니다. */
  history: readonly PilotHerbalHistoryRow[] | null
  /** 진료일 기준 `herbal-applicable-diseases`의 질환 코드 → 질환명입니다. */
  diseases?: ReadonlyMap<string, string>
  dayLimit?: number
}

export interface PilotHerbalDiagnosisJudgement {
  /**
   * 질환 이력으로 정한 본인부담률 코드입니다. 일부부담 `G`, 전액부담 `U`이고, 처방 불가이거나 이력을 확인할 수
   * 없으면 `null`이라 자동으로 정하지 않습니다. 의사별 한도(pilot-herbal-doctor-limit)가 이 코드를 `U`로 바꿀 수
   * 있지만, 완료 여부(`accepted`)는 이 판정이 정한 대로 둡니다.
   */
  copayCode: 'G' | 'U' | null
  /** 일부부담 대신 전액부담을 고를 수 있는지입니다. */
  fullPayOptional: boolean
  /** 저장은 늘 통과합니다. 항목마다 `blocksCompletion`으로 완료를 막는지 알립니다. */
  warnings: PilotHerbalDiagnosisIssue[]
  /** 완료해도 되는지입니다. 처방 불가 위반이 있으면 거짓입니다. */
  accepted: boolean
}

export type PilotHerbalDiagnosisResult = PilotHerbalDiagnosisJudgement | { error: 'HERBAL_DISEASE_NOT_APPLICABLE' }

/**
 * 첩약 시범사업 질환 이력 판정입니다 (결정 1·2·5·6·9). 처방 가능 여부와 본인부담률 코드를 한 번에 정합니다.
 *
 * 1. 참조데이터에 없는 질환 코드는 422 `HERBAL_DISEASE_NOT_APPLICABLE`입니다
 * 2. 이력을 받지 못했으면 판정하지 않고 경고합니다. 코드는 정하지 않습니다
 * 3. 다른 2개 질환 이력이 있으면 처방 불가입니다. 선택 질환 이력이 있어도 먼저 적용합니다
 * 4. 선택 질환에 이 기관 이력이 있으면 누적이 한도 이상일 때 `U` + 경고, 아니면 `G`입니다
 * 5. 다른 기관 이력이 1일 이상이면 처방 불가입니다
 * 6. 등록 여부를 알 수 없는 이력이 1일 이상이면 경고만 주고 코드는 정하지 않습니다
 * 7. 그 밖에는 `G`이고 전액부담도 고를 수 있습니다
 */
export function judgePilotHerbalDiagnosis(input: PilotHerbalDiagnosisInput): PilotHerbalDiagnosisResult {
  const 질환표 = input.diseases ?? DEFAULT_PILOT_HERBAL_DISEASES
  const 질환명 = 질환표.get(input.diseaseCode)
  if (질환명 === undefined) return { error: 'HERBAL_DISEASE_NOT_APPLICABLE' }
  const 첩약줄Ids = [...input.lineIds]
  const 코드미정 = (경고: PilotHerbalDiagnosisIssue): PilotHerbalDiagnosisJudgement => ({
    copayCode: null,
    fullPayOptional: false,
    warnings: [경고],
    accepted: !경고.blocksCompletion,
  })
  if (input.history === null) {
    return 코드미정({ code: 'PILOT_HERBAL_HISTORY_UNKNOWN', lineIds: 첩약줄Ids, blocksCompletion: false })
  }

  const 질환이력한도경고 = (
    사유: PilotHerbalDiagnosisLimit['reason'],
    누적일수: number,
  ): PilotHerbalDiagnosisLimit => ({
    code: 'PILOT_HERBAL_DIAGNOSIS_LIMIT',
    reason: 사유,
    diseaseName: 질환명,
    cumulativeDays: 누적일수,
    lineIds: 첩약줄Ids,
    blocksCompletion: 사유 !== 'DAY_LIMIT',
  })
  if (hasTwoOtherDiseases(input.history, input.diseaseCode)) return 코드미정(질환이력한도경고('TWO_OTHER_DISEASES', 0))

  const 일부부담: PilotHerbalDiagnosisJudgement = {
    copayCode: 'G',
    fullPayOptional: true,
    warnings: [],
    accepted: true,
  }
  const 선택질환이력 = mergeDiseaseHistory(input.history, input.diseaseCode)
  if (선택질환이력 === null) return 일부부담
  if (선택질환이력.thisClinic) {
    if (선택질환이력.thisClinicDays < (input.dayLimit ?? DEFAULT_PILOT_HERBAL_DAY_LIMIT)) return 일부부담
    return {
      copayCode: 'U',
      fullPayOptional: false,
      warnings: [질환이력한도경고('DAY_LIMIT', 선택질환이력.thisClinicDays)],
      accepted: true,
    }
  }
  if (선택질환이력.otherClinicDays > 0) return 코드미정(질환이력한도경고('OTHER_CLINIC', 선택질환이력.otherClinicDays))
  if (선택질환이력.unknownDays > 0) {
    return 코드미정({ code: 'PILOT_HERBAL_HISTORY_UNVERIFIED', lineIds: 첩약줄Ids, blocksCompletion: false })
  }
  return 일부부담
}

/** 위반 문구입니다. 질환명 받침에 따라 `로`/`으로`를 고릅니다 (결정 7). */
export function pilotHerbalDiagnosisMessage(issue: PilotHerbalDiagnosisLimit): string {
  const 조사붙인질환명 = issue.diseaseName + directionalParticle(issue.diseaseName)
  switch (issue.reason) {
    case 'TWO_OTHER_DISEASES':
      return `환자가 이미 다른 ${질환수한도}개 질환으로 처방받았습니다.`
    case 'OTHER_CLINIC':
      return `환자가 타원에서 ${조사붙인질환명} 처방받았습니다.`
    case 'DAY_LIMIT':
      return `환자가 ${조사붙인질환명} ${issue.cumulativeDays}일 처방받았습니다.`
  }
}

/** 받침이 없거나 `ㄹ` 받침이면 `로`, 그 밖의 받침이면 `으로`입니다. 한글이 아니거나 빈 값이면 `로`입니다. */
function directionalParticle(word: string): '로' | '으로' {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (!Number.isInteger(code) || code < 0 || code > 11171) return '로'
  const final = code % 28
  return final === 0 || final === 8 ? '로' : '으로'
}
