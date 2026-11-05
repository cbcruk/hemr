import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  effectiveAsOf,
  isCalendarDate,
  migrateAvailableDates,
  selectReferenceVersion,
  serviceDateOf,
  versionsFromStartDates,
} from './reference-version.ts'
import type { ReferenceVersion } from './reference-version.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/reference-version-selection.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 정적 JSON 버전(`O0`)은 데이터셋 버전 표에서, 수가 적용일자(`qF`)는 이관한 적용일자로 만든 버전 표에서 고릅니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다. 적용일자 표현은 모든 케이스에서
 * `YYYY-MM-DD`로 바뀝니다 (결정 6).
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/reference-version-selection.json'), 'utf8'),
) as { cases: FixtureCase[] }

/** 현행 `2026-01-01` 컷오프를 버전 표로 옮긴 값입니다 (결정 1). 구버전은 `kcd/20250722.json`입니다. */
const STATIC_VERSIONS: ReferenceVersion[] = [
  { versionId: '20250722', validFrom: '2000-01-01', validTo: '2026-01-01' },
  { versionId: '20260101', validFrom: '2026-01-01', validTo: null },
]

/**
 * `asOf`가 없는 조회의 "오늘"입니다. 현행은 기준일 없이 부르면 가장 늦은 적용일자를 골랐고, 서버는 오늘을 씁니다
 * (결정 4). 이 날짜가 가장 늦은 적용일자 뒤라 "empty query" 케이스의 결과가 같습니다.
 */
const NOW = Date.parse('2026-11-05T10:00:00+09:00')

type Outcome = { version: string } | { error: 'VALIDATION_FAILED' | 'REFERENCE_DATA_UNAVAILABLE' }

/**
 * 현행 `기준일시`를 서버 `serviceAt`(RFC 3339)으로 바꿉니다. 12자리가 아니면 바꾸지 않고 그대로 넘겨 서버 검증에
 * 맡깁니다.
 *
 * 가정: 기준일시는 진료 기록에 저장된 병원 벽시계 시각(KST)이라 `+09:00`을 붙이고 `timeZone`은 보지 않습니다.
 * 결정 문서의 "바뀌는 케이스"도 같은 가정입니다. 그래서 LA 케이스는 서울 케이스와 같은 입력이 되고, 결정 2의
 * "프로세스 시간대와 상관없음"을 보여 줍니다. 다른 오프셋의 시각은 단위 테스트가 검사합니다.
 */
function toServiceAt(legacy: string): string {
  if (!/^\d{12}$/.test(legacy)) return legacy
  return `${legacy.slice(0, 4)}-${legacy.slice(4, 6)}-${legacy.slice(6, 8)}T${legacy.slice(8, 10)}:${legacy.slice(10, 12)}:00+09:00`
}

/** 현행 수가 조회 기준일을 `asOf`로 바꿉니다. 빈 값은 `asOf` 없음이고, 숫자 8자리는 `YYYY-MM-DD`로 바꿉니다. */
function toAsOf(legacy: string): string | undefined {
  if (legacy === '') return undefined
  const digits = legacy.replace(/-/g, '')
  return /^\d{8}(\d{4})?$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : legacy
}

function staticVersion(input: Record<string, any>): Outcome {
  // 서버는 프로세스 시간대를 보지 않으므로 `timeZone` 입력은 결과에 영향이 없습니다 (결정 2)
  const date = serviceDateOf(toServiceAt(input['기준일시']))
  if (date === null) return { error: 'VALIDATION_FAILED' }
  const selection = selectReferenceVersion(STATIC_VERSIONS, date)
  return 'error' in selection ? selection : { version: selection.version.versionId }
}

function feeVersion(input: Record<string, any>): Outcome {
  const asOf = toAsOf(input['기준일시'])
  if (asOf !== undefined && !isCalendarDate(asOf)) return { error: 'VALIDATION_FAILED' }
  const versions = versionsFromStartDates(migrateAvailableDates(input['적용일자목록']).dates)
  const selection = selectReferenceVersion(versions, effectiveAsOf(asOf, NOW))
  return 'error' in selection ? selection : { version: selection.version.validFrom }
}

/** 현행 결과를 서버 결과 형태로 바꿉니다. 구버전 `null`은 버전 ID `20250722`, 적용일자는 `YYYY-MM-DD`입니다. */
function legacyOutcome(fn: string, expected: any): Outcome {
  if (fn === 'O0') return { version: expected['version'] ?? '20250722' }
  // 검사 대상 함수와 따로 `YYYY-MM-DD`로 바꿉니다
  const digits = String(expected['적용일자']).replace(/-/g, '')
  return { version: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` }
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, Outcome> = {
  // 결정 2: 진료 시각을 병원 시간대 날짜로 바꿔 비교합니다
  '[TZ=America/Los_Angeles] staticVersion 2025-12-31 23:59 -> legacy (undefined)': { version: '20250722' },
  '[TZ=America/Los_Angeles] staticVersion 2025-12-31 00:00 -> legacy': { version: '20250722' },
  // 결정 3: 형식이 틀린 기준일은 400입니다
  '[TZ=Asia/Seoul] staticVersion 8-digit 20260101 is unparseable as yyyyMMddHHmm -> Invalid Date -> 20260101': {
    error: 'VALIDATION_FAILED',
  },
  '[TZ=Asia/Seoul] staticVersion 8-digit 20251231 is unparseable -> Invalid Date -> 20260101 (not legacy)': {
    error: 'VALIDATION_FAILED',
  },
  'feeVersion query with no digits -> latest': { error: 'VALIDATION_FAILED' },
  // 결정 5: 유효한 버전이 없으면 대체하지 않습니다
  'feeVersion before earliest -> earliest (fallback, not empty)': { error: 'REFERENCE_DATA_UNAVAILABLE' },
  'feeVersion dates list empty -> empty string': { error: 'REFERENCE_DATA_UNAVAILABLE' },
}

describe('reference-version-selection fixture', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const outcome = input['fn'] === 'O0' ? staticVersion(input) : feeVersion(input)
    expect(outcome).toEqual(CHANGED[name] ?? legacyOutcome(input['fn'], expected))
  })

  it('reports the dropped entry of the "without digits" case (notes block)', () => {
    const testCase = fixture.cases.find((c) => c.name === 'feeVersion list entry without digits is dropped')!
    expect(migrateAvailableDates(testCase.input['적용일자목록']).rejected).toEqual(['N/A'])
  })

  it('accounts for every fixture case', () => {
    expect(fixture.cases.filter((c) => !['O0', 'qF'].includes(c.input['fn'])).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
