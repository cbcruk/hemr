import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  consultationFeeCodes,
  consultationLines,
  decodeFeeCode,
  migrateInitialVisitWindow,
} from './consultation-fee-code.ts'
import type { ConsultationContext, ConsultationSettings, FeeLine } from './consultation-fee-code.ts'
import { birthDateFromRrn, isoDate, procedureFromLegacy, serviceAt } from './legacy-fixture.ts'
import { procedureFeeCode } from './procedure-fee-modifiers.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/consultation-fee-code.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(주민번호, `yyyyMMddHHmm`, 한글 설정 키)을 서버 입력(생년월일, 진료 시각, 설정)으로 바꾸고,
 * 결정(`docs/design/rule-decisions.md`의 consultation-fee-code)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/consultation-fee-code.json'), 'utf8'),
) as { cases: FixtureCase[] }

function clock(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`
}

function toSettings(legacy: Record<string, any>): ConsultationSettings {
  return {
    ageSurcharge: legacy['연령에따른시술료가산적용여부'],
    nightSurcharge: legacy['야간진료시진찰료가산여부'],
    excludeSeniorFromNight: legacy['시니어환자제외여부'],
    excludeSeniorFromSaturdayHoliday: legacy['토요일공휴일시니어환자제외여부'],
    daytimeStart: clock(legacy['주간진찰료산정기준시작시간'] ?? '0900'),
    daytimeEnd: clock(legacy['주간진찰료산정기준종료시간'] ?? '1800'),
    // 결정 5: 0은 이관 때 30으로 옮깁니다
    initialVisitWindowDays: migrateInitialVisitWindow(legacy['초진진찰료산정기준일'] ?? 0),
    addPatternDiagnosisFee: legacy['초진환자처방시변증기술료적용여부'] ?? false,
  }
}

function toContext(input: Record<string, any>): ConsultationContext {
  return {
    serviceAt: serviceAt(input['기준일시']),
    birthDate: birthDateFromRrn(input['주민번호앞자리'] ?? '', input['주민번호뒷자리'] ?? ''),
    settings: toSettings(input['설정']),
    publicHolidays: new Set(Object.keys(input['holidays'] ?? {}).map(isoDate)),
    telemedicine: input['비대면진료임'] === true,
    forceSaturday: input['토요가산강제적용'] === true,
    proxyReceipt: input['대리수령자가처방전및약제수령함'] === true,
  }
}

function toLegacyLine(line: FeeLine): Record<string, unknown> {
  return {
    수가코드: line.feeCode,
    카테고리숫자코드: line.category,
    처방명: line.name,
    줄단위특정내역:
      line.lineDetails?.map((detail) => ({ 특정내역구분: detail.kind, 특정코드내용: detail.content })) ?? null,
  }
}

function cases(fn: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['fn'] === fn && !(testCase.name in NOT_PORTED))
}

const FOLLOW_UP_LINE = { 수가코드: '10200', 카테고리숫자코드: '31001001', 처방명: '재진진찰료', 줄단위특정내역: null }

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 생후 한 달 안의 영아도 만 나이 0으로 계산합니다
  'infant born 2026-02-05, visit 2026-03-04 -> age calc returns null (month off-by-one, suspected bug) -> no infant digit':
    { codes: ['10100100'] },
  // procedure-fee-modifiers 결정 1: 생후 28일 이하 침술은 신생아 `1`입니다
  'JLt neonate (born 2026-02-10, 22 days) 침술 -> null: age calc returns null for births within the last month (suspected bug), so no 100':
    { code: '40011100' },
  // 결정 4: 날짜 차이가 N일 이하면 재진입니다
  'prior visit exactly N(30) days earlier same minute -> not counted -> 초진': { lines: [FOLLOW_UP_LINE] },
  'prior visit N days earlier - 1 minute -> 초진': { lines: [FOLLOW_UP_LINE] },
  'year rollover: N=30, current 2026-01-15 10:00, prior 2025-12-16 10:00 -> 초진': { lines: [FOLLOW_UP_LINE] },
  // 결정 5: 0은 30으로 이관하므로 어제 진료가 있으면 재진입니다
  '초진진찰료산정기준일=0 -> always 초진 even with visit yesterday': { lines: [FOLLOW_UP_LINE] },
  // 결정 3: 줄은 없지만 마스터 누락을 경고합니다
  '초진 child age 3 at night but 10100610 missing from fee list -> no line at all': {
    lines: [],
    warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['10100610'] }],
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  '최근진료기록목록 missing (null) -> undefined':
    '서버가 이전 진료를 직접 조회하므로 목록이 없는 상태가 없습니다 (결정 4)',
}

describe('진찰료 수가코드 픽스처 (consultation-fee-code)', () => {
  describe('진찰료 가산 (lee, 결정 1·2·8)', () => {
    it.each(cases('lee').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const want = (CHANGED[name] ?? expected) as { codes: string[] }
      expect(consultationFeeCodes(input['수가코드'], toContext(input))).toEqual(want.codes)
    })
  })

  describe('진찰료 줄 자동 삽입 (Vdn, 결정 3·4·5)', () => {
    it.each(cases('Vdn').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const result = consultationLines({
        ...toContext(input),
        encounterId: input['진료Id'] ?? 'r-current',
        currentLines: (input['현재진료처방목록'] as any[]).map((line) => ({
          feeCode: line['수가코드'],
          category: line['카테고리숫자코드'],
        })),
        priorEncounters: (input['최근진료기록목록'] as any[]).map((record) => ({
          encounterId: record['진료Id'],
          serviceAt: record['기준일시'] ? serviceAt(record['기준일시']) : null,
        })),
        feeMaster: new Map((input['수가코드목록'] as any[]).map((row) => [row['수가코드'], row['한글명']])),
      })
      const want = (CHANGED[name] ?? { lines: expected.lines ?? [] }) as { lines: unknown[]; warnings?: unknown[] }

      expect(result.lines.map(toLegacyLine)).toEqual(want.lines)
      expect(result.warnings).toEqual(want.warnings ?? [])
    })
  })

  describe('시술·투약 산정코드 (JLt, procedure-fee-modifiers 결정 1·2)', () => {
    it.each(cases('JLt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const { line, context } = procedureFromLegacy(input)
      const want = (CHANGED[name] ?? expected) as { code: string | null }
      expect(procedureFeeCode(line, context)).toEqual(want.code)
    })
  })

  describe('수가코드 해석 (_t.New)', () => {
    it.each(cases('_t.New').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const decoded = decodeFeeCode(input['수가코드'])
      expect({
        기본코드: decoded.baseCode,
        초진: decoded.initialVisit,
        재진: decoded.followUpVisit,
        야간임: decoded.night,
        심야임: decoded.lateNight,
        토요일임: decoded.saturday,
        공휴일임: decoded.holiday,
        만1세미만임: decoded.underOne,
        만1세이상_만6세미만임: decoded.oneToSix,
        대리수령자가처방전및약제를수령함: decoded.proxyReceipt,
      }).toEqual(expected)
    })
  })

  it('픽스처의 모든 케이스를 옮겼거나 옮기지 않은 이유를 적었고 예외 목록의 이름은 모두 픽스처에 있습니다', () => {
    const ported = new Set(['lee', 'Vdn', 'JLt', '_t.New'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['fn']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
