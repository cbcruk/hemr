import { describe, expect, it } from 'vitest'
import {
  clinicSecondOfDay,
  contactRuleNightWarning,
  contactTaskNightWarning,
  nightAdvertisingPolicyViolations,
  nightRestrictionApplies,
  nightTimeExclusion,
} from './night-advertising.ts'

const kst = (time: string) => Date.parse(`2026-11-03T${time}+09:00`)

describe('병원 시각의 초 (clinicSecondOfDay)', () => {
  it('어느 오프셋의 시점이든 병원 시간대 시각으로 읽습니다', () => {
    expect(clinicSecondOfDay(Date.parse('2026-11-03T12:00:05Z'))).toBe(21 * 3600 + 5)
    expect(clinicSecondOfDay(kst('00:00:00'))).toBe(0)
  })
})

describe('야간 제한 적용 (nightRestrictionApplies)', () => {
  it('광고는 21:00:00부터 걸리고 08:00:00부터 풀리며 알림은 걸리지 않습니다', () => {
    expect(nightRestrictionApplies('ADVERTISING', kst('20:59:59'))).toBe(false)
    expect(nightRestrictionApplies('ADVERTISING', kst('21:00:00'))).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('07:59:59'))).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('08:00:00'))).toBe(false)
    expect(nightRestrictionApplies('INFORMATIONAL', kst('23:00:00'))).toBe(false)
  })

  it('병원이 넓힌 야간 시간대를 따릅니다', () => {
    const policy = { startSecond: 20 * 3600 + 30 * 60, endSecond: 8 * 3600, blockAll: false }
    expect(nightRestrictionApplies('ADVERTISING', kst('20:30:00'), policy)).toBe(true)
  })
})

describe('야간 수신자 제외 (nightTimeExclusion)', () => {
  const night = kst('22:00:00')

  it('야간 광고는 야간 동의가 없는 수신자만 뺍니다', () => {
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, night)).toBe('NIGHT_TIME')
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: true }, night)).toBeNull()
    expect(nightTimeExclusion('INFORMATIONAL', { nightConsent: false }, night)).toBeNull()
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, kst('12:00:00'))).toBeNull()
  })

  it('병원이 야간 광고를 막으면 동의한 수신자도 뺍니다', () => {
    const policy = { startSecond: 21 * 3600, endSecond: 8 * 3600, blockAll: true }
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: true }, night, policy)).toBe('NIGHT_TIME')
  })
})

describe('야간 광고 정책 검증 (nightAdvertisingPolicyViolations)', () => {
  it('법정 야간 시간대를 넓히는 정책만 받습니다', () => {
    expect(nightAdvertisingPolicyViolations({ startSecond: 20 * 3600, endSecond: 9 * 3600, blockAll: false })).toEqual(
      [],
    )
    expect(nightAdvertisingPolicyViolations({ startSecond: 22 * 3600, endSecond: 7 * 3600, blockAll: false })).toEqual([
      { field: 'startSecond', code: 'INVALID_VALUE' },
      { field: 'endSecond', code: 'INVALID_VALUE' },
    ])
    expect(nightAdvertisingPolicyViolations({ startSecond: 6 * 3600, endSecond: 8 * 3600, blockAll: false })).toEqual([
      { field: 'startSecond', code: 'INVALID_VALUE' },
    ])
  })
})

describe('연락 규칙 야간 경고 (contactRuleNightWarning)', () => {
  it('발송 시각이 야간인 광고 규칙에만 경고합니다', () => {
    expect(contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '21:00' })).toEqual({
      code: 'CONTACT_RULE_NIGHT_SEND_TIME',
      field: 'sendTime',
    })
    expect(contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '20:55' })).toBeNull()
    expect(contactRuleNightWarning({ purpose: 'INFORMATIONAL', sendTime: '23:00' })).toBeNull()
  })

  it('형식이 틀린 발송 시각은 예외를 던집니다', () => {
    expect(() => contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '24:00' })).toThrow(RangeError)
  })
})

describe('경계 사례', () => {
  const H = 3600
  const policy = (startSecond: number, endSecond: number) => ({ startSecond, endSecond, blockAll: false })

  it('정책의 시작과 끝을 따로 검증합니다', () => {
    expect(nightAdvertisingPolicyViolations(policy(21 * H, Number.NaN))).toEqual([
      { field: 'endSecond', code: 'INVALID_VALUE' },
    ])
    for (const bad of [86400, 21 * H + 0.5, -1]) {
      expect(nightAdvertisingPolicyViolations(policy(bad, 8 * H))).toEqual([
        { field: 'startSecond', code: 'INVALID_VALUE' },
      ])
    }
    expect(nightAdvertisingPolicyViolations(policy(21 * H, 8 * H))).toEqual([])
    expect(nightAdvertisingPolicyViolations(policy(21 * H + 1, 8 * H))).toEqual([
      { field: 'startSecond', code: 'INVALID_VALUE' },
    ])
    expect(nightAdvertisingPolicyViolations(policy(21 * H, 8 * H - 1))).toEqual([
      { field: 'endSecond', code: 'INVALID_VALUE' },
    ])
    expect(nightAdvertisingPolicyViolations(policy(9 * H, 8 * H))).toEqual([])
  })

  it('늦춘 끝 시각을 따르고 밀리초는 버리며, 시각이 없으면 예외입니다', () => {
    const wide = policy(21 * H, 9 * H)
    expect(nightRestrictionApplies('ADVERTISING', kst('08:59:59'), wide)).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('09:00:00'), wide)).toBe(false)
    expect(nightRestrictionApplies('ADVERTISING', kst('20:59:59.999'))).toBe(false)
    expect(() => clinicSecondOfDay(Number.NaN)).toThrow(RangeError)
  })

  it('야간 광고를 막아도 주간에는 빼지 않습니다', () => {
    const blocked = { startSecond: 21 * H, endSecond: 8 * H, blockAll: true }
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, kst('12:00:00'), blocked)).toBeNull()
  })

  it('규칙 발송 시각을 경계와 넓힌 정책에서 검사합니다', () => {
    const warned = (sendTime: string, p = policy(21 * H, 8 * H)) =>
      contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime }, p) !== null
    expect(['07:59', '08:00', '20:59', '21:00', '00:00'].map((time) => warned(time))).toEqual([
      true,
      false,
      false,
      true,
      true,
    ])
    expect(warned('20:30', policy(20 * H + 30 * 60, 8 * H))).toBe(true)
    for (const bad of ['9:00', '21:0', '']) {
      expect(() => warned(bad)).toThrow(RangeError)
    }
  })

  it('예정 시각이 야간인 광고 연락 작업에 경고합니다', () => {
    expect(contactTaskNightWarning({ purpose: 'ADVERTISING', scheduledAtMillis: kst('21:00:00') })).toEqual({
      code: 'CONTACT_TASK_NIGHT_SEND_TIME',
      field: 'scheduledAt',
    })
    expect(contactTaskNightWarning({ purpose: 'INFORMATIONAL', scheduledAtMillis: kst('21:00:00') })).toBeNull()
  })
})
