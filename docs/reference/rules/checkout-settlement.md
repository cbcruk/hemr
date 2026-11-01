# 수납 결산 (남은 금액·미수·과수납·손비)

## 요약

- 남은 금액은 `받을 금액 − 받은 금액`(비과세 + 과세 합)입니다. **음수면 `과수납`**, 아니고 `손비처리`면 `손비`, 양수면 `미수`, 0이면 상태가 없습니다. 재설계 정의 `due − received > 0 → OUTSTANDING`과 같은 방향입니다. `desk.md`의 "받은 금액 − 받을 금액이 음수면 과수납"은 부호가 거꾸로 적혀 있습니다
- 제주 지원금 행 금액은 `min(선택한 진료의 제주지원금 합, 받을 금액 합)`입니다. 다만 결산할 때는 이 금액을 **비과세 받을 금액에서만** 빼고, 받은 금액 합계에서는 이 행을 뺍니다
- 과수납금(환자 적립 과수금)은 비과세나 과세 중 한쪽에만 쓸 수 있고, 그쪽 받을 금액을 `max(0, 받을 금액 − 과수금)`으로 줄입니다
- 환자 등급 할인은 수납 화면이 아니라 진료 화면의 비급여 처방 행에서 계산합니다: `round((단가+세금)×일투여량×투약일수×(1−할인율/100))`

## 현행 위치

- 결산 계산기: `re-upstream/restored/components/desk/DeskVisitPaymentCheckOutCalculator.vue.js`
- 받을 금액 합산: `re-upstream/restored/components/payment/PaymentCalculator.vue.js`
- 수납 화면, 제주 지원금, 미수 확인, 저장: `re-upstream/restored/components/desk/DeskVisitPaymentCheckOut.vue.js`
- 선수금 분할: `re-upstream/restored/modules/SidePanelDeskActions/usePostDeskPrepaidChartsChargesMutation.js`
- 환자 등급 할인: `re-upstream/restored/components/treatment/TreatmentNonBenefitPrescriptionsRow.vue.js`

## 로직

**입력 데이터**

- `GET /patients/v2/chart/{차트Id}/medical-receipts`: 진료 건마다 `진료Id`, `상태`(`수납필요`/`미수납`/`과수납`), `비과세미수금액`, `과세미수금액`, `비과세금액`, `과세금액`, `제주지원금`, `진료일자`. `과수납` 건은 결산 목록에서 뺍니다
- `GET /patients/{id}`: `과수금액`(음수일 수 있음)
- `GET /desk/prepaid/charts/{차트Id}`: `계열별.현금.잔액`, `계열별.카드.잔액`
- 수납 화면에서 처방 금액을 바꾸면 진료별 증감 `Ae[진료Id] = {비과세, 과세}`를 받을 금액에 더합니다

**계산 순서**

1. 받을 금액: 선택한 진료의 `비과세미수금액 + Ae.비과세`, `과세미수금액 + Ae.과세`를 각각 더합니다
2. 제주 지원금 행 `n`
   - `u = Σ 선택 진료.제주지원금`. `u <= 0`이면 0
   - 아니면 `min(u, 받을 금액 비과세+과세 합)`
   - 결제 행 맨 앞에 `{결제수단: "제주지원금", 비과세: String(n)}`로 넣습니다
3. 비과세 기준액 `v`
   - `과수금액 < 0`이면 `받을금액_비과세 + |과수금액|`
   - 과수납금을 비과세에 쓰면 `max(0, 받을금액_비과세 − min(과수금액, 받을금액_비과세))`
   - 그 밖에는 `받을금액_비과세`
4. 비과세 실효액 `o = 제주 > 0 ? max(0, v − 제주) : v`
5. 과세 실효액 `p`: 과수납금을 과세에 쓰면 `max(0, 받을금액_과세 − min(과수금액, 받을금액_과세))`, 아니면 `받을금액_과세`
6. 받은 금액: `제주지원금` 행을 뺀 결제 행의 `Number(비과세)`, `Number(과세)` 합. 숫자가 아니면 0
7. `총_미수_금액_비과세 = o − 받은 비과세`, `총_미수_금액_과세 = p − 받은 과세`, `oe = 둘의 합`
8. `남은금액상태`: `oe < 0` → `과수납`; 아니고 `손비처리` → `손비`; 아니고 `oe > 0` → `미수`; 그 밖에는 없음

**부수 규칙**

- `남은금액상태`가 `과수납`이 되면 `손비처리`를 끕니다. 과수납이거나 "전액 미수"를 켠 동안에는 손비 체크박스를 쓸 수 없습니다
- "전액 미수"를 켜면 모든 결제 행을 `"0"`으로 만들고, 과수납금 사용과 손비를 끕니다
- 미수 확인: `(받을 금액 − 제주) > 0`이고, 제주 행을 뺀 입력 합이 0이고, 과수납금·손비·전액 미수를 하나도 고르지 않았으면 "받은 금액이 입력되지 않았습니다. 미수금으로 처리하시겠습니까?"를 묻습니다
- 선수금 분할: 결제수단이 `선수금`이면 `선수금-현금`, `선수금-카드` 두 행으로 나눕니다
  - 현금 계열 잔액 `e = max(0, 잔액.현금)`에서 비과세를 먼저 `min(비과세, e)`만큼 채웁니다
  - 과세는 남은 현금 잔액 `min(과세, e − 현금비과세)`만큼 채웁니다
  - 나머지는 카드 계열로 보냅니다. 0원 행은 버립니다
- 저장 body의 `결제목록`은 비어 있거나 `"0"`인 행을 빼고 `{결제수단, 비과세금액, 과세금액}`으로 보냅니다. `손비처리`, `과수납금사용여부{비과세, 과세}`도 그대로 보냅니다. **남은 금액 자체는 보내지 않으므로 서버가 다시 계산합니다**

**환자 등급 할인 (진료 화면)**

- `원금액 = (단가 + 세금) × 일투여량 × 투약일수`
- 등급을 고르면 `금액 = Math.round(원금액 × (1 − 할인율/100))`이고, `기타정보.환자등급할인 = {병원환자등급Id, 등급명, 할인율}`을 처방에 남깁니다
- 수납 화면에서 처방을 고친 뒤 저장할 때(`POST /record/{진료Id}/save`)는 `할인금액 = max(0, 단가×일투여량×투약일수 − 금액)`을 처방마다 넣고, 그 합을 진료의 `할인금액`으로 보냅니다. 이 식에는 `세금`이 들어가지 않습니다 (`DeskVisitPaymentCheckOut.vue.js:443-475`)

## 원본 코드

`re-upstream/restored/components/desk/DeskVisitPaymentCheckOutCalculator.vue.js:219-348`

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang-BfVK1o3L.js:20779-21530
const v = computed(() => {
  if (props.과수금액 < 0) return props.받을금액_비과세 + Math.abs(props.과수금액);
  if (과수납금사용여부.value.비과세 && props.과수금액 > 0) {
    const O = Math.min(props.과수금액, props.받을금액_비과세);
    return Math.max(0, props.받을금액_비과세 - O);
  }
  return props.받을금액_비과세;
});
const o = computed(() => {
  const O = props.제주지원금 ?? 0;
  return O <= 0 ? v.value : Math.max(0, v.value - O);
});
const p = computed(() => {
  if (과수납금사용여부.value.과세 && props.과수금액 > 0) {
    const O = Math.min(props.과수금액, props.받을금액_과세);
    return Math.max(0, props.받을금액_과세 - O);
  }
  return props.받을금액_과세;
});
const H = computed(() => {
  // ...
  결제내역.value.forEach(결제내역항목$ => {
    if (결제내역항목$.결제수단 === "제주지원금") return;
    총_수납_금액_비과세$ += isNaN(Number(결제내역항목$.비과세)) ? 0 : Number(결제내역항목$.비과세);
    총_수납_금액_과세$ += isNaN(Number(결제내역항목$.과세)) ? 0 : Number(결제내역항목$.과세);
  });
  총_미수_금액_비과세$ = o.value - 총_수납_금액_비과세$;
  총_미수_금액_과세$ = p.value - 총_수납_금액_과세$;
  const oe = 총_미수_금액_비과세$ + 총_미수_금액_과세$;
  const 남은금액상태$ = (() => {
    if (oe < 0) return "과수납";
    if (손비처리.value) return "손비";
    if (oe > 0) return "미수";
  })();
  // ...
});
watch(() => H.value.남은금액상태, O => {
  if (O === "과수납" && 손비처리.value) 손비처리.value = false;
});
```

`re-upstream/restored/components/desk/DeskVisitPaymentCheckOut.vue.js:368-387, 429`

```js
// Restored from unminified/DeskVisitPaymentCheckOut.vue_vue_type_script_setup_true_lang-Ci_y_crh.js:1617-2351
const a = computed(() => !I.value.length || !T.value?.length ? 0 : T.value.filter(o => o.진료Id && I.value.includes(o.진료Id)).reduce((o, l) => {
  const r = Ae.value[l.진료Id || ""] || { 비과세: 0, 과세: 0 };
  return o + (l.비과세미수금액 || 0) + r.비과세 + (l.과세미수금액 || 0) + r.과세;
}, 0));
const n = computed(() => {
  if (!I.value.length) return 0;
  const u = (T.value ?? []).filter(o => o.진료Id && I.value.includes(o.진료Id)).reduce((o, l) => o + (l.제주지원금 ?? 0), 0);
  return u <= 0 ? 0 : Math.min(u, a.value);
});
// handleSubmit: o = sum of non-Jeju rows after ZU
if (!(a.value - n.value > 0) || o !== 0 || !!de.value.비과세 || !!de.value.과세 || !!K.value || !!x.value || !!(await J.show(BaseConfirmDialog, {
  title: `받은 금액이 입력되지 않았습니다.\n미수금으로 처리하시겠습니까?`, /* ... */ }))) { /* submit */ }
```

`re-upstream/restored/modules/SidePanelDeskActions/usePostDeskPrepaidChartsChargesMutation.js:441-471`

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang-BfVK1o3L.js:18683-19127
const XU = (t, s) => {
  const e = Math.max(0, s[vt.현금]);
  const 비과세$ = Math.min(t.비과세, e);
  const i = Math.min(t.과세, e - 비과세$);
  return { [vt.현금]: { 비과세: 비과세$, 과세: i }, [vt.카드]: { 비과세: t.비과세 - 비과세$, 과세: t.과세 - i } };
};
const ZU = (t, s) => t.flatMap(e => {
  if (!Cc(e.결제수단)) return [e];          // Cc: "선수금" | "선수금-현금" | "선수금-카드"
  const a = XU({ 비과세: e.비과세_진료비, 과세: e.과세_진료비 }, s);
  return QU.map(i => ({ ...e, 결제수단: Wf[i], 비과세_진료비: a[i].비과세, 과세_진료비: a[i].과세 }))
    .filter(i => i.비과세_진료비 !== 0 || i.과세_진료비 !== 0);
});
```

`re-upstream/restored/components/treatment/TreatmentNonBenefitPrescriptionsRow.vue.js:176-177, 195-200`

```js
// Restored from unminified/PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang-D_OKxOYX.js:3485-4044
const g = computed(() => (props.row.단가 + props.row.세금) * v.value * x.value);   // v=일투여량, x=투약일수
const k = computed(() => Math.max(0, g.value - y.value));
const B = () => {
  const E = P.value?.할인율 ?? 0;
  const T = Math.round(g.value * (1 - E / 100));
  y.value = T;
};
```

## 픽스처

[`test/fixtures/rules/checkout-settlement.json`](../../../test/fixtures/rules/checkout-settlement.json): 46건 (실행 43, 추적 3)

| 케이스 | 입력 요지 | 결과 |
|---|---|---|
| 받은 = 받을 | 10,000 / 10,000 | 상태 없음 |
| 1원 부족 | 9,999 | `미수` (1) |
| 1원 초과 | 10,001 | `과수납` (−1) |
| 손비, 잔액 있음 | 7,000 + 손비 | `손비` |
| 손비, 잔액 0 | 10,000 + 손비 | `손비` |
| 초과 + 손비 | 12,000 + 손비 | `과수납`, 손비 꺼짐 |
| 비과세 초과가 과세 미수 상쇄 | 비과세 +2,000, 과세 −2,000 | 상태 없음 |
| 과수금 −2,000 | 받을 10,000 | 비과세 기준 12,000 |
| 제주 > 비과세 | 비과세 3,000, 과세 5,000, 제주 6,000 | 비과세 실효 0 |
| 제주 min | 지원금 20,000, 받을 1,000 | 1,000 |
| 미수 확인 | 받을 − 제주 = 1, 입력 0 | 물음 |
| 선수금 분할 | 비과세 5,000 + 과세 2,000, 현금잔액 6,000 | 현금(5,000/1,000), 카드(0/1,000) |
| 등급 할인 반올림 | 12,345 × 0.9 | 11,111 |

## 서버 이전 시 주의

- **부호 확정:** `remaining = due − received`이고, `remaining > 0`이면 미수, `< 0`이면 과수납입니다. 판정은 비과세와 과세를 **합친** 값으로 하므로, 비과세를 더 받은 만큼 과세 미수가 상쇄됩니다. 서버가 부분별 미수를 기록하려면 규칙을 따로 정해야 합니다
- `과수납`이 `손비`보다 먼저 판정되고, 잔액이 0이어도 `손비처리`를 켜면 상태는 `손비`입니다
- **버그로 보이는 동작 (제주 지원금):** 제주 행 금액은 과세를 포함한 받을 금액으로 상한을 잡습니다. 그런데 결산에서는 비과세 받을 금액에서만 빼고, 저장할 때는 `비과세금액`으로 보냅니다. 그래서 제주 지원금이 비과세 받을 금액보다 크면 저장되는 비과세 결제 합이 비과세 받을 금액을 넘습니다. 고치지 않고 기록만 합니다
- 미수 확인 조건(`a − n > 0`)과 결산 상태가 어긋날 수 있습니다. 위 제주 상황에서 그렇습니다
- 음수 `과수금액`은 비과세 받을 금액에만 더합니다. 서버에서 음수 과수금액이 무엇을 뜻하는지는 클라이언트 코드로 알 수 없습니다
- 선수금 분할은 현금 계열 잔액만 확인하고, 카드 계열 잔액은 확인하지 않습니다. 잔액 초과 사용을 서버가 막는지는 알 수 없습니다
- 저장 body에는 결산 결과(`남은금액상태`, 미수액)가 없습니다. 미수·과수납·손비 금액은 서버가 계산합니다. 서버 구현은 이 픽스처와 같은 결과를 내야 합니다
- 환자 등급 할인은 JS `Math.round`(0.5는 올림, 부동소수 오차 포함)를 씁니다. 서버에서 정수 연산으로 바꾸면 경계값(예: 11,110.5)이 달라질 수 있습니다
- `수납필요` 건만 화면 상단 합계에서 제주 지원금을 빼고, `미수납` 건은 빼지 않습니다(`ye`). 표시용이지만 서버 합계와 비교할 때 주의하세요
