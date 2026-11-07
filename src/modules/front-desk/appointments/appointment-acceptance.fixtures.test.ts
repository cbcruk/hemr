import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkAppointmentSlot,
  clinicSlotTimes,
  isBreakTime,
  isDoctorOff,
  isPastSlot,
  isValidDuration,
  judgeSlot,
  slotCapacity,
  weekdayOf,
} from './appointment-acceptance.ts'
import type {
  AppointmentSlotInput,
  ClinicDay,
  DayPeriod,
  DoctorOff,
  SlotBooking,
  SlotCell,
  SlotErrorCode,
  TimeRange,
  Weekday,
} from './appointment-acceptance.types.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/appointment-acceptance.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(한글 키, `yyyyMMdd`)을 서버 입력으로 바꾸고, 결정
 * (`docs/design/rule-decisions.md`의 appointment-acceptance)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다. 입력 모양이 달라 따로
 * 검사하는 케이스는 `SPECIAL`에 이름을 모았습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/appointment-acceptance.json'), 'utf8'),
) as { cases: FixtureCase[] }

const NOW = { date: '2026-11-01', time: '14:30' }
const EXTERNAL_ORIGINS = new Set(['naver_doctalk', 'kakao_doctalk'])
const DECIDED = new Set(['등록', '승인', '거절', '부도', '내원', '예약취소'])
const DOCTOR_OFF: Record<string, DoctorOff> = { 휴진: 'FULL_DAY', '오전 휴진': 'MORNING', '오후 휴진': 'AFTERNOON' }
const PERIOD: Record<string, DayPeriod> = { 오전: 'MORNING', 오후: 'AFTERNOON', 야간: 'EVENING' }
const WEEKDAY: Record<string, Weekday> = {
  일요일: 'SUN',
  월요일: 'MON',
  화요일: 'TUE',
  수요일: 'WED',
  목요일: 'THU',
  금요일: 'FRI',
  토요일: 'SAT',
}
const DROP_MESSAGE: Record<string, SlotErrorCode> = {
  '진료시간이 아닌 경우 예약을 이동할 수 없습니다.': 'OUTSIDE_HOURS',
  '병원 휴진일에는 예약을 이동할 수 없습니다.': 'CLINIC_CLOSED',
  '의사 휴진일에는 예약을 이동할 수 없습니다.': 'DOCTOR_OFF',
  '과거 시간으로 예약을 이동할 수 없습니다.': 'APPOINTMENT_IN_PAST',
  '휴게 시간에는 예약을 이동할 수 없습니다.': 'BREAK_TIME',
}

function isoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

function range(value: { 시작시간?: string; 종료시간?: string } | null | undefined): TimeRange | null {
  return value?.시작시간 && value.종료시간 ? { start: value.시작시간, end: value.종료시간 } : null
}

/**
 * 현행 예약을 셀 예약으로 바꿉니다. 외부 출처의 대기·거절 요청은 `BookingRequest`라서 예약이 아니므로
 * 뺍니다 (결정 2). 승인된 외부 요청은 예약이 됩니다.
 */
function toBooking(booking: Record<string, any>): SlotBooking | null {
  const statuses: string[] = (booking['예약변경내역'] ?? []).map((change: any) => change.to?.예약상태 ?? '')
  if (EXTERNAL_ORIGINS.has(booking['주문출처'])) {
    if (statuses.includes('거절') || !statuses.some((status) => DECIDED.has(status))) return null
  }
  const status = booking['취소여부'] ? 'CANCELED' : booking['부도여부'] ? 'NO_SHOW' : 'BOOKED'
  return { status, exclusive: booking['추가예약제한'] === true }
}

function toCell(cell: Record<string, any>): SlotCell {
  return {
    bookings: (cell['예약내역'] ?? []).map(toBooking).filter((booking: SlotBooking | null) => booking !== null),
    occupancies: (cell['점유내역'] ?? []).map((occupancy: any) => ({
      status: 'BOOKED' as const,
      exclusive: occupancy['추가예약제한'] === true,
    })),
    capacityPerSlot: cell['예약가능건수'],
  }
}

function toClinicDay(day: Record<string, any> | undefined): ClinicDay | null {
  if (day === undefined) return null
  const periods: ClinicDay['periods'] = {}
  for (const [name, value] of Object.entries(day['시간대별진료시간'] ?? {})) {
    const parsed = range(value as any)
    if (parsed) periods[PERIOD[name]!] = parsed
  }
  return { closed: day['휴진일여부'] === true, periods }
}

const MONDAY: ClinicDay = {
  closed: false,
  periods: { MORNING: { start: '09:00', end: '12:00' }, AFTERNOON: { start: '14:00', end: '18:00' } },
}

/** 모든 검사를 통과하는 미래 예약에서 필요한 값만 바꿔 쓰는 입력입니다. */
function slotInput(overrides: Partial<AppointmentSlotInput> = {}): AppointmentSlotInput {
  return {
    date: '2026-11-02',
    startTime: '10:00',
    durationMinutes: 30,
    unitMinutes: 30,
    now: NOW,
    clinicDay: MONDAY,
    closedDates: [],
    breaks: { lunch: { start: '12:00', end: '14:00' } },
    blocks: [],
    cellAt: () => ({ bookings: [], occupancies: [], capacityPerSlot: 3 }),
    ...overrides,
  }
}

function cases(check: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['check'] === check && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. 값은 바뀐 기대값입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 2: 거절된 요청은 예약이 아니므로 한도를 줄이지 않습니다
  'exclusive: rejected external request with 추가예약제한 still reduces capacity (filter mismatch)': {
    예약가능건수: 5,
    예약건수: 0,
    예약초과여부: false,
  },
  // 결정 4: 현재 분의 슬롯은 과거가 아닙니다
  'past: today slot equal to now (current minute) counts as past': false,
  // 결정 5: 점심이 없으면 12:00으로 나눕니다
  'doctor off: 오후 휴진 with no lunch configured never blocks': true,
  'doctor off: 오전 휴진 with no lunch configured blocks all day': false,
  // 결정 4: 수정 중인 예약의 시각도 지났으면 과거입니다. 현행은 기준을 min(지금, 그 예약 시각)으로 낮췄습니다
  'today cutoff: editing booking at earlier time keeps its own slot': [
    { 시간대: '오후', 시간별예약: [{ 시간: '14:30' }, { 시간: '15:00' }] },
  ],
}

/** 일반 경로 대신 이름으로 골라 따로 검사하는 케이스입니다. 이름이 바뀌면 완전성 검사가 실패합니다. */
const SPECIAL = {
  dropOverbooked: 'drop: overbooked slot is not checked',
  doctorOffWarning: 'create: doctor with 휴진일태그 shows warning but slots stay selectable',
  closedDayGrid: 'create: closed day selected in side panel hides the time grid',
} as const

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'capacity: no data for slot':
    '서버의 cellAt은 예약이 없어도 설정 한도를 담은 셀을 돌려줍니다. 한도 0인 빈 셀은 데이터가 없는 셀과 다릅니다',
  'drop: no 예약수정 permission': '권한 모델이 아직 없습니다',
  'side panel cell: blocked (break/차단) is disabled':
    '휴게와 차단을 한 칸으로 합친 화면 상태입니다. 서버는 BREAK_TIME(막음)과 SLOT_BLOCKED(확인 후 허용)로 나누고 blockedTimes 케이스가 검사합니다',
  'selectable: inactive/danger': '화면 셀 상태입니다',
  'selectable: disabled': '화면 셀 상태입니다',
  'max selectable slots for unit 0 min': '예약시간단위는 10·15·30분만 받으므로 0분 설정은 생기지 않습니다',
  'default slots: 기본소요슬롯수 wins':
    '진료항목 기본 길이는 화면의 기본 선택값입니다. 서버는 받은 durationMinutes만 검사합니다',
  'default slots: 45min at 30 unit rounds to 2': '화면의 기본 선택값입니다',
  'default slots: 40min at 30 unit rounds to 1': '화면의 기본 선택값입니다',
  'default slots: no treatment selected': '화면의 기본 선택값입니다',
  'doctor without schedule yields no slots':
    '진료의별 근무 일정이 아직 없습니다. 근무하지 않는 진료의 예약을 막는 검사는 근무 일정을 만들 때 더합니다(rule-decisions.md의 appointment-acceptance 구현 메모)',
  'create/update: server 409 shows duplicate message':
    '중복 예약(409)의 기준은 예약 저장소를 만들 때 정합니다. 화면 문구입니다',
}

describe('예약 수용 판정 픽스처', () => {
  describe('셀 수용 한도 (결정 2·3·8: 같은 집합으로 세고 exclusive가 있으면 한도 1)', () => {
    it.each(cases('plannerCellCapacity').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const want = (CHANGED[name] ?? expected) as Record<string, unknown>
      const { capacity, booked } = slotCapacity(toCell(input['cell']))

      expect({ 예약가능건수: capacity, 예약건수: booked, 예약초과여부: booked > capacity }).toEqual(want)
    })
  })

  describe('과거 슬롯 (결정 4)', () => {
    it.each(cases('isPastDateTime').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      expect(isPastSlot(isoDate(input['date']), input['time'], NOW)).toBe(CHANGED[name] ?? expected)
    })
  })

  describe('의사 휴진 (결정 5)', () => {
    it.each(cases('isDoctorOffDay').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const off = input['휴진일태그'] ? DOCTOR_OFF[input['휴진일태그']] : null
      expect(isDoctorOff(off, input['appointmentTime'], undefined, range(input['점심휴게시간']))).toBe(
        CHANGED[name] ?? expected,
      )
    })

    it('반나절 휴진은 진료의 근무 일정의 시간대 구분으로 먼저 나눕니다', () => {
      const periods = { MORNING: { start: '09:00', end: '13:30' }, AFTERNOON: { start: '14:30', end: '18:00' } }
      const lunch = { start: '12:00', end: '13:00' }
      expect(isDoctorOff('MORNING', '13:00', periods, lunch)).toBe(true)
      expect(isDoctorOff('AFTERNOON', '14:30', periods, lunch)).toBe(true)
    })
  })

  describe('휴게 시간', () => {
    it.each(cases('isBreakTime').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      expect(isBreakTime(input['time'], { lunch: range(input['점심휴게시간']) })).toBe(expected)
    })
  })

  describe('진료시간 슬롯', () => {
    it.each(cases('availableTimes').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const days = input['treatmentDays'] as Record<string, any>
      const weekday = weekdayOf(isoDate(input['dateString']))
      const name = Object.keys(WEEKDAY).find((key) => WEEKDAY[key] === weekday)!

      // 서버는 시각을 오름차순으로 돌려줍니다. 현행은 응답 시각을 앞에 붙였습니다.
      expect(clinicSlotTimes(toClinicDay(days[name]), input['unitMinutes'], input['apiTimes'])).toEqual(
        [...expected].sort(),
      )
    })
  })

  describe('드래그 이동 검사 순서 (현행 검사 순서, 결정 1·7: 차단과 한도 초과는 확인을 받아야 저장)', () => {
    it.each(cases('validateDrop').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const flags = input['flags']
      const facts = {
        outsideHours: !flags.isTimeSlotAvailable,
        clinicClosed: flags.hasHospitalHoliday,
        doctorOff: flags.isDoctorOffDay,
        past: flags.isPastDateTime,
        breakTime: flags.isBreakTime,
        blocked: flags.hasBlockingTime,
        // 결정 1: 현행은 일정 변경에서 한도를 보지 않았지만, 서버는 경고하고 확인을 받습니다
        overCapacity: name === SPECIAL.dropOverbooked,
      }
      const acknowledge = input['confirmBlocked'] ? (['SLOT_BLOCKED'] as const) : []
      const judgement = judgeSlot(facts, acknowledge)

      if (facts.overCapacity) {
        expect(judgement).toMatchObject({ accepted: false, warnings: ['CAPACITY_EXCEEDED'] })
        expect(judgeSlot(facts, ['CAPACITY_EXCEEDED']).accepted).toBe(true)
        return
      }
      expect(judgement.accepted).toBe(expected.allowed)
      expect(judgement.errors[0] ?? null).toBe(expected.message === null ? null : DROP_MESSAGE[expected.message])
      if (flags.hasBlockingTime && !input['confirmBlocked']) expect(judgement.warnings).toEqual(['SLOT_BLOCKED'])
    })
  })

  describe('예약 사이드 패널 슬롯 정보 (결정 8: 진료항목 단위 exclusive)', () => {
    it.each(cases('sidePanelSlotInfo').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const toItemBooking = (booking: Record<string, any>): SlotBooking => ({
        status: booking['취소여부'] ? 'CANCELED' : booking['부도여부'] ? 'NO_SHOW' : 'BOOKED',
        exclusive: (booking['진료항목목록'] ?? []).some((item: any) => item['추가예약제한'] === true),
      })
      for (const slot of input['예약내역'] as any[]) {
        // 서버 셀은 진료의 × 시각이라 다른 진료의 예약은 이 진료의 셀에 없습니다
        const own = (slot['진료의별예약내역'] as any[]).find((cell) => cell['진료의Id'] === input['doctorId'])
        const time: string = slot['시간']
        if (own === undefined) {
          expect(expected.displayCount[time]).toBeUndefined()
          continue
        }
        const { capacity, booked } = slotCapacity({
          bookings: own['예약내역'].map(toItemBooking),
          occupancies: own['점유내역'].map((occupancy: any) => ({
            status: 'BOOKED' as const,
            exclusive: occupancy['추가예약제한'] === true,
          })),
          capacityPerSlot: 5,
        })
        const count = expected.displayCount[time]

        expect(booked).toBe(count.예약건수 + count.점유건수)
        expect(capacity === 1).toBe(time in expected.limitedTreatmentName)
      }
    })
  })

  describe('예약 사이드 패널 한도 표시 (결정 3: 새 예약을 더하면 넘는지)', () => {
    it.each(cases('sidePanelCell').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const slot = input['slot']
      const count = input['displayCount'] ?? { 예약건수: 0, 점유건수: 0 }
      const booking = (exclusive: boolean): SlotBooking => ({ status: 'BOOKED', exclusive })
      const cell: SlotCell = {
        bookings: [
          ...Array.from({ length: count.예약건수 }, () => booking(false)),
          ...(input['limitedTreatmentName'] ? [booking(true)] : []),
        ],
        occupancies: Array.from({ length: count.점유건수 }, () => booking(false)),
        capacityPerSlot: slot['예약가능건수'],
      }
      const judgement = checkAppointmentSlot(slotInput({ cellAt: () => cell }))

      expect(judgement.warnings.includes('CAPACITY_EXCEEDED')).toBe(expected.tone === 'danger')
      expect(judgement.errors).toEqual([])
    })
  })

  describe('예약 길이 (결정 9: 단위의 배수, 120분 이하)', () => {
    it.each(cases('maxSlotCount').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const unit = input['unitMinutes']
      expect(isValidDuration(expected * unit, unit)).toBe(true)
      expect(isValidDuration((expected + 1) * unit, unit)).toBe(false)
    })
  })

  describe('차단 시간 (결정 7: 휴게는 막고 차단은 확인 후 허용)', () => {
    it.each(cases('blockedTimes').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const day = input['day']
      const date = input['date']
      const unit = input['unitMinutes']
      const blocks = (day['차단내역'] as any[])
        .filter((block) => block['차단일자'] === date)
        .map((block) => ({ start: block['차단시간'], end: addMinutes(block['차단시간'], unit) }))
      const breaks = { lunch: range(day['점심휴게시간']), dinner: range(day['저녁휴게시간']) }
      const day24 = { closed: false, periods: { MORNING: { start: '09:00', end: '20:00' } } }

      const flagged = clinicSlotTimes(day24, unit).filter((time) => {
        const judgement = checkAppointmentSlot(
          slotInput({ date: isoDate(date), startTime: time, unitMinutes: unit, clinicDay: day24, breaks, blocks }),
        )
        return judgement.errors.includes('BREAK_TIME') || judgement.warnings.includes('SLOT_BLOCKED')
      })
      expect(flagged).toEqual(expected)
    })
  })

  describe('오늘 지난 슬롯 숨김 (결정 4)', () => {
    it.each(cases('sidePanelSections').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      if (name === SPECIAL.doctorOffWarning) {
        // 결정 6: 경고만 하던 의사 휴진을 생성에서도 막습니다
        const judgement = checkAppointmentSlot(slotInput({ doctorOff: DOCTOR_OFF[input['휴진일태그']]! }))
        expect(judgement.errors).toEqual(['DOCTOR_OFF'])
        return
      }
      const date = input['isToday'] ? NOW.date : '2026-11-02'
      const times = (input['schedule'][0]['근무시간별예약'] as any[]).flatMap((section) =>
        section['시간별예약'].map((slot: any) => slot['시간'] as string),
      )
      const expectedTimes = ((CHANGED[name] ?? expected) as any[]).flatMap((section) =>
        section['시간별예약'].map((slot: any) => slot['시간']),
      )

      expect(times.filter((time) => !isPastSlot(date, time, NOW)).sort()).toEqual(expectedTimes.sort())
    })
  })

  describe('병원 휴진일', () => {
    it.each(cases('checkOffDay').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      if (name === SPECIAL.closedDayGrid) {
        const judgement = checkAppointmentSlot(slotInput({ closedDates: ['2026-11-02'] }))
        expect(judgement.errors).toEqual(['CLINIC_CLOSED'])
        return
      }
      const judgement = checkAppointmentSlot(
        slotInput({ date: input['date'], closedDates: (input['closedDays'] as string[]).map(isoDate) }),
      )
      expect(judgement.errors.includes('CLINIC_CLOSED')).toBe(expected)
    })
  })

  describe('한도 초과 저장 (결정 1)', () => {
    it.each(cases('serverConflict').map((c) => [c.name, c] as const))('%s', () => {
      const full: SlotCell = { bookings: [{ status: 'BOOKED', exclusive: true }], occupancies: [], capacityPerSlot: 3 }
      const input = slotInput({ cellAt: () => full })

      expect(checkAppointmentSlot(input)).toMatchObject({ accepted: false, warnings: ['CAPACITY_EXCEEDED'] })
      expect(checkAppointmentSlot({ ...input, acknowledge: ['CAPACITY_EXCEEDED'] })).toMatchObject({
        accepted: true,
        acknowledged: ['CAPACITY_EXCEEDED'],
      })
    })
  })

  it('픽스처 사례마다 옮겼거나 옮기지 않은 이유를 적었고 따로 적은 사례 이름은 모두 픽스처에 있습니다', () => {
    const ported = new Set([
      'plannerCellCapacity',
      'isPastDateTime',
      'isDoctorOffDay',
      'isBreakTime',
      'availableTimes',
      'validateDrop',
      'sidePanelSlotInfo',
      'sidePanelCell',
      'maxSlotCount',
      'blockedTimes',
      'sidePanelSections',
      'checkOffDay',
      'serverConflict',
    ])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['check']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.values(SPECIAL).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})

function addMinutes(time: string, minutes: number): string {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
