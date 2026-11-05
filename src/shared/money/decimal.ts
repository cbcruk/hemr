/**
 * 금액 계산에 쓰는 소수·반올림 도우미입니다. 소수를 `분자 / 10^k`로 바꿔 정수로 계산하므로 부동소수 오차가 없습니다.
 */

/** 0 이상의 소수를 `분자 / 10^k`로 나타냅니다. 소수점 아래는 6자리까지 받습니다. */
export function decimalFraction(value: number): { numerator: number; denominator: number } {
  for (let denominator = 1; denominator <= 1_000_000; denominator *= 10) {
    const numerator = Math.round(value * denominator)
    if (value >= 0 && Math.abs(numerator / denominator - value) < Number.EPSILON * Math.max(1, value)) {
      return { numerator, denominator }
    }
  }
  throw new RangeError(`Expected a non-negative number with up to 6 decimals, got ${value}`)
}

/** 0 이상의 정수 나눗셈을 반올림(0.5는 올림)합니다. */
export function divideHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}
