import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import type { ConsultationSettings } from './consultation-fee-code.ts'
import { birthDateFromRrn, isoDate, serviceAt } from './legacy-fixture.ts'
import type { FeeMasterRow } from './procedure-fee-modifiers.ts'
import {
  isTelemedicineFeeCode,
  reconcileTelemedicineLines,
  telemedicineFeeLine,
  telemedicineToggleAvailable,
} from './telemedicine-fee-lines.ts'
import type { TelemedicineLine } from './telemedicine-fee-lines.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/telemedicine-fee-lines.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 관리료 한 줄(`Pd+Ed`)은 `telemedicineFeeLine`으로, 토글 재계산(`Wh`)과 화면 watcher(`Uv`)는 저장 때 한 번 부르는
 * `reconcileTelemedicineLines`로 옮깁니다. watcher는 단계를 모두 적용한 마지막 상태로 한 번 계산합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/telemedicine-fee-lines.json'), 'utf8'),
) as { cases: FixtureCase[] }

const FEE_NAME = '비대면진료 시범사업 관리료'

/** 현행 산식(28.79점 × 연도별 점수당 단가)으로 나온 관리료입니다. 서버는 이 값을 참조데이터로 적재합니다 (결정 1). */
const FEE_BY_YEAR: Record<string, number> = { '2025': 2950, '2026': 3000 }

function feeMaster(date: string, consultationRows: any[] = []): Map<string, FeeMasterRow> {
  const master = new Map<string, FeeMasterRow>(
    consultationRows.map((row) => [
      row['수가코드'],
      { name: row['한글명'], claimName: row['한글명_산정명칭'], unitPrice: Number(row['한방병의원단가']) },
    ]),
  )
  const fee = FEE_BY_YEAR[date.slice(0, 4)]
  if (fee !== undefined) {
    for (const code of ['91001', '91002', '91003', '91004']) master.set(code, { name: FEE_NAME, unitPrice: fee })
  }
  return master
}

function holidays(map: Record<string, string> | undefined): Set<string> {
  return new Set(Object.keys(map ?? {}).map(isoDate))
}

function toSettings(legacy: Record<string, any>): ConsultationSettings {
  const clock = (hhmm: string) => `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`
  return {
    ageSurcharge: legacy['연령에따른시술료가산적용여부'],
    nightSurcharge: legacy['야간진료시진찰료가산여부'],
    excludeSeniorFromNight: legacy['시니어환자제외여부'],
    excludeSeniorFromSaturdayHoliday: legacy['토요일공휴일시니어환자제외여부'],
    daytimeStart: clock(legacy['주간진찰료산정기준시작시간']),
    daytimeEnd: clock(legacy['주간진찰료산정기준종료시간']),
    initialVisitWindowDays: 30,
    addPatternDiagnosisFee: false,
  }
}

/** watcher 케이스의 설정입니다. 현행 watcher는 `Wh` 케이스와 같은 진료설정을 씁니다. */
const WATCHER_SETTINGS: ConsultationSettings = toSettings({
  연령에따른시술료가산적용여부: true,
  야간진료시진찰료가산여부: true,
  시니어환자제외여부: false,
  토요일공휴일시니어환자제외여부: false,
  주간진찰료산정기준시작시간: '0900',
  주간진찰료산정기준종료시간: '1800',
})

/** watcher 케이스의 수가 마스터입니다. 픽스처에 없어 `Wh` 케이스의 진찰료 행을 씁니다. */
const WATCHER_ROWS = fixture.cases.find((c) => c.input['fn'] === 'Wh')!.input['수가코드목록'] as any[]

function toLine(legacy: Record<string, any>): TelemedicineLine {
  const line: TelemedicineLine = {
    feeCode: legacy['수가코드'],
    category: legacy['카테고리숫자코드'],
    name: legacy['처방명'],
    // procedure-fee-modifiers 결정 6: 현행 `금액`은 단가, `단가`는 금액입니다
    unitPrice: legacy['금액'],
    amount: legacy['단가'],
    dailyDose: legacy['일투여량'] ?? 1,
    days: legacy['투약일수'] ?? 1,
  }
  if (legacy['id'] !== undefined) line.lineId = legacy['id']
  return line
}

/** 비교할 값만 남깁니다. ID와 투여량은 현행 결과마다 있거나 없어 비교하지 않습니다. */
function project(line: TelemedicineLine): Record<string, unknown> {
  return {
    수가코드: line.feeCode,
    카테고리숫자코드: line.category,
    처방명: line.name,
    금액: line.unitPrice,
    단가: line.amount,
    줄단위특정내역: line.lineDetails?.map((d) => ({ 특정내역구분: d.kind, 특정코드내용: d.content })) ?? null,
  }
}

function projectLegacy(legacy: Record<string, any>): Record<string, unknown> {
  return project({
    ...toLine(legacy),
    lineDetails: (legacy['줄단위특정내역'] ?? undefined)?.map((d: any) => ({
      kind: d['특정내역구분'],
      content: d['특정코드내용'],
    })),
  })
}

function cases(fn: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['fn'] === fn && !(testCase.name in NOT_PORTED))
}

const UNAVAILABLE = (feeCodes: string[]) => ({ error: 'REFERENCE_DATA_UNAVAILABLE', feeCodes })

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 진료일에 유효한 단가가 없으면 2026 단가로 대체하지 않습니다
  '2027-03-03 10:00 -> 2027 unit price missing -> 2026 fallback + console.error': null,
  // 결정 5: 진찰료 기본코드가 마스터에 없으면 진찰료를 그대로 두지 않고 거부합니다
  'turn 비대면 on, fee list empty: consultation kept as-is + 91001 added': UNAVAILABLE(['10100']),
  'turn 비대면 on, computed base code missing from list: original consultation lines kept': UNAVAILABLE(['10200']),
}

/** 진찰료 단가를 늘 진료일 마스터 값으로 맞추므로(결정 1·7) 현행 watcher가 건드리지 않던 진찰료 줄의 단가가 바뀝니다. */
const REPRICED_CONSULTATION = new Set([
  '비대면 visit time moved 10:00 -> 19:00: 9100x line code/amount updated to 91002',
  'time moved within same band (10:00 -> 11:00): nothing emitted',
  'consultation line count 2 -> 1 with two 9100x lines: extra 9100x trimmed',
])

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  '11-digit 기준일시 -> Pd gives Invalid Date (not holiday) then Ed throws':
    '`serviceAt` 형식 오류는 요청 스키마가 400으로 막습니다 (reference-version-selection 결정 3)',
  'turn 비대면 on, settings missing: consultation kept + 91001':
    '진료설정은 서버에 기본값으로 늘 있어 "설정 없음" 경로가 없습니다 (결정 5)',
  'switch to another 진료Id resets pending flags; no emit': '서버에는 화면의 보류 상태가 없습니다 (결정 7)',
  'qh matching band and amount -> false':
    '`qh`는 갱신 여부만 보는 화면 최적화입니다. 서버는 저장 때 늘 다시 계산하고, watcher 케이스가 결과를 검사합니다',
  'qh band changed (now 야간) -> true': '`qh`는 갱신 여부만 보는 화면 최적화입니다. watcher 케이스가 결과를 검사합니다',
  'qh amount differs -> true': '`qh`는 갱신 여부만 보는 화면 최적화입니다. watcher 케이스가 결과를 검사합니다',
  'qh non-telemedicine line -> false': '`qh`는 갱신 여부만 보는 화면 최적화입니다. watcher 케이스가 결과를 검사합니다',
}

describe('telemedicine-fee-lines fixture', () => {
  describe('fee line (Pd+Ed, 결정 1·2)', () => {
    it.each(cases('Pd+Ed').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const at = serviceAt(input['기준일시'])
      const line = telemedicineFeeLine(at, holidays(input['holidays']), feeMaster(at.date))
      const want = name in CHANGED ? CHANGED[name] : projectLegacy(expected['line'])
      expect(line === null ? null : project(line)).toEqual(want)
    })
  })

  describe('fee line code (xo, 결정 6)', () => {
    it.each(cases('xo').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      expect(isTelemedicineFeeCode(input['수가코드'])).toBe(expected['isTelemedicineFeeLine'])
    })
  })

  describe('toggle availability (jh, 결정 8)', () => {
    it.each(cases('jh').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const coverage: Record<string, Coverage> = {
        건보: 'NHIS',
        급여: 'MEDICAL_AID',
        자보: 'AUTO_INSURANCE',
        산재: 'INDUSTRIAL_ACCIDENT',
      }
      const available = telemedicineToggleAvailable({
        coverage: coverage[input['보험구분']]!,
        herbalPilot: Boolean(input['한방첩약시범사업']),
        homeVisit: Boolean(input['방문진료대상구분']) || input['방문진료료처방있음'] === true,
        telemedicine: input['비대면시범사업여부'] === true,
      })
      expect(available).toBe(expected['showTelemedicineToggle'])
    })
  })

  describe('toggle rebuild (Wh, 결정 3·4·5)', () => {
    it.each(cases('Wh').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const at = serviceAt(input['기준일시'])
      const result = reconcileTelemedicineLines({
        serviceAt: at,
        birthDate: birthDateFromRrn(input['주민번호앞자리'], input['주민번호뒷자리']),
        settings: toSettings(input['설정']),
        publicHolidays: holidays(input['holidays']),
        telemedicine: input['비대면지정됨'],
        autoInsuranceSecondVisit: false,
        lines: (input['처방목록'] as any[]).map(toLine),
        feeMaster: feeMaster(at.date, input['수가코드목록']),
      })
      const want = CHANGED[name] ?? { lines: (expected['처방목록'] as any[]).map(projectLegacy) }
      expect('lines' in result ? { lines: result.lines.map(project) } : result).toEqual(want)
      if ('lines' in result) expect(result.warnings).toEqual([])
    })
  })

  describe('save-time recalculation (Uv watcher, 결정 3·7)', () => {
    it.each(cases('Uv (watcher)').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      // 단계를 모두 적용한 마지막 상태입니다. 서버는 저장 요청마다 이 상태로 한 번 계산합니다
      const state = (input['steps'] as any[]).reduce(
        (current, step) => ({ ...current, ...step, 진료내용: { ...current['진료내용'], ...step['진료내용'] } }),
        input['initial'],
      )
      const record = state['진료내용']
      const at = serviceAt(record['기준일시'])
      const result = reconcileTelemedicineLines({
        serviceAt: at,
        birthDate: '1990-01-01',
        settings: WATCHER_SETTINGS,
        publicHolidays: holidays(state['holidays']),
        telemedicine: record['비대면시범사업여부'] === true,
        autoInsuranceSecondVisit: record['자보1일2차여부'] === true,
        lines: (record['처방'] as any[]).map(toLine),
        feeMaster: feeMaster(at.date, WATCHER_ROWS),
      })
      // 현행이 아무것도 내보내지 않으면 처방은 그대로입니다
      const emitted = expected['emitted'] as any[][]
      const legacyLines = (emitted.at(-1) ?? record['처방']).map(projectLegacy)
      const want =
        CHANGED[name] ??
        (REPRICED_CONSULTATION.has(name)
          ? {
              lines: legacyLines.map((line: any) =>
                line['수가코드'] === '10100' ? { ...line, 처방명: '초진진찰료', 금액: 10000, 단가: 10000 } : line,
              ),
            }
          : { lines: legacyLines })
      expect('lines' in result ? { lines: result.lines.map(project) } : result).toEqual(want)
      if ('lines' in result) expect(result.warnings).toEqual([])
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['Pd+Ed', 'xo', 'jh', 'Wh', 'Uv (watcher)'])
    const unaccounted = fixture.cases.filter((c) => !(c.name in NOT_PORTED) && !ported.has(c.input['fn']))
    expect(unaccounted.map((c) => c.name)).toEqual([])
    for (const names of [Object.keys(NOT_PORTED), Object.keys(CHANGED), [...REPRICED_CONSULTATION]]) {
      expect(names.filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    }
  })
})
