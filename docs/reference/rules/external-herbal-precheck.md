# 원외탕전(ocsv2) 결제 전 사전 확인

## 요약

원외탕전 주문 화면은 결제 확인창을 띄우기 전에 `POST /ocsv2/precheck`로 재고·수량을 확인합니다. 응답이 `data.ok === false`일 때만 결제를 막고, **호출이 어떤 이유로든 실패하면 `catch {}`가 오류를 삼키고 결제를 계속합니다.** 이어 초안 저장 → 견적(`quote`) → 주문·결제(`order`)를 순서대로 부르고, 서버 견적 총액에 맞춰 결제수단 금액을 다시 나눕니다. "외부 결제는 완료되었으나" 오류는 중복 결제 위험으로 보고 재시도를 막습니다.

## 현행 위치

- 진료 보드 원외탕전 주문(아코디언): `re-upstream/restored/components/ocsV2/OcsV2DecoctionOrderAsideAccordion.vue.js` — `handleClick`(결제 버튼), `ie`(precheck 요청 본문)
- 주문 작성 화면: `re-upstream/restored/views/OcsV2OrderCreateView.vue.js` — `handlePay`(같은 흐름, 로그 문구만 "EP 미가용 — 머지 후 활성")
- 주문 클라이언트 `sg`: `re-upstream/restored/modules/useOcsV2배송상태/part-7.js` — `submitOrderAndPay`, `precheck`, 견적 정규화 `Ro`, 결제수단 재분배 `Fi`
- 약재 수량 `rl`: `re-upstream/restored/modules/useOcsV2배송상태/탕전실설정.js`
- API: `re-upstream/restored/api/ocs-v2/query-keys.js` (`postOcsv2Precheck`는 `response.data.result`를 돌려줌, 중복 결제 판별 `Q`), `api/ocsv2/queries.js` (`usePostOcsv2OrderMutation`이 `중복결제위험` 표시)

## 로직

### 결제 버튼 흐름

1. 이미 `결제완료`면 무시합니다. 이용 계약이 없으면 계약 모달을 엽니다.
2. 1·2단계 입력 검증(처방·포장·배송 등). 실패하면 첫 오류 위치로 스크롤하고 "아직 입력하지 않은 항목이 있습니다."
3. **precheck** (실제 클라이언트가 있을 때만, mock 모드는 생략)
   - `D = await precheck(본문)`
   - `D.data?.ok === false`이면: `D.data.lines` 중 `ok`가 아닌 줄을 `OUT_OF_STOCK` → "재고 부족", 그 밖 → "수량 불일치"로 바꾸고, `D.data.errors` 뒤에 붙여 "주문 확인 실패: {목록}"을 띄우고 멈춥니다. 목록이 비면 "주문 확인 실패: 수량·재고를 확인해주세요."
   - 그 밖의 응답(`ok: true`, `ok` 없음, `data` 래퍼 없음)은 통과합니다.
   - 예외(네트워크, 4xx, 5xx, `null` 응답에서 난 TypeError 등)는 `console.info("[ocsv2] precheck 생략(EP 미가용)")`만 남기고 **통과**합니다.
4. 확인창 "결제를 진행할까요? 총 N원이 결제됩니다…". 취소하면 끝.
5. `submitOrderAndPay(초안본문, 결제수단목록, 견적전후처리)`
   1. 초안 저장(`POST`/`PATCH /ocsv2/drafts`). 실패해도 기존 초안 id가 있으면 경고만 남기고 계속합니다.
   2. 견적 전 후처리(복약지도서 업로드 등). 실패해도 계속합니다.
   3. `POST /ocsv2/quote { draftId }` → `Ro(금액항목)`로 정규화.
   4. `Fi(결제수단목록, paymentAmount)`로 결제수단 금액을 서버 총액에 맞춥니다.
   5. `POST /ocsv2/order { draftId, 견적ID, 결제수단목록 }`.
6. 오류에 `중복결제위험`이 있으면 "결제가 이미 완료됐을 수 있어 재시도하지 않습니다. 주문 상태를 확인해주세요."를 띄우고, 아니면 오류 모달을 엽니다.

### precheck 요청 본문 (`ie`)

- `items[]`: `{ productId, variantId, quantity, productType }`
  - `HERBAL`: 약재 라인마다 `quantity = rl(첩당용량g, 첩수)`. `rl`은 0 이하 입력이면 0, 아니면 `Math.round(용량 × 10) × 첩수 ÷ 10`(첩당 용량을 0.1g 단위로 반올림한 뒤 곱함).
  - `POUCH`: `quantity = 팩수`.
  - `BOX`: `quantity = ceil(팩수 ÷ 과금팩수)`, 과금팩수가 없거나 0이면 1.
  - `SHOPPING_BAG`: 입력한 쇼핑백 수량, 없으면 BOX와 같은 식.
  - `ADDITIONAL_OPTION`: 수량 > 0인 기타 원료.
  - 탕전 유형 품목(`DECOCTION_TYPE` 등): BOX와 같은 식.
- `compounding: { packCount: 팩수, totalHerbWeightKg: 총약재량g ÷ 1000 }`

### 결제수단 재분배 (`Fi`)

- 서버 총액이 `null`이거나 0 이하이거나 결제수단이 없으면 입력을 그대로 씁니다.
- 예치금카드 합이 총액보다 크면 **마지막 예치금카드부터** 넘친 만큼 줄입니다.
- 일반카드가 있으면(첫 번째만) `총액 − 예치금카드 합`을 넣습니다.
- 일반카드가 없고 예치금카드 합이 모자라면 마지막 예치금카드에 차액을 더합니다.
- 금액이 0 이하인 수단은 뺍니다.

### 견적 정규화 (`Ro`)

- `paymentAmount`·`cashDiscountAmount`는 양수 숫자만 쓰고 아니면 `null`, `shippingAmount`는 숫자가 아니면 0, `items`는 배열이 아니면 `[]`, `priceBreakdown`은 없으면 `null`.

### 중복 결제 위험 (`Q`)

- axios 오류이고 `response.data.message`에 "외부 결제는 완료되었으나"가 들어 있으면 `중복결제위험 = true`. 주문(`order`)과 주문 취소 mutation 모두 이 표시를 붙입니다.

## 원본 코드

`re-upstream/restored/components/ocsV2/OcsV2DecoctionOrderAsideAccordion.vue.js:574-587` (`OcsV2OrderCreateView.vue.js:1162-1174`도 같은 구조)

```js
// Restored from unminified/TreatmentViewBoard-B3k9L_c2.js:9249-9971
if (c) {
  try {
    const D = await c.precheck(ie());
    if (D.data?.ok === false) {
      const se = (D.data?.lines ?? []).filter(S => !S.ok).map(S => S.code === "OUT_OF_STOCK" ? "재고 부족" : "수량 불일치");
      const ne = [...(D.data?.errors ?? []), ...se];
      f.error(`주문 확인 실패: ${ne.join(", ") || "수량·재고를 확인해주세요."}`);
      return;
    }
  } catch {
    console.info("[ocsv2] precheck 생략(EP 미가용)");
  }
}
```

`re-upstream/restored/api/ocs-v2/query-keys.js:68, 91-99`

```js
// Restored from unminified/OcsV2MedicationGuidePagedSheets-vEnmJYhw.js:13-101
const postOcsv2Precheck = async body => (await emrClient.post(`${u}/precheck`, body)).data.result;
const a1 = "외부 결제는 완료되었으나";
const Q = t => {
  if (!Ma(t)) {
    return false;
  }
  const message$ = t.response?.data?.message;
  return typeof message$ == "string" && message$.includes(a1);
};
```

`re-upstream/restored/modules/useOcsV2배송상태/part-7.js:16-37`

```js
// Restored from unminified/useOcsV2배송상태-DHC-CIRk.js:2190-2332
const Fi = (e, t) => {
  if (t == null || t <= 0 || !e.length) {
    return e;
  }
  const n = e.map(l => ({ ...l }));
  const s = n.filter(l => l.결제수단유형 === "예치금카드");
  const o = n.find(l => l.결제수단유형 === "일반카드");
  let r = s.reduce((l, i) => l + i.입력금액, 0);
  for (let l = s.length - 1; l >= 0 && r > t; l--) {
    const i = Math.min(s[l].입력금액, r - t);
    s[l].입력금액 -= i;
    r -= i;
  }
  if (o) {
    o.입력금액 = t - r;
  } else if (r < t && s.length) {
    s[s.length - 1].입력금액 += t - r;
  }
  return n.filter(l => l.입력금액 > 0);
};
```

`re-upstream/restored/modules/useOcsV2배송상태/탕전실설정.js:1324-1331`, `OcsV2DecoctionOrderAsideAccordion.vue.js:478-481`

```js
// Restored from unminified/useOcsV2배송상태-DHC-CIRk.js:2647-3963
const rl = (e, t) => {
  const n = Number(e) || 0;
  const s = Number(t) || 0;
  if (n <= 0 || s <= 0) {
    return 0;
  } else {
    return Math.round(n * 10) * s / 10;
  }
};
// Restored from unminified/TreatmentViewBoard-B3k9L_c2.js:9249-9971
const ie = () => {
  const O = Number(처방Mock$.처방메타.팩수) || 0;
  const K = Number(처방Mock$.처방메타.첩수) || 0;
  const D = S => S && S > 0 ? Math.ceil(O / S) : 1;
  // … HERBAL quantity: rl(약재라인$.첩당용량g, K), POUCH: O, BOX: D(과금팩수) …
```

## 픽스처

`test/fixtures/rules/external-herbal-precheck.json` — 32건(모두 실행). precheck 응답은 `postOcsv2Precheck`가 돌려주는 값(`response.data.result`)을 그대로 넣습니다.

- `precheckGate`(10): 통과, 재고 부족·수량 불일치, 서버 errors 우선, 상세 없는 실패, 네트워크·404 예외 통과, `data` 래퍼 없는 `ok:false` 통과, `ok` 없음, `null` 응답, mock 모드.
- `herbLineQuantity`(6): 3.25g×20=66(반올림), 3.24g×20=64, 0 입력, 문자열 입력, 1.15g×3.
- `packBasedQuantity`(5): 올림, 나누어떨어짐, 과금팩수 0·없음, 팩수 0.
- `allocatePaymentMethods`(6): 일반카드 차액, 예치금 초과분 뒤에서부터 차감, 일반카드 없음, 0원 제거, 총액 null·0.
- `normalizeQuote`(2), `duplicatePaymentRisk`(3).

## 서버 이전 시 주의

- **precheck 우회를 그대로 옮기면 안 됩니다.** 재설계의 `:place`는 서버에서 precheck를 다시 하고, 실패하거나 외부 시스템에 닿지 않으면 422/503으로 결제를 막아야 합니다.
- 현행 클라이언트는 `result.data.ok`를 읽습니다. 서버가 `result = { ok, lines }` 형태로 주면 `ok:false`도 통과합니다. 현행 서버 응답 형태를 확인하고, 재설계에서는 래퍼 없이 `{ ok, lineIssues[] }`로 고정합니다.
- 줄 단위 실패 코드는 `OUT_OF_STOCK`만 구분되고 나머지는 "수량 불일치"로 묶입니다. 서버는 코드 목록을 정의해야 합니다.
- 약재 수량은 첩당 용량을 0.1g 단위로 반올림한 뒤 첩수를 곱합니다. 재고 확인과 견적이 같은 식을 써야 합니다.
- 결제수단 금액은 클라이언트가 서버 견적 총액에 맞춰 다시 나눕니다. 재설계는 서버가 견적 총액과 결제수단 합을 대조해야 합니다.
- "외부 결제는 완료되었으나" 메시지 문자열 비교로 중복 결제를 판별합니다. 서버는 오류 코드로 내려 주고, 같은 견적의 재결제를 멱등 키로 막아야 합니다.
- 초안 저장·복약지도서 업로드 실패를 무시하고 결제를 진행하는 동작도 서버에서 재검토해야 합니다.
