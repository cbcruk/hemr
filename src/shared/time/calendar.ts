/**
 * `YYYY-MM-DD` 달력 날짜 계산입니다. 날짜는 병원 시간대(`Asia/Seoul`)의 달력 날짜이고,
 * 시각 없이 날짜끼리만 셉니다.
 */

const MILLIS_PER_DAY = 86_400_000

/** `date` 기준 만 나이입니다. 생일 당일에 한 살 늘어납니다. */
export function ageOn(birthDate: string, date: string): number {
  const [by, bm, bd] = parts(birthDate)
  const [y, m, d] = parts(date)
  const hadBirthday = m > bm || (m === bm && d >= bd)
  return y - by - (hadBirthday ? 0 : 1)
}

/** `from`에서 `to`까지 달력 날짜 차이입니다. 같은 날이면 0입니다. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMillis(to) - utcMillis(from)) / MILLIS_PER_DAY)
}

/** 요일 번호입니다. 일요일이 0, 토요일이 6입니다. */
export function weekdayIndex(date: string): number {
  return new Date(utcMillis(date)).getUTCDay()
}

function utcMillis(date: string): number {
  const [y, m, d] = parts(date)
  return Date.UTC(y, m - 1, d)
}

function parts(date: string): [number, number, number] {
  return date.split('-').map(Number) as [number, number, number]
}
