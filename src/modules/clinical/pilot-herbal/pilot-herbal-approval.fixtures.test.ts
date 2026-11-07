import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pilotHerbalApprovalViolation, pilotHerbalLineRejection } from './pilot-herbal-approval.ts'
import type { PilotHerbalApprovalLine, TenantProduct } from './pilot-herbal-approval.ts'
import { pilotHerbalClaimIssues } from './pilot-herbal-claim-checks.ts'
import type { PilotHerbalClaimInput } from './pilot-herbal-claim-checks.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/pilot-herbal-approval-required.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 `승인여부`는 줄의 `hiraApproval.status == APPROVED`로 읽습니다 (결정 5). 완료 검사는
 * `pilotHerbalApprovalViolation`, C0005는 청구 검사 `pilotHerbalClaimIssues`가 판정합니다. 현행과 기대값이 다른
 * 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../../test/fixtures/rules/pilot-herbal-approval-required.json'),
    'utf8',
  ),
) as { cases: FixtureCase[] }

function toLine(legacy: Record<string, any>): PilotHerbalApprovalLine {
  return {
    lineId: legacy['id'],
    category: legacy['카테고리숫자코드'],
    hiraApproval:
      legacy['승인여부'] === true
        ? { status: 'APPROVED' }
        : legacy['승인여부'] === false
          ? { status: 'PENDING' }
          : null,
  }
}

/** 첩약 시범사업 건보 진료의 청구 검사 입력입니다. 승인 외 검사가 걸리지 않게 나머지는 비워 둡니다. */
function claimInput(lines: PilotHerbalApprovalLine[]): PilotHerbalClaimInput {
  return {
    encounterId: 'cur',
    coverage: 'NHIS',
    pilotHerbal: { diseaseCode: '01' },
    serviceAt: { date: '2026-01-15', time: '10:00' },
    lines: lines.map((line) => ({
      lineId: line.lineId,
      category: line.category,
      feeCode: null,
      name: '',
      hiraApproval: line.hiraApproval,
      herbalDetails: null,
    })),
    diagnoses: [{ code: 'N944', kind: 'PRIMARY' }],
    others: [],
    patientRrn: null,
    doctorRrn: null,
  }
}

const c0005 = (lines: PilotHerbalApprovalLine[]) =>
  pilotHerbalClaimIssues(claimInput(lines)).filter((each) => each.code === 'C0005')

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 3: C0005도 모든 첩약 줄을 봅니다
  'claim C0005: only the first pilot line is inspected': [{ code: 'C0005', lineIds: ['b'] }],
}

const lines = (input: Record<string, any>) => (input['prescriptions'] as any[]).map(toLine)

/** 현행 계정 서비스(`soo`·`emr`)를 테넌트 제품으로 읽습니다. */
const productsOf = (input: Record<string, any>) =>
  (input['flow']['accountServices'] as string[]).map((each) => each.toUpperCase() as TenantProduct)

/**
 * 화면 흐름을 추적한 케이스입니다. 서버에는 완료 경로 구분이 없으므로 판정 함수가 경로 입력 없이 막는지를 봅니다
 * (결정 2). 완료 서비스가 모든 경로에서 이 검사를 부르는지는 완료 서비스를 만들 때 테스트합니다.
 */
const TRACED: Record<string, (input: Record<string, any>, expected: any) => void> = {
  // 결정 2: SOO 단독 테넌트는 줄을 만들 수 없고, 줄이 있으면 완료가 막힙니다
  'flow: SOO-only account skips the approval check': (input, expected) => {
    expect(expected['approvalChecked']).toBe(false)
    expect(pilotHerbalLineRejection('35001001', productsOf(input))).toBe('PILOT_HERBAL_NOT_AVAILABLE')
    expect(pilotHerbalApprovalViolation(lines(input))).toEqual({
      code: 'PILOT_HERBAL_NOT_APPROVED',
      lineIds: ['a'],
      blocksCompletion: true,
    })
  },
  // 결정 2: 비대면 SOO 주문 완료도 같은 검사로 막힙니다
  'flow: non-face-to-face SOO order completion skips save and approval check': (input, expected) => {
    expect(expected['approvalChecked']).toBe(false)
    expect(pilotHerbalLineRejection('35001001', productsOf(input))).toBeNull()
    expect(pilotHerbalApprovalViolation(lines(input))?.lineIds).toEqual(['a'])
  },
  // 결정 4: 저장은 C0005 warning과 함께 통과하고 완료만 막습니다
  'flow: normal account with unapproved line stops before save and done': (input, expected) => {
    expect(expected['completes']).toBe(false)
    expect(c0005(lines(input)).map((each) => each.lineIds)).toEqual([['a']])
    expect(pilotHerbalApprovalViolation(lines(input))?.blocksCompletion).toBe(true)
  },
  // 결정 4: 진료 저장 응답에도 C0005가 남습니다
  'realtime claim warning: C0005 is computed but filtered out of treatment-screen warnings': (input, expected) => {
    expect(expected['warningCodes']).toEqual([])
    expect(pilotHerbalClaimIssues(claimInput(lines(input))).map((each) => each.code)).toEqual(['C0005'])
  },
}

describe('첩약 승인 필수 픽스처 (pilot-herbal-approval-required)', () => {
  describe('완료 검사 (결정 1·5)', () => {
    it.each(
      fixture.cases.filter((c) => c.input['function'] === 'finishApprovalCheck').map((c) => [c.name, c] as const),
    )('%s', (_name, { input, expected }) => {
      expect(pilotHerbalApprovalViolation(lines(input)) === null).toBe(expected['returned'])
    })
  })

  describe('청구 검사 C0005 (결정 3)', () => {
    it.each(fixture.cases.filter((c) => c.input['function'] === 'claimCheckC0005').map((c) => [c.name, c] as const))(
      '%s',
      (name, { input, expected }) => {
        const returned = expected['returned']
        const want =
          CHANGED[name] ??
          (returned === 'undefined' ? [] : [{ code: returned['에러코드'], lineIds: returned['원인제공자Ids'] }])
        expect(c0005(lines(input)).map(({ code, lineIds }) => ({ code, lineIds }))).toEqual(want)
      },
    )
  })

  describe('완료 흐름 (추적, 결정 2·4)', () => {
    it.each(Object.keys(TRACED).map((name) => [name] as const))('%s', (name) => {
      const testCase = fixture.cases.find((c) => c.name === name)!
      TRACED[name]!(testCase.input, testCase.expected)
    })
  })

  it('모든 픽스처 케이스를 이식했거나 추적했고 예외 목록은 있는 케이스만 가리킵니다', () => {
    const unaccounted = fixture.cases.filter(
      (c) => !['finishApprovalCheck', 'claimCheckC0005'].includes(c.input['function']) && !(c.name in TRACED),
    )
    expect(unaccounted.map((c) => c.name)).toEqual([])
    expect(Object.keys(TRACED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
