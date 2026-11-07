# 접수 검증

## 요약

- 건보 자격 조회 결과의 `급여제한여부`가 **`"01"`(무자격자)일 때만** 보험구분을 `건보`에서 `일반`으로 자동으로 바꾸고 경고를 띄웁니다. 막지는 않습니다. 코드 `02`~`05`(체납·사망·국외이민)는 바꾸지 않습니다
- 선택의료기관 검사는 **의료급여**(자격여부 `7`/`8`) 환자만 대상입니다. 조건은 `본인부담여부`가 `M001/M002/B001/B002`이고 선택기관 1~4에 우리 기관이 없을 때입니다. 이때 `U001`을 고르거나 `B005`와 기관을 함께 골라야 접수할 수 있습니다
- 자보 누적 진료비가 `보증한도금액`을 **넘으면**(같으면 통과) 막습니다. "본부금 100%"를 체크했거나 한도가 0·빈 값이면 검사하지 않습니다. 보증 만료는 검증하지 않고, 직전 내원 자보 정보를 미리 채우지 않는 데만 씁니다
- 예약에서 접수하는 버튼은 `예약일자`가 오늘일 때만 켜집니다. 접수 API 자체는 날짜를 확인하지 않습니다

## 현행 위치

- 접수 패널: `restored/components/desk/DeskPatientAccept.vue.js`
- 검증 헬퍼: `restored/modules/SidePanelDeskActions/선택된기관기호.js` (`PD`, `AD`, `ED`)
- 급여제한 코드: `restored/modules/insurance.js`
- 자격 코드, 본인확인 판정: `restored/api/patients/queries-2.js` (`x0e`, `Dun`, `Lun`)
- 선택기관 코드 목록: `restored/modules/DeskPatientRegister/part-3.js` (`ni`), `restored/modules/MedicalAidsHospitalSelect/part-1.js` (`X`)
- 예약 상세 접수 버튼: `restored/components/appointment/AppointmentPlannerSideDetail.vue.js`

## 로직

**데이터**

- 건보 자격 조회 결과(`POST /nhic/m2/get-data`)
  - `자격여부`: `1`~`6` = 건보, `7`/`8` = 의료급여, 그 밖은 없음
  - `급여제한여부`, `본인부담여부`, `선택기관기호1관할지사코드`, `선택기관기호2`~`4`, `본인확인예외여부`, `시설기호증번호`
- 우리 기관: `useAuthMeQuery` → `요양기관기호`
- 환자: `최초내원일`, `본인확인일자`(yyyyMMdd), `주민등록번호앞7자리`, `임산부여부`
- 자보: `자동차보험조회.보증한도금액`(문자열), `보증종료일자`, `사고접수번호`. 누적액은 `GET /patients/{id}/car-waiting/amount/{사고접수번호}` → `진료비총액`

**제출 시 검사 순서** (`gx`)

1. `validateInsuranceType` (건보일 때만)
   - 조회 결과가 없거나 `자격여부`가 알 수 없는 코드 → "건강보험 자격이 없는 환자입니다. 보험 구분을 일반으로 변경해주세요."
   - 산정특례 진료인데 특례를 고르지 않음 → "산정 특례 선택이 필요합니다."
   - 본인확인이 필요한데 체크하지 않음 → 필드 오류 "본인확인 여부를 체크해주세요."
2. 선택의료기관 게이트(`ta`)가 참이면 "선택의료기관 환자입니다." 다이얼로그를 띄우고 중단합니다
3. `AD`: 고른 본인부담여부가 `B005/B006/B008`인데 기관이 없거나 `"없음"`이면 "본인부담여부를 {코드}로 선택한 경우 선택의료기관을 함께 지정해 주세요." 토스트를 띄우고 중단합니다
4. 제주 지원 컴포넌트의 `validate()`
5. 자보이고 "본부금 100%"를 체크하지 않았으면 `Number(보증한도금액) > 0 && 보증한도금액 − 진료비총액 < 0`일 때 "누적 진료비가 보증한도를 초과했습니다." 다이얼로그를 띄웁니다
6. 수정 접수이고 보험구분이 바뀌었는데 승인된 처방이 있으면 "이미 제출된 … 있어 보험 구분을 변경할 수 없습니다."를 띄우고 중단합니다

**선택의료기관 게이트**

- 대상(`bn`): 보험구분 `건보` 탭 && `x0e(자격여부) === "급여"` && `본인부담여부 ∈ {M001, M002, B001, B002}` && `요양기관기호`가 있고 선택기관 1~4에 없음
- 막힘(`ta`): 대상이 아니거나 고른 값이 `U001`이면 통과입니다. `B005`이면 기관을 골랐을 때만 통과하고, 그 밖의 값(빈 값, `B006` 등)은 막힙니다
- 직전 내원(오늘 이전)의 `건강보험조회.본인부담여부`가 `B005`이고 기관이 있으면, 그 기관과 `B005`를 미리 채우고 "지난 의뢰 승계 · {기관} ({M월 D일} 내원)"을 보여 줍니다
- 보내는 값(`ED`): `보험구분 === "급여"`이고, 고른 값이 `B005/B006/B008`이 아니고, (기관이 없거나 `해당없음` 외의 값을 골랐으면) `선택된기관기호: "없음"`을 보냅니다. 그 밖에는 고른 기관을 보냅니다

**본인확인 필요 여부** (건보)

- 필요(`Dun`): 환자 정보가 없거나, 첫 내원이거나, `본인확인일자`가 없거나, `본인확인일자 < 오늘−6개월`이면 필요합니다
- 예외(`Lun`, 하나라도 참이면 예외)
  - `본인확인예외여부 === "Y"`
  - 만 19세 미만
  - 임산부
  - `오늘−6개월 <= 본인확인일자 <= 오늘`
  - 건보 100% 체크
- 필요하고 예외가 아니면 체크를 강제합니다

**급여제한 자동 전환**

- 건보 자격 조회 결과가 바뀔 때, 보험구분이 `건보`이고 `급여제한여부 === "01"`이면 `일반`으로 바꾸고 "건강보험 무자격자로 확인되어 보험 구분을 일반으로 변경했습니다." 경고를 띄웁니다

**자보 보증 만료**

- 직전 내원의 `자동차보험조회.보증종료일자`가 오늘 0시보다 이르면 그 자보 정보를 미리 채우지 않습니다. 오늘이 종료일이면 채웁니다
- 손으로 입력한 만료 보증은 막지 않습니다

**예약 → 접수 버튼** (예약 상세 패널)

- 보이는 조건: 예약 상태가 `등록`, `취소`, `부도`, `부도후_예약시간_변경`, `부도후_예약일자_변경` 중 하나
- 켜지는 조건: `접수생성` 권한이 있고 `isToday(예약일자)`
- 부도 계열이면서 예약일자가 과거면 `수정` 버튼을 숨깁니다

## 원본 코드

`restored/modules/insurance.js:41-57`, `restored/components/desk/DeskPatientAccept.vue.js:687-692`

```js
// Restored from unminified/insurance.js:12-166
const i = { 무자격자: "01", 체납6회이상: "02", 외국인재외국민체납: "03", 사망자: "04", 국외이민자: "05" };
const x = t => t === i.무자격자;
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:9306-10509
watch(건보자격조회결과$, De => {
  if (selectedInsuranceType$.value === 건보 && x_2(De?.급여제한여부)) {
    selectedInsuranceType$.value = 일반;
    x.warning("건강보험 무자격자로 확인되어 보험 구분을 일반으로 변경했습니다.");
  }
});
```

`restored/components/desk/DeskPatientAccept.vue.js:418-460`

```js
const bn = computed(() => {
  if (selectedInsuranceType$.value !== 건보) return false;
  const De = 건보자격조회결과$.value;
  if (!De || x0e(De.자격여부 || "") !== "급여") return false;
  const J = (De.본인부담여부 || "").trim();
  if (!ni.includes(J)) return false;                       // ["M001", "M002", "B001", "B002"]
  const ne = yl.value?.요양기관기호 || "";
  if (ne) {
    return ![De.선택기관기호1관할지사코드, De.선택기관기호2, De.선택기관기호3, De.선택기관기호4].includes(ne);
  } else {
    return false;
  }
});
const ta = computed(() => !bn.value || 선택된본인부담여부$.value === "U001" ? false : 선택된본인부담여부$.value === "B005" ? !선택된기관$.value.선택된기관기호 : true);
```

`restored/modules/SidePanelDeskActions/선택된기관기호.js:149-159`

```js
// Restored from unminified/SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:2840-2985
const AD = (t, s) => {
  if (!X.includes(t)) return null;                          // ["B005", "B006", "B008"]
  const 선택된기관기호$ = s.선택된기관기호;
  if (선택된기관기호$ && 선택된기관기호$ !== "없음") return null;
  return `본인부담여부를 ${t}로 선택한 경우 선택의료기관을 함께 지정해 주세요.`;
};
```

`restored/components/desk/DeskPatientAccept.vue.js:884-900, 652-656`

```js
const gx = async () => {
  if (!(await Wt())) return;      // validateInsuranceType → Ct (selected-institution dialog) → AD → Jeju validate
  if (selectedInsuranceType$.value === 자보 && !보험자격_자보100체크여부$.value) {
    const ne = Number(자보자격조회결과$.value.보증한도금액);
    const Jt = os.value?.진료비총액 ?? 0;
    if (ne > 0 && ne - Jt < 0 && (await v.show(BaseConfirmDialog, {
      title: "누적 진료비가 보증한도를 초과했습니다.",
      description: "[본부금 100% 발생]에 체크하거나 건보 환자로 접수해주세요",
      actionButtonText: "확인", /* ... */ }))) {
      return;
    }
  }
  // ... submit
};
// prefill from previous visit
const It = 직전내원현황$.자동차보험조회.보증종료일자 ? parse(직전내원현황$.자동차보험조회.보증종료일자, "yyyyMMdd", new Date()) : undefined;
if (It && $f(It, Ts(new Date()))) return;                   // isBefore(end, startOfDay(now))
```

`restored/api/patients/queries-2.js:815-824` (본인확인 필요)

```js
// Restored from unminified/index.js:117270-118177
function Dun({ 환자정보 }) {
  if (!환자정보) return true;
  const t = !환자정보.최초내원일;
  const n = 환자정보.본인확인일자 ? $f(parse(환자정보.본인확인일자, "yyyyMMdd", ls()), la(ls(), 6)) : true;  // isBefore(date, subMonths(startOfToday, 6))
  return t || n;
}
```

`restored/components/appointment/AppointmentPlannerSideDetail.vue.js:551-552`

```js
// Restored from unminified/AppointmentPlannerView.js:803-1326
class: normalizeClass(["whitespace-nowrap !p-0", ["등록", "취소", "부도", "부도후_예약시간_변경", "부도후_예약일자_변경"].includes(p.value.예약상태) ? "visible" : "invisible"]),
disabled: !unref(canCreate$)(unref(PermissionCode$).접수생성) || !unref(DDe)(unref(parse)(props.appointment.예약일자, "yyyyMMdd", new Date())),  // DDe = isToday
```

## 픽스처

[`test/fixtures/rules/check-in-validation.json`](../../../test/fixtures/rules/check-in-validation.json): 74건 (실행 71, 추적 3). 하네스는 date-fns 함수(`isBefore`, `startOfDay`, `subMonths`, `isWithinInterval`, `isToday`)를 같은 의미의 함수로 바꾸고 오늘을 2026-11-01로 고정했습니다. 만 나이는 원본 `mx()`를 실행하지 않고 입력으로 받았습니다.

| 케이스 | 입력 | 결과 |
|---|---|---|
| 급여제한 `01` | 건보 | `일반`으로 전환 + 경고 |
| 급여제한 `02`~`05` | 건보 | 그대로 `건보` |
| 의료급여 M001, 우리 기관 비선택 | 아무것도 안 고름 | 막힘 |
| 같은 환자 | `U001` / `B005`+기관 / `B006`+기관 | 통과 / 통과 / 막힘 |
| 자보 한도 | 총액 999,999 / 1,000,000 / 1,000,001 (한도 1,000,000) | 통과 / 통과 / 초과 |
| 자보 한도 빈 값 | 총액 2,000,000 | 통과 |
| 보증 종료일 | 어제 / 오늘 / 내일 | 미리 채우지 않음 / 채움 / 채움 |
| 본인확인일자 | 정확히 6개월 전 / 6개월+1일 전 | 예외 / 필요 |
| 나이 | 18 / 19 | 예외 / 필요 |
| 예약 접수 버튼 | 예약일 어제 / 오늘 / 내일 | 꺼짐 / 켜짐 / 꺼짐 |

## 서버 이전 시 주의

- **급여제한 범위:** 클라이언트는 `01`만 처리하고, 처리 방식도 자동 전환+경고입니다. 재설계는 `NHIS_BENEFIT_RESTRICTED`(422)로 막습니다. `02`~`05`도 막을지 업무 확인이 필요합니다
- **선택의료기관:** 재설계 문서의 "선택의료기관(B005) 대상인데 기관 미선택"은 실제로는 의료급여 선택기관 적용자(`M001/M002/B001/B002`)에 대한 검사입니다. `B005`는 직원이 고르는 값입니다. `B006`을 기관과 함께 골라도 게이트에서 막히는데, `AD`는 이를 허용합니다. 둘 중 하나가 버그로 보입니다
- **자보 한도:** `>`(초과)일 때만 막고 같으면 통과합니다. 한도가 0, 빈 값, 숫자가 아닌 값이면 한도가 없다고 봅니다. 다이얼로그 버튼은 "확인" 하나이고, 다이얼로그 결과가 참일 때만 중단합니다. 닫기가 거짓을 돌려주면 접수가 진행됩니다(닫기 반환값은 추적하지 못했습니다)
- **보증 만료:** 클라이언트에는 만료 검증이 없습니다. 재설계의 `AUTO_INSURANCE_CASE_EXPIRED`는 새 규칙입니다. 클라이언트와 맞추려면 종료일 당일까지 유효로 보세요
- **오늘 예약만 접수:** 버튼 비활성화일 뿐이고, `POST /desk/waiting`은 `예약Id`만 보내고 날짜를 확인하지 않습니다. 원무 화면의 예약 컬럼 드롭도 날짜를 확인하지 않습니다(그 화면은 데스크 날짜의 예약만 보여 줍니다)
- **본인확인:** 6개월 경계는 "오늘 0시 − 6개월"과 같은 날이면 유효입니다. 만 나이 계산(`mx`)은 서버에서 다시 정해야 합니다
- 보험구분 변경 차단(승인된 처방)과 무효 처방 삭제 확인은 클라이언트가 처방 데이터를 읽어 판단합니다. 서버에서는 처방 상태를 기준으로 판단해야 합니다
