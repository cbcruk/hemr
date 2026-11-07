import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { serviceAt } from '../fees/legacy-fixture.ts'
import { pilotHerbalClaimIssues } from './pilot-herbal-claim-checks.ts'
import type { PilotHerbalClaimInput, PilotHerbalClaimLine, Rrn } from './pilot-herbal-claim-checks.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/pilot-herbal-claim-checks.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행은 검사마다 함수가 따로 있었고, 서버는 `pilotHerbalClaimIssues` 하나가 12종을 모두 판정합니다 (결정 1).
 * 개별 검사 케이스는 서버 결과에서 그 코드의 경고만 골라 비교합니다. 현행 원인 ID가 진료 ID면 서버는 진료 전체
 * 검사로 보고 `lineIds`를 비웁니다. 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/pilot-herbal-claim-checks.json'), 'utf8'),
) as { cases: FixtureCase[] }

type Issue = { code: string; lineIds: string[] }

function toLine(legacy: Record<string, any>): PilotHerbalClaimLine {
  const details = legacy['기타정보']
  return {
    lineId: legacy['id'],
    category: legacy['카테고리숫자코드'],
    feeCode: legacy['수가코드'] ?? null,
    name: legacy['처방명'] ?? '',
    hiraApproval: legacy['승인여부'] === true ? { status: 'APPROVED' } : null,
    herbalDetails:
      details === undefined
        ? null
        : {
            targetDisease: details['첩약대상질환코드'] ?? null,
            checklistSubmitted: details['첩건체크리스트제출여부'] ?? null,
          },
  }
}

function toRrn(legacy: Record<string, any> | undefined): Rrn | null {
  if (!legacy?.['주민등록번호앞자리']) return null
  return { front: legacy['주민등록번호앞자리'], back: legacy['주민등록번호뒷자리'] ?? '' }
}

function toInput(input: Record<string, any>): PilotHerbalClaimInput {
  const record = input['현재진료']
  const doctor = (input['진료의목록'] as any[] | undefined)?.find((each) => each['진료의Id'] === record['진료의Id'])
  return {
    encounterId: record['진료Id'],
    coverage: 'NHIS',
    pilotHerbal: { diseaseCode: record['한방첩약시범사업']['한방첩약상병구분코드'] },
    serviceAt: serviceAt(record['기준일시']),
    lines: (record['진료처방'] as any[]).map(toLine),
    diagnoses: (record['진료상병'] as any[]).map((diagnosis) => ({
      code: diagnosis['상병코드'],
      kind: diagnosis['상병분류구분'] === '주상병' ? ('PRIMARY' as const) : ('SECONDARY' as const),
    })),
    others: ((input['최근진료기록'] ?? []) as any[]).map((other) => ({
      encounterId: other['진료Id'],
      serviceAt: serviceAt(other['기준일시']),
      lines: (other['진료처방'] as any[]).map(toLine),
    })),
    patientRrn: toRrn(input['환자정보']),
    doctorRrn: toRrn(doctor),
  }
}

/** 서버 경고에서 정정 제안을 빼고 코드·줄만 남깁니다. 정정 제안은 단위 테스트가 검사합니다. */
function issuesOf(input: Record<string, any>, code?: string): Issue[] {
  return pilotHerbalClaimIssues(toInput(input))
    .filter((each) => code === undefined || each.code === code)
    .map(({ code: issueCode, lineIds }) => ({ code: issueCode, lineIds }))
}

/** 현행 경고를 서버 모양으로 옮깁니다. 원인이 진료 ID면 진료 전체 검사입니다. */
function legacyIssue(legacy: any, encounterId: string): Issue {
  const causes = legacy['원인제공자Ids'] as string[]
  return { code: legacy['에러코드'], lineIds: causes.filter((id) => id !== encounterId) }
}

const CHECK_CODES = [
  'C0001',
  'C0002',
  'C0003',
  'C0004',
  'C0005',
  'C0006',
  'C0007',
  'C0008',
  'C0009',
  'C0010',
  'C0011',
  'C0012',
]

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, Issue[]> = {
  // 결정 2: 날짜 차이는 양방향 절댓값이고, C0010은 같은 진료일만 봅니다
  'C0004: previous 심층변증 11 days before (still fires: Df argument order)': [],
  'C0004: previous 심층변증 365 days before still fires': [],
  'C0010: previous 첩약 1 day before': [],
  'C0010: previous 첩약 30 days before still fires': [],
  'C0010: other record 1 day after current: flagged': [],
  // 결정 2·12: 1월 1일과 1월 2일은 다른 날입니다
  'C0010: other record 23h59m after (same Df 0): flagged': [],
  // 결정 4: 조제·탕전료를 코드 목록으로 판정해 가산 코드를 찾습니다
  'C0007: Kp.조제탕전료 is undefined so check never fires (6-digit codes)': [{ code: 'C0007', lineIds: ['d1', 't1'] }],
  // 결정 7: 검사마다 독립적으로 판정하고 입력이 없으면 통과합니다
  'C0002: 첩약 line without 기타정보 throws': [],
  'C0008: disease 00 has no wU entry: throws': [],
  // 결정 8: 제1부상병만 봅니다
  'C0009: disease 03 with 부상병 U234 (any position)': [{ code: 'C0009', lineIds: [] }],
  // 함께 반영한 결정: C0011은 원인 처방 줄을 줍니다
  'C0011: 기능성소화불량 with 마황정천탕': [{ code: 'C0011', lineIds: ['h1'] }],
  'C0011: 기능성소화불량 with 보폐원탕': [{ code: 'C0011', lineIds: ['h1'] }],
  // 결정 1: 12종을 모두 돌려줍니다. C0004는 14일 전이라 결정 2로 빠집니다
  'tBt: all checks firing: only C0001, C0003, C0005 are returned': [
    { code: 'C0001', lineIds: ['a'] },
    { code: 'C0002', lineIds: ['h1'] },
    { code: 'C0003', lineIds: ['m1'] },
    { code: 'C0005', lineIds: ['h1'] },
    { code: 'C0006', lineIds: ['h1'] },
    { code: 'C0008', lineIds: [] },
    { code: 'C0011', lineIds: ['h1'] },
  ],
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'C0004: missing 기준일시': '진료의 `serviceAt`은 필수라 서버 입력으로 성립하지 않습니다 (결정 3)',
  'HFt: treatment-screen warnings keep C0001 and C0003, drop C0005':
    '서버에는 화면 허용 목록 필터가 없습니다 (결정 1). 모든 경고가 남는 것은 tBt 케이스가 검사합니다',
}

function cases(predicate: (input: Record<string, any>) => boolean): FixtureCase[] {
  return fixture.cases.filter((testCase) => predicate(testCase.input) && !(testCase.name in NOT_PORTED))
}

describe('첩약 시범사업 청구 검사 픽스처 (pilot-herbal-claim-checks)', () => {
  describe('개별 검사 (C0001–C0012, 결정 2–10·12)', () => {
    it.each(cases((input) => CHECK_CODES.includes(input['check'])).map((c) => [c.name, c] as const))(
      '%s',
      (name, { input, expected }) => {
        const returned = expected['returned']
        const want =
          CHANGED[name] ?? (returned === 'undefined' ? [] : [legacyIssue(returned, input['현재진료']['진료Id'])])
        expect(issuesOf(input, input['check'])).toEqual(want)
      },
    )
  })

  describe('전체 검사 (tBt, 결정 1)', () => {
    it.each(cases((input) => input['check'] === 'tBt').map((c) => [c.name, c] as const))(
      '%s',
      (name, { input, expected }) => {
        const encounterId = input['현재진료']['진료Id']
        const want = CHANGED[name] ?? (expected['returned'] as any[]).map((each) => legacyIssue(each, encounterId))
        expect(issuesOf(input)).toEqual(want)
      },
    )
  })

  it('HFt: 자보이거나 한방첩약시범사업이 비어 있으면 검사하지 않습니다 (결정 11)', () => {
    const testCase = fixture.cases.find(
      (c) => c.name === 'HFt: tBt not called for 자보 or when 한방첩약시범사업 is empty',
    )!
    expect(testCase.expected['tBtCalled']).toBe(false)
    const base = toInput(fixture.cases.find((c) => c.input['check'] === 'tBt')!.input)
    expect(pilotHerbalClaimIssues(base)).not.toEqual([])
    expect(pilotHerbalClaimIssues({ ...base, pilotHerbal: null })).toEqual([])
    expect(pilotHerbalClaimIssues({ ...base, coverage: 'AUTO_INSURANCE' })).toEqual([])
  })

  it('모든 픽스처 케이스를 이식했거나 이식하지 않은 이유를 적었고 예외 목록은 있는 케이스만 가리킵니다', () => {
    const ported = new Set([...CHECK_CODES, 'tBt'])
    const unaccounted = fixture.cases.filter(
      (testCase) =>
        !(testCase.name in NOT_PORTED) &&
        !ported.has(testCase.input['check']) &&
        testCase.name !== 'HFt: tBt not called for 자보 or when 한방첩약시범사업 is empty',
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
