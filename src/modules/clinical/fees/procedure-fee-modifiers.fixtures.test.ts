import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { birthDateFromRrn, procedureFromLegacy, serviceAt } from './legacy-fixture.ts'
import { procedureFeeCode, procedureFeeLines } from './procedure-fee-modifiers.ts'
import type { FeeMasterRow, PrescriptionFeeLine } from './procedure-fee-modifiers.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/procedure-fee-modifiers.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(주민번호, `yyyyMMddHHmm`, 한글 플래그)을 서버 입력(생년월일, 진료 시각, 줄 속성)으로 바꾸고,
 * 결정(`docs/design/rule-decisions.md`의 procedure-fee-modifiers)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/procedure-fee-modifiers.json'), 'utf8'),
) as { cases: FixtureCase[] }

function toLine(legacy: Record<string, any>): PrescriptionFeeLine & { id: string } {
  return {
    id: legacy['id'],
    feeCode: legacy['수가코드'],
    category: legacy['카테고리숫자코드'],
    name: legacy['처방명'],
    // 결정 6: 현행 `금액`은 단가, `단가`는 금액입니다
    unitPrice: legacy['금액'],
    amount: legacy['단가'],
    dailyDose: legacy['일투여량'],
    days: legacy['투약일수'],
  }
}

function toMaster(rows: Record<string, any>[]): Map<string, FeeMasterRow> {
  return new Map(
    rows.map((row) => [
      row['수가코드'],
      { name: row['한글명'], claimName: row['한글명_산정명칭'], unitPrice: Number(row['한방병의원단가']) },
    ]),
  )
}

function cases(fn: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['fn'] === fn && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 생후 한 달 안의 신생아도 정확한 나이·생후 일수로 계산합니다
  'born 2026-02-10, visit 2026-03-04 (22 days) -> null: age calc null within one month (suspected bug)': {
    code: '40011100',
  },
  'born 2028-02-01, visit 2028-02-29 (28 days, leap year) -> null: age calc null (suspected bug)': {
    code: '40011100',
  },
  // 결정 3: 조제료는 시간대 자리를 붙이는 코드 종류가 아닙니다
  'flag 야간임 on 조제료 -> 010 (no code-type check)': { code: null },
  // 결정 7: 서버가 계산한 8자리를 다시 계산해 가산이 없어지면 기본코드로 돌아갑니다
  '8-digit input with 산정코드재설정, adult -> null (all zero, caller keeps old 8-digit)': { code: '40011' },
  // 결정 5: 줄은 그대로 두고 마스터 누락을 경고합니다
  'age 3: 부항 600 code missing from fee list -> line unchanged': {
    warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['40030600'] }],
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'missing 설정 -> null': '진료설정은 병원마다 기본값으로 만들어지므로 없는 상태가 없습니다',
  'missing 기준일시 -> null': '진료의 `serviceAt`은 필수라 없는 상태가 없습니다',
  'missing 환자 -> null': '진료는 항상 환자에 속하므로 없는 상태가 없습니다. 생년월일을 모르면 `birthDate: null`입니다',
}

describe('procedure-fee-modifiers fixture', () => {
  describe('single code (JLt, 결정 1·2·3·4·7)', () => {
    it.each(cases('JLt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const { line, context } = procedureFromLegacy(input)
      const want = (CHANGED[name] ?? expected) as { code: string | null }
      expect(procedureFeeCode(line, context)).toEqual(want.code)
    })
  })

  describe('prescription lines (ZLt, 결정 5·6)', () => {
    it.each(cases('ZLt').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const patient = input['환자']
      const result = procedureFeeLines({
        serviceAt: serviceAt(input['기준일시']),
        birthDate: birthDateFromRrn(patient['주민등록번호앞자리'] ?? '', patient['주민등록번호뒷자리'] ?? ''),
        ageSurcharge: input['설정']['연령에따른시술료가산적용여부'],
        lines: (input['처방목록'] as any[]).map(toLine),
        feeMaster: toMaster(input['수가코드목록']),
        telemedicine: input['비대면진료임'] === true,
      })
      const want = (CHANGED[name] ?? {}) as { warnings?: unknown[] }

      expect(result.lines.map(({ feeCodeComputed: _, ...line }) => line)).toEqual(
        (expected['처방목록'] as any[]).map(toLine),
      )
      expect(result.warnings).toEqual(want.warnings ?? [])
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['JLt', 'ZLt'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['fn']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
