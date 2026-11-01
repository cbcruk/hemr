# 접수 상태 전이 (현행 클라이언트)

## 요약

- 원무 화면의 네 컬럼 `대기` / `치료` / `수납` / `수납완료` 사이를 드래그하거나 카드 메뉴를 써서 접수 상태를 바꿉니다. 모두 `PATCH /desk/waiting/{내원Id}` `{상태, 이전상태}`를 보냅니다
- `치료`로 옮기면 상태를 바로 바꾸지 않고 베드 배정 모달을 엽니다. 모달에서 베드를 고르지 않으면 `{상태: "치료"}`를 보냅니다
- `수납완료` 컬럼은 수납 기록(`수납존재여부`)이 있어야 받습니다. 기록 없이 `수납`에서 끌어오면 수납 패널이 열립니다
- `수납완료`에서 다른 상태로 되돌리는 것은 아무 조건 없이 허용됩니다. 취소 상태는 없고, "접수 취소"는 `대기` 카드에서만 할 수 있으며 내원을 삭제합니다

## 현행 위치

- 드롭: `re-upstream/restored/components/waiting/WaitingColumn.vue.js`, `treatment/TreatmentColumn.vue.js`, `payment/PaymentColumn.vue.js`, `payment/PaymentCompleteColumn.vue.js`
- 드래그 상태: `re-upstream/restored/views/DeskVisitView.vue.js` (`isPaymentComplete`, `handleMovePatientToTreatment`)
- 베드 배정: `re-upstream/restored/components/treatment/TreatmentRoomBedAssignModal.vue.js`
- 카드 메뉴 정의: `re-upstream/restored/modules/desk-patient/_hoisted_1.js`
- 수납 후 전이: `re-upstream/restored/components/desk/DeskVisitPaymentCheckOut.vue.js`
- 접수 생성: `re-upstream/restored/components/desk/DeskPatientAccept.vue.js` (`No = ["대기", "치료"]`)

## 로직

**드래그 전이표** (행 = 출발 컬럼, 열 = 도착 컬럼, 권한 `접수수정` 필요)

| 출발 \ 도착 | 대기 | 치료 | 수납 | 수납완료 |
|---|---|---|---|---|
| 대기 | — | 베드 모달 | `상태: 수납` | 수납 기록 없음: 드롭 불가 / 있음: 드롭은 받지만 **아무 일도 없음** |
| 치료 | `상태: 대기` | — | `상태: 수납` | 수납 기록 없음: 드롭 불가 / 있음: `상태: 수납완료` |
| 수납 | `상태: 대기` | 베드 모달 | — | 수납 기록 없음: 수납 패널 열기(`수납생성` 권한) / 있음: `상태: 수납완료` |
| 수납완료 | `상태: 대기` | 베드 모달 | `상태: 수납` | — |
| 예약 카드 | 접수 패널(`접수생성`), 신환이면 환자 등록(`환자생성`) | 같음 | 드롭 불가 | 드롭 불가 |

- `isPaymentComplete`는 끌고 있는 카드의 `수납존재여부`입니다. 이 값으로 `수납완료` 컬럼이 드롭을 받을지 정합니다
- 베드 모달(`치료`로 이동)
  - 치료실이 하나도 없으면 "환자 이동 전 치료실 등록이 필요합니다." 확인 후 설정 화면으로 갑니다. 상태는 바꾸지 않습니다
  - `치료실현황.치료완료일시`가 있으면 중복 배정 확인을 받습니다
  - 모달에서 베드를 고르면 베드 배정 API만 부르고, 고르지 않으면 `PATCH {상태: "치료"}`를 보냅니다
- 카드 메뉴
  - `치료` 카드 "대기로 이동": `{상태: "대기", 이전상태}`
  - `수납` 카드 "치료로 이동": `{상태: "치료", 이전상태}`. 베드 모달을 거치지 않습니다
  - "접수 취소"는 `대기` 카드에만 있습니다. 내원을 삭제합니다
  - 데스크 날짜가 과거면 메뉴를 `예약`, `문자 발송`, `문진 링크 전송`, `문서 발급`, `수납 기록`만 남깁니다. 드래그는 날짜를 확인하지 않습니다
- 그 밖의 경로
  - 접수 생성: `POST /desk/waiting`의 `상태`는 `대기` 또는 `치료`입니다(기본 `대기`, 진료로 바로 보낼 때 `치료`)
  - 수납 완료: `POST /desk/v2/receipts`가 성공하면 같은 환자·`내원Id`의 접수를 `{상태: "수납완료"}`로 바꿉니다. 반복 수납(`isRepeatCheckout`)이면 상태를 바꾸지 않습니다

## 원본 코드

`re-upstream/restored/components/payment/PaymentCompleteColumn.vue.js:123-160`

```js
// Restored from unminified/DeskView-DTRddRTN.js:5858-6258
const shouldAllowDrop = computed(() => props.nowDragging === "수납" ? true : props.isPaymentComplete ? props.nowDragging === "치료" || props.nowDragging === "대기" : false);
const handleDrop = async v => {
  if (!canUpdate$(PermissionCode$.접수수정)) { open.value = true; return; }
  if (v.from === "수납") {
    if (v.paymentData.수납존재여부) {
      await moveWaitingPatient({ id: v.paymentData.내원Id, 상태: "수납완료", 이전상태: v.paymentData.상태 });
      return;
    } else {
      if (!canCreate$(PermissionCode$.수납생성)) { open.value = true; return; }
      q.value = v.paymentData.환자Id;   // opens checkout panel
      P.value = v.paymentData.내원Id;
      return;
    }
  }
  if (v.from === "치료") {
    if (!v.treatmentData.수납존재여부) return;
    await moveWaitingPatient({ id: v.treatmentData.내원Id, 상태: "수납완료", 이전상태: v.treatmentData.상태 });
    return;
  }
};
```

`re-upstream/restored/components/payment/PaymentColumn.vue.js:126-158`

```js
// Restored from unminified/DeskView-DTRddRTN.js:5405-5804
const shouldAllowDrop = computed(() => props.nowDragging === "대기" || props.nowDragging === "치료" || props.nowDragging === "수납완료");
const handleDrop = async v => {
  if (!canUpdate$(PermissionCode$.접수수정)) { open.value = true; return; }
  if (v.from === "대기") { await moveWaitingPatient({ id: v.waitingData.내원Id, 상태: "수납", 이전상태: v.waitingData.상태 }); return; }
  if (v.from === "치료") { await moveWaitingPatient({ id: v.treatmentData.내원Id, 상태: "수납", 이전상태: v.treatmentData.상태 }); return; }
  if (v.from === "수납완료") { await moveWaitingPatient({ id: v.paymentCompleteData.내원Id, 상태: "수납", 이전상태: v.paymentCompleteData.상태 }); }
};
```

`re-upstream/restored/components/waiting/WaitingColumn.vue.js:172, 227-251`

```js
// Restored from unminified/DeskView-DTRddRTN.js:6935-7566
const shouldAllowDrop = computed(() => ["예약", "치료", "수납", "수납완료"].includes(props.nowDragging));
// handleDrop, after the 예약 branches:
if (!canUpdate$(PermissionCode$.접수수정)) { open.value = true; return; }
if (w.from === "치료") { await moveWaitingPatient({ id: w.treatmentData.내원Id, 상태: "대기", 이전상태: w.treatmentData.상태 }); return; }
if (w.from === "수납") { await moveWaitingPatient({ id: w.paymentData.내원Id, 상태: "대기", 이전상태: w.paymentData.상태 }); return; }
if (w.from === "수납완료") { await moveWaitingPatient({ id: w.paymentCompleteData.내원Id, 상태: "대기", 이전상태: w.paymentCompleteData.상태 }); }
```

`re-upstream/restored/components/treatment/TreatmentColumn.vue.js:153, 187-202`

```js
// Restored from unminified/DeskView-DTRddRTN.js:6316-6872
const shouldAllowDrop = computed(() => ["예약", "대기", "수납", "수납완료"].includes(props.nowDragging));
if (!canUpdate$(PermissionCode$.접수수정)) { open.value = true; return; }
if (v.from === "대기") { emit("movePatientToTreatment", v.waitingData, "배정"); return; }
if (v.from === "수납") { emit("movePatientToTreatment", v.paymentData, "배정"); return; }
if (v.from === "수납완료") { emit("movePatientToTreatment", v.paymentCompleteData, "배정"); return; }
```

`re-upstream/restored/components/treatment/TreatmentRoomBedAssignModal.vue.js:398-428` (발췌)

```js
// Restored from unminified/useExclusivePopover-BPTgAwCS.js:213-759
if (h.value && c.value) {
  putTreatmentsPatientsMutation$.mutateAsync({ 내원Id: props.내원Id, 치료실설정Id: h.value.치료실Id, 치료실베드: Number(c.value) });
} else {
  mutateAsync({ id: props.내원Id, 상태: "치료" });
}
```

## 픽스처

[`test/fixtures/rules/visit-status-transitions.json`](../../../test/fixtures/rules/visit-status-transitions.json): 37건 (실행 26, 추적 11). 실행 케이스는 네 컬럼의 `shouldAllowDrop`과 `handleDrop`을 그대로 복사하고, 출발 × 도착 × `수납존재여부` 전체 조합을 돌려 부수 효과(PATCH 본문, 모달 열기, 권한 거부)를 기록한 것입니다.

| 케이스 | 결과 |
|---|---|
| 치료 → 대기 | `PATCH {상태: 대기, 이전상태: 치료}` |
| 대기 → 치료 | 베드 모달(`배정`) |
| 수납완료 → 수납 | `PATCH {상태: 수납, 이전상태: 수납완료}` |
| 대기 → 수납완료 (기록 없음) | 드롭 불가 |
| 대기 → 수납완료 (기록 있음) | 드롭 허용, 효과 없음 |
| 치료 → 수납완료 (기록 있음) | `PATCH {상태: 수납완료}` |
| 수납 → 수납완료 (기록 없음) | 수납 패널 열기 |
| `접수수정` 권한 없음 | 권한 거부 |

## 서버 이전 시 주의

재설계 상태 기계(`src/modules/front-desk/visits/visit-status.ts`)와 다른 점입니다.

| 현행 (클라이언트) | 재설계 | 차이 |
|---|---|---|
| `수납완료` → `대기`/`치료`/`수납` 자유 | `COMPLETED`는 `REOPEN`(→ `AWAITING_PAYMENT`)과 `CANCEL`만 | 현행은 수납 기록을 그대로 둔 채 되돌립니다 |
| `대기`/`치료` → `수납완료`는 수납 기록이 있을 때만 (`대기`는 실제로 불가) | `WAITING`/`IN_TREATMENT` → `CHECKOUT` → `COMPLETED` | 재설계는 결제 명령이 직접 완료시킵니다 |
| `수납` → `치료`, `수납` → `대기` 허용 | `AWAITING_PAYMENT` → `START_TREATMENT`/`RETURN_TO_WAITING` 허용 | 같음 |
| 취소 상태 없음. `대기` 카드의 "접수 취소"가 내원 삭제 | 모든 상태에서 `CANCEL`, `IN_TREATMENT`/`COMPLETED`는 cascade 필요 | 현행에는 치료·수납 중 취소 경로가 없습니다 |
| `치료` 진입은 베드 배정 모달 경유(베드를 고르면 상태 PATCH 없음) | `START_TREATMENT` | 베드 배정 API가 상태를 바꾸는지는 서버 쪽 동작이라 확인하지 못했습니다 |

- **버그로 보이는 동작:** `대기` 카드에 수납 기록이 있으면 `수납완료` 컬럼이 드롭을 받지만, `handleDrop`에 `대기` 분기가 없어 아무 일도 일어나지 않습니다
- 드래그는 날짜를 확인하지 않습니다. 과거 날짜 제한은 카드 메뉴에만 있습니다
- `이전상태`는 드래그·메뉴 이동에서만 보내고, 베드 모달과 수납 완료에서는 보내지 않습니다. 서버가 이 값으로 동시성 검사를 하는지는 알 수 없습니다
- 권한: 컬럼 간 이동은 `접수수정`, 수납 패널 열기는 `수납생성`, 예약 카드 드롭은 `접수생성`/`환자생성`이 필요합니다
