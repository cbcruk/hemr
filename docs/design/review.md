# 설계 검토

재설계가 현행 업무를 빠짐없이 덮는지, 무엇을 일부러 바꿨고 그 대가가 무엇인지, 구현 전에 누가 무엇을 정해야 하는지 정리합니다.

## 요약

| 항목 | 판단 |
|---|---|
| 업무 범위 | 현행 EMR·CRM·인증 API가 다루는 업무는 모두 대응 리소스가 있습니다. 원격 앱·챗봇·챌린지 등 [범위 밖](#범위-밖으로-둔-것) 항목만 빠집니다 |
| 가장 큰 개선 | 수납·접수·진료 완료·청구 전송이 서버 트랜잭션이 되어 "돈은 받았는데 상태는 안 바뀜", "전송했는데 기록 안 됨" 같은 불일치가 구조적으로 사라집니다 |
| 가장 큰 위험 | 클라이언트에 있던 규칙(첩약 한도, 가산, 자보 진찰료 등)을 서버로 옮기면서 **현행 동작과 미세하게 달라질** 수 있습니다. 규칙마다 회귀 테스트 케이스가 필요합니다 |
| 가장 큰 미결 | 데스크톱 에이전트 기술(D2, 오프라인 엣지 요구는 확정), 기존 데이터 이관(`차트Id` 통합) |

## 엔드포인트 대응

현행 913개 `method + path`를 경로 그룹 단위로 대응시켰습니다.

| 현행 그룹 | 개수(약) | 재설계 | 비고 |
|---|---:|---|---|
| `/patients/*` | 60 | [patients.md](patients.md) | 메모·패키지·자보·산재·제주·동의·문진·캔버스 분산 해소 |
| `/desk/*` | 73 | [front-desk.md](front-desk.md), [patients.md](patients.md#선수금) | `waiting` → `visits`, `v2/receipts` → `:checkout` |
| `/record/*`, `/chart/*` | 39 | [clinical.md](clinical.md), [claims.md](claims.md#심평원-사전-제출) | 심평원 제출 이력은 Claims로 |
| `/treatments/*` | 25 | [clinical.md](clinical.md#치료실) | 세트·타이머 설정은 Catalog |
| `/ocs`, `/tangjeon`, `/ocsv2` | 51 | [herbal-pharmacy.md](herbal-pharmacy.md) | 3갈래 → 처방 + 원외 주문 |
| `/chunggu/*`, `/nhic/*` | 30 | [claims.md](claims.md) | before/after 통합, 전문 번호 제거 |
| `/documents/*`, `/signing/*` | 63 | [documents.md](documents.md) | 서식별 POST 20여 개 → `type` 필드 |
| `/tablet/*` | 27 | [documents.md](documents.md#태블릿-문진동의서), [identity-access.md](identity-access.md#기기) | 계정 → 기기 페어링 |
| `/settings/*` | 181 | [catalog.md](catalog.md) | 리소스 20여 개 |
| `/crm/*` (EMR) | 64 | [crm.md](crm.md) | 연락 자동화 3벌 → 1벌 |
| CRM API (`/messages`, `/contacts`, `/refusals`, `/contents`, `/kakao`, `/consult-templates` …) | 138 | [crm.md](crm.md) | 채널별 경로 → 필드 |
| Auth·Account (`/login`, `/token`, `/sso`, `/unlock`, `/verify`, `/users`, `/permissions`, `/terms`, `/account-application`, `/integrations`, `/change-requests`) | 61 | [identity-access.md](identity-access.md) | |
| Static CDN JSON | 11 | [catalog.md](catalog.md#참조데이터-전국-공통-읽기-전용) | 버전 선택 서버로 |
| Insurance API (실손) | 37 | [claims.md](claims.md#실손보험-조회) | 외부 시스템으로 분리, 링크만 |
| Sync API (`/quick-messages`, `/rooms`, `/notification-center`) | 4 | 범위 밖 | 원내 메신저 |

### 범위 밖으로 둔 것

| 현행 | 이유 |
|---|---|
| BI·재무·포털·MEMBERS 원격 앱 (`biClient`, `portalClient`, `/settlement`, `/members/upstream/*`) | 원격 앱 코드가 번들에 없어 근거가 없음. 재무 권한 16개는 권한 모델에만 자리를 둠 |
| 챗봇·채널톡 베타 (`/api/bot-*`, `/api/channeltalk/*`) | 고객지원 기능 |
| 챌린지 (`/api/surachal/*`) | 마케팅 기능 |
| 닥톡·수(thesoo) 연동 (`/doctalk/*`, `thesooClient`) | 외부 예약·비대면 채널. `BookingRequest`·`Appointment.origin`, 비대면 내원(`channel: TELEMEDICINE`)으로 경계만 정의 |
| 수 라이트 차트 (`/desk/nonbenefit-intake`) | SOO 단독 계정 전용 간이 접수·기록. 수 제품 범위. EMR 재설계에서는 `Visit` + `Encounter`로 대체 가능 여부만 검토 대상 |
| SaaS 구독·결제 (`/subscriptions`, `/plans`, `/billing/*`) | 제품 과금. 도메인과 무관 |
| 원내 메신저 (Sync API) | 별도 제품 |
| dev 전용 화면 (`/schedulers` 루틴) | prod 라우트에 없음 |

MCP 승인 대기 화면은 prod에서도 데모 계정에 열려 있습니다 (`docs/reference/spec/settings.md`). 재설계는 이를 범위에 넣어 `ContactTask.status = PROPOSED`와 메모 `PROPOSED`로 흡수합니다.

## 권한 코드 대응

| 현행 코드 | 재설계 |
|---|---|
| `treatment_rooms`, `appointment_planner`, `ocs`, `medi_ocs`, `bi`, `treatment`, `patient_info` | 화면 코드 폐지. 각각 `procedure:read`, `appointment:read`, `herbal_prescription:read`, `external_herbal_order:read`, `report:read`, `encounter:read`, `patient:read` |
| `chart_create/update/delete` | `patient:create/update/delete` |
| `appointment_create/update/delete` | `appointment:create/update/cancel` |
| `waiting_create/update/delete` | `visit:check_in/update/cancel` |
| `receipt_create/update/delete` | `receipt:create/correct/void`, `receipt:refund` |
| `document_create` | `document:issue`, `document:void` 추가 |
| `prescription_write`, `prescription_prn_write` | `prescription:write`, `prescription:write_prn` (면허 필요) |
| `treatment_write` (진료기록생성수정삭제) | `encounter:write`, `encounter:amend`, `encounter:retract` (면허 필요) |
| (없음) | `procedure:write` 신설 (치료실 시술) |
| `all`, `owner_only` | scope `ALL`, `OWN` |
| `crm` | `crm_program:*` |
| `call_list` | `contact_task:*` |
| `patient_list` | `crm_followup:read` |
| `sms` | `message:send` |
| `send_history` | `message:read` |
| `rejected_list` | `opt_out:*` |
| `message_template_setting` | `setting.message_template:update` |
| `chunggu` | `claim:read`, `tax_deduction:read` |
| `spw_chunggu` (심평원청구) | `claim:submit` |
| `chuna_chubyak_submission` | `hira_pre_submission:submit` |
| `medical_aid_approval` | `medical_aid:approve` |
| `home_visit_status` | `encounter.home_visit_form:update` |
| `billing`, `setting`, `normal_setting`, `info_setting`, `record_setting`, `prescription_setting`, `template_setting`, `appointment_setting`, `caller_number_setting`, `system_setting`, `schedule_setting`, `tablet_settings` | `setting.{area}:update` |
| `remote_settlement` | 범위 밖 (비대면 정산은 thesoo 연동) |
| `finance*` (16개) | `finance.{area}:{action}` 자리만 둠 |
| `record_digital_signature`, `copayment_digital_signature`, `digital_signature` (enum 밖) | `signature:sign` (+kind) |

## 일부러 바꾼 것과 그 대가

| 결정 | 얻는 것 | 대가 |
|---|---|---|
| JSON 키를 영문으로 | 형식 일관성, 도구 호환 | 업무 담당자가 API를 읽기 어려워짐. 용어 표 유지 비용. 현행 클라이언트를 재사용할 수 없음 |
| 상태 enum 하나 + 커맨드 | 전이 규칙이 서버 한 곳에 | 엔드포인트 수가 늘어 보임. 순수 REST 관점에서는 비표준 (`:command` 형식은 Google AIP-136 관례) |
| 진료 삭제 → 정정·`ENTERED_IN_ERROR` | 법적 보존 요구 충족, 감사 가능 | 저장 공간 증가. "지운 줄 알았는데 남아 있음"에 대한 사용자 교육 |
| 접수 취소 시 진료·수납이 있으면 409 | 데이터 유실 방지 | 현행보다 단계가 늘어 데스크 업무가 느려질 수 있음. `:cancel`에 "진료 철회·수납 취소까지 함께" 옵션을 둘지 결정 필요 |
| 데스크톱 에이전트가 작업을 가져가는 구조 | 서버가 진행 상태를 소유, 원자성, 웹에서도 전송 가능 | 에이전트 개발·배포·업데이트 부담. 병원에 에이전트 PC가 꺼져 있으면 전송이 큐에서 대기 |
| SSE + `seq` 재전송 | 폴링 제거, 유실 보정 | 프록시·로드밸런서의 장기 연결 설정 필요. 이벤트 보관 저장소 필요 |
| 모듈러 모놀리스 | 트랜잭션 경계가 단순, 초기 운영 부담 낮음 | CRM 발송처럼 부하가 튀는 작업이 같은 프로세스에 있음. outbox로 분리 경로만 열어 둠 |
| 동의 단일 출처를 Patients로 | 080 거부·병원 등록·태블릿 동의가 한 곳에 | CRM이 동의를 바꾸려면 Patients API를 거쳐야 함 |
| 참조데이터 `asOf` 조회 | 고시 개정 시 클라이언트 배포 불필요 | 클라이언트 오프라인 검색이 필요하면 스냅샷 배포 경로를 따로 운영 |

## 위험

### 규칙 이전 시 동작 차이

현행 규칙의 근거가 클라이언트 코드뿐이라, 서버로 옮기면서 경계값을 잘못 옮길 수 있습니다.

| 규칙 | 현행 근거 | 확인 방법 |
|---|---|---|
| 첩약 한도 하루 8 / 월 60 / 연 600, 초과 시 본인부담률 `U` | `re-upstream/restored/modules/index/첩건본인부담률구분코드.js` | 심평원 시범사업 지침 원문 대조 + 경계값 테스트 |
| 추나 연 20회 | `re-upstream/restored/modules/index/part-210.js` | 고시 대조 |
| 야간·공휴·토요 가산 | 진찰료 수가코드 판정 (`docs/reference/spec/treatment.md`) | 수가 고시 대조 |
| 자보 같은 날 2차 진료 진찰료 제외 | `re-upstream/restored/modules/index/local.js` | 자보 진료수가 기준 대조 |
| 예약 수용 한도 (`추가예약제한` → 1건) | `docs/reference/spec/appointment.md` | 현행 화면 동작 재현 테스트 |
| 수납 남은 금액 판정 | `docs/reference/spec/desk.md` (판정식 부호 모호) | 이 문서의 정의(`due - received > 0` → 미수)가 업무 의미와 맞는지 데스크 실무자 확인 |

**권장:** 규칙 하나마다 "현행 클라이언트 함수 입력 → 출력" 표를 만들어 서버 구현의 테스트 픽스처로 씁니다. `re-upstream/restored/`에 함수가 남아 있으므로 같은 입력을 양쪽에 넣어 비교할 수 있습니다.

### 오프라인

D1에서 오프라인 접수·수납을 지원하기로 했습니다. 설계는 [offline.md](offline.md)에 있고, 대가는 다음과 같습니다.

- **엣지 의존:** 병원마다 상시 켜진 PC 한 대가 필요합니다. 그 PC가 큐를 비우기 전에 고장 나면 오프라인 기록을 잃습니다. 큐 복제 방식은 구현 때 정합니다
- **금액 확정 지연:** 오프라인 수납은 받은 돈만 기록하고 금액은 복구 후 확정합니다. 안내한 금액과 확정 금액이 다르면 환자에게 추가 수납이나 환불을 해야 합니다
- **사후 정리 업무:** 중복 환자·차트번호·같은 날 이중 접수 같은 충돌을 사람이 풀어야 합니다. 충돌이 남아 있으면 시재 마감이 막힙니다
- **보안 면적:** 병원 PC에 환자 표시 정보 캐시와 오프라인 PIN 검증값이 생깁니다. 주민번호와 진료 본문은 두지 않습니다
- **구현 순서:** 오프라인은 D2가 정해져야 만들 수 있습니다. 다만 엣지가 만든 ID를 받는 규칙, `occurredAt`, 결제 `UNAPPLIED` 상태는 온라인 1차 구현에 처음부터 넣어야 나중에 데이터 형태를 바꾸지 않습니다

### 데이터 이관

- `환자Id`와 `차트Id`를 하나로 합치는 설계라, 한 환자에 차트가 여럿인 데이터가 실제로 있는지 이관 전에 확인해야 합니다
- 현행 진료기록은 정정 이력이 없는 단일 버전입니다. 이관분은 버전 1로 넣고 `source: MIGRATED`로 표시합니다 (현행 `preventPrescriptionRepeat` 플래그와 같은 역할)
- 한글 enum → 영문 enum 대응표가 이관 스크립트의 입력이 됩니다. 각 도메인 문서의 현행/재설계 표를 그대로 씁니다

### 분석 근거의 한계

- 응답 스키마는 클라이언트가 **읽는** 필드만 알 수 있습니다. 서버가 더 많은 필드를 가지고 있을 수 있습니다
- 서버에서만 일어나는 전이(청구 집계, 부도 처리, 패키지 만료)의 정확한 조건은 추정입니다
- endpoints.md 추출기가 axios `delete`의 `data`를 놓쳐 일부 body가 비어 있었습니다 (예: 진료 삭제 사유). 진료·탕전 분석에서 코드로 보완했지만 다른 그룹에도 같은 누락이 있을 수 있습니다

## 독립 검토 반영

초안을 작성한 뒤, 작성 과정의 판단을 공유하지 않은 별도 검토자가 설계 문서와 원본 스펙(`docs/reference/spec/*`, `docs/reference/endpoints.md`)을 대조했습니다. 24건이 나왔고, 원본 근거가 인용된 항목은 원문과 대조해 확인한 뒤 모두 반영했습니다.

| 심각도 | 지적 | 반영 |
|---|---|---|
| 높음 | 진료 완료가 무조건 치료실 시술을 끝내 현행 기본 흐름(완료 → 치료로 보냄)을 깸 | 기본 `nextVisitStatus = IN_TREATMENT`, 대기·수납으로 보낼 때만 시술 종료 ([clinical.md](clinical.md#완료-커맨드)) |
| 높음 | `treatment_write`를 치료실 권한으로 오역. 진료기록 작성 권한이 대응표에 없음 | `encounter:write/amend/retract`로 수정, `procedure:write` 신설 |
| 높음 | 심평원 전송 후 보고가 유실되면 재큐잉으로 이중 청구 가능 | `OUTCOME_UNKNOWN` + `RECONCILE` 대사 작업 ([claims.md](claims.md#데스크톱-에이전트)) |
| 높음 | 환자가 아닌 번호의 수신거부(080·엑셀 2만 건)를 저장할 곳이 없음 | 번호 단위 `Suppression` 추가 ([crm.md](crm.md#동의와-수신거부)) |
| 중간 | 내원 `수납 → 대기` 전이 누락 | `AWAITING_PAYMENT → WAITING` 추가 |
| 중간 | 정정 진료를 철회할 수 없고 정정 확정 시점이 없음 | `AMENDED → ENTERED_IN_ERROR`, `:amend`가 변경 내용을 받아 한 번에 확정 |
| 중간 | 패키지 사용 생성 시점이 수납과 어긋남 | "금액 확정 시점(진료 완료·수납 중 먼저)"으로 통일 |
| 중간 | 카드 승인 후 수납이 412로 실패하면 "돈은 받았는데 기록 없음" 재발 | 외부 승인 결제를 먼저 `UNAPPLIED`로 기록, 수납은 `quoteId`로 검증 ([front-desk.md](front-desk.md#수납-커맨드)) |
| 중간 | 원외 주문 수정이 외부 결제 2건이라 원자적일 수 없음 | 단계·보상을 명시한 사가 Job, `CANCEL_PENDING` |
| 중간 | 탕전 완료 되돌리기 누락, `수정중` 대응 오류 | `:set-status` 추가, `수정중` → 원외 주문 `ON_HOLD` |
| 중간 | 청구 자동수정·보험구분 변경이 비면허 진료 정정이 됨 | 정정 제안(`AmendmentProposal`) + 의사 반영 |
| 중간 | 본인부담금 대장 서명에도 면허를 요구함 | 면허 요건을 진료기록 서명으로 한정 |
| 중간 | 야간 광고 규칙이 crm.md와 compliance.md에서 다름 | `MARKETING_NIGHT` 동의 기준으로 통일 |
| 중간 | 태블릿 셀프 접수 권한 누락 | `visit:self_check_in` |
| 중간 | SSE에 access token을 실을 방법이 없어 쿼리스트링 노출 위험 | 1회용 스트림 티켓 |
| 중간 | MCP 토큰에 실명 환자 조회를 허용해 현행 핸들 정책보다 후퇴 | 가명 핸들 전용 스코프 |
| 낮음 | 권한·이벤트·커맨드·ID 접두사 이름 불일치, 카탈로그 누락, 현행 서술 오류 2건, 비대면 경로 누락 | 이름 통일, 이벤트·카탈로그 보강, 서술 수정, 비대면 내원 절 추가 |

## 결정 필요

| # | 질문 | 선택지 | 권장 |
|---|---|---|---|
| D1 | 오프라인 접수·수납을 지원하는가 | 지원 안 함 / 에이전트 로컬 큐 | **결정: 지원.** 병원별 엣지 + 커맨드 큐 + 사후 정산 ([offline.md](offline.md)) |
| D2 | 데스크톱 에이전트를 무엇으로 만드는가 | Electron 재사용 / 경량 네이티브 서비스 | **보류.** 심평원 프로그램 연동 방식이 결정 요인. 현행 Electron 브리지(`hiraDdmdProxy`) 인터페이스를 먼저 문서화. D1 결정으로 [엣지 요구사항](offline.md#엣지가-갖춰야-할-것)(로그인 없이 도는 상시 서비스, 암호화 저장소, LAN HTTPS)은 정해짐 |
| D3 | 접수 취소가 진료·수납까지 함께 취소할 수 있는가 | 항상 막음 / 옵션 허용 | **결정: 옵션 허용.** `visit:cancel`·`receipt:void`·`encounter:retract`를 모두 가진 사용자만. 외부 결제·전송된 청구·조제 시작 등은 막음 ([연쇄 취소](front-desk.md#연쇄-취소)) |
| D4 | JSON 키 언어 | 영문 / 한글 유지 | 영문. 단 업무 담당자용 API 문서는 한글 용어 병기 |
| D5 | AI 차팅 녹음·텍스트를 외부 모델로 보내는가, 보존 기간은 | | 병원 단위 동의 + 녹음 원본 30일 후 파기 (정책 결정 필요) |
| D8 | 정정 제안을 의사가 반영해야 하는 구조가 청구 마감 일정에 맞는가 | 제안 + 의사 반영 / 청구 담당 위임 허용 | 제안 + 일괄 반영 화면. 실무 부담이 크면 의사가 미리 위임한 이슈 코드만 자동 반영 |
| D6 | 실손보험 조회를 같은 서버에 둘 것인가 | 분리 유지 / 통합 | 분리 유지. 별도 제품이고 환자 모델도 다름 |
| D7 | 첫 구현 범위 | | Identity → Patients → Front Desk → Clinical 순. 이 넷이 있어야 하루 진료가 돌아감. Claims·Herbal·CRM은 그 다음 |

## 다음 단계

1. **D2 결정.** 오프라인 엣지 구현의 선행 조건입니다. 온라인 모듈(D7 순서)은 D2 없이 시작할 수 있습니다
2. **Front Desk·Clinical OpenAPI 명세 작성.** 이 문서의 리소스·커맨드를 `openapi.yaml`로 옮기고, 오류 코드 목록을 확정합니다
3. **규칙 픽스처 추출.** [위험](#규칙-이전-시-동작-차이) 표의 규칙마다 `re-upstream/restored/` 함수에서 입력·출력 케이스를 뽑습니다
4. **기술 스택 선택.** TypeScript(strict) 기준이면 Hono 또는 Fastify + PostgreSQL + outbox 릴레이를 후보로 둡니다
