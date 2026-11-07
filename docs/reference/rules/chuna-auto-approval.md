# 추나 심평원 자동 승인(제출)

## 요약

- 진료 완료(저장 → `done`) 직후, 병원 설정 `진료설정.추나승인자동승인여부`가 켜져 있고 데스크톱 앱이면 처방의 **첫 번째 미승인 추나 라인**을 심평원에 제출하고 라인을 승인 상태로 바꿉니다.
- 건너뛰는 경우: 추나 이력 조회가 로딩 중이거나 오류, 연간 한도 소진(경고 토스트), 진료일과 같은 날 이력이 이미 있음(삭제 행 포함, 조용히), 미승인 추나 라인 없음, 제출 잠금 획득 실패, 기제출 조회 실패.
- 심평원에 같은 날 제출 건이 이미 있으면 새로 제출하지 않고, 그 건의 상병기호가 현재 상병에 모두 포함될 때만 라인을 승인 상태로 맞춥니다.
- 필수 정보(상병, 환자 이름·주민번호, 시술자 면허번호, 진료일시, 요양기관기호, 보험자구분코드, 자보 사고접수번호, 건보 자격조회)가 없으면 오류 토스트만 띄웁니다. 완료 자체는 이미 끝난 뒤라 되돌리지 않습니다.

## 현행 위치

- `restored/components/treatment/TreatmentViewBoard.helpers-2.js:53-130` `AV().autoApproveChuna`.
- `restored/components/treatment/TreatmentViewBoard.helpers-11.js:68-82` 완료 흐름: `checkNhicChubyakApproval` → `savePatientRecord({ 진찰료중복안내: true })` → `PATCH done` → `n.autoApproveChuna()`(await 하지 않음).
- `restored/modules/TreatmentViewBoard/part-16.js:192-262` 제출 페이로드 `MV`, 263-319 승인 상태 반영 `DV`(`POST /record/hira/prescriptions/approval {진료처방Ids, 승인여부: true}`, 시술자가 바뀌면 처방 PATCH).
- `restored/components/treatment/TreatmentViewBoard.helpers-3.js` `KV`: `진료일시`(기준일시 파싱), `fetch추나제출건조회`(심평원 병원별 추나요법 목록을 진료일 하루로 조회 후 `hiraChuna.B`로 매칭), `get추나ProcessingKeyParams`, `get기본추나시술자Id`.
- `restored/modules/hiraChuna.js:5-39` 제출 건 매칭 `B`, 상병 포함 검사 `_`.
- `restored/api/chart/query-keys.js:17-81` 공상구분코드 `w`.
- 한도·당일 판정은 [chuna-annual-limit.md](chuna-annual-limit.md)의 `tLt` 결과를 씁니다.

## 로직

1. `!isElectron || !추나승인자동승인여부 || isLoading || isError` → 종료.
2. `추나횟수소진 === true` → 경고 "추나요법 연간 시술 가능 횟수(20회)를 모두 사용해 자동 제출하지 않았습니다." 후 종료. `undefined`면 진행.
3. `진료일시`가 있고 `추나조회기록.조회목록` 중 `isSameDay(시술일, 진료일시)`인 행이 있으면 종료. **`삭제여부`를 보지 않습니다.**
4. 처방에서 카테고리 `33001005`이고 `!승인여부`인 첫 라인 `w`. 없거나 `수가코드`가 없으면 종료.
5. 시술자 = `w.시술진료의Id || 기본추나시술자Id`, 면허번호 = 의사 목록에서 찾은 값.
6. `MV`로 페이로드 생성. 순서대로 검사하고 처음 실패한 메시지를 오류 토스트로 띄우고 종료:
   - 상병 없음 → "상병 정보가 없기 때문에 추나 승인을 진행할 수 없습니다."
   - 수진자명·주민번호 앞/뒤 없음 → "환자 정보가 …", 면허번호 없음 → "시술자 정보가 …", 진료일시 없음 → "진료일시가 …", 요양기관기호 없음 → "요양기관기호가 …"
   - `보험자구분코드 = F7t(보험구분, 자격여부)`: 자보 `"8"`, 자격여부 없으면 건보 `"4"`·급여 `"5"`·그 외 null, 자격여부 `"1"`~`"6"` → `"4"`, `"7"`·`"8"` → `"5"`. null이면 "보험 종류가 올바르지 않기 때문에 …"
   - 페이로드: `요양기관기호, 수진자명, 수진자주민등록번호(앞+뒤), 의사면허번호, 상병기호[], 진료일자 yyyyMMdd, 보험자구분코드, 의료급여종별코드(자격여부 "7" → "1", "8" → "2"), 수가코드: [w.수가코드]`.
   - 자보: `사고접수번호`가 있으면 추가, 없으면 "사고접수번호가 없기 때문에 …". 그 외: `건강보험조회`가 있으면 `공상구분코드 = w(...)`, 없으면 "건강보험 조회 정보가 없습니다."
   - `공상구분코드`: 차상위대상자(21자: 특정기호 4, 시작일 8, 종료일 8, 구분 1)가 진료일에 유효하면 `C…` → `"C"`, `E…`이고 장애 `"Y"` → `"F"`, `E…` → `"E"`. 아니면 희귀난치(20자: 특정기호 4, 승인일 8, 종료일 8)가 `H…`이고 진료가 `희귀난치의료비지원진료여부 === true`이며 유효하면 `"H"`. 그 밖 `"0"`.
7. 제출 잠금(`hiraSubmissionStore.startProcessing(key, "submit")`)을 못 얻으면 종료. 이후 단계는 끝에 잠금을 풉니다.
8. 기제출 조회 `fetch추나제출건조회()` 예외 → 콘솔만 남기고 종료.
9. 기제출 건이 있으면: `상병기호`(쉼표 분리)가 모두 현재 상병코드에 있으면 그 건의 면허번호로 의사를 찾아 승인 상태 반영(의사를 못 찾으면 시술자 없이 반영). 아니면 아무것도 안 함. 종료.
10. 없으면 `createChunaData(payload)`. 오류나 응답 없음 → "추나 승인 중 오류가 발생했습니다." 성공 → 이력 쿼리 무효화, 라인을 `승인여부: true` + 시술자로 반영.

기제출 건 매칭 `B`: `삭제여부 === "N"` 행 중 `진료일자-수진자명(공백 제거)-생년월일-성별-보험자구분코드-사고접수번호`가 일치하는 행의 `일련번호` 최댓값. 없으면 보험자구분코드를 뺀 키로 다시 찾되, 후보들의 보험자구분코드가 한 종류일 때만 그중 최댓값, 아니면 null.

## 원본 코드

`restored/components/treatment/TreatmentViewBoard.helpers-2.js:53-130` (`// Restored from unminified/TreatmentViewBoard.js:19423-19540`, 해당 부분 19462-19538)

```js
autoApproveChuna: async () => {
  if (!isElectron || !data_2.value?.진료설정?.추나승인자동승인여부 || isLoading.value || isError.value) {
    return;
  }
  if (추나횟수소진.value === true) {
    i.warning(`추나요법 연간 시술 가능 횟수(${Z7t}회)를 모두 사용해 자동 제출하지 않았습니다.`);
    return;
  }
  const 진료일시$ = 추나.진료일시.value;
  if (!!진료일시$ && !!추나조회기록.value.조회목록?.some(L => gle(L.시술일, 진료일시$))) {
    return;
  }
  const w = 진료내용.value.처방.find(처방항목$ => OM(처방항목$, "추나") && !처방항목$.승인여부);
  if (!w?.수가코드) {
    return;
  }
  const 시술자Id$ = w.시술진료의Id || 추나.get기본추나시술자Id();
  const 면허번호$ = 추나.doctorList.value?.find(L => L.진료의Id === 시술자Id$)?.면허번호;
  const b = MV({ 추나수가코드: w.수가코드, 상병코드목록: (진료내용.value.상병 ?? []).map(L => L.상병코드), /* 환자·진료·보험 필드 */ });
  if (!b.성공) {
    i.error(b.안내);
    return;
  }
  const R = 추나.get추나ProcessingKeyParams();
  if (!R || !hiraSubmissionStore$.startProcessing(R, "submit")) {
    return;
  }
  const B = { id: w.id, 수가코드: w.수가코드 };
  try {
    let L = null;
    try {
      L = await 추나.fetch추나제출건조회();
    } catch (error) {
      console.error("추나 자동승인 기제출 조회 실패 — 자동승인을 건너뜁니다:", error);
      return;
    }
    if (L) {
      if (__2(L, 진료내용.value.상병.map(상병항목$ => 상병항목$.상병코드))) {
        const V = 추나.doctorList.value?.find(N => N.면허번호 === L?.의사면허번호);
        await 승인상태반영(B, V?.면허번호 ? { 시술자Id: V.진료의Id, 면허번호: V.면허번호 } : null);
      }
      return;
    }
    const [T, C] = await createChunaData(b.payload);
    if (C || !T) {
      i.error("추나 승인 중 오류가 발생했습니다.");
      return;
    }
    invalidate();
    await 승인상태반영(B, { 시술자Id: 시술자Id$, 면허번호: b.payload.의사면허번호 });
  } finally {
    hiraSubmissionStore$.endProcessing(R);
  }
}
```

`restored/modules/hiraChuna.js:28-35` (`// Restored from unminified/hiraChuna.js:12-55`)

```js
const i = e => e.상병기호.split(",").map(n => n.trim()).filter(Boolean);
const y = (e, n) => {
  const s = new Set(n);
  return e.every(t => s.has(t));
};
const _ = (e, n) => y(i(e), n);
```

## 픽스처

[`test/fixtures/rules/chuna-auto-approval.json`](../../../test/fixtures/rules/chuna-auto-approval.json) — 27건, 모두 `executed`. `expected.actions`는 부수효과 순서입니다.

| 케이스 | 결과 |
|---|---|
| 건보 정상 | 기제출 조회 → 제출(공상구분 `"0"`) → 무효화 → 승인 반영 |
| 웹 / 설정 꺼짐 / 로딩 / 조회 오류 | 아무것도 안 함 |
| 한도 소진 | 경고 토스트만 |
| 한도 undefined | 진행 |
| 같은 날 이력 있음 / 같은 날 삭제 행만 있음 | 조용히 건너뜀 (둘 다) |
| 전날 이력만 (00:05 진료) | 진행 |
| 미승인 추나 없음 | 아무것도 안 함 |
| 상병 없음 / 면허번호 없음 / 자보 사고접수번호 없음 / 건보 자격조회 없음 | 각 오류 토스트 |
| 라인 시술자 없음 | 기본 시술자(d2, L-222)로 제출 |
| 잠금 실패 | 건너뜀 |
| 기제출 조회 예외 | 건너뜀(잠금 해제만) |
| 기제출 건 상병 부분집합 / 불일치 | 승인 반영만 / 아무것도 안 함 |
| 제출 오류 | 오류 토스트 |
| 자보 | 보험자구분 `"8"`, `사고접수번호` 포함, 공상구분 없음 |
| 급여 자격 `"7"` | 보험자구분 `"5"`, 의료급여종별 `"1"` |
| 차상위 `C` 유효 | 공상구분 `"C"` |
| 매칭 `B` 3건 | 최댓값 일련번호·삭제 제외 / 보험자구분 무시 폴백 / 모호하면 null |

## 서버 이전 시 주의

- 현행은 완료 뒤에 클라이언트가 비동기로 부르며 실패해도 완료는 유지됩니다. 재설계는 완료 트랜잭션 안에서 `hiraSubmissions[]`를 `QUEUED`로 만들고 데스크톱 에이전트가 처리합니다(`docs/design/clinical.md` 완료 커맨드 4단계). 큐 생성 조건이 위 1~4단계, 페이로드 검증이 6단계입니다.
- **같은 날 이력 검사가 삭제 행도 포함합니다.** 취소된 제출이 있는 날은 자동 제출이 다시 되지 않습니다. 의도인지 확인이 필요합니다.
- 첫 미승인 추나 라인 하나만 제출합니다(`find`).
- 한도 소진 판정이 데스크톱 앱 실시간 조회 결과에 의존합니다. 서버는 저장된 심평원 결과로 판정해야 하므로 시점이 다를 수 있습니다.
- 기제출 건의 상병이 현재 상병과 다르면 아무 안내 없이 끝납니다.
- 자보도 같은 20회 소진 판정으로 자동 제출을 멈춥니다(사고 단위 목록). 자보에 20회 한도가 있는지 확인이 필요합니다.
- 실패 메시지가 사용자 토스트입니다. 서버에서는 제출 작업 상태(`REJECTED`)와 사유로 바꿔야 합니다.
