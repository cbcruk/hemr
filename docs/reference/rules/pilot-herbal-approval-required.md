# 첩약 시범사업 처방 심평원 승인 필수

## 요약

- 진료 완료(`finishPatientRecord`) 시 건보 첩약 처방 라인(카테고리 `35001001`)이 **모두** `승인여부`가 참이어야 진행합니다.
- 하나라도 미승인이면 "진료 완료 전 / 첩약 내역을 심평원에 제출해 주세요." 대화상자를 띄우고 저장·완료를 하지 않습니다.
- LITE 단독 계정과 비대면 LITE 주문 완료 경로는 이 검사를 건너뜁니다.
- 청구 검사 코드 `C0005`("첩약 내역이 제출되지 않았습니다.")도 같은 조건이지만 첫 라인만 보고, 진료 화면 실시간 경고에서는 걸러져 표시되지 않습니다.

## 현행 위치

- `restored/components/treatment/TreatmentViewBoard.helpers-10.js:309-316` `checkNhicChubyakApproval`
- `restored/components/treatment/TreatmentViewBoard.helpers-11.js:45-117` 완료 흐름 `u` / `finishPatientRecord`
- `restored/modules/index/part-103.js` 카테고리 코드 `me.한방첩약시범사업.첩약 = "35001001"`(43-49), `dmt = c.Literal(...)`(112), `_in = e => Ei(dmt, e.카테고리숫자코드)`(461). `Ei`는 TypeBox `Value.Check`이므로 문자열 동일 비교입니다.
- `restored/modules/index/첩건본인부담률구분코드.js` `oBt`(C0005, 2074-2086), `tBt`(시범사업 청구 검사 묶음, 1953-1993)
- `restored/modules/index/local.js:730-772` 실시간 청구 경고 `HFt`
- `승인여부`를 참으로 만드는 곳: 심평원 첩약 제출 화면(`HiraSubmitItemsViewChubyakTable` 등, 데스크톱 앱 `hiraDynamicServiceProxy` 경유)과 진료 aside `건보첩약` 탭의 첩약 제출.

## 로직

완료 버튼(`finishPatientRecord(d = "치료", f)`):

1. `validate산정특례특정기호` 실패, 진료데이터 없음, 이미 처리 중이면 중단.
2. `g = is비대면LITE진료 && XS(liteOrderData)`. 비대면 LITE인데 `g`가 거짓이면 저장만 하고 끝.
3. `u(진료Id, g, skipPickupCheck)`:
   - `g`가 참(비대면 LITE 주문): 방문수령 일정이 필요하면 중단, 아니면 **저장·승인 검사 없이** `PATCH /record/{id}/done`.
   - `vx`(계정 서비스가 정확히 `["lite"]`): 저장 후 done. **승인 검사 없음.**
   - 그 밖: `checkNhicChubyakApproval()`이 거짓이면 중단(저장도 안 함). 참이면 저장 → done → 추나 자동 승인.
4. `checkNhicChubyakApproval`: `진료내용.처방.filter(카테고리숫자코드 === "35001001").every(승인여부)`. 해당 라인이 없으면 `every`가 참이므로 통과. `승인여부`가 없으면(`undefined`) 미승인.
   - 대상은 `35001001`(첩약)뿐입니다. `35001002` 한약재, `35002001` 조제·탕전료, `35003001` 심층변증방제기술료, `35004001` 시범사업약재는 보지 않습니다.

청구 검사 `oBt`(C0005): 처방에서 첫 `35001001` 라인을 `find`해 `승인여부`가 거짓이면 `{ 에러코드: "C0005", 원인제공자Ids: [그 라인 id] }`. `tBt`는 `현재진료.한방첩약시범사업`이 있는 건보·급여 진료에서 호출되지만, `HFt`가 마지막에 허용 코드 집합(`C0001`, `C0003` 등)으로 거르므로 진료 화면에는 C0005가 나오지 않습니다. 청구함(`ClaimV2InboxViewDangerAutoFix`)은 서버가 준 C0005에 대해 "첩약 건보" 제출 탭을 엽니다.

## 원본 코드

`restored/components/treatment/TreatmentViewBoard.helpers-10.js:309-316` (`// Restored from unminified/TreatmentViewBoard.js:22369-22665`, 해당 부분 22656-22663)

```js
checkNhicChubyakApproval: async () => 진료내용.value.처방.filter(_in).every(c => c.승인여부) ? true : (await o.show(BaseConfirmDialog, {
  title: `진료 완료 전
첩약 내역을 심평원에 제출해 주세요.`,
  theme: "default",
  teleportTo: "#popups",
  actionButtonText: "확인",
  footerJustify: "between"
}), false)
```

`restored/components/treatment/TreatmentViewBoard.helpers-11.js:45-85` (`// Restored from unminified/TreatmentViewBoard.js:22778-22887`)

```js
const u = async (d, f, g) => {
  if (f) {
    const y = liteOrderData.value;
    if (QS(y) && !YS(y) && !g) {
      n.on방문수령일정필요();
      return false;
    } else {
      await mutateAsync(d);
      return true;
    }
  }
  if (vx.value) {
    await n.savePatientRecord({ withoutToast: true, withoutLoading: true, 진찰료중복안내: true });
    if (n.진찰료중복으로저장중단됨.value) {
      return false;
    } else {
      await mutateAsync(d);
      return true;
    }
  }
  if (!(await n.checkNhicChubyakApproval())) {
    return false;
  }
  const x = await n.savePatientRecord({ withoutToast: true, withoutLoading: true, 진찰료중복안내: true });
  if (x) {
    await mutateAsync(x);
    n.autoApproveChuna();
    return true;
  } else {
    return false;
  }
};
```

`restored/modules/index/첩건본인부담률구분코드.js:2074-2086` (`// Restored from unminified/index.js:121672-123969`, 해당 부분 123658-123670)

```js
function oBt(e) {
  const t = e.진료처방.find(진료처방항목$ => 진료처방항목$.카테고리숫자코드 === me.한방첩약시범사업.첩약);
  if (!t) {
    return;
  }
  const 승인여부$ = t.승인여부;
  if (t && !승인여부$) {
    return { 에러코드: "C0005", 원인제공자Ids: [t.id] };
  }
}
```

## 픽스처

[`test/fixtures/rules/pilot-herbal-approval-required.json`](../../../test/fixtures/rules/pilot-herbal-approval-required.json) — 15건 (실행 11, 추적 4).

| 대상 | 처방 | 결과 |
|---|---|---|
| 완료 검사 | 첩약 라인 없음 / 빈 목록 | 통과 |
| 완료 검사 | 35001001 승인 | 통과 |
| 완료 검사 | 35001001 미승인 / `승인여부` 없음 | 차단 |
| 완료 검사 | 승인 1 + 미승인 1 | 차단 |
| 완료 검사 | 35001001 승인 + 35002001·35003001·35001002 미승인 | 통과 |
| C0005 | 첫 라인 미승인 | `C0005`, 원인 `[id]` |
| C0005 | 첫 라인 승인 + 둘째 미승인 | `undefined` |
| 흐름 (추적) | LITE 단독 계정 / 비대면 LITE 주문 | 검사 안 함 |
| 흐름 (추적) | 일반 계정 + 미승인 | 대화상자, 저장·완료 안 함 |
| 실시간 경고 (추적) | 건보 + 시범사업 + 미승인 | 경고 목록에 C0005 없음 |

## 서버 이전 시 주의

- **승인 상태의 출처:** `승인여부`는 클라이언트가 처방 라인에 실어 보내는 값입니다. 서버는 심평원 제출 작업 결과로 승인 상태를 직접 관리해야 하며 클라이언트 플래그를 믿으면 안 됩니다.
- **검사 대상 범위:** `35001001` 라인만 봅니다. 조제·탕전료, 심층변증방제기술료 등 같은 시범사업 수가는 승인 대상이 아닌 것으로 보이나 확인이 필요합니다.
- **예외 경로:** LITE 단독 계정과 비대면 LITE 주문 완료는 검사를 건너뜁니다. 서버에서도 예외로 둘지 정해야 합니다.
- **완료 검사와 청구 검사 차이:** 완료 검사는 모든 라인(`every`), C0005는 첫 라인(`find`)만 봅니다. 한 진료에 첩약 라인이 둘인 경우 결과가 다릅니다.
- **C0005 노출:** 진료 화면 실시간 경고에서는 C0005가 걸러집니다. 청구함의 C0005는 서버 데이터에서 오는 것으로 보여, 서버에 이미 같은 검사가 있을 수 있습니다.
- `tBt`가 계산하지만 결과를 버리는 다른 시범사업 청구 검사(C0002, C0004, C0006-C0012)는 이 문서 범위 밖입니다. 별도 규칙으로 정리가 필요합니다.
