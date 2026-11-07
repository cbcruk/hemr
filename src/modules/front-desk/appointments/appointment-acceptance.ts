import type {
  AcknowledgeCode,
  AppointmentSlotInput,
  AppointmentStatus,
  ClinicDay,
  ClinicNow,
  ClockTime,
  DayPeriod,
  DoctorOff,
  SlotCapacity,
  SlotCell,
  SlotErrorCode,
  SlotFacts,
  SlotJudgement,
  TimeRange,
  Weekday,
} from './appointment-acceptance.types.ts'

/** 한도와 예약 수를 셀 때 쓰는 상태입니다 (결정 2). 취소·부도는 자리를 차지하지 않습니다. */
const 유효예약상태: ReadonlySet<AppointmentStatus> = new Set(['BOOKED', 'ARRIVED'])

/** 한 번에 잡을 수 있는 최대 예약 길이입니다 (결정 9). */
export const MAX_DURATION_MINUTES = 120

/** 시간대 구분도 점심 휴게도 없을 때 오전·오후를 나누는 시각입니다 (결정 5). */
const 오후시작시각: ClockTime = '12:00'

const WEEKDAYS: readonly Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** 막는 오류의 순서입니다. 현행 드래그 이동의 검사 순서를 따르고, 길이 검사를 맨 앞에 둡니다. */
const 막는오류순서: readonly [keyof SlotFacts, SlotErrorCode][] = [
  ['durationInvalid', 'APPOINTMENT_DURATION_INVALID'],
  ['outsideHours', 'OUTSIDE_HOURS'],
  ['clinicClosed', 'CLINIC_CLOSED'],
  ['doctorOff', 'DOCTOR_OFF'],
  ['past', 'APPOINTMENT_IN_PAST'],
  ['breakTime', 'BREAK_TIME'],
]

const 확인경고순서: readonly [keyof SlotFacts, AcknowledgeCode][] = [
  ['blocked', 'SLOT_BLOCKED'],
  ['overCapacity', 'CAPACITY_EXCEEDED'],
]

/**
 * 셀의 수용 한도와 예약 수입니다.
 *
 * 한도와 예약 수는 같은 집합(`BOOKED`·`ARRIVED` 예약과 그 점유)으로 셉니다 (결정 2).
 * 그 집합에 `exclusive` 예약이 하나라도 있으면 한도는 1입니다. 점유는 가중 없이 1건으로 셉니다 (결정 8).
 */
export function slotCapacity(cell: SlotCell): SlotCapacity {
  const 유효예약점유 = [...cell.bookings, ...cell.occupancies].filter((건) => 유효예약상태.has(건.status))
  return {
    capacity: 유효예약점유.some((건) => 건.exclusive) ? 1 : cell.capacityPerSlot,
    booked: 유효예약점유.length,
  }
}

/**
 * 새 예약 하나를 더하면 한도를 넘는지입니다 (결정 3).
 *
 * 새 예약이 `exclusive`이면 셀에 이미 있는 예약과 상관없이 한도가 1입니다. 순서와 상관없이
 * "셀에 `exclusive` 예약이 있으면 한도 1"이 되게 하려는 것입니다 (결정 8).
 */
export function exceedsCapacity(cell: SlotCell, exclusive = false): boolean {
  const { capacity: 한도, booked: 예약수 } = slotCapacity(cell)
  return 예약수 + 1 > (exclusive ? 1 : 한도)
}

/** 과거 시각인지입니다. 현재 분의 슬롯은 과거가 아닙니다 (결정 4). */
export function isPastSlot(date: string, time: ClockTime, now: ClinicNow): boolean {
  return date < now.date || (date === now.date && time < now.time)
}

/** 시각이 `[start, end)` 구간 안에 있는지입니다. */
export function isWithin(time: ClockTime, range: TimeRange): boolean {
  return range.start <= time && time < range.end
}

/** 휴게 시간인지입니다. 휴게 구간은 `[시작, 종료)`입니다. */
export function isBreakTime(time: ClockTime, breaks: AppointmentSlotInput['breaks']): boolean {
  return [breaks.lunch, breaks.dinner].some((range) => range != null && isWithin(time, range))
}

/**
 * 반나절 휴진을 판정하는 오전·오후 구분입니다 (결정 5).
 *
 * 근무 일정의 시간대 구분이 있으면 그것으로 나누고, 야간은 오후로 봅니다. 구분이 없으면 점심 휴게
 * 시작 전을 오전, 종료 후를 오후로 보고 휴게 중은 어느 쪽도 아닙니다. 점심도 없으면 12:00으로 나눕니다.
 */
export function halfDayOf(
  time: ClockTime,
  periods: Partial<Record<DayPeriod, TimeRange>> | undefined,
  lunch: TimeRange | null | undefined,
): 'MORNING' | 'AFTERNOON' | null {
  if (periods !== undefined && Object.keys(periods).length > 0) {
    if (periods.MORNING && isWithin(time, periods.MORNING)) return 'MORNING'
    if ([periods.AFTERNOON, periods.EVENING].some((range) => range !== undefined && isWithin(time, range))) {
      return 'AFTERNOON'
    }
    // 근무 구간 밖 시각(이미 예약이 있어 보이는 시각)은 아래 점심·12:00 규칙으로 나눕니다
  }
  if (lunch) {
    if (time < lunch.start) return 'MORNING'
    if (time >= lunch.end) return 'AFTERNOON'
    return null
  }
  return time < 오후시작시각 ? 'MORNING' : 'AFTERNOON'
}

/** 의사 휴진에 걸리는 시각인지입니다. 반나절 휴진은 `halfDayOf`로 나눕니다. */
export function isDoctorOff(
  off: DoctorOff | null | undefined,
  time: ClockTime,
  periods: Partial<Record<DayPeriod, TimeRange>> | undefined,
  lunch: TimeRange | null | undefined,
): boolean {
  if (off === 'FULL_DAY') return true
  if (off === 'MORNING' || off === 'AFTERNOON') return halfDayOf(time, periods, lunch) === off
  return false
}

/**
 * 예약할 수 있는 시각 목록입니다.
 *
 * 그 요일 진료시간 구간 `[시작, 종료)`를 예약시간단위로 자른 시각에, 이미 예약이 있어 보이는 시각
 * (`extraTimes`)을 더합니다. 휴진 요일이면 구간을 더하지 않습니다. 오름차순으로 돌려줍니다.
 */
export function clinicSlotTimes(
  day: ClinicDay | null,
  unitMinutes: number,
  extraTimes: readonly ClockTime[] = [],
): ClockTime[] {
  const 슬롯시각 = new Set(extraTimes)
  if (day !== null && !day.closed && unitMinutes > 0) {
    for (const 진료구간 of Object.values(day.periods)) {
      for (let minute = toMinutes(진료구간.start); minute < toMinutes(진료구간.end); minute += unitMinutes) {
        슬롯시각.add(fromMinutes(minute))
      }
    }
  }
  return [...슬롯시각].sort()
}

/** 예약 길이가 예약시간단위의 배수이고 120분 이하인지입니다 (결정 9). */
export function isValidDuration(durationMinutes: number, unitMinutes: number): boolean {
  return (
    Number.isInteger(durationMinutes) &&
    unitMinutes > 0 &&
    durationMinutes > 0 &&
    durationMinutes % unitMinutes === 0 &&
    durationMinutes <= MAX_DURATION_MINUTES
  )
}

/** 사실을 오류·경고로 바꿉니다. 확인을 받은 경고는 `acknowledged`로 옮깁니다. */
export function judgeSlot(facts: SlotFacts, acknowledge: readonly AcknowledgeCode[] = []): SlotJudgement {
  const errors = 막는오류순서.filter(([fact]) => facts[fact] === true).map(([, code]) => code)
  const 발생경고 = 확인경고순서.filter(([fact]) => facts[fact] === true).map(([, code]) => code)
  const warnings = 발생경고.filter((code) => !acknowledge.includes(code))
  const acknowledged = 발생경고.filter((code) => acknowledge.includes(code))
  return { errors, warnings, acknowledged, accepted: errors.length === 0 && warnings.length === 0 }
}

/**
 * 예약 생성·일정 변경의 일정 검사입니다.
 *
 * 예약이 덮는 슬롯(시작 시각부터 길이만큼, 예약시간단위 간격)을 모두 검사합니다. 길이가 잘못됐으면
 * 시작 슬롯만 검사합니다. 시간 미정 예약은 시각과 상관없는 검사(진료 요일, 병원 휴진, 종일 휴진,
 * 지난 날짜)만 합니다.
 */
export function checkAppointmentSlot(input: AppointmentSlotInput): SlotJudgement {
  assertInput(input)
  const facts: SlotFacts = {
    durationInvalid: !isValidDuration(input.durationMinutes, input.unitMinutes),
    clinicClosed: input.closedDates.includes(input.date),
  }

  if (input.startTime === null) {
    facts.outsideHours = input.clinicDay === null || input.clinicDay.closed
    facts.doctorOff = input.doctorOff === 'FULL_DAY'
    facts.past = input.date < input.now.date
    return judgeSlot(facts, input.acknowledge)
  }

  const 진료시간슬롯 = new Set(clinicSlotTimes(input.clinicDay, input.unitMinutes, input.extraTimes))
  const 덮는슬롯 = facts.durationInvalid
    ? [input.startTime]
    : 덮는슬롯시각(input.startTime, input.durationMinutes, input.unitMinutes)
  facts.past = isPastSlot(input.date, input.startTime, input.now)
  for (const time of 덮는슬롯) {
    const 진료시간안 = 진료시간슬롯.has(time)
    if (!진료시간안) facts.outsideHours = true
    if (isDoctorOff(input.doctorOff, time, input.doctorPeriods, input.breaks.lunch)) facts.doctorOff = true
    if (isBreakTime(time, input.breaks)) facts.breakTime = true
    if (input.blocks.some((range) => isWithin(time, range))) facts.blocked = true
    // 진료시간 밖 시각(하루를 넘긴 `24:00` 포함)은 셀이 없어 한도를 보지 않습니다
    if (진료시간안 && exceedsCapacity(input.cellAt(time), input.exclusive)) facts.overCapacity = true
  }
  return judgeSlot(facts, input.acknowledge)
}

/** 날짜의 요일입니다. 진료시간 설정에서 그 요일을 찾을 때 씁니다. */
export function weekdayOf(date: string): Weekday {
  assertDate(date)
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!
}

/** 시작 시각부터 길이만큼 덮는 슬롯 시각입니다. 길이가 올바를 때만 부릅니다. */
function 덮는슬롯시각(시작시각: ClockTime, 예약길이: number, 예약시간단위: number): ClockTime[] {
  const 슬롯수 = 예약길이 / 예약시간단위
  return Array.from({ length: 슬롯수 }, (_, index) => fromMinutes(toMinutes(시작시각) + index * 예약시간단위))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** 구간 끝으로 자정(`24:00`)을 쓸 수 있습니다. */
const CLOCK_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

function toMinutes(time: ClockTime): number {
  assertTime(time)
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function fromMinutes(minutes: number): ClockTime {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * 날짜·시각 입력이 `YYYY-MM-DD`·`HH:mm`인지 확인합니다.
 *
 * 문자열로 비교하므로 현행 형식(`yyyyMMdd`, `H:mm`)이 그대로 들어오면 과거·휴게 판정이 조용히
 * 틀립니다. 그런 입력은 호출하는 쪽의 버그라 예외로 알립니다.
 */
function assertInput(input: AppointmentSlotInput): void {
  for (const date of [input.date, input.now.date, ...input.closedDates]) assertDate(date)
  const ranges = [
    input.breaks.lunch,
    input.breaks.dinner,
    ...input.blocks,
    ...Object.values(input.clinicDay?.periods ?? {}),
    ...Object.values(input.doctorPeriods ?? {}),
  ]
  const times = [input.startTime, input.now.time, ...(input.extraTimes ?? [])]
  for (const range of ranges) if (range) times.push(range.start, range.end)
  for (const time of times) if (time !== null) assertTime(time)
}

function assertDate(date: string): void {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  // `2026-02-30`처럼 없는 날짜는 다음 달로 넘어가므로 되돌려 보고 다르면 거부합니다
  const valid = ISO_DATE.test(date) && new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date
  if (!valid) throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`)
}

function assertTime(time: string): void {
  if (!CLOCK_TIME.test(time)) throw new RangeError(`Expected an HH:mm time, got "${time}"`)
}
