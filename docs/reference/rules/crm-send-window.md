# 광고성 메시지 야간 발송 제한

## 요약

광고성 메시지(문자 `광고`, 카카오 브랜드 메시지)의 발송 가능 시간을 클라이언트가 막습니다. 두 기준이 함께 있습니다.

| 경로 | 막는 시간 | 판정 함수 |
|---|---|---|
| 수동 발송(메시지 화면, 환자 문자 보내기 패널) — 즉시 발송과 예약 발송 | **20:50 – 07:59** | `Da` / `jn` |
| 연락 일정 추가·변경, 연락 시나리오(자동 발송 규칙) | **20:31 – 07:59** (허용 08:00–20:30) | `Mo` / `Gi` 및 각 컴포넌트의 계산값 |

알림(`알림`, `info`)은 시간 제한이 없습니다. 모든 판정은 브라우저 로컬 시각(`getHours`/`getMinutes`)으로 합니다.

## 현행 위치

- 수동 발송: `restored/modules/queries/useMessagesPatientsTemplateVariablesByPatientIdQuery.js` (`Da`, `jn`). 사용처 `views/MessageView.vue`(`isNightTimeError`), `components/crm/CrmPatientMessageSendSidePanelContent.vue`. 배너 문구 "야간 시간 (20:50 ~ 08:00) 시간에는 광고성 문자 전송이 제한됩니다."
- 자동·예약 연락: `restored/modules/CrmContactsView/part-1.js` (`sv`, `Bu`, `av`, `Mo`, `Gi`). 사용처 `components/crm/CrmScheduleAddContactPopover.vue`, `CrmScheduleRescheduleDatePopover.vue`, `CrmContactRulesRuleChannelConfig.vue`, `CrmContactRulesEditModal.vue`. 문구 "광고성 메시지는 08:00 ~ 20:30에만 발송할 수 있습니다."
- 시간 선택 UI는 분을 5분 단위(0–55)로 고릅니다.

## 로직

### 수동 발송 (`Da`, `jn`)

- `Da(시각, messageType)`: `messageType === "광고"`이고 `(시 === 20 && 분 >= 50) || 시 >= 21 || 시 < 8`이면 야간입니다.
- `jn(form)`:
  1. 예약 시각이 없고 지금이 야간이면 `{ isInvalid: true, reason: "야간 시간대에는 즉시 발송이 불가능합니다." }`
  2. 예약 시각이 있고 그 시각이 야간이면 `{ isInvalid: true, reason: "야간 시간대로 예약 발송할 수 없습니다." }`
  3. 그 밖은 `{ isInvalid: false, reason: null }`. 예약이 있으면 현재 시각은 보지 않습니다.
- `messageType`이 없으면 `null`로 보고 광고가 아니므로 통과합니다.
- 결과는 경고 배너, 테스트 발송 버튼 비활성화, 발송 순서의 "야간 광고 제한" 단계에 씁니다.

### 예약 연락과 연락 시나리오 (`Mo`, `Gi`)

- `Mo("ad") = { minHours: 8, maxHours: 20, maxMinutes: 30 }`, 그 밖은 `{ 0, 23, 55 }`.
- 범위 밖 판정: `시 < minHours || 시 > maxHours`이면 범위 밖, `시 === maxHours && 분 > maxMinutes`이면 범위 밖. 광고만 검사합니다.
- 연락 시나리오 규칙(`Gi`)은 위와 같고, `기준 === "잔여 횟수"`인 규칙은 검사하지 않습니다.
- 범위 밖이면 저장·제출을 막고 오류 토스트를 냅니다. 시간 선택기의 선택 가능 시각도 이 범위로 제한합니다(`sd`, `lv`: 오늘이면 지난 시각도 막음).

## 원본 코드

`restored/modules/queries/useMessagesPatientsTemplateVariablesByPatientIdQuery.js:19-42` (`Tf` = date-fns `getHours`, `vh` = `getMinutes`)

```js
// Restored from unminified/queries.js:1915-1949
function Da(e, a) {
  const t = Tf(e);
  const o = vh(e);
  return (t === 20 && o >= 50 || t >= 21 || t < 8) && a === "광고";
}

function jn(e) {
  if (Da(new Date(), e?.messageType || null) && !e?.reservedAt) {
    return { isInvalid: true, reason: "야간 시간대에는 즉시 발송이 불가능합니다." };
  } else if (e?.reservedAt && Da(new Date(e?.reservedAt), e?.messageType || null)) {
    return { isInvalid: true, reason: "야간 시간대로 예약 발송할 수 없습니다." };
  } else {
    return { isInvalid: false, reason: null };
  }
}
```

`restored/modules/CrmContactsView/part-1.js:111-124, 518-526`

```js
// Restored from unminified/CrmContactsView.js:62-649
const sv = 8;
const Bu = 20;
const av = 30;
function Mo(t) {
  const s = t === "ad";
  return {
    minHours: s ? sv : 0,
    maxHours: s ? Bu : 23,
    maxMinutes: s ? av : 55
  };
}
function Gi(t) {
  if (t.기준 === "잔여 횟수" || t.메시지유형 !== "ad") {
    return false;
  } else if (t.발송시 < sv || t.발송시 > Bu) {
    return true;
  } else {
    return t.발송시 === Bu && t.발송분 > av;
  }
}
```

`restored/components/crm/CrmScheduleAddContactPopover.vue.js:186-200` (`T = Mo(o.value)`, 같은 식이 예약 변경 팝오버와 규칙 채널 설정에도 있음)

```js
// Restored from unminified/CrmContactsView.js:6237-6783
const N = computed(() => {
  if (o.value !== "ad") {
    return false;
  }
  const { minHours, maxHours, maxMinutes } = T.value;
  if (hours.value < minHours || hours.value > maxHours) {
    return true;
  } else {
    return hours.value === maxHours && minutes.value > maxMinutes;
  }
});
```

## 픽스처

`test/fixtures/rules/crm-send-window.json` — 29건(모두 실행, `TZ=Asia/Seoul`).

- `isNightForAd`(11): 07:59/08:00, 20:49/20:50, 20:59/21:00, 23:59/00:00, 알림·null.
- `manualSendCheck`(6): 즉시 발송 20:50 차단, 20:49 허용, 21:00 예약 차단, 야간에 주간 시각으로 예약 허용, 알림, 유형 없음.
- `scheduledSendWindow`(7): 7:55/8:00, 20:30/20:35, 21:00, 알림 23:55/0:00.
- `contactRuleWindow`(5): 20:30 허용, 20:31·7:59 차단, `잔여 횟수` 예외, 알림 예외.

## 서버 이전 시 주의

- 현행은 수동 20:50, 자동 20:30으로 기준이 다릅니다. 재설계는 서버 정책 하나로 합치고(법정 야간 21:00–08:00 + 병원별 확장), 기존 동작을 재현해야 한다면 경로별 기본값을 둡니다.
- 시각은 반드시 Asia/Seoul로 계산합니다. 현행은 브라우저 시간대에 따라 결과가 달라집니다.
- 경계: 수동 발송은 20:50:00부터 막고 08:00:00부터 허용합니다. 예약 연락은 20:30까지 허용하고 20:31(분 단위, UI는 20:35)부터 막습니다.
- 수동 발송 판정은 채널을 보지 않고 `messageType === "광고"`만 봅니다. 카카오 브랜드 메시지도 같은 제한을 받습니다.
- 현행 서버가 야간 광고를 거부하는지는 클라이언트에서 확인할 수 없습니다. 재설계 서버는 발송·예약 실행 시점에 다시 검사해야 합니다.
- `잔여 횟수` 기준 규칙은 클라이언트 검사가 없으므로, 서버가 실제 발송 시각에 같은 제한을 걸어야 합니다.
