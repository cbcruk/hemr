# 기준정보 버전 선택 (진료일 기준)

## 요약

- 진료일에 맞는 기준정보 버전을 고릅니다. 방식은 두 가지가 섞여 있습니다.
- **정적 JSON(KCD 상병, KOICD 상병 트리, 자보 수가):** 클라이언트에 박힌 `2026-01-01` 기준으로 둘 중 하나를 고릅니다. 이전이면 구버전(`kcd/20250722`, `koicd/20240829`, `jaboReimbursement/20250108`), 당일 이후면 `20260101`입니다.
- **건보 수가 마스터:** 서버의 `적용일자목록`에서 진료일 이하인 가장 늦은 날짜를 고르고, 그 날짜로 수가 목록을 받습니다.
- 진료일이 모든 적용일자보다 이르면 가장 이른 적용일자로 대체합니다. 목록이 비면 빈 문자열입니다.

## 현행 위치

- `re-upstream/restored/modules/index/useKcd20260101JsonQuery.js`
  - `O0`(10-23): 정적 JSON 버전 결정
  - `useKcd20260101JsonQuery`, `useKoicd20260101JsonQuery`, `useJaboReimbursement20260101JsonQuery`(25-64)
  - 같은 이름의 색인 버전: `modules/index/useJaboReimbursement20260101JsonQuery.js`. 자보 수가를 `byCode`로 색인하고 `prefetch…`로 미리 받습니다
- `re-upstream/restored/api/settings/requests-7.js:6-10`: 버전 문자열이 `"20260101"`이면 새 파일, 아니면 구파일을 `staticClient`로 받습니다. 경로 상수는 `modules/index/KOICD_20240829_JSON_PATH.js`에 있습니다.
- `re-upstream/restored/modules/index/part-169.js`
  - `jQ`(42-57): 문자열에서 숫자만 남겨 앞 8자리를 숫자로 바꿉니다
  - `qF`(73-100): 적용일자 선택
  - `sge`(146-176): 컴포넌트용 훅. `reimbursementQueryDate = qF(기준일시, 적용일자목록)`로 `useSettingsReferencesReimbursementCodesQuery({적용일자})`를 부릅니다
  - `Lln`(105-142): 같은 선택을 비동기로 합니다(`ensureReimbursementCodesIndexed`). 빈 결과면 `"수가 조회 가능한 적용일자가 없습니다."` 예외를 던집니다
- API
  - `GET /settings/references/reimbursement-available-dates` → `results.적용일자목록`
  - `GET /settings/references/reimbursement-codes?적용일자=` → `results.수가코드목록`
- 호출 화면
  - 기준일시를 넘기는 곳: 진료 상병 입력(`TreatmentDisease`, `DiseaseInputDropdown`, `TreatmentViewBoardEditHeader`), 처방 검색(`PrescriptionInputSearch*`), 자보·산재 처방 행, `TreatmentPayment` 등 진료 화면 대부분
  - 기준일시 없이 부르는 곳(항상 오늘 기준): `DiseaseSearchModal`(KOICD 트리), `ReservedDisease`, `DocumentDiseaseSearchModal`, `DocumentDiseaseSelector`, `TreatmentViewBoardChubyakDiseaseAdd`, `TreatmentViewBoardPatientInfoNhicChubyakModal`, `PatientHealthInsuranceEligibilityTable`, `PrescriptionInputSearchCrm`, 설정 화면 템플릿 편집

## 로직

### 정적 JSON (`O0`)

1. 기준일시가 있으면 `parse(기준일시, "yyyyMMddHHmm")`, 없으면 `new Date()`(지금)를 씁니다.
2. 컷오프 `r = startOfDay(new Date("2026-01-01"))`를 만듭니다. `new Date("2026-01-01")`은 **UTC 자정**이고, `startOfDay`는 로컬 시간대로 자릅니다.
3. `startOfDay(진료일) < r`이면 `undefined`(구버전), 아니면 `"20260101"`입니다.
4. 파싱할 수 없는 기준일시(예: 8자리 `"20251231"`)는 Invalid Date가 됩니다. 비교가 `false`라 `"20260101"`을 고릅니다.

### 건보 수가 적용일자 (`qF`)

1. `적용일자목록`의 각 값을 `jQ`로 숫자로 바꿉니다. 숫자가 없는 값은 버립니다. 숫자 순으로 정렬하되 반환값은 **원래 문자열**입니다.
2. 목록이 비면 `""`를 돌려줍니다.
3. 기준일시도 `jQ`로 바꿉니다. 숫자만 남겨 앞 8자리(`yyyyMMdd`)를 씁니다. 결과가 `null`(빈 값·숫자 없음)이면 가장 늦은 날짜를 돌려줍니다.
4. 정렬된 목록을 앞에서부터 보며 `날짜 ≤ 진료일`인 마지막 값을 고릅니다.
5. 해당 값이 없으면(진료일이 모든 날짜보다 이름) 가장 이른 날짜를 돌려줍니다.

## 원본 코드

`re-upstream/restored/modules/index/useKcd20260101JsonQuery.js:10-23` (`// Restored from unminified/index-CBEIvlV0.js:101227-101282`, 함수는 `unminified/index-CBEIvlV0.js:101231-101244`). `Ts`는 date-fns `startOfDay`, `$f`는 `isBefore`입니다.

```js
function O0(e) {
  let t;
  if (e) {
    t = parse(e, "yyyyMMddHHmm", new Date());
  } else {
    t = new Date();
  }
  const n = Ts(t);
  const r = Ts(new Date("2026-01-01"));
  if ($f(n, r)) {
    return undefined;
  } else {
    return "20260101";
  }
}
```

`re-upstream/restored/api/settings/requests-7.js:6-10` (`// Restored from unminified/index-CBEIvlV0.js:101005-101026`)

```js
const getKoicd20260101Json = async input => input && input === "20260101" ? (await staticClient.get(KOICD_20260101_JSON_PATH)).data || [] : (await staticClient.get(KOICD_20240829_JSON_PATH)).data || [];
const getKcd20260101Json = async input => input && input === "20260101" ? (await staticClient.get(KCD_20260101_JSON_PATH)).data || [] : (await staticClient.get(KCD_20250722_JSON_PATH)).data || [];
const getJaboReimbursement20260101Json = async input => input && input === "20260101" ? (await staticClient.get(JABO_REIMBURSEMENT_20260101_JSON_PATH)).data || [] : (await staticClient.get(JABO_REIMBURSEMENT_20250108_JSON_PATH)).data || [];
```

`re-upstream/restored/modules/index/part-169.js:42-100` (`// Restored from unminified/index-CBEIvlV0.js:101055-101215`, 함수는 `unminified/index-CBEIvlV0.js:101085-101144`)

```js
const jQ = e => {
  if (!e) { return null; }
  const t = e.replace(/\D/g, "");
  if (!t) { return null; }
  const n = t.length > 8 ? t.slice(0, 8) : t;
  const r = Number(n);
  if (Number.isFinite(r)) { return r; } else { return null; }
};

function qF(e, t) {
  const n = new Map();
  for (const l of t) {
    const u = jQ(l);
    if (u !== null) { n.set(l, u); }
  }
  const r = Array.from(n.entries()).sort((l, u) => l[1] - u[1]).map(([l]) => l);
  if (r.length === 0) { return ""; }
  const s = r.at(-1) || "";
  const i = r.at(0) || "";
  const o = jQ(e);
  if (o === null) { return s; }
  let a = "";
  for (const l of r) {
    const u = n.get(l);
    if (u !== undefined) {
      if (u <= o) { a = l; continue; }
      break;
    }
  }
  return a || i;
}
```

## 픽스처

[`test/fixtures/rules/reference-version-selection.json`](../../../test/fixtures/rules/reference-version-selection.json): 24건, 모두 `executed`입니다. `O0`는 TZ=Asia/Seoul로 8건, America/Los_Angeles로 2건(시간대 버그 재현) 실행했습니다. `qF`는 14건입니다.

| 함수 | 입력 | 결과 |
| --- | --- | --- |
| O0 (KST) | `202512312359` / `202512310000` | `null`(구버전) |
| O0 (KST) | `202601010000` / `202601010859` / `202703011000` | `"20260101"` |
| O0 (KST) | `20251231`(8자리, 파싱 불가) | `"20260101"` |
| O0 (LA) | `202512312359` / `202512310000` | `"20260101"` (컷오프가 하루 당겨짐) |
| qF | `20250401`, 목록 `[20250101, 20250401, 20260101, 20250701]` | `20250401` |
| qF | `20250630` / `20251231` | `20250401` / `20250701` |
| qF | `20260101` / `202601010000` | `20260101` |
| qF | `20271231` | `20260101` (가장 늦은 값) |
| qF | `20241231` | `20250101` (가장 이른 값으로 대체) |
| qF | `""` / `"abc"` | `20260101` (가장 늦은 값) |
| qF | 빈 목록 | `""` |
| qF | 목록 `["2025-01-01","2025-04-01"]`, `20250415` | `"2025-04-01"` (원래 문자열 그대로) |

## 서버 이전 시 주의

- **하드코딩 컷오프.** 정적 기준정보는 날짜 하나로 두 버전만 나눕니다. 새 고시가 나올 때마다 함수와 경로를 새로 만들어야 합니다. 서버는 버전 테이블(적용 시작일 → 파일/데이터셋)로 바꾸는 편이 맞습니다. 다만 현행 동작은 "진료일 < 2026-01-01이면 구버전"입니다.
- **시간대 버그.** `new Date("2026-01-01")`은 UTC 기준이라 UTC보다 서쪽 시간대에서는 컷오프가 2025-12-31 로컬로 당겨집니다. KST에서는 맞게 동작합니다. 서버는 Asia/Seoul 날짜로 명시해야 합니다.
- **파싱 실패 시 새 버전.** `yyyyMMddHHmm`이 아닌 기준일시는 조용히 2026 버전을 고릅니다.
- **오늘 기준 화면.** 기준일시 없이 부르는 화면은 과거 진료를 편집해도 오늘 버전을 씁니다. 특히 `DiseaseSearchModal`의 KOICD 트리와 `TreatmentDisease`의 KCD(진료일 기준)가 다른 버전일 수 있습니다.
- **수가 적용일자 대체.** 진료일이 서버의 가장 이른 적용일자보다 이르면 오류 대신 가장 이른 마스터를 씁니다. 서버로 옮길 때 거부할지 정해야 합니다.
- **적용일자 형식.** `qF`는 목록의 원래 문자열을 돌려주고, 그 값이 그대로 `reimbursement-codes?적용일자=`에 들어갑니다. 서버가 주는 `적용일자목록` 항목의 실제 형식(`yyyyMMdd` 여부)은 클라이언트 코드만으로는 확인되지 않습니다.
- **두 축의 불일치.** 자보 수가는 정적 JSON(2026-01-01 컷오프), 건보 수가는 서버 적용일자로 버전을 고릅니다. 같은 진료일이라도 두 기준이 다를 수 있습니다.
