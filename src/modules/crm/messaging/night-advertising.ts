import { CLINIC_TIME_ZONE } from '../../../shared/time/clinic-date.ts'

/**
 * 광고성 메시지 야간 제한입니다 (crm-send-window). 정보통신망법 제50조제3항에 따라 야간 시간대에는 야간 별도
 * 동의(`MARKETING_NIGHT`)가 있는 수신자에게만 광고를 보냅니다. 수동 발송·예약 실행·연락 작업 자동 발송·환자 단건
 * 발송이 모두 이 정책 하나로 판정합니다. 발송 요청은 거절하지 않고, 실제 발송 시점에 수신자를 뺍니다.
 */

/** 메시지 목적입니다. 야간 제한은 채널이 아니라 목적에 겁니다 (결정 3). */
export type MessagePurpose = 'ADVERTISING' | 'INFORMATIONAL'

/** 병원별 야간 광고 정책입니다. 시각은 병원 시간대의 자정부터 센 초입니다. */
export interface NightAdvertisingPolicy {
  /** 야간 시작(포함)입니다. */
  startSecond: number
  /** 야간 끝(미포함)입니다. 자정을 넘깁니다. */
  endSecond: number
  /** 켜면 야간 동의가 있어도 야간에는 광고를 보내지 않습니다. */
  blockAll: boolean
}

const HOUR = 3600

/** 법정 야간 시간대 21:00:00–08:00:00입니다 (결정 1). */
export const LEGAL_NIGHT = { startSecond: 21 * HOUR, endSecond: 8 * HOUR } as const

export const DEFAULT_NIGHT_ADVERTISING_POLICY: NightAdvertisingPolicy = { ...LEGAL_NIGHT, blockAll: false }

/**
 * 정책 저장 검증입니다. 병원은 시간대를 법정 시간대보다 넓게만 잡을 수 있습니다. 시작은 21:00 이전, 끝은 08:00
 * 이후이고, 자정을 넘겨야 합니다. 어기면 `INVALID_VALUE`입니다. 09:00–08:00처럼 아주 넓은 시간대도 법정 시간을
 * 지키므로 받습니다. 야간 광고를 아예 막으려면 `blockAll`을 씁니다.
 */
export function nightAdvertisingPolicyViolations(policy: NightAdvertisingPolicy): { field: string; code: string }[] {
  const second = (value: number) => Number.isInteger(value) && value >= 0 && value < 24 * HOUR
  const 야간시작유효 = second(policy.startSecond) && policy.startSecond <= LEGAL_NIGHT.startSecond
  const 야간끝유효 = second(policy.endSecond) && policy.endSecond >= LEGAL_NIGHT.endSecond
  // 자정을 넘기는지는 두 값이 각각 맞을 때만 봅니다. 잘못된 끝 때문에 맞는 시작을 탓하지 않습니다
  const 자정넘김 = policy.startSecond > policy.endSecond
  return [
    ...(야간시작유효 && (!야간끝유효 || 자정넘김) ? [] : [{ field: 'startSecond', code: 'INVALID_VALUE' }]),
    ...(야간끝유효 ? [] : [{ field: 'endSecond', code: 'INVALID_VALUE' }]),
  ]
}

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * 시점을 병원 시간대의 자정부터 센 초로 바꿉니다. 브라우저·서버 시간대와 상관없습니다 (결정 2). 밀리초는 버립니다.
 * 잘못된 시점(`NaN`)이면 `RangeError`입니다.
 */
export function clinicSecondOfDay(epochMillis: number): number {
  const parts = clockFormatter.formatToParts(epochMillis)
  const part = (type: string) => Number(parts.find((each) => each.type === type)!.value)
  return part('hour') * HOUR + part('minute') * 60 + part('second')
}

/** 하루 안의 시각(초)이 야간 시간대인지입니다. 시작은 포함하고 끝은 뺍니다. */
export const isNightSecond = (secondOfDay: number, policy: NightAdvertisingPolicy = DEFAULT_NIGHT_ADVERTISING_POLICY) =>
  secondOfDay >= policy.startSecond || secondOfDay < policy.endSecond

/** 이 시점에 보내는 메시지에 야간 제한이 걸리는지입니다. 광고에만 겁니다. */
export function nightRestrictionApplies(
  purpose: MessagePurpose,
  sendAtMillis: number,
  policy: NightAdvertisingPolicy = DEFAULT_NIGHT_ADVERTISING_POLICY,
): boolean {
  return purpose === 'ADVERTISING' && isNightSecond(clinicSecondOfDay(sendAtMillis), policy)
}

/**
 * 발송 시점의 수신자 제외 판정입니다 (결정 4·5). 야간 제한이 걸리고, 정책이 야간 광고를 막았거나 수신자에게 야간
 * 동의가 없으면 `NIGHT_TIME`입니다. 캠페인 견적의 `excluded.nightTime`과 연락 작업 `SKIPPED` 사유가 이 값입니다.
 * 메시지마다 실제로 보내는 시점에 다시 부릅니다. 20:59에 시작한 발송이 21:00을 넘기면 그 뒤 수신자는 빠집니다.
 */
export function nightTimeExclusion(
  purpose: MessagePurpose,
  recipient: { nightConsent: boolean },
  sendAtMillis: number,
  policy: NightAdvertisingPolicy = DEFAULT_NIGHT_ADVERTISING_POLICY,
): 'NIGHT_TIME' | null {
  if (!nightRestrictionApplies(purpose, sendAtMillis, policy)) return null
  return policy.blockAll || !recipient.nightConsent ? 'NIGHT_TIME' : null
}

/**
 * 연락 규칙 저장 경고입니다 (결정 4). 광고 규칙의 발송 시각(`HH:mm`, 병원 시간대)이 야간이면
 * `CONTACT_RULE_NIGHT_SEND_TIME` 경고를 줍니다. 야간 동의가 있는 수신자에게는 보낼 수 있으므로 저장은 막지
 * 않습니다. 기준(처방일·잔여 횟수 등)과 상관없이 검사하고, CENTRAL 프로그램은 병원별 `overrides.sendTime`이 있으면
 * 그 값으로 검사합니다. 엔드포인트가 경고에 `message`를 붙입니다.
 */
export function contactRuleNightWarning(
  rule: { purpose: MessagePurpose; sendTime: string },
  policy: NightAdvertisingPolicy = DEFAULT_NIGHT_ADVERTISING_POLICY,
): { code: 'CONTACT_RULE_NIGHT_SEND_TIME'; field: 'sendTime' } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(rule.sendTime)
  if (match === null) throw new RangeError(`sendTime must be HH:mm: ${rule.sendTime}`)
  if (rule.purpose !== 'ADVERTISING') return null
  const 발송시각초 = Number(match[1]) * HOUR + Number(match[2]) * 60
  return isNightSecond(발송시각초, policy) ? { code: 'CONTACT_RULE_NIGHT_SEND_TIME', field: 'sendTime' } : null
}

/**
 * 연락 작업 저장 경고입니다 (결정 4·5). `POST /contact-tasks`·`:reschedule`·`:approve`에서 광고 작업의 예정 시각이
 * 야간이면 `CONTACT_TASK_NIGHT_SEND_TIME` 경고를 줍니다. 현행은 저장을 막았고, 서버는 받아 두고 발송 시점에 야간
 * 동의 없는 수신자면 `SKIPPED`로 둡니다.
 */
export function contactTaskNightWarning(
  task: { purpose: MessagePurpose; scheduledAtMillis: number },
  policy: NightAdvertisingPolicy = DEFAULT_NIGHT_ADVERTISING_POLICY,
): { code: 'CONTACT_TASK_NIGHT_SEND_TIME'; field: 'scheduledAt' } | null {
  return nightRestrictionApplies(task.purpose, task.scheduledAtMillis, policy)
    ? { code: 'CONTACT_TASK_NIGHT_SEND_TIME', field: 'scheduledAt' }
    : null
}
