import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  externalPaymentAmountMismatch,
  externalPrecheckGate,
  externalPrecheckMessage,
  herbLineQuantity,
  packBasedQuantity,
} from './external-herbal-precheck.ts'
import type { ExternalPaymentMethod, ExternalPrecheckCall } from './external-herbal-precheck.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/external-herbal-precheck.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 precheck 결과(`response.data.result`)는 `data` 래퍼 안에 판정이 있습니다. 서버에서는 연동 어댑터가 래퍼를
 * 벗겨 본문만 넘기므로, 테스트 어댑터도 `data`가 있으면 벗기고 없으면 그대로 넘깁니다. 현행과 기대값이 다른
 * 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/external-herbal-precheck.json'), 'utf8'),
) as { cases: FixtureCase[] }

/** 결제 진행 여부·HTTP 상태·화면 문구로 줄인 precheck 판정입니다. */
interface GateView {
  proceed: boolean
  status: number | null
  message: string | null
}

function toCall(precheck: Record<string, any>): ExternalPrecheckCall {
  if (precheck['kind'] === 'reject') return { kind: 'UNREACHABLE' }
  const value = precheck['value']
  return { kind: 'RESPONDED', body: value?.['data'] ?? value }
}

function gateView(call: ExternalPrecheckCall): GateView {
  const gate = externalPrecheckGate(call)
  if (gate.ok) return { proceed: true, status: null, message: null }
  return {
    proceed: false,
    status: gate.status,
    message: gate.status === 422 ? externalPrecheckMessage(gate.result) : null,
  }
}

const PAYMENT_TYPE: Record<string, ExternalPaymentMethod['type']> = { 예치금카드: 'DEPOSIT_CARD', 일반카드: 'CARD' }

const toMethods = (legacy: any[]): ExternalPaymentMethod[] =>
  legacy.map((each) => ({ type: PAYMENT_TYPE[each['결제수단유형']]!, amount: each['입력금액'] }))

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 외부 시스템에 닿지 않으면 503으로 막습니다
  'precheckGate: network error / 5xx swallowed -> proceeds': { proceed: false, status: 503, message: null },
  'precheckGate: 404 endpoint missing swallowed -> proceeds': { proceed: false, status: 503, message: null },
  // 결정 2: `ok === true`일 때만 통과합니다
  'precheckGate: null result -> TypeError swallowed -> proceeds': {
    proceed: false,
    status: 422,
    message: '주문 확인 실패: 수량·재고를 확인해주세요.',
  },
  'precheckGate: result without .data wrapper (ok:false at top level) -> proceeds': {
    proceed: false,
    status: 422,
    message: '주문 확인 실패: 재고 부족',
  },
  'precheckGate: ok missing (undefined) -> proceeds': {
    proceed: false,
    status: 422,
    message: '주문 확인 실패: 수량·재고를 확인해주세요.',
  },
  // 결정 5: 서버는 금액을 다시 나누지 않고, 합이 결제액과 다르거나 0원 이하 수단이 있으면 422입니다
  'allocatePaymentMethods: general card absorbs remainder': {
    code: 'PAYMENT_AMOUNT_MISMATCH',
    reason: 'NON_POSITIVE_AMOUNT',
    payable: 50000,
    total: 30000,
  },
  'allocatePaymentMethods: deposit cards trimmed from last when over total': {
    code: 'PAYMENT_AMOUNT_MISMATCH',
    reason: 'TOTAL',
    payable: 40000,
    total: 70000,
  },
  'allocatePaymentMethods: no general card: last deposit card topped up': {
    code: 'PAYMENT_AMOUNT_MISMATCH',
    reason: 'TOTAL',
    payable: 25000,
    total: 20000,
  },
  'allocatePaymentMethods: zero-amount methods dropped': {
    code: 'PAYMENT_AMOUNT_MISMATCH',
    reason: 'TOTAL',
    payable: 50000,
    total: 55000,
  },
  'allocatePaymentMethods: server total 0 leaves input unchanged': {
    code: 'PAYMENT_AMOUNT_MISMATCH',
    reason: 'TOTAL',
    payable: 0,
    total: 100,
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'precheckGate: mock mode (no client) skips precheck':
    '서버에는 연동 없는 모의 모드가 없고 precheck를 건너뛰지 않습니다 (결정 1)',
  'allocatePaymentMethods: server total null leaves input unchanged':
    '`:place`는 결제액이 있는 견적으로만 받습니다. 결제액 없는 견적이 없습니다 (결정 5)',
  'normalizeQuote: non-positive amounts become null': '견적 응답 해석은 외부 탕전원 연동 어댑터를 만들 때 옮깁니다',
  'normalizeQuote: missing quote': '견적 응답 해석은 외부 탕전원 연동 어댑터를 만들 때 옮깁니다',
  'duplicatePaymentRisk: external paid but EMR failed -> duplicate-payment risk':
    '서버가 오류 문구 대신 주문 상태와 오류 코드로 알립니다. 같은 견적의 재결제 차단은 `:place`를 만들 때 테스트합니다',
  'duplicatePaymentRisk: other axios error': '서버에는 오류 문구로 중복 결제를 판별하는 판정이 없습니다',
  'duplicatePaymentRisk: non-axios error': '서버에는 오류 문구로 중복 결제를 판별하는 판정이 없습니다',
}

const RUN: Record<string, (input: Record<string, any>) => unknown> = {
  precheckGate: (input) => gateView(toCall(input['precheckResult'])),
  herbLineQuantity: (input) => ({ quantity: herbLineQuantity(Number(input['첩당용량g']), Number(input['첩수'])) }),
  packBasedQuantity: (input) => ({ quantity: packBasedQuantity(input['팩수'], input['과금팩수']) }),
  allocatePaymentMethods: (input) =>
    externalPaymentAmountMismatch(toMethods(input['methods']), input['serverPaymentAmount']),
}

/** 현행 기대값을 서버 판정 모양으로 옮깁니다. 바뀌지 않은 케이스만 씁니다. */
function legacyExpected(check: string, expected: any): unknown {
  if (check === 'precheckGate') {
    const proceed = expected['proceedToPaymentConfirm'] as boolean
    return { proceed, status: proceed ? null : 422, message: expected['toastError'] }
  }
  // 바뀌지 않은 결제수단 케이스는 없습니다. 나머지는 수량입니다
  return expected
}

describe('external-herbal-precheck fixture', () => {
  const ported = fixture.cases.filter((c) => !(c.name in NOT_PORTED))

  it.each(ported.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const check = input['check'] as string
    const want = name in CHANGED ? CHANGED[name] : legacyExpected(check, expected)
    expect(RUN[check]!(input)).toEqual(want)
  })

  it('accounts for every fixture case', () => {
    expect(ported.filter((c) => !(c.input['check'] in RUN)).map((c) => c.name)).toEqual([])
    // 결제수단 재분배는 서버에 없으므로 옮긴 케이스는 모두 바뀐 기대값입니다
    expect(
      ported.filter((c) => c.input['check'] === 'allocatePaymentMethods' && !(c.name in CHANGED)).map((c) => c.name),
    ).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => name in NOT_PORTED)).toEqual([])
  })
})
