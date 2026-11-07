import { decimalFraction, divideHalfUp } from '../../../shared/money/decimal.ts'

/**
 * 외부 탕전원 precheck 호출 결과입니다. 연동 어댑터가 응답 본문을 그대로 `RESPONDED`로 넘기고, 네트워크 오류·
 * 4xx·5xx·시간 초과처럼 판정 결과를 받지 못했으면 `UNREACHABLE`입니다 (결정 1).
 */
export type ExternalPrecheckCall = { kind: 'RESPONDED'; body: unknown } | { kind: 'UNREACHABLE' }

/** 줄 단위 실패 코드입니다. 탕전원 코드 목록을 확인하기 전까지 `OUT_OF_STOCK` 밖은 `UNKNOWN`입니다 (결정 3). */
export type ExternalPrecheckLineCode = 'OUT_OF_STOCK' | 'UNKNOWN'

export interface ExternalPrecheckLineIssue {
  /**
   * 탕전원 응답 `lines[]`의 순번(0부터)입니다. precheck 요청 `items[]`와 같은 순서이고, `items[]`에는 약재 밖에 파우치·
   * 박스·쇼핑백·옵션 줄도 있으므로 `draft.herbs[]` 순번이 아닙니다.
   */
  line: number
  code: ExternalPrecheckLineCode
  /** 탕전원이 준 원문 코드입니다. 없으면 `null`입니다. */
  rawCode: string | null
}

/** 주문의 `precheck` 결과입니다 (herbal-pharmacy `ExternalHerbalOrder.precheck`). */
export interface ExternalPrecheckResult {
  ok: boolean
  /** 탕전원이 준 주문 단위 오류 문구입니다. */
  errors: string[]
  lineIssues: ExternalPrecheckLineIssue[]
}

/** precheck 판정입니다. 통과가 아니면 `:place`·`:quote`가 이 오류로 결제를 막습니다. */
export type ExternalPrecheckGate =
  | { ok: true; result: ExternalPrecheckResult }
  | { ok: false; status: 422; code: 'EXTERNAL_PRECHECK_FAILED'; result: ExternalPrecheckResult }
  | { ok: false; status: 503; code: 'EXTERNAL_PRECHECK_UNAVAILABLE' }

/**
 * 탕전원 응답 본문을 precheck 결과로 읽습니다 (결정 2·3). 래퍼 없이 `{ ok, lines[], errors[] }`만 읽고, `ok`가
 * `true`일 때만 통과로 봅니다. 본문이 객체가 아니거나 `ok`가 없으면 실패입니다. `ok`가 참이 아닌 줄을 줄 실패로
 * 모읍니다.
 */
export function parseExternalPrecheck(body: unknown): ExternalPrecheckResult {
  const record = isRecord(body) ? body : {}
  const lines = Array.isArray(record['lines']) ? record['lines'] : []
  const 주문오류 = Array.isArray(record['errors'])
    ? record['errors'].filter((each): each is string => typeof each === 'string')
    : []
  const 줄실패 = lines.flatMap((line, index): ExternalPrecheckLineIssue[] => {
    const entry = isRecord(line) ? line : {}
    if (entry['ok'] === true) return []
    const 원문코드 = typeof entry['code'] === 'string' ? entry['code'] : null
    return [{ line: index, code: 원문코드 === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'UNKNOWN', rawCode: 원문코드 }]
  })
  return { ok: record['ok'] === true, errors: 주문오류, lineIssues: 줄실패 }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** precheck 호출 결과로 결제를 진행할지 정합니다 (결정 1·2). 우회 경로가 없습니다. */
export function externalPrecheckGate(call: ExternalPrecheckCall): ExternalPrecheckGate {
  if (call.kind === 'UNREACHABLE') return { ok: false, status: 503, code: 'EXTERNAL_PRECHECK_UNAVAILABLE' }
  const result = parseExternalPrecheck(call.body)
  return result.ok ? { ok: true, result } : { ok: false, status: 422, code: 'EXTERNAL_PRECHECK_FAILED', result }
}

const 줄실패문구: Record<ExternalPrecheckLineCode, string> = {
  OUT_OF_STOCK: '재고 부족',
  // 현행은 `OUT_OF_STOCK` 밖을 모두 "수량 불일치"로 보였습니다. 코드 목록을 확인하면 나눕니다 (결정 3)
  UNKNOWN: '수량 불일치',
}

/** 실패 문구입니다. 주문 단위 오류 뒤에 줄 실패를 붙이고, 둘 다 없으면 일반 문구입니다. 현행 문구를 그대로 씁니다. */
export function externalPrecheckMessage(result: ExternalPrecheckResult): string {
  const 실패사유 = [...result.errors, ...result.lineIssues.map((issue) => 줄실패문구[issue.code])]
  return `주문 확인 실패: ${실패사유.length > 0 ? 실패사유.join(', ') : '수량·재고를 확인해주세요.'}`
}

/**
 * 약재 줄의 주문 수량(g)입니다 (결정 6). 첩당 용량을 0.1g 단위로 반올림(0.05는 올림)하고 첩수를 곱합니다.
 * 십진 고정소수로 계산해 부동소수 오차가 없습니다. 용량이나 첩수가 0 이하면 0입니다. precheck와 견적이 같이 씁니다.
 * 요청 스키마가 첩수는 정수, 용량은 소수점 아래 6자리까지로 막습니다. 그 밖의 값은 `RangeError`입니다.
 */
export function herbLineQuantity(dosePerPackG: number, doses: number): number {
  if (!Number.isFinite(doses) || (doses > 0 && !Number.isInteger(doses))) {
    throw new RangeError(`Expected an integer number of doses, got ${doses}`)
  }
  if (!(dosePerPackG > 0) || doses <= 0) return 0
  const { numerator, denominator } = decimalFraction(dosePerPackG)
  const 첩당용량십배 = divideHalfUp(numerator * 10, denominator)
  return (첩당용량십배 * doses) / 10
}

/**
 * 팩 단위로 과금하는 품목(박스·쇼핑백·탕전 유형)의 수량입니다. 과금팩수가 없거나 0 이하면 팩수와 상관없이 1입니다.
 * 현행과 같습니다. 팩수는 요청 스키마가 0 이상의 정수로 막습니다.
 */
export function packBasedQuantity(packs: number, packsPerBillingUnit: number | null): number {
  return packsPerBillingUnit !== null && packsPerBillingUnit > 0 ? Math.ceil(packs / packsPerBillingUnit) : 1
}

export interface ExternalPaymentMethod {
  type: 'DEPOSIT_CARD' | 'CARD'
  amount: number
}

/** 결제수단 금액 오류입니다. `:place`가 422로 돌려줍니다 (결정 5). */
export interface ExternalPaymentAmountMismatch {
  code: 'PAYMENT_AMOUNT_MISMATCH'
  reason: 'TOTAL' | 'NON_POSITIVE_AMOUNT'
  payable: number
  total: number
}

/**
 * 결제수단 금액이 견적 결제액과 맞는지 봅니다 (결정 5). 서버는 금액을 다시 나누지 않습니다. 금액이 0 이하인 수단이
 * 있거나 합이 `quote.payable`과 다르면 오류입니다. 일반카드 개수는 제한하지 않습니다. 금액은 원 단위 정수이고
 * 요청 스키마가 정수만 받습니다.
 */
export function externalPaymentAmountMismatch(
  methods: readonly ExternalPaymentMethod[],
  payable: number,
): ExternalPaymentAmountMismatch | null {
  const 결제수단합계 = methods.reduce((sum, method) => sum + method.amount, 0)
  if (methods.some((method) => !(method.amount > 0))) {
    return { code: 'PAYMENT_AMOUNT_MISMATCH', reason: 'NON_POSITIVE_AMOUNT', payable, total: 결제수단합계 }
  }
  if (결제수단합계 === payable) return null
  return { code: 'PAYMENT_AMOUNT_MISMATCH', reason: 'TOTAL', payable, total: 결제수단합계 }
}
