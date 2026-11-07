# 설정 화면 검증 규칙

## 요약

설정 화면은 저장 전에 아래 규칙을 클라이언트에서 검사합니다. 서버는 지금 이 규칙을 강제하지 않는다고 보고, 재설계 서버가 같은 판정을 해야 합니다.

| 대상 | 규칙 | 실제 경계 |
|---|---|---|
| 임의처방(보험 단미엑스 조합) | 총 투약량 ≤ 50g, 총 투약가 ≤ 3,000원, 약재 수 ≤ 15 | 50 / 3000 / 15는 허용, 초과만 막음 |
| 비급여 단가(진료비) | 천만원 초과 불가 | 입력값을 10,000,000으로 잘라 넣음. **10,000,000은 허용** |
| 패키지 | 과세(`별도`·`포함`)와 면세를 섞을 수 없음 | 첫 항목이 패키지 과세 여부를 정함 |
| 치료실 | 베드 수 0–20(저장은 1 이상), 치료실 최대 10개, 이름 20자·중복 불가 | 브리프의 "bedCount ≤ 10"과 다름 |
| 이름 중복 | 임의처방·패키지·패키지 그룹·비급여는 서버 validate API, 치료실·약속처방은 클라이언트 비교 | validate 호출이 실패하면 통과로 봄 |

## 현행 위치

- 임의처방: `restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.helpers.js` (`yN`), 같은 이름의 `.vue.js` (`disabled`, 경고 문구)
- 패키지 과세 혼합: `restored/modules/PrescriptionInputSearchTreatment/part-3.js` (`Zl`), `components/setting/SettingPrescriptionViewPackagePrescriptionSidePanel.vue.js`, `SettingPrescriptionViewPackageEditPanel.vue`
- 패키지 항목 금액: `restored/modules/index/part-105.js` (`Omt`, 세율 `uD = 0.1`)
- 비급여 등록: `restored/components/setting/SettingPrescriptionViewNonBenefitRegistrationPanel.vue.js`, VAT 계산 `modules/SettingPrescriptionView/part-7.js` (`xy`), 숫자 입력 `lib/SettingPrescriptionView/part-6.js` (`gy`)
- 치료실: `restored/components/treatment/TreatmentRoomRegisterOrModifyModal.vue.js`, `components/setting/SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue.js`
- 약속처방 이름: `restored/components/setting/SettingPrescriptionViewPersonalFormulaCreateSidePanel.vue.js`

## 로직

### 임의처방

1. 약재마다 `계산금액 = Math.round(사용량 × 상한금액 ÷ 규격)`을 구합니다. 반올림은 **약재별로** 하고, 총 투약가는 반올림한 값의 합입니다. 그래서 반올림 전 합이 3,000 이하여도 3,001 이상이 될 수 있습니다.
2. `총사용량`은 사용량을 그대로 더합니다(부동소수 오차가 남습니다).
3. `사용량초과 = 총사용량 > 50`, `금액초과 = 총금액 > 3000`, `총약재초과 = 약재 수 > 15`.
4. 저장 버튼은 다음 중 하나라도 해당하면 막힙니다: 약재 없음, 총금액 0(반올림 결과 0 포함), 처방명 없음, 사용량 0인 약재가 있음, 세 한도 중 하나라도 초과.
5. 초과 문구는 다음 순서로 함께 보여 줍니다: "총 투약량은 50g을 초과할 수 없습니다." → "총 투약가가 3,000원을 초과할 수 없습니다." → "총 약재 수는 15개를 초과할 수 없습니다."
6. 이름 중복은 서버가 판정합니다. 저장 오류 메시지에서 공백을 지운 값에 "중복된이름"이 있으면 "중복된 이름의 임의처방이 있습니다."를 보여 줍니다.

### 패키지 과세 혼합

- `과세구분`이 `별도` 또는 `포함`이면 과세, 그 밖(`면세`, `null`, 빈 문자열)은 면세입니다.
- 패키지 과세 여부는 **첫 항목**으로 정합니다. 항목이 없으면 `null`이고 무엇이든 추가할 수 있습니다.
- 나머지 항목 중 과세 여부가 하나라도 다르면 `isValid: false`, 메시지 "과세 항목과 면세 항목을 함께 추가할 수 없습니다."입니다.
- 추가 후보(`canAddItem`)는 첫 항목과 과세 여부가 같아야 합니다. 다르면 처방 목록에서 행이 비활성화되고, 편집 패널에서는 "과세/면세 혼합 패키지는 만들 수 없습니다." 오류를 냅니다.
- 처방 추가 패널의 안내 배너는 항목이 정확히 1개이거나 혼합 상태일 때 보입니다(1개일 때는 안내 목적).
- 패키지 항목 금액: `세금 = 과세면 Math.round(단가 × 0.1), 면세면 0`, `금액 = (단가 + 세금) × 일투여량 × 투약일수`. `포함`도 10%를 **더합니다**.

### 비급여 단가

- 입력값에서 숫자만 남기고, 빈 값은 `"0"`입니다.
- 입력 중 값이 10,000,000을 넘으면 `"10000000"`으로 바꿉니다. blur 검사는 `> 10,000,000`일 때만 "{단가|진료비}는 천만원을 초과할 수 없습니다."를 냅니다. 결과적으로 **10,000,000원까지 허용**됩니다.
- 라벨은 `과세구분 === "포함"`이면 "진료비", 아니면 "단가"입니다.
- VAT 표시: `별도` → `round(금액 × 0.1)`, `포함` → `금액 − round(금액 ÷ 1.1)`(공급가는 `round(금액 ÷ 1.1)`), `면세` → 0.
- 등록 요청에는 입력값 그대로 `단가`를 문자열로 보내고, 코드는 앞에 "비"를 붙입니다.
- 이름·코드 중복: 화면에 로드된 목록에서 먼저 비교하고(`처방명`은 trim 후 일치, 코드는 "비"+코드), 없으면 `POST /settings/nonbenefits/validate`(`field`, `value`)를 호출합니다. 호출이 실패하면 오류를 지웁니다(통과).
- 라이트 서비스 전용 이름 27개(예: "경옥고", "라이트이벤트:경옥고")는 "라이트 서비스 전용 처방으로 설정에서 추가할 수 없습니다."로 막습니다.

### 치료실

- 베드 수 입력 검사: `Number(입력)`이 NaN이거나 음수면 무효이고, blur 시 기존 베드 수(신규면 0)로 되돌립니다. 20을 넘으면 무효이고 기존 베드 수(신규면 20)로 되돌립니다. 0–20은 유효입니다. 안내 문구는 "치료실별 최대 베드 수: 20개"입니다.
- 저장 버튼은 이름 중복, 이름 없음, 이름 20자 초과, `!Number(베드수)`(0 포함), 음수, 20 초과일 때 막힙니다. 즉 저장 가능한 베드 수는 1–20이고 소수(예: 2.5)도 통과합니다.
- 이름 중복: 같은 `치료실명`을 가진 **다른** 치료실이 있으면 "중복된 치료실이 있습니다."입니다.
- 치료실이 이미 10개 이상이면 등록 모달 대신 "치료실은 최대 10개까지 추가할 수 있습니다." 다이얼로그를 띄웁니다.

### 약속처방(개인 처방) 이름

- `GET /settings/personal-formulas?limit=100&offset=0` 결과의 `처방명.trim()` 집합에 입력값 trim이 있으면 중복입니다. 101번째 이후 항목은 비교하지 않습니다.

## 원본 코드

`restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.helpers.js:1-36`

```js
// Restored from unminified/SettingPrescriptionView.js:7448-7481
const yN = d => {
  const s = { 최대금액: 3000, 최대사용량: 50, 최대약재수: 15 };
  const { 총사용량, 총금액, 가공된약재목록: 약재목록 } = d.reduce((c, u) => {
    const 계산금액$ = Math.round(u.사용량 * u.단가 / u.기준용량);
    return {
      총사용량: c.총사용량 + u.사용량,
      총금액: c.총금액 + 계산금액$,
      가공된약재목록: [...c.가공된약재목록, { ...u, 계산금액: 계산금액$ }]
    };
  }, { 총사용량: 0, 총금액: 0, 가공된약재목록: [] });
  return {
    총사용량, 총금액, 약재목록,
    사용량초과: 총사용량 > s.최대사용량,
    금액초과: 총금액 > s.최대금액,
    총약재초과: 약재목록.length > s.최대약재수
  };
};
```

`restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.vue.js:188-202` (호출 측에서 `단가: +상한금액, 사용량: +사용량, 기준용량: +규격`으로 변환)

```js
// Restored from unminified/SettingPrescriptionView.js:7482-8008
const disabled = computed(() => {
  const { 사용량초과, 금액초과, 총약재초과, 총금액, 약재목록 } = v.value;
  if (!총금액 || !약재목록.length) {
    return true;
  }
  const fe = !p.value;
  const $e = 약재목록.some(약재$ => !약재$.사용량);
  return fe || 총약재초과 || 사용량초과 || 금액초과 || $e;
});
```

`restored/modules/PrescriptionInputSearchTreatment/part-3.js:5-43`

```js
// Restored from unminified/PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:452-492
function Ut(t) {
  return t === "별도" || t === "포함";
}
function Zl(t) {
  const is과세패키지 = computed(() => t.value.length === 0 ? null : Ut(t.value[0].과세구분));
  const 혼합검증결과 = computed(() => {
    if (t.value.length === 0) {
      return { isValid: true, message: "" };
    }
    const l = Ut(t.value[0].과세구분);
    if (t.value.some(r => Ut(r.과세구분) !== l)) {
      return { isValid: false, message: "과세 항목과 면세 항목을 함께 추가할 수 없습니다." };
    } else {
      return { isValid: true, message: "" };
    }
  });
  return {
    is과세패키지,
    혼합검증결과,
    canAddItem: l => {
      if (t.value.length === 0) {
        return true;
      }
      return Ut(t.value[0].과세구분) === Ut(l.과세구분);
    }
  };
}
```

`restored/modules/index/part-105.js:8` (`uD`는 `lib/index/part-104.js:5`의 `0.1`)

```js
// Restored from unminified/index.js:80244-80371
const Omt = (e, t) => t === "포함" || t === "별도" ? Math.round(e * uD) : 0;
```

`restored/components/setting/SettingPrescriptionViewNonBenefitRegistrationPanel.vue.js:502-532` (`be`는 `포함`이면 "진료비", 아니면 "단가")

```js
// Restored from unminified/SettingPrescriptionView.js:12700-13532
const Pe = () => {
  const oe = rawValue.value;
  const R = Number(oe);
  const te = `${be.value}는 천만원을 초과할 수 없습니다.`;
  if (oe) {
    if (R > 10000000) {
      fe.value = te;
      return;
    }
    if (fe.value.includes("천만원")) {
      fe.value = "";
    }
  }
};
const Bn = () => {
  if (Number(rawValue.value) > 10000000) {
    rawValue.value = "10000000";
  }
  if (D.value) {
    Kt();
  }
};
```

`restored/modules/SettingPrescriptionView/part-7.js:5-19`

```js
// Restored from unminified/SettingPrescriptionView.js:11249-11271
function xy(d, s) {
  return {
    VAT금액: computed(() => {
      const o = Number(d.value) || 0;
      if (s.value === "별도") {
        return Math.round(o * 0.1);
      }
      if (s.value === "포함") {
        const i = Math.round(o / 1.1);
        return o - i;
      }
      return 0;
    })
  };
}
```

`restored/components/treatment/TreatmentRoomRegisterOrModifyModal.vue.js:72-105, 212`

```js
// Restored from unminified/TreatmentRoomRegisterOrModifyModal.vue_vue_type_script_setup_true_lang-Bip_ua-d.js:12-240
const u = computed(() => {
  const { 치료실명, id } = modalValues.value;
  if (!치료실명) return "";
  const a = data.value?.find($ => $.치료실명 === 치료실명);
  if (a && id !== a.치료실Id) return "중복된 치료실이 있습니다.";
  else return "";
});
const x = s => {
  const toBe = Number(s);
  const 기존베드수$ = modalValues.value.기존베드수;
  if (Number.isNaN(toBe) || toBe < 0) {
    return { isValid: false, toBe: 기존베드수$ ?? 0 };
  } else if (toBe > 20) {
    return { isValid: false, toBe: 기존베드수$ ?? 20 };
  } else {
    return { isValid: true, toBe };
  }
};
// 저장 버튼
disabled: !!u.value || !modalValues.value.치료실명 || modalValues.value.치료실명.length > 20 || !Number(modalValues.value.베드수) || Number(modalValues.value.베드수) < 0 || Number(modalValues.value.베드수) > 20 || unref(isLoading_2),
```

`restored/components/setting/SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue.js:131-134`

```js
// Restored from unminified/SettingTreatmentView.js:1700-1921
if ((data.value || []).length >= 10) {
  C.value = true; // "치료실은 최대 10개까지 추가할 수 있습니다."
  return;
}
```

## 픽스처

`test/fixtures/rules/settings-validation.json` — 54건(실행 49, 추적 5). `input.check`로 하위 규칙을 고릅니다.

- `arbitraryFormula`(16): 50g·3,000원·15종 경계, 약재별 반올림으로 3,000 초과, 0.5 반올림, 규격 나눗셈, 세 한도 동시 초과, 저장 불가 조건(이름·사용량 0·총금액 0).
- `packageMix`(6), `packageItemAmount`(4): 과세 판정, 첫 항목 기준, null 처리, `포함` 가산.
- `nonBenefitAmount`(6), `nonBenefitAmountUnclamped`(2): 10,000,000 경계와 자르기, 콤마 입력, VAT 분리.
- `nonBenefitRegister`(5, 추적): 여러 핸들러의 흐름을 합쳐 재구성했습니다. 서버 validate 호출은 제외했습니다.
- `treatmentRoom`(10), `roomCount`(2), `personalFormulaName`(3).

## 서버 이전 시 주의

- 경계는 모두 "초과 금지"입니다(`≤ 50`, `≤ 3000`, `≤ 15`, `≤ 10,000,000`, 베드 `1–20`, 치료실 `≤ 10`). 설계 문서의 "1천만원 미만"과 "bedCount ≤ 10"은 현행과 다르므로 정책을 확정해야 합니다.
- 임의처방 총 투약가는 약재별 반올림 후 합산해야 현행과 같은 값이 나옵니다. 총사용량 비교는 부동소수 오차를 피하도록 0.1g 같은 고정 단위로 바꾸는 것이 좋습니다.
- 과세 판정은 `별도`/`포함`만 과세입니다. `null`·알 수 없는 값은 면세로 취급되므로 서버는 enum을 강제해야 합니다.
- 패키지 항목 금액에서 `포함`에도 10%를 더하는 동작이 의도인지 확인해야 합니다(비급여 등록에서는 `포함` 금액을 VAT 포함 진료비로 받습니다).
- 이름 중복 검사는 현행처럼 실패 시 통과(fail-open)하면 안 됩니다. 서버가 저장 시 유니크 제약으로 409를 돌려주게 하고, 약속처방처럼 100건만 보는 클라이언트 비교에 의존하지 않습니다.
- 라이트 서비스 전용 처방 이름 목록은 클라이언트 상수입니다. 서버 카탈로그 정책으로 옮겨야 합니다.
