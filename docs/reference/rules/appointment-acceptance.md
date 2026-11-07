# 예약 수용 판정

## 요약

- 예약 셀 하나(진료의 × 시간)의 수용 한도는 서버가 준 `예약가능건수`입니다. 다만 유효한 예약이나 점유 중 하나라도 `추가예약제한`이면 한도가 1로 줄어듭니다
- 클라이언트는 한도 초과를 **막지 않습니다**. 플래너는 셀을 경고색으로 칠하고(`예약 수 > 한도`), 예약 사이드 패널은 위험 톤만 표시합니다(`예약 수 >= 한도`). 실제로 막는 것은 서버의 409(중복 예약)뿐입니다
- 실제로 막는 검사는 플래너 드래그 이동의 순서형 검사입니다. 진료시간 밖 → 병원 휴진일 → 의사 휴진 → 과거 시간 → 휴게 시간 순으로 막고, 예약 차단 시간은 확인을 받은 뒤 허용합니다
- 예약 사이드 패널에서는 휴게·차단 슬롯을 고를 수 없고, 한 번에 최대 120분까지만 고를 수 있습니다. 오늘 날짜이면 지금 이전 슬롯을 숨깁니다

## 현행 위치

| 화면 | 파일 | 역할 |
|---|---|---|
| 예약 플래너 일간 셀 | `restored/components/appointment/AppointmentPlannerDailyCell.vue.js` | 한도·예약 수·초과 판정, 과거 시간, 의사 휴진 |
| 예약 플래너 주간 셀 | `restored/components/appointment/AppointmentPlannerWeeklyCell.vue.js` | 일간과 같은 식 |
| 예약 플래너 일간 | `restored/components/appointment/AppointmentPlannerDaily.vue.js` | 점심 휴게 판정, 진료시간 슬롯 집합 |
| 드래그 이동 | `restored/components/appointment/AppointmentCardDroppableAreaWrapper.vue.js` | 이동 허용 여부 |
| 진료시간 슬롯 | `restored/modules/AppointmentPlannerView/part-2.js` | 요일별 진료시간 → 슬롯 목록 |
| 유효 예약 필터 | `restored/modules/index/orderSource.js` | `mrn` |
| 예약 사이드 패널 | `restored/components/desk/DeskViewPatientAppointment.vue.js`, `.helpers.js`, `.helpers-2.js` | 슬롯 그리드, 추가예약제한 표시, 선택 규칙 |
| 진료의 근무 슬롯 | `restored/api/crm/requests-5.js` (`gg`) | 오늘이면 지금 이후만 |
| 병원 휴진일 | `restored/lib/index/part-251.js` (`OHt.checkOffDay`) | `GET /settings/closed-days/{yyyy}` 목록 포함 여부 |

## 로직

**데이터**

- `GET /desk/appointments/planner`: 일자마다 `예약내역[{시간, 진료의별예약내역[{진료의Id, 예약내역[], 점유내역[], 예약가능건수}]}]`, `점심휴게시간{시작시간,종료시간}`, `저녁휴게시간`, `차단내역[{차단일자, 차단시간}]`, `의사근무정보[{진료의Id, 휴진일태그}]`, `병원휴진여부`가 옵니다
  - `예약내역[]`: 그 슬롯에서 시작하는 예약입니다. 필드는 `취소여부`, `부도여부`, `추가예약제한`, `주문출처`, `예약변경내역[{to:{예약상태}}]`, `진료항목목록[{이름, 추가예약제한}]`
  - `점유내역[]`: 앞 슬롯에서 시작해 `소요시간` 때문에 이 슬롯까지 걸쳐 오는 예약입니다. 필드는 `원본예약Id`, `원본예약시간`, `소요시간`, `진료항목명`, `추가예약제한`
- `GET /settings/appointments`: `예약시간단위`(10/15/30, 기본 30), `예약가능건수`
- `GET /settings/clinic-hours`: 요일명 → `{휴진일여부, 시간대별진료시간{오전|오후|야간:{시작시간,종료시간}}}`
- `GET /settings/doctors/appointments/{yyyyMMdd}`: `의사별예약정보[{진료의Id, 휴진일태그, 근무시간별예약[{시간대, 시간별예약[{시간, 예약건수, 점유건수, 예약가능건수}]}]}]`. 예약 사이드 패널이 씁니다

**플래너 셀 (일간·주간 동일)**

- 유효 예약 `mrn`: `!취소여부 && !부도여부`이고, 외부 주문출처(`naver_booking`, `kakao_booking`)라면 거절되지 않았고 대기 요청도 아니어야 합니다
  - 대기 요청: 외부 출처인데 `예약변경내역`에 `등록/승인/거절/부도/내원/예약취소`가 하나도 없는 경우
  - 다른 출처(`daangn_booking` 포함)는 원내 예약처럼 셉니다
- 예약 수 = 유효 예약 수 + `점유내역.length`
- 한도는 다음 둘 중 하나가 참이면 1이고, 아니면 `예약가능건수`입니다
  - `예약내역` 중 `!취소여부 && !부도여부 && 추가예약제한`인 것이 있음 (**`mrn`이 아님**)
  - `점유내역` 중 `추가예약제한`인 것이 있음
- 초과 = `예약 수 > 한도`. 초과면 셀 배경만 `bg-utility-warning-50`으로 바뀝니다

**슬롯 상태**

- 과거 시간: `날짜 < 오늘` 또는 (`날짜 == 오늘`이고 `슬롯시각 <= 현재 HH:mm`). 현재 분의 슬롯도 과거로 봅니다
- 휴게: `점심휴게시간.시작 <= 슬롯 < 점심휴게시간.종료` (분 단위)
- 의사 휴진(`휴진일태그`)
  - `휴진`: 하루 전체
  - `오전 휴진`: `슬롯 < 점심시작`
  - `오후 휴진`: `슬롯 >= 점심종료`
  - 점심 설정이 없으면 모든 슬롯을 오전으로 봅니다
- 진료시간 슬롯 집합 = 플래너 응답의 시간 목록 ∪ 그 요일 `시간대별진료시간` 각 구간 `[시작, 종료)`를 `예약시간단위`로 자른 시각. 그 요일이 `휴진일여부`이면 구간을 더하지 않습니다

**드래그 이동 검사 순서** (첫 실패에서 멈춤)

1. `예약수정` 권한이 없으면 거부 콜백
2. 진료시간 슬롯이 아님 → "진료시간이 아닌 경우 예약을 이동할 수 없습니다."
3. 병원 휴진일 → "병원 휴진일에는 예약을 이동할 수 없습니다."
4. 의사 휴진 → "의사 휴진일에는 예약을 이동할 수 없습니다."
5. 과거 시간 → "과거 시간으로 예약을 이동할 수 없습니다."
6. 휴게 시간 → "휴게 시간에는 예약을 이동할 수 없습니다."
7. 차단 시간 → "선택한 시간은 예약 차단된 시간입니다." 확인을 받으면 허용합니다
8. 한도 초과는 검사하지 않습니다

**예약 사이드 패널(생성·수정)**

- 날짜가 `병원휴진일`이면 슬롯 그리드 대신 "선택한 날짜는 한의원 휴진일입니다."를 보여 줍니다. 달력도 휴진일을 비활성화합니다
- 슬롯 목록은 선택한 진료의의 `근무시간별예약`을 `오전/오후/야간` 순으로 정렬한 것입니다
  - 오늘이면 기준 시각 이후 슬롯만 남깁니다(`>=`)
  - 기준 시각은 `min(현재, 수정 중인 예약의 예약시간)`입니다
- 막힌 슬롯(`variant: disabled`, "휴식")은 고를 수 없습니다. 같은 날 `차단내역`과 점심·저녁 휴게 구간(`[시작, 종료)`를 `예약시간단위`로 자른 것)이 해당합니다
- 추가예약제한 슬롯은 그 진료의의 유효(`!취소 && !부도`) 예약 중 마지막으로 `진료항목목록`에 `추가예약제한`이 있는 예약을 찾아, 그 항목 이름을 위험 톤으로 표시합니다. 없으면 `추가예약제한` 점유의 `진료항목명`을 씁니다. 이 슬롯도 **고를 수 있고**, 고르면 "선택한 시간에 추가 예약이 제한된 예약이 있습니다." 경고만 뜹니다
- 그 밖의 슬롯은 `예약 수(!취소 && !부도) + 점유 수`를 `n/한도`로 표시하고, `n >= 한도`이면 위험 톤으로 칠합니다. 이 슬롯도 고를 수 있습니다
- 선택 길이
  - 연속 슬롯만 고를 수 있고, 최대 `floor(120 / 예약시간단위)`개입니다
  - 기본 길이는 진료항목 `기본소요슬롯수`, 없으면 `round(기본소요시간 / 단위)`(최소 1)입니다
  - `소요시간 = 슬롯 수 × 단위`
- 의사 `휴진일태그`가 있으면 경고만 보여 주고 막지 않습니다. 문구는 "선택한 진료의는 예약 날짜에 휴진입니다." 또는 "선택한 진료의는 [오전] 시간 휴진입니다."입니다
- 서버가 409를 돌려주면 "중복된 예약이 있습니다. 다른 예약 일시를 선택해 주세요."를 보여 줍니다

## 원본 코드

`restored/modules/index/orderSource.js:54, 197-213`

```js
// Restored from unminified/index.js:70299-70816
const eB = e => Bde.some(t => t.orderSource === e); // naver_booking | kakao_booking
const Dnt = ["등록", "승인", "거절", "부도", "내원", "예약취소"];
const Lnt = (e, t) => {
  if (!eB(e)) return false;
  for (const n of t ?? []) {
    if (Dnt.includes(n.to.예약상태 ?? "")) return false;
  }
  return true;
};
const Fde = (e, t) => eB(e) ? (t ?? []).some(n => n.to.예약상태 === "거절") : false;
const mrn = e => !e.취소여부 && !e.부도여부 && !Fde(e.주문출처, e.예약변경내역) && !Lnt(e.주문출처, e.예약변경내역);
```

`restored/components/appointment/AppointmentPlannerDailyCell.vue.js:81-90, 107-117`

```js
// Restored from unminified/AppointmentPlannerView.js:5254-5518
const y = computed(() => props.appointments ? props.appointments.예약내역?.some(b => !b.취소여부 && !b.부도여부 && b.추가예약제한) || props.appointments.점유내역?.some(b => b.추가예약제한) ? 1 : props.appointments.예약가능건수 : 0);
const u = computed(() => {
  if (!props.appointments) return 0;
  const L = props.appointments.예약내역?.filter(mrn).length ?? 0;
  const b = props.appointments.점유내역?.length ?? 0;
  return L + b;
});
const i = computed(() => props.appointments ? u.value > y.value : false);
const N = computed(() => {
  const 날짜$ = props.appointmentSummary?.날짜;
  const appointmentTime$ = props.appointmentTime;
  if (!날짜$ || !appointmentTime$) return false;
  const S = new Date();
  const T = format(S, "yyyyMMdd");
  const R = format(S, "HH:mm");
  return 날짜$ < T || 날짜$ === T && appointmentTime$ <= R;
});
```

`restored/components/appointment/AppointmentPlannerDailyCell.vue.js:118-145` (의사 휴진)

```js
const z = computed(() => {
  const 점심휴게시간$ = props.appointmentSummary?.점심휴게시간;
  if (!점심휴게시간$?.시작시간) return { isAM: true, isPM: false };
  const appointmentTime$ = props.appointmentTime;
  return {
    isAM: appointmentTime$ < 점심휴게시간$.시작시간,
    isPM: 점심휴게시간$.종료시간 ? appointmentTime$ >= 점심휴게시간$.종료시간 : false
  };
});
const C = computed(() => {
  // ...
  const 휴진일태그$ = 의사근무정보$.find(T => T.진료의Id === props.doctor.진료의Id)?.휴진일태그;
  if (휴진일태그$) {
    return 휴진일태그$ === "휴진" || 휴진일태그$ === "오전 휴진" && !!z.value.isAM || 휴진일태그$ === "오후 휴진" && !!z.value.isPM;
  } else {
    return false;
  }
});
```

`restored/modules/AppointmentPlannerView/part-2.js:312-365` (진료시간 슬롯)

```js
// Restored from unminified/AppointmentPlannerView.js:2298-2652
const ip = (n, t, e = 30) => {
  if (!n || !t || e <= 0) return [];
  const s = Vb(n); const a = Vb(t);   // "HH:mm" -> minutes
  if (s >= a) return [];
  const m = [];
  for (let c = s; c < a; c += e) m.push(op(c));
  return m;
};
const mi = (n, t, e) => {
  const s = lp(t);                    // yyyyMMdd -> "월요일" ...
  if (!s) return [];
  const a = n?.[s];
  if (!a || a.휴진일여부) return [];
  return Object.values(a.시간대별진료시간).flatMap(({ 시작시간, 종료시간 }) => ip(시작시간, 종료시간, e));
};
const vi = ({ apiTimes, treatmentDays, dateString, unitMinutes }) => new Set([...apiTimes, ...mi(treatmentDays, dateString, unitMinutes)]);
```

`restored/components/appointment/AppointmentCardDroppableAreaWrapper.vue.js:160-168`

```js
// Restored from unminified/AppointmentPlannerView.js:4726-4895
const i = async () => canUpdate$(PermissionCode$.예약수정) ? props.isTimeSlotAvailable ? props.hasHospitalHoliday ? (s.error("병원 휴진일에는 예약을 이동할 수 없습니다."), false) : props.isDoctorOffDay ? (s.error("의사 휴진일에는 예약을 이동할 수 없습니다."), false) : props.isPastDateTime ? (s.error("과거 시간으로 예약을 이동할 수 없습니다."), false) : props.isBreakTime ? (s.error("휴게 시간에는 예약을 이동할 수 없습니다."), false) : !props.hasBlockingTime || !!(await a.show(BaseConfirmDialog, {
  title: "선택한 시간은 예약 차단된 시간입니다.",
  description: "그래도 예약하시겠습니까?",
  // ...
})) : (s.error("진료시간이 아닌 경우 예약을 이동할 수 없습니다."), false) : (e(), false);
```

`restored/components/desk/DeskViewPatientAppointment.vue.js:492-519` (사이드 패널 추가예약제한 표시)

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:14350-15476
for (const 예약내역항목$ of X.예약내역) {
  const Pe = 예약내역항목$.진료의별예약내역?.find(Wt => Wt.진료의Id === V.value);
  if (!Pe) continue;
  const ft = (Pe.예약내역 || []).filter(Wt => !Wt.취소여부 && !Wt.부도여부);
  const _s = Pe.점유내역 || [];
  const Q = ft.filter(Wt => Wt.진료항목목록?.some(hl => hl.추가예약제한));
  const A = Q[Q.length - 1];
  if (A) {
    const Wt = A.진료항목목록?.find(hl => hl.추가예약제한);
    Y[예약내역항목$.시간] = Wt?.이름 || A.진료항목목록?.[0]?.이름 || "";
    continue;
  }
  const F = _s.filter(Wt => Wt.추가예약제한);
  const Ct = F[F.length - 1];
  if (Ct) Y[예약내역항목$.시간] = Ct.진료항목명 || "";
}
```

`restored/components/desk/DeskViewPatientAppointment.helpers.js:97-102`, `.helpers-2.js:8, 14, 24-30`

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:12214-12333
const f = 예약건수$ + 점유건수$;
const C = f >= $.예약가능건수;           // tone: C ? "danger" : "default"
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:12334-12472
const fE = 120;
const Qr = t => !!t && !t.disabled && t.variant !== "disabled";   // selectable
const maxSlotCount = computed(() => { const v = toValue(t.cellMinutes); return !v || v <= 0 ? 1 : Math.max(1, Math.floor(fE / v)); });
```

## 픽스처

[`test/fixtures/rules/appointment-acceptance.json`](../../../test/fixtures/rules/appointment-acceptance.json): 78건 (실행 74, 추적 4). 하네스는 원본 함수를 복사해 Vue `computed`를 일반 함수로, `new Date()`를 주입한 `now`로 바꿔 실행했습니다.

| 케이스 | 입력 요지 | 결과 |
|---|---|---|
| 한도 정확히 도달 | 유효 3건, 한도 3 | 초과 아님 |
| 한도 1건 초과 | 유효 4건, 한도 3 | 초과 |
| 추가예약제한 단독 | 제한 1건, 한도 5 | 한도 1, 초과 아님 |
| 추가예약제한 + 1건 | | 한도 1, 예약 수 2, 초과 |
| 취소/부도된 제한 예약 | | 한도 5 유지 |
| 제한 점유(앞 슬롯) | 점유 1(제한) + 예약 1 | 한도 1, 초과 |
| 거절된 외부 요청이 제한 | | 한도 1, 예약 수 0 (필터 불일치) |
| 과거 판정 | 오늘 14:30, 슬롯 14:29 / 14:30 / 14:31 | 과거 / 과거 / 아님 |
| 오전 휴진 | 점심 13:00~14:00, 슬롯 12:30 / 13:00 | 막힘 / 안 막힘 |
| 오후 휴진 | 슬롯 14:00 / 13:30 | 막힘 / 안 막힘 |
| 휴게 | 13:00 / 13:59 / 14:00 | 휴게 / 휴게 / 아님 |
| 드래그 검사 우선순위 | 휴진일 + 의사휴진 | 병원 휴진 메시지 |
| 드래그 차단 시간 | 확인 / 취소 | 허용 / 거부 |
| 사이드 패널 n/한도 | 3/3 | 위험 톤, 선택 가능 |
| 최대 선택 슬롯 | 단위 10 / 15 / 30 | 12 / 8 / 4 |
| 오늘 컷오프 | 14:30, 새 예약 | 14:30 이후 슬롯만 |

## 서버 이전 시 주의

- **한도 초과를 막는 곳이 클라이언트에 없습니다.** 플래너는 표시만 하고, 사이드 패널은 초과 슬롯도 그대로 보냅니다. 서버가 한도를 강제할지 정해야 합니다. 강제한다면 아래 두 경계가 서로 다르므로 하나를 골라야 합니다
  - 플래너: `예약 수 > 한도`면 초과
  - 사이드 패널: `예약 수 >= 한도`면 가득 참 (새 예약 1건이 더해지기 전 기준)
- **필터가 서로 다릅니다.** 한도를 1로 줄이는 판정은 `!취소 && !부도`만 보고, 예약 수는 `mrn`(외부 대기·거절 제외)으로 셉니다. 그래서 거절된 외부 요청이 `추가예약제한`이면 한도만 1로 줄고 자기 자신은 세지 않습니다. 사이드 패널은 예약 수도 `!취소 && !부도`로 셉니다. 버그로 보이며 고치지 않고 기록만 합니다
- **`추가예약제한` 위치가 둘입니다.** 플래너는 예약 항목의 `추가예약제한`(예약 단위)을 보고, 사이드 패널은 `진료항목목록[].추가예약제한`(진료항목 단위)을 봅니다. 서버 스키마 주석에는 `점유건수`가 "추가예약제한 OFF=1, ON=예약가능건수 만큼 가중"으로 계산된다고 되어 있습니다(`restored/modules/sanjaeInsurances.js:1489`). 이 가중 규칙은 서버에만 있습니다
- **과거 시간 경계가 둘입니다.** 플래너는 현재 분 슬롯을 과거로 보고(`<=`), 사이드 패널의 오늘 컷오프는 현재 분 슬롯을 보여 줍니다(`>=`)
- **의사 휴진의 효과가 화면마다 다릅니다.** 드래그 이동은 막고, 사이드 패널은 경고만 합니다. 반나절 휴진은 그날 점심 휴게로 오전·오후를 나누므로, 점심 설정이 없으면 `오전 휴진`은 하루 전체를 막고 `오후 휴진`은 아무것도 막지 않습니다
- **차단 시간의 효과도 다릅니다.** 사이드 패널은 고를 수 없게 하고, 드래그 이동은 확인 후 허용합니다
- 최대 120분 선택 제한, 휴게 슬롯 금지는 클라이언트에만 있습니다
- 진료시간 슬롯은 서버 응답 시간 ∪ 진료시간 설정입니다. 진료시간 밖이라도 서버가 시간을 내려 주면 슬롯이 됩니다
