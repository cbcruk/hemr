import { describe, expect, it } from 'vitest'
import { chunaUsageSummary, industrialAccidentPriorDays, judgeChunaAnnualLimit } from './chuna-annual-limit.ts'
import type { ChunaAnnualLimitInput, ChunaEncounter, HiraChunaRow } from './chuna-annual-limit.ts'

const AT = { date: '2026-11-01', time: '10:00' }
const CHUNA = { lineId: 'c1', feeCode: '40710', category: '33001005' }

/** 2026년 1월 1일부터 하루씩 다른 날짜의 우리 기관 행 `count`개입니다. */
function rows(count: number): HiraChunaRow[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)
    return { serviceDate: date, deleted: false, ownClinic: true }
  })
}

function input(overrides: Partial<ChunaAnnualLimitInput> = {}): ChunaAnnualLimitInput {
  return {
    encounterId: 'cur',
    coverage: 'NHIS',
    serviceAt: AT,
    lines: [CHUNA],
    hiraUsage: { rows: rows(19), cumulativeCount: null, complete: true },
    others: [],
    ...overrides,
  }
}

describe('추나 사용량 요약 (chunaUsageSummary)', () => {
  it('20회째 시행은 자기 제출분이 누적에 들어가기 전과 뒤에 이전 시행 수가 같습니다', () => {
    const context = { serviceAt: AT, limit: 20 }
    const before = chunaUsageSummary({ rows: rows(19), cumulativeCount: null, complete: true }, context)
    const today = { serviceDate: AT.date, deleted: false, ownClinic: true }
    const after = chunaUsageSummary({ rows: [...rows(19), today], cumulativeCount: 20, complete: true }, context)
    expect(before.priorCount).toBe(19)
    expect(after.priorCount).toBe(19)
    expect(after.exhausted).toBe(false)
  })

  it('과거 진료를 다시 열면 진료일과 그 뒤의 시행은 세지 않습니다', () => {
    const tenth = { date: rows(10)[9]!.serviceDate, time: '10:00' }
    const usage = { rows: rows(25), cumulativeCount: 25, complete: true }
    expect(chunaUsageSummary(usage, { serviceAt: tenth, limit: 20 })).toMatchObject({ priorCount: 9, exhausted: false })
  })

  it('당일 시행 여부는 실제 오늘이 아니라 진료일로 판정합니다', () => {
    const usage = { rows: rows(3), cumulativeCount: null, complete: true }
    const past = { date: '2026-01-02', time: '10:00' }
    expect(chunaUsageSummary(usage, { serviceAt: past, limit: 20 }).sameDay).toBe(true)
    expect(chunaUsageSummary(usage, { serviceAt: AT, limit: 20 }).sameDay).toBe(false)
  })
})

describe('추나 한도 판정 (judgeChunaAnnualLimit)', () => {
  it('20회째는 통과하고 21회째는 완료를 막습니다', () => {
    expect(judgeChunaAnnualLimit(input())).toEqual({ warnings: [], accepted: true })
    const usage = { rows: rows(20), cumulativeCount: null, complete: true }
    expect(judgeChunaAnnualLimit(input({ hiraUsage: usage }))).toEqual({
      warnings: [{ code: 'CHUNA_ANNUAL_LIMIT', lineIds: ['c1'], priorCount: 20, limit: 20, blocksCompletion: true }],
      accepted: false,
    })
  })

  it('잘린 사용량 목록은 판정하지 않고 사용량 미확인 경고만 냅니다', () => {
    const usage = { rows: rows(25), cumulativeCount: null, complete: false }
    expect(judgeChunaAnnualLimit(input({ hiraUsage: usage }))).toEqual({
      warnings: [{ code: 'CHUNA_USAGE_UNKNOWN', lineIds: ['c1'], blocksCompletion: false }],
      accepted: true,
    })
  })

  it('일반 진료와 추나 줄이 없는 진료는 판정하지 않습니다', () => {
    expect(judgeChunaAnnualLimit(input({ coverage: 'SELF_PAY', hiraUsage: null })).warnings).toEqual([])
    const acupuncture = { lineId: 'a1', feeCode: '40011', category: '33001001' }
    expect(judgeChunaAnnualLimit(input({ lines: [acupuncture], hiraUsage: null })).warnings).toEqual([])
  })

  it('산재는 21번째 시행일에 완료를 막습니다', () => {
    const others: ChunaEncounter[] = rows(20).map((row, index) => ({
      encounterId: `old${index}`,
      coverage: 'INDUSTRIAL_ACCIDENT',
      serviceAt: { date: row.serviceDate, time: '10:00' },
      lines: [{ feeCode: '40720', category: '' }],
    }))
    const result = judgeChunaAnnualLimit(input({ coverage: 'INDUSTRIAL_ACCIDENT', hiraUsage: null, others }))
    expect(result.accepted).toBe(false)
    expect(result.warnings).toEqual([
      { code: 'CHUNA_ANNUAL_LIMIT', lineIds: ['c1'], priorCount: 20, limit: 20, blocksCompletion: true },
    ])
  })
})

describe('산재 이전 시행 일수 (industrialAccidentPriorDays)', () => {
  it('한 날은 한 번만 세고 현재 진료일과 그 뒤 날짜는 세지 않습니다', () => {
    const encounter = (encounterId: string, date: string): ChunaEncounter => ({
      encounterId,
      coverage: 'INDUSTRIAL_ACCIDENT',
      serviceAt: { date, time: '10:00' },
      lines: [
        { feeCode: '40710', category: '' },
        { feeCode: '40730', category: '' },
      ],
    })
    const others = [
      encounter('a', '2026-03-01'),
      encounter('b', '2026-03-01'),
      encounter('c', AT.date),
      encounter('d', '2026-12-01'),
    ]
    expect(industrialAccidentPriorDays({ encounterId: 'cur', serviceAt: AT }, others)).toBe(1)
  })
})
