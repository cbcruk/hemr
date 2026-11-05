import type { AppointmentStatus, ClinicDay, ClinicNow, ClockTime } from './appointment-acceptance.types.ts'

/** 부도 처리 시점으로 고를 수 있는 분 값입니다 (결정 4). */
export const NO_SHOW_MINUTES = [10, 30, 60] as const
export type NoShowMinutes = (typeof NO_SHOW_MINUTES)[number]

/**
 * 부도 처리 설정입니다.
 *
 * `noShowAtClinicClose`가 참이면 분 값은 쓰지 않지만 지우지 않습니다. 현행처럼 진료 마감 모드를 껐을 때
 * 전에 고른 분 값으로 돌아갑니다.
 */
export interface NoShowSettings {
  noShowAfterMinutes: NoShowMinutes
  noShowAtClinicClose: boolean
}

/** 부도 판정에 쓰는 예약입니다. `startTime`이 `null`이면 시간 미정 예약입니다. */
export interface NoShowCandidate {
  status: AppointmentStatus
  date: string
  startTime: ClockTime | null
}

/**
 * 진료 마감을 찾는 일정입니다. 결정 2의 우선순위대로 앞에서부터 처음 있는 것을 씁니다.
 * 날짜별 일정이 요일별 일정보다, 진료의 일정이 병원 일정보다 앞섭니다.
 *
 * 진료의 반나절 휴진은 호출하는 쪽이 `doctorByDate`에 반영해 넘깁니다(예: 오후 휴진이면 오전 구간만).
 */
export interface CloseTimeSources {
  doctorByDate?: ClinicDay | undefined
  doctorByWeekday?: ClinicDay | undefined
  clinicByDate?: ClinicDay | undefined
  clinicByWeekday?: ClinicDay | undefined
}

/** 하루의 끝입니다. 휴진일 예약은 이 시각(다음 날 0시)에 부도 처리합니다 (결정 2). */
const END_OF_DAY = '24:00'

/**
 * 그날의 진료 마감 시각입니다 (결정 2).
 *
 * 우선순위가 가장 높은 일정의 마지막 구간 종료 시각입니다. 점심 휴게는 상관하지 않습니다.
 * 휴진이 아닌데 구간이 하나도 없는 일정은 덜 채운 설정으로 보고 다음 일정으로 넘어갑니다.
 * 처음 쓸 일정이 휴진이거나 쓸 일정이 없으면 `24:00`입니다.
 */
export function clinicCloseTime(sources: CloseTimeSources): ClockTime {
  const days = [sources.doctorByDate, sources.doctorByWeekday, sources.clinicByDate, sources.clinicByWeekday]
  const day = days.find((candidate) => candidate !== undefined && (candidate.closed || hasPeriods(candidate)))
  if (day === undefined || day.closed) return END_OF_DAY
  return Object.values(day.periods)
    .map((range) => range.end)
    .sort()
    .at(-1)!
}

function hasPeriods(day: ClinicDay): boolean {
  return Object.keys(day.periods).length > 0
}

/**
 * 부도 처리할 시각입니다. 예약일 기준 `HH:mm`이고 `24:00`을 넘을 수 있습니다(예: `24:30`).
 *
 * 분 모드는 예약 시작 시각 + N분입니다 (결정 1). 시간 미정 예약은 진료 마감입니다.
 * 진료 마감 모드는 진료 마감이지만, 마감 뒤에 시작하는 예약(근무 시간 밖 예약)은 시작 + N분과 진료 마감 중
 * 늦은 쪽입니다. 시작하기도 전에 부도가 되는 일을 막으려는 것입니다.
 */
export function noShowDueTime(appointment: NoShowCandidate, settings: NoShowSettings, closeTime: ClockTime): ClockTime {
  return fromMinutes(dueMinutes(appointment, settings, closeTime))
}

function dueMinutes(appointment: NoShowCandidate, settings: NoShowSettings, closeTime: ClockTime): number {
  const close = toMinutes(closeTime)
  if (appointment.startTime === null) return close
  const afterStart = toMinutes(appointment.startTime) + settings.noShowAfterMinutes
  return settings.noShowAtClinicClose ? Math.max(close, afterStart) : afterStart
}

/**
 * 지금 부도 처리해야 하는지입니다.
 *
 * `BOOKED`만 대상입니다 (결정 3). 지금이 부도 처리 시각 이상(`>=`)이면 참입니다 (결정 1).
 */
export function isNoShowDue(
  appointment: NoShowCandidate,
  settings: NoShowSettings,
  closeTime: ClockTime,
  now: ClinicNow,
): boolean {
  if (appointment.status !== 'BOOKED') return false
  const due = dueMinutes(appointment, settings, closeTime)
  const elapsed = daysBetween(appointment.date, now.date) * MINUTES_PER_DAY + toMinutes(now.time)
  return elapsed >= due
}

/**
 * 현행 설정(`부도처리시점`, `진료마감부도처리여부`)을 이관합니다 (결정 4).
 *
 * 10/30/60이 아닌 분 값은 그보다 크거나 같은 가장 가까운 값으로 올립니다(45 → 60, 빈 값 → 10).
 * 60을 넘으면 올릴 값이 없어 진료 마감 모드로 바꿉니다. 대부분의 예약은 부도가 더 늦어지지만, 마감 직전
 * 예약은 현행보다 일찍 부도가 될 수 있습니다. 값을 바꿨으면 `adjusted`가 참이고, 이관 스크립트가 병원에 알립니다.
 */
export function migrateNoShowSettings(
  minutes: number | null,
  noShowAtClinicClose: boolean,
): { settings: NoShowSettings; adjusted: boolean } {
  const value = minutes ?? 0
  if (!Number.isFinite(value)) throw new RangeError(`Expected a finite no-show minute value, got ${value}`)
  const raised = NO_SHOW_MINUTES.find((option) => option >= value)
  const settings = {
    noShowAfterMinutes: raised ?? NO_SHOW_MINUTES.at(-1)!,
    noShowAtClinicClose: noShowAtClinicClose || raised === undefined,
  }
  const adjusted = settings.noShowAfterMinutes !== minutes || settings.noShowAtClinicClose !== noShowAtClinicClose
  return { settings, adjusted }
}

/** 설정 변경 요청입니다. 바꿀 필드만 보냅니다(현행 `PATCH /settings/appointments`와 같음). */
export interface NoShowSettingsPatch {
  noShowAfterMinutes?: number
  noShowAtClinicClose?: boolean
}

/**
 * 설정 변경을 적용합니다. 분 값이 10/30/60이 아니면 422 `NO_SHOW_MINUTES_INVALID`입니다 (결정 4).
 *
 * 진료 마감 모드를 켜도 분 값은 남깁니다.
 */
export function applyNoShowPatch(
  current: NoShowSettings,
  patch: NoShowSettingsPatch,
): { settings: NoShowSettings } | { error: 'NO_SHOW_MINUTES_INVALID' } {
  if (patch.noShowAfterMinutes !== undefined && !isNoShowMinutes(patch.noShowAfterMinutes)) {
    return { error: 'NO_SHOW_MINUTES_INVALID' }
  }
  return {
    settings: {
      noShowAfterMinutes: patch.noShowAfterMinutes ?? current.noShowAfterMinutes,
      noShowAtClinicClose: patch.noShowAtClinicClose ?? current.noShowAtClinicClose,
    },
  }
}

export function isNoShowMinutes(value: unknown): value is NoShowMinutes {
  return NO_SHOW_MINUTES.includes(value as NoShowMinutes)
}

const MINUTES_PER_DAY = 24 * 60
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

function daysBetween(from: string, to: string): number {
  return (dateMillis(to) - dateMillis(from)) / (MINUTES_PER_DAY * 60_000)
}

function dateMillis(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const millis = Date.UTC(year, month - 1, day)
  // `2026-02-30`처럼 없는 날짜는 다음 달로 넘어가므로 되돌려 보고 다르면 거부합니다
  if (!ISO_DATE.test(date) || new Date(millis).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`)
  }
  return millis
}

/** 구간 끝으로 자정(`24:00`)을 받습니다. */
function toMinutes(time: ClockTime): number {
  if (!CLOCK_TIME.test(time)) throw new RangeError(`Expected an HH:mm time, got "${time}"`)
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function fromMinutes(minutes: number): ClockTime {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
