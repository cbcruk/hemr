import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPT_OUT_080_NUMBER,
  migratedMessageBody,
  migratedPurpose,
  resolvedBody,
  smsByteLength,
  smsKind,
  smsMaxBytes,
} from './message-body.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/message-type-selection.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 `messageText`는 법정 표기를 붙여 저장한 최종 본문이라, 유형 판정에서는 서버 `resolvedBody`로 읽습니다.
 * 표기 붙이기는 현행 저장값을 이관(`migratedMessageBody`)한 본문에 서버가 표기를 붙인 결과로 비교합니다. 유형 이름은
 * 소문자로 맞춥니다. `selectSendingType`은 화면 판정이라 `smsKind`로 비교하고, 수신자별 2,000byte 초과 제외(결정 3)는
 * 단위 테스트에서 봅니다. 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/message-type-selection.json'), 'utf8'),
) as { cases: FixtureCase[] }

const disclosureOf = (input: any) => ({
  clinicName: input['hospitalName'] ?? '',
  optOutNumber: DEFAULT_OPT_OUT_080_NUMBER,
  optOutCode: input['hospitalRefusalCode'] ?? '',
})

const kindView = (body: string, title: string | null, attachmentCount: number) => {
  const kind = smsKind({ title, resolvedBody: body, attachmentCount })
  return { bytes: smsByteLength(body), sendingType: kind.toLowerCase(), maxBytes: smsMaxBytes(kind) }
}

/** 픽스처 검사별로 서버 결과와 현행 기대값을 같은 모양으로 만듭니다. */
const RUN: Record<string, { server: (input: any) => unknown; legacy: (expected: any) => unknown }> = {
  selectSendingType: {
    server: (input) => {
      const message = input['message'] ?? {}
      return kindView(
        message['messageText'] ?? '',
        message['messageTitle'] ?? null,
        message['attachments']?.length ?? 0,
      )
    },
    legacy: (expected) => expected,
  },
  applyAdHeaderFooter: {
    server: (input) => {
      const purpose = migratedPurpose(input['messageType'])
      const result = resolvedBody(purpose, migratedMessageBody(purpose, input['text']).body, disclosureOf(input))
      return result.ok ? { text: result.resolvedBody } : { error: result.code }
    },
    legacy: (expected) => expected,
  },
  stripAdHeaderFooter: {
    server: (input) => ({ text: migratedMessageBody(migratedPurpose(input['messageType']), input['text']).body }),
    legacy: (expected) => expected,
  },
  adWrappedBytesDecideType: {
    server: (input) => {
      const result = resolvedBody('ADVERTISING', input['body'], disclosureOf(input))
      if (!result.ok) throw new Error('unexpected disclosure error')
      const { bytes, sendingType } = kindView(result.resolvedBody, null, 0)
      return { bytes, sendingType }
    },
    legacy: (expected) => expected,
  },
  normalizeMessageType: {
    server: (input) => ({ messageType: migratedPurpose(input['messageType']) === 'ADVERTISING' ? '광고' : '알림' }),
    legacy: (expected) => expected,
  },
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 병원명·인증 코드가 빈 광고 표기는 만들지 않고 422입니다
  'applyAdHeaderFooter: missing name/code leave blanks': { error: 'ADVERTISING_DISCLOSURE_INCOMPLETE' },
}

describe('현행 픽스처 (message-type-selection)', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const run = RUN[input['check']]!
    expect(run.server(input)).toEqual(name in CHANGED ? CHANGED[name] : run.legacy(expected))
  })

  it('모든 픽스처 케이스를 판정에 연결하고 바뀐 기대값은 실제 케이스 이름을 가리킵니다', () => {
    expect(fixture.cases.filter((c) => !(c.input['check'] in RUN)).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
