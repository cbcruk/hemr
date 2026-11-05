/** 예약 상태입니다. `docs/design/front-desk.md`의 예약 상태도와 같습니다. */
export type AppointmentStatus = 'BOOKED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELED'

/** `HH:mm` 시각입니다. 병원 시간대(`Asia/Seoul`) 벽시계 기준입니다. */
export type ClockTime = string

/** `[start, end)` 구간입니다. 끝 시각은 포함하지 않습니다. */
export interface TimeRange {
  start: ClockTime
  end: ClockTime
}

/** 근무 일정의 시간대 구분입니다. 현행 `오전`/`오후`/`야간`입니다. */
export type DayPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING'

export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'

/** 요일 하나의 진료시간입니다. 현행 `GET /settings/clinic-hours`의 한 요일입니다. */
export interface ClinicDay {
  closed: boolean
  periods: Partial<Record<DayPeriod, TimeRange>>
}

/** 의사 휴진입니다. 현행 `휴진일태그`의 `휴진`/`오전 휴진`/`오후 휴진`입니다. */
export type DoctorOff = 'FULL_DAY' | 'MORNING' | 'AFTERNOON'

/** 셀에 걸친 예약 하나입니다. `exclusive`는 진료항목 중 `exclusiveBooking`이 하나라도 있는지입니다. */
export interface SlotBooking {
  status: AppointmentStatus
  exclusive: boolean
}

/**
 * 예약 셀 하나(진료의 × 시각)입니다.
 *
 * `bookings`는 이 시각에 시작하는 예약, `occupancies`는 앞 시각에 시작해 길이 때문에 이 시각까지
 * 걸친 예약입니다. 외부 예약 요청(`BookingRequest`)은 예약이 아니므로 넣지 않습니다.
 */
export interface SlotCell {
  bookings: readonly SlotBooking[]
  occupancies: readonly SlotBooking[]
  capacityPerSlot: number
}

export interface SlotCapacity {
  capacity: number
  booked: number
}

/** 막는 오류입니다. 확인을 받아도 저장하지 않습니다. */
export type SlotErrorCode =
  | 'APPOINTMENT_DURATION_INVALID'
  | 'OUTSIDE_HOURS'
  | 'CLINIC_CLOSED'
  | 'DOCTOR_OFF'
  | 'APPOINTMENT_IN_PAST'
  | 'BREAK_TIME'

/** 확인(`acknowledge`)을 받으면 저장하는 경고입니다. */
export type AcknowledgeCode = 'SLOT_BLOCKED' | 'CAPACITY_EXCEEDED'

/** 슬롯 판정에 쓰는 사실입니다. 예약이 덮는 슬롯 중 하나라도 해당하면 참입니다. */
export interface SlotFacts {
  durationInvalid?: boolean
  outsideHours?: boolean
  clinicClosed?: boolean
  doctorOff?: boolean
  past?: boolean
  breakTime?: boolean
  blocked?: boolean
  overCapacity?: boolean
}

export interface SlotJudgement {
  /** 막는 오류입니다. 현행 드래그 검사 순서대로 정렬합니다. */
  errors: SlotErrorCode[]
  /** 확인을 받지 않은 경고입니다. 하나라도 있으면 저장하지 않습니다. */
  warnings: AcknowledgeCode[]
  /** 확인을 받고 넘어간 경고입니다. 이력에 남깁니다. */
  acknowledged: AcknowledgeCode[]
  accepted: boolean
}

/** 지금 시각입니다. `time`은 분 단위로 버린 값입니다. */
export interface ClinicNow {
  date: string
  time: ClockTime
}

/** 예약 생성·일정 변경 때 일정을 검사하는 입력입니다. */
export interface AppointmentSlotInput {
  /** `YYYY-MM-DD` */
  date: string
  /** `null`이면 시간 미정 예약입니다. */
  startTime: ClockTime | null
  durationMinutes: number
  /** 이 예약의 진료항목 중 `exclusiveBooking`이 있는지입니다. 참이면 이 예약이 들어갈 셀의 한도가 1입니다. */
  exclusive?: boolean
  /** 예약시간단위(10/15/30분)입니다. */
  unitMinutes: number
  now: ClinicNow
  /** 그 요일의 진료시간입니다. 설정이 없으면 `null`입니다. */
  clinicDay: ClinicDay | null
  /** 진료시간 밖이지만 이미 예약이 있어 플래너에 보이는 시각입니다. */
  extraTimes?: readonly ClockTime[]
  /** 병원 휴진일(`YYYY-MM-DD`)입니다. */
  closedDates: readonly string[]
  doctorOff?: DoctorOff | null
  /** 그 진료의의 근무 일정 시간대 구분입니다. 반나절 휴진 판정에 씁니다. */
  doctorPeriods?: Partial<Record<DayPeriod, TimeRange>>
  /** 점심·저녁 휴게입니다. */
  breaks: { lunch?: TimeRange | null; dinner?: TimeRange | null }
  /** 그 날짜·진료의에 해당하는 차단 구간입니다. */
  blocks: readonly TimeRange[]
  /** 시각별 셀입니다. 예약이 없는 셀도 설정 한도를 담아 돌려줍니다. 일정을 옮기는 예약 자신은 빼고 넘깁니다. */
  cellAt: (time: ClockTime) => SlotCell
  acknowledge?: readonly AcknowledgeCode[]
}
