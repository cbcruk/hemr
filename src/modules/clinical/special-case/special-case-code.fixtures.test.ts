import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import {
  formatMismatch,
  matchesLinkedDiagnoses,
  registrationCategory,
  requiresSpecificCode,
  specialCaseCandidates,
} from './special-case-code.ts'
import type { RareDiseaseRow, RegistrationCategory, SpecialCaseClaim } from './special-case-code.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/special-case-code-match.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 저장·완료 검사(`validateSpecialCaseCode`)는 상병 입력이 없으므로 형식 검사(`formatMismatch`)로 옮기고,
 * 상병 일치(결정 1)는 단위 테스트에서 새 케이스로 검사합니다. 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와
 * 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/special-case-code-match.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = { 건보: 'NHIS', 급여: 'MEDICAL_AID', 자보: 'AUTO_INSURANCE' }

const CATEGORY_NAME: Record<RegistrationCategory, string> = {
  CANCER: '암',
  RARE_INTRACTABLE: '희귀난치질환',
  TUBERCULOSIS: '결핵',
  SEVERE_BURN: '중증화상',
  ULTRA_RARE: '극희귀질환',
  UNSPECIFIED_RARE: '상세불명희귀질환',
  CHROMOSOMAL_ABNORMALITY: '기타염색체이상질환',
  SEVERE_DEMENTIA: '중증치매',
  RARE: '희귀질환',
  LATENT_TUBERCULOSIS: '잠복결핵',
  SEVERE_INTRACTABLE: '중증난치질환',
}

function toClaim(record: Record<string, any>): SpecialCaseClaim {
  const specifics = (record['명세서특정내역'] ?? []) as any[]
  const content = (kind: string) => specifics.find((item) => item['특정내역구분'] === kind)?.['특정코드내용'] ?? null
  return {
    coverage: COVERAGE[record['보험구분']]!,
    rareDiseaseSupport: record['희귀난치의료비지원진료여부'] === true,
    specificCode: content('MT002'),
    registrationNumber: content('MT014'),
  }
}

function toRows(rows: any[]): RareDiseaseRow[] {
  return rows.map((row) => ({
    specificCode: row['특정기호코드'],
    linkedDiagnoses: row['연계상병'],
    diseaseName: row['질환명'],
  }))
}

function cases(fn: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['fn'] === fn)
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 3: 특정기호를 정규화하고, 검사 대상 여부는 등록번호 구분으로만 정합니다
  "건보, 희귀질환(21), MT002 ' V101 ' (leading space: not seen as V-prefixed by lin) -> check skipped -> valid": {
    valid: true,
    requiresSpecificCode: true,
  },
  "건보, 희귀질환(21), MT002 'H101' (not V-prefixed) -> lin false -> check skipped -> valid": {
    valid: false,
    requiresSpecificCode: true,
  },
  '건보, 희귀질환(21), MT002 entry missing -> lin false -> check skipped -> valid': {
    valid: false,
    requiresSpecificCode: true,
  },
  // 결정 4: 기준자료에 없는 특정기호는 전체 희귀질환으로 대체하지 않습니다
  'registered V999 (not in rare-disease data), 등록번호 prefix 21 -> falls back to all rows -> dx E71 -> [V102,V103]': {
    candidates: [],
    활성특정기호: '',
  },
  // 결정 5: 범위는 앞 3자를 사전순으로 비교합니다
  "연계상병 'Q00-R99' matches 'Q55'": { matches: true },
  "연계상병 'Q00-R99' matches 'R50'": { matches: true },
}

describe('산정특례 특정기호 픽스처 (special-case-code-match)', () => {
  describe('저장·완료 검사 (validateSpecialCaseCode, 결정 2·3)', () => {
    it.each(cases('validateSpecialCaseCode').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const claim = toClaim(input['진료내용'])
      expect({ valid: formatMismatch(claim) === null, requiresSpecificCode: requiresSpecificCode(claim) }).toEqual(
        CHANGED[name] ?? expected,
      )
    })
  })

  describe('등록 구분 (dE/din, 결정 2)', () => {
    it.each(cases('dE/din').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      // 픽스처의 앞자리는 모두 두 자리라, 등록번호를 만들어 `requiresSpecificCode`의 앞 두 자리 판정까지 함께 검사합니다
      const category = registrationCategory(input['prefix'])
      const claim: SpecialCaseClaim = {
        coverage: 'NHIS',
        rareDiseaseSupport: false,
        specificCode: null,
        registrationNumber: `${input['prefix']}000123`,
      }
      expect({
        category: category === null ? '' : CATEGORY_NAME[category],
        requiresSpecificCode: requiresSpecificCode(claim),
      }).toEqual(expected)
    })
  })

  describe('연계상병 일치 (ce, 결정 5)', () => {
    it.each(cases('ce').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      expect({ matches: matchesLinkedDiagnoses(input['연계상병'], input['상병코드']) }).toEqual(
        CHANGED[name] ?? expected,
      )
    })
  })

  describe('특정기호 후보 (resolveSpecialCaseCandidates, 결정 4)', () => {
    it.each(cases('resolveSpecialCaseCandidates').map((c) => [c.name, c] as const))(
      '%s',
      (name, { input, expected }) => {
        const record = input['진료내용']
        const result = specialCaseCandidates({
          claim: toClaim(record),
          registrations: Object.values(record['보험조회'] ?? {}).map((entry: any) => ({
            specificCode: entry['특정기호'],
            registrationNumber: entry['등록번호'],
          })),
          rareDiseases: toRows(input['희귀상병데이터']),
          diagnosisCode: input['상병코드'],
        })
        expect({ candidates: result.candidates, 활성특정기호: result.activeSpecificCode ?? '' }).toEqual(
          CHANGED[name] ?? expected,
        )
      },
    )
  })

  it('모든 픽스처 케이스를 이식했고 바뀐 결과 목록은 있는 케이스만 가리킵니다', () => {
    const ported = new Set(['validateSpecialCaseCode', 'dE/din', 'ce', 'resolveSpecialCaseCandidates'])
    expect(fixture.cases.filter((c) => !ported.has(c.input['fn'])).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
