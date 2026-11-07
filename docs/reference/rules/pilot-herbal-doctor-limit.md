# 첩약 시범사업 의사별 처방 한도

## 요약

- 진료의 한 명의 건보 첩약(첩건) 승인 횟수가 하루 8 / 월 60 / 연 600을 **초과**하면(`>`) 본인부담률구분코드를 `U`(본인 전액부담)로 바꿉니다.
- 한도 초과 시 경고 문구를 보여 줍니다. 우선순위는 일 → 월 → 연입니다.
- 남은 처방 가능 횟수(`한도 - 사용`)를 화면에 표시합니다. 초과하면 음수가 그대로 나옵니다.
- 횟수 자체는 서버가 셉니다. 클라이언트는 비교만 합니다.

## 현행 위치

- `restored/modules/index/첩건본인부담률구분코드.js`
  - 상수 `_U = 8`, `SU = 60`, `xU = 600` (677-681)
  - `HLt` 한도 초과 여부 (699-703), `Edn` 남은 횟수 (745-749), `Tdn` 경고 문구 (751-763), `$dn` 본인부담률구분코드 결정 (765-818)
- `restored/modules/DeskPatientRegister/part-4.js` 컴포저블 `kc` (13-153)
  - `useRecordListPcmdCountDoctorByDateAndDoctorIdQuery({ date: 오늘, doctorId: 진료의Id })`로 횟수를 받습니다.
  - `watch(첩건기간별진료횟수)`: `HLt`가 참이면 즉시 `첩건본인부담률구분코드 = "U"`.
  - `watch(첩건질환코드, immediate)`: `$dn` 결과로 본인부담률구분코드와 `본인일부부담이지만전액부담선택가능함`을 설정합니다.
- 호출 화면
  - 접수: `HealthInsuranceEligibilityPilotChubyak` (자격조회 영역의 첩건 질환·본인부담 선택)
  - 진료: `TreatmentViewBoardPatientInfoNhicChubyakModal` (건보 첩약 추가/변경 모달). `"원장 처방 가능 횟수 일/월/년"`과 `Tdn` 문구를 표시합니다.
- API: `GET /record/list/pcmd-count/{yyyyMMdd}/doctor/{doctorId}` → `data.results.한방첩약시범사업승인횟수` = `{ 일, 월, 년 }` (`restored/api/record/records.js:17`)

## 로직

입력 `기간별진료횟수 = { 일, 월, 년 }`(서버가 센 해당 진료의의 첩약 시범사업 **승인** 횟수).

1. `HLt`: `일 > 8 || 월 > 60 || 년 > 600`. 정확히 8/60/600은 한도 이내입니다. 비교는 JS `>`라 숫자 문자열(`"9"`)도 숫자로 비교되고, 필드가 없으면(`undefined`) 초과가 아닙니다.
2. `Edn`: `{ 일: 8 - 일, 월: 60 - 월, 년: 600 - 년 }`. 하한 처리 없음(초과 시 음수). 호출부는 누락 필드를 0으로 채웁니다.
3. `Tdn`: 횟수가 없으면 `undefined`. 그 외에는 순서대로
   - `일 > 8` → `"오늘 원장님의 처방 가능 횟수가 초과됐습니다."`
   - `월 > 60` → `"이번달 원장님의 처방 가능 횟수가 초과됐습니다."`
   - `년 > 600` → `"올해 원장님의 처방 가능 횟수가 초과됐습니다."`
   - 아니면 `""`
4. `$dn({ code, 질환별총투여일수조회결과, 기간별진료횟수 })`
   - 세 입력 중 하나라도 없으면 `undefined` (호출부는 값을 바꾸지 않음). 빈 배열 `[]`은 "있음"입니다.
   - `HLt`가 참이면 환자 이력과 무관하게 `{ 첩건본인부담률구분코드: "U", 본인일부부담이지만전액부담선택가능함: false }`.
   - 한도 이내이면 누적 투약 이력 규칙으로 넘어갑니다 ([pilot-herbal-diagnosis-limit.md](pilot-herbal-diagnosis-limit.md)).

본인부담률구분코드 값: `G` 본인 일부부담(30/100), `U` 본인 전액부담(100/100), `Z`(조회용, 전체).

## 원본 코드

`restored/modules/index/첩건본인부담률구분코드.js:677-818` (`// Restored from unminified/index.js:121672-123969`, 해당 부분은 `unminified/index.js:122310-122442`)

```js
const _U = 8;
const SU = 60;
const xU = 600;

const HLt = ({ 일, 월, 년 }) => 일 > _U || 월 > SU || 년 > xU;

const Edn = e => ({
  일: _U - e.일,
  월: SU - e.월,
  년: xU - e.년
});

const Tdn = e => {
  if (e) {
    if (e.일 > _U) {
      return "오늘 원장님의 처방 가능 횟수가 초과됐습니다.";
    } else if (e.월 > SU) {
      return "이번달 원장님의 처방 가능 횟수가 초과됐습니다.";
    } else if (e.년 > xU) {
      return "올해 원장님의 처방 가능 횟수가 초과됐습니다.";
    } else {
      return "";
    }
  }
};

const $dn = e => {
  const { code, 질환별총투여일수조회결과, 기간별진료횟수 } = e;
  if (!code || !질환별총투여일수조회결과 || !기간별진료횟수) {
    return;
  }
  if (HLt(기간별진료횟수)) {
    return {
      첩건본인부담률구분코드: 첩건본인부담률구분코드$.U,
      본인일부부담이지만전액부담선택가능함: false
    };
  }
  // ...이하 누적 투약 이력 분기 (pilot-herbal-diagnosis-limit.md)
};
```

`restored/modules/DeskPatientRegister/part-4.js:34-65` (`// Restored from unminified/DeskPatientRegister.vue_vue_type_style_index_0_lang.js:1431-1575`)

```js
const { data: 첩건기간별진료횟수 } = useRecordListPcmdCountDoctorByDateAndDoctorIdQuery(() => ({
  date: format(new Date(), "yyyyMMdd"),
  doctorId: toValue(e).진료의Id
}));
// ...
watch(첩건기간별진료횟수, b => {
  if (b && HLt(b)) {
    첩건본인부담률구분코드.value = 첩건본인부담률구분코드$.U;
  }
});
```

## 픽스처

[`test/fixtures/rules/pilot-herbal-doctor-limit.json`](../../../test/fixtures/rules/pilot-herbal-doctor-limit.json) — 29건, 모두 원본 함수 실행(`executed`).

| 함수 | 입력 | 결과 |
|---|---|---|
| `HLt` | `{8,60,600}` / `{7,..}` / `{0,59,0}` / `{0,0,599}` | `false` |
| `HLt` | `{9,0,0}` / `{0,61,0}` / `{0,0,601}` | `true` |
| `HLt` | `{"9","0","0"}` | `true` (문자열 강제 변환) |
| `HLt` | `{}` | `false` |
| `Edn` | `{8,60,600}` → `{0,0,0}`, `{9,61,601}` → `{-1,-1,-1}` | |
| `Tdn` | `undefined` → `undefined`, `{8,60,600}` → `""`, `{9,61,601}` → 오늘 문구, `{8,61,601}` → 이번달 문구, `{8,60,601}` → 올해 문구 | |
| `$dn` | 한도 초과 + 어떤 이력이든 | `U`, 전액부담 선택 불가 |
| `$dn` | `{8,60,600}` + 이력 없음 | `G`, 전액부담 선택 가능 |
| `$dn` | 횟수·이력·질환코드 중 하나 없음 | `undefined` |

## 서버 이전 시 주의

- **기준 날짜:** 횟수 조회 날짜는 브라우저의 오늘(`new Date()`)입니다. 진료 `기준일시`가 아닙니다. 과거 날짜 차트를 수정하면 오늘 기준 횟수로 판정합니다. 서버는 `serviceAt` 기준으로 할지 결정해야 합니다.
- **자기 자신 포함 여부:** 횟수는 `한방첩약시범사업승인횟수`(승인된 건)입니다. 지금 저장하는 진료가 포함됐는지 클라이언트로는 알 수 없습니다. `> 8`이므로 "이미 승인된 횟수가 9 이상"일 때 초과입니다. 서버가 저장 중인 건을 포함해 셀 경우 경계가 하나 밀립니다.
- **월·연 구간**(달력 월/연인지, 롤링인지)은 서버 엔드포인트가 정합니다. 클라이언트에는 정의가 없습니다.
- **쿼리 가드 없음:** 횟수 쿼리에 `enabled` 조건이 없어 진료의가 정해지기 전에 `.../doctor/undefined`로 호출됩니다.
- **강제 덮어쓰기:** `watch`가 횟수가 바뀔 때마다 사용자가 고른 코드를 `U`로 덮습니다. 서버 강제는 클라이언트에서 보이지 않습니다. 설계 문서의 `PILOT_HERBAL_DOCTOR_LIMIT`(warning + 자동 `U`)는 이 동작을 옮긴 것입니다.
- 상수 8/60/600은 고시 대조가 필요합니다(`regulatory-limits` 참조데이터).
