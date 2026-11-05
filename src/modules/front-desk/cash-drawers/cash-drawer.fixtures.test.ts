import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cashDrawerStatus, cashFlow, closingDifference } from './cash-drawer.ts'
import type { CashDrawerStatus, CashMovement } from './cash-drawer.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/cash-drawer-expected-closing.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(서버 `현금흐름` 또는 수납·지출 목록)을 원장 기록으로 바꾸고, 결정
 * (`docs/design/rule-decisions.md`의 cash-drawer-expected-closing)에 따른 기대값으로 검사합니다.
 * 서버는 fallback 없이 늘 원장으로 계산하므로, 현행의 두 경로가 모두 같은 계산으로 옮겨집니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/cash-drawer-expected-closing.json'), 'utf8'),
) as { cases: FixtureCase[] }

const STATUS: Record<string, CashDrawerStatus> = {
  미등록: 'NOT_OPENED',
  정산전: 'OPEN',
  정산완료: 'CLOSED',
  정산후수정: 'REOPENED',
}

/** 서버 `현금흐름`의 구성값을 원장 기록으로 바꿉니다. `예상마감금액`은 쓰지 않고 다시 계산합니다 (결정 3). */
function fromCashFlow(flow: Record<string, number>): CashMovement[] {
  return [
    { kind: 'PAYMENT', method: 'CASH', amount: flow['수납현금']! },
    { kind: 'PREPAID_CHARGE', method: 'CASH', amount: flow['선수금현금충전']! },
    { kind: 'REFUND', method: 'CASH', amount: flow['수납현금환불']! },
    { kind: 'REFUND', method: 'CASH', amount: flow['선수금현금환불']! },
    { kind: 'EXPENSE', amount: flow['지출']! },
  ]
}

/**
 * 수납·지출 목록을 원장 기록으로 바꿉니다. 수납 행만 씁니다.
 *
 * 서버는 환불 기록의 수단으로 현금 환불을 정합니다 (결정 2). 현행 픽스처에는 환불 수단이 없어, 현금이 들어 있는
 * 행의 환불은 현금으로 돌려줬다고 가정합니다. 현행은 현금만 있는 행의 환불만 셌습니다.
 */
function fromLists(receipts: any[], expenses: any[]): CashMovement[] {
  const movements: CashMovement[] = []
  for (const row of receipts.filter((receipt) => receipt['행유형'] === '수납')) {
    const payment = row['결제정보'] as Record<string, number>
    if (payment['현금']) movements.push({ kind: 'PAYMENT', method: 'CASH', amount: payment['현금'] })
    if (payment['카드']) movements.push({ kind: 'PAYMENT', method: 'CARD', amount: payment['카드'] })
    if (row['환불']) {
      movements.push({ kind: 'REFUND', method: '현금' in payment ? 'CASH' : 'CARD', amount: row['환불'] })
    }
  }
  for (const expense of expenses) movements.push({ kind: 'EXPENSE', amount: expense['지출금액'] })
  return movements
}

function cases(check: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['check'] === check)
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, Record<string, number>> = {
  // 결정 3: 서버 합계를 그대로 쓰지 않고 구성값으로 계산합니다
  'server cash flow present but inconsistent -> still server value': { 예상마감금액: 150_000 },
  // 결정 2: 섞인 수납 행의 환불도 현금 환불이면 셉니다
  'fallback: start + cash receipts - (expenses + cash-only refunds)': { 현금환불: 6000, 예상마감금액: 126_500 },
  'fallback: refund on mixed cash+card receipt is not counted as cash refund': { 현금환불: 2000, 예상마감금액: 8000 },
}

describe('cash-drawer-expected-closing fixture', () => {
  describe('expected closing (결정 1·2·3: 늘 원장으로 계산)', () => {
    it.each(cases('expectedClosing').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const register = input['cashRegister']
      const movements = register['현금흐름']
        ? fromCashFlow(register['현금흐름'])
        : fromLists(input['receipts'], input['expenses'])
      // 열지 않은 시재(시작 금액 없음)는 시작 금액 0으로 계산합니다
      const flow = cashFlow(register['시작금액'] ?? 0, movements)
      const want = { ...expected, ...CHANGED[name] }

      expect({
        현금수납: flow.cashIn,
        현금환불: flow.cashRefunds,
        현금지출: flow.expenses,
        예상마감금액: flow.expectedClosing,
      }).toEqual({
        현금수납: want.현금수납,
        현금환불: want.현금환불,
        현금지출: want.현금지출,
        예상마감금액: want.예상마감금액,
      })
      const counted = register['마감금액']
      const differs = counted != null && closingDifference(counted, flow.expectedClosing) !== 0
      expect(differs).toBe(want.is재정산필요)
    })
  })

  describe('drawer status (결정 5)', () => {
    it.each(cases('cashRegisterState').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const status = cashDrawerStatus({
        opened: input['시작금액'] !== null,
        closed: input['현금정산일시'] !== null,
        reopenedSinceLastClose: input['마감후수정여부'] === true,
      })
      expect(status).toBe(STATUS[expected])
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['expectedClosing', 'cashRegisterState'])
    expect(fixture.cases.filter((testCase) => !ported.has(testCase.input['check'])).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
