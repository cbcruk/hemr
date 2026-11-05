import { describe, expect, it } from 'vitest'
import { migratedMessageBody, recipientSmsKind, resolvedBody, smsByteLength, smsKind } from './message-body.ts'

const disclosure = { clinicName: 'A한의원', optOutNumber: '080-000-0000', optOutCode: '1234' }

describe('smsByteLength', () => {
  it('counts ASCII 1, other BMP 2 and surrogate pairs 4', () => {
    expect(smsByteLength('a가😀')).toBe(7)
    expect(smsByteLength('')).toBe(0)
  })

  it('reproduces the current handling of lone surrogates', () => {
    expect(smsByteLength('a\ud800')).toBe(5)
    expect(smsByteLength('\udc00a')).toBe(4)
  })
})

describe('smsKind', () => {
  it('ranks attachment, title, then the 90-byte boundary', () => {
    expect(smsKind({ title: 't', resolvedBody: 'x', attachmentCount: 1 })).toBe('MMS')
    expect(smsKind({ title: 't', resolvedBody: 'x', attachmentCount: 0 })).toBe('LMS')
    expect(smsKind({ title: '', resolvedBody: 'a'.repeat(90), attachmentCount: 0 })).toBe('SMS')
    expect(smsKind({ resolvedBody: 'a'.repeat(91), attachmentCount: 0 })).toBe('LMS')
    expect(smsKind({ title: null, resolvedBody: 'x', attachmentCount: 0 })).toBe('SMS')
    expect(smsKind({ title: ' ', resolvedBody: 'x', attachmentCount: 0 })).toBe('LMS')
  })
})

describe('resolvedBody', () => {
  it('wraps advertising with the configured 080 number', () => {
    expect(resolvedBody('ADVERTISING', '안내', disclosure)).toEqual({
      ok: true,
      resolvedBody: '(광고) A한의원\n안내\n\n무료거부: 080-000-0000\n인증: 1234',
    })
    expect(resolvedBody('INFORMATIONAL', '안내', { ...disclosure, optOutCode: '' })).toEqual({
      ok: true,
      resolvedBody: '안내',
    })
  })

  it('names every blank disclosure field', () => {
    expect(resolvedBody('ADVERTISING', '안내', { clinicName: ' ', optOutNumber: '\n', optOutCode: '' })).toEqual({
      ok: false,
      code: 'ADVERTISING_DISCLOSURE_INCOMPLETE',
      violations: [
        { field: 'clinicName', code: 'REQUIRED' },
        { field: 'optOutNumber', code: 'REQUIRED' },
        { field: 'optOutCode', code: 'REQUIRED' },
      ],
    })
  })

  it('keeps each disclosure on one line', () => {
    const result = resolvedBody('ADVERTISING', '안내', { ...disclosure, clinicName: ' A\n한의원 ' })
    expect(result.ok && result.resolvedBody.split('\n')[0]).toBe('(광고) A 한의원')
  })
})

describe('recipientSmsKind', () => {
  const long = { resolvedBody: '가'.repeat(46), attachmentCount: 0 }

  it('upgrades or excludes an SMS that grew past 90 bytes', () => {
    expect(recipientSmsKind('SMS', long)).toEqual({ smsKind: 'LMS', excluded: null })
    expect(recipientSmsKind('SMS', long, 'EXCLUDE')).toEqual({ smsKind: null, excluded: 'SMS_OVERFLOW' })
    expect(recipientSmsKind('LMS', long, 'EXCLUDE')).toEqual({ smsKind: 'LMS', excluded: null })
    expect(recipientSmsKind('SMS', { resolvedBody: 'a'.repeat(90), attachmentCount: 0 }, 'EXCLUDE')).toEqual({
      smsKind: 'SMS',
      excluded: null,
    })
  })

  it('never drops below the campaign kind', () => {
    expect(recipientSmsKind('LMS', { resolvedBody: 'short', attachmentCount: 0 })).toEqual({
      smsKind: 'LMS',
      excluded: null,
    })
  })

  it('excludes a body over 2,000 bytes', () => {
    expect(recipientSmsKind('LMS', { resolvedBody: 'a'.repeat(2001), attachmentCount: 0 })).toEqual({
      smsKind: null,
      excluded: 'BODY_TOO_LONG',
    })
    expect(recipientSmsKind('MMS', { resolvedBody: 'a'.repeat(2000), attachmentCount: 1 })).toEqual({
      smsKind: 'MMS',
      excluded: null,
    })
    expect(recipientSmsKind('MMS', { resolvedBody: 'a'.repeat(2001), attachmentCount: 1 }).excluded).toBe(
      'BODY_TOO_LONG',
    )
    // 정책보다 길이 한도가 먼저입니다
    expect(recipientSmsKind('SMS', { resolvedBody: 'a'.repeat(2001), attachmentCount: 0 }, 'EXCLUDE').excluded).toBe(
      'BODY_TOO_LONG',
    )
  })
})

describe('migratedMessageBody', () => {
  const footer = '\n\n무료거부: 080-877-8900\n인증: 1'

  it('only strips a footer in the generated form at the end', () => {
    const body = '안내\n\n무료거부: 문의는 전화로\n감사합니다'
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n${body}${footer}`)).toEqual({ body, review: true })
    expect(migratedMessageBody('ADVERTISING', '본문')).toEqual({ body: '본문', review: false })
  })

  it('tolerates an empty code, CRLF and trailing whitespace', () => {
    expect(migratedMessageBody('ADVERTISING', '(광고) A\n본문\n\n무료거부: 080\n인증: ').body).toBe('본문')
    expect(migratedMessageBody('ADVERTISING', '(광고) A\r\n본문\r\n\r\n무료거부: 080\r\n인증: 1\r\n ').body).toBe(
      '본문',
    )
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n본문\n${footer}`).body).toBe('본문\n')
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n${footer}`).body).toBe('')
  })

  it('strips only the last of two footers and flags the row', () => {
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n본문${footer}${footer}`)).toEqual({
      body: `본문${footer}`,
      review: true,
    })
  })

  it('keeps informational text and empties null', () => {
    expect(migratedMessageBody('INFORMATIONAL', '(광고) A\n본문').body).toBe('(광고) A\n본문')
    expect(migratedMessageBody('INFORMATIONAL', null).body).toBe('')
    expect(migratedMessageBody('ADVERTISING', null)).toEqual({ body: '', review: false })
  })
})
