# 산정특례 특정기호와 상병 일치

## 요약

- **저장·완료 검증:** 건보 진료의 명세서 특정내역에 산정특례 등록번호(`MT014`)가 있고, 그 앞 두 자리가 희귀난치(05)·기타염색체이상(14)·희귀질환(21)·중증난치(23)이면 특정기호(`MT002`)가 공백 제거 후 정확히 4글자여야 합니다. 아니면 "산정특례 접수 환자입니다. 특정기호 상병을 선택해주세요." 대화상자를 띄우고 저장·완료를 멈춥니다.
- **후보 제시:** 상병 검색·입력 시 상병코드가 어느 특정기호의 `연계상병` 범위에 드는지 희귀질환 기준자료(`rareDiseases/20241018.json`)로 찾아 후보를 보여 줍니다. 상병 모달에서 고른 후보는 `MT002`에 반영됩니다.
- 클라이언트는 **고른 특정기호가 상병과 실제로 맞는지는 검증하지 않습니다.** 검증은 "4글자 존재"뿐이고, 일치 판단은 UI 제안입니다.

## 현행 위치

- 검증
  - `restored/components/treatment/TreatmentViewBoard.helpers-10.js` `w6().validate산정특례특정기호`(255-282)
  - 판정 플래그 `특정기호가누락된질환여부`와 선택된 등록번호 `L`: `restored/components/treatment/TreatmentViewBoardEditHeader.vue.js:279-300`
  - 호출
    - 진료 완료 `finishPatientRecord`(`TreatmentViewBoard.helpers-11.js:88`): 늘 검사합니다
    - 저장 `savePatientRecord`(`TreatmentViewBoard.helpers-12.js:60`): `산정특례검증생략: true`면 건너뜁니다. 헤더의 보험 변경 후 저장이 이 옵션을 씁니다(`TreatmentViewBoardEditHeader.vue.js:754-758`)
- 보조 함수: `restored/modules/index/part-103.js`
  - `zg`(153-180): `MT002` 특정기호, `MT014` 등록번호
  - `iin`(194-267): 자격조회 결과에서 산정특례 등록 목록 `{특정기호, 산정특례등록번호, 상병코드?}`을 만듭니다. 결핵은 `V000`, 잠복결핵은 `V010`으로 고정합니다
  - `lin`(317-333): 산정특례 진료인지 판정합니다
  - `dE`(335-367): 등록번호 앞 두 자리 → 질환군 이름
  - `din`(396-406): 특정기호 필수 질환군인지 판정합니다
- 상수 `Dh = "해당없음"`, `Eh = "희귀난치의료비지원"`: `modules/ReservedProcedures/part-9.js:6-8`
- 후보 제시
  - `restored/modules/DiseaseInputDropdown/part-2.js` `Ee`(60-136) → `resolveDiseaseCandidates`. `TreatmentDisease` → `DiseaseInputDropdown`·`DiseaseSearchModal`의 `resolveSpecialCaseCandidates` prop으로 전달됩니다
  - `연계상병` 범위 매처 `ce`: `modules/DiseaseInputDropdown/part-1.js:3-64`
  - 모달에서 고른 값은 `emit("연계특정기호확정")` → 헤더 `setSpecificCode`로 `MT002`에 씁니다
- 읽는 데이터
  - 진료 `보험구분`, `희귀난치의료비지원진료여부`, `명세서특정내역[]`
  - `보험조회`: 건보 자격조회 XML. `rb.convertInsuranceXMLToEntity`로 파싱합니다. 항목 예: `산정특례희귀질환등록대상자: {특정기호, 등록번호}`
  - 희귀상병 데이터(`stores/treatment.js` `희귀상병데이터`): 행마다 `{id, 특정기호코드, 연계상병, 질환명}`

## 로직

### 저장·완료 검증

1. `L` 계산
   - 진료가 없으면 `"해당없음"`
   - `희귀난치의료비지원진료여부`면 `"희귀난치의료비지원"`
   - `lin(명세서특정내역)`이 참이면 `MT014`의 `특정코드내용`(비면 `"해당없음"`)
   - 그 밖에는 `"해당없음"`
2. `lin`은 아래 둘이 **모두** 있어야 참입니다.
   - `MT002` 항목: 내용이 비었거나 소문자로 바꿨을 때 `v`로 시작. 공백을 제거하지 않으므로 `" V101"`은 해당하지 않습니다
   - `MT014` 항목
   - 하나만 있으면 `console.error`만 하고 거짓입니다.
3. `특정기호가누락된질환여부 = 보험구분 === "건보" && L ∉ {해당없음, 희귀난치의료비지원} && din(L.slice(0, 2))`
4. `din(p)`는 `p`가 정확히 2글자이고 `dE(p)`가 `중증난치질환`(23)·`희귀난치질환`(05)·`희귀질환`(21)·`기타염색체이상질환`(14) 중 하나일 때 참입니다. 암(01), 결핵(07/08), 중증화상(09), 극희귀(11), 상세불명희귀(13), 중증치매(15), 잠복결핵(22)은 거짓입니다.
5. 플래그가 거짓이면 통과입니다. 참이면 `MT002` 내용이 있고 `trim().length === 4`일 때만 통과합니다. 문자 구성(예: `V`+숫자 3자리)이나 상병과의 일치는 보지 않습니다.

### 후보 제시 (`Ee` → `resolveDiseaseCandidates(상병코드)`)

1. `활성특정기호`: `MT002` 내용(trim)이 `v`로 시작하고 2글자 이상이면 그 값, 아니면 `""`
2. `f`: `MT014` 내용(trim)
3. `g`: 건보이고 `보험조회`가 있으면 `iin(파싱 결과)`, 아니면 `[]`
4. `h`: 활성특정기호 + (`f`가 있으면 `g` 중 등록번호가 `f`인 것, 없으면 `g` 전체)의 V로 시작하는 특정기호. 모두 대문자로 바꿉니다
5. `D = lin(명세서특정내역) || h.length > 0`. 거짓이면 늘 `[]`입니다.
6. 후보 풀 `E`
   - `v`(`g`에서 고른 등록의 V 특정기호와 일치하는 희귀상병 행)가 있으면 `v`
   - 없고 `f.length ≥ 2 && din(f.slice(0, 2))`이면 **희귀상병 데이터 전체**
   - 없으면 `p`(`h`와 일치하는 행). 그것도 없으면 `[]`
7. `E` 중 `ce(행.연계상병)(상병코드)`가 참인 행의 `특정기호코드`를 중복 없이 `{specificCode, diseaseName}`으로 돌려줍니다.

### `연계상병` 매처 (`ce`)

- 쉼표로 나눈 각 항목에서 `.`을 지우고 대문자·trim합니다. 상병코드도 같게 정규화합니다.
- 단일 코드 `G12.2` → 정확히 같거나 그 코드로 시작(`G122`, `G1221`)하면 일치합니다. `G12`는 불일치입니다.
- 범위 `E70-E72` → 영문 접두가 같고, 상병 숫자부의 앞 n자리(n = 시작 코드 숫자 길이)가 시작~끝 범위 안이면 일치합니다. 숫자부가 n보다 짧으면(`E7`) 불일치입니다.
- 접두가 다른 범위(`Q00-R99`)는 양 끝 코드의 접두 일치로만 처리합니다(`Q00…`, `R99…`만 일치).

## 원본 코드

`restored/components/treatment/TreatmentViewBoard.helpers-10.js:255-262` (`// Restored from unminified/TreatmentViewBoard.js:22369-22665`, 해당 부분은 `:22602-22609`)

```js
validate산정특례특정기호: async () => {
  if (!$editHeaderRef.value?.특정기호가누락된질환여부) {
    return true;
  }
  const 특정코드내용$ = 진료내용.value.명세서특정내역?.find(_ => _.특정내역구분 === zg.명일련단위.특정기호)?.특정코드내용;
  if (특정코드내용$ && 특정코드내용$.trim().length === 4) {
    return true;
  } else {
    // "산정특례 접수 환자입니다.\n특정기호 상병을 선택해주세요." → 확인 시 희귀상병검색모달열기(), return false
```

`restored/components/treatment/TreatmentViewBoardEditHeader.vue.js:279-300` (`// Restored from unminified/TreatmentViewBoard.js:27030-27828`, 해당 부분은 `:27261-27282`)

```js
const L = computed(() => {
  if (!props.진료내용) {
    return Dh;
  }
  const 진료내용$ = props.진료내용;
  if (진료내용$.희귀난치의료비지원진료여부) {
    return Eh;
  } else if (lin(진료내용$.명세서특정내역 ?? [])) {
    return 진료내용$.명세서특정내역?.find(U => U.특정내역구분 === zg.명일련단위.등록번호)?.특정코드내용 || Dh;
  } else {
    return Dh;
  }
});
const 특정기호가누락된질환여부 = computed(() => props.진료내용?.보험구분 !== "건보" || L.value === Dh || L.value === Eh ? false : din(L.value.slice(0, 2)));
```

`restored/modules/index/part-103.js:317-406` (`// Restored from unminified/index.js:79752-80237`, 해당 부분은 `:80034-80118`). `dE`는 줄였습니다.

```js
function lin(e) {
  if (!e) { return false; }
  const t = e.find(r => r.특정내역구분 === zg.명일련단위.특정기호 && (!r.특정코드내용 || r.특정코드내용.toLowerCase().startsWith("v")));
  const n = e.find(r => r.특정내역구분 === zg.명일련단위.등록번호);
  if (t && n) {
    return true;
  } else {
    if (t || n) { console.error("명세서특정내역에 산정특례 질환의 특정기호 또는 등록번호가 누락되었습니다."); }
    return false;
  }
}
// dE: "01" 암, "05" 희귀난치질환, "07"/"08" 결핵, "09" 중증화상, "11" 극희귀질환, "13" 상세불명희귀질환,
//     "14" 기타염색체이상질환, "15" 중증치매, "21" 희귀질환, "22" 잠복결핵, "23" 중증난치질환, 그 외 ""
function din(e) {
  if (e.length) {
    if (e.length !== 2) {
      return console.error("두글자 문자열이 아닙니다.") ?? false;
    } else {
      return dE(e) === "중증난치질환" || dE(e) === "희귀난치질환" || dE(e) === "희귀질환" || dE(e) === "기타염색체이상질환";
    }
  } else {
    return false;
  }
}
```

`restored/modules/DiseaseInputDropdown/part-2.js:95-135` (`// Restored from unminified/DiseaseInputDropdown.vue_vue_type_script_setup_true_lang.js:72-198`). 후보 풀 선택과 매칭 부분입니다.

```js
const d = computed(() => f.value.length >= 2 && din(f.value.slice(0, 2)));
const p = computed(() => {
  if (h.value.length === 0) { return []; }
  const s = new Set(h.value);
  return (희귀상병데이터.value ?? []).filter(l => s.has((l.특정기호코드 ?? "").trim().toUpperCase()));
});
const v = computed(() => {
  const s = f.value ? g.value.filter(r => (r.산정특례등록번호 ?? "").trim() === f.value) : g.value;
  const l = new Set(s.map(r => (r.특정기호 ?? "").trim()).filter(r => K(r)).map(r => r.toUpperCase()));
  if (l.size === 0) { return []; }
  return (희귀상병데이터.value ?? []).filter(r => l.has((r.특정기호코드 ?? "").trim().toUpperCase()));
});
const _ = computed(() => {
  const s = new Map();
  (희귀상병데이터.value ?? []).forEach(r => s.set(r.id, ce(r.연계상병 ?? "")));
  return s;
});
const D = computed(() => lin(명세서특정내역$.value) || h.value.length > 0);
const E = computed(() => v.value.length > 0 ? v.value : d.value ? 희귀상병데이터.value ?? [] : p.value.length > 0 ? p.value : []);
return {
  resolveDiseaseCandidates: s => {
    if (!D.value) { return []; }
    const l = E.value.filter(y => _.value.get(y.id)?.(s) ?? false);
    if (l.length === 0) { return []; }
    return [...new Set(l.map(y => y.특정기호코드))].map(y => ({
      specificCode: y,
      diseaseName: l.find(M => M.특정기호코드 === y)?.질환명 ?? ""
    }));
  },
  활성특정기호
};
```

## 픽스처

[`test/fixtures/rules/special-case-code-match.json`](../../../test/fixtures/rules/special-case-code-match.json): 64건, 모두 `executed`입니다.

- 검증 22건: 원본 `L`·`특정기호가누락된질환여부`·`validate` 본문을 하네스에 옮기고, 원본 `lin`/`din`/`zg`/`Dh`/`Eh`를 import해 실행했습니다. 대화상자는 뺐습니다.
- 질환군 13건: `dE`/`din`
- 범위 매처 20건: `ce`
- 후보 9건: `Ee`. Vue `computed`는 실제 vue로 돌렸습니다. `rb.convertInsuranceXMLToEntity`는 항등 함수로 대체해 `보험조회`에 파싱된 객체를 바로 넣었습니다. 희귀상병 행은 가상 값입니다.

| 상황 | 결과 |
| --- | --- |
| 건보, `MT014=21…`, `MT002=V101` | 통과 |
| 건보, `MT014=21…`, `MT002=""` / `"V12"` / `"V1234"` | 실패 |
| 건보, `MT014=21…`, `MT002="v101"` | 통과 (대소문자 무관) |
| 건보, `MT014=21…`, `MT002=" V101 "` / `"H101"` / 항목 없음 | 검사 생략(통과): `lin` 거짓 |
| 건보, 05 / 14 / 23 등록번호, `MT002=""` | 실패 |
| 건보, 01 / 07 / 11 / 13 / 15 등록번호, `MT002=""` | 통과 (검사 대상 아님) |
| 자보·급여, 21 등록번호, `MT002=""` | 통과 |
| 희귀난치의료비지원진료 | 통과 |
| `ce("E70-E72")`: `E71.5` / `E73` / `E7` | 일치 / 불일치 / 불일치 |
| `ce("Q00-R99")`: `Q55` | 불일치 (접두가 다른 범위) |
| 등록 V101, 상병 `G12.2` / `I10` | `[V101]` / `[]` |
| 등록 V999(자료에 없음), 등록번호 21, 상병 `E71` | `[V102, V103]` (전체 자료로 대체) |
| 같은 조건, 등록번호 01 | `[]` |
| 자보, `MT002=V102`만, 상병 `E72` | `[V102]` |
| 등록 두 개, `MT014`로 두 번째 선택 | 두 번째 등록의 특정기호만 |

## 서버 이전 시 주의

- **"일치" 검증은 현행에 없습니다.** 설계 문서의 `SPECIAL_CASE_CODE_MISMATCH`(특정기호와 상병 일치)는 새 규칙입니다. 현행은 4글자 존재만 검사합니다. 서버에서 일치를 강제하려면 희귀질환 기준자료(`특정기호코드` ↔ `연계상병`)와 `ce` 범위 규칙을 서버로 옮겨야 합니다. 그 기준자료는 클라이언트 정적 JSON(`/rareDiseases/20241018.json`)이고 버전 선택이 없습니다.
- **극희귀(11)·상세불명희귀(13) 누락.** 이름상 희귀질환인데 `din`에 없어 검사하지 않습니다. 의도인지 확인이 필요합니다.
- **`lin`의 공백·접두 처리.** `MT002` 앞에 공백이 있거나 V가 아닌 코드면 산정특례 진료로 보지 않고 검사를 통째로 건너뜁니다. 반면 4글자 검사는 trim 후 길이를 봅니다.
- **자격조회 의존.** 후보 계산은 클라이언트가 저장해 둔 건보 자격조회 XML(`보험조회`)을 파싱한 결과에 의존합니다. 서버로 옮기면 같은 파싱(`convertInsuranceXMLToEntity`, `iin`)이 필요합니다.
- **전체 자료로 대체.** 등록된 특정기호가 기준자료에 없고 등록번호가 05·14·21·23이면 모든 희귀질환 행이 후보가 됩니다. 실제로 등록되지 않은 특정기호가 제안될 수 있습니다.
- **접두가 다른 범위.** `Q00-R99` 같은 범위는 사실상 양 끝 코드만 맞습니다. 기준자료에 이런 범위가 있는지 확인이 필요합니다.
- **검증 시점 차이.** 완료는 늘 검사하고, 저장은 보험 변경 직후에 생략합니다. 서버를 완료 시점 규칙으로만 둘지 정해야 합니다.
- **건보만 대상.** `급여`(의료급여) 진료는 등록번호가 있어도 검사하지 않습니다.
