import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import { coverageMismatchLineIds } from './coverage-category-band.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/coverage-category-band.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 `GD(처방목록, 보험구분, 첩건시범사업, 비대면)`의 입력을 진료 문맥으로 바꾸고, 결정
 * (`docs/design/rule-decisions.md`의 coverage-category-band)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: { invalidLineIds: string[] }
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/coverage-category-band.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = {
  건보: 'NHIS',
  급여: 'MEDICAL_AID',
  자보: 'AUTO_INSURANCE',
  산재: 'INDUSTRIAL_ACCIDENT',
  일반: 'SELF_PAY',
}

/** 결정으로 기대값이 바뀐 케이스입니다. 현행 결과에 더할 줄입니다. 이 규칙의 결정은 차단을 넓히기만 해서 빼는 줄은 없습니다. */
const CHANGED: Record<string, string[]> = {
  // 결정 3: `91000…` 코드도 비대면 시범사업 진료에서만 씁니다
  '건보 without pilot: all line types': ['l-91000'],
  '건보 with 첩건시범사업 object: 35 lines allowed': ['l-91000'],
  '급여 (의료급여): all line types': ['l-91000'],
  '급여 with pilot object: 35 still invalid (pilot only for 건보)': ['l-91000'],
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'empty 보험구분 string: all line types': '보험구분은 필수 enum이라 빈 값은 요청 스키마가 400으로 막습니다',
}

describe('보험구분과 처방 카테고리 픽스처 (GD, 결정 1·2·3)', () => {
  const cases = fixture.cases.filter((testCase) => !(testCase.name in NOT_PORTED))

  it.each(cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const lines = (input['처방목록'] as any[]).map((line) => ({
      lineId: line['id'],
      category: line['카테고리숫자코드'],
      feeCode: line['수가코드'],
    }))
    const result = coverageMismatchLineIds(lines, {
      coverage: COVERAGE[input['보험구분']]!,
      herbalPilot: Boolean(input['첩건시범사업']),
      telemedicinePilot: input['비대면시범사업'] === true,
    })
    // 결과는 처방 순서이므로 더한 줄도 처방 순서로 맞춥니다
    const want = new Set([...expected.invalidLineIds, ...(CHANGED[name] ?? [])])
    expect(result).toEqual(lines.map((line) => line.lineId).filter((id) => want.has(id)))
  })

  it('예외 목록의 이름은 모두 픽스처에 있고 더할 줄은 현행 결과와 겹치지 않습니다', () => {
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    // 더할 줄이 이미 현행 결과에 있으면 낡은 항목입니다
    const redundant = Object.entries(CHANGED).filter(([name, ids]) =>
      ids.some((id) => fixture.cases.find((c) => c.name === name)?.expected.invalidLineIds.includes(id)),
    )
    expect(redundant.map(([name]) => name)).toEqual([])
  })
})
