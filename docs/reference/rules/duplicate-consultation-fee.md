# 동일일자 대면/비대면 진찰료 중복

## 요약

- 건보·급여 진료를 저장하거나 완료할 때, 같은 날(yyyyMMdd) **대면/비대면 여부가 반대인** 다른 진료에도 진찰료가 있으면 확인창 "동일일자 대면/비대면 진찰료 중 1가지만 산정가능합니다. 1가지만 남겨주세요."를 띄웁니다.
- "이대로 저장"을 누르면 그대로 저장·완료하고, "진찰료 정리하기"를 누르면 저장(과 완료)을 멈춥니다. 막는 규칙이 아니라 확인 규칙입니다.
- 진찰료는 수가코드가 `10`으로 시작하는 라인입니다(비대면 관리료 `91001`~`91004` 제외). 같은 모드끼리(대면+대면, 비대면+비대면)의 중복은 클라이언트에서 검사하지 않습니다.
- 자보 같은 날 진찰료는 별도 규칙입니다: [auto-insurance-same-day-consultation.md](auto-insurance-same-day-consultation.md). 비대면 청구 경고 `T0004`도 같은 의도지만 표시 목록에서 걸러져 보이지 않습니다.

## 현행 위치

- `restored/modules/ReservedProcedures/처방명.js` `Pu`(239), `Uh`(241-252), 문구 `Fh`(254-261).
- `restored/components/treatment/TreatmentViewBoard.helpers-10.js:279-308` `validate동일일자진찰료중복`.
- `restored/components/treatment/TreatmentViewBoard.helpers-12.js:45-66` `savePatientRecord({ 진찰료중복안내 })`: 옵션이 참이고 검사가 거짓이면 `진찰료중복으로저장중단됨 = true`로 두고 저장하지 않습니다.
- 호출: 진료 화면 저장 버튼(`TreatmentViewBoard.vue.js:889-891`), 완료 흐름(`TreatmentViewBoard.helpers-11.js:59-82`, 중단되면 `done`을 부르지 않음), 비대면 LITE 저장(같은 파일 94), 환자 전환 시 저장(`views/TreatmentView.vue:547-551`, 중단되면 이동 취소 658).
- `restored/modules/index/part-221.js` `hee`(904), `ZBt`의 T0004(943-951). `local.js:518-533`이 `같은날대면진찰료있음`을 계산하고 `HFt`가 표시 코드 집합(771)으로 거릅니다.

## 로직

`Uh({ 현재진료, 최근진료기록 })`:

1. `n = 현재진료.기준일시.slice(0, 8)`. 비어 있거나 현재 처방에 `Pu` 라인이 없으면 `undefined`.
2. `Pu(라인)` = `수가코드.startsWith("10") && !ck(수가코드)`. `ck`는 비대면 관리료 `91001`(주간)·`91002`(야간)·`91003`(심야)·`91004`(공휴) 포함 여부입니다.
3. `d = 현재진료.비대면시범사업여부 === true`.
4. `최근진료기록`에서 `진료Id`가 다르고, 같은 날이며, `(비대면시범사업여부 === true) !== d`이고, `Pu` 라인이 있는 **첫** 진료를 반환합니다.

`validate동일일자진찰료중복()`:

1. 보험구분이 `건보`·`급여`가 아니면 `true`(통과).
2. `Uh` 결과가 없으면 `true`.
3. 문구 선택: 진료 날짜가 기기 오늘이고 현재 진료나 충돌 진료가 오늘 대기 목록에서 `상태 === "수납완료"`면 "이미 수납이 완료된 진료입니다. 진찰료를 제외하면 과수납금이 발생할 수 있습니다.", 아니면 "이미 수납이 완료된 진료라면, 진찰료를 제외할 때 과수납금이 발생할 수 있습니다."
4. 확인창(확인 "이대로 저장", 취소 "진찰료 정리하기") 결과 `=== true`를 반환합니다.

비대면 청구 경고 `ZBt`(참고): 현재가 비대면이고 `같은날대면진찰료있음`(같은 날 대면 진료 중 `Gt.진찰료임` 라인 보유)이면, 카테고리 `31001001` 한방진찰료이고 `10`으로 시작하며 관리료가 아닌 라인에 `T0004`. `HFt`의 표시 코드 집합에 `T`로 시작하는 코드가 없어 진료 화면에는 나오지 않습니다.

## 원본 코드

`restored/modules/ReservedProcedures/처방명.js:239-261` (`// Restored from unminified/ReservedProcedures.vue_vue_type_script_setup_true_lang.js:5287-5519`, 해당 부분 5498-5518)

```js
const Pu = t => Gt.진찰료임(t.수가코드 ?? "") && !ck(t.수가코드);   // 진찰료임: startsWith("10"), ck: 91001~91004

const Uh = t => {
  const { 현재진료, 최근진료기록 } = t;
  const n = (현재진료.기준일시 ?? "").slice(0, 8);
  if (!n || !(현재진료.진료처방 ?? []).some(Pu)) {
    return;
  }
  const d = 현재진료.비대면시범사업여부 === true;
  return 최근진료기록.find(최근진료기록항목$ => 최근진료기록항목$.진료Id !== 현재진료.진료Id && (최근진료기록항목$.기준일시 ?? "").slice(0, 8) === n && 최근진료기록항목$.비대면시범사업여부 === true !== d && (최근진료기록항목$.진료처방 ?? []).some(Pu));
};

const Fh = {
  제목: `동일일자 대면/비대면 진찰료 중 1가지만 산정가능합니다.
1가지만 남겨주세요.`,
  과수납금_확정: "이미 수납이 완료된 진료입니다. 진찰료를 제외하면 과수납금이 발생할 수 있습니다.",
  과수납금_가정: "이미 수납이 완료된 진료라면, 진찰료를 제외할 때 과수납금이 발생할 수 있습니다.",
  확인버튼: "이대로 저장",
  취소버튼: "진찰료 정리하기"
};
```

`restored/components/treatment/TreatmentViewBoard.helpers-10.js:279-308` (`// Restored from unminified/TreatmentViewBoard.js:22369-22665`, 해당 부분 22626-22655)

```js
validate동일일자진찰료중복: async () => {
  const 보험구분$ = 진료내용.value.보험구분;
  if (보험구분$ !== "건보" && 보험구분$ !== "급여") {
    return true;
  }
  const c = Uh({
    현재진료: {
      진료Id: 진료데이터.value?.진료Id,
      기준일시: 진료내용.value.기준일시,
      비대면시범사업여부: 진료내용.value.비대면시범사업여부,
      진료처방: 진료내용.value.처방
    },
    최근진료기록: 최근진료기록.value ?? []
  });
  if (!c) {
    return true;
  }
  const v = (진료내용.value.기준일시 ?? "").slice(0, 8) === format(new Date(), "yyyyMMdd") && [진료데이터.value?.진료Id, c.진료Id].some(m => waitingPatientsData.value?.some(d => d.진료Id === m && d.상태 === "수납완료"));
  return (await o.show(BaseConfirmDialog, {
    title: Fh_2.제목,
    description: v ? Fh_2.과수납금_확정 : Fh_2.과수납금_가정,
    theme: "warning",
    /* ... */
    actionButtonText: Fh_2.확인버튼,
    cancelButtonText: Fh_2.취소버튼
  })) === true;
},
```

## 픽스처

[`test/fixtures/rules/duplicate-consultation-fee.json`](../../../test/fixtures/rules/duplicate-consultation-fee.json) — 18건, 모두 `executed`(기기 시각 2026-11-01 15:00 KST 고정). `proceedSave`가 실제 효과이고 `conflictingRecordId`는 `Uh` 결과입니다(자보·산재는 `Uh`가 찾더라도 검사 전에 통과).

| 케이스 | proceedSave | 확인창 |
|---|---|---|
| 대면 현재 + 같은 날 비대면 진찰료, 이대로 저장 | true | 가정 문구 |
| 같은 상황, 진찰료 정리하기 | false | 가정 문구 |
| 비대면 현재 + 같은 날 대면 진찰료 | true | 있음 |
| 대면+대면 / 비대면+비대면 | true | 없음 |
| 전날 23:59 진료 | true | 없음 |
| 상대가 관리료 91001만 / 현재에 진찰료 없음 | true | 없음 |
| `10400`·`10101`도 진찰료로 판정 | true | 있음 |
| 자보 / 산재 | true | 없음 |
| 급여 | true | 있음 |
| 오늘 + 상대 수납완료 | true | 확정 문구 |
| 지난 날 + 수납완료 | true | 가정 문구 |
| 기준일시 없음 | true | 없음 |
| 비대면 플래그 undefined = 대면 | true | 있음 |
| ZBt: 비대면 + 같은 날 대면 진찰료 | — | T0004 생성, 표시 목록에서 제외 |
| ZBt: 대면 현재 | — | 없음 |

## 서버 이전 시 주의

- **같은 모드 중복은 검사하지 않습니다.** 대면 진료 2건이 같은 날 모두 진찰료를 가져도 클라이언트는 아무 말도 하지 않습니다. 서버 `DUPLICATE_CONSULTATION_FEE`를 "같은 날 진찰료 중복" 전반으로 정의하면 현행보다 넓어집니다.
- **확인 후 통과가 가능합니다.** `docs/design/clinical.md`는 완료 검증 위반으로 적었지만 현행은 사용자가 "이대로 저장"으로 넘어갈 수 있습니다. `acknowledge[]`로 넘길 수 있는 위반으로 두는 것이 현행과 같습니다.
- 진찰료 판정이 "`10`으로 시작"입니다(방문진료료 등 `10` 대역 전체). 자보 규칙의 `10100`/`10200` 접두사와 다릅니다.
- 비교 대상 `최근진료기록`은 진료 화면 스토어 값입니다(건보는 `초진진찰료산정기준일` 일수만큼 조회한 목록). 서버는 같은 날 진료를 직접 조회하면 됩니다.
- 수납 완료 여부는 문구에만 영향을 줍니다. 오늘 날짜 판정은 기기 시각입니다.
- 첫 충돌 진료 하나만 찾습니다.
- 비대면 청구 경고 `T0004`는 계산되지만 화면에 나오지 않습니다. 의도적으로 숨긴 것인지 확인이 필요합니다.
