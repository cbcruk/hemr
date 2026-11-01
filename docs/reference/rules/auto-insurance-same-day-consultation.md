# 자보 1일 2차 진료 진찰료 제외

## 요약

- 같은 날 한 환자에게 **서로 다른 사고접수번호**의 자보 진료가 2건 이상이면, 그날 먼저 시작한 진료 다음의 진료를 "자보 1일 2차"(`자보1일2차여부 = true`)로 지정하고 진찰료(수가코드 `10100*` 초진, `10200*` 재진)를 넣지 않습니다.
- 진료 화면 배너가 조건을 보면 자동으로 2차 지정 + 진찰료 라인 제거를 하고("자보 1일 2차 진료로 자동 지정하고 진찰료를 제거했습니다."), 사용자는 다른 진료를 2차로 바꿔 지정할 수 있습니다.
- 2차로 지정된 진료는 진찰료 자동 산정을 하지 않고, 청구 명세서에 특정내역 `MT001 = "U"`가 붙습니다.
- 뒤 진료가 진찰료를 가지고 있으면 청구 경고 `J0014`(위험도 중간, 표시만)가 뜹니다. 같은 사고접수번호끼리는 아무 규칙도 적용되지 않습니다.

## 현행 위치

- `re-upstream/restored/modules/index/local.js` `qk`(174), `VFt`(176), `jFt`(178-202), `HFt` 자보 갈래(740-761)와 표시 코드 필터(771-772). `zFt`의 `같은날자보진료데이터` 쿼리(357-366): 자보 진료 목록 `type: "자보", days_ago: 90, limit: 90`.
- `re-upstream/restored/modules/index/part-221.js:423-434` `IBt`(원래 J0014; `HFt`가 걸러 버립니다).
- `re-upstream/restored/components/treatment/TreatmentViewBoardEditHeaderJabo2ndVisitBanner.vue.js:68-157` 배너 판정, 자동 지정 `u`, 해제 `m`, 다른 진료 지정 `handleClick`. 부모 `TreatmentViewBoard.vue:586`이 `최근진료기록`으로 `같은날자보진료기록`을 넘깁니다.
- `re-upstream/restored/components/treatment/TreatmentViewBoardPrescriptionV2.helpers.js:84-87` 자동 산정 `_()`가 2차면 즉시 종료, 66-74 2차 해제 시 재산정. `TreatmentViewBoardPrescriptionV2.helpers.helpers.js:51-55`도 2차면 산정을 건너뜁니다.
- `re-upstream/restored/modules/ClaimHiraView/codes.js:3547-3572` `Tf` 명세서 특정내역.
- 저장 페이로드: `modules/TreatmentViewBoard/part-42.js:459-461`이 boolean일 때만 `자보1일2차여부`를 보냅니다.
- 경고 문구(`modules/TreatmentViewBoardPrescriptionV2/_hoisted_1.js:430-437`): "자보 1일 2차 진료 — 진찰료 중복 산정시 삭감대상입니다. (삭감 위험)" / "같은 날 다른 사고건 진료 중 하나를 1일 2차 진료로 지정해 진찰료 중복을 해소하세요."

## 로직

같은 날 = `기준일시.slice(0, 8)`(yyyyMMdd) 문자열 일치. 대상은 `보험구분 === "자보"`이고 `기준일시`가 있는 다른 진료(`진료Id`가 다름)입니다.

**배너** (`i`, `상황$`, `c`)

- `상황` = 현재 진료와 같은 날 자보 진료들의 사고접수번호(null 제외) 종류가 2개 이상.
- `후보` = 같은 날 다른 진료 중 `기준일시`가 현재보다 작거나, 같으면서 `진료Id`가 문자열로 더 작은 것이 있음(= 현재가 첫 진료가 아님).
- `형제2차지정` = 같은 날 다른 진료 중 `자보1일2차여부 === true`가 있음.
- 배너 표시 = `상황 && (현재가 2차 || (!형제2차지정 && 후보))`.
- 자동 지정 조건 `c` = `상황 && 후보 && !형제2차지정`. `c`가 참이 되고 쓰기 권한이 있으며 현재 진료의 `자보1일2차여부 == null`(한 번도 정해지지 않음)이면 `자보1일2차여부 = true`로 바꾸고 `10100`/`10200`으로 시작하는 처방 라인을 지웁니다. 사용자가 `false`로 되돌린 뒤에는 다시 자동 지정하지 않습니다.
- "다른 진료를 2차로 지정": 고른 진료를 서버에 `{ 자보1일2차여부: true, 진료처방: 진찰료 라인 제거 }`로 저장하고, 현재 진료는 `false`로 바꿉니다. 현재 진료의 진찰료는 자동 산정(`_()`)이 2차 해제를 감지해 다시 넣습니다.

**청구 경고 J0014** (`HFt` 자보 갈래)

- `ABt`가 만든 경고에서 `J0014`를 모두 버립니다(`IBt`의 "같은 날 사고 2종 이상 && 아무도 2차 아님" 판정은 쓰이지 않습니다).
- 다시 계산: 같은 날 다른 자보 진료 `g`, 사고접수번호 집합 `y`(현재 + g, null 제외). `y.size >= 2` 이고 `g` 중 현재보다 앞선 진료(기준일시 비교, 같으면 진료Id 비교)가 있고, 현재 처방에 `10100`/`10200`으로 시작하는 라인이 있으면 `{ 에러코드: "J0014", 원인제공자Ids: 그 라인 id }`.
- `자보1일2차여부`는 보지 않습니다.

**청구 명세서** (`Tf`): 자보면서 `자보1일2차여부 === true`면 `[{ 특정내역구분: "MT001", 특정내역: "U" }]`, 아니면 빈 배열. 배지 표시는 "자보2차"(`modules/insurance.js:141`).

## 원본 코드

`re-upstream/restored/modules/index/local.js:740-761` (`// Restored from unminified/index-CBEIvlV0.js:125817-126550`, 해당 부분 126517-126538)

```js
if (현재진료.보험구분 === "자보") {
  const h = ABt({
    현재진료,
    수상일이후진료기록: 최근진료기록,
    환자정보,
    같은날자보진료목록: jFt({ 현재진료, 최근진료기록: 같은날자보진료기록 ?? [] })
  }).filter(b => b.에러코드 !== "J0014");
  const g = (같은날자보진료기록 ?? []).filter(b => b.진료Id !== 현재진료.진료Id && b.보험구분 === "자보" && !!b.기준일시 && !!현재진료.기준일시 && b.기준일시.slice(0, 8) === 현재진료.기준일시.slice(0, 8));
  const y = new Set([qk(현재진료.보험조회), ...g.map(b => qk(b.보험조회))].filter(b => b));
  const w = g.some(b => b.기준일시 < 현재진료.기준일시 || b.기준일시 === 현재진료.기준일시 && b.진료Id < 현재진료.진료Id);
  const 원인제공자Ids$ = 현재진료.진료처방.filter(진료처방항목$ => VFt(진료처방항목$.수가코드)).map(b => b.id);
  if (y.size >= 2 && w && 원인제공자Ids$.length > 0) {
    h.push({ 에러코드: "J0014", 원인제공자Ids: 원인제공자Ids$ });
  }
  return h;
}
```

같은 파일 174-176:

```js
const qk = e => e?.사고접수번호 ?? null;
const VFt = e => !!e && (e.startsWith(수가코드$.초진료) || e.startsWith(수가코드$.재진료)); // "10100", "10200"
```

`re-upstream/restored/components/treatment/TreatmentViewBoardEditHeaderJabo2ndVisitBanner.vue.js:68-157` (`// Restored from unminified/TreatmentViewBoard-B3k9L_c2.js:27829-28085`, 해당 부분 27893-27982; `.vue` 디컴파일본 기준 발췌)

```js
const i = computed(() => {
  const 진료내용$ = props.진료내용;
  if (!진료내용$ || 진료내용$.보험구분 !== "자보" || !진료내용$.기준일시) {
    return { 상황: false, 후보: false, 형제2차지정: false };
  }
  const w = 진료내용$.기준일시.slice(0, 8);
  const k = new Set();
  const h = o(진료내용$.보험조회);          // o = y => y?.사고접수번호 ?? null
  if (h) k.add(h);
  let 후보 = false;
  let 형제2차지정 = false;
  for (const B of props.최근진료기록 ?? []) {
    if (B.진료Id === 진료내용$.진료Id || B.보험구분 !== "자보" || !B.기준일시 || B.기준일시.slice(0, 8) !== w) {
      continue;
    }
    const L = o(B.보험조회);
    if (L) k.add(L);
    if (B.기준일시 < 진료내용$.기준일시 || B.기준일시 === 진료내용$.기준일시 && B.진료Id < 진료내용$.진료Id) {
      후보 = true;
    }
    if (B.자보1일2차여부 === true) {
      형제2차지정 = true;
    }
  }
  return { 상황: k.size >= 2, 후보, 형제2차지정 };
});
const p = computed(() => props.진료내용?.자보1일2차여부 === true);
const 상황$ = computed(() => i.value.상황 && (p.value || !i.value.형제2차지정 && i.value.후보));
const c = computed(() => i.value.상황 && i.value.후보 && !i.value.형제2차지정);
const v = y => !!y && (y.startsWith(수가코드$.초진료) || y.startsWith(수가코드$.재진료));
const u = () => {
  if (!!props.canWriteTreatmentRecord && !!props.진료내용수정) {
    props.진료내용수정(y => {
      y.자보1일2차여부 = true;
      y.처방 = y.처방.filter(처방항목$ => !v(처방항목$.수가코드));
    });
  }
};
watch(c, y => {
  if (!!y && !!props.canWriteTreatmentRecord) {
    if (props.진료내용?.자보1일2차여부 == null) {
      u();
      e.success("자보 1일 2차 진료로 자동 지정하고 진찰료를 제거했습니다.");
    }
  }
}, { immediate: true });
```

`re-upstream/restored/modules/ClaimHiraView/codes.js:3547-3563` (`// Restored from unminified/ClaimHiraView-hepxiFdR.js:3121-6676`, 해당 부분 6651-6667)

```js
const Tf = e => {
  const { 보험구분, 첩건명세서여부, 자보1일2차여부, 처방목록 } = e;
  const a = [];
  if (보험구분 === "자보") {
    if (자보1일2차여부 === true) {
      a.push({ 특정내역구분: "MT001", 특정내역: "U" });
    }
    return a;
  }
  /* 건보·급여·첩건 갈래 생략 */
};
```

## 픽스처

[`test/fixtures/rules/auto-insurance-same-day-consultation.json`](../../../test/fixtures/rules/auto-insurance-same-day-consultation.json) — 25건, 모두 `executed`. 배너 케이스의 `willAutoAssign`은 `watch(c)` 본문 조건(`c && canWrite && 자보1일2차여부 == null`)을 그대로 옮겨 평가한 값입니다.

| 구분 | 케이스 | 결과 |
|---|---|---|
| J0014 | 자보 1건 / 같은 사고 2건 | 없음 |
| J0014 | 다른 사고, 현재가 뒤, 진찰료 10200·10100 | J0014(두 라인) |
| J0014 | 다른 사고, 현재가 앞 | 없음 |
| J0014 | 같은 시각, 진료Id 큼 / 작음 | J0014 / 없음 |
| J0014 | 진찰료 이미 제거 | 없음 |
| J0014 | 전날 23:59 vs 00:01 | 없음 |
| J0014 | 다른 진료가 건보 / 사고접수번호 없음 | 없음 |
| J0014 | 현재가 2차인데 진찰료 재추가 / 앞 진료가 2차 지정됨 | J0014 (플래그 무시) |
| J0014 | `10400` vs `1020010` | `1020010`만 |
| IBt | 첫 진료에 대한 원래 J0014 / 2차 지정 존재 | HFt 결과 없음 / 원래도 없음 |
| 배너 | 뒤 진료, 플래그 미정 | 표시, 자동 지정, 진찰료 제거 |
| 배너 | 플래그 false / 형제 2차 / 현재 2차 / 첫 진료 / 같은 사고 / 쓰기 권한 없음 | 표시·자동 안 함 / 숨김 / 표시 / 숨김 / 숨김 / 표시·자동 안 함 |
| 명세서 | 2차 true / false / null | `MT001=U` / 없음 / 없음 |

## 서버 이전 시 주의

- **같은 사고접수번호로 같은 날 두 번 진료하면 아무 규칙도 없습니다.** 두 진료 모두 진찰료가 남습니다. 자보 진료수가 기준과 대조가 필요합니다.
- **J0014가 2차 플래그를 보지 않습니다.** 사용자가 "다른 진료를 2차로 지정"으로 앞 진료를 2차로 만들면, 뒤 진료는 진찰료가 다시 들어가고도 J0014가 뜹니다. 버그로 보이지만 현행 동작으로 기록합니다.
- 순서 판정이 `기준일시` 문자열 비교 후 `진료Id` 문자열 비교입니다. 같은 분에 시작한 진료는 ID 사전순에 따라 앞뒤가 정해집니다.
- 진찰료 판정이 `10100`/`10200` 접두사뿐입니다. 다른 규칙(대면/비대면 중복)은 `10`으로 시작하는 모든 코드를 진찰료로 봅니다.
- 자동 지정은 클라이언트 watch가 초안을 고치고 토스트를 띄우는 방식입니다. 서버는 `docs/design/clinical.md`의 "자동 조정 + warning"으로 할지, 경고만 할지 정해야 합니다. 자동 조정한다면 "한 번도 정해지지 않은 경우(null)만"이라는 조건을 지켜야 사용자의 해제가 유지됩니다.
- 같은 날 진료 목록은 최근 90일·90건 자보 진료 조회 결과에서 걸러냅니다. 그 밖의 진료는 비교 대상이 아닙니다.
- 사고가 3건 이상이면 첫 진료 이후 모두 후보지만, 하나가 2차로 지정되면 나머지는 자동 지정되지 않습니다(형제2차지정). 나머지 진료의 진찰료는 J0014로만 드러납니다.
