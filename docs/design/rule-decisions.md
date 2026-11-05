# 규칙 결정

현행 클라이언트 규칙 25개의 열린 질문 163개에 대한 서버 결정입니다 ([#4](https://github.com/cbcruk/hemr/issues/4)). 근거 자료는 [규칙 문서](../reference/rules/README.md)와 픽스처(`test/fixtures/rules/`), 이 폴더의 재설계 문서, [레거시 매뉴얼 요약](../reference/spec/README.md)입니다.

> **상태: 초안.** 모든 질문에 권장안을 붙였습니다. 사용자 확인이 필요한 질문 중 원무 영역은 정했고(2026-11-05), 나머지 영역은 아직입니다. [사용자 확인 필요](#사용자-확인-필요) 항목을 정하면 권장안을 결정으로 바꾸고, 따를 케이스와 바뀌는 케이스를 서버 테스트로 옮깁니다.

## 읽는 법

- **따름:** 현행 동작을 서버가 그대로 재현합니다. 해당 픽스처 케이스를 그대로 서버 테스트로 씁니다
- **바꿈:** 현행이 버그이거나 화면마다 달라서 서버가 다르게 동작합니다. 영향받는 케이스는 각 규칙의 **바뀌는 케이스**에 있고, 서버 테스트에서는 기대값을 바꿔 씁니다
- **보류:** 외부 사실(심평원 고시, 외부 서비스 동작 등)을 확인해야 정할 수 있습니다. 확인 전까지 해당 케이스는 서버 테스트로 옮기지 않습니다
- 질문 번호는 픽스처 `openQuestions` 순서입니다

## 요약

| 영역 | 규칙 | 질문 | 따름 | 바꿈 | 보류 |
|---|---|---:|---:|---:|---:|
| 원무 | [visit-status-transitions](#visit-status-transitions) | 6 | 0 | 6 | 0 |
| 원무 | [check-in-validation](#check-in-validation) | 9 | 3 | 5 | 1 |
| 원무 | [appointment-acceptance](#appointment-acceptance) | 9 | 2 | 7 | 0 |
| 원무 | [appointment-no-show](#appointment-no-show) | 4 | 2 | 2 | 0 |
| 원무 | [checkout-settlement](#checkout-settlement) | 8 | 3 | 4 | 1 |
| 원무 | [cash-drawer-expected-closing](#cash-drawer-expected-closing) | 5 | 2 | 3 | 0 |
| 진찰료·수가 | [consultation-fee-code](#consultation-fee-code) | 8 | 2 | 4 | 2 |
| 진찰료·수가 | [procedure-fee-modifiers](#procedure-fee-modifiers) | 7 | 2 | 5 | 0 |
| 진찰료·수가 | [duplicate-consultation-fee](#duplicate-consultation-fee) | 5 | 1 | 4 | 0 |
| 진찰료·수가 | [auto-insurance-same-day-consultation](#auto-insurance-same-day-consultation) | 6 | 1 | 5 | 0 |
| 진찰료·수가 | [coverage-category-band](#coverage-category-band) | 5 | 2 | 3 | 0 |
| 진찰료·수가 | [reference-version-selection](#reference-version-selection) | 6 | 0 | 6 | 0 |
| 진찰료·수가 | [special-case-code-match](#special-case-code-match) | 6 | 1 | 4 | 1 |
| 진찰료·수가 | [telemedicine-fee-lines](#telemedicine-fee-lines) | 8 | 4 | 4 | 0 |
| 추나 | [chuna-annual-limit](#chuna-annual-limit) | 8 | 0 | 7 | 1 |
| 추나 | [chuna-auto-approval](#chuna-auto-approval) | 5 | 1 | 4 | 0 |
| 첩약 시범사업 | [pilot-herbal-diagnosis-limit](#pilot-herbal-diagnosis-limit) | 9 | 1 | 7 | 1 |
| 첩약 시범사업 | [pilot-herbal-claim-checks](#pilot-herbal-claim-checks) | 12 | 2 | 9 | 1 |
| 첩약 시범사업 | [pilot-herbal-doctor-limit](#pilot-herbal-doctor-limit) | 5 | 1 | 3 | 1 |
| 첩약 시범사업 | [pilot-herbal-approval-required](#pilot-herbal-approval-required) | 5 | 1 | 4 | 0 |
| 탕전·치료실·설정·CRM | [external-herbal-precheck](#external-herbal-precheck) | 6 | 1 | 4 | 1 |
| 탕전·치료실·설정·CRM | [procedure-timer](#procedure-timer) | 5 | 2 | 3 | 0 |
| 탕전·치료실·설정·CRM | [settings-validation](#settings-validation) | 6 | 2 | 4 | 0 |
| 탕전·치료실·설정·CRM | [crm-send-window](#crm-send-window) | 5 | 2 | 3 | 0 |
| 탕전·치료실·설정·CRM | [message-type-selection](#message-type-selection) | 5 | 2 | 2 | 1 |
| | **합계** | **163** | **40** | **112** | **11** |

## 사용자 확인 필요

권장안이 업무 정책이나 법규 해석에 달려 있어 코드만으로 정할 수 없는 질문 32개입니다. 권장안과 근거는 각 규칙의 표에 있습니다. **결정**이 "확정"이면 권장안대로 정한 것입니다.

| 규칙 | # | 정할 것 | 결정 |
|---|---|---|---|
| [visit-status-transitions](#visit-status-transitions) | 5 | 과거 날짜 내원에 어떤 전이를 허용할지 (전날 `수납`에 남은 내원의 정리 방식) | 확정 (2026-11-05) |
| [check-in-validation](#check-in-validation) | 1 | 급여제한 코드별 처리. 특히 `04` 사망자·`05` 국외이민자를 무자격과 같이 볼지 | 확정 (2026-11-05) |
| | 4 | 의료급여 `B006`/`B008` 허용 여부 | 보류: 공단 코드표 확인 |
| | 9 | 본인확인이 필요한데 하지 않은 `NHIS` 접수를 막을지 경고만 할지, 법령 예외(진료의뢰·회송, 응급, 거동 불편)를 입력받을지 | 확정 (2026-11-05). 응급·진료의뢰 등 추가 예외는 나중에 입력 필드로 |
| [appointment-acceptance](#appointment-acceptance) | 5 | 점심 휴게도 시간대 구분도 없는 진료의의 반나절 휴진 경계 | 확정 (2026-11-05). 둘 다 없으면 12:00 |
| | 9 | 120분 상한을 고정할지 설정 값으로 둘지 | 확정 (2026-11-05) |
| [appointment-no-show](#appointment-no-show) | 2 | 부도 기준 진료 마감을 병원 기준으로 할지 진료의 기준으로 할지, 휴진일 예약을 부도로 볼지 | 확정 (2026-11-05) |
| | 4 | 옛 설정 값을 올림으로 옮길지 가장 가까운 값으로 옮길지 | 확정 (2026-11-05) |
| [checkout-settlement](#checkout-settlement) | 4 | 제주 지원(4·3 유족·해녀) 상한이 급여 본인부담만인지 | 확정 (2026-11-05) |
| [consultation-fee-code](#consultation-fee-code) | 2 | 토요 가산을 두 줄로 청구하는지 |  |
| | 4 | N일째 되는 날을 재진에 넣을지 (권장 ≤ N) |  |
| | 5 | `초진진찰료산정기준일` 기본값 0을 이관 때 30으로 바꿀지 |  |
| [duplicate-consultation-fee](#duplicate-consultation-fee) | 1 | 같은 방식(대면 2건, 비대면 2건) 중복까지 판정할지 |  |
| [auto-insurance-same-day-consultation](#auto-insurance-same-day-consultation) | 1 | 같은 사고로 하루 두 번 진료할 때 진찰료를 두 번 받을 수 있는지 |  |
| | 5 | `10400` 등 `10` 대역의 다른 진찰료도 2차 진료에서 뺄지 |  |
| [coverage-category-band](#coverage-category-band) | 1 | 보험구분·처방 카테고리 대역 일치를 신규 규칙으로 넣을지 (권장: 넣지 않음, 그러면 [clinical.md](clinical.md) 대역 서술 수정) |  |
| [special-case-code-match](#special-case-code-match) | 2 | 극희귀(11)·상세불명희귀(13) 등록자에게 특정기호가 필수인지 |  |
| [chuna-annual-limit](#chuna-annual-limit) | 1 | "21번째부터 불가" 해석이 고시 원문과 맞는지 |  |
| | 2 | 산재 추나에도 연 20회 한도가 있는지 |  |
| | 4 | 자보 20회 초과를 경고만 할지 막을지 (권장: 경고) |  |
| [chuna-auto-approval](#chuna-auto-approval) | 3 | 제출 전에 알 수 있는 실패(상병·면허 없음)로 완료를 막을지 (권장: 막지 않고 `FAILED`로 남김) |  |
| | 5 | 자보 20회 초과 시 자동 제출을 계속할지 (chuna-annual-limit 4와 같이 결정) |  |
| [pilot-herbal-diagnosis-limit](#pilot-herbal-diagnosis-limit) | 1 | 이미 질환 3개 이력이 있을 때 기존 질환 처방을 막을지 |  |
| | 6 | 등록 여부 미확인 이력을 막을지 경고만 할지 |  |
| [pilot-herbal-claim-checks](#pilot-herbal-claim-checks) | 1 | 화면에 없던 청구 경고 9종을 모두 켤지 |  |
| | 2 | C0004 기준이 날짜 간격 10일인지 "처방일수 10일당 1회"인지 |  |
| [pilot-herbal-approval-required](#pilot-herbal-approval-required) | 2 | 비대면 SOO 주문 완료에도 승인 검사를 적용할지 |  |
| [external-herbal-precheck](#external-herbal-precheck) | 4 | 복약지도서 첨부가 원외탕전 주문의 필수 요건인지 |  |
| [settings-validation](#settings-validation) | 3 | 패키지 `포함` 항목 단가를 VAT 포함 진료비로 볼지 공급가로 볼지 |  |
| [crm-send-window](#crm-send-window) | 1 | 이관 병원의 야간 기본값을 법정 21:00으로 둘지 현행 20:30/20:50으로 둘지 |  |
| | 4 | 야간에 걸린 자동 연락을 건너뛸지 08:00으로 미룰지 |  |

## 새로 붙인 이름

권장안에서 처음 쓰는 오류·경고 코드와 필드입니다. 결정이 확정되면 해당 도메인 문서의 오류 목록에 옮깁니다.

| 이름 | 종류 | 쓰는 곳 |
|---|---|---|
| `IDENTITY_VERIFICATION_REQUIRED` | 오류 | [check-in-validation](#check-in-validation) 본인확인 |
| `CAPACITY_EXCEEDED` | acknowledge 코드 | [appointment-acceptance](#appointment-acceptance) 예약 한도 초과 |
| `FEE_CODE_NOT_IN_MASTER` | 경고 | [consultation-fee-code](#consultation-fee-code), [procedure-fee-modifiers](#procedure-fee-modifiers) |
| `conflictingEncounterIds[]` | 위반 상세 필드 | [duplicate-consultation-fee](#duplicate-consultation-fee) |
| `REFERENCE_DATA_UNAVAILABLE` | 422 오류 | [reference-version-selection](#reference-version-selection) |
| `SPECIAL_CASE_CODE_MISMATCH` | 오류 | [special-case-code-match](#special-case-code-match) |
| `CHUNA_USAGE_UNKNOWN` | 경고 | [chuna-annual-limit](#chuna-annual-limit) |
| `DIAGNOSIS_MISMATCH` | 제출 실패 사유 | [chuna-auto-approval](#chuna-auto-approval) |

## 구현과 다른 점

이미 구현한 [내원 상태 전이](../../src/modules/front-desk/visits/visit-status.ts)와 권장안이 다른 점입니다 ([visit-status-transitions](#visit-status-transitions)).

- **연쇄 취소 판정:** 구현은 상태(`IN_TREATMENT`·`COMPLETED`)로 `cascade`를 요구합니다. 설계는 진료·수납 데이터 유무로 판정하므로, 진료 기록이 있는 `AWAITING_PAYMENT`도 409가 되어야 합니다
- **`:reopen {reason, then}`:** 설계의 한 번 호출 형태를 구현 payload가 아직 받지 않습니다
- **동시성:** `If-Match`/`version` 검사가 없습니다
- **과거 날짜:** 과거 날짜 내원의 흐름 전이를 막지 않습니다 (사용자 확인 필요 5와 같이 결정)

## 원무

### visit-status-transitions

[규칙 문서](../reference/rules/visit-status-transitions.md) · 케이스 37 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | `수납완료` 칸이 수납 기록 있는 `대기` 카드를 받지만 처리 분기가 없어 아무 일도 없는 것을 어떻게 할까요 | **바꿈:** `WAITING`에서 완료로 가는 길은 `:checkout` 하나뿐입니다. 서버는 상태만 바꾸는 요청을 받지 않습니다 | 설계가 이 동작을 버그로 적었고, 전이 표에 `WAITING --> COMPLETED: :checkout`가 있습니다 ([상태](../design/front-desk.md#상태-1)). `visit-status.ts`의 `WAITING.CHECKOUT`과도 같습니다 |
| 2 | `대기`/`치료` → `수납완료`를 수납 기록 유무로 다르게 처리하는 것(패널 열기, 거부, 불가)을 하나로 정할까요 | **바꿈:** `WAITING`·`IN_TREATMENT`·`AWAITING_PAYMENT`에서 `COMPLETED`로 가는 길은 `:checkout`(영수증 생성 + 완료를 한 트랜잭션에서) 하나뿐입니다. 기록이 있다는 이유만으로 상태를 바꾸는 경로는 두지 않습니다 | [수납 커맨드](../design/front-desk.md#수납-커맨드) 5단계에서 수납이 내원을 `COMPLETED`로 만듭니다. 구현의 `CHECKOUT` 전이와 같습니다. 이미 낸 돈으로 남은 금액이 0일 때 `:checkout`이 새 결제 없이 완료하는지는 수납 구현에서 정해야 합니다 |
| 3 | `수납완료`에서 `대기`/`치료`/`수납`으로 조건 없이 되돌리는 것을 허용할까요 | **바꿈:** `COMPLETED`에서는 `:reopen {reason}`(→ `AWAITING_PAYMENT`)과 `:cancel`만 받습니다. `대기`/`치료`로 옮기려면 `:reopen` 다음에 `:return-to-waiting`/`:start-treatment`를 보냅니다 | [상태](../design/front-desk.md#상태-1)의 "현행 수납완료 → 대기/치료 이동"과 구현 `COMPLETED: { REOPEN, CANCEL }`이 같습니다. 설계의 `:reopen {reason, then}` 한 번 호출은 구현 payload(`reason`만)에 아직 없습니다 |
| 4 | 취소 상태 없이 `대기` 카드에서만 내원을 삭제하는 것을 바꿀까요 | **바꿈:** 삭제 대신 `:cancel {reason}`으로 모든 활성 상태에서 `CANCELED`로 남깁니다. 진료 내용이나 수납이 있으면 `cascade` 없이는 409 `VISIT_HAS_CLINICAL_DATA`입니다 | [연쇄 취소](../design/front-desk.md#연쇄-취소), [결정 D3](../design/review.md#결정-필요). 구현은 `IN_TREATMENT`·`COMPLETED`라는 상태로만 `cascade`를 요구합니다. 설계는 데이터 유무로 판단하므로, 진료 기록이 있는 `AWAITING_PAYMENT`도 409가 되어야 합니다. 이 데이터 검사는 아직 핸들러에 없습니다 |
| 5 | 과거 데스크 날짜에서 드래그 이동을 허용할까요 | **바꿈:** 서버는 `date`가 병원 시간대 오늘보다 이전인 내원에 흐름 전이(`:start-treatment`, `:return-to-waiting`, `:send-to-checkout`)를 보내면 422로 막습니다. 사후 정리용 `:checkout`, `:reopen`, `:cancel`은 허용합니다 | 현행 카드 메뉴는 과거 날짜에서 `수납 기록` 같은 항목만 남깁니다. 드래그에 날짜 확인이 없는 것은 빠뜨린 것으로 봅니다. 구현에는 날짜 검사가 없습니다. 오늘 판정은 오프라인 큐와 같이 `occurredAt` 기준입니다 ([offline.md](../design/offline.md#커맨드-큐)) |
| 6 | 드래그·메뉴만 보내는 `이전상태`를 동시성 검사에 쓸까요 | **바꿈:** `이전상태` 대신 내원 `version`을 `If-Match`로 받아, 다르면 412를 돌려줍니다. 전이 가능 여부는 서버가 저장된 현재 상태로 판정합니다 | [동시성](../design/conventions.md#동시성)과 [커맨드](../design/conventions.md#커맨드)(`PATCH {status}` 금지)를 따릅니다. 수납만은 `quoteId`로 검증합니다 ([수납 커맨드](../design/front-desk.md#수납-커맨드)). 구현에는 아직 `If-Match`가 없습니다 |

**바뀌는 케이스:**
- `drag 대기 -> 수납완료 (수납존재여부=false)`: 드롭 불가 → 드롭을 받아 수납 패널을 열고 `:checkout`으로 완료
- `drag 대기 -> 수납완료 (수납존재여부=true)`: 효과 없음 → 수납 패널을 열고 `:checkout`으로 완료
- `drag 치료 -> 수납완료 (수납존재여부=false)`: 드롭 불가 → 수납 패널을 열고 `:checkout`으로 완료
- `drag 치료 -> 수납완료 (수납존재여부=true)`: `PATCH {상태: 수납완료}` → `:checkout`으로 완료 (상태만 바꾸는 요청 없음)
- `drag 수납 -> 수납완료 (수납존재여부=true)`: `PATCH {상태: 수납완료}` → `:checkout`으로 완료
- `drag 수납완료 -> 대기 (수납존재여부=false)`, `drag 수납완료 -> 대기 (수납존재여부=true)`: `PATCH {상태: 대기}` → `:reopen {reason}` + `:return-to-waiting`
- `drag 수납완료 -> 치료 (수납존재여부=false)`, `drag 수납완료 -> 치료 (수납존재여부=true)`: 베드 모달 바로 열기 → `:reopen {reason}` 다음에 `:start-treatment`
- `drag 수납완료 -> 수납 (수납존재여부=false)`, `drag 수납완료 -> 수납 (수납존재여부=true)`: `PATCH {상태: 수납}` → `:reopen {reason}`
- `접수 취소 exists only on 대기 cards`: `대기`에서만 `DELETE` → 모든 활성 상태에서 `:cancel {reason}`(`CANCELED`로 남음). 진료 내용·수납이 있으면 `cascade` 필요
- `bed modal confirm without a bed sends 상태 치료`, `bed modal confirm with a bed assigns the bed instead of PATCHing status`: 두 경로 모두 `:start-treatment {roomId?, bedNumber?}` 한 번 호출 ([치료 시작](../design/front-desk.md#치료-시작))
- 그 밖에 `PATCH /desk/waiting/{id}` `{상태, 이전상태}`를 기대하는 이동 케이스는 결과 상태는 같지만, 요청이 해당 커맨드 + `If-Match`로 바뀝니다

**사용자 확인 필요:** 5. 과거 날짜 내원에서 어떤 전이를 허용할지는 업무 운영 정책입니다. 전날 `수납`에 남은 내원을 다음 날 어떻게 정리하는지 확인해야 합니다.

### check-in-validation

[규칙 문서](../reference/rules/check-in-validation.md) · 케이스 74 · 질문 9

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 급여제한 코드 `01`(무자격)만 건보 불가로 보고 `02`~`05`는 그대로 두는 것을 서버도 따를까요 | **바꿈:** `01` 무자격, `04` 사망자, `05` 국외이민자는 `NHIS` 접수를 422 `NHIS_BENEFIT_RESTRICTED`로 막습니다. `02` 체납 6회 이상과 `03` 외국인·재외국민 체납은 `NHIS`를 유지하고 `eligibility`에 급여제한 표시를 남겨, 전액 수납하고 청구도 보내게 합니다 | OK차트는 무자격자만 `일반`으로 돌리고, 급여제한자는 자격구분을 유지한 채 전액을 받고 청구명세서를 송신합니다 ([desk.md](../reference/spec/desk.md) "무자격자·급여제한자", "현행과 다른 점"). `04`/`05`는 자격 상실과 같다고 보고 묶었습니다 |
| 2 | 경고와 함께 자동으로 `일반`으로 바꾸는 것 대신 거부할까요 | **바꿈:** 서버는 바꾸지 않고 422 `NHIS_BENEFIT_RESTRICTED`를 돌려줍니다. 클라이언트는 조회 직후 현행처럼 미리 `SELF_PAY`를 골라 둘 수 있습니다 | [접수 커맨드](../design/front-desk.md#접수-커맨드) 검증 표에 이미 정한 오류입니다. 서버가 보험구분을 몰래 바꾸면 요청과 저장 값이 달라집니다 |
| 3 | 선택의료기관 게이트를 의료급여(7·8) + `M001/M002/B001/B002` + 선택기관 1~4에 우리 기관 없음으로 한정할까요 | **따름** | 설계 표가 같은 조건으로 `SELECTED_INSTITUTION_REQUIRED`를 정했습니다 ([접수 커맨드](../design/front-desk.md#접수-커맨드)). OK차트도 선택기관이 아니면 전액 본인부담, 의뢰서가 있으면 `B005` + 의뢰기관으로 승인합니다 ([desk.md](../reference/spec/desk.md) "의료급여 본인부담과 승인") |
| 4 | `B006`/`B008`을 기관과 함께 골라도 게이트에서 막히는데 `AD`는 허용하는 불일치를 어떻게 할까요 | **보류:** 의료급여 본인부담 코드 `B006`/`B008`의 뜻과 선택기관 적용자에게 쓸 수 있는지 공단 코드표에서 확인해야 합니다. 확인 전에는 게이트를 현행대로 둡니다(`U001`, 또는 `B005` + 기관만 통과) | 근거 문서에는 `B005`/`B006`이 타기관 의뢰라는 사실만 있습니다 ([claim.md](../reference/spec/claim.md)). `B008`은 근거가 없습니다 |
| 5 | 자보 한도 검사를 `누적 > 한도`일 때만, 한도가 0·빈 값이면 생략하는 것을 따를까요 | **따름:** `fullSelfPay`가 아니고 한도가 0보다 크며 누적 진료비가 한도보다 크면(`>`) 422 `AUTO_INSURANCE_LIMIT_EXCEEDED`입니다. 같으면 통과합니다. 한도는 정수 필드라 숫자가 아닌 값은 이관할 때 `null`(한도 없음)로 바꿉니다 | 설계 표와 같습니다 ([접수 커맨드](../design/front-desk.md#접수-커맨드)) |
| 6 | 한도 초과 다이얼로그를 닫으면 접수가 진행될 수도 있는 것을 어떻게 할까요 | **바꿈:** 서버는 한도 초과를 항상 422로 막습니다. 닫기 경로로 통과하는 일은 없습니다 | 설계가 이 검사를 경고가 아닌 422로 정했습니다. `acknowledge` 대상에 넣지 않았습니다 |
| 7 | 보증 만료를 검증하지 않는 것을 새 규칙 `AUTO_INSURANCE_CASE_EXPIRED`로 바꿀까요 | **바꿈:** 보증 종료일이 병원 시간대 오늘보다 이전이면 422 `AUTO_INSURANCE_CASE_EXPIRED`입니다. 종료일 당일은 유효로 봅니다 | 설계가 신규 규칙으로 정했습니다 ([접수 커맨드](../design/front-desk.md#접수-커맨드)). 종료일 당일까지 유효로 보면 현행 미리 채우기 경계(`보증종료일자 >= 오늘`)와 같아집니다 |
| 8 | 오늘 예약만 접수할 수 있는 것이 버튼 비활성뿐인 것을 서버에서도 막을까요 | **바꿈:** `appointmentId`가 있으면 예약 `date`가 접수 `date`와 같아야 합니다. 다르면 422 `APPOINTMENT_NOT_TODAY`입니다. 오늘은 `occurredAt`의 병원 시간대 날짜로 봅니다 | 설계 표에 정한 오류입니다. 오프라인 접수도 `occurredAt` 기준입니다 ([offline.md](../design/offline.md#커맨드-큐)) |
| 9 | 본인확인 필요·예외(6개월, 19세 미만, 임산부, 예외 `Y`, 건보 100%) 판정을 따를까요 | **따름:** 경계는 "오늘 − 6개월 ≤ 마지막 확인일"을 유효로 봅니다(같은 날 포함). 필요한데 확인하지 않은 `NHIS` 접수는 422로 막습니다. 만 나이는 클라이언트 `mx`를 옮기지 않고 서버가 생년월일과 접수일로 계산합니다 | 본인확인은 법적 의무이고, 예외는 시행규칙 제7조의2입니다 ([desk.md](../reference/spec/desk.md) "본인확인 의무"). 설계 검증 표에는 아직 이 행이 없어 오류 코드(예: `IDENTITY_VERIFICATION_REQUIRED`)를 추가해야 합니다. 나이는 [consultation-fee-code](../reference/rules/consultation-fee-code.md)의 월 계산 버그를 되풀이하지 않게 합니다 |

**바뀌는 케이스:**
- `benefit restriction: 건보 with 급여제한여부="01"`: 서버가 `일반`으로 바꾸고 경고 → `NHIS` 요청이면 422 `NHIS_BENEFIT_RESTRICTED`(보험구분을 바꾸지 않음)
- `benefit restriction: 건보 with 급여제한여부="04"`, `benefit restriction: 건보 with 급여제한여부="05"`: `건보` 그대로 통과 → 422 `NHIS_BENEFIT_RESTRICTED`
- `benefit restriction: 건보 with 급여제한여부="02"`, `benefit restriction: 건보 with 급여제한여부="03"`: `건보` 유지는 같고, 급여제한 표시가 새로 남음(전액 수납·청구 송신)

**사용자 확인 필요:**
- 1: 급여제한 코드별 처리(특히 `04` 사망자, `05` 국외이민자를 무자격과 같이 볼지)는 공단 지침과 업무 판단입니다
- 4: `B006`/`B008` 허용 여부는 의료급여 본인부담 코드 고시 확인이 필요합니다
- 9: 법령 예외 중 진료의뢰·회송, 응급환자, 거동이 현저히 불편한 자는 현행에 없습니다. 예외 입력을 추가할지, 위반 시 막을지 경고만 할지는 법규 판단입니다

### appointment-acceptance

[규칙 문서](../reference/rules/appointment-acceptance.md) · 케이스 78 · 질문 9

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 한도 초과 예약을 서버가 막을까요 (현행은 표시만 하고 409는 중복일 때만) | **바꿈:** 한도 초과는 `warnings`로 돌려주고, 요청에 `acknowledge: ["CAPACITY_EXCEEDED"]`가 있을 때만 저장합니다. 경고를 무시한 사실은 이력에 남깁니다 | [리소스](../design/front-desk.md#리소스) "서버 검증"이 수용 한도 초과를 "확인 받으면 허용"으로 정했습니다 |
| 2 | 한도를 1로 줄이는 판정과 예약 수가 서로 다른 필터를 쓰는 것을 고칠까요 | **바꿈:** 둘 다 같은 집합(`BOOKED`·`ARRIVED` 예약과 그 점유)을 씁니다. 대기·거절된 외부 요청은 `BookingRequest`라서 예약이 아니므로 한도 축소에도, 예약 수에도 들어가지 않습니다 | 설계가 외부 요청을 별도 리소스로 나눴습니다 ([외부 예약 요청](../design/front-desk.md#외부-예약-요청)). 규칙 문서도 이 동작을 버그로 봅니다 |
| 3 | 플래너(`>`)와 사이드 패널(`>=`) 중 어느 경계를 서버가 쓸까요 | **따름:** 새 예약을 더한 수 `기존 유효 예약 + 점유 + 1 > 한도`이면 초과입니다. 사이드 패널의 "기존 수 ≥ 한도면 가득 참"과 플래너의 "현재 수 > 한도면 초과"는 같은 규칙을 다른 시점에서 본 것입니다 | 두 화면은 새 예약 전·후를 보는 차이일 뿐 서로 어긋나지 않습니다. 셀 수는 2번에서 정한 필터로 셉니다 |
| 4 | 현재 분 슬롯을 과거로 볼까요 (`isPastDateTime`은 과거, 사이드 패널은 제공) | **바꿈:** 서버는 `startTime < 현재 시각(분 단위로 버림)`이면 422 `APPOINTMENT_IN_PAST`입니다. 현재 분 슬롯은 허용합니다 | 새 예약을 만드는 기본 경로인 사이드 패널이 현재 분 슬롯을 보여 줍니다. 서버 규칙 하나로 정하고 플래너 드래그도 같은 규칙을 씁니다 |
| 5 | 반나절 휴진을 점심 휴게로 나누고, 점심이 없으면 하루 전체를 오전으로 보는 것을 따를까요 | **바꿈:** 반나절 휴진은 그 진료의 근무 일정의 시간대 구분(`오전`/`오후`)으로 판정합니다. 시간대 구분이 없을 때만 점심 휴게 시작·종료로 나누고, 점심도 없으면 12:00을 경계로 봅니다. 점심이 없다고 `오전 휴진`이 하루 전체를 막거나 `오후 휴진`이 아무것도 막지 않는 일은 없게 합니다 | 근무 일정이 이미 `시간대`(오전/오후/야간)를 갖고, 사이드 패널은 그 값으로 구간을 나눕니다. 점심이 없을 때의 현행 결과는 휴진 의미와 어긋납니다 |
| 6 | 의사 휴진을 사이드 패널은 경고만, 드래그는 막는 것을 하나로 정할까요 | **바꿈:** 생성·변경 모두 422 `DOCTOR_OFF`로 막습니다 | 설계가 `DOCTOR_OFF`를 막는 오류로 정했습니다 ([리소스](../design/front-desk.md#리소스)) |
| 7 | 차단 슬롯을 사이드 패널은 못 고르게, 드래그는 확인 후 허용하는 것을 하나로 정할까요 | **바꿈:** 서버는 차단 슬롯을 `acknowledge: ["SLOT_BLOCKED"]`가 있을 때만 저장하고, 없으면 422 `SLOT_BLOCKED`입니다. 사이드 패널이 차단 슬롯을 계속 못 고르게 둘지는 클라이언트가 정합니다(서버 범위 아님) | 설계가 차단 시간을 "확인 받으면 허용"으로 정했습니다. 휴게 시간은 확인 없이 막습니다 |
| 8 | 서버의 점유 가중(`추가예약제한` ON이면 한도만큼) 규칙을 옮길까요 | **바꿈:** 가중 없이 점유 1건을 1로 세고, 셀에 `exclusiveBooking` 진료항목이 하나라도 있으면 한도를 1로 둡니다. 가득 찼는지 판단하는 결과는 가중 방식과 같습니다 | 설계 수용 한도 규칙이 진료항목 단위 `exclusiveBooking`으로 정해져 있습니다 ([리소스](../design/front-desk.md#리소스)). 현행 플래너는 예약 단위 플래그를 봐서 사이드 패널(진료항목 단위)과 위치가 다른데, 진료항목 단위로 통일합니다 |
| 9 | 사이드 패널의 최대 120분 예약 길이를 서버도 강제할까요 | **따름:** `durationMinutes`는 예약시간단위의 배수이고 120분 이하여야 합니다. 어기면 422입니다 | 현행 화면 제약을 서버 검증으로 옮깁니다. 이관 데이터에 120분을 넘는 예약이 있으면 읽기는 허용하고, 변경할 때만 검사합니다 |

**바뀌는 케이스:**
- `create: overbooked or 추가예약제한 slot is still submitted (warning only)`: `acknowledge` 없이는 저장되지 않고 `warnings: [CAPACITY_EXCEEDED]`를 돌려줌. 있으면 저장
- `drop: overbooked slot is not checked`: 일정 변경도 한도 초과 경고를 돌려주고 `acknowledge`가 있어야 저장
- `exclusive: rejected external request with 추가예약제한 still reduces capacity (filter mismatch)`: 거절된 요청은 예약이 아니므로 `예약가능건수` 1 → 5
- `past: today slot equal to now (current minute) counts as past`: `true` → `false`
- `doctor off: 오후 휴진 with no lunch configured never blocks`: 17:00이 오후 시간대이면 `false` → `true`
- `doctor off: 오전 휴진 with no lunch configured blocks all day`: 17:00이 오후 시간대이면 `true` → `false`
- `create: doctor with 휴진일태그 shows warning but slots stay selectable`: 휴진 구간 슬롯으로 저장하면 422 `DOCTOR_OFF`

**사용자 확인 필요:**
- 5: 점심 휴게도 시간대 구분도 없는 진료의의 반나절 휴진 경계(예: 정오)를 어떻게 볼지는 운영 판단입니다
- 9: 120분 상한을 고정할지 예약 설정 값으로 둘지는 업무 판단입니다

### appointment-no-show

[규칙 문서](../reference/rules/appointment-no-show.md) · 케이스 10 · 질문 4

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | "N분 후"를 예약 시작 시각부터 재는지, 경계를 `>=`와 `>` 중 무엇으로 볼지 정할까요 | **따름:** 화면 문구대로 `date + startTime + noShowAfterMinutes`부터 잽니다. 현재 시각이 그 시각 이상(`>=`)이 되면 스케줄러가 `NO_SHOW`로 바꿉니다. 시간 미정 예약(`startTime` 없음)은 진료 마감 기준으로만 처리합니다 | 설계가 서버 스케줄러 전이로 정했습니다 ([상태](../design/front-desk.md#상태)). 레거시 서버의 실제 경계는 볼 수 없어 문구를 기준으로 정합니다 |
| 2 | "진료 마감" 시각의 출처와 휴게·임시진료일 처리를 정할까요 | **바꿈:** 진료 마감은 그날 실제 진료 일정(날짜별 일정이 있으면 그것, 없으면 요일별 정기 스케줄)의 마지막 구간 종료 시각입니다. 진료의별 일정이 있으면 그 진료의 것을 씁니다. 점심 휴게는 상관하지 않고, 휴진일 예약은 그날 자정에 처리합니다 | 출처가 클라이언트에 없고 서버 동작이라 확인할 수 없습니다. 재설계 서버가 직접 정해야 합니다. 날짜별 일정이 요일 일정보다 우선이라는 것은 [appointment.md](../reference/spec/appointment.md)의 진료 스케줄 구성에서 가져왔습니다 |
| 3 | 이미 내원했거나 취소된 예약을 건너뛰나요 | **따름:** `BOOKED`만 `NO_SHOW`로 바뀝니다. `ARRIVED`·`CANCELED`는 대상이 아닙니다 | 설계 상태도에서 `NO_SHOW`로 가는 전이는 `BOOKED`에서만 있습니다 ([상태](../design/front-desk.md#상태)) |
| 4 | 10/30/60이 아닌 옛 값(예: 45)을 어떻게 다룰까요 | **바꿈:** 설정 API는 `noShowAfterMinutes ∈ {10, 30, 60}`과 진료 마감 모드만 받고, 다른 값은 422입니다. 이관할 때 다른 값은 그보다 큰 가장 가까운 값으로 올립니다(45 → 60). 부도가 더 일찍 생기지 않게 하려는 것입니다 | 설계가 값을 10/30/60분 또는 진료 마감으로 정했습니다 ([상태](../design/front-desk.md#상태)) |

**바뀌는 케이스:**
- `settings view: {"부도처리시점":45,"진료마감부도처리여부":false}`: 서버가 45를 주지 않으므로 이 입력은 생기지 않습니다. 이관 뒤에는 `60분 후`가 활성으로 보입니다

**사용자 확인 필요:**
- 2: 진료 마감 시각을 병원 기준으로 할지 진료의 기준으로 할지, 휴진일 예약을 부도로 처리할지는 운영 정책입니다
- 4: 옛 값을 올림으로 옮길지 가장 가까운 값으로 옮길지는 병원에 알려야 할 설정 변경입니다

### checkout-settlement

[규칙 문서](../reference/rules/checkout-settlement.md) · 케이스 46 · 질문 8

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 남은 금액 부호(`due − received`, 비과세+과세 합)를 확정할까요 | **따름:** `due − received > 0`이면 `OUTSTANDING`, `< 0`이면 `OVERPAID`, 0이면 `PAID`입니다. `desk.md`의 반대 부호 문구는 고칩니다 | 설계 정의와 코드가 같습니다 ([수납 커맨드](../design/front-desk.md#수납-커맨드)) |
| 2 | `과수납`을 `손비`보다 먼저 판정하는 것과, 잔액 0인데 손비를 켜면 `손비`가 되는 것을 따를까요 | **바꿈:** 과수납인데 `writeOffRemainder: true`이면 손비를 조용히 끄지 않고 422로 거부합니다. 잔액이 0이면 `writeOffRemainder`를 무시하고 `PAID`로 둡니다 | 설계에 "과수납이면 손비 처리를 할 수 없습니다 (422)"라고 정해져 있습니다. 손비할 금액이 0인데 `WRITTEN_OFF`로 남기면 손비 집계가 틀어집니다 |
| 3 | 비과세를 더 받은 만큼 과세 미수를 상쇄하는 합산 판정을 따를까요 | **따름:** `settlement.result`와 `outstanding`/`overpaid`는 합산으로 판정합니다. 과세·비과세별 받은 금액은 각 `Payment.amount { taxable, taxExempt }`에 그대로 남아 부분별 내역을 알 수 있습니다 | 설계 모델이 결제마다 과세·비과세를 나눠 저장하므로 상태 하나로 부분을 구분할 필요가 없습니다 ([모델](../design/front-desk.md#모델)) |
| 4 | 제주 지원금 행이 과세를 포함한 금액으로 상한을 잡고 비과세에서만 빼는 것을 고칠까요 | **바꿈:** 제주 지원금 행은 `min(선택한 진료의 지원금 합, 급여 본인부담 받을 금액)`으로 잡고, 그 부분(비과세)에서만 뺍니다. 과세 금액은 상한 계산에 넣지 않습니다 | 제주 지원은 급여 본인부담금을 지원하고 비급여는 환자에게 받습니다 ([desk.md](../reference/spec/desk.md) "제주 지원"). 과세는 비급여뿐이라 상한에 넣으면 안 됩니다. 설계의 `min(지원금 합, 받을 금액)`에서 "받을 금액"을 `charges.insuredCopay`로 좁힙니다 |
| 5 | 음수 `과수금액`을 비과세 받을 금액에 더하는 것은 무슨 뜻일까요 | **보류:** 레거시 서버에서 음수 과수금액이 어떻게 생기는지(이전 미수의 다른 표현인지) 이관 데이터로 확인해야 합니다 | 재설계는 과수납 잔액(`OVERPAID_CREDIT`)과 미수(`outstanding`)를 따로 두므로 음수 잔액이 없습니다. 이관 때 음수 값을 미수로 옮길지가 이 확인에 달려 있습니다 |
| 6 | 선수금을 현금 계열부터 쓰고 카드 계열 잔액은 확인하지 않는 것을 따를까요 | **바꿈:** 결제마다 `prepaidKind`를 받고, 서버가 계열별 잔액을 넘으면 422로 거부합니다. "현금 계열 먼저" 분할은 견적(`:quote-checkout`)이 기본값으로 제안만 합니다 | 설계 결제 형식이 `prepaidKind`를 명시합니다 ([수납 커맨드](../design/front-desk.md#수납-커맨드)). 선수금 계정이 계열별로 나뉜 이유는 환불 수단 제약입니다 ([patients.md](../design/patients.md#선수금)) |
| 7 | 환자 등급 할인 반올림(JS `Math.round`)을 서버가 어떻게 재현할까요 | **따름:** `round_half_up((단가+세금) × 일투여량 × 투약일수 × (100 − 할인율) / 100)`을 정수 연산으로 계산합니다. 소수 오차가 없는 경우 현행과 같은 값이 나옵니다. 할인금액은 `원금액 − 할인후금액`입니다 | 설계는 할인을 수납 견적에서 서버가 계산합니다 ([수납 커맨드](../design/front-desk.md#수납-커맨드)). 부동소수 오차로 0.5 경계가 뒤집히는 경우만 달라질 수 있습니다 |
| 8 | 미수 확인 조건(`a − n > 0`)과 결산 상태가 어긋날 수 있는 것을 고칠까요 | **바꿈:** 미수 확인(`acknowledge: ["OUTSTANDING"]`)은 결산과 같은 계산(지원금·과수납금을 부분별 상한으로 적용한 뒤 남은 금액 > 0이고 입력 결제가 없음)으로 판정합니다 | 설계는 판정을 서버 한 곳에서 합니다 ([수납 커맨드](../design/front-desk.md#수납-커맨드)). 4번을 고치면 어긋나는 경우도 사라집니다 |

**바뀌는 케이스:**
- `settle: 과수납 wins over 손비 and 손비 is turned off`: 과수납 + 손비 끄기 → 422 거부
- `settle: 손비 with zero remaining still reports 손비`: `손비` → `PAID`(상태 없음)
- `settle: Jeju subsidy larger than non-taxable due clamps to 0`: 제주 행 6,000 → 3,000(비과세 받을 금액까지). 저장되는 비과세 결제 합이 비과세 받을 금액을 넘지 않음
- `jeju: subsidy equals due`, `jeju: due includes taxable part when capping`: 과세 2,000을 상한에 넣지 않으므로 제주 행 3,000 → 1,000(비과세 1,000)
- `jeju: subsidy below due -> full subsidy`: 결과는 같음(3,000 ≤ 비과세 8,000). 상한 기준만 바뀜
- `prepaid: negative cash balance treated as 0`: 카드 계열 잔액 0인데 3,000을 씀 → 422 잔액 부족

**사용자 확인 필요:** 4. 제주 지원(4·3 유족·해녀) 상한이 급여 본인부담만인지는 지원 기관 기준을 확인해야 합니다. 근거 문서는 급여 본인부담 지원이라고 적고 있습니다.

### cash-drawer-expected-closing

[규칙 문서](../reference/rules/cash-drawer-expected-closing.md) · 케이스 16 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | fallback 현금수납에서 선수금 현금 충전이 빠지는 것을 따를까요 | **바꿈:** fallback을 없애고, 서버가 언제나 `시작 + 현금 수납 + 선수금 현금 충전 − 지출 − 현금 환불`로 계산합니다 | [시재와 지출](../design/front-desk.md#시재와-지출)이 공식과 fallback 제거를 정했습니다 |
| 2 | 결제수단이 섞인 수납 행의 환불을 현금 환불로 세지 않는 것을 고칠까요 | **바꿈:** 현금 환불은 수납 행이 아니라 `Refund.method === CASH`인 환불 기록의 합입니다. 수납 행의 결제수단 구성과 상관없습니다 | 설계 모델이 환불마다 수단을 기록합니다 ([모델](../design/front-desk.md#모델)). 현행은 섞인 행의 현금 환불을 빠뜨려 예상액이 실제보다 커집니다 |
| 3 | 서버 `예상마감금액`이 자기 구성값과 맞지 않아도 그대로 쓰는 것을 따를까요 | **바꿈:** 서버는 구성값(현금 수납, 충전, 환불, 지출)과 `expectedClosing`을 같은 원장에서 함께 계산해, 둘이 어긋날 수 없게 합니다 | 저장된 합계 대신 계산 값을 주므로 클라이언트가 검증할 필요가 없습니다 ([시재와 지출](../design/front-desk.md#시재와-지출)) |
| 4 | `마감금액 ≠ 예상` 엄격 비교로 재정산 필요를 정하는 것을 따를까요 | **따름:** `closing.difference = countedAmount − expectedClosing`이고, 0이 아니면 차이로 보여 줍니다. 마감 뒤 수납·지출이 바뀌어 차이가 생기면 상태가 `REOPENED`가 됩니다 | 설계의 `closing.difference`와 `REOPENED`(현행 `마감후수정여부`)에 대응합니다 |
| 5 | `시작금액` 0을 등록으로 보고 `null`만 미등록으로 보는 것을 따를까요 | **따름:** `:open {openingAmount: 0}`은 `OPEN`이고, `:open`을 하지 않은 일자만 `NOT_OPENED`입니다 | 설계 상태 `NOT_OPENED | OPEN | CLOSED | REOPENED`로 옮깁니다. 열지 않고 마감하는 경로가 없으므로 "미등록이 정산 표시보다 우선" 조합은 서버에서 생기지 않습니다 |

**바뀌는 케이스:**
- `server cash flow present but inconsistent -> still server value`: `예상마감금액` 1 → 구성값으로 계산한 50,000
- `fallback: refund on mixed cash+card receipt is not counted as cash refund`: 그 환불 2,000이 현금 환불이면 `현금환불` 0 → 2,000, `예상마감금액` 10,000 → 8,000
- `fallback: start + cash receipts - (expenses + cash-only refunds)`: 섞인 행의 환불 2,000이 현금 환불이면 `현금환불` 4,000 → 6,000, `예상마감금액` 128,500 → 126,500
- fallback 케이스 전체는 서버가 fallback을 두지 않으므로 이관 전 화면 값을 비교하는 용도로만 남습니다

**사용자 확인 필요:** 없음

## 진찰료·수가

### consultation-fee-code

[규칙 문서](../reference/rules/consultation-fee-code.md) · 케이스 101 · 질문 8

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 만 나이 계산에서 월을 1 빼지 않아, 최근 한 달 안에 태어난 환자는 나이가 `null`이 되고 연령 가산과 65세 이상 제외가 모두 빠지는데 그대로 옮길지 | **바꿈:** 서버는 진료일(Asia/Seoul) 기준으로 만 나이와 생후 일수를 달력대로 정확히 계산합니다. 신생아는 생후 28일 이하로 두어 현행 경계(28일 `1`, 29일 `3`)를 유지합니다 | 고칠 대표 차이로 이미 꼽혀 있습니다([review.md](../design/review.md#규칙-이전-시-동작-차이)). 생일 당일 같은 다른 경계는 현행도 정상이라 결과가 같습니다 |
| 2 | 토요 가산을 기본코드를 바꾸지 않고 `…030` 줄을 하나 더 추가하는 두 줄 표현을 서버도 유지할지 | **보류:** 심평원 청구 작성 요령에서 토요 가산을 별도 줄로 적는지 확인해야 합니다. 확인 전까지는 현행 두 줄을 그대로 재현합니다 | 청구 명세서 형식에 달린 문제라 코드만 보고 정할 수 없습니다. 근거 문서에는 비율(30%, 야간과 중복 불가)만 있습니다([treatment.md](../reference/spec/treatment.md)) |
| 3 | 계산한 8자리 코드(예: `10100610`)가 그 날짜 수가 마스터에 없으면 진찰료 줄이 아무 오류 없이 빠지는데, 거부할지 대체 코드를 쓸지 | **바꿈:** 기본코드로 바꿔 넣지 않습니다. 저장 때는 `FEE_CODE_NOT_IN_MASTER` warning을 주고, 진료 완료는 막습니다(acknowledge 불가) | 저장은 통과시키고 완료는 막는 설계 원칙을 따릅니다([clinical.md](../design/clinical.md#저장)). 마스터 누락은 참조데이터를 적재해서 고칠 문제이고, 기본코드로 대체하면 가산이 빠진 채 청구됩니다 |
| 4 | 재진 판정 창이 날짜가 아니라 분 단위 시각으로 비교되고, 서버 `days_ago` 조회의 경계도 보이지 않는데 서버는 어떻게 판정할지 | **바꿈:** 서버가 같은 환자의 진료를 직접 조회합니다. `serviceAt`이 현재 진료보다 엄격히 이른 진료 중에서 진료일(Asia/Seoul 달력 날짜) 차이가 N일 이하인 것이 있으면 재진으로 판정합니다 | 고시와 OK차트 기준은 모두 일수입니다("30일 넘어 오면 초진", [treatment.md](../reference/spec/treatment.md)). 시각을 비교하면 같은 날짜라도 시각에 따라 결과가 갈립니다. 서버가 직접 조회하므로 `days_ago`에 의존할 필요가 없습니다 |
| 5 | `초진진찰료산정기준일` 기본값 0(늘 초진)이 실제로 쓰는 설정인지, 설정하지 않았다는 표시인지 | **보류:** 현행 서버에 저장된 병원별 값 분포를 확인해야 합니다. 신규 병원의 `encounter-policy` 초진 산정일수 기본값은 30으로 두고, 0은 "자동 판정 안 함"이라는 명시적 설정일 때만 허용하기를 권장합니다 | 건보는 이 값을 `days_ago`로 그대로 보내므로, 0이 흔하다면 대부분의 진료가 초진으로 잡히고 있다는 뜻입니다. 이관 때 0을 어떻게 옮길지는 병원 정책 문제입니다([catalog.md](../design/catalog.md#운영)) |
| 6 | 자보·산재·일반은 최근 진료를 90일(산재는 별도 값)로 조회하지만 판정은 `초진진찰료산정기준일`을 쓰는데, 서버는 어느 창을 쓸지 | **따름:** 판정 창은 보험구분과 상관없이 초진 산정일수 하나로 하고, 서버는 그 창만큼 직접 조회합니다 | 90일 조회는 화면 데이터 로딩 방식일 뿐 판정에 쓰이지 않습니다. 비교 대상을 같은 보험구분 진료로만 한정할지는 현행 `type` 파라미터의 의미를 확인한 뒤 정합니다 |
| 7 | 공휴일을 진료 연도 맵 하나에서만 읽고, 조회에 실패하면 빈 맵이 되어 평일로 처리되며, 로딩 중에는 자동 삽입이 안 되는 문제 | **바꿈:** 공휴일은 참조데이터에서 진료일을 `asOf`로 조회합니다. 조회에 실패하면 평일로 계산하지 않고 오류를 냅니다(5xx, 재시도 가능) | 공휴일은 참조데이터입니다([catalog.md](../design/catalog.md#운영)). 서버에는 로딩 중 상태가 없고, 데이터에 없는 날은 평일로 보므로 픽스처의 "맵에 없음" 케이스는 결과가 같습니다 |
| 8 | `토요일공휴일시니어환자제외여부`가 65세 이상의 토요·공휴 가산만 빼고, 그날 야간 가산은 그대로 붙는 것이 맞는지 | **따름** | 야간 제외는 별도 설정 `시니어환자제외여부`가 맡습니다. 두 설정이 가산 종류를 나눠 맡는 구조라 서로 맞습니다 |

**바뀌는 케이스:**
- `infant born 2026-02-05, visit 2026-03-04 -> age calc returns null (month off-by-one, suspected bug) -> no infant digit` → `["10100100"]`
- `JLt neonate (born 2026-02-10, 22 days) 침술 -> null: age calc returns null for births within the last month (suspected bug), so no 100` → `40011100`
- `초진 child age 3 at night but 10100610 missing from fee list -> no line at all` → 줄은 여전히 없지만 `FEE_CODE_NOT_IN_MASTER` warning이 함께 나옵니다
- `prior visit exactly N(30) days earlier same minute -> not counted -> 초진` → 재진 `10200`(날짜 차이 30일 ≤ N)
- `prior visit N days earlier - 1 minute -> 초진` → 재진 `10200`(날짜 차이 30일)
- `year rollover: N=30, current 2026-01-15 10:00, prior 2025-12-16 10:00 -> 초진` → 재진 `10200`

**사용자 확인 필요:**
- 2: 토요 가산을 두 줄로 청구하는지는 청구 작성 요령을 확인해야 정해집니다.
- 4: N일째 되는 날을 재진에 포함할지(≤ N인지 < N인지)는 고시 해석 문제입니다. 권장안은 OK차트 기준인 ≤ N입니다.
- 5: 이관할 때 0을 30으로 바꿀지, 0을 그대로 둘지는 병원 정책 문제입니다.

### procedure-fee-modifiers

[규칙 문서](../reference/rules/procedure-fee-modifiers.md) · 케이스 44 · 질문 7

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 진찰료와 같은 나이 계산 버그로 최근 한 달 안에 태어난 환자는 연령 자리가 빠지고 신생아 `1`은 경계에서만 나오는데, 그대로 옮길지 고칠지 | **바꿈:** consultation-fee-code 1번과 같은 정확한 나이·생후 일수 계산을 공유합니다. 신생아(생후 28일 이하, 침술 카테고리)는 `1`입니다 | 진찰료와 시술이 같은 함수를 쓰므로 판정도 하나로 맞춥니다([review.md](../design/review.md#규칙-이전-시-동작-차이)) |
| 2 | 야간·공휴·토요 플래그를 넘기는 호출부가 없어 시술 시간대 가산이 자동으로 붙지 않는데, 시술 공휴 가산을 어딘가에서 적용해야 하는지 | **따름:** 서버도 시술 시간대 가산을 자동으로 붙이지 않습니다. 붙일 때는 의사가 줄마다 명시적으로 지정한 경우에만 받습니다 | 근거 문서상 시술 가산은 "불가피하게 한 응급 시술"에 한정되어 의사가 판단할 일입니다([treatment.md](../reference/spec/treatment.md)) |
| 3 | 시간대 플래그에 코드 종류 검사가 없어 조제료에도 `…010` 같은 코드가 만들어지는 문제 | **바꿈:** 시간대 자리를 붙일 수 있는 코드 종류를 표로 두고, 표에 없는 종류에는 붙이지 않습니다. 초기값은 현행 `_t`가 해석하는 진찰료(`10`)·시술(`40`)입니다 | `_t`도 해석하지 못하는 코드라 청구에서 의미가 없습니다. 표는 참조데이터 속성으로 두어 고시가 바뀌면 데이터로 고칩니다([catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)) |
| 4 | 1세 미만 자리 값이 코드 종류마다 다르고(시술 `3`, 신생아 침술 `1`, 투약·조제 `1`, 진찰료 `1`), 쓰이지 않는 헬퍼 `zk.만1세미만.적용`은 투약에 `3`을 쓰는 불일치 | **따름:** 실제 경로인 `JLt` 값을 재현합니다. 쓰이지 않는 헬퍼 값은 옮기지 않습니다 | 실제 생성 경로와 수가 마스터 코드가 일치하는지는 5번의 마스터 검증이 잡아 줍니다 |
| 5 | 가산을 붙인 코드가 수가 마스터에 없으면 경고 없이 원래 줄을 그대로 두는 문제 | **바꿈:** 원래 코드는 유지하되 `FEE_CODE_NOT_IN_MASTER` warning을 주고, 진료 완료는 막습니다 | 진찰료(consultation-fee-code 3번)와 같은 정책입니다. 조용히 두면 가산이 빠진 채 청구됩니다 |
| 6 | `ZLt`가 `금액`에 단가, `단가`에 단가×일투여량×투약일수를 넣어 이름이 뒤바뀐 것으로 보이는데, 필드 의미를 어떻게 정할지 | **바꿈:** 서버 필드는 `unitPrice` = 단가, `amount` = 단가 × 1일 투여량 × 일수입니다. 이관 때 현행 `금액`은 `unitPrice`로, `단가`는 `amount`로 옮깁니다 | 처방 라인 모델에 `unitPrice`와 `amount`(서버 계산)가 이미 있습니다([clinical.md](../design/clinical.md#처방-라인)). 값은 그대로 두고 이름만 바로잡습니다 |
| 7 | 처방 배열을 통째로 바꾸는 편집에서만 다시 계산하고, 옵션이나 `vx` 모드에서는 건너뛰며, 진료일·환자가 바뀌어도 다시 계산하지 않는 문제 | **바꿈:** 서버는 처방 줄을 upsert할 때와 `serviceAt`·환자·보험구분이 바뀔 때 산정코드를 다시 계산하고, 진료 완료의 금액 확정 직전에도 한 번 더 계산합니다. 사용자가 직접 지정한 8자리 코드는 다시 계산하지 않습니다 | 금액은 완료 때 확정되므로([clinical.md](../design/clinical.md#완료-커맨드)) 그 전에 입력이 바뀌면 코드도 따라가야 합니다. 클라이언트 화면 모드는 서버 범위가 아닙니다 |

**바뀌는 케이스:**
- `born 2026-02-10, visit 2026-03-04 (22 days) -> null: age calc null within one month (suspected bug)` → `40011100`
- `born 2028-02-01, visit 2028-02-29 (28 days, leap year) -> null: age calc null (suspected bug)` → `40011100`
- `flag 야간임 on 조제료 -> 010 (no code-type check)` → `null`(코드를 바꾸지 않음)
- `age 3: 부항 600 code missing from fee list -> line unchanged` → 줄은 그대로이고 `FEE_CODE_NOT_IN_MASTER` warning이 추가됩니다
- `age 3: 침술 and 조제료 lines get 600 codes, names and prices from fee list` → 값은 같고 필드 이름만 바뀝니다(조제료 `unitPrice` 650, `amount` 3900)

**사용자 확인 필요:** 없음

### duplicate-consultation-fee

[규칙 문서](../reference/rules/duplicate-consultation-fee.md) · 케이스 18 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 같은 날 대면 2건이나 비대면 2건이 모두 진찰료를 가져도 검사하지 않는데, 같은 방식 중복은 허용되는지, 다른 곳에서 검사하는지 | **바꿈:** 건보·급여에서 같은 날 같은 환자의 진찰료 진료가 2건 이상이면 대면·비대면 구분 없이 `DUPLICATE_CONSULTATION_FEE`로 판정합니다(acknowledge 가능) | 근거 문서상 같은 날 진찰료는 원칙적으로 1회이고, 예외는 전문과목이 다른 의사인 경우뿐입니다([treatment.md](../reference/spec/treatment.md)). 예외가 있으므로 막지 않고 확인 후 통과시킵니다 |
| 2 | 현행은 "이대로 저장"으로 넘어갈 수 있는 확인인데, 서버 위반을 막는 것으로 할지 acknowledge로 넘길 수 있게 할지 | **따름:** `acknowledge`로 넘길 수 있는 위반입니다 | 재설계에서 이미 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)) |
| 3 | 진찰료를 "`10`으로 시작하는 모든 코드"로 판정하는 것이 맞는지(91001–91004 제외는 원래 해당하지 않아 불필요) | **바꿈:** 접두사 대신 수가 참조데이터의 진찰료 속성으로 판정합니다. 초기값은 현행과 같은 `10` 대역 전체이고, 자보 규칙과 같은 목록을 씁니다 | 판정 기준을 한 곳에 두어 auto-insurance-same-day-consultation 5번과 맞춥니다. 초기값이 현행과 같으므로 결과는 달라지지 않습니다 |
| 4 | 같은 취지의 비대면 청구 경고 `T0004`가 계산은 되지만 청구 경고 목록에서 걸러져 보이지 않는 문제 | **바꿈:** 완료할 때 acknowledge한 중복은 청구 명세서 `issues[]`에 `T0004`로 다시 보여 주고, `:suppress`로 끌 수 있게 합니다 | 확인하고 넘긴 중복을 청구 담당자가 볼 곳이 없습니다. 이슈 억제는 사유와 함께 서버에 남습니다([claims.md](../design/claims.md#모델)) |
| 5 | 충돌하는 진료를 첫 번째 하나만 찾는 문제(`find`) | **바꿈:** 위반 상세에 충돌하는 진료를 모두 `conflictingEncounterIds[]`로 담습니다 | 1번에서 같은 방식 중복까지 넓히면 3건 이상인 날이 생깁니다 |

**바뀌는 케이스:**
- `two face-to-face encounters same day both with 진찰료 -> no dialog` → `DUPLICATE_CONSULTATION_FEE` 위반이 나옵니다(acknowledge 가능)
- `two telemedicine encounters same day -> no dialog` → `DUPLICATE_CONSULTATION_FEE` 위반이 나옵니다(acknowledge 가능)
- `telemedicine with 진찰료 and same-day face-to-face 진찰료 -> T0004 raw, filtered from claim warnings` → `shownInClaimWarnings`에 `T0004`가 들어갑니다
- 나머지 케이스는 충돌 진료가 하나뿐이라 `conflictingRecordId`가 한 칸짜리 배열이 되는 형태 변화만 있습니다

**사용자 확인 필요:**
- 1: 같은 방식 중복까지 판정하면 현행보다 경고가 넓어집니다. 전문과목이 다른 의사의 예외를 실제로 쓰는 병원이 있는지 확인해야 합니다.

### auto-insurance-same-day-consultation

[규칙 문서](../reference/rules/auto-insurance-same-day-consultation.md) · 케이스 25 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 같은 사고접수번호로 하루에 두 번 진료하면 배너도 J0014도 없이 두 진료 모두 진찰료가 남는데, 두 번째 진료에 진찰료를 청구해도 되는지 | **바꿈:** 같은 사고로 같은 날 진찰료가 2건 이상이면 뒤 진료에 `DUPLICATE_CONSULTATION_FEE` warning을 줍니다(acknowledge 가능). 진찰료를 자동으로 지우지는 않습니다 | 1일 2차 근거 문서에는 "진찰료는 1차에서만 1일 1회"라고 되어 있고([claim.md](../reference/spec/claim.md)), 1일 2회 내원 원칙도 같습니다([treatment.md](../reference/spec/treatment.md)). 다만 자보 수가 기준과 직접 대조하지는 못했습니다 |
| 2 | J0014가 `자보1일2차여부`를 보지 않아, 앞 진료를 2차로 지정하면 뒤 진료가 진찰료를 갖고도 J0014가 뜨는 문제(버그로 보임) | **바꿈:** 그날 같은 환자의 다른 사고 자보 진료 중 2차로 지정되지 않은 가장 이른 진료를 1차로 봅니다. J0014는 진찰료를 가진 진료가 2차로 지정됐거나 1차가 아닐 때만 냅니다 | 2차 지정은 사용자가 직접 고른 것이므로 순서보다 앞섭니다. 현행 배너도 형제 진료가 2차이면 숨겨 같은 해석을 합니다(`sibling already 2차, current unflagged -> banner hidden`) |
| 3 | "뒤 진료"를 `기준일시` 문자열, 그다음 `진료Id` 문자열로 비교해, 같은 분이면 ID 사전순에 따라 앞뒤가 정해지는 문제 | **바꿈:** `serviceAt`, 생성 시각, ID 순으로 비교합니다 | ID는 불투명 문자열이라 순서에 의미가 없습니다([conventions.md](../design/conventions.md#응답-형태)). 픽스처에는 생성 시각이 없어 ID 비교로 내려가므로 결과는 같습니다 |
| 4 | 같은 날 사고가 3건 이상이면 첫 진료 뒤로는 모두 후보인데, 하나가 2차로 지정되면 나머지는 자동 지정되지 않는 문제 | **바꿈:** 1차(2번 정의)가 아닌 진료 중 `자보1일2차여부`가 한 번도 정해지지 않은(null) 진료는 모두 자동으로 2차로 지정합니다 | 나머지 진료의 진찰료가 J0014로만 드러나는 상태를 없앱니다. null인 경우에만 지정하므로 사용자가 해제한 값은 유지됩니다 |
| 5 | 자보 진찰료 판정이 `10100`/`10200` 접두사뿐이고 다른 규칙은 `10`으로 시작하는 모든 코드를 쓰는데, 자보 진찰료 목록의 기준은 무엇인지 | **바꿈:** duplicate-consultation-fee 3번과 같은 수가 참조데이터의 진찰료 속성(초기값 `10` 대역)을 씁니다 | 2차 진료는 "진찰료 없음"으로 정의되어 있어 초·재진만으로 좁힐 근거가 없습니다([treatment.md](../reference/spec/treatment.md)). 판정을 한 곳에서 해야 규칙 사이의 어긋남이 없어집니다 |
| 6 | 자동 지정이 클라이언트 watch로 초안을 고치고 토스트를 띄우는 방식인데, 서버가 저장 때 자동 조정할지 경고만 할지 | **따름:** 서버가 진료를 저장할 때 자동 조정하고 warning을 줍니다. 대상은 `자보1일2차여부`가 null인 경우뿐입니다 | 재설계에서 이미 "자동 조정 + warning"으로 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 쓰기 권한이 없으면 저장 자체가 안 되므로 권한 없는 자동 지정은 생기지 않습니다 |

**바뀌는 케이스:**
- `two same-day encounters, same accident -> none` → 뒤 진료에 `DUPLICATE_CONSULTATION_FEE` warning이 나옵니다
- `sibling flagged 2차, current later with 진찰료 -> J0014 (flag not consulted)` → `warnings: []`(앞 진료가 2차이므로 현재 진료가 1차)
- `only codes starting 10100/10200 count: 10400 ignored, 1020010 counted` → `원인제공자Ids`가 `["x1", "x2"]`(`10400`도 진찰료로 셈)

**사용자 확인 필요:**
- 1: 같은 사고로 하루 두 번 진료할 때 진찰료를 두 번 받을 수 있는지는 자보 진료수가 기준을 해석해야 정해집니다.
- 5: `10400` 같은 `10` 대역의 다른 진찰료(가족 내원·협의진찰 등)를 2차 진료에서 빼야 하는지는 자보 청구 실무 판단입니다.

### coverage-category-band

[규칙 문서](../reference/rules/coverage-category-band.md) · 케이스 13 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 설계 문서는 보험구분별 대역 일치(건보 31·33·34·35 / 비급여 51·53·54 / 자보 73·74 / 산재 93·94)를 적었지만 현행은 "다른 보험 전용 카테고리 차단"이고 자보 71·72, 산재 92도 막는데, 서버는 어느 정의를 쓸지 | **따름:** 현행처럼 "다른 보험 전용 카테고리 차단"을 씁니다. 보험구분별 차단 카테고리 표를 참조데이터로 두고, 71·72·92를 포함한 현행 값을 초기값으로 합니다. clinical.md 표의 대역 서술은 이에 맞춰 고칩니다 | 대역 일치를 강제하면 자보 진료의 건보 침술·진찰료 줄과 모든 보험구분의 비급여 줄이 막혀 현행 업무가 깨집니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 대역 일치는 신규 규칙이라 정책으로 결정해야 합니다([review.md](../design/review.md#규칙-이전-시-동작-차이)) |
| 2 | 자보에서는 정확히 `40721`(복잡추나 80%)만 막고 다른 건보 추나 코드는 허용하는 것이 맞는지 | **따름:** 차단 코드 목록도 1번 표에 함께 둡니다 | 현행 값을 초기값으로 옮기고, 고시가 바뀌면 데이터만 고치면 됩니다([catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)) |
| 3 | `91000…` 접두 비대면 코드는 비대면 시범사업이 꺼져 있어도 건보·급여에서 허용되고, `91001`–`91004`만 비대면을 요구하는 비대칭 | **바꿈:** 비대면 코드 전체(`91000…`, `91001`–`91004`)를 내원의 `telemedicinePilot`이 켜진 건보·급여 진료에서만 허용합니다 | 비대면이 아닌 진료에 비대면 코드가 남는 구멍을 막습니다. 서버는 실제 플래그를 보므로, 급여에서 4번째 인자가 늘 거짓이 되는 호출부 문제도 사라집니다([front-desk.md](../design/front-desk.md#리소스-1)) |
| 4 | 보험구분을 바꿀 때만 검사하고 저장·완료 때는 검사하지 않는데, 완료 시 `COVERAGE_CATEGORY_MISMATCH`는 새 동작인 문제 | **바꿈:** 보험구분을 바꿀 때와 진료를 완료할 때 모두 검사합니다. 저장 때는 warning만 줍니다 | 재설계에서 완료 검증 규칙으로 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 판정 함수가 같아 케이스 결과는 그대로입니다 |
| 5 | 현행은 확인을 받은 뒤 줄을 삭제하는데, 서버 설계는 삭제 대신 `invalid` 표시를 계획한 문제 | **바꿈:** 줄을 지우지 않고 `invalid: COVERAGE_MISMATCH`로 표시해 `invalidatedPrescriptionLines[]`로 알립니다 | 재설계에서 이미 정했습니다. 처방은 면허 행위라 데스크 동작이 처방을 직접 바꾸지 않습니다([front-desk.md](../design/front-desk.md#접수-커맨드)) |

**바뀌는 케이스:**
- `건보 without pilot: all line types` → `invalidLineIds`에 `l-91000`이 추가됩니다
- `건보 with 첩건시범사업 object: 35 lines allowed` → `l-91000`이 추가됩니다
- `급여 (의료급여): all line types` → `l-91000`이 추가됩니다
- `급여 with pilot object: 35 still invalid (pilot only for 건보)` → `l-91000`이 추가됩니다

**사용자 확인 필요:**
- 1: 대역 일치를 신규 규칙으로 도입할지는 업무 정책 결정입니다. 권장안은 도입하지 않고 현행 차단 방식을 유지하는 것입니다.

### reference-version-selection

[규칙 문서](../reference/rules/reference-version-selection.md) · 케이스 24 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 정적 기준정보 버전을 `2026-01-01` 하드코딩 컷오프로 고르는 방식을 서버가 그대로 둘지 | **바꿈:** 데이터셋별 버전 테이블(`validFrom`/`validTo`)에서 진료일(`serviceAt`의 날짜)에 유효한 버전을 고릅니다. 현재 적재분으로는 "2026-01-01 전이면 구버전" 결과가 그대로 나옵니다 | 참조데이터는 유효기간 있는 행으로 두고 `asOf`로 조회하기로 했습니다 ([catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)) |
| 2 | 컷오프가 UTC 자정이라 UTC 서쪽 시간대에서 하루 당겨지는 문제 | **바꿈:** 진료 시각을 테넌트 시간대(`Asia/Seoul`)의 날짜로 바꾼 뒤 비교합니다. 서버·브라우저 시간대와 무관합니다 | "오늘" 같은 경계는 테넌트 시간대로 계산합니다 ([conventions.md](../design/conventions.md#필드와-값)) |
| 3 | `yyyyMMddHHmm`이 아닌 기준일시가 Invalid Date가 되어 조용히 2026 버전을 고르는 문제 | **바꿈:** `asOf`는 `YYYY-MM-DD`, `serviceAt`은 RFC 3339만 받고, 형식이 틀리면 400 `VALIDATION_FAILED`로 거부합니다. 숫자가 없는 수가 기준일도 같은 처리입니다 | 날짜 형식을 하나로 정했고 형식 오류는 400입니다 ([conventions.md](../design/conventions.md#오류)) |
| 4 | 기준일시 없이 부르는 화면이 과거 진료를 편집할 때도 오늘 버전을 쓰는 문제 | **바꿈:** 진료·청구 서버 로직은 항상 해당 진료일을 `asOf`로 씁니다. 상병 검색처럼 진료 화면에서 부르는 조회는 클라이언트가 진료의 `serviceAt`을 `asOf`로 넘깁니다. `asOf`가 없으면 오늘 기준입니다 | [catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)에 이미 정해 둔 규칙입니다. 서버 판정은 화면과 무관해집니다 |
| 5 | 진료일이 가장 이른 수가 적용일자보다 이르면 가장 이른 마스터로 대체하는 동작을 유지할지 | **바꿈:** 진료일에 유효한 버전이 없으면 대체하지 않고 422 `REFERENCE_DATA_UNAVAILABLE`로 거부합니다. 목록이 비어 있을 때도 같습니다 | 처방 라인 단가를 진료일 기준으로 고정하므로 다른 시기의 단가를 조용히 쓰면 금액이 틀립니다 ([clinical.md](../design/clinical.md#처방-라인)). 이관 진료는 수정 불가라 영향이 작습니다 |
| 6 | `적용일자목록` 항목을 원문 그대로 돌려줘 대시 포함 값이 조회 파라미터로 그대로 들어가는 문제 | **바꿈:** 버전 목록(`GET /reference/{dataset}/versions`)의 `validFrom`을 `YYYY-MM-DD` date로 정규화해 돌려주고, 같은 형식만 `asOf`로 받습니다. 현행 서버가 주던 실제 형식은 이관 스크립트에서 확인합니다 | 날짜는 `YYYY-MM-DD`로 통일합니다 ([conventions.md](../design/conventions.md#필드와-값)) |

**바뀌는 케이스:**
- `[TZ=America/Los_Angeles] staticVersion 2025-12-31 23:59 -> legacy (undefined)`: `20260101` → 구버전 (#2)
- `[TZ=America/Los_Angeles] staticVersion 2025-12-31 00:00 -> legacy`: `20260101` → 구버전 (#2)
- `[TZ=Asia/Seoul] staticVersion 8-digit 20260101 is unparseable as yyyyMMddHHmm -> Invalid Date -> 20260101`: 400 `VALIDATION_FAILED` (#3)
- `[TZ=Asia/Seoul] staticVersion 8-digit 20251231 is unparseable -> Invalid Date -> 20260101 (not legacy)`: 400 `VALIDATION_FAILED` (#3)
- `feeVersion query with no digits -> latest`: 400 `VALIDATION_FAILED` (#3)
- `feeVersion before earliest -> earliest (fallback, not empty)`: 422 `REFERENCE_DATA_UNAVAILABLE` (#5)
- `feeVersion dates list empty -> empty string`: 422 `REFERENCE_DATA_UNAVAILABLE` (#5)
- 그 밖의 `feeVersion` 케이스는 고르는 버전은 같고, `적용일자` 표현만 `YYYY-MM-DD`로 바뀝니다 (#6). 구버전 `null`은 서버에서 구체적인 버전 ID(`kcd` `20250722` 등)로 나옵니다 (#1)

**사용자 확인 필요:** 없음

### special-case-code-match

[규칙 문서](../reference/rules/special-case-code-match.md) · 케이스 64 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 저장·완료 때 선택한 특정기호가 실제 상병과 맞는지 검사하지 않는 현행을 서버가 강제할지 | **바꿈:** 완료 검증에서 4자 필수 검사에 더해, 특정기호의 `연계상병`(진료일 기준 `rare-diseases` 참조데이터)에 진료 상병이 하나 이상 맞지 않으면 `SPECIAL_CASE_CODE_MISMATCH`로 막습니다. 저장은 `warnings`로만 알립니다 | 설계가 일치 검사를 신규 규칙으로 이미 정했습니다 ([clinical.md](../design/clinical.md#완료-검증-규칙)) |
| 2 | 극희귀(11)·상세불명희귀(13) 등록번호가 `din`에 없어 특정기호 검사를 건너뛰는 것이 의도인지 | **보류:** 두 등록 구분에 특정기호(V코드) 기재가 필수인지 고시 확인이 필요합니다. 확인 전까지는 현행(검사 안 함)을 따릅니다 | 매뉴얼 요약에는 희귀·중증난치에 V 특정기호를 쓴다는 설명만 있고 11·13 구분은 없습니다 ([treatment.md](../reference/spec/treatment.md)) |
| 3 | `MT002` 앞 공백이나 V가 아닌 값이면 산정특례 진료로 보지 않고 검사를 통째로 건너뛰는 문제 | **바꿈:** 특정기호는 trim·대문자로 정규화하고, 검사 대상 여부는 등록번호 구분(05·14·21·23)만으로 정합니다. 대상이면 특정기호가 없거나 `V`+3자가 아닐 때 `SPECIAL_CASE_CODE_MISMATCH`입니다 | 같은 함수 안에서 존재 판정은 trim 없이, 길이 검사는 trim 후에 해서 결과가 엇갈립니다. 하나의 정규화 규칙으로 맞춥니다 |
| 4 | 등록된 특정기호가 기준자료에 없고 등록번호가 05·14·21·23이면 모든 희귀질환 행을 후보로 내는 동작 | **바꿈:** 후보는 등록된 특정기호의 행만 냅니다. 기준자료에 없는 특정기호면 후보는 비우고, 완료 검증은 일치 판정을 할 수 없으므로 `SPECIAL_CASE_CODE_MISMATCH`(사유: 기준자료에 없음)로 막습니다 | 전체 대체는 등록되지 않은 특정기호를 제안합니다. 기준자료 누락은 참조데이터 적재로 고칠 문제입니다 ([catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)) |
| 5 | `Q00-R99`처럼 첫 글자가 다른 범위가 양 끝 코드의 접두 일치로만 동작하는 문제 | **바꿈:** 범위는 점을 뺀 상병코드 앞 3자를 사전순으로 비교해 `시작 ≤ 코드 ≤ 끝`이면 일치로 봅니다. 같은 글자 범위(`E70-E72`)의 현행 결과는 그대로입니다 | 범위 표기의 의미대로 해석하면 같은 글자 범위와 다른 글자 범위를 한 규칙으로 처리할 수 있습니다 |
| 6 | 보험 변경 직후 저장은 검사를 생략하고 완료만 늘 검사하는데, 서버도 완료 시점만 검증할지 | **따름:** 완료 때만 막고 저장은 `warnings`로 알립니다. `산정특례검증생략` 같은 생략 플래그는 두지 않습니다 | 저장은 위반이 있어도 통과시키고 완료는 막는다고 정했습니다 ([clinical.md](../design/clinical.md#저장)) |

**바뀌는 케이스:**
- `건보, 희귀질환(21), MT002 ' V101 ' (leading space: not seen as V-prefixed by lin) -> check skipped -> valid`: `requiresSpecificCode`가 `true`로 바뀝니다. `valid`는 그대로 `true` (#3)
- `건보, 희귀질환(21), MT002 'H101' (not V-prefixed) -> lin false -> check skipped -> valid`: `valid: false` (#3)
- `건보, 희귀질환(21), MT002 entry missing -> lin false -> check skipped -> valid`: `valid: false` (#3)
- `registered V999 (not in rare-disease data), 등록번호 prefix 21 -> falls back to all rows -> dx E71 -> [V102,V103]`: 후보 `[]` (#4)
- `연계상병 'Q00-R99' matches 'Q55'`: `matches: true` (#5)
- `연계상병 'Q00-R99' matches 'R50'`: `matches: true` (#5)
- #1은 기존 `validateSpecialCaseCode` 케이스에 상병 입력이 없어 기존 케이스를 바꾸지 않습니다. 일치·불일치 케이스를 새로 추가합니다

**사용자 확인 필요:** #2. 극희귀·상세불명희귀 등록자에게 특정기호 기재가 필수인지는 산정특례 고시 판단입니다

### telemedicine-fee-lines

[규칙 문서](../reference/rules/telemedicine-fee-lines.md) · 케이스 55 · 질문 8

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 관리료 금액을 클라이언트 상수(28.79점 × 연도별 단가, 10원 반올림)로 계산하고 없는 연도는 2026 단가로 대체하는 방식 | **바꿈:** 관리료 단가는 `fee-codes` 참조데이터에서 진료일 기준으로 가져와 라인에 고정합니다. 서버에 산식을 두지 않고, 진료일에 유효한 단가가 없으면 422 `REFERENCE_DATA_UNAVAILABLE`입니다. 점수·단가 값 자체는 적재 때 고시로 확인합니다 | 단가는 진료일 기준으로 라인에 고정합니다 ([clinical.md](../design/clinical.md#처방-라인), [catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)) |
| 2 | 관리료 시간대가 고정(07·09·18(토 13)·20시)이고 병원의 `주간진찰료산정기준` 설정을 쓰지 않는 것이 의도인지 | **따름:** 관리료 시간대는 병원 설정이 아니라 고시 시간대로 판정합니다. 경계 시각은 상수 대신 참조데이터(`regulatory-limits`)에 유효기간과 함께 둡니다 | 시간대별 관리료 수가코드는 정보 수집용이라 금액이 같습니다 ([claim.md](../reference/spec/claim.md)). 병원 설정은 대면 진찰료 가산용입니다 |
| 3 | 진찰료 줄마다 관리료를 하나씩 붙이는데 둘 이상이 맞는 경우가 있는지 | **바꿈:** 비대면 진료 하나에 관리료는 최대 1줄입니다. 진찰료 줄 수와 무관하게 하나만 두고 나머지는 지웁니다 | 비대면이면 진찰료가 기본코드 하나로 정리되므로 1줄이 정상이고, 관리료는 같은 환자에게 월 2회 한도로 셉니다 ([claim.md](../reference/spec/claim.md)) |
| 4 | 비대면이면 진찰료를 연령·야간·공휴·토요 가산 없는 기본코드로 되돌리는 동작 | **따름:** 비대면 진료의 진찰료는 기본코드로 정하고 가산을 붙이지 않습니다 | 비대면 시범사업은 진찰료·관리료에 가산을 붙이지 않습니다 ([claim.md](../reference/spec/claim.md)) |
| 5 | 설정·수가 마스터가 없거나 기본코드가 마스터에 없을 때 가산 붙은 진찰료를 둔 채 관리료만 붙이는 동작 | **바꿈:** 설정은 서버에 기본값으로 늘 있으므로 "설정 없음" 경로는 없습니다. 기본 진찰료 코드나 수가가 진료일 참조데이터에 없으면 진찰료를 그대로 두지 않고 422 `REFERENCE_DATA_UNAVAILABLE`로 거부합니다 | 가산 붙은 진찰료와 관리료가 함께 남으면 #4 규칙과 어긋난 청구가 됩니다 |
| 6 | `xo`가 `91001`~`91004`만 관리료로 보고 `91000…` 코드는 관리료로 보지 않는 동작 | **따름:** 관리료 라인은 `91001`~`91004` 네 코드로만 판정합니다 | `91000…` 코드는 [coverage-category-band](../reference/rules/coverage-category-band.md)에서 따로 다룹니다 |
| 7 | 화면 watcher가 갱신하며 비활성·공휴일 로딩 중 변경은 보류, 진료 전환 시 보류분 폐기, 자보1일2차는 건너뛰는 방식 | **바꿈:** 서버가 진료 저장(`PATCH /encounters/{id}`)에서 `serviceAt`·비대면 여부·진찰료 라인이 바뀌면 같은 요청 안에서 진찰료·관리료를 다시 계산합니다. 보류·폐기 상태는 없고, 공휴일은 참조데이터로 판정합니다. 자보1일2차 진료는 현행처럼 다시 계산하지 않습니다 | 진찰료 수가코드는 서버가 결정합니다 ([clinical.md](../design/clinical.md#완료-검증-규칙)). 화면을 열지 않아도 결과가 같아야 합니다 |
| 8 | `jh`가 자보·산재·일반과 첩건·방문진료가 있는 건보·급여 진료에서 비대면 토글을 숨기는(이미 켜졌으면 보임) 동작 | **따름:** 같은 조건을 서버 검증으로 옮깁니다. 조건 밖에서 비대면을 켜는 요청은 422로 거부하고, 이미 켜진 비대면을 끄는 요청은 받습니다 | 클라이언트 노출 조건만으로는 막을 수 없으므로 서버가 판정해야 합니다 ([front-desk.md](../design/front-desk.md#리소스-1)의 `benefitFlags.telemedicinePilot`) |

**바뀌는 케이스:**
- `2027-03-03 10:00 -> 2027 unit price missing -> 2026 fallback + console.error`: 2026 단가 대체 대신 참조데이터의 2027 단가, 없으면 422 `REFERENCE_DATA_UNAVAILABLE` (#1)
- `turn 비대면 on, fee list empty: consultation kept as-is + 91001 added`: 422 `REFERENCE_DATA_UNAVAILABLE` (#5)
- `turn 비대면 on, computed base code missing from list: original consultation lines kept`: 422 `REFERENCE_DATA_UNAVAILABLE` (#5)
- `toggle while inactive (활성=false) is deferred and applied once activated`: 보류 없이 저장 요청에서 바로 같은 결과(10100 + 91001)가 됩니다 (#7)
- `switch to another 진료Id resets pending flags; no emit`: 서버에는 해당 개념이 없어 서버 테스트에서 뺍니다 (#7)

**사용자 확인 필요:** 없음

## 추나

### chuna-annual-limit

[규칙 문서](../reference/rules/chuna-annual-limit.md) · 케이스 51 · 질문 8

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 현재 진료의 추나가 이미 심평원에 들어가 누적에 포함되면 20번째 진료 자체에 I0009가 뜨는데, 한도가 "20회 인정"인지 | **바꿈:** 한도는 "20회까지 인정, 21번째부터 불가"로 봅니다. 서버는 누적에서 현재 진료의 제출분(같은 `encounterId`, 같은 진료일)을 빼고 `이전 시행 수 ≥ 20`이면 `CHUNA_ANNUAL_LIMIT`입니다 | 매뉴얼 기준 건보 추나는 환자당 연 20회이고, 넘으면 심평원이 제출을 받지 않습니다 ([claim.md](../reference/spec/claim.md)) |
| 2 | 산재는 `이전 + 현재 ≥ 20`(20번째에 경고), 건보는 `이전 ≥ 20`(21번째에 경고)으로 경계가 다른 문제 | **바꿈:** 모든 보험구분에 #1과 같은 `이전 시행 수 ≥ 20` 하나를 씁니다 | 같은 한도에 보험구분마다 다른 경계를 둘 근거가 없습니다. 한도값은 `regulatory-limits`에서 보험구분별로 읽습니다 ([clinical.md](../design/clinical.md#완료-검증-규칙)) |
| 3 | 산재 `BFt`가 시행 일수가 아니라 추나 라인 수를 세서 한 진료의 두 줄이 두 번 세지는 문제 | **바꿈:** 시행 수는 추나 라인이 있는 진료일 수로 셉니다 | 추나는 둘 이상 해도 주된 것 1회만, 1일 1회 산정합니다 ([claim.md](../reference/spec/claim.md)) |
| 4 | 자보에도 같은 상수 20을 사고 단위로 적용해 화면 `n/20`과 자동 승인 중단에 쓰지만 처방 가드·청구 경고는 자보를 무시하는데, 자보 한도가 있는지 | **바꿈:** 자보는 사고 단위 20회를 넘으면 `CHUNA_ANNUAL_LIMIT`를 warning으로만 알리고 막지 않습니다 | 매뉴얼 기준 자보는 치료기간 중 20회까지 인정하고 넘으면 사례별로 인정합니다 ([claim.md](../reference/spec/claim.md)) |
| 5 | `당일추나시술여부`가 진료 기준일시가 아니라 기기의 오늘 날짜로 판정되는 문제 | **바꿈:** 당일 여부는 진료 `serviceAt`의 `Asia/Seoul` 날짜로 판정합니다 | 서버 판정은 `serviceAt` 기준입니다 ([clinical.md](../design/clinical.md#완료-검증-규칙), [conventions.md](../design/conventions.md#필드와-값)) |
| 6 | 심평원 `누적횟수`가 0이면 목록에 행이 있어도 0을 쓰는데, 0을 믿어도 되는지 | **보류:** 심평원 응답의 0이 "이력 없음"인지 "집계 안 됨"인지 확인이 필요합니다. 확인 전까지는 현행처럼 심평원 값을 우선합니다 | 심평원 응답 의미는 클라이언트 코드로 확인할 수 없는 외부 사실입니다 |
| 7 | 실시간 목록이 300건 × 10쪽에서 잘려도 경고 로그만 남기고 과소 집계할 수 있는 문제 | **바꿈:** 에이전트가 잘림을 결과에 표시하고, 서버는 사용량을 "불완전"으로 저장합니다. 불완전하거나 사용량이 없으면 한도 판정을 하지 않고 `CHUNA_USAGE_UNKNOWN` warning을 냅니다 | 과소 집계로 통과시키면 급여 청구가 삭감됩니다. 사용량은 `GET /patients/{id}/hira-usage`로 조회 시각과 함께 줍니다 ([claims.md](../design/claims.md#심평원-사전-제출)) |
| 8 | 웹에서는 가드가 막지 않고 I0009도 나오지 않는 문제 | **바꿈:** 서버가 저장된 심평원 사용량으로 클라이언트 종류와 무관하게 판정합니다. 저장은 warning, 완료는 `CHUNA_ANNUAL_LIMIT`로 막고, 라인을 지우지 않습니다 | 완료 검증 규칙으로 이미 정했습니다 ([clinical.md](../design/clinical.md#완료-검증-규칙)). 서버는 처방 라인을 임의로 지우지 않습니다 ([front-desk.md](../design/front-desk.md#리소스-1)의 보험구분 변경 방침) |

**바뀌는 케이스:**
- `산재 prior 19 + current 1 = 20 -> I0009 (>= 20 includes current)`: 경고 없음 (#2)
- `산재 counts 40721 and lines not records: prior 10 records x2 lines -> 20 + 1`: 이전 시행 수가 진료일 수(1)로 세져 경고 없음 (#3)
- `자보 cumulative 30 -> none (건보/급여 only)`: `CHUNA_ANNUAL_LIMIT` warning (#4)
- `건보 cumulative undefined (not live) -> none`: `CHUNA_USAGE_UNKNOWN` warning (#7)
- `건보 exhausted + not live -> warning only, chuna kept`: 라인 유지 + 저장 warning, 완료 차단 (#8)
- `건보 exhausted + live + newly added chuna -> dialog, chuna dropped`: 라인을 지우지 않고 저장 warning, 완료 차단 (#8)
- `급여 exhausted + live -> chuna dropped`: 라인을 지우지 않고 저장 warning, 완료 차단 (#8)
- #1·#5는 기존 케이스 입력(누적값, 같은 날의 `now`와 기준일시)으로는 결과가 같습니다. 현재 진료 제출분 포함·과거 진료 열기 케이스를 새로 추가합니다

**사용자 확인 필요:**
- #1: "21번째부터 불가" 해석은 매뉴얼 요약 근거라, 심평원 고시 원문으로 확인해야 합니다
- #2: 산재 추나에도 연 20회 한도가 있는지 근거 문서가 없습니다. 산재 한도값은 근로복지공단 기준으로 정해야 합니다
- #4: 자보 20회 초과를 경고만 할지(사례별 인정) 막을지는 업무 정책 판단입니다

### chuna-auto-approval

[규칙 문서](../reference/rules/chuna-auto-approval.md) · 케이스 27 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 같은 날 이력 검사가 삭제된 행도 포함해 취소된 제출이 있는 날은 다시 자동 제출되지 않는 것이 의도인지 | **바꿈:** 같은 날 `CANCELED` 상태가 아닌 제출만 자동 제출을 막습니다. 삭제(취소)된 제출만 있으면 새로 `QUEUED`를 만듭니다 | 매뉴얼은 잘못 낸 제출을 삭제한 뒤 다시 내는 절차를 둡니다 ([claim.md](../reference/spec/claim.md)). 상태는 `HiraPreSubmission.status`로 구분합니다 ([claims.md](../design/claims.md#심평원-사전-제출)) |
| 2 | 첫 미승인 추나 라인 하나만 제출해 한 진료의 여러 추나 라인이 모두 제출되지 않는 문제 | **따름:** 진료 하나에 추나 제출은 1건이고, 첫 미승인 추나 라인을 제출합니다 | 추나는 둘 이상 해도 주된 것 1회만, 1일 1회 산정합니다 ([claim.md](../reference/spec/claim.md)) |
| 3 | 자동 승인이 완료 뒤에 돌고 실패는 토스트로만 알리는데, 어떤 실패가 완료를 막아야 하는지 | **바꿈:** 어떤 실패도 완료를 막지 않습니다. 완료 트랜잭션은 큐 조건(정책·한도·같은 날 이력)만 보고 `QUEUED`를 만들고, 페이로드 검증 실패(상병·면허·사고접수번호·자격조회 없음)는 `FAILED`, 심평원 거부는 `REJECTED`로 사유와 함께 남깁니다 | 외부 호출은 트랜잭션 밖에서 에이전트가 처리합니다 ([clinical.md](../design/clinical.md#완료-커맨드)). 실패 건은 현황(`GET /hira-pre-submissions?status=`)에서 다시 냅니다 |
| 4 | 기제출 건의 상병이 현재 상병의 부분집합이면 승인으로 맞추고, 다르면 안내 없이 끝나는 문제 | **바꿈:** 부분집합이면 현행처럼 승인 상태로 맞춥니다. 다르면 제출 작업을 `FAILED`(사유 `DIAGNOSIS_MISMATCH`)로 남겨 삭제 후 재제출을 안내합니다 | 매뉴얼은 차트와 심평원 내용이 다른 건을 따로 보여 주고 "삭제 → 재제출"을 강제합니다 ([claim.md](../reference/spec/claim.md)) |
| 5 | 자보도 사고 단위 누적을 같은 20으로 판정해 자동 제출을 멈추는데, 자보에 20회 한도가 있는지 | **바꿈:** 자보는 20회를 넘어도 자동 제출을 멈추지 않고, [chuna-annual-limit](../reference/rules/chuna-annual-limit.md) #4의 warning만 냅니다 | 매뉴얼 기준 자보는 20회 초과도 사례별로 인정합니다 ([claim.md](../reference/spec/claim.md)) |

**바뀌는 케이스:**
- `same-day row that is deleted still skips (no 삭제여부 check)`: 제출 작업 `QUEUED` 생성 (#1)
- `no diagnoses -> error toast`: 제출 작업 `FAILED`(사유: 상병 없음), 완료는 유지 (#3)
- `performer has no license -> error toast`: 제출 작업 `FAILED`(사유: 면허 없음) (#3)
- `submission returns error -> error toast`: 제출 작업 `REJECTED` + 심평원 사유 (#3)
- `자보 without accident number -> error toast`: 제출 작업 `FAILED`(사유: 사고접수번호 없음) (#3)
- `건보 without 보험조회 -> error toast`: 제출 작업 `FAILED`(사유: 자격조회 없음) (#3)
- `already submitted at HIRA but diagnoses differ -> nothing`: 제출 작업 `FAILED`(사유 `DIAGNOSIS_MISMATCH`) (#4)
- 질문과 별개로 설계에서 이미 바뀌는 케이스: `not Electron (web) -> no-op`은 에이전트가 연결돼 있으면 웹에서 완료해도 `QUEUED`를 만듭니다 ([claims.md](../design/claims.md#심평원-사전-제출))

**사용자 확인 필요:**
- #3: 상병 없음·면허 없음처럼 제출 전에 알 수 있는 실패로 완료를 막을지는 업무 흐름 판단입니다. 권장안은 막지 않고 `FAILED`로 남기는 쪽입니다
- #5: 자보 20회 초과 시 자동 제출을 계속할지는 [chuna-annual-limit](../reference/rules/chuna-annual-limit.md) #4와 같이 정해야 합니다

## 첩약 시범사업

### pilot-herbal-diagnosis-limit

[규칙 문서](../reference/rules/pilot-herbal-diagnosis-limit.md) · 케이스 34 · 질문 9

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 다른 2개 질환 차단을 `Cdn`은 무조건 먼저 적용하고 `$dn`은 선택 질환 이력이 없을 때만 적용해 "코드는 G, 화면은 처방 불가"가 생기는데 어느 쪽이 맞는가 | **바꿈:** 서버 규칙 하나로 "올해 이력 질환 집합 ∪ 선택 질환이 2개를 넘으면 처방 불가"로 판정합니다. 결과는 `Cdn`과 같고, 본인부담률 코드도 이 판정을 먼저 따릅니다 | 급여는 회계연도 기준 두 질환까지입니다([ocs.md](../reference/spec/ocs.md)). [review.md](../design/review.md#규칙-이전-시-동작-차이)가 이 불일치를 결정 대상으로 올렸고, 정상 데이터에서는 두 판정이 같아 이상 데이터(이미 3개 질환)에서만 갈립니다 |
| 2 | 하드코딩된 20일(`>= 20` → `U`·경고)이 질환별 급여 상한이며 `regulatory-limits` 참조값으로 둬야 하는가 | **따름:** 경계 `누적일수 >= 20`이면 `U` + 경고를 유지하고, 값 20은 `regulatory-limits`에 유효기간과 함께 둡니다 | 매뉴얼 요약에 "질환별 20일, 넘으면 같은 기관·같은 질환은 전액본인부담"이 있습니다([ocs.md](../reference/spec/ocs.md)). 한도 상수는 참조데이터로 옮기기로 이미 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)) |
| 3 | 같은 질환 행에 `Y`·`N`이 섞이면 `Y`가 이기고 일수는 최대값이라 타원 이력이 가려지는데 의도인가 | **보류:** 심평원 `selectPatPcmdList` 행 단위(기관별·진료년월별)와 `누적투약일수`가 기관별인지 환자 합계인지 확인해야 합니다. 확인 전까지 현행 병합을 유지합니다 | 같은 질환은 그해 최초 처방기관에서만 시범 적용되므로([ocs.md](../reference/spec/ocs.md)) 어느 기관이 먼저인지가 핵심인데, 현행 응답 필드로는 순서를 알 수 없습니다 |
| 4 | 웹은 선택 질환 한 건만 받아 다른 2개 질환 규칙이 웹에서 발동하지 않는다 | **바꿈:** 서버는 접속 경로와 무관하게 항상 전체 질환 목록(코드 `00` 조회)을 데스크톱 에이전트로 받아 `GET /patients/{id}/pilot-herbal-history`로 판정합니다 | 심평원 연동은 서버가 작업을 소유하고 에이전트가 실행합니다([claims.md](../design/claims.md#데스크톱-에이전트), [claims.md](../design/claims.md#심평원-사전-제출)). 웹·앱 차이를 없앱니다 |
| 5 | `$dn`이 질환 코드 `watch` 시점의 캐시 이력으로 돌아 웹 첫 선택은 빈/이전 이력으로 판정된다 | **바꿈:** 서버가 저장·완료 시점에 최신 심평원 이력으로 판정합니다. 이력을 아직 받지 못했으면 판정하지 않고 "이력 조회 필요" 경고를 줍니다 | 완료 검증은 서버가 판정합니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 클라이언트 표시 타이밍은 서버 범위가 아닙니다 |
| 6 | `Y`가 아닌 등록 여부(`""` 포함)를 `N`으로 바꿔 미확인 행이 타원 이력으로 처방 불가가 되는데 의도인가 | **바꿈:** 등록 여부를 대소문자 무시로 `Y`/`N`/미확인 셋으로 읽고, 미확인 행은 처방 불가로 판정하지 않고 "심평원 이력 확인 필요" 경고만 주며 본인부담률 코드를 자동으로 정하지 않습니다 | 빈 값은 웹 대체 경로에서 필드가 빠져 생긴 값이라 타원 이력이라는 근거가 없습니다. 다만 미확인을 급여로 진행할지 막을지는 삭감 위험을 누가 지느냐의 정책 문제입니다 |
| 7 | 받침과 무관하게 `으로`를 붙인다("안면신경마비으로") | **바꿈:** 서버 문구는 받침에 따라 `로`/`으로`를 고릅니다. 판정 결과(처방 불가 여부·코드)는 바뀌지 않습니다 | 표시 문구만의 차이입니다. 테스트는 오류 코드와 판정으로 비교하고 문구는 별도로 고칩니다 |
| 8 | 이력을 진료 연도가 아닌 올해(`new Date().getFullYear()`)로 조회한다 | **바꿈:** 진료 `serviceAt`을 병원 시간대(Asia/Seoul)로 바꾼 연도로 조회합니다 | 서버 규칙은 진료일 기준입니다([clinical.md](../design/clinical.md#완료-검증-규칙), [conventions.md](../design/conventions.md#필드와-값)). 급여일수도 회계연도(1~12월) 기준입니다([ocs.md](../reference/spec/ocs.md)) |
| 9 | `M0e`에 없는 질환 코드(00–06 외)로 이력이 있으면 `TypeError`가 난다 | **바꿈:** 질환 코드는 `herbal-applicable-diseases` 참조데이터로 검증해 없으면 422 검증 오류로 돌려줍니다. 이력의 알 수 없는 질환 행은 질환 개수에는 세되 이름이 없어도 실패하지 않습니다 | 참조데이터는 서버가 `asOf`로 조회합니다([catalog.md](../design/catalog.md#참조데이터-전국-공통-읽기-전용)). 예외로 판정 전체가 실패하면 안 됩니다 |

**바뀌는 케이스:**
- `copay: current-disease history skips the 2-disease check (differs from eligibility)`: `G`·전액부담 선택 가능 → 처방 불가와 같은 빈 코드(`""`, 선택 불가) (Q1)
- `eligibility: empty registration flag is normalized to N and blocks as other clinic`: 처방 불가 → 처방 가능 + "심평원 이력 확인 필요" 경고 (Q6)
- `copay: empty registration flag is normalized to N and gives blank`: 빈 코드 → 자동 지정 안 함(`undefined`, 사용자 선택 유지) (Q6)
- `eligibility: particle 으로 is appended regardless of final consonant`: 문구가 "환자가 안면신경마비로 20일 처방받았습니다."로 바뀜, 판정은 같음 (Q7)
- `eligibility: code outside M0e with matching row throws`: `TypeError` → 422 검증 오류 (Q9)

**사용자 확인 필요:** Q1 (이미 3개 질환 이력이 있는 이상 데이터에서 선택 질환이 기존 질환이면 처방을 막을지는 고시 해석입니다), Q6 (등록 여부 미확인 이력을 막을지 경고만 할지는 삭감 위험을 감수할지의 정책입니다).

### pilot-herbal-claim-checks

[규칙 문서](../reference/rules/pilot-herbal-claim-checks.md) · 케이스 53 · 질문 12

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | `tBt`가 12개를 모두 계산하지만 C0001·C0003·C0005만 남기고 진료 화면은 C0001·C0003만 보이는데, 나머지는 일부러 끈 것인가 | **바꿈:** 서버는 C0001–C0012를 모두 검사별 warning으로 판정해 진료 저장 응답 `warnings`와 청구 명세서 `issues[]`에 같은 결과를 넣습니다. 화면 허용 목록 필터는 두지 않습니다 | 설계가 "청구 검사 C0001–C0012, 검사별 warning"으로 이미 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙), [claims.md](../design/claims.md#모델)). 각 검사는 매뉴얼의 산정 기준과 대응합니다([ocs.md](../reference/spec/ocs.md)) |
| 2 | C0004·C0010이 `Df(이전, 현재)`라 과거 기록이면 항상 참이 되는데 인자가 뒤집힌 것인가 | **바꿈:** 날짜 차이는 Asia/Seoul 달력일로 계산합니다. C0004는 다른 심층변증 기록과 현재 진료의 날짜 차이 절댓값이 10일 이하이면, C0010은 다른 첩약 진료가 같은 진료일이면 경고합니다 | C0004 문구는 "10일당 1회", C0010 문구는 "같은 날짜에 2개 이상의 기준 처방"이고 매뉴얼도 "하루 한 번"입니다([ocs.md](../reference/spec/ocs.md)). 과거 차트를 고칠 때 뒤 날짜 기록도 대상이라 양방향으로 봅니다 |
| 3 | C0004·C0010이 다른 진료 중 최신 1건만 비교하고, `기준일시`가 없으면 정렬이 입력 순서가 된다 | **바꿈:** 서버가 해당 환자의 진료를 기간(±10일 / 같은 날)으로 직접 조회해 범위 안의 모든 기록과 비교합니다. `serviceAt`은 필수라 빠진 경우가 없습니다 | 클라이언트 `최근진료데이터` 범위에 기대지 않고 서버가 기간 조회해야 합니다([규칙 문서](../reference/rules/pilot-herbal-claim-checks.md)) |
| 4 | C0007이 없는 상수 `Kp.조제탕전료`를 써 절대 발동하지 않는데 의도한 접두어는 `904`인가 | **바꿈:** 조제·탕전료는 `904` 접두어가 아니라 코드 목록 `90411`·`90412`·`90421`·`90422`로 판정합니다(`904` 접두어는 심층변증 `90401`까지 포함하기 때문). 가산 판정은 Q5를 따릅니다 | `Kp`에 정의된 조제·탕전료 코드는 이 넷뿐입니다([규칙 문서](../reference/rules/pilot-herbal-claim-checks.md)) |
| 5 | C0007이 `수가코드` 길이 > 5를 가산 코드로 보는데 가산 표기가 클라이언트에 없다 | **보류:** `fee-codes` 참조데이터에서 가산 수가를 어떻게 표기하는지(자릿수·접미 코드·별도 속성) 확인해야 합니다. 확인 전까지 길이 > 5 규칙을 씁니다 | 가산 판정은 서버가 수가코드로 결정하는 영역이고([clinical.md](../design/clinical.md#완료-검증-규칙)) 참조데이터 속성으로 판정하는 것이 맞지만 현재 근거 문서에 표기 규칙이 없습니다 |
| 6 | C0012가 `진료의목록`을 받아야 하는데 호출부가 넘기지 않아 발동하지 않는다 | **바꿈:** 서버가 진료 담당 의사의 직원 정보로 환자와 같은 사람인지 직접 판정해 경고합니다 | 한의사가 자기 자신을 진료한 경우는 시범 대상에서 빠집니다([ocs.md](../reference/spec/ocs.md)). 서버는 담당 의사를 항상 압니다 |
| 7 | C0002(`기타정보` 없음)·C0008(질환 코드 `00`)이 `TypeError`를 던져 다른 경고까지 사라진다 | **바꿈:** 검사마다 독립적으로 판정하고, 첩약 라인에 특정내역이 없으면 C0002는 통과(C0006과 같은 처리), 질환 코드 `00`(공통처방)은 C0008을 건너뜁니다 | C0002는 이미 `00`을 건너뛰고 C0006은 `기타정보`가 없으면 통과합니다. 한 검사의 예외가 전체 경고를 지우면 안 됩니다 |
| 8 | C0009가 문구("제 1부상병")와 달리 `I69`/`U234`를 아무 부상병 위치에서나 허용한다 | **바꿈:** 질환 코드 `03`이면 제1부상병(진료 상병 순서상 첫 부상병)이 `I69`·`U234`로 시작해야 통과합니다 | 매뉴얼은 "뇌혈관질환후유증만 제1부상병에 둔다"고 합니다([ocs.md](../reference/spec/ocs.md)) |
| 9 | C0003은 한방보험약 `34001001`만 검출하는데 자동 수정은 한방조제료 `34002001`까지 지운다 | **따름:** 검출은 `34001001`, 자동 수정 정정 제안은 두 라인을 함께 지웁니다. `34002001` 단독 검출은 신규 규칙이라 여기서 다루지 않습니다 | 보험약을 지우면 딸린 조제료도 남을 근거가 없고, 첩약 처방 시 한방 외래 조제료는 따로 못 받습니다([ocs.md](../reference/spec/ocs.md)). 자동 수정은 의사가 반영하는 정정 제안입니다([claims.md](../design/claims.md#엔드포인트)) |
| 10 | C0005가 첫 `35001001` 라인만 본다 | **바꿈:** 모든 `35001001` 라인을 보고, 미승인 라인마다 원인 id로 넣습니다 | 완료 검증이 "모두 승인"이라 같은 기준으로 맞춥니다([clinical.md](../design/clinical.md#완료-검증-규칙), pilot-herbal-approval-required Q3) |
| 11 | `tBt`는 `보험구분`이 `건보`/`급여`이고 `한방첩약시범사업` 값이 있을 때만 돈다 | **따름:** 서버도 보험구분 NHIS·MEDICAL_AID이고 `benefitFlags.pilotHerbal`이 있을 때만 검사합니다 | 실행 조건을 바꿀 근거가 없습니다([front-desk.md](../design/front-desk.md)). 의료급여 환자의 시범 제외([ocs.md](../reference/spec/ocs.md))는 별도 신규 규칙입니다 |
| 12 | 모든 날짜 비교가 브라우저 로컬 시간대다 | **바꿈:** 모든 날짜 차이·같은 날 판정을 테넌트 시간대(Asia/Seoul)로 합니다 | 병원 시간대는 테넌트 설정이고 서버가 날짜 경계를 계산합니다([conventions.md](../design/conventions.md#필드와-값)) |

**바뀌는 케이스:**
- `C0004: previous 심층변증 11 days before (still fires: Df argument order)`: 경고 → 경고 없음 (Q2)
- `C0004: previous 심층변증 365 days before still fires`: 경고 → 경고 없음 (Q2)
- `C0004: missing 기준일시`: `serviceAt`이 필수라 서버 입력으로 성립하지 않으므로 케이스를 폐기합니다 (Q3)
- `C0010: previous 첩약 1 day before`: 경고 → 경고 없음(다른 날) (Q2)
- `C0010: previous 첩약 30 days before still fires`: 경고 → 경고 없음 (Q2)
- `C0010: other record 1 day after current: flagged`: 경고 → 경고 없음(다른 날) (Q2)
- `C0010: other record 23h59m after (same Df 0): flagged`: 경고 → 경고 없음(1월 1일과 1월 2일은 다른 날) (Q2·Q12)
- `C0007: Kp.조제탕전료 is undefined so check never fires (6-digit codes)`: 경고 없음 → C0007 경고(원인 `d1`, `t1`), Q5가 길이 규칙으로 남는 동안 (Q4)
- `C0002: 첩약 line without 기타정보 throws`: `TypeError` → 경고 없음 (Q7)
- `C0008: disease 00 has no wU entry: throws`: `TypeError` → 경고 없음 (Q7)
- `C0009: disease 03 with 부상병 U234 (any position)`: 경고 없음 → C0009 경고(제1부상병이 `R51`) (Q8)
- `tBt: all checks firing: only C0001, C0003, C0005 are returned`: C0001·C0003·C0005 → C0001·C0002·C0003·C0005·C0006·C0008·C0011 (C0004는 14일 전이라 Q2로 빠짐) (Q1·Q2)
- `HFt: treatment-screen warnings keep C0001 and C0003, drop C0005`: C0001·C0003 → C0001·C0003·C0005 (Q1)

**사용자 확인 필요:** Q1 (지금 화면에 없던 경고 9종이 한꺼번에 생기므로 모두 켤지 업무 판단이 필요합니다), Q2 (C0004 기준이 날짜 간격 10일인지 "처방일수 10일당 1회"인지는 고시 해석입니다).

### pilot-herbal-doctor-limit

[규칙 문서](../reference/rules/pilot-herbal-doctor-limit.md) · 케이스 29 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 횟수를 진료 `기준일시`가 아니라 브라우저의 오늘 날짜로 조회한다 | **바꿈:** 진료 `serviceAt`을 Asia/Seoul로 바꾼 날짜 기준으로 하루·월·연 횟수를 셉니다 | 완료 검증은 `serviceAt` 기준이고 집계 엔드포인트도 `?date=`를 받습니다([clinical.md](../design/clinical.md#완료-검증-규칙), [claims.md](../design/claims.md#심평원-사전-제출)) |
| 2 | 승인 횟수에 지금 저장하는 진료가 들어 있는지 알 수 없고, `> 8`이면 9번째 승인부터 초과가 된다 | **바꿈:** 서버는 같은 의사의 본인부담 30% 첩약 시범 처방을 `serviceAt` 순으로 세어 현재 진료의 순번(앞선 건 + 1)을 구하고, 순번이 8/60/600을 넘으면 초과로 봅니다. 전액본인부담(`U`) 건은 세지 않습니다 | "초과는 9/61/601부터"([clinical.md](../design/clinical.md#완료-검증-규칙))와 "시간순 9번째 환자부터 전액본인부담, 30% 건만 셈"([ocs.md](../reference/spec/ocs.md))에 맞춥니다. 픽스처 입력을 "현재 포함 순번"으로 읽으면 expected는 그대로입니다 |
| 3 | 횟수 쿼리에 가드가 없어 진료의가 정해지기 전 `doctor/undefined`로 호출된다 | **바꿈:** 규칙은 진료 담당 의사가 있을 때만 판정하고, 집계 엔드포인트는 의사 id가 없으면 검증 오류입니다 | `GET /doctors/{id}/pilot-herbal-counts`는 경로에 의사가 필수입니다([claims.md](../design/claims.md#심평원-사전-제출)) |
| 4 | 월·연 구간이 달력 기준인지 롤링인지 서버 엔드포인트만 안다 | **보류:** 현행 서버 엔드포인트의 구간 정의와 고시 문구를 확인해야 합니다. 확인 전 기본값은 Asia/Seoul 달력 월·연(1~12월)으로 둡니다 | 매뉴얼 요약은 "1일 8건, 월 60건, 연 600건"만 적고 구간 정의는 없습니다([ocs.md](../reference/spec/ocs.md)). 급여일수는 회계연도 기준이라 달력 구간이 유력합니다 |
| 5 | 횟수가 바뀔 때마다 `watch`가 사용자 선택을 `U`로 덮고, 서버 강제는 보이지 않는다 | **따름:** 서버가 저장 시 한도 초과면 본인부담률 코드를 `U`로 정하고 `PILOT_HERBAL_DOCTOR_LIMIT` 경고를 줍니다. 초과인데 `G`로 보내도 `U`로 저장합니다 | 설계가 "초과분은 `U`로 자동 변경 + 경고"로 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 같은 처방에 30%와 100%를 섞을 수 없습니다([ocs.md](../reference/spec/ocs.md)) |

**바뀌는 케이스:** 없음.
**사용자 확인 필요:** 없음.

### pilot-herbal-approval-required

[규칙 문서](../reference/rules/pilot-herbal-approval-required.md) · 케이스 15 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | `35001001`(첩약) 라인만 승인 검사하고 조제·탕전료·심층변증·한약재·시범사업약재는 보지 않는데 승인 단위가 첩약 라인이 맞는가 | **따름:** 승인 검사는 `35001001` 라인만 합니다. 다른 시범사업 라인은 `hiraApproval.status = NOT_REQUIRED`입니다 | 설계가 "카테고리 `35001001`은 모두 승인 상태"로 정했습니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 심평원 제출은 수진자 진료정보(처방) 단위입니다([claim.md](../reference/spec/claim.md)) |
| 2 | SOO 단독 계정과 비대면 SOO 주문 완료는 승인 검사를 건너뛰는데 서버도 예외로 두는가 | **바꿈:** 계정·완료 경로로 건너뛰지 않고 미승인 `35001001` 라인이 있으면 어느 경로든 완료를 막습니다. SOO 단독 테넌트는 애초에 첩약 시범 라인을 만들 수 없게 합니다 | 서버 규칙은 라인 상태로 판정합니다([clinical.md](../design/clinical.md#완료-검증-규칙)). 미제출 첩약은 심사불능이라([claim.md](../reference/spec/claim.md)) 경로 예외를 둘 근거가 없습니다 |
| 3 | 청구 검사 C0005는 첫 라인만, 완료 검사는 모든 라인을 본다 | **바꿈:** 둘 다 모든 `35001001` 라인을 봅니다 | 같은 승인 규칙을 두 곳에서 다르게 판정할 이유가 없습니다(pilot-herbal-claim-checks Q10) |
| 4 | 진료 화면 실시간 경고가 C0005를 걸러 내고, 청구함 C0005는 서버 데이터에서 온다 | **바꿈:** 서버가 진료 저장 응답 `warnings`와 청구 명세서 `issues[]`에 같은 C0005를 넣습니다. 완료는 `PILOT_HERBAL_NOT_APPROVED`로 막습니다 | "저장은 warnings로 알리고 완료는 막는다"는 설계와 맞습니다([clinical.md](../design/clinical.md#저장)). 검사 출처를 서버 하나로 합칩니다 |
| 5 | `승인여부 = true`를 심평원 제출 화면(클라이언트)이 정하므로 서버에 자체 승인 상태 출처가 필요하다 | **바꿈:** 승인 여부는 `HiraPreSubmission`(kind `PILOT_HERBAL`) 결과로만 바뀌는 라인의 `hiraApproval.status`로 판정하고, 클라이언트가 보낸 플래그는 무시합니다 | 이미 정한 설계입니다([clinical.md](../design/clinical.md#처방-라인), [claims.md](../design/claims.md#심평원-사전-제출)). 픽스처의 `승인여부`는 `hiraApproval.status == APPROVED`로 읽습니다 |

**바뀌는 케이스:**
- `claim C0005: only the first pilot line is inspected`: 경고 없음 → C0005 경고(원인 `b`) (Q3)
- `flow: SOO-only account skips the approval check`: 검사 건너뜀 → SOO 단독 테넌트에서는 첩약 시범 라인 생성 자체가 거부되고, 라인이 있으면 완료가 막힘 (Q2)
- `flow: non-face-to-face SOO order completion skips save and approval check`: 검사 건너뜀 → `PILOT_HERBAL_NOT_APPROVED`로 완료가 막힘 (Q2)
- `realtime claim warning: C0005 is computed but filtered out of treatment-screen warnings`: `[]` → `["C0005"]` (Q4)

**사용자 확인 필요:** Q2 (비대면 SOO 주문 완료에서 첩약 시범 처방이 실제로 있는지, 있으면 막아도 업무가 되는지는 운영 정책입니다).

## 탕전·치료실·설정·CRM

### external-herbal-precheck

[규칙 문서](../reference/rules/external-herbal-precheck.md) · 케이스 32 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | precheck의 `catch {}`가 네트워크·4xx·5xx·형식 오류를 모두 삼키고 결제를 계속합니다. | **바꿈:** `:place`가 서버에서 precheck를 다시 하고, 실패하면 422, 외부 시스템에 닿지 않으면 503으로 결제를 막습니다. 엔드포인트 미배포를 이유로 건너뛰지 않습니다 | 재설계가 이미 정했습니다 ([herbal-pharmacy.md](../design/herbal-pharmacy.md#원외탕전-주문)). 현행 우회는 [review.md](../design/review.md#규칙-이전-시-동작-차이)에 결정 대상으로 올라 있습니다 |
| 2 | 클라이언트가 `result.data.ok`를 읽어서, 응답에 `data` 래퍼가 없으면 `ok:false`도 통과합니다. | **바꿈:** precheck 결과를 래퍼 없이 `{ ok, lineIssues[] }`로 고정하고, `ok === true`일 때만 통과합니다. `ok`가 없거나 결과가 비어 있으면 실패로 봅니다 | 모델의 `precheck?: { checkedAt, ok, lineIssues[] }`와 같은 모양입니다 ([herbal-pharmacy.md](../design/herbal-pharmacy.md#원외탕전-주문)). 판정이 서버 안에서 끝나므로 응답 해석 오류가 생기지 않습니다 |
| 3 | 줄 단위 실패 코드는 `OUT_OF_STOCK`만 구분하고 나머지는 모두 "수량 불일치"로 묶습니다. 전체 코드 목록은 알 수 없습니다. | **보류:** 외부 탕전원(MEDIONE)이 돌려주는 실패 코드 목록을 확인해야 합니다. 그때까지 서버는 모르는 코드를 `UNKNOWN`으로 받고 원문 코드를 `lineIssues[].rawCode`에 남깁니다 | 모델은 `code: OUT_OF_STOCK|...`로 열어 두었습니다 ([herbal-pharmacy.md](../design/herbal-pharmacy.md#원외탕전-주문)). 현행 화면 매핑은 [ocs.md](../reference/spec/ocs.md)에 있습니다 |
| 4 | 초안 저장이 실패하거나 견적 직전 훅(복약지도서 업로드)이 실패해도 견적·결제를 계속합니다. | **바꿈:** `:quote`와 `:place`는 서버에 저장된 `draft`로만 계산하므로, 저장에 실패한 초안으로는 견적을 낼 수 없습니다. 복약지도서는 업로드가 끝난 `medicationGuideFileId`만 `draft`에 넣고, 업로드에 실패하면 클라이언트가 견적 요청 전에 멈춥니다 | 주문은 `draftId`가 아니라 `ExternalHerbalOrder.id`로 식별하고, `PATCH`는 DRAFT일 때만 받습니다 ([herbal-pharmacy.md](../design/herbal-pharmacy.md#원외탕전-주문)) |
| 5 | 결제수단 배분(Fi)은 예치금 카드를 뒤에서부터 줄이고 남은 금액을 일반카드에 몰아줍니다. 일반카드가 여럿이면 첫 장만 씁니다. | **바꿈:** 서버는 금액을 다시 나누지 않습니다. `paymentMethods[]` 합이 `quote.payable`과 다르면 422를 돌려주고, 일반카드 개수는 제한하지 않습니다 | 재설계가 이미 정했습니다 ([herbal-pharmacy.md](../design/herbal-pharmacy.md#원외탕전-주문)). 금액 조정은 클라이언트 입력 보조로만 남습니다 |
| 6 | 약재 수량은 첩당 용량을 0.1g 단위로 반올림한 뒤 첩수를 곱합니다(3.25g × 20 = 66). | **따름:** 첩당 용량을 0.1g 단위로 반올림(half-up)하고 첩수를 곱합니다. 부동소수 대신 십진 고정소수로 계산하고, precheck와 견적이 같은 함수를 씁니다 | 외부 주문 수량과 재고 확인이 현행 식에 맞춰져 있습니다. 같은 식을 쓰는 것이 [규칙 문서](../reference/rules/external-herbal-precheck.md)의 요구입니다 |

**바뀌는 케이스:**
- `precheckGate: network error / 5xx swallowed -> proceeds`: 결제가 진행되지 않고 503으로 막힙니다 (`proceedToPaymentConfirm: false`)
- `precheckGate: 404 endpoint missing swallowed -> proceeds`: 503으로 막힙니다
- `precheckGate: null result -> TypeError swallowed -> proceeds`: 결과가 비었으므로 실패로 보고 막습니다
- `precheckGate: result without .data wrapper (ok:false at top level) -> proceeds`: 래퍼 없는 `ok:false`를 그대로 읽어 422로 막고 "재고 부족"을 알립니다
- `precheckGate: ok missing (undefined) -> proceeds`: `ok !== true`이므로 막습니다
- `allocatePaymentMethods: general card absorbs remainder`: 서버가 금액을 채우지 않습니다. 합 30,000 ≠ 50,000이므로 422입니다
- `allocatePaymentMethods: deposit cards trimmed from last when over total`: 합 70,000 ≠ 40,000이므로 422입니다
- `allocatePaymentMethods: no general card: last deposit card topped up`: 합 20,000 ≠ 25,000이므로 422입니다
- `allocatePaymentMethods: zero-amount methods dropped`: 합 55,000 ≠ 50,000이므로 422입니다

**사용자 확인 필요:** 4번 — 복약지도서 첨부가 원외탕전 주문의 필수 요건인지는 업무 정책입니다. 필수라면 서버도 `medicationGuideFileId` 없는 `:quote`를 422로 막아야 하고, 선택이라면 업로드 실패 시 첨부 없이 진행할지를 사용자에게 묻게 됩니다.

### procedure-timer

[규칙 문서](../reference/rules/procedure-timer.md) · 케이스 26 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 만료 상태(`pending` + `타이머종료=true`)는 클라이언트만 계산하고, 서버에는 TIMER_ELAPSED 전이가 없습니다. | **바꿈:** 서버가 `timerEndsAt = startedAt + durationSeconds`에서 `TIMER_ELAPSED`로 상태를 바꾸고 `procedure.updated` 이벤트를 냅니다. 경계는 현행처럼 남은 시간이 0초 이하(초 단위 내림)일 때입니다 | 재설계가 이미 정했습니다 ([clinical.md](../design/clinical.md#치료실)) |
| 2 | 만료된 시술은 같은 내원의 다른 시술을 개별 시작할 때만 자동 완료됩니다. 세트 완료·재시작·순서 변경은 자동 완료를 일으키지 않습니다. | **따름:** `procedure-timers.autoCompleteElapsedOnNextStart` 기본값을 켜 두고, 개별 `:start`(세트를 베드에서 시작하는 경우 포함)에서만 같은 베드의 `TIMER_ELAPSED` 시술을 완료합니다. `:complete-all`·`:restart-timer`·`:reorder`는 자동 완료를 하지 않습니다 | 정책 이름과 동작은 [clinical.md](../design/clinical.md#치료실)에 있습니다. 한 베드에는 내원 하나만 있으므로 "같은 베드"와 현행 "같은 내원"은 결과가 같습니다 |
| 3 | `시작일시` 없는 running 행은 클라이언트에서만 1초씩 줄다가 0에서 만료되고, `종료시각Ms`가 null이라 알림이 키로 중복 제거되지 않습니다. | **바꿈:** `RUNNING`이면 `startedAt`·`timerEndsAt`이 반드시 있다는 불변식을 둡니다. `:start`가 둘을 함께 기록하므로 이런 행이 생기지 않습니다. 종료 알림 키는 `procedureId + timerEndsAt`입니다 | 만료를 서버가 판정하려면 종료 시각이 있어야 합니다 ([clinical.md](../design/clinical.md#치료실)). 이관할 때 `시작일시` 없는 running 행이 있으면 `PENDING`으로 되돌립니다 |
| 4 | 남은 시간은 snapshot의 `serverNow`로 보정한 브라우저 시계로 계산하고, 로컬 변경 뒤 2초간은 snapshot을 무시합니다. 서버 만료 판정은 서버 시간만 써야 합니다. | **바꿈:** 만료·자동 완료·`durationSeconds` 검사(`새 시간 − 경과 ≥ 1`)는 서버 시계로만 합니다. 보드 응답의 `serverTime`은 화면 표시용이고, 2초 무시 같은 처리는 클라이언트 몫입니다 | 보드에 `serverTime`을 함께 주는 방식은 [clinical.md](../design/clinical.md#치료실)에 정해져 있습니다. 2초 무시 규칙은 서버 범위가 아닙니다 |
| 5 | 타이머 설정 기본값(새 항목 300초, 세트 fallback 900초)은 클라이언트 상수이고, 서버 기본값은 알 수 없습니다. | **따름:** 같은 값을 서버 `procedure-timers` 설정의 기본값으로 둡니다(`defaultItemSeconds: 300`, `defaultSetSeconds: 900`). 세트 시간은 항목 중 가장 긴 시간으로 합니다 | 타이머 설정은 단일 객체 설정 `procedure-timers`입니다 ([catalog.md](../design/catalog.md#운영)). 현행 사용자가 보던 값을 그대로 유지합니다 |

**바뀌는 케이스:**
- `mapServerProcedure: exactly at end (remaining 0)`: `pending` + `타이머종료` 대신 서버 상태 `TIMER_ELAPSED`가 됩니다
- `mapServerProcedure: after end`: 서버 상태 `TIMER_ELAPSED`가 됩니다
- `mapServerProcedure: pending row passes through 타이머종료여부; 원장 -> doctor`: 만료 표시가 `pending` + 플래그가 아니라 `TIMER_ELAPSED` 상태로 옵니다
- `mapServerProcedure: running without 시작일시 keeps running with null remaining`: 이런 행은 생기지 않습니다. 이관분은 `PENDING`이 됩니다
- `tick: simultaneous expiries share one batch; no-start row counts down remaining`: 만료된 a·b가 `TIMER_ELAPSED`가 되고, 시작 시각 없는 running 행 d는 생기지 않습니다. 알림 키는 모두 `timerEndsAt`을 가집니다
- `startTreatment: starting a done procedure uncompletes then starts`: `uncomplete` + `start` 두 번 대신 `:start` 한 번으로 같은 결과를 냅니다

**사용자 확인 필요:** 없음

### settings-validation

[규칙 문서](../reference/rules/settings-validation.md) · 케이스 54 · 질문 6

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 설계 초안은 "치료실 bedCount ≤ 10"인데, 클라이언트는 베드를 0–20(저장은 1 이상), 치료실 수를 10개까지로 제한합니다. | **따름:** 치료실은 병원당 최대 10개, 치료실당 `bedCount`는 1–20 정수입니다. 한도를 넘으면 422입니다 | 재설계가 이미 현행 값으로 정했습니다 ([catalog.md](../design/catalog.md#운영)) |
| 2 | 설계 초안은 비급여 금액을 "1천만원 미만"으로 적었지만, 클라이언트는 10,000,000을 넘을 때만 막아 정확히 10,000,000은 받습니다. | **따름:** 10,000,000원 **이하**만 받습니다(`≤`). 넘으면 클램프하지 않고 422로 거절합니다 | 재설계 검증 규칙이 "10,000,000원 이하"입니다 ([catalog.md](../design/catalog.md#진료-항목가격표)). 입력 클램프는 화면 동작입니다 |
| 3 | 패키지 항목 금액은 `별도`·`포함` 모두 단가에 10%를 더합니다. 그런데 비급여 등록에서 `포함`의 단가는 VAT를 포함한 진료비라 이중 과세가 될 수 있습니다. | **바꿈:** 비급여 항목은 공급가 `unitPrice`와 `taxType`(`TAXABLE`/`TAX_EXEMPT`)만 저장합니다. `포함`으로 입력한 진료비는 등록할 때 공급가 = 진료비 − round(진료비 − 진료비/1.1)로 바꿔 저장합니다. 패키지 금액은 과세면 공급가 + 10%(반올림)입니다. 이관할 때는 현행 `포함` 항목의 저장 단가가 진료비인지 확인합니다 | 재설계 `taxType`에는 `별도`/`포함` 구분이 없습니다 ([catalog.md](../design/catalog.md#진료-항목가격표)). 패키지 VAT 문제는 [review.md](../design/review.md#규칙-이전-시-동작-차이)의 결정 대상입니다 |
| 4 | 임의처방·패키지·패키지 그룹·비급여의 이름 중복은 서버가 판정하지만, validate 호출이 실패하면 통과시킵니다(fail-open). 치료실과 약속처방은 클라이언트만 검사하고, 약속처방은 처음 불러온 100건만 봅니다. | **바꿈:** 모든 설정 리소스는 앞뒤 공백을 뺀 이름에 병원 단위 유니크 제약을 걸고, 저장할 때 중복이면 409를 돌려줍니다. validate 전용 호출과 클라이언트 비교에는 기대지 않습니다 | 생성 중복은 409이고 검증 전용 엔드포인트는 두지 않습니다 ([catalog.md](../design/catalog.md#병원-설정), [conventions.md](../design/conventions.md#오류)) |
| 5 | 임의처방 총사용량을 반올림 없는 부동소수로 더해서(0.1 + 0.2 = 0.30000000000000004) 50g 경계 판정이 뒤집힐 수 있습니다. | **바꿈:** 사용량을 십진 고정소수(입력 정밀도, 예: 0.01g 정수 단위)로 더한 뒤 `≤ 50g`와 비교합니다. 총 투약가는 현행처럼 약재별로 반올림한 뒤 더합니다 | 경계 판정이 부동소수 오차에 흔들리지 않아야 합니다. 약재별 반올림 후 합산은 [catalog.md](../design/catalog.md#진료-항목가격표)에 적혀 있습니다 |
| 6 | `2.5` 같은 소수 베드 수가 클라이언트 검사를 통과합니다. | **바꿈:** `bedCount`는 정수만 받고, 소수는 422입니다 | 재설계가 이미 "1–20 정수 (현행은 소수도 통과)"로 정했습니다 ([catalog.md](../design/catalog.md#운영)) |

**바뀌는 케이스:**
- `packageItemAmount: 포함 also adds 10% on top`: 단가 10,000이 VAT 포함 진료비라면 공급가 9,091 + 세금 909가 되어 `금액` 10,000, `세금` 909입니다(현행 11,000 / 1,000)
- `personalFormulaName: only first 100 loaded names checked`: 101번째 이후에 있는 `X101`도 서버 유니크 제약에 걸리므로 중복(409)입니다
- `arbitraryFormula: float sum 0.1+0.2 weight`: `총사용량`이 0.30000000000000004가 아니라 0.3입니다
- `treatmentRoom: fractional bed count passes client check`: 베드 수 2.5는 저장할 수 없습니다(422, `canSave: false`)

**사용자 확인 필요:** 3번 — 패키지에서 `포함` 항목 단가를 "VAT 포함 진료비"로 볼지 "공급가"로 볼지는 과세 업무 판단입니다. 현행 11,000원(10% 가산)이 의도였다면 권장을 따르지 않고 현행을 유지해야 합니다.

### crm-send-window

[규칙 문서](../reference/rules/crm-send-window.md) · 케이스 29 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 수동 발송은 20:50부터, 예약 연락·연락 규칙은 20:30 이후부터 광고를 막아 두 기준이 함께 있습니다. | **바꿈:** 서버 정책 하나로 판정합니다. 기본 야간 시간대는 21:00:00–08:00:00(시작 포함, 끝 미포함)입니다. 이 시간대에는 `MARKETING_NIGHT` 동의가 없는 수신자를 광고 발송에서 제외합니다. 병원은 정책으로 시작 시각을 앞당기거나 야간 광고를 막을 수 있고, 수동·예약 경로가 같은 값을 씁니다 | 재설계가 이미 정했습니다 ([crm.md](../design/crm.md#엔드포인트-1), [compliance.md](../design/compliance.md#광고성-정보-전송)) |
| 2 | 모든 검사가 브라우저 시간(getHours/getMinutes)을 쓰고, 픽스처는 Asia/Seoul을 가정합니다. | **따름:** 픽스처의 KST 결과를 그대로 재현하되, 서버는 브라우저나 서버 시간대와 상관없이 `Asia/Seoul`로 계산합니다 | 현행 결과는 KST 브라우저 기준으로만 맞습니다. 서버가 시간대를 고정하면 이 조건이 없어집니다 ([규칙 문서](../reference/rules/crm-send-window.md)) |
| 3 | 수동 발송의 야간 검사는 채널을 보지 않고 `messageType === '광고'`만 보므로 SMS와 카카오 브랜드 메시지에 똑같이 걸립니다. | **따름:** 야간 제한은 채널이 아니라 `purpose: ADVERTISING`에 겁니다. SMS·`KAKAO_BRAND`·SMS 대체 발송 모두 같은 규칙입니다 | 법 조항이 매체가 아니라 광고성 정보에 적용됩니다 ([compliance.md](../design/compliance.md#광고성-정보-전송)). 캠페인 모델에서 `purpose`는 채널과 따로 있습니다 ([crm.md](../design/crm.md#모델-1)) |
| 4 | 기준이 `잔여 횟수`인 연락 규칙은 시간대 검사를 아예 건너뜁니다. 그 경우 발송 시각을 서버가 정하는지 알 수 없습니다. | **바꿈:** 기준과 상관없이 모든 광고 규칙을 같은 정책으로 검사합니다. 규칙을 저장할 때 `sendTime`이 야간 시간대면 경고를 주고, 실제 발송 시점에 서버가 다시 검사해 야간 동의 없는 수신자는 `excluded.nightTime`(작업은 `SKIPPED`, 사유 기록)으로 뺍니다 | 동의·야간 제외는 발송 시점에 서버가 다시 합니다 ([crm.md](../design/crm.md#엔드포인트-1)). 야간 동의가 있는 수신자에게는 보낼 수 있으므로 규칙 저장 자체는 막지 않습니다 |
| 5 | 야간 검사는 UI(배너, 테스트 발송 비활성, 오류)에서만 막고, 서버가 거절하는지는 알 수 없습니다. | **바꿈:** `:send`, 예약 실행, `ContactTask` 자동 발송, `POST /patients/{id}/messages`가 모두 실행 시점에 서버 정책으로 검사합니다. 배너는 `estimate`의 `excluded.nightTime`을 보여 주는 용도로만 씁니다 | 재설계가 이미 정했습니다 ([crm.md](../design/crm.md#엔드포인트-1)) |

**바뀌는 케이스:**
- `isNightForAd: 20:50 KST 광고`: 기본 정책(21:00 시작)에서는 야간이 아닙니다 (`night: false`)
- `isNightForAd: 20:59 KST 광고`: `night: false`입니다
- `manualSendCheck: immediate ad at 20:50 blocked`: 20:50은 야간이 아니므로 발송할 수 있습니다
- `manualSendCheck: reserved ad for 21:00 blocked`: 요청을 거절하지 않고 예약을 받습니다. 발송 시점에 야간 동의 없는 수신자만 제외합니다
- `scheduledSendWindow: 20:35 ad`: 기본 정책에서는 시간대 안입니다 (`outOfWindow: false`)
- `contactRuleWindow: ad rule 20:31 blocked`: 기본 정책에서는 막지 않습니다 (`blocked: false`)
- `contactRuleWindow: 잔여 횟수 basis exempt`: 23:00 광고 규칙도 검사 대상입니다. 야간 동의 없는 수신자는 발송 시점에 제외됩니다

**사용자 확인 필요:** 1번 — 기존 병원을 이관할 때 야간 정책 기본값을 법정 21:00으로 둘지, 현행 화면이 쓰던 보수적인 20:30 또는 20:50으로 둘지는 운영 정책입니다. 20:30이나 20:50으로 두면 위 20:3x·20:5x 케이스는 바뀌지 않습니다. 4번 — 야간에 걸린 자동 연락을 건너뛸지(`SKIPPED`), 다음 날 08:00으로 미룰지는 업무 판단입니다.

### message-type-selection

[규칙 문서](../reference/rules/message-type-selection.md) · 케이스 24 · 질문 5

| # | 질문 | 권장 | 근거 |
|---|---|---|---|
| 1 | 080 수신거부 번호 `080-877-8900`은 클라이언트에 하드코딩되어 있고, 인증 코드만 병원에서 받아옵니다. | **바꿈:** 080 번호는 서버 설정(플랫폼 공용 값, 병원별로 바꿀 수 있음)으로 옮기고, 서버가 `resolvedBody` 꼬리말에 번호와 인증 코드를 함께 넣습니다. 값은 현행 번호를 그대로 씁니다 | 법정 표기는 서버가 붙입니다 ([crm.md](../design/crm.md#엔드포인트-1)). 인증 코드는 `GET /opt-outs/080-code`로 받습니다 ([crm.md](../design/crm.md#동의와-수신거부)) |
| 2 | 바이트를 ASCII 1, 그 밖의 BMP 문자 2, 서로게이트 쌍 4로 세는데, 통신사의 EUC-KR/KS X 1001 계산과 다를 수 있습니다. | **보류:** 문자 중계사·통신사가 바이트를 세는 방식과, KS X 1001 밖 문자(이모지 등)를 어떻게 처리하는지 확인해야 합니다. 확인 전까지는 현행 규칙을 재현합니다 | 서버가 판정하는 90/2000byte 경계가 실제 과금 유형과 맞아야 합니다 ([crm.md](../design/crm.md#엔드포인트-1)). 단가 기준은 [crm.md](../reference/spec/crm.md)에 있습니다 |
| 3 | 수신자별 변수 치환 뒤 SMS가 90byte를 넘을 수 있고, `smsOverflowPolicy`(기본 `upgrade_lms` / `exclude`)는 클라이언트가 아니라 서버(estimate)가 적용합니다. | **따름:** 서버가 수신자별 `resolvedBody`로 다시 판정하고, `overflow: UPGRADE_TO_LMS`(기본)면 LMS로 올리고 `EXCLUDE`면 그 수신자를 뺍니다 | 캠페인 모델의 `overflow` 필드가 이 값입니다 ([crm.md](../design/crm.md#모델-1)). 현행 기본값은 [crm.md](../reference/spec/crm.md)에 있습니다 |
| 4 | 클라이언트 `ht()` 결과는 표시와 한도(maxBytes 90 vs 2000)에만 쓰고, 최종 유형은 서버가 정한다고 가정합니다. | **따름:** 판정 순서(첨부 → 제목 → 90byte)와 경계(90byte 이하는 SMS)를 서버가 그대로 씁니다. 바이트는 머리말·꼬리말을 붙인 최종 본문으로 세고, 결과를 `Message.smsKind`에 남깁니다. 클라이언트는 `estimate` 결과만 보여 줍니다 | 재설계가 이미 정했습니다 ([crm.md](../design/crm.md#엔드포인트-1)) |
| 5 | `F()`는 첫 줄이 `(광고)`로 시작할 때만 머리말을 떼고, 사용자가 쓴 본문에 `\n\n무료거부:`가 있으면 거기서 잘립니다. | **바꿈:** 서버는 본문(`content.body`)과 법정 표기를 나눠 저장하므로, 평소에는 떼어 낼 일이 없습니다. 현행 `messageText`를 이관할 때만 떼어 내고, 꼬리말은 본문 **끝**에 생성 형식(`\n\n무료거부: … \n인증: …`) 그대로 있을 때만 제거합니다 | 이관 때 이중 표기를 피해야 합니다 ([규칙 문서](../reference/rules/message-type-selection.md)). 최종본은 서버가 `resolvedBody`로 만듭니다 ([crm.md](../design/crm.md#모델-1)) |

**바뀌는 케이스:** 없음

**사용자 확인 필요:** 없음
