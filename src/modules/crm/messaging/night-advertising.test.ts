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

describe('clinicSecondOfDay', () => {
  it('reads the clinic clock from an instant in any offset', () => {
    expect(clinicSecondOfDay(Date.parse('2026-11-03T12:00:05Z'))).toBe(21 * 3600 + 5)
    expect(clinicSecondOfDay(kst('00:00:00'))).toBe(0)
  })
})

describe('nightRestrictionApplies', () => {
  it('includes 21:00:00 and excludes 08:00:00', () => {
    expect(nightRestrictionApplies('ADVERTISING', kst('20:59:59'))).toBe(false)
    expect(nightRestrictionApplies('ADVERTISING', kst('21:00:00'))).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('07:59:59'))).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('08:00:00'))).toBe(false)
    expect(nightRestrictionApplies('INFORMATIONAL', kst('23:00:00'))).toBe(false)
  })

  it('follows a wider clinic policy', () => {
    const policy = { startSecond: 20 * 3600 + 30 * 60, endSecond: 8 * 3600, blockAll: false }
    expect(nightRestrictionApplies('ADVERTISING', kst('20:30:00'), policy)).toBe(true)
  })
})

describe('nightTimeExclusion', () => {
  const night = kst('22:00:00')

  it('excludes advertising at night unless the recipient consented', () => {
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, night)).toBe('NIGHT_TIME')
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: true }, night)).toBeNull()
    expect(nightTimeExclusion('INFORMATIONAL', { nightConsent: false }, night)).toBeNull()
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, kst('12:00:00'))).toBeNull()
  })

  it('excludes everyone when the clinic blocks night advertising', () => {
    const policy = { startSecond: 21 * 3600, endSecond: 8 * 3600, blockAll: true }
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: true }, night, policy)).toBe('NIGHT_TIME')
  })
})

describe('nightAdvertisingPolicyViolations', () => {
  it('only allows widening the legal window', () => {
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

describe('contactRuleNightWarning', () => {
  it('warns about a night send time for advertising only', () => {
    expect(contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '21:00' })).toEqual({
      code: 'CONTACT_RULE_NIGHT_SEND_TIME',
      field: 'sendTime',
    })
    expect(contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '20:55' })).toBeNull()
    expect(contactRuleNightWarning({ purpose: 'INFORMATIONAL', sendTime: '23:00' })).toBeNull()
  })

  it('rejects a malformed time', () => {
    expect(() => contactRuleNightWarning({ purpose: 'ADVERTISING', sendTime: '24:00' })).toThrow(RangeError)
  })
})

describe('edge cases', () => {
  const H = 3600
  const policy = (startSecond: number, endSecond: number) => ({ startSecond, endSecond, blockAll: false })

  it('validates each policy value on its own', () => {
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

  it('honours a later end and drops milliseconds', () => {
    const wide = policy(21 * H, 9 * H)
    expect(nightRestrictionApplies('ADVERTISING', kst('08:59:59'), wide)).toBe(true)
    expect(nightRestrictionApplies('ADVERTISING', kst('09:00:00'), wide)).toBe(false)
    expect(nightRestrictionApplies('ADVERTISING', kst('20:59:59.999'))).toBe(false)
    expect(() => clinicSecondOfDay(Number.NaN)).toThrow(RangeError)
  })

  it('does not exclude in daytime even when night ads are blocked', () => {
    const blocked = { startSecond: 21 * H, endSecond: 8 * H, blockAll: true }
    expect(nightTimeExclusion('ADVERTISING', { nightConsent: false }, kst('12:00:00'), blocked)).toBeNull()
  })

  it('checks rule send times at the boundaries and under a wider policy', () => {
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

  it('warns about a night contact task', () => {
    expect(contactTaskNightWarning({ purpose: 'ADVERTISING', scheduledAtMillis: kst('21:00:00') })).toEqual({
      code: 'CONTACT_TASK_NIGHT_SEND_TIME',
      field: 'scheduledAt',
    })
    expect(contactTaskNightWarning({ purpose: 'INFORMATIONAL', scheduledAtMillis: kst('21:00:00') })).toBeNull()
  })
})
