/**
 * 병원 시간대입니다. 테넌트 설정이 생기기 전까지 한 곳에 둡니다.
 *
 * "오늘", "진료 마감" 같은 경계는 서버가 이 시간대로 계산합니다 (`docs/design/conventions.md`).
 */
export const CLINIC_TIME_ZONE = 'Asia/Seoul'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 시점(epoch 밀리초)을 병원 시간대의 날짜 `YYYY-MM-DD`로 바꿉니다. */
export function clinicDate(epochMillis: number): string {
  return formatter.format(epochMillis)
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 시점(epoch 밀리초)을 병원 시간대의 시각 `HH:mm`으로 바꿉니다. */
export function clinicTime(epochMillis: number): string {
  return timeFormatter.format(epochMillis)
}

/**
 * 병원 시간대의 날짜 `YYYY-MM-DD` 하루를 UTC 시각 범위 `[from, to)`로 바꿉니다. 저장한 시각(`DateTime.formatIso`)과
 * 같은 형식이라 문자열로 비교할 수 있습니다. 한국은 일광 절약 시간이 없어 하루는 늘 24시간입니다.
 */
export function clinicDayRange(date: string): { from: string; to: string } {
  const from = Date.parse(`${date}T00:00:00+09:00`)
  return { from: new Date(from).toISOString(), to: new Date(from + 86_400_000).toISOString() }
}
