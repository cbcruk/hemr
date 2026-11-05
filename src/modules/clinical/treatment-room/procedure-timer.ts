/** 치료실 시술 상태입니다 (clinical `Procedure.status`). */
export type ProcedureStatus = 'PENDING' | 'RUNNING' | 'TIMER_ELAPSED' | 'DONE'

/**
 * 타이머 판정에 쓰는 시술 필드입니다. 시각은 UTC ISO 문자열입니다. `RUNNING`과 `TIMER_ELAPSED`는 `startedAt`과
 * `timerEndsAt`이 늘 있습니다 (결정 3).
 */
export interface ProcedureTimer {
  procedureId: string
  status: ProcedureStatus
  durationSeconds: number
  startedAt: string | null
  timerEndsAt: string | null
  completedAt: string | null
}

/** 단일 설정 `procedure-timers`입니다 (결정 2·5). */
export interface ProcedureTimerSettings {
  /** 새 타이머 설정 항목의 기본 시간(초)입니다. */
  defaultItemSeconds: number
  /** 치료세트 항목 시간이 모두 없거나 0일 때 쓰는 세트 시간(초)입니다. */
  defaultSetSeconds: number
  /** 개별 `:start`가 같은 베드의 `TIMER_ELAPSED` 시술을 함께 완료할지입니다. */
  autoCompleteElapsedOnNextStart: boolean
}

export const DEFAULT_PROCEDURE_TIMER_SETTINGS: ProcedureTimerSettings = {
  defaultItemSeconds: 300,
  defaultSetSeconds: 900,
  autoCompleteElapsedOnNextStart: true,
}

const isoAt = (epochMillis: number) => new Date(epochMillis).toISOString()

/** 타이머 종료 시각입니다. `startedAt + durationSeconds`입니다. */
export function timerEndsAt(startedAt: string, durationSeconds: number): string {
  return isoAt(Date.parse(startedAt) + durationSeconds * 1000)
}

/** 시작 뒤 지난 초입니다. 초 단위로 내리고, 서버 시계가 시작 시각보다 이르면 0입니다. */
function elapsedSeconds(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000))
}

/** 진행 중인 시술의 남은 초입니다. 진행 중이 아니면 `null`입니다 (결정 4). */
export function remainingSeconds(procedure: ProcedureTimer, nowMs: number): number | null {
  if (procedure.status !== 'RUNNING' || procedure.startedAt === null) return null
  return procedure.durationSeconds - elapsedSeconds(procedure.startedAt, nowMs)
}

/** 남은 시간이 0초 이하인 진행 중 시술입니다 (결정 1). */
const isDue = (procedure: ProcedureTimer, nowMs: number) => {
  const remaining = remainingSeconds(procedure, nowMs)
  return remaining !== null && remaining <= 0
}

/**
 * 서버 시계로 만료된 시술을 `TIMER_ELAPSED`로 바꿉니다 (결정 1·4). 서버 작업이 `timerEndsAt`에 맞춰 부르고,
 * 호출하는 쪽이 `elapsedIds`마다 `procedure.updated`를 내고 베드별로 종료 알림을 묶습니다.
 */
export function elapseDueTimers(
  procedures: readonly ProcedureTimer[],
  nowMs: number,
): { procedures: ProcedureTimer[]; elapsedIds: string[] } {
  const elapsedIds: string[] = []
  const next = procedures.map((procedure): ProcedureTimer => {
    if (!isDue(procedure, nowMs)) return procedure
    elapsedIds.push(procedure.procedureId)
    return { ...procedure, status: 'TIMER_ELAPSED' }
  })
  return { procedures: next, elapsedIds }
}

/**
 * 시작 결과입니다. `elapsedIds`는 판정 전에 서버 시계로 만료한 시술이고, 결과와 상관없이 호출하는 쪽이 만료
 * 이벤트와 알림을 냅니다. 바뀌지 않으면 대상이 없거나(`NOT_FOUND`, 404) 모두 진행 중(`ALREADY_RUNNING`)입니다.
 */
export type ProcedureStartResult =
  | { changed: false; reason: 'NOT_FOUND' | 'ALREADY_RUNNING'; elapsedIds: string[] }
  | {
      changed: true
      procedures: ProcedureTimer[]
      startedIds: string[]
      autoCompletedIds: string[]
      elapsedIds: string[]
    }

/**
 * 한 베드의 시술을 시작합니다 (결정 2). 개별 `:start`는 대상 하나, 세트를 베드에서 시작하는 `:start-all`은 세트
 * 시술 모두를 대상으로 넘깁니다. 대기·만료·완료 시술은 한 번에 다시 시작하고, 이미 진행 중인 대상은 그대로 둡니다.
 * 정책이 켜져 있으면 대상 밖의 `TIMER_ELAPSED` 시술을 같은 시각에 완료합니다. 판정 전에 종료 시각이 지난 진행 중
 * 시술도 만료로 봅니다.
 */
export function startProcedures(
  procedures: readonly ProcedureTimer[],
  targetIds: readonly string[],
  nowMs: number,
  settings: Pick<ProcedureTimerSettings, 'autoCompleteElapsedOnNextStart'> = DEFAULT_PROCEDURE_TIMER_SETTINGS,
): ProcedureStartResult {
  const { procedures: current, elapsedIds } = elapseDueTimers(procedures, nowMs)
  const targets = new Set(targetIds)
  const found = current.filter((procedure) => targets.has(procedure.procedureId))
  if (targetIds.length === 0 || found.length < targets.size) return { changed: false, reason: 'NOT_FOUND', elapsedIds }
  if (found.every((procedure) => procedure.status === 'RUNNING')) {
    return { changed: false, reason: 'ALREADY_RUNNING', elapsedIds }
  }
  const now = isoAt(nowMs)
  const startedIds: string[] = []
  const autoCompletedIds: string[] = []
  const next = current.map((procedure): ProcedureTimer => {
    if (targets.has(procedure.procedureId)) {
      if (procedure.status === 'RUNNING') return procedure
      startedIds.push(procedure.procedureId)
      return {
        ...procedure,
        status: 'RUNNING',
        startedAt: now,
        timerEndsAt: timerEndsAt(now, procedure.durationSeconds),
        completedAt: null,
      }
    }
    if (settings.autoCompleteElapsedOnNextStart && procedure.status === 'TIMER_ELAPSED') {
      autoCompletedIds.push(procedure.procedureId)
      return { ...procedure, status: 'DONE', completedAt: now }
    }
    return procedure
  })
  return { changed: true, procedures: next, startedIds, autoCompletedIds, elapsedIds }
}

export type ProcedureDurationError =
  'PROCEDURE_DURATION_INVALID' | 'PROCEDURE_DURATION_TOO_SHORT' | 'PROCEDURE_ALREADY_DONE'

/** 시간 변경 결과입니다. `elapsed`는 판정 전에 서버 시계로 만료했는지이고, 참이면 호출하는 쪽이 만료 이벤트를 냅니다. */
export type ProcedureDurationResult =
  | { ok: true; changed: boolean; elapsed: boolean; procedure: ProcedureTimer }
  | { ok: false; error: ProcedureDurationError }

/**
 * 시술 시간을 바꿉니다 (결정 4, `PATCH /procedures/{id}`). 1 이상의 정수만 받고, 완료된 시술은 바꾸지 않습니다.
 * 판정 전에 서버 시계로 만료를 다시 봅니다. 진행 중이면 `새 시간 − 경과 ≥ 1`이어야 하고 종료 시각을 다시
 * 계산합니다. 만료된 시술은 시간만 바꾸고 만료 상태와 실제 종료 시각(`timerEndsAt`)을 둡니다. 같은 값이면 바꾸지
 * 않고 통과합니다.
 */
export function setProcedureDuration(
  procedure: ProcedureTimer,
  durationSeconds: number,
  nowMs: number,
): ProcedureDurationResult {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1) {
    return { ok: false, error: 'PROCEDURE_DURATION_INVALID' }
  }
  if (procedure.status === 'DONE') return { ok: false, error: 'PROCEDURE_ALREADY_DONE' }
  const [current] = elapseDueTimers([procedure], nowMs).procedures
  const checked = current ?? procedure
  const elapsed = checked.status !== procedure.status
  if (checked.durationSeconds === durationSeconds) return { ok: true, changed: elapsed, elapsed, procedure: checked }
  if (checked.status === 'RUNNING' && checked.startedAt !== null) {
    if (durationSeconds - elapsedSeconds(checked.startedAt, nowMs) < 1) {
      return { ok: false, error: 'PROCEDURE_DURATION_TOO_SHORT' }
    }
    return {
      ok: true,
      changed: true,
      elapsed,
      procedure: { ...checked, durationSeconds, timerEndsAt: timerEndsAt(checked.startedAt, durationSeconds) },
    }
  }
  return { ok: true, changed: true, elapsed, procedure: { ...checked, durationSeconds } }
}

/** 시술 시간을 늘이거나 줄입니다. 0이 아닌 정수 증감만 받습니다. */
export function adjustProcedureDuration(
  procedure: ProcedureTimer,
  deltaSeconds: number,
  nowMs: number,
): ProcedureDurationResult {
  if (!Number.isInteger(deltaSeconds) || deltaSeconds === 0) return { ok: false, error: 'PROCEDURE_DURATION_INVALID' }
  return setProcedureDuration(procedure, procedure.durationSeconds + deltaSeconds, nowMs)
}

/** 치료세트 시간입니다. 항목 중 가장 긴 시간이고, 없거나 모두 0이면 설정의 세트 기본값입니다 (결정 5). */
export function procedureSetSeconds(
  items: readonly { durationSeconds: number }[],
  settings: Pick<ProcedureTimerSettings, 'defaultSetSeconds'> = DEFAULT_PROCEDURE_TIMER_SETTINGS,
): number {
  return items.reduce((longest, item) => Math.max(longest, item.durationSeconds), 0) || settings.defaultSetSeconds
}

/** 종료 알림의 중복 제거 키입니다. 시술 ID와 종료 시각으로 만듭니다. 만료 시술은 종료 시각이 늘 있습니다 (결정 3). */
export function timerEndNotificationKey(procedure: { procedureId: string; timerEndsAt: string }): string {
  return `timer-end:${procedure.procedureId}:${Date.parse(procedure.timerEndsAt)}`
}

/** 종료 알림 제목입니다. 베드 번호는 두 자리로 채웁니다. 현행 문구를 그대로 씁니다. */
export function timerEndNotificationTitle(bedNumber: number, patientName: string, procedureNames: readonly string[]) {
  return `${String(bedNumber).padStart(2, '0')}베드 ${patientName}님 ${procedureNames.join(', ')} 타이머가 종료되었습니다.`
}

/** 현행 시술 행입니다. 이관과 픽스처 테스트가 씁니다. */
export interface LegacyProcedureRow {
  procedureId: string
  status: 'pending' | 'running' | 'done'
  timerEnded: boolean
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number
}

/**
 * 현행 행을 시술 타이머로 옮깁니다 (결정 1·3). 시작 시각이 있는 `running`은 `RUNNING`, `pending` + 타이머종료는
 * `TIMER_ELAPSED`입니다. 시작 시각 없는 `running`·`pending` + 타이머종료는 종료 시각을 알 수 없으므로 `PENDING`으로
 * 되돌립니다. `PENDING`은 시작·종료 시각을 비웁니다. 이관한 뒤 만료 판정은 `elapseDueTimers`가 합니다.
 */
export function migratedProcedure(row: LegacyProcedureRow): ProcedureTimer {
  const base = { procedureId: row.procedureId, durationSeconds: row.durationSeconds }
  const status = migratedStatus(row)
  if (status === 'PENDING') return { ...base, status, startedAt: null, timerEndsAt: null, completedAt: null }
  const startedAt = row.startedAt
  return {
    ...base,
    status,
    startedAt,
    timerEndsAt: startedAt === null ? null : timerEndsAt(startedAt, row.durationSeconds),
    completedAt: status === 'DONE' ? row.completedAt : null,
  }
}

function migratedStatus(row: LegacyProcedureRow): ProcedureStatus {
  if (row.status === 'done') return 'DONE'
  if (row.startedAt === null) return 'PENDING'
  if (row.status === 'running') return 'RUNNING'
  return row.timerEnded ? 'TIMER_ELAPSED' : 'PENDING'
}
