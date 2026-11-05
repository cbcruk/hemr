import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasTwoOtherDiseases,
  pilotHerbalHistoryRow,
  judgePilotHerbalDiagnosis,
  mergeDiseaseHistory,
  pilotHerbalDiagnosisMessage,
} from './pilot-herbal-diagnosis-limit.ts'
import type {
  MergedDiseaseHistory,
  PilotHerbalDiagnosisResult,
  PilotHerbalHistoryRow,
} from './pilot-herbal-diagnosis-limit.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/pilot-herbal-diagnosis-limit.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행은 화면 문구(`Cdn`)와 본인부담률 코드(`$dn`)를 따로 판정했고, 서버는 하나의 판정(`judgePilotHerbalDiagnosis`)
 * 에서 둘을 함께 정합니다 (결정 1). 테스트는 현행 결과를 처방 가능 여부·문구·코드로 옮겨 비교합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/pilot-herbal-diagnosis-limit.json'), 'utf8'),
) as { cases: FixtureCase[] }

function toHistory(rows: any[]): PilotHerbalHistoryRow[] {
  return rows.map((row) =>
    pilotHerbalHistoryRow({
      diseaseCode: row['첩약상병구분코드'],
      registration: row['해당요양기관등록여부'],
      cumulativeDays: row['누적투약일수'],
    }),
  )
}

function judge(input: Record<string, any>): PilotHerbalDiagnosisResult {
  return judgePilotHerbalDiagnosis({
    diseaseCode: input['code'],
    lineIds: ['h1'],
    history: input['history'] === undefined ? null : toHistory(input['history']),
  })
}

/** 처방 가능 여부·문구·경고 코드로 줄인 결과입니다. 본인부담률 코드는 copay 케이스와 단위 테스트가 검사합니다. */
interface Eligibility {
  blocked: boolean
  message: string
  issues: string[]
}

function eligibilityOf(result: PilotHerbalDiagnosisResult): Eligibility | { error: string } {
  if ('error' in result) return result
  const limit = result.warnings.find((warning) => warning.code === 'PILOT_HERBAL_DIAGNOSIS_LIMIT')
  return {
    blocked: !result.accepted,
    message: limit === undefined ? '' : pilotHerbalDiagnosisMessage(limit),
    issues: result.warnings.map((warning) => warning.code),
  }
}

/** 현행 `Cdn` 결과를 같은 모양으로 옮깁니다. `undefined`와 빈 문구는 모두 문제없음입니다. */
function legacyEligibility(returned: any): Eligibility {
  if (returned === 'undefined' || returned['오류메시지'] === '') return { blocked: false, message: '', issues: [] }
  return {
    blocked: returned['처방불가'] === true,
    message: returned['오류메시지'],
    issues: ['PILOT_HERBAL_DIAGNOSIS_LIMIT'],
  }
}

/** 현행 `N0e`의 합친 행을 서버 모양으로 옮깁니다. 현행은 `Y`가 아니면 모두 `N`이었습니다. */
function legacyMerge(returned: any): MergedDiseaseHistory | null {
  if (returned === 'undefined') return null
  const days = Number(returned['누적투약일수'])
  const thisClinic = returned['해당요양기관등록여부'] === 'Y'
  return { thisClinic, thisClinicDays: thisClinic ? days : 0, otherClinicDays: thisClinic ? 0 : days, unknownDays: 0 }
}

/** 코드·전액부담 선택·처방 불가로 줄인 결과입니다. 현행 빈 코드(`""`)는 처방 불가입니다. */
interface Copay {
  copayCode: 'G' | 'U' | null
  fullPayOptional: boolean
  blocked: boolean
}

function copayOf(result: PilotHerbalDiagnosisResult): Copay {
  if ('error' in result) throw new Error(result.error)
  return { copayCode: result.copayCode, fullPayOptional: result.fullPayOptional, blocked: !result.accepted }
}

function legacyCopay(returned: any): Copay {
  const code = returned['첩건본인부담률구분코드']
  return {
    copayCode: code === '' ? null : code,
    fullPayOptional: returned['본인일부부담이지만전액부담선택가능함'] ?? false,
    blocked: code === '',
  }
}

function cases(fn: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['function'] === fn && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, Eligibility | Copay | { error: string }> = {
  // 결정 5: 이력을 받지 못했으면 판정하지 않고 "이력 조회 필요" 경고를 줍니다. 처방 가능 여부는 그대로입니다
  'eligibility: history not loaded': { blocked: false, message: '', issues: ['PILOT_HERBAL_HISTORY_UNKNOWN'] },
  // 결정 6: 등록 여부를 모르는 이력은 타원으로 보지 않고 경고만 줍니다
  'eligibility: empty registration flag is normalized to N and blocks as other clinic': {
    blocked: false,
    message: '',
    issues: ['PILOT_HERBAL_HISTORY_UNVERIFIED'],
  },
  'copay: empty registration flag is normalized to N and gives blank': {
    copayCode: null,
    fullPayOptional: false,
    blocked: false,
  },
  // 결정 7: 받침에 맞춰 `로`를 붙입니다
  'eligibility: particle 으로 is appended regardless of final consonant': {
    blocked: false,
    message: '환자가 안면신경마비로 20일 처방받았습니다.',
    issues: ['PILOT_HERBAL_DIAGNOSIS_LIMIT'],
  },
  // 결정 9: 참조데이터에 없는 질환 코드는 예외 대신 422입니다
  'eligibility: code outside M0e with matching row throws': { error: 'HERBAL_DISEASE_NOT_APPLICABLE' },
  // 결정 1: 선택 질환 이력이 있어도 다른 2개 질환이면 처방 불가입니다
  'copay: current-disease history skips the 2-disease check (differs from eligibility)': {
    copayCode: null,
    fullPayOptional: false,
    blocked: true,
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'eligibility: no code selected': '첩약 시범사업 처방의 질환 코드는 요청 스키마의 필수 값이라 빈 값이 없습니다',
}

describe('pilot-herbal-diagnosis-limit fixture', () => {
  describe('eligibility (Cdn, 결정 1·5·6·7·9)', () => {
    it.each(cases('prescriptionEligibility').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const want = CHANGED[name] ?? legacyEligibility(expected['returned'])
      expect(eligibilityOf(judge(input))).toEqual(want)
    })
  })

  describe('copay code (resolveCopayCode, 결정 1·2·6)', () => {
    it.each(cases('resolveCopayCode').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const want = CHANGED[name] ?? legacyCopay(expected['returned'])
      expect(copayOf(judge(input))).toEqual(want)
    })
  })

  describe('current disease merge (N0e, 결정 3·6)', () => {
    it.each(cases('mergeCurrentDiagnosisHistory').map((c) => [c.name, c] as const))(
      '%s',
      (_name, { input, expected }) => {
        const merged = mergeDiseaseHistory(toHistory(input['history']), input['code'])
        expect(merged).toEqual(legacyMerge(expected['returned']))
      },
    )
  })

  describe('two other diseases (R0e, 결정 1)', () => {
    it.each(cases('hasTwoOtherDiagnoses').map((c) => [c.name, c] as const))('%s', (_name, { input, expected }) => {
      expect(hasTwoOtherDiseases(toHistory(input['history']), input['code'])).toBe(expected['returned'])
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set([
      'prescriptionEligibility',
      'resolveCopayCode',
      'mergeCurrentDiagnosisHistory',
      'hasTwoOtherDiagnoses',
    ])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['function']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
