/** 오류 응답에 담는 필드 하나의 검증 실패입니다. */
export interface Violation {
  /** 문제가 된 필드의 JSON 경로입니다. 예: `startAt`, `payments[0].amount` */
  field: string
  /** 기계가 읽는 사유입니다. 형식은 `SCREAMING_SNAKE_CASE`입니다. */
  code: string
}

/**
 * RFC 9457 Problem Details 형식의 오류 응답 본문입니다.
 *
 * 클라이언트는 `code`로 사용자에게 보일 문구를 고르고, `detail`은 개발자용입니다.
 */
export interface ProblemDetails {
  type: string
  title: string
  status: number
  code: string
  detail?: string
  violations?: Violation[]
}
