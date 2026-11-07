# 예약 부도 처리 시점

## 요약

- 부도 전이는 **서버만** 합니다. 클라이언트에는 부도 타이머가 없고, 설정 화면과 이력 문구만 있습니다
- 설정 값은 `부도처리시점`(10/30/60분)과 `진료마감부도처리여부`(boolean) 두 개입니다. `진료마감부도처리여부`가 참이면 분 값은 무시됩니다
- 설정 화면은 바뀐 필드만 `PATCH /settings/appointments`로 보냅니다

## 현행 위치

- 설정: `restored/components/setting/SettingAppointmentGeneral.vue.js` (`/setting/appointment` → `일반예약` 탭)
- 이력 표시: `restored/components/appointment/AppointmentPlannerHistory.vue.js`, `restored/modules/index/orderSource.js`

## 로직

- 선택지: `부도처리시점: [10, 30, 60]`과 "진료 마감 후"
- `N분 후` 버튼은 `!진료마감부도처리여부 && 부도처리시점 === N`이면 활성입니다. 누르면 `{부도처리시점: N, 진료마감부도처리여부: false}` 중 현재 값과 다른 필드만 보냅니다
- "진료 마감 후" 버튼은 `진료마감부도처리여부 === true`이면 활성입니다. 누르면 `{진료마감부도처리여부: true}`만 보내므로 `부도처리시점`은 그대로 남습니다
- 화면 설명
  - 진료 마감 모드: "예약 시간과 관계없이 당일 [진료 마감] 이후 자동으로 [부도] 처리됩니다."
  - 분 모드: "예약 시간으로부터 [N분] 경과 시 자동으로 [부도] 처리됩니다." 값이 없으면 0분으로 표시합니다
- 이력: 서버가 남긴 `to.예약상태 === "부도"` 변경은 "예약시간이 지나 부도 처리됐습니다."로 표시합니다. 같은 변경에서 `예약일자`가 바뀌었으면 `부도후_예약일자_변경`("예약 변경으로 부도 처리됐습니다."), 시간만 바뀌었으면 `부도후_예약시간_변경`으로 표시합니다

## 원본 코드

`restored/components/setting/SettingAppointmentGeneral.vue.js:73-110, 188-207`

```js
// Restored from unminified/SettingAppointment.js:1010-1233
const n = { 예약시간단위: [10, 15, 30], 부도처리시점: [10, 30, 60] };
const f = m => {
  const e = data.value;
  if (!e) return;
  const o = Object.fromEntries(Object.entries(m).filter(([g, t]) => e[g] !== t));
  if (Object.keys(o).length !== 0) mutate(o);   // PATCH /settings/appointments
};
// N분 후 button
active: !d.value?.진료마감부도처리여부 && d.value?.부도처리시점 === 부도처리시점항목$,
onClick: g => f({ 부도처리시점: 부도처리시점항목$, 진료마감부도처리여부: false })
// 진료 마감 후 button
active: d.value?.진료마감부도처리여부 === true,
onClick: o => f({ 진료마감부도처리여부: true })
```

`restored/components/appointment/AppointmentPlannerHistory.vue.js:157-216` (발췌)

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:15743-16051
if (to?.예약상태 === "부도") {
  if (from.예약일자 === to.예약일자 && from.예약시간 !== to.예약시간) return { 예약상태: "부도후_예약시간_변경", 예약이력: "기존 예약 부도 후 시간을 변경했습니다.", /* ... */ };
  if (from.예약일자 !== to.예약일자) return { 예약상태: "부도후_예약일자_변경", 예약이력: "예약 변경으로 부도 처리됐습니다.", /* ... */ };
}
switch (to?.예약상태) {
  case "부도":
    return { 예약상태: "예약부도", 예약상태Text: "부도", 예약이력: "예약시간이 지나 부도 처리됐습니다.", createdAt };
}
```

## 픽스처

[`test/fixtures/rules/appointment-no-show.json`](../../../test/fixtures/rules/appointment-no-show.json): 10건 (실행 8, 추적 2)

| 케이스 | 입력 | 결과 |
|---|---|---|
| 30분 설정 표시 | `{30, false}` | "30분 후" 활성, 분 문구 |
| 진료 마감 모드 표시 | `{30, true}` | "진료 마감 후"만 활성 |
| 30 → 60 클릭 | | `{부도처리시점: 60}` |
| 같은 값 클릭 | | 요청 없음 |
| 진료 마감 클릭 | | `{진료마감부도처리여부: true}` |
| 진료 마감 모드에서 30분 클릭 | `{30, true}` | `{진료마감부도처리여부: false}` |
| 이력 `부도` | | "예약시간이 지나 부도 처리됐습니다." |

## 서버 이전 시 주의

- 부도 판정식(예약 **시작** 시각 + N분인지, 경계를 `>=`와 `>` 중 무엇으로 볼지)은 클라이언트 코드에 없습니다. 화면 문구는 "예약 시간으로부터 N분 경과 시"입니다
- "진료 마감" 시각을 어디서 가져오는지 클라이언트에서는 알 수 없습니다. 요일별 진료시간의 마지막 구간 종료일 것으로 추정합니다. 임시진료일과 휴진일 처리도 알 수 없습니다
- 이미 내원했거나(`내원여부`) 취소된 예약을 건너뛰는지도 서버 쪽 동작이라 확인하지 못했습니다
- 부도 예약도 접수할 수 있습니다(`appointment-acceptance`, `check-in-validation` 참고). 접수하면 화면은 `부도후_내원`으로 표시합니다
- 옛 데이터에 10/30/60이 아닌 값(예: 45)이 있으면 활성 버튼은 없지만 문구에는 그 값이 그대로 나옵니다
