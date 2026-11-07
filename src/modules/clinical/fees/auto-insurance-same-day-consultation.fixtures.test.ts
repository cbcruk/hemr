import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import {
  autoInsuranceClaimIssues,
  autoInsuranceClaimSpecifics,
  autoInsuranceSecondVisits,
  judgeSameAccidentDuplicate,
} from './auto-insurance-same-day-consultation.ts'
import type { AutoInsuranceEncounter, AutoInsuranceSameDayInput } from './auto-insurance-same-day-consultation.ts'
import { serviceAt } from './legacy-fixture.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/auto-insurance-same-day-consultation.json`)를 서버 규칙으로 옮긴
 * 테스트입니다.
 *
 * 청구 경고는 `autoInsuranceClaimIssues`로, 배너와 자동 지정은 `autoInsuranceSecondVisits`로, 명세서 특정내역은
 * `autoInsuranceClaimSpecifics`로 검사합니다. 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../../test/fixtures/rules/auto-insurance-same-day-consultation.json'),
    'utf8',
  ),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = { 건보: 'NHIS', 자보: 'AUTO_INSURANCE' }

function toEncounter(legacy: Record<string, any>, lines: any[]): AutoInsuranceEncounter {
  return {
    encounterId: legacy['진료Id'],
    coverage: COVERAGE[legacy['보험구분']]!,
    serviceAt: legacy['기준일시'] ? serviceAt(legacy['기준일시']) : null,
    accidentNumber: legacy['보험조회']?.['사고접수번호'] ?? null,
    secondVisit: legacy['자보1일2차여부'] ?? null,
    lines: lines.map((line) => ({ lineId: line['id'], feeCode: line['수가코드'] })),
    paid: false,
  }
}

function toInput(current: Record<string, any>, currentLines: any[], others: any[]): AutoInsuranceSameDayInput {
  const encounter = toEncounter(current, currentLines)
  return {
    current: { ...encounter, serviceAt: encounter.serviceAt! },
    others: others.map((record) => toEncounter(record, record['진료처방'])),
  }
}

function cases(kind: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['kind'] === kind && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 같은 사고로 같은 날 진찰료가 2건이면 뒤 진료에 중복 warning을 줍니다
  'two same-day encounters, same accident -> none': { warnings: [], duplicateOf: ['r1'] },
  // 결정 2: 앞 진료가 2차로 지정됐으므로 현재 진료가 1차입니다
  'sibling flagged 2차, current later with 진찰료 -> J0014 (flag not consulted)': { warnings: [] },
  // 결정 5: `10` 대역 전체가 진찰료입니다
  'only codes starting 10100/10200 count: 10400 ignored, 1020010 counted': {
    warnings: [{ 에러코드: 'J0014', 원인제공자Ids: ['x1', 'x2'] }],
  },
}

/** 배너 케이스에서 현행과 다른 자동 지정입니다. 키는 케이스 이름이고 값은 자동 지정할 진료 전체입니다. */
const DESIGNATED: Record<string, string[]> = {
  // 결정 4: 현재 진료보다 뒤인 다른 사고 진료도 지정이 없으면 함께 2차로 지정합니다
  'current is first of day -> no banner': ['r1'],
  // 결정 6: 판정 함수는 권한을 보지 않습니다. 권한이 없으면 저장이 403이라 지정이 반영되지 않습니다
  'no write permission -> banner shown but no auto-assign': ['r2'],
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'IBt raw J0014 for first encounter is discarded by HFt filter':
    '현행에서 결과가 버려지는 함수입니다. 서버는 J0014를 `autoInsuranceClaimIssues` 하나로 계산합니다',
  'IBt suppressed when any same-day encounter flagged 2차':
    '현행에서 결과가 버려지는 함수입니다. 서버는 J0014를 `autoInsuranceClaimIssues` 하나로 계산합니다',
}

describe('자보 1일 2차 진찰료 픽스처 (auto-insurance-same-day-consultation)', () => {
  describe('청구 경고 (HFt 자보, 결정 1·2·5)', () => {
    it.each(cases('claimWarning').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const sameDay = toInput(input['현재진료'], input['현재진료']['진료처방'], input['같은날자보진료기록'])
      const want = (CHANGED[name] ?? expected) as { warnings: any[]; duplicateOf?: string[] }

      const issues = autoInsuranceClaimIssues(sameDay)
      expect(issues.map((issue) => ({ 에러코드: issue.code, 원인제공자Ids: issue.lineIds }))).toEqual(want.warnings)
      const duplicate = judgeSameAccidentDuplicate(sameDay).warnings[0]
      expect(duplicate?.conflictingEncounterIds ?? []).toEqual(want.duplicateOf ?? [])
    })
  })

  describe('배너와 2차 자동 지정 (결정 2·4·6)', () => {
    it.each(cases('banner').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const sameDay = toInput(input['진료내용'], input['진료내용']['처방'], input['최근진료기록'])
      const result = autoInsuranceSecondVisits(sameDay)

      expect(result.multipleAccidents).toBe(expected['상황'])
      expect(result.currentIsSecondVisit).toBe(expected['bannerVisible'])
      const currentId = sameDay.current.encounterId
      const designated = DESIGNATED[name] ?? (expected['willAutoAssign'] ? [currentId] : [])
      expect(result.designations.map((d) => d.encounterId)).toEqual(designated)
      const designation = result.designations.find((d) => d.encounterId === currentId)
      if (designation !== undefined && expected['afterAutoAssign'] !== null) {
        const kept = expected['afterAutoAssign']['처방'].map((line: any) => line['id'])
        const removed = sameDay.current.lines.map((line) => line.lineId).filter((id) => !kept.includes(id))
        expect(designation.removedLineIds).toEqual(removed)
      }
    })
  })

  describe('명세서 특정내역 (Tf)', () => {
    it.each(cases('claimSpecifics').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const specifics = autoInsuranceClaimSpecifics(COVERAGE[input['보험구분']]!, input['자보1일2차여부'])
      expect(specifics.map((s) => ({ 특정내역구분: s.kind, 특정내역: s.content }))).toEqual(expected['명세서특정내역'])
    })
  })

  it('픽스처의 모든 케이스를 옮겼거나 옮기지 않은 이유를 적었고 예외 목록의 이름은 모두 픽스처에 있습니다', () => {
    const ported = new Set(['claimWarning', 'banner', 'claimSpecifics'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['kind']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(DESIGNATED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
