# 시재 예상 마감 금액

## 요약

- 서버 응답에 `현금흐름`이 있으면 `현금흐름.예상마감금액`을 그대로 씁니다
- 없으면 클라이언트가 `시작금액 + 현금수납 − (현금지출 + 현금환불)`로 계산합니다. 이때 현금수납은 그날 수납 행의 `결제정보.현금` 합이고(선수금 현금 충전은 빠짐), 현금환불은 결제정보가 현금 하나뿐인 행의 `환불` 합입니다
- 시재 상태는 `시작금액 === null` → `미등록`, 정산 일시 없음 → `정산전`, 정산 후 수정 없음 → `정산완료`, 있음 → `정산후수정`입니다

## 현행 위치

- 계산: `restored/modules/DeskView/part-2.js` (`gr`, `yr`)
- 수납 집계: `restored/modules/DeskView/part-1.js` (`vo`)
- 지출 합: `restored/views/DeskPaymentsView.vue.js`

## 로직

- 데이터
  - `GET /desk/cash-registers?date=`: `시작금액`, `마감금액`, `현금정산일시`, `마감후수정여부`, 선택적으로 `현금흐름{수납현금, 선수금현금충전, 수납현금환불, 선수금현금환불, 지출, 예상마감금액}`
  - `GET /desk/receipts/{date}`: 행마다 `행유형`, `결제정보{현금, 카드, 통장}`, `환불`
  - `GET /desk/expenses?date=`: `지출금액`
- `현금흐름`이 있을 때
  - 현금수납 = `수납현금 + 선수금현금충전`
  - 현금환불 = `수납현금환불 + 선수금현금환불`
  - 현금지출 = `지출`
  - 예상마감금액 = `예상마감금액` (서버 값)
- `현금흐름`이 없을 때
  - 수납 행(`행유형 === "수납"`)만 씁니다
  - 현금수납 = `Σ 결제정보.현금`
  - 현금환불 = `Σ 환불`. 단 `결제정보`의 키가 `현금` 하나뿐인 행만 셉니다
  - 현금지출 = 지출 목록의 `지출금액` 합
  - 예상마감금액 = `(시작금액 || 0) + 현금수납 − (현금지출 + 현금환불)`. 음수도 될 수 있습니다
- 재정산 필요: `마감금액`이 있고 `마감금액 !== 예상마감금액`

## 원본 코드

`restored/modules/DeskView/part-2.js:7-86`

```js
// Restored from unminified/DeskView.js:234-314
const gr = (u, t, n) => {
  const { 결제수단별합계, 현금환불금액합계 } = vo(() => toValue(t));
  const 현금흐름$ = computed(() => toValue(u)?.현금흐름);
  const 시작금액$ = computed(() => toValue(u)?.시작금액 || 0);
  const 현금수납 = computed(() => {
    const A = 현금흐름$.value;
    return A ? A.수납현금 + A.선수금현금충전 : 결제수단별합계.value?.현금 ?? 0;
  });
  const 현금환불 = computed(() => {
    const A = 현금흐름$.value;
    return A ? A.수납현금환불 + A.선수금현금환불 : 현금환불금액합계.value;
  });
  const 현금지출 = computed(() => 현금흐름$.value?.지출 ?? toValue(n));   // n = Σ 지출금액
  const 예상마감금액 = computed(() => {
    const A = 현금흐름$.value;
    return A ? A.예상마감금액 : 시작금액$.value + 현금수납.value - (현금지출.value + 현금환불.value);
  });
  const is재정산필요 = computed(() => {
    const 마감금액$ = toValue(u)?.마감금액;
    return 마감금액$ == null ? false : 마감금액$ !== 예상마감금액.value;
  });
  // ...
};
const yr = ({ 시작금액, 현금정산일시, 마감후수정여부 }) => {
  if (시작금액 === null) return "미등록";
  else if (현금정산일시) return 마감후수정여부 ? "정산후수정" : "정산완료";
  else return "정산전";
};
```

`restored/modules/DeskView/part-1.js:15, 60-77, 92-95`

```js
// Restored from unminified/DeskView.js:48-153
const i = computed(() => (data.value ?? []).filter(N => N.행유형 === "수납"));
const 결제수단별합계 = computed(() => i.value.reduce((N, z) => {
  const { 결제정보 = {} } = z;
  const { 현금 = 0, 카드 = 0, 통장 = 0 } = 결제정보 || {};
  N.현금 += 현금; N.통장 += 통장; N.카드 += 카드;
  return N;
}, { 현금: 0, 통장: 0, 카드: 0 }));
const 현금환불금액합계 = computed(() => i.value.filter(C => {
  const E = Object.keys(C?.결제정보 || {});
  return E.length === 1 && E.includes("현금");
}).reduce((C, E) => C + (E?.환불 || 0), 0));
```

## 픽스처

[`test/fixtures/rules/cash-drawer-expected-closing.json`](../../../test/fixtures/rules/cash-drawer-expected-closing.json): 16건 (모두 실행)

| 케이스 | 입력 요지 | 결과 |
|---|---|---|
| 서버 현금흐름 있음 | 서버 예상 151,000 | 151,000 |
| 서버 값이 구성요소와 안 맞음 | 서버 예상 1 | 1 |
| fallback | 시작 100,000, 현금 40,000, 지출 7,500, 현금 단독 환불 4,000 | 128,500 |
| 현금+카드 행의 환불 | 환불 2,000 | 현금환불 0 |
| 시작금액 null | | 0으로 계산 |
| 음수 | 시작 0, 현금 1,000, 지출 3,000 | −2,000 |
| 재정산 필요 | 마감 120,000, 예상 120,001 | 참 |
| 시재 상태 | 시작 0 | `정산전` |

## 서버 이전 시 주의

- 재설계는 이 fallback을 없애고 항상 서버 값을 줍니다(`front-desk.md`). 이관 전 데이터를 비교할 때 이 픽스처로 클라이언트가 보여 주던 값을 재현할 수 있습니다
- `desk.md`에는 fallback의 현금수납에 선수금 현금 충전이 포함된다고 적혀 있지만, 코드는 포함하지 않습니다. 포함하는 것은 서버 `현금흐름` 경로뿐입니다
- fallback은 결제수단이 섞인 행의 환불을 현금 환불로 세지 않습니다. 실제 현금 환불이 있었다면 예상액이 실제보다 커집니다
- `현금흐름`이 있으면 서버 값을 검증 없이 씁니다
- `시작금액` 0은 등록된 것으로 봅니다(`정산전`). `null`만 `미등록`입니다
- `is재정산필요`는 계산만 확인했고, 이 값을 쓰는 화면은 추적하지 않았습니다
