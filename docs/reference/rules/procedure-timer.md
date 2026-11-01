# 치료실 시술 타이머

## 요약

치료실 보드는 시술(침·뜸·부항 등)마다 `duration_sec` 타이머를 돌립니다. **타이머 만료 판정은 클라이언트만 합니다.** 서버 snapshot의 `running` 시술이 `시작일시 + duration_sec`에 도달하면 클라이언트가 로컬에서 `pending` + `타이머종료 = true`로 바꾸고 알림을 냅니다. 서버로는 아무 요청도 보내지 않습니다. 이후 같은 내원의 다른 시술을 시작하면, 클라이언트가 만료된 시술을 대신 `complete` 호출합니다.

## 현행 위치

- 상태 관리 composable `Rp`: `re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js`
  - 서버 행 → 로컬 상태 `ne`, 1초 tick `Y`, 만료 자동 완료 `Ea`, 시작 `startTreatment`, 시간 조정 `Tn`/`adjustTimer`, 타이머 설정 `treatmentItemConfigs`/`Pe`, 치료세트 `kn`
- 종료 시각 `YWt`: `re-upstream/restored/modules/index/useTreatmentsSnapshotQuery.js`
- 종료 알림 `XWt`: `re-upstream/restored/modules/index/part-256.js`
- API: `GET /treatments/snapshot`(이 화면 5초 polling, 응답의 `serverNow`로 시계 보정), `POST /treatments/procedures/{id}/start|restart|complete|uncomplete`, `PATCH /treatments/procedures/{id}`(`duration_sec`), `GET|PUT /treatments/timer-config`, `GET|POST|PUT|DELETE /treatments/groups`

## 로직

### 시계

- 현재 시각 `b() = Date.now() + g`. `g`는 snapshot을 받을 때마다 `serverNow − Date.now()`로 갱신합니다.
- 로컬 변경 직후 2초 동안(그리고 변경 이전 시각의 snapshot은) 무시해 낙관적 업데이트를 덮어쓰지 않습니다.

### 만료 판정

- snapshot 행 매핑(`ne`): `상태 === "running"`이고 `시작일시`가 있으면 `경과 = max(0, floor((now − 시작일시) / 1000))`, `남은시간 = duration_sec − 경과`.
  - `남은시간 ≤ 0`이면 `상태 = "pending"`, `remaining_sec = null`, `타이머종료 = true`.
  - 그 밖은 `remaining_sec = 남은시간`. 시계가 시작일시보다 이르면 경과는 0입니다.
  - `running`인데 `시작일시`가 없으면 `remaining_sec = null`로 둡니다.
  - 그 밖의 상태는 서버의 `타이머종료여부`를 그대로 씁니다. `담당구분 === "원장"`이면 `doctor`, 아니면 `staff`.
- 1초 tick(`Y`): `running`마다 남은 시간을 다시 계산합니다(`시작일시`가 없으면 `remaining_sec − 1`). `남은시간 > 0`이 아니면 위와 같이 만료 처리합니다. 한 tick에서 만료된 시술은 같은 `타이머종료순번`을 받고, 내원 단위로 한 번 알림을 냅니다.
- 같은 tick에서 현재 대기 시술의 `overdue_sec`(마지막 완료·만료 시각 또는 치료 시작 시각부터 지난 초)도 갱신합니다. 원장님 액팅 순서는 `overdue_sec`가 큰 베드부터입니다.

### 만료 알림

- 종료 시각 `종료시각Ms = 시작일시 + duration_sec × 1000`(시작일시 없으면 `null`).
- 태블릿 WebView면 `postMessage({ type: "TREATMENT_TIMER_END", payload: { bedNo, patientName, treatments, endedAt } })`만 보냅니다.
- 아니면 알림 키 `timer-end:{시술Id}:{종료시각Ms}`로 중복을 거르고(종료시각이 `null`이면 거르지 않음), 알림음과 기기 알림 "`NN`베드 `환자명`님 `카테고리, …` 타이머가 종료되었습니다."를 냅니다. 베드 번호는 두 자리로 채웁니다.

### 다음 시술 시작과 자동 완료

`startTreatment(내원Id, 시술Id)`:

1. 대상이 없거나 이미 `running`이면 아무것도 하지 않습니다.
2. 같은 내원에서 `pending` + `타이머종료`인 다른 시술을 모두 `done`으로 바꾸고 `완료일시 = now`, 각각 `POST …/{id}/complete`를 보냅니다(`Ea`).
3. 대상을 `running`, `시작일시 = now`, `remaining_sec = duration_sec`으로 바꿉니다.
4. 호출 API는 대상의 이전 상태로 고릅니다.
   - `done`이었다: `uncomplete` 성공 후 `start`
   - 만료된 `pending`이었다(`타이머종료 && 시작일시`): `restart`, 실패하면 `start`
   - 그 밖: `start`
- 치료세트 시작(`startSetInBed`)도 세트 밖의 만료 시술을 같은 방식으로 완료합니다.

### 시간 조정

`Tn(내원Id, 시술Id, 새초)`:

- 시술이 없거나 `done`이거나, `새초`가 정수가 아니거나 1 미만이거나 기존과 같으면 무시합니다.
- `running`이고 시작일시가 있으면 `새초 − 경과 < 1`일 때 무시하고, 아니면 `remaining_sec = 새초 − 경과`로 바꿉니다.
- `PATCH /treatments/procedures/{id}` `{ duration_sec: 새초 }`를 보내고, 실패하면 이전 값으로 되돌립니다.
- `adjustTimer`는 0이 아닌 정수 증감값을 `duration_sec`에 더해 `Tn`을 부릅니다.

### 타이머 설정

- 타이머 설정 항목: `{ id, 처방명, 사용여부, 순서, duration_sec, isCustom, 담당구분, linked_to_default_procedure }`. 변경은 500ms debounce 후 `PUT /treatments/timer-config { items }`로 전체를 보냅니다. 새 항목(id 접두사 `__draft-`)은 `id` 없이 보냅니다.
- 새 사용자 항목의 기본 시간은 300초입니다.
- 기본 시술에 연결된 항목(`linked_to_default_procedure`)은 삭제하지 않고 `사용여부 = false`로 바꿉니다.
- 치료세트의 표시 시간은 구성 항목 `duration_sec`의 최댓값이고, 없거나 0이면 900초입니다.

## 원본 코드

`re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js:117-129` (`ne` 안의 만료 판정, `b() = Date.now() + serverNow 보정값`)

```js
// Restored from unminified/TreatmentRoomsView-COI6Zx2h.js:1010-2326
if (n.상태 === "running" && n.시작일시) {
  const u = new Date(n.시작일시).getTime();
  const p = Math.max(0, Math.floor((b() - u) / 1000));
  const N = n.duration_sec - p;
  if (N <= 0) {
    s.상태 = "pending";
    s.remaining_sec = null;
    s.타이머종료 = true;
  } else {
    s.remaining_sec = N;
  }
}
```

`re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js:338-358` (1초 tick)

```js
// Restored from unminified/TreatmentRoomsView-COI6Zx2h.js:1010-2326
const Y = () => {
  const n = b();
  for (const [r, s] of Object.entries(treatmentsBy내원Id.value)) {
    let u = null;
    for (const ae of s) {
      if (ae.상태 !== "running") {
        continue;
      }
      const H = ae.시작일시 != null ? ae.duration_sec - Math.max(0, Math.floor((n - new Date(ae.시작일시).getTime()) / 1000)) : ae.remaining_sec != null ? ae.remaining_sec - 1 : null;
      if (H != null && H > 0) {
        ae.remaining_sec = H;
      } else {
        ae.상태 = "pending";
        ae.remaining_sec = null;
        ae.타이머종료 = true;
        if (u === null) {
          u = ++ge;
        }
        ae.타이머종료순번 = u;
      }
    }
    // … 같은 순번의 시술로 XWt 알림, overdue_sec 갱신
```

`re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js:880-898, 979-1016`

```js
// Restored from unminified/TreatmentRoomsView-COI6Zx2h.js:1010-2326
const Ea = (n, r) => {
  const s = (treatmentsBy내원Id.value[n] ?? []).filter(p => p.상태 === "pending" && p.타이머종료 && !r.includes(p.id));
  if (!s.length) return;
  const u = new Date(b()).toISOString();
  for (const p of s) {
    p.상태 = "done";
    p.완료일시 = u;
    p.remaining_sec = null;
    p.overdue_sec = null;
    p.타이머종료 = false;
    p.타이머종료순번 = undefined;
    ue.set(p.id, Date.now() + Ie);
    R(() => _.mutateAsync({ actingId: p.id })); // POST …/complete
  }
};
const startTreatment = (n, r) => {
  const s = ee(n, r);
  if (!s || s.상태 === "running") return;
  Ea(n, [r]);
  const u = s.상태 === "done";
  const p = !u && s.타이머종료 === true && s.시작일시 != null;
  s.상태 = "running";
  s.시작일시 = new Date(b()).toISOString();
  s.remaining_sec = s.duration_sec;
  s.overdue_sec = null;
  s.타이머종료 = false;
  s.타이머종료순번 = undefined;
  if (u) {
    C.mutate({ actingId: r }, { onSuccess: () => postTreatmentsProceduresStartMutation$.mutate({ actingId: r }) }); // uncomplete → start
    return;
  }
  if (p) {
    postTreatmentsProceduresRestartMutation$.mutate({ actingId: r }, { onError: () => postTreatmentsProceduresStartMutation$.mutate({ actingId: r }) });
    return;
  }
  postTreatmentsProceduresStartMutation$.mutate({ actingId: r });
};
```

`re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js:1027-1044`

```js
// Restored from unminified/TreatmentRoomsView-COI6Zx2h.js:1010-2326
const Tn = (n, r, s) => {
  const u = ee(n, r);
  if (!u || u.상태 === "done" || !Number.isInteger(s) || s < 1 || u.duration_sec === s) return;
  const duration_sec$_3 = u.duration_sec;
  const remaining_sec$ = u.remaining_sec;
  if (u.상태 === "running" && u.시작일시) {
    const re = Math.max(0, Math.floor((b() - new Date(u.시작일시).getTime()) / 1000));
    if (s - re < 1) return;
    u.remaining_sec = s - re;
  }
  u.duration_sec = s;
  patchTreatmentsProceduresMutation$.mutate({ actingId: r, duration_sec: s }, /* onError: 되돌림 */);
};
```

`re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js:23-25, 610`

```js
// Restored from unminified/TreatmentRoomsView-COI6Zx2h.js:1010-2326
const duration_sec$ = 300;   // 새 타이머 설정 항목 기본값
const duration_sec$_2 = 900; // 치료세트 표시 시간 fallback
duration_sec: n.items.reduce((r, s) => Math.max(r, s.duration_sec), 0) || duration_sec$_2,
```

`re-upstream/restored/modules/index/part-256.js:10, 47-51` / `modules/index/useTreatmentsSnapshotQuery.js:50`

```js
// Restored from unminified/index-CBEIvlV0.js:141873-141917
const KWt = e => `timer-end:${e.시술Id}:${e.종료시각Ms}`;
const s = String(e.베드번호).padStart(2, "0");
GB({ title: `${s}베드 ${e.환자명}님 ${Ste(r.map(({ 항목 }) => 항목))} 타이머가 종료되었습니다.`, tag: r.map(({ 키 }) => 키).join("|") });
// Restored from unminified/index-CBEIvlV0.js:141837-141872
const YWt = (e, t) => e != null ? new Date(e).getTime() + t * 1000 : null;
```

## 픽스처

`test/fixtures/rules/procedure-timer.json` — 26건(모두 실행). 기준 시각 `2026-11-01T01:00:00Z`.

- `mapServerProcedure`(7): 종료 1초 전, 정확히 0초(만료), 이후, 소수 초 내림, 시계 역전, 시작일시 없음, 원장 담당.
- `tick`(1): 동시 만료 묶음, 시작일시 없는 행 카운트다운, `done` 무시.
- `startTreatment`(4): 다음 시술 시작 시 만료 시술 자동 완료, 만료 시술 재시작(`restart`), `done` 재시작(`uncomplete`→`start`), 이미 진행 중.
- `setDuration`(8), `adjustTimer`(2): 경과보다 짧게 줄이기 거부, 1초 남김 허용, 0·소수·같은 값·`done` 거부.
- `defaults`, `groupDuration`(2), `timerEndNotification`(1).

## 서버 이전 시 주의

- 만료는 서버가 `timerEndsAt = startedAt + duration_sec`으로 판정해야 합니다. 경계는 현행처럼 **남은 시간 ≤ 0초(초 단위 내림)** 이면 만료입니다.
- 현행에서 만료는 서버 상태가 아니고, 자동 완료도 "같은 내원의 다른 시술을 개별 시작할 때"만 일어납니다. 재설계의 `autoCompleteElapsedOnNextStart` 정책은 이 동작을 기본값으로 삼으면 됩니다. 세트 완료·순서 변경·재시작은 자동 완료를 일으키지 않습니다.
- 만료 시술을 다시 시작하면 `restart`, 완료된 시술을 다시 시작하면 `uncomplete` 후 `start`입니다. 서버는 이 두 전이를 하나의 `:start`로 받아도 결과가 같아야 합니다.
- `duration_sec` 변경은 정수 1 이상만 받고, 진행 중이면 `새 시간 − 경과 ≥ 1`이어야 합니다. 현행은 이 검사를 클라이언트만 합니다.
- 시계는 서버 시간만 써야 합니다. 현행은 `serverNow` 보정 후에도 브라우저 tick에 의존합니다.
- 기본값 300초(새 항목)·900초(세트 fallback)는 클라이언트 상수입니다.
