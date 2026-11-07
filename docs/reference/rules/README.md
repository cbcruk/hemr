# 현행 클라이언트 규칙

현행 웹 클라이언트에만 있던 업무 규칙을 원본 코드에서 찾아 정리한 문서입니다. 서버로 옮길 때 무엇을 그대로 따르고 무엇을 바꿀지 정하는 근거로 씁니다.

- **케이스 출처:** 각 규칙의 픽스처(`test/fixtures/rules/<rule>.json`)는 복원한 원본 함수를 node로 실행해 얻은 출력(`executed`)이 대부분이고, 실행할 수 없는 화면 흐름만 코드를 읽어 적었습니다(`traced`). 실제 서버는 호출하지 않았고 케이스의 환자·가격 값은 모두 만든 값입니다
- **현행 동작 그대로:** 버그로 보이는 동작도 고치지 않고 담았습니다. 각 문서의 "서버 이전 시 주의"와 픽스처의 `openQuestions`가 결정할 목록입니다
- **원본 경로:** 문서의 `restored/...` 경로는 분석 당시 위치입니다. 그 트리는 이 저장소에 없으므로, 판단에 필요한 원본 코드는 각 문서의 "원본 코드" 절에 발췌해 두었습니다
- **이름:** 분석한 제품과 연동 업체의 실제 이름·도메인은 적지 않습니다. 분석 대상은 현행 EMR, 그 비급여·CRM 제품은 라이트 서비스(`liteClient`), 통합 계정 업체는 통합 계정(`ssoClient`), 외부 예약 중개는 예약 중개 서비스(`booking`), 비교한 레거시 제품은 레거시 차트로 부르고, 도메인은 `example.com`으로 바꿨습니다. 식별자 안의 이름도 같은 이름으로 바꿨습니다(예: `LiteChartCreatePanel`). 번들 파일 이름의 내용 해시(`-XXXXXXXX`)는 뺐습니다
- **검사:** `pnpm test`가 픽스처 형식과 문서 짝을 확인합니다 (`test/rule-fixtures.test.ts`)

규칙 25개, 케이스 979건 (실행 945, 추적 34), 열린 질문 163개.

| 영역 | 규칙 | 내용 | 케이스 (실행) | 열린 질문 |
|---|---|---|---:|---:|
| 원무 | [appointment-acceptance](appointment-acceptance.md) | Client-side appointment slot checks: per-slot capacity with the 추가예약제한 exclusive rule, closed day, clinic hours, doctor off-day, break, blocked and past-time checks for booking and drag-move. | 78 (74) | 9 |
| 원무 | [appointment-no-show](appointment-no-show.md) | No-show timing settings as the client edits and displays them; the no-show transition itself runs on the server. | 10 (8) | 4 |
| 원무 | [cash-drawer-expected-closing](cash-drawer-expected-closing.md) | Expected cash-drawer closing amount: server value when 현금흐름 is present, otherwise start + cash receipts − (expenses + cash-only refunds); plus cash register state and re-settlement flag. | 16 (16) | 5 |
| 원무 | [check-in-validation](check-in-validation.md) | Check-in (접수) validations: NHIS benefit restriction auto-switch, insurance eligibility, selected-medical-institution (B005) gate, self-verification requirement, auto-insurance guarantee limit and expiry, and today-only check-in from an appointment. | 74 (71) | 9 |
| 원무 | [checkout-settlement](checkout-settlement.md) | Checkout settlement: amount due, Jeju subsidy line, overpaid-credit use, remaining-amount status (미수/과수납/손비), zero-input confirmation, prepaid split and patient-grade discount as computed by the client. | 46 (43) | 8 |
| 원무 | [visit-status-transitions](visit-status-transitions.md) | Visit (접수) status transitions the client allows by drag-and-drop between the 대기/치료/수납/수납완료 columns and by card menus, with the request each one sends. | 37 (26) | 6 |
| 진찰료·수가 | [auto-insurance-same-day-consultation](auto-insurance-same-day-consultation.md) | When a patient has 자보 encounters for two or more different accident numbers on the same day, the later encounter is designated '1일 2차' and must not carry a consultation fee (codes 10100*/10200*). | 25 (25) | 6 |
| 진찰료·수가 | [consultation-fee-code](consultation-fee-code.md) | Selects the consultation fee code (초진 10100 / 재진 10200) and its 8-digit 산정코드 modifiers (age, night, 심야, Saturday, holiday, proxy receipt) from visit time, patient RRN, clinic settings and the prior-visit window. | 101 (101) | 8 |
| 진찰료·수가 | [coverage-category-band](coverage-category-band.md) | Lists prescription lines that cannot stay on a record when its coverage type (보험구분) is set or changed, based on category code (카테고리숫자코드) bands and a few specific fee codes. | 13 (13) | 5 |
| 진찰료·수가 | [duplicate-consultation-fee](duplicate-consultation-fee.md) | Warns before saving or completing a 건보/급여 encounter when another encounter on the same day with the opposite face-to-face/telemedicine mode also carries a consultation fee. | 18 (18) | 5 |
| 진찰료·수가 | [procedure-fee-modifiers](procedure-fee-modifiers.md) | Appends 산정코드 digits (age 신생아/1세미만/1~6세, 침법, time-of-day flags) to procedure (40xxx) and dispensing (30xxx) fee codes, and swaps whole prescription lines to the modified fee-master row. | 44 (44) | 7 |
| 진찰료·수가 | [reference-version-selection](reference-version-selection.md) | Chooses which reference data version applies to a visit date: static KCD/KOICD/자보수가 JSON switches at a hardcoded 2026-01-01 cutoff, while 건보 fee codes use the latest server 적용일자 not after the visit date. | 24 (24) | 6 |
| 진찰료·수가 | [special-case-code-match](special-case-code-match.md) | Requires a 4-character 산정특례 특정기호 (MT002) when a 건보 record carries a rare/intractable-disease 산정특례 registration number (MT014), and resolves which 특정기호 candidates fit a diagnosis code via the rare-disease reference ranges. | 64 (64) | 6 |
| 진찰료·수가 | [telemedicine-fee-lines](telemedicine-fee-lines.md) | For 비대면 pilot visits, adds one 비대면진료 시범사업 관리료 line (91001 주간 / 91002 야간 / 91003 심야 / 91004 공휴) per consultation line, priced from a hardcoded score x yearly unit price, and keeps those lines in sync when the visit time, consultation count or 비대면 flag changes. | 55 (55) | 8 |
| 추나 | [chuna-annual-limit](chuna-annual-limit.md) | Counts a patient's chuna sessions for the year (or accident) and flags when the 20-session annual limit is reached for HIRA-covered encounters. | 51 (51) | 8 |
| 추나 | [chuna-auto-approval](chuna-auto-approval.md) | On encounter completion, automatically submits the first unapproved chuna line to HIRA when the clinic policy allows it, the annual limit is not exhausted and no same-day chuna is already on record. | 27 (27) | 5 |
| 첩약 시범사업 | [pilot-herbal-approval-required](pilot-herbal-approval-required.md) | Encounter completion is blocked until every pilot herbal prescription line (category 35001001) has 승인여부 true (submitted to/approved by HIRA). | 15 (11) | 5 |
| 첩약 시범사업 | [pilot-herbal-claim-checks](pilot-herbal-claim-checks.md) | Claim-time validation checks C0001-C0012 for national-insurance pilot herbal (첩건) encounters; only C0001, C0003 and C0005 are collected by tBt, and only C0001 and C0003 survive the treatment-screen warning whitelist. | 53 (51) | 12 |
| 첩약 시범사업 | [pilot-herbal-diagnosis-limit](pilot-herbal-diagnosis-limit.md) | HIRA cumulative dosing history decides whether a pilot herbal (첩건) disease may be prescribed and which copay code (G/U/blank) applies: 2+ other diseases or other-clinic history blocks, 20+ days at this clinic switches to U. | 34 (34) | 9 |
| 첩약 시범사업 | [pilot-herbal-doctor-limit](pilot-herbal-doctor-limit.md) | Per-doctor pilot herbal (첩건) prescription counts above 8/day, 60/month or 600/year force 본인부담률구분코드 U and show a warning. | 29 (29) | 5 |
| 탕전 | [external-herbal-precheck](external-herbal-precheck.md) | External decoction (ocsv2) pre-payment flow: precheck gate whose catch swallows all failures, herb/pack quantity derivation, payment-method allocation to the server quote, and duplicate-payment risk detection. | 32 (32) | 6 |
| 치료실 | [procedure-timer](procedure-timer.md) | Treatment-room procedure timer: client-side elapsed detection, auto-completion of elapsed procedures when the next one starts, duration adjustment limits, and timer defaults. | 26 (26) | 5 |
| 설정 | [settings-validation](settings-validation.md) | Client-side validations on settings screens: arbitrary formula limits, package tax-type mixing, nonbenefit amount cap and VAT, treatment room bed/room limits, and name duplicate pre-checks. | 54 (49) | 6 |
| CRM | [crm-send-window](crm-send-window.md) | Night-time restriction for advertising messages: manual send blocks 20:50-08:00, scheduled contacts and contact rules only allow 08:00-20:30. | 29 (29) | 5 |
| CRM | [message-type-selection](message-type-selection.md) | SMS/LMS/MMS selection by attachment, title and EUC-KR-like byte length (90 bytes), plus the (광고) header and 080 opt-out footer applied to advertising text. | 24 (24) | 5 |

## 법령에서 정리한 규칙

현행 클라이언트에 없어 법령 원문에서 정리한 규칙입니다. 픽스처가 없고, 각 문서가 근거 자료와 신뢰도를 적습니다.

| 영역 | 규칙 | 내용 |
|---|---|---|
| 원무 | [insured-copay](insured-copay.md) | 한의원 외래 급여 본인부담: 건보 30%·나이·임신부·65세 구간, 의료급여 정액, 추나·첩약 시범·차상위·산정특례 |
