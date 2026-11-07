# 현행 EMR — API Endpoints

Static reconstruction of every axios call site across the 69 chunks of `target/` that make HTTP calls (438 chunks crawled from `https://example.com/assets/`).

- **Pipeline:** `pnpm crawl` → `pnpm unminify` (webcrack) → `pnpm extract` (Babel, cross-module) → this file and `src/api/**` (`pnpm generate`).
- **Totals:** 930 call sites → 913 unique `method + path` pairs.
- **Path variables:** `{param}` is a runtime value; `{name}` is the property read from an object (e.g. `e.id` → `{id}`).
- **Query / Body:** keys from literal objects at the call site, plus keys of object literals passed by callers of the wrapping API function.
- **Response:** property chain the original code read from the axios response (`data.results` is the standard envelope).
- **Location:** `file:line` in `unminified/`.

## Services

| Service | Base URL | Client | Endpoints |
|---|---|---|---:|
| [EMR API](#emr-api) | `https://emr-api.example.com` | `emrClient` | 632 |
| [CRM API](#crm-api) | `https://crm-api.example.com` | `crmClient` | 138 |
| [Insurance API](#insurance-api) | `https://insurance-api.example.com` | `insuranceClient` | 37 |
| [Account API](#account-api) | `https://auth-api.example.com/api` | `accountClient` | 35 |
| [Account Application API](#account-application-api) | `https://auth-api.example.com/api` | `accountApplicationClient` | 19 |
| [Lite API](#lite-api) | `https://lite-api.example.com` | `liteClient` | 12 |
| [static data CDN](#static-data-cdn) | `https://static.example.com/emr/master` | `staticClient` | 11 |
| [same-origin web API](#same-origin-web-api) | `(same origin)` | `webClient` | 10 |
| [Auth API](#auth-api) | `https://auth-api.example.com/api/auth` | `authClient` | 7 |
| [BI API](#bi-api) | `https://public-api.example.com/bi` | `biClient` | 5 |
| [Sync API](#sync-api) | `https://sync-api.example.com/v1` | `syncClient` | 4 |
| [SSO API](#sso-api) | `https://sso-api.example.com/` | `ssoClient` | 1 |
| [Juso address API](#juso-address-api) | `https://business.juso.go.kr/addrlink/addrLinkApi.do` | `jusoClient` | 1 |
| [Portal API](#portal-api) | `https://public-api.example.com/portal` | `portalClient` | 1 |

## EMR API

Base URL `https://emr-api.example.com` · `emrClient` · 632 endpoints

### `/async-tasks`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/async-tasks/{param}` |  |  | `data` | EmrPatientsView.js:45 |
| `POST` | `/async-tasks/patient-excel-import` |  |  | `data` | EmrPatientsView.js:34 |

### `/auth`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/auth/me` |  |  | `data` | index.js:57881 |

### `/chart`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/chart/car-pcmd/patients/{param}` |  |  | `data` | index.js:117783 |
| `POST` | `/chart/car-pcmd/patients/{param}` |  | `보험회사명칭`, `보험회사코드`, `사고접수번호`, `진료일자별투약일수` | `data` | index.js:117776 |
| `GET` | `/chart/chuna/patients/{param}` |  |  | `data` | index.js:117760 |
| `POST` | `/chart/chuna/patients/{param}` |  | `자동차보험필수정보`, `조회결과`, `조회년도` | `data` | index.js:117769 |
| `GET` | `/chart/medical-treatments` |  |  | `data.results.진료항목` | queries.js:13 |
| `GET` | `/chart/pcmd/patients/{param}` | `self_code`, `sick_code`, `year` |  | `data` | index.js:117793 |
| `POST` | `/chart/pcmd/patients/{param}` |  | `누적투약일수`, `본인부담률구분코드`, `진료년도`, `첩약상병구분코드`, `첩약상병명`, `해당요양기관등록여부` | `data.message` | index.js:117802 |
| `POST` | `/chart/record-llm` |  | `human_prompt`, `metadata`, `system_prompt_variables`, `녹음시간`, `진료Id`, `진료llm대화그룹Id` | `data` | TreatmentView-DPjd-5A8.js:314 |
| `PATCH` | `/chart/record-llm/{param}` |  | `status` | `data` | TreatmentView-DPjd-5A8.js:335 |
| `GET` | `/chart/record-llm/group/{param}` | `after`, `before` |  | `data.results` | TreatmentView-DPjd-5A8.js:320 |
| `GET` | `/chart/record-llm/record/{param}` |  |  | `data.results.진료llm대화목록` | TreatmentView-DPjd-5A8.js:328 |
| `GET` | `/chart/treatment-indicators/patients/{param}` |  |  | `data` | usePublicHolidays.js:34 |
| `GET` | `chart/kcd/recent` | `treatment_item_ids` |  | `data.codes` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:252 |
| `GET` | `chart/sanjae/patients/{param}/record/{param}` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:305 |
| `GET` | `chart/sanjae/record/{param}/chuna` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:306 |

### `/chunggu`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/chunggu/after` | `from`, `to`, `보험구분` |  | `data.results` | ClaimHiraView.js:86 |
| `POST` | `/chunggu/after` |  | `점검시작일자`, `점검종료일자`, `청구Id`, `청구문서Id`, `청구문서건수`, `청구문서번호`, `청구문서제목` | `data.results` | ClaimHiraView.js:81 |
| `PATCH` | `/chunggu/after/{id}/document-number` |  | `청구문서번호` | `data.results` | ClaimHiraView.js:83 |
| `POST` | `/chunggu/after/{id}/retry` |  |  | `data.results` | ClaimHiraView.js:82 |
| `GET` | `/chunggu/after/{id}/supplementary` |  |  | `data.results` | ClaimHiraView.js:114 |
| `POST` | `/chunggu/after/{id}/supplementary` |  |  | `data.results` | ClaimHiraView.js:115 |
| `GET` | `/chunggu/after/{param}` | `limit`, `offset` |  | `data.results` | ClaimHiraView.js:105 |
| `GET` | `/chunggu/before` |  |  | `data.results` | ClaimHiraView.js:52 |
| `GET` | `/chunggu/before/{id}` |  |  | `data.results.청구` | ClaimHiraView.js:54 |
| `PATCH` | `/chunggu/before/{id}/status` |  | `상태` |  | ClaimHiraView.js:70 |
| `PATCH` | `/chunggu/before/chunggu-treatment/{청구진료Id}` |  | `미루기여부`, `심사불능사유코드` |  | ClaimHiraView.js:67 |
| `GET` | `/chunggu/before/one` | `date`, `patient_id`, `type` |  | `data.results` | ClaimHiraView.js:74 |
| `POST` | `/chunggu/examresult` |  |  | `data.results` | ClaimHiraView.js:99 |
| `GET` | `/chunggu/examresult/{청구Id}` |  |  | `data.results` | ClaimHiraView.js:100 |
| `POST` | `/chunggu/examresult/{param}` |  |  | `data.results` | ClaimHiraView.js:97 |
| `GET` | `/chunggu/examresult/patients` |  |  | `data.results` | ClaimHiraView.js:111 |
| `GET` | `/chunggu/jeju/badge` |  |  |  | useJejuSupport.js:57 |
| `POST` | `/chunggu/jeju/documents` |  |  |  | useJejuSupport.js:62 |
| `PUT` | `/chunggu/jeju/submitted` |  |  |  | useJejuSupport.js:61 |
| `GET` | `/chunggu/jeju/summary` |  |  |  | useJejuSupport.js:58 |
| `GET` | `/chunggu/sam/{id}` |  |  | `data.results` | ClaimHiraView.js:80 |
| `POST` | `/chunggu/sam/{id}` |  |  | `data.results.청구Id` | ClaimHiraView.js:77 |

### `/crm`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/crm/contact-list/action-logs/patient/{param}` | `offset` |  | `data.results` | CrmLiteTriggerVariableInputModal.vue_vue_type_script_setup_true_lang.js:205 |
| `GET` | `/crm/contact-list/rules` |  |  | `data.results` | CrmLiteTriggerVariableInputModal.vue_vue_type_script_setup_true_lang.js:1283 |
| `POST` | `/crm/contact-list/rules` |  |  | `data.results` | CrmLiteTriggerVariableInputModal.vue_vue_type_script_setup_true_lang.js:1286 |
| `PATCH` | `/crm/contact-list/rules/{param}` |  | `isActive` | `data.results` | CrmLiteTriggerVariableInputModal.vue_vue_type_script_setup_true_lang.js:1290 |
| `DELETE` | `/crm/contact-list/rules/{param}` |  |  | `data.results` | CrmLiteTriggerVariableInputModal.vue_vue_type_script_setup_true_lang.js:1293 |
| `GET` | `/crm/contact-list/scheduler` | `offset` |  | `data.results` | queries-umVG-1i-.js:44 |
| `PATCH` | `/crm/contact-list/scheduler/{param}` |  |  | `data.results` | queries-umVG-1i-.js:53 |
| `GET` | `/crm/contact-list/scheduler/summary` |  |  | `data.results` | queries-umVG-1i-.js:47 |
| `GET` | `/crm/contact-list/schedules` | `offset` |  | `data.results` | queries-umVG-1i-.js:12 |
| `POST` | `/crm/contact-list/schedules/{param}/complete` |  |  | `data.results` | queries-umVG-1i-.js:30 |
| `POST` | `/crm/contact-list/schedules/{param}/uncomplete` |  |  | `data.results` | queries-umVG-1i-.js:33 |
| `GET` | `/crm/contact-list/schedules/patient/{param}` |  |  | `data.results` | queries-umVG-1i-.js:37 |
| `POST` | `/crm/contact-list/schedules/patient/{param}/bulk-process` |  | `actions` | `data.results` | queries-umVG-1i-.js:27 |
| `GET` | `/crm/contact-list/schedules/patient/{param}/schedules` | `offset` |  | `data.results` | queries-umVG-1i-.js:21 |
| `POST` | `/crm/contact-list/schedules/restore` |  | `undoToken` | `data.results` | queries-umVG-1i-.js:43 |
| `GET` | `/crm/contact-list/schedules/summary` |  |  | `data.results` | queries-umVG-1i-.js:40 |
| `GET` | `/crm/lite-trigger/events` |  |  | `data` | index.js:97605 |
| `POST` | `/crm/lite-trigger/events/{id}/opt-in` |  |  |  | index.js:97613 |
| `POST` | `/crm/lite-trigger/events/{id}/opt-out` |  |  |  | index.js:97609 |
| `GET` | `/crm/lite-trigger/hospital-variables` |  |  | `data` | index.js:97606 |
| `GET` | `/crm/lite-trigger/rules` |  |  | `data` | index.js:97595 |
| `PATCH` | `/crm/lite-trigger/rules/{param}` |  | `isActive`, `sendTime` | `data` | index.js:97603 |
| `GET` | `/crm/nonbenefit-patients` | `limit`, `offset` |  | `data.results` | NonBenefitPatientsView.js:32 |
| `PATCH` | `/crm/nonbenefit-patients/restart` |  | `비급여처방관리Ids` | `data.results` | NonBenefitPatientsView.js:39 |
| `PATCH` | `/crm/nonbenefit-patients/terminate` |  | `비급여처방관리Ids` | `data.results` | NonBenefitPatientsView.js:38 |
| `GET` | `/crm/patients` | `duplicated_phone_only`, `limit`, `offset`, `search_keyword`, `sort_key`, `sort_order` |  | `data` | EmrPatientsView.js:25 |
| `DELETE` | `/crm/patients/{param}` |  |  | `data` | EmrPatientsView.js:33 |
| `GET` | `/crm/patients/count` | `duplicated_phone_only`, `search_keyword` |  | `data` | EmrPatientsView.js:28 |
| `GET` | `/crm/trigger-engine/central-programs` |  |  | `data.results` | queries.js:5890 |
| `PATCH` | `/crm/trigger-engine/central-programs/{param}/rules/{param}/override` |  | `is_active`, `offset_days`, `send_time_kst` | `data` | queries.js:5899 |
| `PUT` | `/crm/trigger-engine/central-programs/{param}/subscription` |  | `is_active` | `data` | queries.js:5894 |
| `GET` | `/crm/trigger-engine/execution-logs/{param}` |  |  | `data` | queries.js:5856 |
| `POST` | `/crm/trigger-engine/execution-logs/cancel` |  | `logIds` | `data` | queries.js:5859 |
| `POST` | `/crm/trigger-engine/execution-logs/complete` |  | `logIds` | `data` | queries.js:5857 |
| `POST` | `/crm/trigger-engine/execution-logs/manual` |  | `date`, `patientId`, `reason` | `data` | queries.js:5863 |
| `POST` | `/crm/trigger-engine/execution-logs/manual-auto` |  | `channelIntent`, `datetime`, `patientIds`, `templateId` | `data` | queries.js:5864 |
| `POST` | `/crm/trigger-engine/execution-logs/reschedule` |  | `logId`, `reason` | `data` | queries.js:5860 |
| `POST` | `/crm/trigger-engine/execution-logs/shift-group` |  |  | `data` | queries.js:5861 |
| `POST` | `/crm/trigger-engine/execution-logs/shift-group/preview` |  |  | `data` | queries.js:5862 |
| `POST` | `/crm/trigger-engine/execution-logs/toggle` |  | `enabled`, `logIds` | `data` | queries.js:5866 |
| `POST` | `/crm/trigger-engine/execution-logs/uncomplete` |  | `logIds` | `data` | queries.js:5858 |
| `POST` | `/crm/trigger-engine/execution-logs/undo` |  | `actionLogId` | `data` | queries.js:5865 |
| `GET` | `/crm/trigger-engine/hospital-variables` |  |  | `data.results` | queries.js:5908 |
| `PATCH` | `/crm/trigger-engine/hospital-variables` |  | `variables` | `data.results` | queries.js:5909 |
| `PATCH` | `/crm/trigger-engine/mcp-approvals/{param}` |  |  | `data` | McpApprovalContactsTab.vue_vue_type_script_setup_true_lang.js:30 |
| `POST` | `/crm/trigger-engine/mcp-approvals/{param}/approve` |  |  | `data` | McpApprovalContactsTab.vue_vue_type_script_setup_true_lang.js:23 |
| `POST` | `/crm/trigger-engine/mcp-approvals/{param}/reject` |  |  | `data` | McpApprovalContactsTab.vue_vue_type_script_setup_true_lang.js:26 |
| `GET` | `/crm/trigger-engine/mcp-approvals/pending` |  |  | `data.results` | McpApprovalContactsTab.vue_vue_type_script_setup_true_lang.js:20 |
| `GET` | `/crm/trigger-engine/program-groups` |  |  | `data.results` | queries.js:5913 |
| `GET` | `/crm/trigger-engine/program-groups/{param}` |  |  | `data.results` | queries.js:5912 |
| `POST` | `/crm/trigger-engine/program-groups/{param}/opt-in` |  | `variables` | `data.results` | queries.js:5919 |
| `POST` | `/crm/trigger-engine/program-groups/{param}/opt-out` |  |  | `data.results` | queries.js:5922 |
| `GET` | `/crm/trigger-engine/program-groups/{param}/templates` |  |  | `data.results` | queries.js:5914 |
| `GET` | `/crm/trigger-engine/programs` |  |  | `data.results` | queries.js:5867 |
| `POST` | `/crm/trigger-engine/programs` |  |  | `data` | queries.js:5868 |
| `GET` | `/crm/trigger-engine/programs/{param}` |  |  | `data` | queries.js:5871 |
| `PUT` | `/crm/trigger-engine/programs/{param}` |  |  | `data` | queries.js:5875 |
| `PATCH` | `/crm/trigger-engine/programs/{param}` |  | `is_active` | `data` | queries.js:5879 |
| `DELETE` | `/crm/trigger-engine/programs/{param}` |  |  |  | queries.js:5888 |
| `POST` | `/crm/trigger-engine/programs/{param}/copy` |  |  | `data` | queries.js:5903 |
| `PATCH` | `/crm/trigger-engine/programs/{param}/rules/{param}` |  | `is_active` | `data` | queries.js:5884 |
| `GET` | `/crm/trigger-engine/worklist/logs` |  |  | `data.results` | queries.js:5839 |
| `GET` | `/crm/trigger-engine/worklist/logs/{param}/prescription-cumulative-count` |  |  | `data.results` | queries.js:5847 |
| `GET` | `/crm/trigger-engine/worklist/patients/{param}/activity` | `cursor` |  | `data.results` | queries.js:5851 |

### `/desk`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/desk/addresses/{param}` |  |  | `data.results` | index.js:91175 |
| `POST` | `/desk/addresses/{param}` |  |  | `data.results.주소Ids` | index.js:91176 |
| `PATCH` | `/desk/addresses/{param}` |  |  | `data.results` | index.js:91177 |
| `POST` | `/desk/addresses/delete/{param}` |  |  | `data.results` | index.js:91178 |
| `POST` | `/desk/appointment-blocks` |  | `blockData` | `data.message` | index.js:87219 |
| `DELETE` | `/desk/appointment-blocks/group/{param}` |  |  | `data` | index.js:87220 |
| `POST` | `/desk/appointment-markings` |  | `markingData` | `data.message` | index.js:87217 |
| `DELETE` | `/desk/appointment-markings/group/{param}` |  |  | `data` | index.js:87218 |
| `GET` | `/desk/appointments?date={value}` |  |  | `data.results` | index.js:91068 |
| `POST` | `/desk/appointments` |  | `메모`, `보험구분`, `알림설정`, `예약시간`, `예약일자`, `이름`, `진료의Id`, `진료항목Ids`, `핸드폰번호`, `환자Id` | `data` | mutations.js:24 |
| `PATCH` | `/desk/appointments/{param}` |  |  |  | mutations.js:19 |
| `DELETE` | `/desk/appointments/{param}` |  |  |  | mutations.js:22, mutations.js:26 |
| `GET` | `/desk/appointments/{param}/진료` |  |  | `data.results` | index.js:91300 |
| `GET` | `/desk/appointments/{param}/history` |  |  | `data.results` | index.js:87221 |
| `GET` | `/desk/appointments/order/lite/{param}` |  |  | `data.results` | index.js:91317 |
| `GET` | `/desk/appointments/planner` |  |  | `data.results` | index.js:87214 |
| `GET` | `/desk/appointments/telemedicine` |  |  | `data.results.예약목록` | index.js:91311 |
| `GET` | `/desk/appointments/telemedicine/cancelled` |  |  | `data.results.예약목록` | index.js:91316 |
| `GET` | `/desk/balances` | `limit`, `offset`, `type` |  | `data.results` | DeskView.js:1751 |
| `POST` | `/desk/body-measurements` |  | `values`, `환자Id` | `data.results` | index.js:91355 |
| `PATCH` | `/desk/body-measurements/{param}` |  | `values` | `data.results` | index.js:91360 |
| `DELETE` | `/desk/body-measurements/{param}` |  |  |  | index.js:91362 |
| `GET` | `/desk/body-measurements/patients/{param}` |  |  | `data.results` | index.js:91356 |
| `GET` | `/desk/booking-requests` | `limit`, `next`, `시작일자`, `요청상태`, `종료일자` |  | `data.results` | index.js:59500 |
| `PATCH` | `/desk/booking-requests/{param}` |  |  | `data.results` | index.js:59505 |
| `GET` | `/desk/booking-requests/{param}/histories` |  |  | `data.results` | index.js:59506 |
| `POST` | `/desk/booking-requests/confirm` |  | `예약요청Ids` | `data.results` | index.js:59503 |
| `POST` | `/desk/booking-requests/reject` |  | `예약요청Ids` | `data.results` | index.js:59504 |
| `GET` | `/desk/cash-registers` | `date` |  | `data.results` | index.js:91133 |
| `POST` | `/desk/cash-registers` |  | `시작금액`, `현금시재금액재사용`, `현금시재일자` | `data.message` | index.js:91138 |
| `PUT` | `/desk/cash-registers/{param}` |  | `시작금액`, `현금시재금액재사용` | `data.message` | index.js:91144 |
| `GET` | `/desk/chart-numbers/{param}/validations` |  |  | `data.results.isValid` | index.js:91071 |
| `GET` | `/desk/chart-numbers/recommendations` |  |  | `data.results.추천차트번호` | index.js:91070 |
| `GET` | `/desk/expenses` | `date` |  | `data.results` | index.js:91115 |
| `POST` | `/desk/expenses` |  | `지출금액`, `지출일자`, `지출항목Id` |  | index.js:91131 |
| `DELETE` | `/desk/expenses/{param}` |  |  |  | index.js:91128 |
| `POST` | `/desk/expenses/items` |  | `지출사유` | `data.results` | index.js:91121 |
| `POST` | `/desk/expenses/items/delete` |  | `지출항목Ids` |  | index.js:91123 |
| `GET` | `/desk/families/{param}/members-relations` |  |  | `data.results` | index.js:91179 |
| `GET` | `/desk/families/relation-dictionaries` |  |  | `data.results` | index.js:91180 |
| `GET` | `/desk/jeju-snapshot` |  |  |  | useJejuSupport.js:43 |
| `GET` | `/desk/jeju-snapshot/{param}` |  |  |  | useJejuSupport.js:42 |
| `PUT` | `/desk/jeju-snapshot/{param}` |  |  |  | useJejuSupport.js:49 |
| `PATCH` | `/desk/jeju-snapshot/{param}` |  |  |  | useJejuSupport.js:53 |
| `GET` | `/desk/jeju-snapshot/{param}/histories` |  |  |  | useJejuSupport.js:56 |
| `POST` | `/desk/nonbenefit-intake` |  | `접수` | `data.results` | index.js:91301 |
| `PATCH` | `/desk/nonbenefit-intake/{param}` |  |  | `data.results` | index.js:91309 |
| `DELETE` | `/desk/prepaid/charges/{param}` |  |  | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3040 |
| `GET` | `/desk/prepaid/charts/{param}` |  |  | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3026 |
| `POST` | `/desk/prepaid/charts/{param}/charges` |  | `결제수단`, `금액`, `담당자` | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3036 |
| `POST` | `/desk/prepaid/charts/{param}/refunds` |  | `금액`, `담당자`, `선수금계열`, `환불수단` | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3046 |
| `GET` | `/desk/prepaid/charts/{param}/transactions` | `limit` |  | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3030 |
| `DELETE` | `/desk/prepaid/refunds/{param}` |  |  | `data.results` | SidePanelDeskActions.vue_vue_type_script_setup_true_lang.js:3050 |
| `GET` | `/desk/receipts/{param}` |  |  | `data.results.수납현황` | index.js:91114 |
| `POST` | `/desk/receipts/details/{id}/refund` |  | `id`, `과세금액`, `담당자`, `메모`, `비과세금액`, `환불수단`, `환불일자` | `data.results` | index.js:91291 |
| `PATCH` | `/desk/receipts/details/{param}` |  |  |  | index.js:91277 |
| `DELETE` | `/desk/receipts/details/{param}` |  |  |  | index.js:91266 |
| `POST` | `/desk/receipts/details/payment-groups/{groupId}/refund` |  | `groupId`, `담당자`, `메모`, `환불금액손비처리여부`, `환불수단`, `환불일자` | `data.results` | index.js:91292 |
| `GET` | `/desk/receipts/details/payment-groups/{param}` |  |  | `data.results` | index.js:91262 |
| `DELETE` | `/desk/receipts/details/payment-groups/{param}` |  |  |  | index.js:91271 |
| `GET` | `/desk/receipts/patients/{param}/treatments` | `limit` |  | `data.results` | index.js:91237 |
| `GET` | `/desk/receipts/records/{param}/receipts-details` |  |  | `data.results` | index.js:91254 |
| `POST` | `/desk/receipts/treatments/loss-costs/delete` |  | `진료Id` |  | index.js:91256 |
| `GET` | `/desk/receipts/updated-checks/{param}` | `datetime` |  | `data.results.isUpdated` | index.js:91147 |
| `POST` | `/desk/settlements/cash/{param}` |  |  | `data.results` | index.js:91146 |
| `POST` | `/desk/telemedicine-consultations/{param}/invoice` |  | `invoiceList` | `data` | index.js:91310 |
| `PATCH` | `/desk/telemedicine-consultations/{param}/status` |  | `status` | `data.results` | index.js:91308 |
| `POST` | `/desk/v2/receipts` |  | `결제목록`, `공제제외여부`, `과수납금사용여부`, `담당자`, `메모`, `손비처리`, `수납일자`, `진료목록`, `차트Id` | `data` | index.js:91152 |
| `GET` | `/desk/waiting?date={param}` |  |  | `data.results.환자목록` | index.js:91069 |
| `POST` | `/desk/waiting` |  | `접수경로` | `data` | index.js:91081 |
| `PATCH` | `/desk/waiting/{id}` |  |  |  | index.js:91097 |
| `PATCH` | `/desk/waiting/{param}` |  | `options`, `건강보험원본`, `건강보험조회`, `보험구분`, `본인확인여부`, `산재보험조회`, `선택된기관기호`, `선택된기관이름`, `자동차보험조회`, `진료의Id` |  | index.js:91298 |
| `DELETE` | `/desk/waiting/{param}` |  |  |  | index.js:91112 |
| `GET` | `desk/expenses/items` |  |  | `data.results` | index.js:91120 |

### `/booking`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/booking/products` |  |  | `data.results` | index.js:59496 |
| `GET` | `/booking/products/bookable-times` |  |  | `data.results` | index.js:59497 |
| `POST` | `/booking/signup` |  | `약관동의여부` | `data.results` | index.js:59482 |
| `POST` | `/booking/sso/token` |  |  | `data.results` | index.js:59495 |
| `POST` | `/booking/sync-status` |  |  | `data.results` | index.js:59487 |

### `/documents`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/documents/chubyak-prescription-guide` |  |  | `data` | queries.js:123 |
| `GET` | `/documents/copayment-ledger` | `date` |  | `data` | queries.js:52 |
| `POST` | `/documents/copayment-ledger` |  | `documentData` | `data` | queries.js:57 |
| `POST` | `/documents/customs-certificate` |  |  | `data` | queries.js:109 |
| `GET` | `/documents/drafts` | `limit`, `offset` |  | `data.results` | queries.js:80 |
| `POST` | `/documents/drafts` |  | `documentData`, `documentType`, `환자Id` | `data.results` | queries.js:98 |
| `GET` | `/documents/drafts/{param}` |  |  | `data.results` | queries.js:78 |
| `PATCH` | `/documents/drafts/{param}` |  | `문서내용` | `data.results` | queries.js:102 |
| `DELETE` | `/documents/drafts/{param}` |  |  | `data.results` | queries.js:87 |
| `POST` | `/documents/future-medical-cost-estimate` |  |  | `data` | queries.js:111 |
| `POST` | `/documents/general-herbal-prescription` |  | `환자Id` | `data` | queries.js:137 |
| `POST` | `/documents/herbal-medicine-receipt` |  |  | `data` | queries.js:122 |
| `POST` | `/documents/injury-certificate` |  |  | `data` | queries.js:114 |
| `GET` | `/documents/issued` | `limit`, `offset` |  | `data.results` | queries.js:89 |
| `GET` | `/documents/issued/{param}` |  |  | `data.results` | queries.js:96 |
| `POST` | `/documents/medical-aid-extension-approval` |  |  | `data` | queries.js:105 |
| `POST` | `/documents/medical-aid-referral` |  |  | `data` | queries.js:103 |
| `POST` | `/documents/medical-aid-transfer` |  |  | `data` | queries.js:104 |
| `POST` | `/documents/medical-care-benefit-referral` |  |  | `data` | queries.js:115 |
| `POST` | `/documents/medical-care-benefit-transfer` |  |  | `data` | queries.js:116 |
| `POST` | `/documents/medical-certificate` |  |  | `data` | queries.js:113 |
| `POST` | `/documents/medical-payment-receipt` |  |  | `data` | queries.js:158 |
| `POST` | `/documents/medical-statement` |  |  | `data` | queries.js:165 |
| `POST` | `/documents/medication-opinion` |  |  | `data` | queries.js:108 |
| `POST` | `/documents/opinion` |  |  | `data` | queries.js:107 |
| `POST` | `/documents/outpatient-medical-certificate` |  |  | `data` | queries.js:117 |
| `GET` | `/documents/patients/{param}` |  |  | `data.results` | queries.js:13 |
| `GET` | `/documents/patients/{param}/receipts` | `after`, `before`, `end_date`, `insurance_type`, `start_date` |  | `data.results` | queries.js:42 |
| `GET` | `/documents/patients/{param}/record` | `after`, `before`, `end_date`, `insurance_type`, `start_date` |  | `data.results` | queries.js:147 |
| `GET` | `/documents/patients/{param}/record-date` | `end_date`, `insurance_type`, `is_first_record`, `start_date` |  |  | queries.js:22 |
| `GET` | `/documents/patients/{pid}/chubyak-prescription` |  |  | `data.results` | queries.js:124 |
| `GET` | `/documents/patients/{pid}/chubyak-prescription/{rid}` |  |  | `data.results` | queries.js:125 |
| `GET` | `/documents/patients/{pid}/diagnosis` | `end_date`, `insurance_type`, `record_id`, `start_date` |  | `data.results` | queries.js:58, queries.js:66 |
| `POST` | `/documents/patients/{pid}/herbal-medicine-receipt` |  | `진료Ids`, `합쳐서출력여부` | `data.results` | queries.js:118 |
| `GET` | `/documents/patients/{pid}/herbal-prescription` | `end_date`, `start_date` |  | `data.results` | queries.js:126 |
| `GET` | `/documents/patients/{pid}/herbal-prescription/{rid}` |  |  | `data.results` | queries.js:135 |
| `POST` | `/documents/patients/{pid}/medical-payment-receipt` |  | `진료Ids` | `data.results` | queries.js:159 |
| `POST` | `/documents/patients/{pid}/medical-statement` |  | `진료Ids` | `data.results` | queries.js:162 |
| `GET` | `/documents/patients/unassigned/herbal-prescription/{rid}` |  |  | `data.results` | queries.js:136 |
| `GET` | `/documents/phrases` |  |  | `data.results.서식상용구` | useDocumentSnippetItems.js:13 |
| `POST` | `/documents/phrases` |  |  | `data.results` | useDocumentSnippetItems.js:14 |
| `PATCH` | `/documents/phrases/{param}` |  |  | `data.message` | useDocumentSnippetItems.js:18 |
| `DELETE` | `/documents/phrases/{param}` |  |  | `data.message` | useDocumentSnippetItems.js:21 |
| `PATCH` | `/documents/receipt-details/deduction-exclusion` |  | `제외할수납상세Ids`, `포함할수납상세Ids` | `data` | YearSettlement.js:81 |
| `POST` | `/documents/record` |  |  | `data` | queries.js:157 |
| `POST` | `/documents/referral-letter` |  |  | `data` | queries.js:106 |
| `POST` | `/documents/transfer-opinion` |  |  | `data` | queries.js:110 |
| `POST` | `/documents/work-ability-diagnosis` |  |  | `data` | queries.js:112 |
| `GET` | `/documents/year-end-tax-settlement` | `end_date`, `start_date` |  | `data` | YearSettlement.js:45 |
| `GET` | `/documents/year-end-tax-settlement/details` | `end_date`, `start_date` |  | `data` | YearSettlement.js:77 |
| `GET` | `/documents/year-end-tax-settlement/details/count` | `end_date`, `start_date` |  | `data` | YearSettlement.js:114 |
| `POST` | `/documents/year-end-tax-settlement/download` | `end_date`, `start_date` | `병원정보` | `data` | YearSettlement.js:96 |

### `/nhic`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/nhic/cert-files` |  |  | `data.results` | mutations.js:25 |
| `POST` | `/nhic/cert-files` |  |  |  | mutations.js:23 |
| `POST` | `/nhic/m2/get-data` |  | `건강보험증번호`, `본인확인여부`, `생년월일`, `수진자성명`, `수진자주민등록번호`, `진료일자` | `data.results.m2` | index.js:117636 |
| `GET` | `/nhic/m3` |  |  | `data.results` | mutations.js:13 |
| `GET` | `/nhic/m3/{param}` |  |  | `data.results` | mutations.js:12 |
| `POST` | `/nhic/m4/get-external-data` |  | `m3`, `진료Id` | `data.results` | mutations.js:16 |
| `GET` | `/nhic/m4/internal-data/{param}` |  |  | `data.results` | mutations.js:17 |
| `DELETE` | `/nhic/m5/{param}/confirmation/{param}` |  |  | `data.results` | mutations.js:21 |

### `/noti`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `PUT` | `/noti/instructions` |  | `내용`, `내원Id` | `data` | useExclusivePopover.js:67 |
| `GET` | `/noti/instructions/{param}` | `내원Id` |  | `data` | useExclusivePopover.js:62 |
| `DELETE` | `/noti/instructions/{param}` |  |  | `data` | useExclusivePopover.js:70 |

### `/ocs`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/ocs/{param}` |  |  | `data.results` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:23 |
| `PATCH` | `/ocs/{param}` |  | `메모`, `약재목록`, `용량`, `일수`, `전체차수`, `조제상태`, `첩`, `탕전타입`, `팩`, `현재차수` | `data` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:30 |
| `PATCH` | `/ocs/{param}/delivery` |  | `복용종료일`, `수령방법`, `수령일` | `data` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:37 |
| `PATCH` | `/ocs/{param}/taking` |  | `복용완료` | `data` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:44 |
| `GET` | `/ocs/dictionaries` | `limit`, `offset` |  | `data.results` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:46 |
| `GET` | `/ocs/dictionaries/categories` |  |  | `data.results` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:49 |
| `GET` | `/ocs/list` | `end_date`, `limit`, `offset`, `start_date` |  | `data.results` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:13 |
| `GET` | `/ocs/list/stats` |  |  | `data.results` | OcsViewPrescriptionOcsDictionary.vue_vue_type_script_setup_true_lang.js:16 |

### `/ocsv2`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/ocsv2/contract` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:85 |
| `GET` | `/ocsv2/dispensary` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:295 |
| `GET` | `/ocsv2/drafts` |  |  | `data.results` | OcsV2MedicationGuidePagedSheets.js:15 |
| `POST` | `/ocsv2/drafts` |  |  | `data` | OcsV2MedicationGuidePagedSheets.js:14 |
| `GET` | `/ocsv2/drafts/{param}` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:18 |
| `PATCH` | `/ocsv2/drafts/{param}` |  |  | `data` | OcsV2MedicationGuidePagedSheets.js:22 |
| `DELETE` | `/ocsv2/drafts/{param}` |  |  | `data` | OcsV2MedicationGuidePagedSheets.js:25 |
| `GET` | `/ocsv2/drafts/{param}/medication-guide` |  |  | `data` | OcsV2MedicationGuidePagedSheets.js:37 |
| `POST` | `/ocsv2/drafts/{param}/medication-guide` |  | `파일명` | `data` | OcsV2MedicationGuidePagedSheets.js:27 |
| `GET` | `/ocsv2/drafts/{param}/snapshots` |  |  | `data.results.snapshots` | OcsV2MedicationGuidePagedSheets.js:51 |
| `GET` | `/ocsv2/eligibility` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:84 |
| `POST` | `/ocsv2/herbs/search` | `keyword` | `sort` | `data.results` | OcsV2MedicationGuidePagedSheets.js:52 |
| `POST` | `/ocsv2/order` |  | `draftId`, `견적ID`, `결제수단목록` | `data.result` | OcsV2MedicationGuidePagedSheets.js:75 |
| `GET` | `/ocsv2/order-options` |  |  | `data.results` | OcsV2MedicationGuidePagedSheets.js:59 |
| `POST` | `/ocsv2/orders/{param}/cancel` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:72 |
| `POST` | `/ocsv2/orders/{param}/hold` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:73 |
| `PATCH` | `/ocsv2/orders/{param}/info` |  | `배송메모`, `배송지주소`, `수령인명`, `수령인연락처`, `조제정보`, `처방명` |  | OcsV2MedicationGuidePagedSheets.js:49 |
| `GET` | `/ocsv2/orders/{param}/status` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:68 |
| `POST` | `/ocsv2/orders/{param}/unhold` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:74 |
| `POST` | `/ocsv2/precheck` |  |  | `data.result` | OcsV2MedicationGuidePagedSheets.js:62 |
| `POST` | `/ocsv2/price-preview` |  | `부자재목록`, `약재라인목록`, `조제정보`, `추가옵션목록` | `data.result` | OcsV2MedicationGuidePagedSheets.js:67 |
| `POST` | `/ocsv2/quote` |  | `draftId` | `data.result` | OcsV2MedicationGuidePagedSheets.js:66 |
| `POST` | `/ocsv2/sameday/classify` |  | `address` | `data.result` | OcsV2MedicationGuidePagedSheets.js:63 |

### `/patients`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/patients/{id}/car-waiting/amount/{report_number}` |  |  | `data.results` | index.js:91221 |
| `GET` | `/patients/{param}` |  |  | `data.results.환자` | index.js:91076 |
| `GET` | `/patients/{param}/agreement-history` |  |  | `data.results` | index.js:91288 |
| `GET` | `/patients/{param}/appointments/history` | `before`, `end_date` |  | `data.results` | index.js:91228 |
| `GET` | `/patients/{param}/appointments/info` |  |  | `data.results` | index.js:91224 |
| `GET` | `/patients/{param}/appointments/summary` |  |  | `data.results` | index.js:91233 |
| `GET` | `/patients/{param}/canvas/images` | `after` |  | `data` | queries.js:56 |
| `POST` | `/patients/{param}/canvas/images` |  | `미리보기이미지사이즈`, `벡터데이터`, `이미지명`, `이미지사이즈`, `캔버스템플릿Id`, `템플릿카테고리` | `data` | queries.js:43 |
| `GET` | `/patients/{param}/canvas/images/{param}` |  |  | `data` | queries.js:65 |
| `PUT` | `/patients/{param}/canvas/images/{param}` |  | `벡터데이터`, `이미지명`, `이미지사이즈` | `data` | queries.js:73 |
| `DELETE` | `/patients/{param}/canvas/images/{param}` |  |  | `data` | queries.js:88 |
| `PATCH` | `/patients/{param}/canvas/images/{param}/name` |  | `이미지명` | `data` | queries.js:81 |
| `GET` | `/patients/{param}/canvas/images/count` |  |  | `data` | queries.js:49 |
| `GET` | `/patients/{param}/car-waiting` | `before`, `limit` |  | `data` | index.js:91186 |
| `POST` | `/patients/{param}/car-waiting` |  |  | `data` | index.js:91202 |
| `GET` | `/patients/{param}/chubyak-records` |  |  | `data.results` | index.js:117807 |
| `GET` | `/patients/{param}/chubyak-records/{param}` |  |  | `data.results` | index.js:117816 |
| `GET` | `/patients/{param}/consent-history` |  |  | `data.results` | index.js:109839 |
| `GET` | `/patients/{param}/consent-history/{param}` |  |  | `data.results` | index.js:109841 |
| `GET` | `/patients/{param}/jeju-supports` | `include_inactive` |  |  | useJejuSupport.js:19 |
| `POST` | `/patients/{param}/jeju-supports` |  |  |  | useJejuSupport.js:27 |
| `PATCH` | `/patients/{param}/jeju-supports/{param}` |  |  |  | useJejuSupport.js:32 |
| `PATCH` | `/patients/{param}/jeju-supports/{param}/deactivate` |  |  |  | useJejuSupport.js:36 |
| `GET` | `/patients/{param}/jeju-supports/histories` |  |  |  | useJejuSupport.js:39 |
| `GET` | `/patients/{param}/memos` |  |  | `data.results` | index.js:117677 |
| `POST` | `/patients/{param}/memos` |  | `내용`, `카테고리` | `data.results` | index.js:117687 |
| `PATCH` | `/patients/{param}/memos/{param}` |  | `내용`, `중요표시여부`, `카테고리` | `data` | index.js:117695 |
| `DELETE` | `/patients/{param}/memos/{param}` |  |  | `data.message` | index.js:117702 |
| `GET` | `/patients/{param}/memos/count` |  |  | `data.results` | index.js:117681 |
| `GET` | `/patients/{param}/packages` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:87, TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:147 |
| `GET` | `/patients/{param}/packages/{param}` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:93 |
| `DELETE` | `/patients/{param}/packages/{param}` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:141 |
| `PATCH` | `/patients/{param}/packages/{param}/expiration` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:111 |
| `GET` | `/patients/{param}/packages/{param}/expiration-history` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:135 |
| `PATCH` | `/patients/{param}/packages/{param}/revive` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:105 |
| `PATCH` | `/patients/{param}/packages/{param}/terminate` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:99 |
| `PATCH` | `/patients/{param}/packages/{param}/usage-records/{param}/cancel` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:117 |
| `DELETE` | `/patients/{param}/packages/{param}/usage/{param}` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:129 |
| `PATCH` | `/patients/{param}/packages/{param}/usage/{param}/revive` |  |  |  | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:123 |
| `GET` | `/patients/{param}/questionnaire-history` |  |  | `data.results` | index.js:109835 |
| `GET` | `/patients/{param}/questionnaire-history/{param}` |  |  | `data.results` | index.js:109836 |
| `POST` | `/patients/{param}/questionnaire-history/{param}/corrections` |  |  | `data.results` | index.js:109837 |
| `GET` | `/patients/{param}/questionnaire-trends` |  |  | `data.results` | index.js:109838 |
| `GET` | `/patients/{param}/receipts-details` | `limit` |  | `data.results` | index.js:91246 |
| `GET` | `/patients/{param}/sanjae-waiting` | `before`, `limit` |  | `data` | index.js:91210 |
| `GET` | `/patients/{param}/waiting/latest` |  |  | `data.results` | index.js:91283 |
| `PATCH` | `/patients/{pid}` |  |  |  | index.js:91074 |
| `DELETE` | `/patients/car-waiting/{id}` |  |  | `data` | index.js:91204 |
| `PATCH` | `/patients/car-waiting/{param}` |  | `보증시작일자`, `보증종료일자`, `보험회사명칭`, `보험회사코드`, `사고접수번호`, `지급보증번호` | `data` | index.js:91195 |
| `POST` | `/patients/check-ssn` |  |  | `data.results` | index.js:91284 |
| `POST` | `/patients/download-logs` |  | `다운로드건수`, `다운로드사유`, `다운로드위치` | `data` | index.js:117787 |
| `GET` | `/patients/list` | `limit`, `search_keyword` |  | `data.results`, `data.results.patients.map` | index.js:91347, useOcsV2배송상태-DHC-CIRk.js:1625 |
| `GET` | `/patients/me/pending-notes` |  |  |  | McpPendingContacts.js:14 |
| `PATCH` | `/patients/memos/{param}` |  |  |  | McpPendingContacts.js:16 |
| `DELETE` | `/patients/memos/{param}` |  |  |  | McpPendingContacts.js:17 |
| `POST` | `/patients/memos/{param}/approve` |  |  |  | McpPendingContacts.js:15 |
| `POST` | `/patients/new` |  |  | `data.results` | index.js:91072 |
| `POST` | `/patients/profile-images` |  | `환자Ids` | `data.results` | index.js:91077 |
| `PATCH` | `/patients/sanjae-waiting/{param}` |  | `사업구분`, `사업자번호`, `사업장명`, `산재시작일자`, `승인일자`, `요양승인번호`, `재해발생일자`, `치료종료일자` | `data` | index.js:91219 |
| `GET` | `/patients/v2/chart/{param}/medical-receipts` |  |  | `data.results` | index.js:91080 |

### `/record`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/record/{param}` |  |  | `data.results.진료` | index.js:117704, records.js:13 |
| `DELETE` | `/record/{param}` |  |  | `data.results` | index.js:117744 |
| `PATCH` | `/record/{param}/done` |  |  |  | index.js:117753 |
| `PATCH` | `/record/{param}/fixed` |  | `고정된기록여부` | `data.results` | index.js:117751 |
| `POST` | `/record/{param}/save` |  |  | `data.results` | index.js:117737 |
| `GET` | `/record/canvas/templates` | `after` |  | `data` | queries.js:15 |
| `POST` | `/record/canvas/templates` |  | `미리보기이미지사이즈`, `이미지명`, `이미지사이즈` | `data` | queries.js:14 |
| `PATCH` | `/record/canvas/templates/{param}` |  | `이미지명` | `data` | queries.js:30 |
| `DELETE` | `/record/canvas/templates/{param}` |  |  | `data` | queries.js:36 |
| `GET` | `/record/canvas/templates/category/{param}/id/{param}` |  |  | `data` | queries.js:23 |
| `GET` | `/record/hira/car-pcmd` |  |  | `data.results.자보첩약제출현황` | records.js:28 |
| `GET` | `/record/hira/chuna` |  |  | `data.results.추나승인현황` | records.js:22 |
| `GET` | `/record/hira/pcmd` |  |  | `data.results.건보첩약제출현황` | records.js:25 |
| `POST` | `/record/hira/pcmd-checklist` |  | `진료처방Ids`, `첩건체크리스트제출여부` | `data` | records.js:32 |
| `POST` | `/record/hira/prescriptions/approval` |  | `승인여부`, `진료처방Ids` | `data` | records.js:31 |
| `GET` | `/record/home-visit` |  |  | `data.results` | index.js:120922 |
| `PATCH` | `/record/home-visit/{param}/form-status` |  | `점검서식상태` | `data.results` | index.js:120928 |
| `GET` | `/record/home-visit/counts` |  |  | `data.results` | index.js:120919 |
| `GET` | `/record/list/pcmd-count/{date}/doctor/{doctorId}` |  |  | `data.results.한방첩약시범사업승인횟수` | records.js:21 |
| `GET` | `/record/patient/{param}` | `days_ago`, `limit`, `next`, `type` |  | `data.results` | index.js:117710 |
| `GET` | `/record/patient/{param}/latest` |  |  | `data.results` | records.js:20 |
| `GET` | `/record/patient/{param}/record/date` |  |  | `data.results` | records.js:19 |
| `PATCH` | `/record/prescriptions/{id}` |  | `id`, `시술진료의Id`, `시술진료의표기이름`, `줄단위특정내역` | `data` | records.js:33 |
| `POST` | `/record/prescriptions/last-rounds` |  | `기준일자`, `수가코드들`, `환자Id` | `data` | usePublicHolidays.js:38 |
| `GET` | `/record/telemedicine-pilot/counts` |  |  | `data.results` | index.js:120955 |
| `GET` | `/record/telemedicine-pilot/ratio` |  |  | `data.results` | index.js:120958 |
| `GET` | `/record/telemedicine-pilot/records` |  |  | `data.results` | index.js:120961 |

### `/settings`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/settings/appointed-prescriptions` |  |  | `data.results` | index.js:44620 |
| `POST` | `/settings/appointed-prescriptions` |  |  | `data.results.병원약속처방Id` | index.js:44644 |
| `GET` | `/settings/appointed-prescriptions/{param}` |  |  | `data.results` | index.js:44643 |
| `PATCH` | `/settings/appointed-prescriptions/{param}` |  |  |  | index.js:44649 |
| `DELETE` | `/settings/appointed-prescriptions/{param}` |  |  |  | index.js:44652 |
| `GET` | `/settings/appointed-prescriptions/groups` | `limit` |  |  | index.js:44656 |
| `POST` | `/settings/appointed-prescriptions/groups` |  | `그룹명` |  | index.js:44673 |
| `PATCH` | `/settings/appointed-prescriptions/groups/{param}` |  | `그룹명` |  | index.js:44679 |
| `DELETE` | `/settings/appointed-prescriptions/groups/{param}` |  |  |  | index.js:44682 |
| `PUT` | `/settings/appointed-prescriptions/groups/sort-order` |  | `병원약속처방그룹Ids` |  | index.js:44688 |
| `PUT` | `/settings/appointed-prescriptions/sort-order` |  | `병원약속처방Ids`, `병원약속처방그룹Id` |  | index.js:44685 |
| `GET` | `/settings/appointments` |  |  | `data.results` | index.js:79016 |
| `PATCH` | `/settings/appointments` |  |  | `data.results` | index.js:79017 |
| `GET` | `/settings/car-insurances/herbal-decoctions` |  |  | `data.results.병원자보한방첩약` | index.js:44522 |
| `POST` | `/settings/car-insurances/herbal-decoctions` |  |  |  | index.js:44532 |
| `PATCH` | `/settings/car-insurances/herbal-decoctions/{param}` |  | `id` |  | index.js:44529 |
| `DELETE` | `/settings/car-insurances/herbal-decoctions/{param}` |  |  |  | index.js:44535 |
| `GET` | `/settings/car-insurances/herbal-medicines` |  |  | `data.results.병원한방의약품` | index.js:44594 |
| `POST` | `/settings/car-insurances/herbal-medicines` |  | `구매일`, `구분`, `실구매가`, `심평원신고여부`, `제품명`, `제품코드` |  | index.js:44605 |
| `PATCH` | `/settings/car-insurances/herbal-medicines/{param}` |  |  |  | index.js:44602 |
| `DELETE` | `/settings/car-insurances/herbal-medicines/{param}` |  |  |  | index.js:44608 |
| `GET` | `/settings/car-insurances/pharmacopuncture-references` |  |  | `data.results.자보약침액명레퍼런스` | index.js:101011 |
| `GET` | `/settings/car-insurances/pharmacopunctures` |  |  | `data.results.병원자보약침` | index.js:44583 |
| `POST` | `/settings/car-insurances/pharmacopunctures` |  | `자보약침액명레퍼런스` |  | index.js:44579 |
| `PATCH` | `/settings/car-insurances/pharmacopunctures/{param}` |  | `약침액` |  | index.js:44589 |
| `DELETE` | `/settings/car-insurances/pharmacopunctures/{param}` |  |  |  | index.js:44592 |
| `PATCH` | `/settings/car-insurances/procedure-fee/{param}` |  | `단가` |  | index.js:44615 |
| `GET` | `/settings/car-insurances/procedure-references` |  |  | `data.results.자보시술및처치레퍼런스` | index.js:44610 |
| `GET` | `/settings/categories` |  |  | `data.results` | index.js:44436 |
| `GET` | `/settings/chubyak-pilots/herbs` | `search_keyword` |  | `data.results` | herb.js:1429 |
| `GET` | `/settings/chubyak-pilots/herbs/available-product-codes` |  |  | `data.results` | herb.js:1428 |
| `GET` | `/settings/chubyak-pilots/herbs/products` | `search_keyword` |  | `data.results` | herb.js:1432 |
| `GET` | `/settings/chubyak-pilots/prescriptions` | `after` |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1790 |
| `GET` | `/settings/chubyak-pilots/prescriptions/{param}` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1828 |
| `PUT` | `/settings/clinic-calendar/days` |  | `일자` | `data` | index.js:81205 |
| `GET` | `/settings/clinic-calendar/year/{param}` |  |  | `data.results` | index.js:81204 |
| `GET` | `/settings/clinic-hours` |  |  | `data.results.병원진료일.요일별진료시간` | index.js:44552 |
| `PATCH` | `/settings/clinic-hours` |  | `요일별진료시간` |  | index.js:44554 |
| `GET` | `/settings/clinic-schedules` |  |  | `data.results` | index.js:44748 |
| `PATCH` | `/settings/clinic-schedules/{param}` |  |  |  | index.js:44755 |
| `GET` | `/settings/closed-days/{param}` |  |  | `data.results.병원휴진일` | index.js:44556 |
| `POST` | `/settings/devices` |  | `기기명` | `data.results` | index.js:76860 |
| `GET` | `/settings/dispensary-rooms` |  |  | `data.results` | jaboChubyakPrescription.js:14 |
| `POST` | `/settings/dispensary-rooms` |  | `기관기호`, `기관명`, `상세주소`, `연번`, `유형`, `전화번호`, `조제자이름`, `주소`, `타입`, `한약사면허번호` | `data.results` | jaboChubyakPrescription.js:13 |
| `GET` | `/settings/dispensary-rooms/{param}` |  |  | `data.results` | jaboChubyakPrescription.js:15 |
| `PATCH` | `/settings/dispensary-rooms/{param}` |  | `기관기호`, `기관명`, `상세주소`, `연번`, `유형`, `전화번호`, `조제자이름`, `주소`, `타입`, `한약사면허번호` | `data.results` | jaboChubyakPrescription.js:21 |
| `DELETE` | `/settings/dispensary-rooms/{param}` |  |  | `data.message` | jaboChubyakPrescription.js:23 |
| `GET` | `/settings/dispensary-rooms/{param}/herbs` | `search_keyword` |  | `data.results` | jaboChubyakPrescription.js:29 |
| `GET` | `/settings/dispensary-rooms/{param}/prescriptions/{param}` |  |  | `data.results` | jaboChubyakPrescription.js:38 |
| `GET` | `/settings/dispensary-rooms/{param}/reference-prescriptions/{param}` |  |  | `data.results` | jaboChubyakPrescription.js:45 |
| `GET` | `/settings/display/chart-numbers` |  |  | `data.results.차트번호표기여부` | index.js:44635 |
| `PATCH` | `/settings/display/chart-numbers` |  | `차트번호표기여부` |  | index.js:44637 |
| `GET` | `/settings/display/resident-numbers` |  |  | `data.results.주민등록번호뒷자리표시여부` | index.js:44639 |
| `PATCH` | `/settings/display/resident-numbers` |  | `주민등록번호뒷자리표시여부` |  | index.js:44641 |
| `GET` | `/settings/doctor-schedules` |  |  | `data.results` | index.js:44743 |
| `PATCH` | `/settings/doctor-schedules/doctor/{param}` |  | `schedules` |  | index.js:44747 |
| `GET` | `/settings/doctors` |  |  | `data.results.진료의` | index.js:91165 |
| `PATCH` | `/settings/doctors/{param}` |  | `영문이름` | `data.results` | index.js:91169 |
| `GET` | `/settings/doctors/appointments/{param}` |  |  |  | index.js:91171 |
| `GET` | `/settings/holidays/public-holidays/{param}` |  |  | `data.results.법정공휴일` | index.js:44557 |
| `GET` | `/settings/holidays/schedule-banner` |  |  | `data.results` | index.js:81032 |
| `GET` | `/settings/hospitals` |  |  | `data.results` | index.js:44482 |
| `PATCH` | `/settings/hospitals` |  | `영문상세주소`, `영문상호`, `영문주소`, `인증서만료일자`, `차트레이아웃` | `data.message` | index.js:44483 |
| `GET` | `/settings/hospitals/chart-number` |  |  | `data.results.추천차트번호` | index.js:44631 |
| `PATCH` | `/settings/hospitals/chart-number` |  | `추천차트번호` |  | index.js:44633 |
| `GET` | `/settings/hospitals/chubyak-pilots/herbs` | `after` |  | `data.results` | herb.js:1440 |
| `POST` | `/settings/hospitals/chubyak-pilots/herbs` |  | `약재목록`, `탕전실Id` | `data.results` | herb.js:1435 |
| `DELETE` | `/settings/hospitals/chubyak-pilots/herbs?{param}` |  |  | `data.message` | herb.js:1438 |
| `PATCH` | `/settings/hospitals/chubyak-pilots/herbs/{param}` |  | `구입금액`, `구입량`, `구입일자`, `원산지` | `data.results` | herb.js:1446 |
| `GET` | `/settings/hospitals/chubyak-pilots/prescriptions` | `after` |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1794 |
| `POST` | `/settings/hospitals/chubyak-pilots/prescriptions` |  | `기준처방Ids` | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1793 |
| `GET` | `/settings/hospitals/chubyak-pilots/prescriptions/{id}` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1797 |
| `DELETE` | `/settings/hospitals/chubyak-pilots/prescriptions/{param}` |  |  | `data.message` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1802 |
| `PATCH` | `/settings/hospitals/chubyak-pilots/prescriptions/{param}/alias` |  | `별칭` | `data.message` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1826 |
| `GET` | `/settings/hospitals/chubyak-pilots/prescriptions/categories/{param}` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1817 |
| `POST` | `/settings/hospitals/chubyak-pilots/prescriptions/herbs/{param}` |  |  | `data.results` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1806 |
| `PATCH` | `/settings/hospitals/chubyak-pilots/prescriptions/herbs/{param}` |  | `처방용량` | `data.message` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1810 |
| `DELETE` | `/settings/hospitals/chubyak-pilots/prescriptions/herbs/{param}` |  |  | `data.message` | ReservedProcedures.vue_vue_type_script_setup_true_lang.js:1811 |
| `POST` | `/settings/images/private` |  | `이미지명`, `이미지사이즈` |  | index.js:106143 |
| `GET` | `/settings/initial-records` |  |  | `data.results` | index.js:44505 |
| `PATCH` | `/settings/initial-records` |  | `초진기록자동고정여부` | `data.results` | index.js:44506 |
| `GET` | `/settings/jeju-claim` |  |  |  | useJejuSupport.js:14 |
| `PATCH` | `/settings/jeju-claim` |  |  |  | useJejuSupport.js:15 |
| `GET` | `/settings/medical-treatments` |  |  | `data` | queries.js:14 |
| `POST` | `/settings/medical-treatments` |  | `기본이름`, `이름` | `data` | queries.js:15 |
| `PATCH` | `/settings/medical-treatments/{param}` |  | `기본소요시간`, `사용여부`, `진료항목색명`, `추가예약제한` | `data` | queries.js:22 |
| `DELETE` | `/settings/medical-treatments/{param}` |  |  | `data` | queries.js:18 |
| `GET` | `/settings/medicines` |  |  | `data.results` | index.js:44489 |
| `PATCH` | `/settings/medicines/{param}` |  | `구성약재`, `연계상병`, `처방명` |  | index.js:44496 |
| `DELETE` | `/settings/medicines/{param}` |  |  | `data.message` | index.js:44498 |
| `GET` | `/settings/medicines/dosages` |  |  | `data.results` | index.js:44499 |
| `PATCH` | `/settings/medicines/dosages` |  | `기본투여량여부` |  | index.js:44501 |
| `POST` | `/settings/medicines/from-custom` |  | `구성약재`, `연계상병`, `처방명` | `data.results` | index.js:44491 |
| `POST` | `/settings/medicines/from-mixture` |  | `단미엑스혼합제` | `data.results` | index.js:44490 |
| `GET` | `/settings/nonbenefit-groups` | `기준일자` |  | `data.results` | index.js:44442 |
| `POST` | `/settings/nonbenefit-groups` |  | `그룹명` | `data.results` | index.js:44445 |
| `PATCH` | `/settings/nonbenefit-groups/{param}` |  | `그룹명` |  | index.js:44450 |
| `DELETE` | `/settings/nonbenefit-groups/{param}` |  |  |  | index.js:44455 |
| `GET` | `/settings/nonbenefit-package-groups` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:80 |
| `POST` | `/settings/nonbenefit-package-groups` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:88 |
| `PATCH` | `/settings/nonbenefit-package-groups/{param}` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:94 |
| `DELETE` | `/settings/nonbenefit-package-groups/{param}` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:100 |
| `POST` | `/settings/nonbenefit-package-groups/validate` |  | `그룹명` |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:109 |
| `GET` | `/settings/nonbenefit-packages` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:39 |
| `POST` | `/settings/nonbenefit-packages` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:47 |
| `PATCH` | `/settings/nonbenefit-packages/{param}` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:53 |
| `DELETE` | `/settings/nonbenefit-packages/{param}` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:59 |
| `PATCH` | `/settings/nonbenefit-packages/{param}/favorite` |  |  |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:65 |
| `POST` | `/settings/nonbenefit-packages/validate` |  | `패키지명` |  | PrescriptionInputSearchTreatment.vue_vue_type_script_setup_true_lang.js:74 |
| `GET` | `/settings/nonbenefits` |  |  | `data.results` | index.js:44439 |
| `DELETE` | `/settings/nonbenefits/{param}` |  |  |  | index.js:44475 |
| `GET` | `/settings/nonbenefits/{param}/affected-packages/delete` |  |  | `data` | index.js:44467 |
| `POST` | `/settings/nonbenefits/{param}/affected-packages/update` |  | `과세구분변경`, `단가변경` | `data` | index.js:44466 |
| `POST` | `/settings/nonbenefits/bulk-delete` |  |  | `data` | index.js:44473 |
| `PATCH` | `/settings/nonbenefits/groups` |  |  | `data` | index.js:44472 |
| `GET` | `/settings/nonbenefits/v2` | `기준일자` |  | `data.results` | index.js:44457 |
| `POST` | `/settings/nonbenefits/v2` |  |  |  | index.js:44461 |
| `PATCH` | `/settings/nonbenefits/v2/{param}` |  |  |  | index.js:44464 |
| `PATCH` | `/settings/nonbenefits/v2/{param}/favorite` |  |  |  | index.js:44469 |
| `POST` | `/settings/nonbenefits/validate` |  | `field`, `value` | `data.results` | index.js:44471 |
| `GET` | `/settings/nonreimbursed-herb-templates` | `limit`, `병원비급여Id` |  | `data` | nonreimbursedHerbTemplate.js:14 |
| `POST` | `/settings/nonreimbursed-herb-templates` |  | `병원비급여Id`, `처방명` | `data.results` | nonreimbursedHerbTemplate.js:13 |
| `GET` | `/settings/nonreimbursed-herb-templates/{param}` |  |  | `data.results` | nonreimbursedHerbTemplate.js:17 |
| `PATCH` | `/settings/nonreimbursed-herb-templates/{param}` |  |  | `data.results` | nonreimbursedHerbTemplate.js:21 |
| `GET` | `/settings/notifications` | `기기id` |  | `data.results` | index.js:76861 |
| `PUT` | `/settings/notifications` |  |  | `data.results` | index.js:76866 |
| `GET` | `/settings/onboarding-guide` |  |  | `data.results` | index.js:82355 |
| `PUT` | `/settings/onboarding-guide/progress` |  | `마지막확인step`, `안내완료`, `항목id` | `data.results` | index.js:82356 |
| `GET` | `/settings/patient-levels` |  |  | `data.results.병원환자등급` | index.js:44558 |
| `POST` | `/settings/patient-levels` |  | `기본설정여부`, `등급명`, `등급색명`, `할인율` |  | index.js:44566 |
| `PATCH` | `/settings/patient-levels/{param}` |  | `순서` |  | index.js:44563 |
| `DELETE` | `/settings/patient-levels/{param}` |  |  |  | index.js:44569 |
| `GET` | `/settings/personal-formulas` |  |  | `data` | index.js:79074 |
| `POST` | `/settings/personal-formulas` |  | `약재목록`, `원방Id`, `처방메모`, `처방명` | `data.results` | index.js:79078 |
| `GET` | `/settings/personal-formulas/{param}` |  |  | `data.results` | index.js:79077 |
| `PATCH` | `/settings/personal-formulas/{param}` |  | `약재목록`, `처방메모`, `처방명` | `data.results` | index.js:79082 |
| `DELETE` | `/settings/personal-formulas/{param}` |  |  | `data.results` | index.js:79084 |
| `POST` | `/settings/personal-formulas/{param}/duplicate` |  |  | `data.results` | index.js:79083 |
| `GET` | `/settings/record` |  |  | `data.results` | index.js:44757 |
| `GET` | `/settings/reference-formulas/{param}/{param}` |  |  | `data.results` | index.js:79092 |
| `GET` | `/settings/reference-formulas/search` | `keyword`, `limit`, `offset`, `출전` |  | `data` | index.js:79086 |
| `GET` | `/settings/references/acupoints` |  |  | `data.results.혈자리` | index.js:44484 |
| `GET` | `/settings/references/herbal-pharmacopoeia` |  |  | `data.results` | index.js:101018 |
| `GET` | `/settings/references/reimbursement-available-dates` |  |  | `data.results.적용일자목록` | index.js:101014 |
| `GET` | `/settings/references/reimbursement-codes` | `적용일자` |  | `data.results.수가코드목록` | index.js:101015 |
| `GET` | `/settings/sanjae-insurances/herbal-decoctions` |  |  | `data.results.병원산재한방첩약` | index.js:44537 |
| `POST` | `/settings/sanjae-insurances/herbal-decoctions` |  |  |  | index.js:44547 |
| `PATCH` | `/settings/sanjae-insurances/herbal-decoctions/{param}` |  | `id` |  | index.js:44544 |
| `DELETE` | `/settings/sanjae-insurances/herbal-decoctions/{param}` |  |  |  | index.js:44550 |
| `GET` | `/settings/templates` |  |  | `data.results.병원상용구` | index.js:44717 |
| `POST` | `/settings/templates` |  | `내용`, `상용구명`, `전체사용여부` | `data.results` | index.js:44718 |
| `PATCH` | `/settings/templates/{param}` |  | `내용`, `상용구명`, `순서` |  | index.js:44723 |
| `DELETE` | `/settings/templates/{param}` |  |  |  | index.js:44726 |
| `GET` | `/settings/treatment-templates` |  |  | `data.results.진료기록상용구` | index.js:44728 |
| `POST` | `/settings/treatment-templates` |  |  | `data.results` | index.js:44733 |
| `PATCH` | `/settings/treatment-templates/{param}` |  |  |  | index.js:44738 |
| `DELETE` | `/settings/treatment-templates/{param}` |  |  |  | index.js:44741 |
| `GET` | `/settings/treatments` |  |  | `data.results.진료설정` | index.js:44477 |
| `PATCH` | `/settings/treatments/{param}` |  |  | `data.results` | index.js:44481 |
| `GET` | `/settings/treatments/auto-record` |  |  | `data.results` | index.js:44503 |
| `PATCH` | `/settings/treatments/auto-record` |  | `시술자동기록여부` | `data.results` | index.js:44504 |
| `GET` | `/settings/treatments/expendables` |  |  | `data.results.병원치료재료대` | index.js:44690 |
| `PATCH` | `/settings/treatments/expendables/{param}` |  | `사용여부` |  | index.js:44695 |
| `GET` | `/settings/treatments/expendables/{param}/histories` |  |  | `data.results.치료재료대구매내역관리` | index.js:44697 |
| `POST` | `/settings/treatments/expendables/{param}/histories` |  | `구매일`, `수량`, `실구매가` |  | index.js:44702 |
| `PATCH` | `/settings/treatments/expendables/{param}/histories/{param}` |  | `구매일`, `사용여부`, `수량`, `실구매가` |  | index.js:44709 |
| `DELETE` | `/settings/treatments/expendables/{param}/histories/{param}` |  |  |  | index.js:44715 |
| `GET` | `/settings/treatments/rooms` |  |  | `data.results.치료실설정` | index.js:44507 |
| `POST` | `/settings/treatments/rooms` |  | `베드수`, `치료실명` |  | index.js:44509 |
| `PATCH` | `/settings/treatments/rooms/{param}` |  | `베드수`, `치료실명` |  | index.js:44515 |
| `DELETE` | `/settings/treatments/rooms/{param}` |  |  |  | index.js:44518 |
| `GET` | `/settings/treatments/rooms/memo-categories` |  |  | `data.results.치료실노출메모카테고리` | index.js:44520 |
| `PATCH` | `/settings/treatments/rooms/memo-categories` |  | `치료실노출메모카테고리` | `data.results.치료실노출메모카테고리` | index.js:44521 |
| `GET` | `/settings/treatments/vitals` |  |  | `data.results` | index.js:44571 |
| `PATCH` | `/settings/treatments/vitals/{param}` |  | `사용여부`, `순서` |  | index.js:44576 |
| `GET` | `/settings/visit-pathways` |  |  | `data.results` | index.js:44619 |
| `POST` | `/settings/visit-pathways` |  | `내원경로명` | `data.results` | index.js:44623 |
| `PATCH` | `/settings/visit-pathways/{param}` |  | `내원경로명` | `data.results` | index.js:44627 |
| `DELETE` | `/settings/visit-pathways/{param}` |  |  | `data.results` | index.js:44630 |
| `GET` | `settings/references/simple-extract-mixed` | `date`, `limit`, `offset`, `search_keyword` |  | `data.results.단미엑스혼합제` | index.js:44486 |
| `GET` | `settings/references/simple-extracts` |  |  | `data.results` | index.js:44485 |

### `/signing`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/signing/{id}/finish` |  |  | `data` | ElectronicSignatureView.js:42 |
| `GET` | `/signing/{id}/status` |  |  | `data` | ElectronicSignatureView.js:43 |
| `GET` | `/signing/daily-copayment-ledgers/count` |  |  | `data` | ElectronicSignatureView.js:33 |
| `POST` | `/signing/daily-copayment-ledgers/request` |  | `documentIds`, `end_date`, `signAll`, `start_date` | `data` | ElectronicSignatureView.js:41 |
| `GET` | `/signing/daily-copayment-ledgers/signable` | `next` |  | `data` | ElectronicSignatureView.js:34 |
| `GET` | `/signing/daily-copayment-ledgers/signed` | `next` |  | `data` | ElectronicSignatureView.js:37 |
| `GET` | `/signing/medical-records/count` |  |  | `data` | ElectronicSignatureView.js:22 |
| `GET` | `/signing/medical-records/record/{record_id}` |  |  | `data` | ElectronicSignatureView.js:26 |
| `POST` | `/signing/medical-records/request` |  | `doctorId`, `documentIds`, `end_date`, `signAll`, `start_date` | `data` | ElectronicSignatureView.js:40 |
| `GET` | `/signing/medical-records/signable/{doctor_id}` | `next` |  | `data` | ElectronicSignatureView.js:23 |
| `GET` | `/signing/medical-records/signed` | `next` |  | `data` | ElectronicSignatureView.js:27 |

### `/subscriptions`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/subscriptions/me` |  |  | `data` | CrmContactsView.js:11161 |
| `GET` | `/subscriptions/lite-pro` |  |  | `data` | index.js:58118 |

### `/tablet`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/tablet/consent-document-templates` |  |  | `data.results` | index.js:109790 |
| `POST` | `/tablet/consent-document-templates` |  | `documentType`, `status`, `title`, `variants` | `data.results` | index.js:109791 |
| `PUT` | `/tablet/consent-document-templates/{param}` |  | `documentType`, `status`, `title`, `variants` |  | index.js:109798 |
| `DELETE` | `/tablet/consent-document-templates/{param}` |  |  |  | index.js:109806 |
| `POST` | `/tablet/consent-document-templates/{param}/duplicate` |  |  | `data.results` | index.js:109808 |
| `PATCH` | `/tablet/consent-document-templates/{param}/status` |  | `status` |  | index.js:109812 |
| `POST` | `/tablet/consent-documents/upload` |  | `fileName`, `pageCount` | `data.results` | index.js:109816 |
| `POST` | `/tablet/intake-links` |  |  | `data.results` | index.js:109853 |
| `GET` | `/tablet/photo-requests` | `환자Id` |  | `data.results` | index.js:109855 |
| `POST` | `/tablet/photo-requests` |  | `대상기기Id`, `환자Id` | `data.results` | index.js:109854 |
| `POST` | `/tablet/photo-requests/{param}/cancel` |  |  | `data.results` | index.js:109858 |
| `GET` | `/tablet/questionnaire-templates` |  |  | `data.results` | index.js:109764 |
| `POST` | `/tablet/questionnaire-templates` |  | `questions`, `series`, `status`, `title` | `data.results` | index.js:109765 |
| `PUT` | `/tablet/questionnaire-templates/{param}` |  | `questions`, `series`, `status`, `title` |  | index.js:109772 |
| `DELETE` | `/tablet/questionnaire-templates/{param}` |  |  |  | index.js:109780 |
| `POST` | `/tablet/questionnaire-templates/{param}/duplicate` |  |  | `data.results` | index.js:109782 |
| `PATCH` | `/tablet/questionnaire-templates/{param}/status` |  | `status` |  | index.js:109786 |
| `POST` | `/tablet/questionnaire-templates/upload-images` |  | `imageCount` | `data.results.images` | index.js:109820 |
| `GET` | `/tablet/settings/admin-pin` |  |  | `data.results` | index.js:109876 |
| `PUT` | `/tablet/settings/admin-pin` |  | `PIN` | `data.results` | index.js:109877 |
| `GET` | `/tablet/settings/languages` |  |  | `data.results.languages` | index.js:109864 |
| `PUT` | `/tablet/settings/languages` |  | `languages` | `data.results.languages` | index.js:109865 |
| `GET` | `/tablet/settings/review-links` |  |  | `data.results.리뷰링크` | index.js:109872 |
| `PUT` | `/tablet/settings/review-links` |  | `리뷰링크` | `data.results.리뷰링크` | index.js:109873 |
| `GET` | `/tablet/settings/treatment-items` |  |  | `data.results.진료항목Ids` | index.js:109868 |
| `PUT` | `/tablet/settings/treatment-items` |  | `진료항목Ids` | `data.results.진료항목Ids` | index.js:109869 |
| `GET` | `/tablet/staff/waiting-patients` |  |  | `data.results` | index.js:109859 |

### `/tangjeon`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/tangjeon/dictionaries` |  |  | `data.results.map` | queries.js:614 |
| `GET` | `/tangjeon/dispensary-rooms` |  |  | `data.results.map` | queries.js:613 |
| `GET` | `/tangjeon/herbs` |  |  | `data.results.map` | queries.js:610 |
| `GET` | `/tangjeon/prescription-documents` |  |  |  | queries.js:498 |
| `GET` | `/tangjeon/prescriptions` |  |  |  | queries.js:477 |
| `POST` | `/tangjeon/prescriptions` |  |  |  | queries.js:507 |
| `GET` | `/tangjeon/prescriptions/{param}` |  |  |  | queries.js:492 |
| `PUT` | `/tangjeon/prescriptions/{param}` |  | `복용완료`, `복용종료일`, `메모` |  | queries.js:518, queries.js:538 (+3) |
| `DELETE` | `/tangjeon/prescriptions/{param}` |  |  |  | queries.js:522 |
| `PATCH` | `/tangjeon/prescriptions/{param}/delivery` |  |  |  | queries.js:585 |
| `GET` | `/tangjeon/prescriptions/{param}/histories` |  |  | `data.results.map` | queries.js:495 |
| `GET` | `/tangjeon/prescriptions/{param}/prescription-documents` |  |  | `data.results.map` | queries.js:496 |
| `PATCH` | `/tangjeon/prescriptions/{param}/quantity` |  |  |  | queries.js:592 |
| `PATCH` | `/tangjeon/prescriptions/{param}/status` |  |  |  | queries.js:531 |
| `GET` | `/tangjeon/prescriptions/by-treatment/{param}` |  |  | `data.results.map` | queries.js:505 |
| `POST` | `/tangjeon/prescriptions/from-package` |  |  |  | queries.js:511 |
| `GET` | `/tangjeon/prescriptions/stats` |  |  |  | queries.js:486 |
| `GET` | `/tangjeon/treatment-prescriptions` |  |  | `data.results.map` | queries.js:595 |
| `GET` | `/tangjeon/treatment-prescriptions/{param}/draft` |  |  |  | queries.js:607 |
| `GET` | `/tangjeon/treatment-prescriptions/unregistered` |  |  |  | queries.js:599 |

### `/treatments`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/treatments/actings/needle-removals` |  | `내원Id`, `발침자명` | `data` | constants.js:29 |
| `GET` | `/treatments/actings/needle-removals/{param}` |  |  | `data` | constants.js:32 |
| `GET` | `/treatments/actings/needle-removers` |  |  | `data` | constants.js:28 |
| `GET` | `/treatments/groups` |  |  | `data` | index.js:141825 |
| `POST` | `/treatments/groups` |  | `items`, `그룹명`, `기본그룹여부`, `순서` | `data` | index.js:141826 |
| `PUT` | `/treatments/groups/{param}` |  | `items`, `그룹명`, `기본그룹여부`, `순서` | `data` | index.js:141830 |
| `DELETE` | `/treatments/groups/{param}` |  |  | `data` | index.js:141833 |
| `GET` | `/treatments/patients` |  |  | `data` | constants.js:12 |
| `PUT` | `/treatments/patients/{param}` |  | `치료실베드`, `치료실설정Id` | `data` | constants.js:19 |
| `PATCH` | `/treatments/patients/{param}/status` |  | `치료완료` | `data` | constants.js:26 |
| `GET` | `/treatments/patients/basic` |  |  | `data` | constants.js:13 |
| `PATCH` | `/treatments/procedures/{param}` |  | `duration_sec` | `data` | index.js:141820 |
| `DELETE` | `/treatments/procedures/{param}` |  |  | `data` | index.js:141814 |
| `POST` | `/treatments/procedures/{param}/complete` |  |  | `data` | index.js:141806 |
| `POST` | `/treatments/procedures/{param}/restart` |  |  | `data` | index.js:141802 |
| `POST` | `/treatments/procedures/{param}/start` |  |  | `data` | index.js:141799 |
| `POST` | `/treatments/procedures/{param}/uncomplete` |  |  | `data` | index.js:141811 |
| `POST` | `/treatments/procedures/apply-group` |  | `groupId`, `visitId` | `data` | index.js:141834 |
| `POST` | `/treatments/procedures/from-popover` |  | `treatmentItemConfigId`, `visitId` | `data` | index.js:141816 |
| `POST` | `/treatments/procedures/group/complete` |  | `groupId`, `visitId` | `data` | index.js:141836 |
| `POST` | `/treatments/procedures/group/start` |  | `groupId`, `visitId` | `data` | index.js:141835 |
| `PATCH` | `/treatments/procedures/order` |  | `orderedIds`, `visitId` | `data` | index.js:141815 |
| `GET` | `/treatments/snapshot` |  |  | `data` | index.js:141796 |
| `GET` | `/treatments/timer-config` |  |  | `data` | index.js:141823 |
| `PUT` | `/treatments/timer-config` |  | `items` | `data` | index.js:141824 |

### `/{param}`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `{param}` |  |  | `data.results` | TreatmentViewBoard.js:28231 |
| `PUT` | `{param}` |  |  | `data.results` | TreatmentViewBoard.js:28235 |

## CRM API

Base URL `https://crm-api.example.com` · `crmClient` · 138 endpoints

### `/appointment-notifications`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/appointment-notifications/settings` | `channel` |  | `data.results` | templatePermission.js:1541 |
| `PUT` | `/appointment-notifications/settings` |  | `channel`, `notifications` | `data.results` | templatePermission.js:1546 |

### `/billing`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/billing/invoices{param}` |  |  | `data` | index.js:97468 |
| `GET` | `/billing/invoices/{param}` |  |  | `data` | index.js:97470 |
| `POST` | `/billing/invoices/payments` |  | `invoiceIds`, `paymentMethodId` | `data` | index.js:97476 |
| `GET` | `/billing/invoices/unit-prices` |  |  | `data` | index.js:97474 |
| `GET` | `/billing/payment-methods` |  |  | `data` | index.js:97471 |
| `GET` | `/billing/payment-methods/default` |  |  | `data` | index.js:97472 |
| `PUT` | `/billing/payment-methods/default` |  | `billingTaxInvoiceBusinessName`, `billingTaxInvoiceBusinessNumber`, `billingTaxInvoiceEmail`, `billingTaxInvoiceRepresentativeName`, `depositFallbackEnabled`, `partnerPayId` | `data` | index.js:97473 |

### `/categories`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/categories` | `limit`, `source`, `type` |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:568 |

### `/consult-templates`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/consult-templates/groups` |  | `name` | `data.results` | queries.js:15 |
| `PATCH` | `/consult-templates/groups/{param}` |  | `name` | `data.results` | queries.js:19 |
| `DELETE` | `/consult-templates/groups/{param}` |  |  | `data.results` | queries.js:22 |
| `GET` | `/consult-templates/groups/tree` |  |  | `data.results` | queries.js:12 |
| `POST` | `/consult-templates/templates` |  | `body`, `groupId`, `title` | `data.results` | queries.js:23 |
| `PATCH` | `/consult-templates/templates/{param}` |  | `body`, `groupId`, `title` | `data.results` | queries.js:27 |
| `DELETE` | `/consult-templates/templates/{param}` |  |  | `data.results` | queries.js:30 |
| `POST` | `/consult-templates/templates/by-prescriptions` |  |  | `data.results` | queries.js:31 |

### `/contacts`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/contacts/filters` | `before` |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:432 |
| `POST` | `/contacts/filters` |  | `description`, `filterJson`, `name`, `templateKey` | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:435 |
| `POST` | `/contacts/filters/{id}/use` |  |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:436 |
| `DELETE` | `/contacts/filters/recent-usage` |  |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:437 |
| `GET` | `/contacts/groups` | `offset` |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:414 |
| `GET` | `/contacts/groups/{id}` |  |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:417 |
| `DELETE` | `/contacts/groups/{id}` |  |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:418 |
| `POST` | `/contacts/groups/{param}/members/add` |  | `contactIds` | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:422 |
| `POST` | `/contacts/groups/{param}/members/remove` |  |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:426 |
| `POST` | `/contacts/groups/from-message-send-group` |  | `messageSendGroupId`, `name` | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:428 |
| `POST` | `/contacts/groups/members/add/from-message-send-group` |  | `contactGroupIds`, `messageSendGroupId` | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:427 |
| `GET` | `/contacts/patients` | `offset` |  | `data.results` | CrmCommonExcelUploader.vue_vue_type_script_setup_true_lang.js:429 |

### `/contents`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/contents` |  |  | `data.results` | queries.js:12 |
| `POST` | `/contents` |  | `contentType`, `groupId`, `images`, `sourceUrl`, `title` | `data.results` | queries.js:15 |
| `PATCH` | `/contents/{param}` |  | `groupId`, `isActive`, `title` | `data.results` | queries.js:19 |
| `GET` | `/contents/bundles/{param}` |  |  | `data.results` | queries.js:21 |
| `POST` | `/contents/bundles/{param}/events` |  | `contentId`, `entrySource`, `eventType`, `shareChannel` |  | queries.js:27 |
| `GET` | `/contents/groups` |  |  | `data.results` | queries.js:30 |
| `POST` | `/contents/groups` |  | `name` | `data.results` | queries.js:31 |
| `PATCH` | `/contents/groups/{param}` |  | `name` | `data.results` | queries.js:35 |
| `DELETE` | `/contents/groups/{param}` |  |  | `data.results` | queries.js:36 |
| `POST` | `/contents/scrape` |  | `url` | `data.results` | queries.js:20 |

### `/happycall`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/happycall/templates` |  | `callScript`, `checklist`, `description`, `parentTemplateId`, `parentTemplateType`, `title` | `data` | CrmRoutineCanvasViewCanvas.vue_vue_type_script_setup_true_lang.js:1121 |

### `/kakao`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/kakao/channels` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1418 |
| `POST` | `/kakao/channels` |  | `categoryCode`, `phoneNumber`, `token`, `yellowId` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1417 |
| `GET` | `/kakao/channels/{id}` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1419 |
| `PATCH` | `/kakao/channels/{id}/default` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1421 |
| `GET` | `/kakao/channels/categories` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1420 |
| `POST` | `/kakao/channels/token` |  | `phoneNumber`, `yellowId` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:1416 |

### `/lite-triggers`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/lite-triggers/status` |  |  | `data` | index.js:97594 |

### `/messages`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/messages/caller-numbers` | `before` |  | `data.results` | mutations-4I4S-pty.js:164 |
| `POST` | `/messages/caller-numbers` |  | `attachmentIds`, `callerNumber`, `numberHolder`, `txSeqNo` | `data.result` | mutations-4I4S-pty.js:167 |
| `PATCH` | `/messages/caller-numbers/{param}` |  | `attachmentIds`, `callerNumber`, `isDefault`, `numberHolder`, `txSeqNo` | `data.result` | mutations-4I4S-pty.js:171 |
| `DELETE` | `/messages/caller-numbers/{param}` |  |  | `data.result` | mutations-4I4S-pty.js:174 |
| `POST` | `/messages/delivery-status` |  | `items` | `data.results` | queries.js:63 |
| `GET` | `/messages/kakao-templates/{id}` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:29 |
| `PUT` | `/messages/kakao-templates/{id}/usage` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:42 |
| `GET` | `/messages/kakao-templates/frequently-used` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:41 |
| `DELETE` | `/messages/kakao-templates/private/{id}` |  |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:40 |
| `POST` | `/messages/kakao-templates/private/alimtalk` |  | `groupId`, `parentTemplateId`, `templateData`, `templateName` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:30 |
| `PUT` | `/messages/kakao-templates/private/alimtalk/{param}` |  | `groupId`, `templateData`, `templateName` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:35 |
| `POST` | `/messages/kakao-templates/private/brand` |  | `bizType`, `groupId`, `parentTemplateId`, `templateData`, `templateName` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:31 |
| `PUT` | `/messages/kakao-templates/private/brand/{param}` |  | `groupId`, `templateData`, `templateName` | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:39 |
| `PUT` | `/messages/kakao/alimtalk/groups/{param}` |  | `fallback` | `data.results` | MessageView.js:393 |
| `POST` | `/messages/kakao/alimtalk/patient` |  | `fallback`, `kakaoChannelId`, `kakaoTemplateId`, `messageTitle`, `patientIds`, `reservedAt`, `variables` | `data.results` | queries.js:1886 |
| `POST` | `/messages/kakao/alimtalk/test/manual` |  | `kakaoChannelId`, `kakaoTemplateId`, `receiverNumber`, `variables` | `data.results` | queryKeys.js:24 |
| `PUT` | `/messages/kakao/brand/groups/{param}` |  | `fallback` | `data.results` | MessageView.js:389 |
| `POST` | `/messages/kakao/brand/patient` |  | `attachment`, `bizType`, `carousel`, `content`, `fallback`, `kakaoChannelId`, `messageTitle`, `patientIds`, `reservedAt` | `data.results` | queries.js:1887 |
| `POST` | `/messages/kakao/brand/test/manual` |  | `attachment`, `bizType`, `carousel`, `content`, `kakaoChannelId`, `receiverNumber` | `data.results` | queryKeys.js:25 |
| `POST` | `/messages/links` |  | `fullUrl` | `data.results` | queryKeys.js:12 |
| `GET` | `/messages/patients/{patientId}/template-variables` |  |  | `data.results` | queries.js:1888 |
| `GET` | `/messages/phrases` | `offset` |  | `data.results` | queryKeys.js:19 |
| `POST` | `/messages/phrases` |  | `content`, `name` | `data.results` | queryKeys.js:16 |
| `PATCH` | `/messages/phrases/{id}` |  | `content`, `id`, `name` | `data.results` | queryKeys.js:22 |
| `DELETE` | `/messages/phrases/{id}` |  |  | `data.results` | queryKeys.js:23 |
| `GET` | `/messages/results` |  |  | `data.results` | queries.js:12 |
| `GET` | `/messages/results/{id}/links` |  |  | `data.results` | queries.js:25 |
| `GET` | `/messages/results/{param}/receivers` | `hasFallback`, `hasLinkClicked`, `limit`, `linkId`, `messageStatus`, `offset`, `order`, `searchKeyword`, `withCount` |  | `data.results` | queries.js:29 |
| `GET` | `/messages/results/{param}/receivers/{param}` |  |  | `data.results` | queries.js:56 |
| `GET` | `/messages/results/{param}/receivers/{param}/kakao` |  |  | `data.results` | queries.js:62 |
| `GET` | `/messages/results/{param}/receivers/count` |  |  | `data.results` | queries.js:35 |
| `POST` | `/messages/results/{param}/resend` |  |  | `data.results` | queries.js:51 |
| `PATCH` | `/messages/results/{param}/reservation` |  | `reservedAt` | `data.results` | queries.js:41 |
| `DELETE` | `/messages/results/{param}/reservation` |  |  | `data.results` | queries.js:45 |
| `GET` | `/messages/results/list` | `limit`, `offset`, `order` |  | `data.results` | queries.js:15 |
| `GET` | `/messages/results/list/count` |  |  | `data.results` | queries.js:18 |
| `POST` | `/messages/results/list/download` | `endDate`, `hasFailure`, `hasFallback`, `hasLinkClick`, `messageStatus`, `receiverScope`, `searchKeyword`, `startDate` |  | `data` | queries.js:21 |
| `POST` | `/messages/send` |  | `messageSendGroupId` | `data.results` | queryKeys.js:13 |
| `GET` | `/messages/send/groups` | `limit`, `withReceiversCount` |  | `data.results` | sendGroups.js:12 |
| `POST` | `/messages/send/groups` |  |  | `data.results` | sendGroups.js:21 |
| `GET` | `/messages/send/groups/{param}` | `withCount` |  | `data.results` | sendGroups.js:18 |
| `PUT` | `/messages/send/groups/{param}` |  | `attachmentIds`, `callerNumberId`, `messageText`, `messageTitle`, `messageType`, `reservedAt`, `smsOverflowPolicy` | `data.results` | sendGroups.js:60 |
| `DELETE` | `/messages/send/groups/{param}` |  |  | `data.results` | sendGroups.js:56 |
| `POST` | `/messages/send/groups/{param}/estimate` |  |  | `data.results` | sendGroups.js:70 |
| `DELETE` | `/messages/send/groups/{param}/receivers` |  |  | `data` | sendGroups.js:53 |
| `GET` | `/messages/send/groups/{param}/receivers/count` |  |  | `data.results` | sendGroups.js:64 |
| `GET` | `/messages/send/groups/{param}/receivers/duplicates` | `limit`, `offset`, `withCount` |  | `data.results` | sendGroups.js:77 |
| `POST` | `/messages/send/groups/{param}/receivers/duplicates/handle` |  | `deduplicationMode`, `receiverId` | `data.results` | sendGroups.js:83 |
| `GET` | `/messages/send/groups/{param}/receivers/marketing-consent-undecided` |  |  | `data.results` | sendGroups.js:73 |
| `POST` | `/messages/send/groups/{param}/receivers/remove` |  | `receiverIds` | `data` | sendGroups.js:50 |
| `POST` | `/messages/send/patient` |  | `attachmentIds`, `callerNumberId`, `messageText`, `messageTitle`, `messageType`, `patientIds`, `reservedAt`, `smsOverflowPolicy` | `data.results` | queryKeys.js:17 |
| `POST` | `/messages/send/patients/estimate` |  |  | `data.results` | queryKeys.js:18 |
| `POST` | `/messages/send/test` |  | `messageSendGroupId`, `receiverNumber` | `data.results` | queryKeys.js:14 |
| `POST` | `/messages/send/test/manual` |  | `attachmentIds`, `callerNumberId`, `messageText`, `messageTitle`, `messageType`, `receiverNumber`, `reservedAt` | `data.results` | queryKeys.js:15 |
| `GET` | `/messages/template-groups` |  |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:554 |
| `POST` | `/messages/template-groups` |  | `name` | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:555 |
| `PATCH` | `/messages/template-groups/{param}` |  | `name` | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:559 |
| `DELETE` | `/messages/template-groups/{param}` |  |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:562 |
| `GET` | `/messages/template-library` |  |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:571 |
| `POST` | `/messages/templates` |  | `attachmentIds`, `callerNumber`, `groupId`, `messageText`, `messageTitle`, `messageType`, `parentTemplateId`, `parentTemplateType`, `templateTitle` | `data` | queryKeys.js:253 |
| `DELETE` | `/messages/templates/{id}` |  |  | `data` | queryKeys.js:258 |
| `PATCH` | `/messages/templates/{param}` |  | `attachmentIds`, `callerNumber`, `messageText`, `messageTitle`, `messageType`, `templateTitle` | `data` | queryKeys.js:257 |
| `GET` | `/messages/templates/{templateType}/{id}` |  |  | `data` | queryKeys.js:252 |
| `GET` | `/messages/templates/sources` |  |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:495 |
| `GET` | `/messages/templates/sources/counts` |  |  | `data.results` | CrmTemplateLibraryModal.vue_vue_type_script_setup_true_lang-DOT6-6P9.js:511 |
| `GET` | `messages/send/groups/{param}/receivers` | `limit`, `offset`, `order`, `q` |  | `data.results` | sendGroups.js:25 |
| `POST` | `messages/send/groups/{param}/receivers` |  | `receivers` | `data` | sendGroups.js:31 |
| `POST` | `messages/send/groups/{param}/receivers/add/all` |  |  | `data` | sendGroups.js:34 |
| `POST` | `messages/send/groups/{param}/receivers/add/contact-groups` |  | `contactGroupIds` | `data` | sendGroups.js:42 |
| `POST` | `messages/send/groups/{param}/receivers/add/emr-patients` |  | `emrPatientIds` | `data` | sendGroups.js:46 |
| `POST` | `messages/send/groups/{param}/receivers/add/filters` |  | `filterId`, `filterJson` | `data` | sendGroups.js:38 |

### `/refusals`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/refusals` | `limit`, `offset`, `order`, `refusalType`, `searchKeyword`, `withCount` |  | `data.results` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:15 |
| `POST` | `/refusals` |  | `phones` | `data` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:21 |
| `PATCH` | `/refusals/{param}` |  |  | `data` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:29 |
| `GET` | `/refusals/080` | `limit`, `offset`, `searchKeyword`, `withCount` |  | `data.results` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:18 |
| `GET` | `/refusals/code` |  |  | `data` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:39 |
| `PATCH` | `/refusals/contact/{param}` |  |  | `data` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:25 |
| `POST` | `/refusals/download` | `refusalSource`, `searchKeyword` | `reason` | `data` | CrmCommonMessageEditor.vue_vue_type_script_setup_true_lang.js:33 |

### `/schedulers`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/schedulers` | `before` |  | `data.results` | mutations.js:23 |
| `GET` | `/schedulers/{id}` |  |  | `data.results` | mutations.js:31 |
| `PATCH` | `/schedulers/{param}` |  | `assigneeId`, `description`, `expiredAt`, `isMsgSendingAutomatic`, `noRepeatDays`, `startedAt`, `status`, `title` | `data` | mutations.js:30 |
| `PUT` | `/schedulers/{param}/routines/batch` |  | `create`, `delete`, `update` | `data.results` | mutations.js:39 |
| `GET` | `/schedulers/assignees` |  |  | `data.results` | mutations.js:41 |
| `POST` | `/schedulers/info` |  | `categoryIds`, `description`, `expiredAt`, `medicalTreatmentsId`, `noRepeatDays`, `parentTemplateId`, `startedAt`, `title` | `data.results` | mutations.js:26 |
| `GET` | `/schedulers/search` | `query` |  | `data.results` | mutations.js:18 |
| `GET` | `/schedulers/templates` | `before` |  | `data.results` | mutations.js:32 |
| `GET` | `/schedulers/templates/{id}` |  |  | `data.results` | mutations.js:35 |
| `POST` | `/schedulers/templates/{templateId}/apply` |  |  | `data.results` | mutations.js:40 |

### `/{param}`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `{param}` | `before` |  | `data.results` | CrmKakaoAlimtalkMessagePreview.vue_vue_type_script_setup_true_lang.js:20, CrmRoutineCanvasViewCanvas.vue_vue_type_script_setup_true_lang.js:1117 (+1) |
| `POST` | `{param}` |  | `format`, `name`, `size` |  | attachments-CRa-dBXP.js:53 |

## Insurance API

Base URL `https://insurance-api.example.com` · `insuranceClient` · 37 endpoints

### `/emr`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/emr/patients/{param}/latest-lookup` |  |  | `data.data` | benefitCalculator.js:131 |

### `/hospital`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/hospital/claim-migration/jobs` |  | `claimAccessToken` | `data.data` | InsuranceInquiryView.js:1434 |
| `POST` | `/hospital/claim-migration/jobs/{param}/cancel` |  |  | `data.data` | InsuranceInquiryView.js:1437 |
| `POST` | `/hospital/claim-migration/jobs/{param}/confirm` |  |  | `data.data` | InsuranceInquiryView.js:1436 |
| `GET` | `/hospital/claim-migration/jobs/current` |  |  | `data.data` | InsuranceInquiryView.js:1435 |
| `GET` | `/hospital/payment-methods` |  |  | `data.data` | handler.js:21 |
| `POST` | `/hospital/payment-methods` |  |  | `data.data` | handler.js:23 |
| `PUT` | `/hospital/payment-methods` |  |  | `data.data` | handler.js:24 |
| `DELETE` | `/hospital/payment-methods` |  |  | `data.data` | handler.js:25 |
| `GET` | `/hospital/payment-methods/partner-pay` |  |  | `data.data` | handler.js:22 |
| `GET` | `/hospital/settings/channels` |  |  | `data.data` | benefitCalculator.js:119 |
| `PATCH` | `/hospital/settings/channels` |  | `linkSendChannel` | `data.data` | benefitCalculator.js:120 |
| `GET` | `/hospital/settings/treatment-visibility` |  |  | `data.data` | benefitCalculator.js:121 |
| `PATCH` | `/hospital/settings/treatment-visibility` |  | `chubyakHideGen5` | `data.data` | benefitCalculator.js:122 |
| `GET` | `/hospital/terms` |  |  | `data.data` | benefitCalculator.js:127 |
| `POST` | `/hospital/terms/agreements` |  | `termsIds` | `data.data` | benefitCalculator.js:128 |

### `/indemnity`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/indemnity/patients/{param}/lookup-links` |  |  | `data` | benefitCalculator.js:118 |
| `POST` | `/indemnity/patients/{param}/lookups` |  |  | `data` | benefitCalculator.js:124 |
| `POST` | `/indemnity/patients/{param}/lookups/cancel` |  |  | `data` | benefitCalculator.js:126 |
| `POST` | `/indemnity/patients/{param}/verifications` |  |  | `data` | benefitCalculator.js:123 |
| `POST` | `/indemnity/patients/{param}/verifications/resend` |  |  | `data` | benefitCalculator.js:125 |
| `GET` | `/indemnity/qr` |  |  | `data` | benefitCalculator.js:130 |
| `POST` | `/indemnity/qr` |  |  | `data` | benefitCalculator.js:129 |

### `/patients`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/patients` | `offset` |  | `data` | benefitCalculator.js:107 |
| `POST` | `/patients` |  |  | `data` | benefitCalculator.js:114 |
| `GET` | `/patients/{param}` |  |  | `data` | benefitCalculator.js:110 |
| `PATCH` | `/patients/{param}` |  |  | `data` | benefitCalculator.js:115 |
| `DELETE` | `/patients/{param}` |  |  | `data` | benefitCalculator.js:116 |
| `POST` | `/patients/{param}/claim` |  |  | `data` | benefitCalculator.js:117 |
| `GET` | `/patients/search` | `limit`, `name`, `offset` |  | `data` | benefitCalculator.js:111 |

### `/plans`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/plans` |  |  | `data.data` | handler.js:20 |

### `/subscriptions`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/subscriptions` |  |  | `data.data` | handler.js:12 |
| `PATCH` | `/subscriptions` |  | `planId` | `data.data` | handler.js:13 |
| `POST` | `/subscriptions/cancel` |  |  | `data.data` | handler.js:17 |
| `DELETE` | `/subscriptions/cancel` |  |  | `data.data` | handler.js:18 |
| `GET` | `/subscriptions/change-preview` | `plan_id` |  | `data.data` | handler.js:14 |
| `GET` | `/subscriptions/usage` |  |  | `data.data` | handler.js:19 |

## Account API

Base URL `https://auth-api.example.com/api` · `accountClient` · 35 endpoints

### `/auth`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/auth/check-username` |  | `아이디` | `data` | index.js:106434 |
| `GET` | `/auth/mcp-tokens` |  |  |  | MCPTokens.js:15 |
| `POST` | `/auth/mcp-tokens` |  |  |  | MCPTokens.js:16 |
| `DELETE` | `/auth/mcp-tokens/{param}` |  |  |  | MCPTokens.js:17 |

### `/change-requests`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/change-requests` |  |  | `data.results` | index.js:106209 |
| `POST` | `/change-requests` |  | `요청값`, `요청출처`, `이미지경로`, `이미지파일명`, `인증타입` | `data.results` | index.js:106204 |
| `GET` | `/change-requests/{param}/document` |  |  | `data.results` | index.js:106214 |
| `POST` | `/change-requests/documents` |  | `이미지파일명` | `data.results` | index.js:106201 |

### `/images`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/images` |  | `이미지명`, `이미지사이즈` | `data.results` | index.js:106433 |

### `/integrations`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/integrations/members/subscribers` |  |  |  | MembersView-TlIGWe5-.js:106 |
| `POST` | `/integrations/lite/link` |  | `migration` | `data` | liteSignUp.js:21 |

### `/permissions`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/permissions` |  |  | `data.results` | index.js:106420 |
| `PATCH` | `/permissions` |  |  | `data.message` | index.js:106425 |

### `/tablet`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/tablet/accounts` |  |  | `data.results` | queries.js:51 |
| `POST` | `/tablet/accounts` |  | `비밀번호`, `아이디` | `data.results` | queries.js:52 |
| `PATCH` | `/tablet/accounts/{param}` |  | `비밀번호` | `data.results` | queries.js:58 |
| `DELETE` | `/tablet/accounts/{param}` |  |  | `data.results` | queries.js:60 |
| `GET` | `/tablet/sessions` |  |  | `data.results` | queries.js:61 |
| `DELETE` | `/tablet/sessions` |  |  | `data.results` | queries.js:62 |
| `DELETE` | `/tablet/sessions/{param}` |  |  | `data.results` | queries.js:63 |

### `/terms`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/terms/agreements` |  | `약관동의목록` |  | MembersRetroTermsGate-B0hM4-tr.js:370, useUnifiedTermsGate.js:24 |
| `GET` | `/terms/documents` | `type` |  | `data.documents` | useUnifiedTermsGate.js:18 |
| `GET` | `/terms/hospital-agreements` | `type` |  | `data` | useUnifiedTermsGate.js:13 |
| `GET` | `/terms/my-agreements` | `service`, `serviceOnly`, `type` |  | `data` | MembersRetroTermsGate-B0hM4-tr.js:366, liteSignUp.js:31 |
| `PUT` | `/terms/optional-agreements` |  | `약관동의목록` | `data` | liteSignUp.js:36 |

### `/users`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/users` |  |  |  | index.js:106375 |
| `POST` | `/users` |  | `근무형태`, `입사일자`, `휴대폰번호` | `data.results` | index.js:106389 |
| `PATCH` | `/users/{param}` |  | `근무형태`, `입사일자`, `프로필이미지Id` | `data.messages` | index.js:106396 |
| `DELETE` | `/users/{param}` |  |  | `data.messages` | index.js:106390 |
| `PATCH` | `/users/{param}/deactivate` |  | `비활성화시작일자` | `data.results` | index.js:106431 |
| `POST` | `/users/{param}/password` |  |  | `data.results` | index.js:106403 |
| `POST` | `/users/{param}/stamp` |  | `이미지명`, `이미지사이즈` | `data.results` | index.js:106410 |
| `DELETE` | `/users/{param}/stamp` |  |  | `data.message` | index.js:106416 |

### `/verify`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/verify/confirm-otp` |  | `otpNo`, `telNo`, `txSeqNo` | `data.results` | CrmCommonIdentityVerificationModal.vue_vue_type_script_setup_true_lang.js:15 |
| `POST` | `/verify/request-otp` |  |  | `data.results` | CrmCommonIdentityVerificationModal.vue_vue_type_script_setup_true_lang.js:14 |

## Account Application API

Base URL `https://auth-api.example.com/api` · `accountApplicationClient` · 19 endpoints

### `/account-application`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/account-application/applications` |  |  | `data.results` | accountApplications.js:22 |
| `POST` | `/account-application/applications` |  |  | `data` | accountApplications.js:21 |
| `PUT` | `/account-application/applications` |  |  | `data` | accountApplications.js:23 |
| `PUT` | `/account-application/applications/cancel` |  |  | `data` | accountApplications.js:24 |
| `PUT` | `/account-application/applications/supplement` |  | `사업자정보` | `data` | accountApplications.js:28 |
| `GET` | `/account-application/business-license` |  |  | `data.results` | accountApplications.js:25 |
| `POST` | `/account-application/images` |  | `이미지명`, `이미지사이즈` | `data.results` | accountApplications.js:26 |
| `POST` | `/account-application/token` |  | `sso_token` | `data` | accountApplications.js:20 |

### `/auth`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/auth/check-ssoid` |  |  | `data` | queries-LDUrHI-9.js:15, liteSignUp.js:24 |
| `POST` | `/auth/check-username-onboarding` |  | `아이디` | `data` | accountApplications.js:27, liteSignUp.js:22 |

### `/integrations`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/integrations/members` |  |  | `data` | AccountApplicationsAuth.js:92 |
| `POST` | `/integrations/onboarding/insurance/signup` |  |  | `data` | liteSignUp.js:18 |
| `GET` | `/integrations/onboarding/lite/employees` |  |  | `data.subUsers` | liteSignUp.js:23 |
| `GET` | `/integrations/onboarding/lite/profile` |  |  | `data` | liteSignUp.js:14 |
| `POST` | `/integrations/onboarding/lite/signup` |  | `병원명`, `비밀번호`, `사업자등록번호`, `아이디`, `약관동의목록`, `이름`, `주소`, `휴대폰번호` | `data` | liteSignUp.js:15 |
| `GET` | `/integrations/onboarding/wontang/profile` |  |  | `data` | queries-LDUrHI-9.js:16 |
| `POST` | `/integrations/onboarding/wontang/signup` |  | `비밀번호`, `아이디`, `약관동의목록` | `data` | queries-LDUrHI-9.js:23 |
| `GET` | `/integrations/lite` |  |  | `data` | liteSignUp.js:13 |

### `/terms`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/terms` | `type`, `service` |  | `data` | accountApplications.js:29, queries-LDUrHI-9.js:17 (+1) |

## Lite API

Base URL `https://lite-api.example.com` · `liteClient` · 12 endpoints

### `/members`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/members/emr/clinics/check-local` | `localHomeId` |  |  | index.js:75471 |
| `GET` | `/members/emr/clinics/my` |  |  |  | index.js:75465 |
| `PATCH` | `/members/emr/clinics/my` |  |  |  | index.js:75481 |
| `POST` | `/members/emr/clinics/my/profile` |  |  |  | index.js:75487 |
| `POST` | `/members/emr/clinics/my/signup-telemedicine` |  | `accountNumber`, `accountOwnerName`, `bankCode`, `bankName`, `localHomeId`, `naverPlaceLink`, `operationHours` |  | index.js:75497 |
| `GET` | `/members/emr/in-person-consultations/{param}/dm-schedules` |  |  | `data` | TreatmentViewBoardRecordsList.vue_vue_type_script_setup_true_lang.js:792 |
| `GET` | `members/emr/consultations/orders/{param}/invoice` |  |  |  | index.js:75509 |
| `PATCH` | `members/emr/consultations/orders/{param}/shipping-info` |  |  |  | index.js:75515 |
| `PATCH` | `members/emr/consultations/orders/{param}/shipping-method` |  |  |  | index.js:75521 |
| `PATCH` | `members/emr/consultations/orders/{param}/visit-schedule` |  |  |  | index.js:75527 |
| `GET` | `members/emr/orders/{param}` |  |  |  | index.js:75503 |

### `/settlement`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/settlement/emr/settlements` | `month`, `year` |  | `data.data` | RemoteSettlementView.js:24 |

## static data CDN

Base URL `https://static.example.com/emr/master` · `staticClient` · 11 endpoints

### `/herbalApplicableDiseases`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `herbalApplicableDiseases/20241227.json` |  |  | `data` | index.js:101012 |

### `/jaboHerbalComponents`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `jaboHerbalComponents/20250116.json` |  |  | `data` | index.js:101013 |

### `/jaboHerbalEffects`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `jaboHerbalEffects/20241105.json` |  |  | `data` | index.js:101008 |

### `/jaboReimbursement`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `jaboReimbursement/20250108.json` |  |  | `data` | index.js:101007 |
| `GET` | `jaboReimbursement/20260101.json` |  |  | `data` | index.js:101007 |

### `/jaboSyndromes`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `jaboSyndromes/20241105.json` |  |  | `data` | index.js:101009 |

### `/kcd`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `kcd/20250722.json` |  |  | `data` | index.js:101006 |
| `GET` | `kcd/20260101.json` |  |  | `data` | index.js:101006 |

### `/koicd`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `koicd/20240829.json` |  |  | `data` | index.js:101005 |
| `GET` | `koicd/20260101.json` |  |  | `data` | index.js:101005 |

### `/rareDiseases`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/rareDiseases/20241018.json` |  |  | `data` | index.js:101010 |

## same-origin web API

Base URL `(same origin)` · `webClient` · 10 endpoints

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/api/bot-feedback` |  | `product` | `data` | index.js:97723 |
| `GET` | `/api/bot-loading-tips` | `product`, `role` |  | `data` | index.js:97719 |
| `GET` | `/api/bot-stream-url` |  |  | `data` | index.js:97706 |
| `POST` | `/api/channeltalk/beta-chat` |  | `product` | `data` | index.js:97700 |
| `POST` | `/api/channeltalk/beta-consent` |  | `product`, `version` | `data` | index.js:97707 |
| `GET` | `/api/channeltalk/beta-convo` | `sessionId` |  | `data` | index.js:97714 |
| `GET` | `/api/channeltalk/beta-convos` | `limit` |  | `data` | index.js:97709 |
| `POST` | `/api/channeltalk/beta-handoff-click` |  | `from`, `sessionId` | `data` | index.js:97727 |
| `GET` | `/api/channeltalk/beta-me` |  |  | `data` | index.js:97708 |
| `POST` | `/api/channeltalk/beta-upload` |  | `contentType`, `dataBase64`, `filename` | `data` | index.js:97722 |

## Auth API

Base URL `https://auth-api.example.com/api/auth` · `authClient` · 7 endpoints

### `/login`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/login` |  | `비밀번호`, `아이디` | `data.results` | index.js:44069 |

### `/sso`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/sso/exchange` |  | `linkToken` | `data.results` | index.js:44071 |
| `POST` | `/sso/link-token` |  | `refreshToken`, `sub` | `data.results.linkToken` | index.js:48442 |
| `POST` | `/sso/partner/token` |  | `code` | `data.results` | index.js:44072 |

### `/token`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/token/refresh` |  |  | `data.results` | index.js:44070 |

### `/unlock`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/unlock/confirm-otp` |  | `아이디`, `인증거래번호`, `인증번호`, `휴대폰번호` | `data.results` | AccountUnlockView.js:181 |
| `POST` | `/unlock/request-otp` |  |  | `data.results` | AccountUnlockView.js:180 |

## BI API

Base URL `https://public-api.example.com/bi` · `biClient` · 5 endpoints

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/api/surachal/cohort` |  |  |  | index.js:71198 |
| `GET` | `/api/surachal/me` | `cohort_no` |  |  | index.js:71204 |
| `GET` | `/api/surachal/progress` | `cohort_no` |  |  | index.js:71214 |
| `GET` | `/api/surachal/submissions` | `assignment_seq`, `cohort_no`, `participant_pk` |  |  | index.js:71237 |
| `POST` | `/api/surachal/submissions` |  | `assignment_seq`, `cohort_no`, `content`, `image_keys` |  | index.js:71249 |

## Sync API

Base URL `https://sync-api.example.com/v1` · `syncClient` · 4 endpoints

### `/notification-center`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/notification-center/counts` |  |  | `data.data` | index.js:83453 |

### `/quick-messages`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `POST` | `/quick-messages` |  | `content`, `roomId`, `type` | `data.data` | index.js:83459 |
| `GET` | `/quick-messages/recent-channel` | `type` |  | `data.data.roomId` | index.js:83454 |

### `/rooms`

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/rooms` |  |  | `data.data.rooms` | index.js:83452 |

## SSO API

Base URL `https://sso-api.example.com/` · `ssoClient` · 1 endpoint

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/marketing-agreement/terms/list` | `domain` |  | `data` | TermsContentView.js:16 |

## Juso address API

Base URL `https://business.juso.go.kr/addrlink/addrLinkApi.do` · `jusoClient` · 1 endpoint

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `(base URL)` | `confmKey`, `keyword`, `resultType` |  | `data.results` | index.js:87207 |

## Portal API

Base URL `https://public-api.example.com/portal` · `portalClient` · 1 endpoint

| Method | Path | Query | Body | Response | Location |
|---|---|---|---|---|---|
| `GET` | `/v1/banners` |  |  | `data.items` | index.js:96953 |

## Non-axios channels

### Direct `fetch`

| Method | URL | Notes |
|---|---|---|
| `POST` | `{bot stream url}` | URL comes from `GET /api/bot-stream-url` (same origin) → `{ url, enabled }`. Sends `Authorization: Bearer`, body `{ product, ... }`. Streaming chatbot answer. |
| `PUT` | `{signed url}` | Direct-to-storage upload with explicit `Content-Type`. The API first returns `signedUrl` / `originSignedUrl` / `thumbnailSignedUrl` (e.g. `POST /tablet/consent-documents/upload`, `POST /tablet/questionnaire-templates/upload-images`, canvas and onboarding uploads). Sites: `index.js`, `attachments-CRa-dBXP.js:58`, `CanvasView.js:320`, `OnboardingView.js:868`. |
| `GET` | `{signed url}` | Downloads of stored images / files from signed URLs (`CanvasView.js:284`, `image.js:12`, `ClaimHiraView.js:2889`, `TreatmentViewBoardRecordsList…-BhuZ6DBm.js:545`). |

### Local notification arbiter (`http://127.0.0.1:{47821|47822|47823}`)

Coordinates alert ringing across multiple open EMR tabs/apps on the same machine. Ports are tried in order; client id is kept in `localStorage["emr:alert-arbiter-client-id"]`. In Electron it uses `window.electronAPI.notificationArbiter` instead.

| Method | Path | Body |
|---|---|---|
| `POST` | `/v1/decide` | `key`, `clientId`, `late` |
| `GET` | `/v1/status` | |
| `POST` | `/v1/web-focus` | `clientId`, ... |

### Other local endpoints

| URL | Notes |
|---|---|
| `http://localhost:65001` | axios instance created but never assigned or called — dead code in this build; purpose not determinable statically. |
| `http://localhost:4747` | Passed as the `endpoint` prop to a conditionally rendered component in the app shell. |

### WebSocket — Socket.IO `https://socket.example.com`

Auth token via `getAuthToken` (same access token). All traffic uses the single Socket.IO `message` event with a `{ type, payload }` envelope; the client store dispatches it to `subscribe(type, handler)` listeners.

| Message `type` | Effect in client |
|---|---|
| `ACTION_WAITING` | Refresh waiting list |
| `ACTION_APPOINTMENT` | Refresh appointments |
| `ACTION_APPOINTMENT_PLANNER` | Refresh appointment planner |
| `ACTION_TREATMENT` | Refresh treatment lists |
| `ACTION_RECEIPT` | Refresh receipt for `payload.date`, `환자Id`, `수납Id` |
| `ACTION_RECORD` | Refresh records for `환자Id` + `진료Id` / `진료Ids`, invalidate record queries |
| `ACTION_MEMO` | Invalidate patient memos, refresh for `payload.date` |
| `ACTION_PATIENT_PHOTO` | Invalidate patient photo / info queries for `환자Id` |
| `LITE_MIGRATION_COMPLETE` | Lite → 현행 EMR migration finished (`payload.payload.payload.success`); invalidates all queries |
