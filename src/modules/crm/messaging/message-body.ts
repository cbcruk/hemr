import type { MessagePurpose } from './night-advertising.ts'

/**
 * 문자 최종 본문과 유형(SMS/LMS/MMS) 판정입니다 (message-type-selection). 캠페인은 본문(`content.body`)과 법정
 * 표기를 나눠 저장하고, 서버가 수신자마다 변수를 치환한 뒤 법정 표기를 붙여 `resolvedBody`를 만들고 그 바이트로
 * `smsKind`를 정합니다. 클라이언트는 `estimate` 결과만 보여 줍니다.
 */

/**
 * 문자 바이트 수입니다 (결정 2, 보류). 확인 전까지 현행 규칙을 그대로 재현합니다. UTF-16 코드 단위를 앞에서부터
 * 읽어 ASCII는 1, 서로게이트가 아닌 그 밖의 문자는 2, 서로게이트는 4byte로 세고 다음 코드 단위를 건너뜁니다.
 */
export function smsByteLength(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0xd800 || code >= 0xe000) bytes += 2
    else {
      index++
      bytes += 4
    }
  }
  return bytes
}

export type SmsKind = 'SMS' | 'LMS' | 'MMS'

export const SMS_MAX_BYTES = 90
export const LONG_MESSAGE_MAX_BYTES = 2000

/** 유형별 본문 한도입니다. SMS 90byte, LMS·MMS 2,000byte입니다. */
export const smsMaxBytes = (kind: SmsKind) => (kind === 'SMS' ? SMS_MAX_BYTES : LONG_MESSAGE_MAX_BYTES)

/**
 * 문자 유형입니다 (결정 4). 첨부가 있으면 MMS, 제목이 있으면(빈 문자열 제외) LMS, 최종 본문이 90byte 이하면 SMS,
 * 그 밖은 LMS입니다. 바이트는 법정 표기를 붙인 `resolvedBody`로 셉니다.
 */
export function smsKind(message: { title?: string | null; resolvedBody: string; attachmentCount: number }): SmsKind {
  if (message.attachmentCount > 0) return 'MMS'
  if (message.title) return 'LMS'
  return smsByteLength(message.resolvedBody) <= SMS_MAX_BYTES ? 'SMS' : 'LMS'
}

/** 080 수신거부 번호의 플랫폼 기본값입니다 (결정 1). 병원 설정이 있으면 호출하는 쪽이 그 값을 넘깁니다. */
export const DEFAULT_OPT_OUT_080_NUMBER = '080-877-8900'

/** 광고 법정 표기에 들어가는 병원 값입니다. 인증 코드는 `GET /opt-outs/080-code`의 값입니다. */
export interface AdvertisingDisclosure {
  clinicName: string
  optOutNumber: string
  optOutCode: string
}

/**
 * 법정 표기를 붙인 최종 본문입니다 (결정 1). 광고면 `(광고) {병원명}` 머리말과 `무료거부: {080 번호}` /
 * `인증: {인증 코드}` 꼬리말을 현행 형식 그대로 붙이고, 정보성이면 본문 그대로입니다. 광고인데 병원명·080 번호·
 * 인증 코드 중 하나라도 비었으면 표기를 만들지 않고 422 `ADVERTISING_DISCLOSURE_INCOMPLETE`입니다. 위반의 `field`는
 * 요청 경로가 아니라 병원 설정 키입니다. 값은 앞뒤 공백과 줄바꿈을 빼고 넣어, 표기가 한 줄씩 유지됩니다.
 */
export function resolvedBody(
  purpose: MessagePurpose,
  body: string,
  disclosure: AdvertisingDisclosure,
):
  | { ok: true; resolvedBody: string }
  | {
      ok: false
      code: 'ADVERTISING_DISCLOSURE_INCOMPLETE'
      violations: { field: keyof AdvertisingDisclosure; code: 'REQUIRED' }[]
    } {
  if (purpose !== 'ADVERTISING') return { ok: true, resolvedBody: body }
  const line = (value: string) => value.replace(/\s+/g, ' ').trim()
  const 법정표기항목 = ['clinicName', 'optOutNumber', 'optOutCode'] as const
  const violations = 법정표기항목.flatMap((field) =>
    line(disclosure[field]) === '' ? [{ field, code: 'REQUIRED' as const }] : [],
  )
  if (violations.length > 0) return { ok: false, code: 'ADVERTISING_DISCLOSURE_INCOMPLETE', violations }
  const [병원명, 수신거부번호, 인증코드] = 법정표기항목.map((field) => line(disclosure[field]))
  return { ok: true, resolvedBody: `(광고) ${병원명}\n${body}\n\n무료거부: ${수신거부번호}\n인증: ${인증코드}` }
}

/** 문자 유형 초과 처리입니다. 캠페인 `overflow`(SMS 채널)와 `fallback.overflow`(카카오 → SMS 대체) 값입니다. */
export type SmsOverflowPolicy = 'UPGRADE_TO_LMS' | 'EXCLUDE'

const 문자유형순위: Record<SmsKind, number> = { SMS: 0, LMS: 1, MMS: 2 }

/**
 * 수신자별 유형 판정입니다 (결정 3). `campaignKind`는 변수를 치환하지 않은 템플릿 본문에 법정 표기를 붙여 `smsKind`로
 * 판정한 캠페인 유형입니다. 수신자 유형은 캠페인 유형보다 낮아지지 않습니다. 견적 단가와 실제 유형이 어긋나지
 * 않게 하기 위해서입니다. 캠페인이 SMS였는데 변수를 치환한 뒤 90byte를 넘으면 `UPGRADE_TO_LMS`(기본)는 LMS로
 * 올리고 `EXCLUDE`는 그 수신자를 `SMS_OVERFLOW`로 뺍니다. 유형 한도(LMS·MMS 2,000byte)를 넘는 본문은 정책과
 * 상관없이 `BODY_TOO_LONG`으로 뺍니다. 제외 사유는 견적의 `excluded`에 셉니다.
 */
export function recipientSmsKind(
  campaignKind: SmsKind,
  message: { title?: string | null; resolvedBody: string; attachmentCount: number },
  overflow: SmsOverflowPolicy = 'UPGRADE_TO_LMS',
): { smsKind: SmsKind; excluded: null } | { smsKind: null; excluded: 'SMS_OVERFLOW' | 'BODY_TOO_LONG' } {
  const 치환후유형 = smsKind(message)
  const 수신자유형 = 문자유형순위[치환후유형] < 문자유형순위[campaignKind] ? campaignKind : 치환후유형
  if (smsByteLength(message.resolvedBody) > smsMaxBytes(수신자유형)) {
    return { smsKind: null, excluded: 'BODY_TOO_LONG' }
  }
  if (campaignKind === 'SMS' && 수신자유형 === 'LMS' && overflow === 'EXCLUDE') {
    return { smsKind: null, excluded: 'SMS_OVERFLOW' }
  }
  return { smsKind: 수신자유형, excluded: null }
}

const 현행머리말 = /^\(광고\)[^\n]*\n/
const 현행꼬리말 = /\r?\n\r?\n무료거부: [^\r\n]*\r?\n인증: [^\r\n]*\s*$/
const 무료거부표시 = /\r?\n\r?\n무료거부:/

/**
 * 현행 저장 본문(`messageText`)에서 법정 표기를 떼어 냅니다 (결정 5, 이관 전용). 첫 줄이 `(광고)`로 시작하면 그 줄을,
 * 본문 끝이 생성 형식(`\n\n무료거부: …\n인증: …`, CRLF·끝 공백 허용)이면 마지막 꼬리말 하나를 뗍니다. 현행과 달리
 * 본문 중간의 `무료거부:`에서는 자르지 않습니다. 광고가 아니면 그대로 둡니다. 떼고도 `무료거부:` 표시가 남으면
 * 이관 보고서가 확인할 수 있게 `review: true`입니다. 그대로 보내면 꼬리말이 두 번 붙을 수 있기 때문입니다.
 */
export function migratedMessageBody(
  purpose: MessagePurpose,
  legacyText: string | null,
): { body: string; review: boolean } {
  const 현행본문 = legacyText ?? ''
  if (purpose !== 'ADVERTISING') return { body: 현행본문, review: false }
  const 본문 = 현행본문.replace(현행머리말, '').replace(현행꼬리말, '')
  return { body: 본문, review: 무료거부표시.test(본문) }
}

/**
 * 현행 메시지 유형을 목적으로 옮깁니다 (이관 전용). 현행은 `광고`·`알림` 밖의 값(`기타`·빈 값)을 `광고`로 바꿨고,
 * 광고 규칙을 더 엄격하게 적용하는 쪽이라 그대로 따릅니다. 새 API는 `purpose`를 필수 열거형으로 받아, 다른 값은
 * 400입니다.
 */
export const migratedPurpose = (legacyType: string | null): MessagePurpose =>
  legacyType === '알림' ? 'INFORMATIONAL' : 'ADVERTISING'
