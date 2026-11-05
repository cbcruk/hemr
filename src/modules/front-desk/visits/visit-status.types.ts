/** 진료 당일 접수 흐름에서 내원이 있는 단계입니다. */
export type VisitStatus = 'WAITING' | 'IN_TREATMENT' | 'AWAITING_PAYMENT' | 'COMPLETED' | 'CANCELED'

/** 내원 상태를 옮기는 커맨드입니다. `POST /visits/{id}:{command}`로 보냅니다. */
export type VisitCommand =
  'START_TREATMENT' | 'RETURN_TO_WAITING' | 'SEND_TO_CHECKOUT' | 'CHECKOUT' | 'REOPEN' | 'CANCEL'

/** 전이 허용 여부를 바꾸는 입력입니다. */
export interface VisitTransitionOptions {
  /** 취소할 때 그 내원의 진료·수납과 관련 기록도 함께 무효로 할지 여부입니다. */
  cascade?: boolean
  /** 내원에 진료 내용이나 수납 기록이 있는지 여부입니다. 있으면 `cascade` 없이 취소할 수 없습니다. */
  hasClinicalData?: boolean
  /** 진료일이 병원 시간대 오늘보다 이전인지 여부입니다. 지난 내원은 정리용 커맨드만 받습니다. */
  isPastDate?: boolean
}

/** 내원 상태 전이를 거부할 때 돌려주는 오류 코드입니다. */
export type VisitTransitionErrorCode = 'VISIT_TRANSITION_INVALID' | 'VISIT_HAS_CLINICAL_DATA' | 'VISIT_DATE_PAST'

/** 현재 상태에 내원 커맨드를 적용해 본 결과입니다. */
export type VisitTransitionResult = { ok: true; to: VisitStatus } | { ok: false; code: VisitTransitionErrorCode }
