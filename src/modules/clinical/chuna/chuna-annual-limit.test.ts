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

describe('chunaUsageSummary', () => {
  it('gives the same answer for the 20th session before and after its own submission is counted', () => {
    const context = { serviceAt: AT, limit: 20 }
    const before = chunaUsageSummary({ rows: rows(19), cumulativeCount: null, complete: true }, context)
    const today = { serviceDate: AT.date, deleted: false, ownClinic: true }
    const after = chunaUsageSummary({ rows: [...rows(19), today], cumulativeCount: 20, complete: true }, context)
    expect(before.priorCount).toBe(19)
    expect(after.priorCount).toBe(19)
    expect(after.exhausted).toBe(false)
  })

  it('does not count later sessions when a past encounter is reopened', () => {
    const tenth = { date: rows(10)[9]!.serviceDate, time: '10:00' }
    const usage = { rows: rows(25), cumulativeCount: 25, complete: true }
    expect(chunaUsageSummary(usage, { serviceAt: tenth, limit: 20 })).toMatchObject({ priorCount: 9, exhausted: false })
  })

  it('judges the same day by the service date, not the real today', () => {
    const usage = { rows: rows(3), cumulativeCount: null, complete: true }
    const past = { date: '2026-01-02', time: '10:00' }
    expect(chunaUsageSummary(usage, { serviceAt: past, limit: 20 }).sameDay).toBe(true)
    expect(chunaUsageSummary(usage, { serviceAt: AT, limit: 20 }).sameDay).toBe(false)
  })
})

describe('judgeChunaAnnualLimit', () => {
  it('allows the 20th session and blocks the 21st', () => {
    expect(judgeChunaAnnualLimit(input())).toEqual({ warnings: [], accepted: true })
    const usage = { rows: rows(20), cumulativeCount: null, complete: true }
    expect(judgeChunaAnnualLimit(input({ hiraUsage: usage }))).toEqual({
      warnings: [{ code: 'CHUNA_ANNUAL_LIMIT', lineIds: ['c1'], priorCount: 20, limit: 20, blocksCompletion: true }],
      accepted: false,
    })
  })

  it('does not judge a truncated usage list', () => {
    const usage = { rows: rows(25), cumulativeCount: null, complete: false }
    expect(judgeChunaAnnualLimit(input({ hiraUsage: usage }))).toEqual({
      warnings: [{ code: 'CHUNA_USAGE_UNKNOWN', lineIds: ['c1'], blocksCompletion: false }],
      accepted: true,
    })
  })

  it('skips self-pay and encounters without chuna', () => {
    expect(judgeChunaAnnualLimit(input({ coverage: 'SELF_PAY', hiraUsage: null })).warnings).toEqual([])
    const acupuncture = { lineId: 'a1', feeCode: '40011', category: '33001001' }
    expect(judgeChunaAnnualLimit(input({ lines: [acupuncture], hiraUsage: null })).warnings).toEqual([])
  })

  it('blocks the 21st industrial accident session day', () => {
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

describe('industrialAccidentPriorDays', () => {
  it('counts a day once and skips the current service date and later days', () => {
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
