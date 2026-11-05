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

describe('checkAppointmentSlot', () => {
  it('accepts a free future slot', () => {
    expect(checkAppointmentSlot(input())).toEqual({ errors: [], warnings: [], acknowledged: [], accepted: true })
  })

  it('checks every slot the appointment covers', () => {
    const judgement = checkAppointmentSlot(input({ startTime: '11:30', durationMinutes: 60 }))
    expect(judgement.errors).toEqual(['OUTSIDE_HOURS', 'BREAK_TIME'])
  })

  it('warns when a later covered slot is full', () => {
    const full: SlotCell = { ...EMPTY, capacityPerSlot: 0 }
    const judgement = checkAppointmentSlot(
      input({ durationMinutes: 60, cellAt: (time) => (time === '10:30' ? full : EMPTY) }),
    )
    expect(judgement.warnings).toEqual(['CAPACITY_EXCEEDED'])
  })

  it('warns on a blocked slot until acknowledged', () => {
    const blocks = [{ start: '10:00', end: '10:30' }]
    expect(checkAppointmentSlot(input({ blocks })).warnings).toEqual(['SLOT_BLOCKED'])
    expect(checkAppointmentSlot(input({ blocks, acknowledge: ['SLOT_BLOCKED'] }))).toMatchObject({
      accepted: true,
      acknowledged: ['SLOT_BLOCKED'],
    })
  })

  it('does not let acknowledge skip a blocking error', () => {
    const judgement = checkAppointmentSlot(
      input({ startTime: '12:00', acknowledge: ['SLOT_BLOCKED', 'CAPACITY_EXCEEDED'] }),
    )
    expect(judgement).toMatchObject({ accepted: false, errors: ['OUTSIDE_HOURS', 'BREAK_TIME'] })
  })

  it('allows the current minute but not the one before', () => {
    const today = { date: '2026-11-02', time: '10:00' }
    expect(checkAppointmentSlot(input({ now: today })).accepted).toBe(true)
    expect(checkAppointmentSlot(input({ now: { ...today, time: '10:01' } })).errors).toEqual(['APPOINTMENT_IN_PAST'])
  })

  it('checks only date-level rules for an untimed appointment', () => {
    const untimed = input({ startTime: null, doctorOff: 'MORNING', blocks: [{ start: '00:00', end: '23:59' }] })
    expect(checkAppointmentSlot(untimed).accepted).toBe(true)
    expect(checkAppointmentSlot({ ...untimed, doctorOff: 'FULL_DAY' }).errors).toEqual(['DOCTOR_OFF'])
    expect(checkAppointmentSlot({ ...untimed, date: '2026-10-31' }).errors).toEqual(['APPOINTMENT_IN_PAST'])
  })

  it.each([0, 45, 150])('rejects a %i-minute duration', (durationMinutes) => {
    expect(checkAppointmentSlot(input({ durationMinutes })).errors[0]).toBe('APPOINTMENT_DURATION_INVALID')
  })

  it('throws on legacy date and time formats', () => {
    expect(() => checkAppointmentSlot(input({ date: '20261102' }))).toThrow(RangeError)
    expect(() => checkAppointmentSlot(input({ startTime: '9:00' }))).toThrow(RangeError)
  })
})

describe('checkAppointmentSlot edge cases', () => {
  it('limits the cell to one when the new appointment is exclusive', () => {
    const one: SlotCell = { bookings: [{ status: 'BOOKED', exclusive: false }], occupancies: [], capacityPerSlot: 3 }
    expect(checkAppointmentSlot(input({ cellAt: () => one })).warnings).toEqual([])
    expect(checkAppointmentSlot(input({ cellAt: () => one, exclusive: true })).warnings).toEqual(['CAPACITY_EXCEEDED'])
  })

  it('rejects an untimed appointment on a closed weekday', () => {
    const closed = { closed: true, periods: {} }
    expect(checkAppointmentSlot(input({ startTime: null, clinicDay: closed })).errors).toEqual(['OUTSIDE_HOURS'])
  })

  it.each([Infinity, 3e7])(
    'returns DURATION_INVALID for a %s-minute duration without expanding slots',
    (durationMinutes) => {
      expect(checkAppointmentSlot(input({ durationMinutes })).errors).toEqual(['APPOINTMENT_DURATION_INVALID'])
    },
  )

  it('accepts a period ending at midnight', () => {
    const lateDay = { closed: false, periods: { EVENING: { start: '22:00', end: '24:00' } } }
    expect(checkAppointmentSlot(input({ startTime: '23:30', clinicDay: lateDay })).accepted).toBe(true)
    expect(checkAppointmentSlot(input({ startTime: '23:30', durationMinutes: 60, clinicDay: lateDay })).errors).toEqual(
      ['OUTSIDE_HOURS'],
    )
  })

  it('splits a slot outside the doctor periods by lunch', () => {
    const periods = { AFTERNOON: { start: '14:00', end: '18:00' } }
    expect(halfDayOf('18:30', periods, { start: '12:00', end: '13:00' })).toBe('AFTERNOON')
  })
})

describe('slotCapacity', () => {
  it('ignores canceled exclusive bookings and counts arrived ones', () => {
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

describe('halfDayOf', () => {
  it('treats the evening period as afternoon', () => {
    expect(halfDayOf('19:00', { EVENING: { start: '18:00', end: '21:00' } }, null)).toBe('AFTERNOON')
  })

  it('falls back to noon without periods or lunch', () => {
    expect(halfDayOf('11:59', undefined, null)).toBe('MORNING')
    expect(halfDayOf('12:00', undefined, null)).toBe('AFTERNOON')
  })
})

describe('helpers', () => {
  it('finds the weekday of a date', () => {
    expect(weekdayOf('2026-11-02')).toBe('MON')
  })

  it('accepts durations that fill up to 120 minutes', () => {
    expect(isValidDuration(120, 15)).toBe(true)
    expect(isValidDuration(135, 15)).toBe(false)
  })
})
