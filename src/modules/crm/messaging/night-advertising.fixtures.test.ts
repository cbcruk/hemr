import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contactRuleNightWarning, contactTaskNightWarning, nightRestrictionApplies } from './night-advertising.ts'
import type { MessagePurpose } from './night-advertising.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/crm-send-window.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행은 야간 광고 요청을 화면에서 막았고, 서버는 요청을 받은 뒤 발송 시점에 야간 동의 없는 수신자를 뺍니다
 * (결정 4·5). 그래서 현행 "막음"을 둘로 나눠, 요청이 거절·저장 차단되는지(`rejected`·`saved`)와 그 시각에 야간
 * 제한·경고가 걸리는지로 비교합니다. 서버의 `rejected: false`·`saved: true`는 결정을 적은 상수입니다. 현행 시간 선택기 범위
 * (`window`)는 화면 값이라 비교하지 않습니다. 시각은 `Asia/Seoul` 기준입니다 (결정 2). 현행과 기대값이 다른
 * 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/crm-send-window.json'), 'utf8'),
) as { cases: FixtureCase[] }

const kst = (hhmm: string) => Date.parse(`2026-11-03T${hhmm}:00+09:00`)
const pad = (value: number) => String(value).padStart(2, '0')

/** 현행 `광고`·`ad`는 광고, 그 밖(`알림`·`info`·없음)은 정보성입니다. */
const purposeOf = (legacy: string | null | undefined): MessagePurpose =>
  legacy === '광고' || legacy === 'ad' ? 'ADVERTISING' : 'INFORMATIONAL'

/** 픽스처 검사별로 서버 결과와 현행 기대값을 같은 모양으로 만듭니다. */
const RUN: Record<string, { server: (input: any) => unknown; legacy: (expected: any) => unknown }> = {
  isNightForAd: {
    server: (input) => ({ night: nightRestrictionApplies(purposeOf(input['messageType']), kst(input['atKst'])) }),
    legacy: (expected) => expected,
  },
  manualSendCheck: {
    // 즉시 발송은 지금, 예약 발송은 예약 시각에 판정합니다. 서버는 어느 쪽도 요청을 거절하지 않습니다
    server: (input) => {
      const form = input['form']
      const sendAt = form['reservedAt'] === undefined ? kst(input['nowKst']) : Date.parse(form['reservedAt'])
      return { rejected: false, nightRestricted: nightRestrictionApplies(purposeOf(form['messageType']), sendAt) }
    },
    legacy: (expected) => ({ rejected: expected['isInvalid'], nightRestricted: expected['isInvalid'] }),
  },
  scheduledSendWindow: {
    // 연락 작업 등록·변경입니다. 서버는 저장하고 야간이면 경고합니다
    server: (input) => ({
      saved: true,
      warned:
        contactTaskNightWarning({
          purpose: purposeOf(input['messageType']),
          scheduledAtMillis: kst(`${pad(input['hours'])}:${pad(input['minutes'])}`),
        }) !== null,
    }),
    legacy: (expected) => ({ saved: !expected['outOfWindow'], warned: expected['outOfWindow'] }),
  },
  contactRuleWindow: {
    // 서버는 저장을 막지 않고 경고만 줍니다. 현행 막음은 경고로 읽습니다
    server: (input) => {
      const rule = input['rule']
      const warning = contactRuleNightWarning({
        purpose: purposeOf(rule['메시지유형']),
        sendTime: `${pad(rule['발송시'])}:${pad(rule['발송분'])}`,
      })
      return { saved: true, warned: warning !== null }
    },
    legacy: (expected) => ({ saved: !expected['blocked'], warned: expected['blocked'] }),
  },
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 기본 야간 시간대는 21:00부터입니다
  'isNightForAd: 20:50 KST 광고': { night: false },
  'isNightForAd: 20:59 KST 광고': { night: false },
  // 결정 1·5: 야간이 아니고, 야간이어도 요청을 거절하지 않습니다
  'manualSendCheck: immediate ad at 20:50 blocked': { rejected: false, nightRestricted: false },
  'scheduledSendWindow: 20:35 ad': { saved: true, warned: false },
  'contactRuleWindow: ad rule 20:31 blocked': { saved: true, warned: false },
  // 결정 4·5: 야간 예약·작업·규칙도 저장하고 경고만 줍니다. 발송 시점에 야간 동의 없는 수신자만 뺍니다
  'manualSendCheck: reserved ad for 21:00 blocked': { rejected: false, nightRestricted: true },
  'scheduledSendWindow: 7:55 ad': { saved: true, warned: true },
  'scheduledSendWindow: 21:00 ad': { saved: true, warned: true },
  'contactRuleWindow: ad rule 7:59 blocked': { saved: true, warned: true },
  // 결정 4: 기준과 상관없이 모든 광고 규칙을 검사합니다
  'contactRuleWindow: 잔여 횟수 basis exempt': { saved: true, warned: true },
}

describe('crm-send-window fixture', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const run = RUN[input['check']]!
    expect(run.server(input)).toEqual(name in CHANGED ? CHANGED[name] : run.legacy(expected))
  })

  it('accounts for every fixture case', () => {
    expect(fixture.cases.filter((c) => !(c.input['check'] in RUN)).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
