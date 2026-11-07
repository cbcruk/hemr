import { describe, expect, it } from 'vitest'
import { checkAppointmentSlot, halfDayOf, isValidDuration, slotCapacity, weekdayOf } from './appointment-acceptance.ts'
import type { AppointmentSlotInput, SlotCell } from './appointment-acceptance.types.ts'

const EMPTY: SlotCell = { bookings: [], occupancies: [], capacityPerSlot: 3 }

function input(overrides: Partial<AppointmentSlotInput> = {}): AppointmentSlotInput {
  return {
    date: '2026-11-02',
    startTime: '10:00',
    durationMinutes: 30,
    unitMinutes: 30,
    now: { date: '2026-11-01', time: '14:30' },
    clinicDay: {
      closed: false,
      periods: { MORNING: { start: '09:00', end: '12:00' }, AFTERNOON: { start: '13:00', end: '18:00' } },
    },
    closedDates: [],
    breaks: { lunch: { start: '12:00', end: '13:00' } },
    blocks: [],
    cellAt: () => EMPTY,
    ...overrides,
  }
}

describe('예약 일정 검사 (checkAppointmentSlot)', () => {
  it('비어 있는 미래 슬롯은 받습니다', () => {
    expect(checkAppointmentSlot(input())).toEqual({ errors: [], warnings: [], acknowledged: [], accepted: true })
  })

  it('예약이 덮는 슬롯을 모두 검사합니다', () => {
    const judgement = checkAppointmentSlot(input({ startTime: '11:30', durationMinutes: 60 }))
    expect(judgement.errors).toEqual(['OUTSIDE_HOURS', 'BREAK_TIME'])
  })

  it('뒤쪽 덮는 슬롯이 한도를 넘어도 경고합니다', () => {
    const full: SlotCell = { ...EMPTY, capacityPerSlot: 0 }
    const judgement = checkAppointmentSlot(
      input({ durationMinutes: 60, cellAt: (time) => (time === '10:30' ? full : EMPTY) }),
    )
    expect(judgement.warnings).toEqual(['CAPACITY_EXCEEDED'])
  })

  it('차단 슬롯은 확인을 받기 전까지 경고합니다', () => {
    const blocks = [{ start: '10:00', end: '10:30' }]
    expect(checkAppointmentSlot(input({ blocks })).warnings).toEqual(['SLOT_BLOCKED'])
    expect(checkAppointmentSlot(input({ blocks, acknowledge: ['SLOT_BLOCKED'] }))).toMatchObject({
      accepted: true,
      acknowledged: ['SLOT_BLOCKED'],
    })
  })

  it('확인을 보내도 막는 오류는 넘어가지 않습니다', () => {
    const judgement = checkAppointmentSlot(
      input({ startTime: '12:00', acknowledge: ['SLOT_BLOCKED', 'CAPACITY_EXCEEDED'] }),
    )
    expect(judgement).toMatchObject({ accepted: false, errors: ['OUTSIDE_HOURS', 'BREAK_TIME'] })
  })

  it('현재 분의 슬롯은 받고 지난 분의 슬롯은 과거로 막습니다', () => {
    const today = { date: '2026-11-02', time: '10:00' }
    expect(checkAppointmentSlot(input({ now: today })).accepted).toBe(true)
    expect(checkAppointmentSlot(input({ now: { ...today, time: '10:01' } })).errors).toEqual(['APPOINTMENT_IN_PAST'])
  })

  it('시간 미정 예약은 날짜 단위 규칙만 검사합니다', () => {
    const untimed = input({ startTime: null, doctorOff: 'MORNING', blocks: [{ start: '00:00', end: '23:59' }] })
    expect(checkAppointmentSlot(untimed).accepted).toBe(true)
    expect(checkAppointmentSlot({ ...untimed, doctorOff: 'FULL_DAY' }).errors).toEqual(['DOCTOR_OFF'])
    expect(checkAppointmentSlot({ ...untimed, date: '2026-10-31' }).errors).toEqual(['APPOINTMENT_IN_PAST'])
  })

  it.each([0, 45, 150])('%i분 길이는 막습니다', (durationMinutes) => {
    expect(checkAppointmentSlot(input({ durationMinutes })).errors[0]).toBe('APPOINTMENT_DURATION_INVALID')
  })

  it('현행 날짜·시각 형식은 예외를 던집니다', () => {
    expect(() => checkAppointmentSlot(input({ date: '20261102' }))).toThrow(RangeError)
    expect(() => checkAppointmentSlot(input({ startTime: '9:00' }))).toThrow(RangeError)
  })
})

describe('예약 일정 검사: 경계 사례', () => {
  it('새 예약이 exclusive이면 셀 한도가 1입니다', () => {
    const one: SlotCell = { bookings: [{ status: 'BOOKED', exclusive: false }], occupancies: [], capacityPerSlot: 3 }
    expect(checkAppointmentSlot(input({ cellAt: () => one })).warnings).toEqual([])
    expect(checkAppointmentSlot(input({ cellAt: () => one, exclusive: true })).warnings).toEqual(['CAPACITY_EXCEEDED'])
  })

  it('휴진 요일의 시간 미정 예약은 진료시간 밖으로 막습니다', () => {
    const closed = { closed: true, periods: {} }
    expect(checkAppointmentSlot(input({ startTime: null, clinicDay: closed })).errors).toEqual(['OUTSIDE_HOURS'])
  })

  it.each([Infinity, 3e7])('%s분 길이는 슬롯을 펼치지 않고 길이 오류만 돌려줍니다', (durationMinutes) => {
    expect(checkAppointmentSlot(input({ durationMinutes })).errors).toEqual(['APPOINTMENT_DURATION_INVALID'])
  })

  it('자정에 끝나는 진료 구간을 받고 자정을 넘으면 막습니다', () => {
    const lateDay = { closed: false, periods: { EVENING: { start: '22:00', end: '24:00' } } }
    expect(checkAppointmentSlot(input({ startTime: '23:30', clinicDay: lateDay })).accepted).toBe(true)
    expect(checkAppointmentSlot(input({ startTime: '23:30', durationMinutes: 60, clinicDay: lateDay })).errors).toEqual(
      ['OUTSIDE_HOURS'],
    )
  })

  it('진료의 근무 구간 밖 시각은 점심으로 오전·오후를 나눕니다', () => {
    const periods = { AFTERNOON: { start: '14:00', end: '18:00' } }
    expect(halfDayOf('18:30', periods, { start: '12:00', end: '13:00' })).toBe('AFTERNOON')
  })
})

describe('셀 수용 한도 (slotCapacity)', () => {
  it('취소·부도 예약은 exclusive여도 무시하고 내원 예약은 셉니다', () => {
    const cell: SlotCell = {
      bookings: [
        { status: 'CANCELED', exclusive: true },
        { status: 'ARRIVED', exclusive: false },
      ],
      occupancies: [{ status: 'NO_SHOW', exclusive: true }],
      capacityPerSlot: 4,
    }
    expect(slotCapacity(cell)).toEqual({ capacity: 4, booked: 1 })
  })
})

describe('오전·오후 구분 (halfDayOf)', () => {
  it('야간 구간은 오후로 봅니다', () => {
    expect(halfDayOf('19:00', { EVENING: { start: '18:00', end: '21:00' } }, null)).toBe('AFTERNOON')
  })

  it('시간대 구분도 점심도 없으면 12:00부터 오후입니다', () => {
    expect(halfDayOf('11:59', undefined, null)).toBe('MORNING')
    expect(halfDayOf('12:00', undefined, null)).toBe('AFTERNOON')
  })
})

describe('도움 함수', () => {
  it('날짜의 요일을 찾습니다', () => {
    expect(weekdayOf('2026-11-02')).toBe('MON')
  })

  it('120분까지 단위의 배수인 길이만 받습니다', () => {
    expect(isValidDuration(120, 15)).toBe(true)
    expect(isValidDuration(135, 15)).toBe(false)
  })
})
