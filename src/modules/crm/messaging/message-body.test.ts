import { describe, expect, it } from 'vitest'
import { migratedMessageBody, recipientSmsKind, resolvedBody, smsByteLength, smsKind } from './message-body.ts'

const disclosure = { clinicName: 'A한의원', optOutNumber: '080-000-0000', optOutCode: '1234' }

describe('문자 바이트 수 (smsByteLength)', () => {
  it('ASCII는 1, 그 밖의 BMP 문자는 2, 서로게이트 쌍은 4byte로 셉니다', () => {
    expect(smsByteLength('a가😀')).toBe(7)
    expect(smsByteLength('')).toBe(0)
  })

  it('짝 없는 서로게이트를 현행처럼 셉니다', () => {
    expect(smsByteLength('a\ud800')).toBe(5)
    expect(smsByteLength('\udc00a')).toBe(4)
  })
})

describe('문자 유형 (smsKind)', () => {
  it('첨부, 제목, 90byte 경계 순서로 유형을 정합니다', () => {
    expect(smsKind({ title: 't', resolvedBody: 'x', attachmentCount: 1 })).toBe('MMS')
    expect(smsKind({ title: 't', resolvedBody: 'x', attachmentCount: 0 })).toBe('LMS')
    expect(smsKind({ title: '', resolvedBody: 'a'.repeat(90), attachmentCount: 0 })).toBe('SMS')
    expect(smsKind({ resolvedBody: 'a'.repeat(91), attachmentCount: 0 })).toBe('LMS')
    expect(smsKind({ title: null, resolvedBody: 'x', attachmentCount: 0 })).toBe('SMS')
    expect(smsKind({ title: ' ', resolvedBody: 'x', attachmentCount: 0 })).toBe('LMS')
  })
})

describe('최종 본문 (resolvedBody)', () => {
  it('광고에는 병원의 080 번호로 법정 표기를 붙이고 알림은 그대로 둡니다', () => {
    expect(resolvedBody('ADVERTISING', '안내', disclosure)).toEqual({
      ok: true,
      resolvedBody: '(광고) A한의원\n안내\n\n무료거부: 080-000-0000\n인증: 1234',
    })
    expect(resolvedBody('INFORMATIONAL', '안내', { ...disclosure, optOutCode: '' })).toEqual({
      ok: true,
      resolvedBody: '안내',
    })
  })

  it('비어 있는 법정 표기 항목을 모두 위반으로 적습니다', () => {
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

  it('법정 표기 값의 줄바꿈을 공백으로 바꿔 한 줄로 둡니다', () => {
    const result = resolvedBody('ADVERTISING', '안내', { ...disclosure, clinicName: ' A\n한의원 ' })
    expect(result.ok && result.resolvedBody.split('\n')[0]).toBe('(광고) A 한의원')
  })
})

describe('수신자별 유형 (recipientSmsKind)', () => {
  const long = { resolvedBody: '가'.repeat(46), attachmentCount: 0 }

  it('치환 뒤 90byte를 넘은 SMS는 정책에 따라 LMS로 올리거나 뺍니다', () => {
    expect(recipientSmsKind('SMS', long)).toEqual({ smsKind: 'LMS', excluded: null })
    expect(recipientSmsKind('SMS', long, 'EXCLUDE')).toEqual({ smsKind: null, excluded: 'SMS_OVERFLOW' })
    expect(recipientSmsKind('LMS', long, 'EXCLUDE')).toEqual({ smsKind: 'LMS', excluded: null })
    expect(recipientSmsKind('SMS', { resolvedBody: 'a'.repeat(90), attachmentCount: 0 }, 'EXCLUDE')).toEqual({
      smsKind: 'SMS',
      excluded: null,
    })
  })

  it('캠페인 유형보다 낮아지지 않습니다', () => {
    expect(recipientSmsKind('LMS', { resolvedBody: 'short', attachmentCount: 0 })).toEqual({
      smsKind: 'LMS',
      excluded: null,
    })
  })

  it('2,000byte를 넘는 본문은 정책과 상관없이 뺍니다', () => {
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

describe('현행 본문 이관 (migratedMessageBody)', () => {
  const footer = '\n\n무료거부: 080-877-8900\n인증: 1'

  it('본문 끝의 생성 형식 꼬리말만 떼어 냅니다', () => {
    const body = '안내\n\n무료거부: 문의는 전화로\n감사합니다'
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n${body}${footer}`)).toEqual({ body, review: true })
    expect(migratedMessageBody('ADVERTISING', '본문')).toEqual({ body: '본문', review: false })
  })

  it('빈 인증 코드, CRLF, 끝 공백이 있어도 꼬리말을 뗍니다', () => {
    expect(migratedMessageBody('ADVERTISING', '(광고) A\n본문\n\n무료거부: 080\n인증: ').body).toBe('본문')
    expect(migratedMessageBody('ADVERTISING', '(광고) A\r\n본문\r\n\r\n무료거부: 080\r\n인증: 1\r\n ').body).toBe(
      '본문',
    )
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n본문\n${footer}`).body).toBe('본문\n')
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n${footer}`).body).toBe('')
  })

  it('꼬리말이 둘이면 마지막 하나만 떼고 확인 대상으로 표시합니다', () => {
    expect(migratedMessageBody('ADVERTISING', `(광고) A\n본문${footer}${footer}`)).toEqual({
      body: `본문${footer}`,
      review: true,
    })
  })

  it('알림 본문은 그대로 두고 없는 본문은 빈 문자열로 둡니다', () => {
    expect(migratedMessageBody('INFORMATIONAL', '(광고) A\n본문').body).toBe('(광고) A\n본문')
    expect(migratedMessageBody('INFORMATIONAL', null).body).toBe('')
    expect(migratedMessageBody('ADVERTISING', null)).toEqual({ body: '', review: false })
  })
})
