# 문자 유형(SMS/LMS/MMS) 판정과 광고 표기

## 요약

문자 작성 화면은 본문 저장값으로 단문(SMS)·장문(LMS)·그림(MMS)을 판정하고, 그 결과로 바이트 한도(90 / 2000)와 단가 표시를 정합니다. 광고 메시지는 본문 앞에 `(광고) {병원명}`, 뒤에 `무료거부: 080-877-8900` / `인증: {병원 인증코드}`를 **클라이언트가 붙여 저장**합니다. 그래서 바이트 계산에는 머리말·꼬리말이 포함됩니다.

| 조건(위부터 우선) | 유형 | 최대 바이트 |
|---|---|---|
| 데이터 없음 | `sms` | 90 |
| 첨부 1개 이상 | `mms` | 2000 |
| 제목이 있음(빈 문자열 제외) | `lms` | 2000 |
| 본문 ≤ 90 byte | `sms` | 90 |
| 그 밖 | `lms` | 2000 |

## 현행 위치

- 바이트 계산 `a`: `re-upstream/restored/modules/byteString.js`
- 유형 판정 `ht`, 최대 바이트 `bt`, 광고 머리말·꼬리말 `yt`/`F`, 유형 정규화 `ie`/`gt`, 라벨 `S`: `re-upstream/restored/modules/CrmMessagePreview/part-1.js`
- 본문 갱신 시 `yt` 적용: `re-upstream/restored/components/crm/CrmCommonMessageForm.helpers.js` (`hs`)
- 사용처: `components/message/MessageViewSend.vue`(유형 배지·예상 비용), `components/crm/CrmCommonMessageForm.vue`(바이트 한도)
- 발송 시 변수 치환 후 90byte 초과 수신자 처리(`smsOverflowPolicy`: 기본 `upgrade_lms`, 끄면 `exclude`)는 서버 estimate가 합니다.

## 로직

### 바이트 계산

UTF-16 코드 단위를 앞에서부터 읽습니다.

- 코드 < 128(ASCII, 줄바꿈 포함): 1byte
- 그 밖의 BMP 문자(한글 포함): 2byte
- 서로게이트 쌍(이모지 등): 4byte(다음 코드 단위를 건너뜀)

한글 45자 = 90byte(SMS), 46자 = 92byte(LMS)입니다.

### 광고 머리말·꼬리말

- `yt({ messageType, text, hospitalName, hospitalRefusalCode })`
  - 광고가 아니면 `text || ""`를 그대로 돌려줍니다.
  - 광고면 먼저 `F`로 기존 머리말·꼬리말을 떼고, `"(광고) " + 병원명 + "\n" + 본문 + "\n\n무료거부: 080-877-8900\n인증: " + 인증코드`를 만듭니다. 병원명·인증코드가 없으면 빈 문자열입니다. 같은 입력에 여러 번 적용해도 결과가 같습니다.
- `F(유형, text)`: 광고가 아니면 그대로. 광고면 정규식 `^(?:\(광고\)[^\n]*\n)?([\s\S]*?)(?=\n\n무료거부:|$)`로 첫 줄 머리말(있으면)과 `\n\n무료거부:` 이후를 떼어 본문만 돌려줍니다. 일치가 없거나 `text`가 없으면 빈 문자열입니다.
- 유형을 광고에서 다른 유형으로 바꾸면 `F`로 떼고, 그 밖의 유형 변경·본문 입력에는 `yt`를 다시 적용합니다.

### 유형 정규화

- `messageType`은 `광고` 또는 `알림`만 허용하고, 그 밖(`기타`, `null`, 빈 값)은 `광고`로 바꿉니다(`gt`).
- 카카오 탭은 `alimtalk` → `AT`, `brand` → `bizType`(기본 `FT`)으로 표시합니다.

## 원본 코드

`re-upstream/restored/modules/byteString.js:3-17`

```js
// Restored from unminified/byteString-W_gkmtJP.js:11-57
const a = e => {
  let t = 0;
  for (let n = 0; n < e.length; n++) {
    const r = e.charCodeAt(n);
    if (r < 128) {
      t += 1;
    } else if (r < 2048 || r < 55296 || r >= 57344) {
      t += 2;
    } else {
      n++;
      t += 4;
    }
  }
  return t;
};
```

`re-upstream/restored/modules/CrmMessagePreview/part-1.js:8-56, 71-93`

```js
// Restored from unminified/CrmMessagePreview.vue_vue_type_script_setup_true_lang-Mahdgzip.js:19-450
function Me(e) {
  return ["광고", "알림"].includes(e || "");
}
function ie(e, { defaultMessageType = "광고", allowedMessageTypes = ["광고", "알림"] } = {}) {
  if (Me(e) && allowedMessageTypes.includes(e)) {
    return e;
  } else {
    return defaultMessageType;
  }
}
function F(e, t) {
  if (e !== "광고") {
    return t;
  }
  const a = t?.match(/^(?:\(광고\)[^\n]*\n)?([\s\S]*?)(?=\n\n무료거부:|$)/);
  if (a) {
    return a[1];
  } else {
    return "";
  }
}
function yt(e) {
  if (e.messageType !== "광고") {
    return e.text || "";
  }
  const t = F(e.messageType, e.text);
  const a = e.hospitalName || "";
  const s = "080-877-8900";
  const l = e.hospitalRefusalCode || "";
  const n = `

무료거부: ${s}
인증: ${l}`;
  return `(광고) ${a}
${t}${n}`;
}
function ht(e) {
  if (e) {
    if ((e?.attachments?.length || 0) > 0) {
      return "mms";
    } else if (e?.messageTitle) {
      return "lms";
    } else if (a(e?.messageText || "") <= 90) {
      return "sms";
    } else {
      return "lms";
    }
  } else {
    return "sms";
  }
}
function bt(e) {
  if (e === "sms") {
    return 90;
  } else {
    return 2000;
  }
}
```

`re-upstream/restored/components/crm/CrmCommonMessageForm.helpers.js:39-61`

```js
// Restored from unminified/templatePermission-BWKgEo8f.js:76-141
updateMessageType: g => {
  const messageType$ = ie(String(g), { defaultMessageType: toValue(defaultMessageType) });
  const messageText$ = messageData.value?.messageType === "광고" && messageType$ !== "광고" ? F("광고", messageData.value?.messageText) : yt({
    messageType: messageType$,
    text: messageData.value?.messageText,
    hospitalName: hospitalInfo.value?.상호,
    hospitalRefusalCode: hospitalRefusalCode.value ?? undefined
  });
  return c(messageType$, { messageText: messageText$ });
},
updateMessageContent: g => {
  const $ = yt({
    messageType: messageData.value?.messageType,
    text: g,
    hospitalName: hospitalInfo.value?.상호,
    hospitalRefusalCode: hospitalRefusalCode.value ?? undefined
  });
  x($);
},
```

## 픽스처

`test/fixtures/rules/message-type-selection.json` — 24건(모두 실행).

- `selectSendingType`(10): null, 한글 45/46자, ASCII 90/91자, 제목, 첨부(본문 3000byte라도 MMS), 빈 제목, 이모지 4byte, 줄바꿈 1byte.
- `applyAdHeaderFooter`(4): 감싸기, 재적용 시 동일, 병원명·코드 없음, 알림은 그대로.
- `stripAdHeaderFooter`(4): 감싼 본문, 여러 줄 본문, 머리말 없는 본문, null.
- `adWrappedBytesDecideType`(1): 머리말·꼬리말이 바이트에 포함됨(본문 "할인" → 61byte).
- `normalizeMessageType`(5).

## 서버 이전 시 주의

- 유형 판정과 광고 표기는 서버로 옮깁니다(설계: `resolvedBody`, `smsKind`). 판정 순서는 첨부 → 제목 → 90byte입니다. 바이트는 머리말·꼬리말을 붙인 **최종 본문**으로 셉니다.
- 현행 저장값(`messageText`)에는 이미 `(광고)` 머리말·꼬리말이 들어 있습니다. 이관할 때 `F`와 같은 방식으로 본문만 떼어 내야 이중 표기를 피할 수 있습니다.
- 080 수신거부 번호 `080-877-8900`은 클라이언트 상수입니다. 서버 설정으로 옮겨야 합니다.
- 바이트 규칙(ASCII 1, 그 밖 2, 서로게이트 4)은 통신사 EUC-KR 계산과 다를 수 있습니다. 서버 판정을 통신사 기준에 맞출지, 현행을 재현할지 정해야 합니다.
- 수신자별 변수 치환 뒤 90byte를 넘는 경우의 처리(`upgrade_lms` / `exclude`)는 현행도 서버가 합니다. 클라이언트 `ht`는 화면 표시용입니다.
