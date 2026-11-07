import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { clinicDateOf, isCalendarDate } from '../../../shared/time/date-format.ts'

export { isCalendarDate }

/** 참조데이터 데이터셋의 버전 하나입니다(`GET /reference/{dataset}/versions`의 항목). */
export interface ReferenceVersion {
  /** 버전 ID입니다. 현행 정적 JSON의 파일 이름(`20250722` 등)이나 수가 적용일자를 씁니다. */
  versionId: string
  /** 유효 시작일(`YYYY-MM-DD`, 포함)입니다. */
  validFrom: string
  /** 유효 종료일(`YYYY-MM-DD`, 제외)입니다. 다음 버전이 없으면 `null`입니다. */
  validTo: string | null
}

/** 고른 버전이거나, 기준일에 유효한 버전이 없다는 오류입니다. 가장 이른 버전으로 대체하지 않습니다 (결정 5). */
export type ReferenceVersionSelection = { version: ReferenceVersion } | { error: 'REFERENCE_DATA_UNAVAILABLE' }

/**
 * 진료 시각(RFC 3339)의 병원 시간대 날짜입니다 (결정 2). 형식이 틀리면 `null`이고, 요청 스키마가
 * 400 `VALIDATION_FAILED`로 거부합니다 (결정 3).
 */
export function serviceDateOf(serviceAt: string): string | null {
  return clinicDateOf(serviceAt)
}

/** 조회 기준일입니다. `asOf`가 없으면 병원 시간대의 오늘입니다 (결정 4). */
export function effectiveAsOf(asOf: string | undefined, nowMillis: number): string {
  return asOf ?? clinicDate(nowMillis)
}

/**
 * 기준일에 유효한 버전입니다 (결정 1·5).
 *
 * `validFrom ≤ asOf < validTo`인 버전 중 시작일이 가장 늦은 것을 고릅니다. 없으면(목록이 비었거나 기준일이 모든
 * 버전보다 이르면) `REFERENCE_DATA_UNAVAILABLE`이고 호출하는 쪽이 422로 돌려줍니다.
 */
export function selectReferenceVersion(versions: readonly ReferenceVersion[], asOf: string): ReferenceVersionSelection {
  if (!isCalendarDate(asOf)) throw new RangeError(`Expected a YYYY-MM-DD date, got ${asOf}`)
  const 유효버전목록 = versions.filter(
    (버전) => 버전.validFrom <= asOf && (버전.validTo === null || asOf < 버전.validTo),
  )
  const 최신유효버전 = 유효버전목록.reduce<ReferenceVersion | null>(
    (최신, 버전) => (최신 === null || 버전.validFrom > 최신.validFrom ? 버전 : 최신),
    null,
  )
  return 최신유효버전 === null ? { error: 'REFERENCE_DATA_UNAVAILABLE' } : { version: 최신유효버전 }
}

/**
 * 시작일만 있는 버전 목록(수가 적용일자 등)을 버전으로 바꿉니다. 각 버전은 다음 시작일 전날까지 유효합니다.
 * 같은 날짜가 여러 번 있으면 하나로 합칩니다.
 */
export function versionsFromStartDates(startDates: readonly string[]): ReferenceVersion[] {
  for (const 시작일 of startDates) {
    if (!isCalendarDate(시작일)) throw new RangeError(`Expected a YYYY-MM-DD date, got ${시작일}`)
  }
  const 정렬한시작일 = [...new Set(startDates)].sort()
  return 정렬한시작일.map((시작일, index) => ({
    versionId: 시작일.replaceAll('-', ''),
    validFrom: 시작일,
    validTo: 정렬한시작일[index + 1] ?? null,
  }))
}

/**
 * 현행 수가 `적용일자목록`을 `YYYY-MM-DD`로 이관합니다 (결정 6).
 *
 * 숫자만 남겨 앞 8자리를 날짜로 봅니다. 숫자가 없거나 실제 날짜가 아닌 값은 `rejected`로 돌려 이관 보고서에
 * 남깁니다. 현행은 숫자가 없는 값을 조용히 버렸습니다.
 */
export function migrateAvailableDates(legacy: readonly string[]): { dates: string[]; rejected: string[] } {
  const 적용일자: string[] = []
  const 이관불가값: string[] = []
  for (const 현행값 of legacy) {
    const digits = 현행값.replace(/\D/g, '')
    const 일자 = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    if (digits.length >= 8 && isCalendarDate(일자)) 적용일자.push(일자)
    else 이관불가값.push(현행값)
  }
  return { dates: 적용일자, rejected: 이관불가값 }
}
