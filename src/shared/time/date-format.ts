import { clinicDate } from './clinic-date.ts'

/**
 * 날짜·시각 형식 검사입니다. 날짜는 `YYYY-MM-DD`, 시각은 RFC 3339만 받습니다 (`docs/design/conventions.md`).
 * 형식이 틀리면 요청 스키마가 400 `VALIDATION_FAILED`로 거부합니다.
 */

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * RFC 3339 `date-time`입니다. 초는 필수이고 소수 초는 자릿수와 상관없이 받습니다. 소문자 `t`·`z`와 윤초 `:60`은
 * 받지 않습니다. RFC는 허용하지만 클라이언트가 보낼 일이 없어 단순하게 둡니다.
 */
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/** `YYYY-MM-DD` 형식의 실제 날짜인지입니다. */
export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value)
  if (match === null) return false
  const [, year, month, day] = match.map(Number) as [number, number, number, number]
  const date = new Date(0)
  // `Date.UTC`는 0–99년을 1900년대로 바꾸므로 연도를 따로 넣습니다
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * RFC 3339 시각의 병원 시간대 날짜입니다. 서버·브라우저 시간대와 상관없이 같은 날짜가 나옵니다.
 * 형식이 틀리면 `null`입니다.
 */
export function clinicDateOf(dateTime: string): string | null {
  if (!RFC3339.test(dateTime) || !isCalendarDate(dateTime.slice(0, 10))) return null
  const millis = Date.parse(dateTime)
  return Number.isNaN(millis) ? null : clinicDate(millis)
}
