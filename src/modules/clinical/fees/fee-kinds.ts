// 수가코드 종류 판정입니다. 초기값은 참조데이터의 수가 속성으로 옮길 때까지 여기에 둡니다.

/**
 * 진찰료 속성을 가진 코드의 앞자리입니다. 초기값은 현행과 같은 `10` 대역 전체입니다.
 * 진찰료 중복과 자보 2차 진료 규칙이 같은 목록을 씁니다(duplicate-consultation-fee 3, auto-insurance-same-day-consultation 5).
 */
const CONSULTATION_FEE_PREFIXES = ['10']

/** 진찰료인지입니다. 비대면 관리료 `91001`–`91004`는 `10` 대역 밖이라 진찰료가 아닙니다. */
export function isConsultationFee(feeCode: string): boolean {
  return CONSULTATION_FEE_PREFIXES.some((prefix) => feeCode.startsWith(prefix))
}
