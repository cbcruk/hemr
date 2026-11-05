import type { VisitCommand, VisitStatus, VisitTransitionOptions, VisitTransitionResult } from './visit-status.types.ts'

const TRANSITIONS: Record<VisitStatus, Partial<Record<VisitCommand, VisitStatus>>> = {
  WAITING: {
    START_TREATMENT: 'IN_TREATMENT',
    SEND_TO_CHECKOUT: 'AWAITING_PAYMENT',
    CHECKOUT: 'COMPLETED',
    CANCEL: 'CANCELED',
  },
  IN_TREATMENT: {
    RETURN_TO_WAITING: 'WAITING',
    SEND_TO_CHECKOUT: 'AWAITING_PAYMENT',
    CHECKOUT: 'COMPLETED',
    CANCEL: 'CANCELED',
  },
  AWAITING_PAYMENT: {
    START_TREATMENT: 'IN_TREATMENT',
    RETURN_TO_WAITING: 'WAITING',
    CHECKOUT: 'COMPLETED',
    CANCEL: 'CANCELED',
  },
  COMPLETED: {
    REOPEN: 'AWAITING_PAYMENT',
    CANCEL: 'CANCELED',
  },
  CANCELED: {},
}

/**
 * 진료 흐름을 앞뒤로 옮기는 커맨드입니다. 지난 날짜의 내원에는 보낼 수 없습니다.
 *
 * 수납·다시 열기·취소는 지난 내원을 정리하는 데 필요해서 여기에 넣지 않습니다.
 */
const FLOW_COMMANDS: ReadonlySet<VisitCommand> = new Set(['START_TREATMENT', 'RETURN_TO_WAITING', 'SEND_TO_CHECKOUT'])

/**
 * 현재 상태에 내원 커맨드를 적용해 다음 상태를 돌려줍니다.
 *
 * 현행 앱에서 클라이언트에만 있던 상태 전이 표를 서버로 옮긴 것입니다. 검사 순서는
 * 상태 전이 표, 지난 날짜, 연쇄 취소입니다. 권한 확인은 커맨드 핸들러가 맡습니다.
 *
 * 연쇄 취소는 상태가 아니라 데이터로 판정합니다. 진료 내용이나 수납이 있으면 상태와
 * 상관없이 `cascade`가 필요합니다 (`docs/design/rule-decisions.md`의 visit-status-transitions 4).
 *
 * @example 진료 기록이 있는 내원 취소하기
 * ```ts
 * import { transitionVisit } from "./visit-status.ts";
 *
 * transitionVisit("IN_TREATMENT", "CANCEL", { hasClinicalData: true }); // { ok: false, code: "VISIT_HAS_CLINICAL_DATA" }
 * transitionVisit("IN_TREATMENT", "CANCEL", { hasClinicalData: true, cascade: true }); // { ok: true, to: "CANCELED" }
 * ```
 */
export function transitionVisit(
  from: VisitStatus,
  command: VisitCommand,
  options: VisitTransitionOptions = {},
): VisitTransitionResult {
  const to = TRANSITIONS[from][command]
  if (to === undefined) return { ok: false, code: 'VISIT_TRANSITION_INVALID' }
  if (options.isPastDate === true && FLOW_COMMANDS.has(command)) return { ok: false, code: 'VISIT_DATE_PAST' }
  if (command === 'CANCEL' && options.hasClinicalData === true && options.cascade !== true) {
    return { ok: false, code: 'VISIT_HAS_CLINICAL_DATA' }
  }
  return { ok: true, to }
}

/**
 * 한 상태에서 보낼 수 있는 커맨드 목록입니다. `allowedActions` 필드에 씁니다.
 *
 * 클라이언트가 선택지로 보여 주므로 `cascade`가 필요한 취소도 포함합니다.
 * 지난 날짜의 내원이면 진료 흐름 커맨드는 뺍니다.
 */
export function allowedVisitCommands(
  status: VisitStatus,
  options: Pick<VisitTransitionOptions, 'isPastDate'> = {},
): VisitCommand[] {
  const commands = Object.keys(TRANSITIONS[status]) as VisitCommand[]
  return options.isPastDate === true ? commands.filter((command) => !FLOW_COMMANDS.has(command)) : commands
}
