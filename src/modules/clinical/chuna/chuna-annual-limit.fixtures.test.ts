import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import { isoDate, serviceAt } from '../fees/legacy-fixture.ts'
import {
  chunaUsageSummary,
  hiraChunaQueryWindow,
  judgeChunaAnnualLimit,
  mergeHiraChunaLists,
  parseHiraChunaCount,
  queriesHiraChunaCount,
} from './chuna-annual-limit.ts'
import type {
  ChunaAnnualLimitJudgement,
  ChunaLine,
  ChunaUsageSummary,
  HiraChunaCountResponse,
  HiraChunaListRow,
  HiraChunaUsage,
} from './chuna-annual-limit.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/chuna-annual-limit.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(심평원 실시간 결과·서버 저장본, 한글 보험구분, `yyyyMMdd`)을 서버 입력(저장된 심평원 사용량, 진료
 * 시각)으로 바꾸고, 결정(`docs/design/rule-decisions.md`의 chuna-annual-limit)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/chuna-annual-limit.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = {
  건보: 'NHIS',
  급여: 'MEDICAL_AID',
  자보: 'AUTO_INSURANCE',
  산재: 'INDUSTRIAL_ACCIDENT',
  일반: 'SELF_PAY',
}

const INSURER_COVERAGE: Record<string, Coverage> = { '4': 'NHIS', '5': 'MEDICAL_AID', '8': 'AUTO_INSURANCE' }

/** 저장된 사용량으로 바꿉니다. 서버는 실시간 결과와 저장본을 구분하지 않고 에이전트가 저장한 값을 씁니다. */
function toUsage(input: Record<string, any>): HiraChunaUsage {
  const live = input['live']
  if (live) {
    return {
      rows: (live['목록'] as any[]).map((row) => ({
        serviceDate: isoDate(row['진료일자']),
        deleted: row['삭제여부'] === 'Y',
        ownClinic: row['해당요양기관등록여부'] === 'Y',
      })),
      cumulativeCount: live['누적횟수'] ?? null,
      complete: true,
    }
  }
  return {
    rows: ((input['saved']?.['진료일자별내역'] ?? []) as any[]).map((row) => ({
      serviceDate: isoDate(row['진료일자']),
      deleted: row['삭제여부'],
      ownClinic: row['본원여부'],
    })),
    cumulativeCount: null,
    complete: true,
  }
}

function toLine(legacy: Record<string, any>): ChunaLine {
  return { lineId: legacy['id'], feeCode: legacy['수가코드'] ?? null, category: legacy['카테고리숫자코드'] ?? '' }
}

function toListRow(legacy: Record<string, any>): HiraChunaListRow {
  return {
    serviceDate: isoDate(legacy['진료일자']),
    deleted: false,
    // 현행처럼 값이 없으면 우리 기관 행으로 봅니다
    ownClinic: (legacy['해당요양기관등록여부'] ?? 'Y') === 'Y',
    rowNumber: Number(legacy['목록Row번호']),
  }
}

function toCountResponse(raw: any): HiraChunaCountResponse | null {
  // 통신 오류와 예외는 에이전트가 `null`로 넘깁니다
  if (raw === 'throw') return null
  const [data, error] = raw as [Record<string, any> | null, unknown]
  if (error || data === null) return null
  const response: HiraChunaCountResponse = { count: data['조회결과']?.['추나횟수'] ?? null }
  if (data['에러코드']) response.errorCode = data['에러코드']
  if (data['에러메시지']) response.errorMessage = data['에러메시지']
  return response
}

/** 현행 I0009 결과를 서버 판정으로 옮깁니다. 현행 I0009는 모두 완료를 막는 보험구분(건보·급여·산재)에서 납니다. */
function limitJudgement(lineIds: string[] | null, priorCount: number): ChunaAnnualLimitJudgement {
  if (lineIds === null) return { warnings: [], accepted: true }
  return {
    warnings: [{ code: 'CHUNA_ANNUAL_LIMIT', lineIds, priorCount, limit: 20, blocksCompletion: true }],
    accepted: false,
  }
}

function cases(kind: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['kind'] === kind && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, ChunaAnnualLimitJudgement | Partial<ChunaUsageSummary>> = {
  // 결정 1: 이전 시행 수는 진료일보다 앞선 날만 셉니다. 진료일의 행은 당일 이력으로만 봅니다
  'saved: today row present -> same-day true, not available': { priorCount: 5 },
  'live HIRA: today row in live list': { priorCount: 2 },
  // 결정 7: 사용량이 없으면 판정하지 않고 알립니다
  '건보 cumulative undefined (not live) -> none': {
    warnings: [{ code: 'CHUNA_USAGE_UNKNOWN', lineIds: ['a'], blocksCompletion: false }],
    accepted: true,
  },
  // 결정 4: 자보도 사고 단위 한도를 넘으면 경고하되 완료를 막지 않습니다
  '자보 cumulative 30 -> none (건보/급여 only)': {
    warnings: [{ code: 'CHUNA_ANNUAL_LIMIT', lineIds: ['a'], priorCount: 30, limit: 20, blocksCompletion: false }],
    accepted: true,
  },
  // 결정 2·3: 산재도 이전 시행 수만 보고, 시행 수는 추나 줄이 있는 진료일 수입니다
  '산재 prior 19 + current 1 = 20 -> I0009 (>= 20 includes current)': { warnings: [], accepted: true },
  '산재 counts 40721 and lines not records: prior 10 records x2 lines -> 20 + 1': { warnings: [], accepted: true },
  // 결정 7: 건보 진료는 산재 진료기록이 아니라 저장된 심평원 사용량으로 판정하고, 사용량이 없으면 알립니다
  'non-산재 -> none': {
    warnings: [{ code: 'CHUNA_USAGE_UNKNOWN', lineIds: ['cur-0'], blocksCompletion: false }],
    accepted: true,
  },
  // 결정 8: 서버는 새로 추가한 줄만이 아니라 현재 진료의 추나 줄 전부를 판정합니다
  'existing chuna (same id) not treated as new -> unchanged': limitJudgement(['n'], 20),
  // 결정 8: 현행은 새 추나 줄을 지우거나(실시간) 토스트만 띄웠고(비실시간), 서버는 줄을 두고 완료를 막습니다
  '건보 exhausted + live + newly added chuna -> dialog, chuna dropped': limitJudgement(['n'], 20),
  '건보 exhausted + not live -> warning only, chuna kept': limitJudgement(['n'], 20),
  '급여 exhausted + live -> chuna dropped': limitJudgement(['n'], 20),
  // 결정 4
  '자보 exhausted -> unchanged': {
    warnings: [{ code: 'CHUNA_ANNUAL_LIMIT', lineIds: ['n'], priorCount: 20, limit: 20, blocksCompletion: false }],
    accepted: true,
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'exhausted undefined (loading) -> unchanged': '서버는 저장된 사용량으로 판정하므로 로딩 중 상태가 없습니다',
}

describe('chuna-annual-limit fixture', () => {
  describe('usage summary (tLt, 결정 1·5·6)', () => {
    it.each(cases('tLt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const record = input['record']
      const at = serviceAt(record['기준일시'])
      const summary = chunaUsageSummary(toUsage(input), { serviceAt: at, limit: 20 })
      // 서버 요약에는 "데이터 없음"이 없습니다. 판정은 사용량이 없으면(`null`) `CHUNA_USAGE_UNKNOWN`입니다(SFt 참고)
      expect(summary).toEqual({
        ownCount: expected['본원추나시행건수'],
        otherCount: expected['타원추나시행건수'],
        priorCount: expected['누적추나시행건수'],
        sameDay: expected['당일추나시술여부'],
        exhausted: expected['추나횟수소진'],
        availableToday: expected['오늘추나시술가능'],
        ...(CHANGED[name] as Partial<ChunaUsageSummary> | undefined),
      })

      // 저장본 조회 파라미터는 조회 기간의 연도·사고접수번호와 같습니다
      const lookup = record['보험조회']
      const accident = lookup['사고접수번호']
        ? { accidentNumber: lookup['사고접수번호'], accidentDate: isoDate(lookup['사고발생일자']) }
        : undefined
      const window = hiraChunaQueryWindow(at.date, input['now'].slice(0, 10), accident)
      const params = expected['savedQueryParams']
      expect(window.year).toBe(params['search_year'])
      expect(window.accidentNumber).toBe(params['accident_report_number'])
    })
  })

  describe('HIRA cumulative count (z7t)', () => {
    it.each(cases('z7t').map((c) => [c.name, c] as const))('%s', (_name, { input, expected }) => {
      expect(parseHiraChunaCount(toCountResponse(input['getChunaDataResponse']))).toBe(expected['누적횟수'])
    })
  })

  describe('HIRA list merge (q7t)', () => {
    it.each(cases('q7t').map((c) => [c.name, c] as const))('%s', (_name, { input, expected }) => {
      const merged = mergeHiraChunaLists(
        (input['byPatient'] as any[]).map(toListRow),
        (input['byYoyang'] as any[]).map(toListRow),
      )
      expect(merged).toEqual((expected['목록'] as any[]).map(toListRow))
    })
  })

  describe('coverages that query the cumulative count (j7t)', () => {
    it.each(cases('j7t').map((c) => [c.name, c] as const))('%s', (_name, { expected }) => {
      const coverages = Object.values(COVERAGE).filter(queriesHiraChunaCount)
      expect(coverages).toEqual(
        (expected['codesThatQueryCumulativeCount'] as string[]).map((code) => INSURER_COVERAGE[code]),
      )
    })
  })

  describe('HIRA query window (Z8)', () => {
    it.each(cases('Z8').map((c) => [c.name, c] as const))('%s', (_name, { input, expected }) => {
      const accident = input['자보정보']
      const window = hiraChunaQueryWindow(
        input['진료기준일'].slice(0, 10),
        '2026-11-01',
        accident && { accidentNumber: accident['사고접수번호'], accidentDate: isoDate(accident['사고발생일자']) },
      )
      const payload = expected['payloadByPatient']
      const want: Record<string, string> = {
        from: isoDate(payload['진료기간From']),
        to: isoDate(payload['진료기간To']),
      }
      if (payload['진료년도']) want['year'] = payload['진료년도']
      if (payload['사고접수번호']) want['accidentNumber'] = payload['사고접수번호']
      expect(window).toEqual(want)
    })
  })

  describe('NHIS and medical aid limit (SFt, 결정 1·4·7·8)', () => {
    it.each(cases('SFt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const record = input['현재진료']
      const count = input['추나누적횟수']
      const result = judgeChunaAnnualLimit({
        encounterId: 'cur',
        coverage: COVERAGE[record['보험구분']]!,
        serviceAt: { date: '2026-11-01', time: '10:00' },
        lines: (record['진료처방'] as any[]).map(toLine),
        hiraUsage: count === undefined ? null : { rows: [], cumulativeCount: count, complete: true },
        others: [],
      })
      const warning = expected['warning']
      expect(result).toEqual(CHANGED[name] ?? limitJudgement(warning?.['원인제공자Ids'] ?? null, count))
    })
  })

  describe('industrial accident limit (BFt, 결정 2·3)', () => {
    it.each(cases('BFt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const record = input['현재진료']
      const result = judgeChunaAnnualLimit({
        encounterId: record['진료Id'],
        coverage: COVERAGE[record['보험구분']]!,
        serviceAt: serviceAt(record['기준일시']),
        lines: (record['진료처방'] as any[]).map(toLine),
        hiraUsage: null,
        others: (input['최근진료기록'] as any[]).map((other) => ({
          encounterId: other['진료Id'],
          coverage: COVERAGE[other['보험구분']]!,
          serviceAt: other['기준일시'] ? serviceAt(other['기준일시']) : null,
          lines: (other['진료처방'] as any[]).map(toLine),
        })),
      })
      // 현행 I0009가 남는 산재 케이스는 없습니다
      expect(expected['warning'] === null || name in CHANGED).toBe(true)
      expect(result).toEqual(CHANGED[name] ?? limitJudgement(null, 0))
    })
  })

  describe('add guard (addChunaGuard, 결정 4·8)', () => {
    it.each(cases('addChunaGuard').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const after = (input['after'] as any[]).map(toLine)
      const result = judgeChunaAnnualLimit({
        encounterId: 'cur',
        coverage: COVERAGE[input['보험구분']]!,
        serviceAt: { date: '2026-11-01', time: '10:00' },
        lines: after,
        hiraUsage: { rows: [], cumulativeCount: input['추나횟수소진'] ? 20 : 0, complete: true },
        others: [],
      })
      // 현행이 줄을 지웠거나 알림을 띄운 케이스는 모두 CHANGED에 있습니다. 나머지는 현행처럼 아무 일도 없습니다
      const dropped = after.some((line) => !(expected['resultIds'] as string[]).includes(line.lineId))
      if (dropped || (expected['notices'] as unknown[]).length > 0) expect(name in CHANGED).toBe(true)
      expect(result).toEqual(CHANGED[name] ?? limitJudgement(null, 0))
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['tLt', 'z7t', 'q7t', 'j7t', 'Z8', 'SFt', 'BFt', 'addChunaGuard'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['kind']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
