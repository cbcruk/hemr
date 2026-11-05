import type { VisitCommand, VisitStatus, VisitTransitionOptions, VisitTransitionResult } from './visit-status.types.ts'

interface Transition {
  to: VisitStatus
  requiresCascade?: boolean
}

const TRANSITIONS: Record<VisitStatus, Partial<Record<VisitCommand, Transition>>> = {
  WAITING: {
    START_TREATMENT: { to: 'IN_TREATMENT' },
    SEND_TO_CHECKOUT: { to: 'AWAITING_PAYMENT' },
    CHECKOUT: { to: 'COMPLETED' },
    CANCEL: { to: 'CANCELED' },
  },
  IN_TREATMENT: {
    RETURN_TO_WAITING: { to: 'WAITING' },
    SEND_TO_CHECKOUT: { to: 'AWAITING_PAYMENT' },
    CHECKOUT: { to: 'COMPLETED' },
    CANCEL: { to: 'CANCELED', requiresCascade: true },
  },
  AWAITING_PAYMENT: {
    START_TREATMENT: { to: 'IN_TREATMENT' },
    RETURN_TO_WAITING: { to: 'WAITING' },
    CHECKOUT: { to: 'COMPLETED' },
    CANCEL: { to: 'CANCELED' },
  },
  COMPLETED: {
    REOPEN: { to: 'AWAITING_PAYMENT' },
    CANCEL: { to: 'CANCELED', requiresCascade: true },
  },
  CANCELED: {},
}

/**
 * 현재 상태에 내원 커맨드를 적용해 다음 상태를 돌려줍니다.
 *
 * 현행 앱에서 클라이언트에만 있던 상태 전이 표를 서버로 옮긴 것입니다. 상태 기계만 검사하고,
 * 권한 확인과 연쇄 취소를 막는 데이터 조건은 커맨드 핸들러가 맡습니다.
 *
 * @example 이미 진료 중인 내원 취소하기
 * ```ts
 * import { transitionVisit } from "./visit-status.ts";
 *
 * transitionVisit("IN_TREATMENT", "CANCEL"); // { ok: false, code: "VISIT_HAS_CLINICAL_DATA" }
 * transitionVisit("IN_TREATMENT", "CANCEL", { cascade: true }); // { ok: true, to: "CANCELED" }
 * ```
 */
export function transitionVisit(
  from: VisitStatus,
  command: VisitCommand,
  options: VisitTransitionOptions = {},
): VisitTransitionResult {
  const transition = TRANSITIONS[from][command]
  if (transition === undefined) return { ok: false, code: 'VISIT_TRANSITION_INVALID' }
  if (transition.requiresCascade === true && options.cascade !== true) {
    return { ok: false, code: 'VISIT_HAS_CLINICAL_DATA' }
  }
  return { ok: true, to: transition.to }
}

/**
 * 한 상태에서 보낼 수 있는 커맨드 목록입니다. `allowedActions` 필드에 씁니다.
 *
 * 클라이언트가 선택지로 보여 주므로 `cascade`가 필요한 커맨드도 포함합니다.
 */
export function allowedVisitCommands(status: VisitStatus): VisitCommand[] {
  return Object.keys(TRANSITIONS[status]) as VisitCommand[]
}
