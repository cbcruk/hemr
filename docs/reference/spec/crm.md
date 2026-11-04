# CRM·메시지

환자에게 문자(SMS/LMS/MMS)와 카카오톡(알림톡·브랜드 메시지)을 보내고 결과를 추적하는 영역입니다. 비급여 처방 환자 관리, 복용관리 연락 일정(연락 목록·트리거 엔진), 상담 스크립트, 수신거부, 발신번호·채널·템플릿·콘텐츠 설정을 포함합니다.
API는 대부분 `crmClient`(메시지·템플릿·수신거부·콘텐츠)와 `emrClient`(`/crm/*` 환자·연락 일정·트리거 엔진)로 나뉩니다.

## 공통

- **컨테이너:** `/crm`의 자식 라우트는 모두 `CrmView` 안에서 렌더링됩니다. `CrmView`는 `KeepAlive :max="3"`로 자식을 캐시하되 `MessageView`는 캐시에서 제외합니다.
- **페이지 권한(`l0e`):** `route.matched`에서 현재 path와 같은 레코드의 `meta.permissionCode`·`permissionRequired`를 읽고, 권한 로딩 중에는 스피너, 권한이 없으면 "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."를 보여줍니다. `meta`가 없는 자식(`crm-nonbenefit-patients`)은 페이지 권한 검사를 건너뜁니다.
- **약관 게이트(`useUnifiedTermsGate`의 `ze`):** `GET accountClient /terms/hospital-agreements`(queryKey `["unifiedTerms","verdict"]`, `staleTime: 0`)의 응답으로 `gateStatus`를 정합니다.

| `gateStatus` | 조건 | 화면 |
|---|---|---|
| `loading` | 요청 중 | `BrandDotLoader` |
| `error` | 오류 또는 데이터 없음 | "약관 정보를 불러오지 못했습니다" + 다시 시도(refetch) |
| `passed` | `hasDirector`가 거짓이거나, 다시 동의해야 할 필수 약관이 없음 | 자식 라우트 |
| `consent` | 다시 동의해야 할 필수 약관이 있고 `canAgree` | `UnifiedTermsConsentScreen` |
| `waiting` | 다시 동의해야 할 필수 약관이 있고 `canAgree`가 거짓 | `UnifiedTermsWaitingScreen` (새로고침 = refetch) |

  - 다시 동의해야 하는 약관: `currentRevision`이 있고, 게시일(`currentPublishedDate`)이 오늘(Asia/Seoul) 이전이며, 미동의이거나 `agreedRevision < currentRevision`인 경우입니다. 대상 문서 3종은 개인정보 제3자 제공 동의, 개인정보 처리방침, 서비스 이용약관입니다.
- **발신 인증 배너:** `SendAuthNoticeBanner`가 문자 보내기(`위치="문자보내기"`)와 연락 일정(`위치="연락일정"`) 화면 위에 붙습니다.
- **공통 queryKey 루트:** `crmKeys.all = ["crm"]`. 하위 키는 `["crm","messages",…]`(발송 그룹), `["crm","messageResults",…]`(전송 결과), `["crm","refusals"]`, `["crm","contents"]`, `["crm","consultTemplates"]`, `["crm","liteTriggers",…]`, `["crm","callerNumbers"]`, `["crm","templates","messageTemplates"]`, `["patientMessageSend"]`(환자별 개별 발송)입니다.
- **스토어:** `/crm` 화면은 대부분 `useToastNotificationStore`만 씁니다. 그 밖에는 `useOnboardingGuideSessionStore`(`/crm/message`, `/setting/caller-numbers`)와 `useCrmMessageResultLinksStore`(`/crm/message/results`)가 있습니다.
- **근거:** `re-upstream/restored/views/CrmView.vue`, part-196.js (`l0e`) (`re-upstream/restored/lib/index/part-196.js`), `re-upstream/restored/lib/useUnifiedTermsGate/part-1.js`, `re-upstream/restored/api/unified-terms/query-keys.js`, `re-upstream/restored/router/routes.js`, `re-upstream/restored/api/crm/query-keys.js`

## 메시지 유형·채널

| 채널(`platformType`) | `messageType` | 세부 유형 | 판정·제한 |
|---|---|---|---|
| 문자(`message`) | `광고` / `알림` (그 밖의 값은 `광고`로 바꿈) | `sms` 단문 | 첨부·제목이 없고 본문이 90byte 이하 |
| | | `lms` 장문 | 제목이 있거나 본문이 90byte를 넘음 (최대 2000byte) |
| | | `mms` 그림 | 첨부(`attachments`)가 1개 이상 |
| 카카오톡(`kakao`) | `광고` | 브랜드 메시지(`kakaoMessageOptions.type: "brand"`) | `bizType`: `FI` 기본형(`FT`도 기본형으로 표시), `FC` 캐러셀 피드형 |
| | `알림` | 알림톡(`type: "alimtalk"`) | `kakaoTemplateId`와 `variables`가 필수 |

- **광고 문구:** `광고`이면 미리보기와 전송 본문이 `(광고) {병원명}` + 본문 + `무료거부: {080 번호}` / `인증: {hospitalRefusalCode}` 형식이 됩니다(`yt`). 저장된 본문에서 이 머리말과 꼬리말을 떼어내는 함수는 `F`입니다.
- **야간 제한(`Da`/`jn`):** `광고`는 20:50–08:00에 즉시 발송할 수 없고, 이 시간대로 예약할 수도 없습니다. 이때 경고 배너를 띄우고 테스트 전송 버튼을 막습니다.
- **장문 자동 전환(`smsOverflowPolicy`):** 기본값은 `upgrade_lms`로, 변수 치환 후 90byte를 넘는 수신자에게 장문으로 보냅니다. `exclude`로 끄면 단문으로만 보내고 90byte를 넘는 수신자는 제외합니다.
- **카카오 대체 발송:** 그룹을 저장할 때 `fallback` 필드를 함께 보내고, 결과 화면에서는 "문자로 대체 전송" 상태로 표시합니다.
- **근거:** `re-upstream/restored/modules/CrmMessagePreview/part-1.js`, `re-upstream/restored/modules/queries/useMessagesPatientsTemplateVariablesByPatientIdQuery.js`, `re-upstream/restored/components/crm/CrmKakaoBrandMessageTypeSelector.vue`, `re-upstream/restored/components/message/MessageViewSend.vue`

## 메시지 변수 치환

- **문법:** `#{변수명}`. 변수명에는 영문·숫자·한글·`_`·공백을 쓸 수 있습니다(`/#{([a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_ ]+)}/g`).
  - `h(text, vars)`가 치환하고, 값이 없는 변수는 그대로 남깁니다.
  - 편집기 미리보기(`w`)는 `환자명`=예시 이름, `예약일시`=현재 시각으로 채우고 byte 수를 셉니다(`k`).
- **자동 치환되지 않는 변수:** 발송 확인 모달에 `nonAutoReplaceVariables`(`ye(본문)`)로 넘겨 경고합니다. 수신자 전원이 변수 미충족으로 제외되면 서버가 `code: "ME_변수미충족수신자전원제외"`를 돌려주고, 화면은 수신자 영역에 `variableNotSatisfied` 오류를 표시합니다.
- **수신자별 변수:**
  - 문자: `GET /messages/results/{groupId}/receivers/{receiverId}`의 `variables`
  - 브랜드 메시지: `GET …/receivers/{receiverId}/kakao`의 `variables`
  - 알림톡: 템플릿 변수(`alimtalkVariables`)를 따로 관리합니다.
  - 환자 단위: `GET crmClient /messages/patients/{patientId}/template-variables`
- **단축 링크:** 본문의 단축 URL은 저장 전에 5자 코드로 정규화(`R`)하고, 불러올 때 복원(`I`)합니다. 링크는 `POST /messages/links`로 만듭니다.
- **상담 스크립트:** 템플릿 본문을 `{...log.hospital_input_variables, ...환자 template-variables}`로 치환한 뒤 문자나 카카오톡 발송으로 넘깁니다.
- **근거:** `re-upstream/restored/modules/message.js`, `re-upstream/restored/views/MessageView.vue`, `re-upstream/restored/components/crm/CrmConsultScriptTemplatePane.vue`

## 고객관리 컨테이너 — `/crm` (`crm`)
- **목적:** CRM 하위 화면의 공통 틀(권한 검사·약관 게이트·KeepAlive)입니다.
- **접근 조건:** `requiresAuth`, `usesGlobalLayout`, `permissionCode: 고객관리`(`crm`), `permissionRequired`.
- **화면 구성:** `CrmView` → `LoadingBoxWithSpinner` / `BrandDotLoader` / `UnifiedTermsConsentScreen` / `UnifiedTermsWaitingScreen` / `RouterView` / `AccessDeniedNotice`.
- **동작:** "공통" 절의 표를 참고하세요. `/crm` 자체에는 기본 자식이나 리다이렉트가 없습니다.
- **데이터:** `GET accountClient /terms/hospital-agreements` → `hasDirector`, `canAgree`, `terms[]`(`documentNumber`, `currentRevision`, `agreedRevision`, `agreed`, `required`, `currentPublishedDate`).
- **상태 저장:** queryKey `["unifiedTerms","verdict"]`.
- **근거:** `re-upstream/restored/views/CrmView.vue`

## 비급여 환자 관리 — `/crm/nonbenefit-patients` (`crm-nonbenefit-patients`)
- **목적:** 비급여 처방(일반 처방·패키지)을 받은 환자의 복용 경과를 관리하고, 연락·문자·관리 종료를 처리합니다. 수 비대면 진료 접수도 이 화면에서 다룹니다.
- **접근 조건:** 자식 `meta`가 없어 부모 `/crm`(`고객관리`) 조건만 적용됩니다. 로그인 후 기본 화면을 정할 때 `soo` 연동이거나 `chartLayout`이 `light`이면 이 화면으로 갑니다(docs/access-control.md). "비대면 진료 참가" 버튼은 `isSooPro && !isTelemedicineRegistered`일 때만 보입니다.
- **화면 구성:** `BaseTabBar`(`관리중`(건수 배지) / `종료`), `NonBenefitPatientsViewTelemedicineBanner`, `NonBenefitPatientsViewToolbar`, `NonBenefitPatientsViewMain`→`NonBenefitPatientsViewTable`(처방명·처방상태·횟수·메모 셀), 선택 시 하단 액션 바, `NonBenefitPatientsViewCancelledTelemedicineModal`, `NonBenefitPatientsViewTelemedicineModal`, `CrmPatientMessageSendSidePanel`, `TelemedicineSignupWizard`/`TelemedicineSignupIntroModal`.
- **동작:**
  - **목록:** `GET emrClient /crm/nonbenefit-patients`를 `limit`/`offset`로 `hasMore`가 거짓이 될 때까지 반복 호출합니다.
  - **필터·정렬(클라이언트):** 처방명 그룹 필터, 처방 경과일 범위(관리중), 진료일 범위(종료), `예약없음`, `연락없음`(2주 내), 진료의, 검색어, 정렬 `가까운 예약일순`.
  - **처방 상태 표시:**
    - 일반: `처방 N일차` 또는 `상담 N일차`. 비대면이면 비대면 진료 상태 라벨을 함께 표시합니다.
    - 패키지: `ACTIVE`=처방 N일차/진행중, `EXPIRED`=만료, `TERMINATE`=종료.
  - **문자 보내기(다중 선택):** 새 창을 먼저 연 뒤 다음 순서로 진행합니다. 팝업이 차단되면 오류 토스트를 띄웁니다.
    1. `POST crmClient /messages/send/groups`
    2. `POST …/receivers/add/emr-patients`(`emrPatientIds`)
    3. `GET …/receivers/count`를 최대 10회 폴링합니다.
    4. 새 창에서 `/crm/message?group-id=…`로 이동합니다.
  - **개별 문자:** 행 액션 → `CrmPatientMessageSendSidePanel`(`POST /messages/send/patient` 등).
  - **처방 관리 종료 / 다시 진행:** `PATCH emrClient /crm/nonbenefit-patients/terminate` · `/restart`(`비급여처방관리Ids`).
  - **엑셀 다운로드:** 전체를 다시 조회하고 필터를 적용한 뒤 xlsx로 저장합니다(파일명 `비급여현황_{탭}_{yyyyMMdd_HHmm}.xlsx`).
  - **비대면:** 접수 배너 → 진료 시작 / 접수 정보 보기 / 취소·환불입니다. `GET /desk/appointments/telemedicine`, `…/cancelled`, `PATCH /desk/telemedicine-consultations/{id}/status`, `thesooClient members/upstream/orders/{id}`를 씁니다.
- **데이터:** `GET /crm/nonbenefit-patients` → `patients[]`(`환자Id`, `유형`(`일반`|패키지), `처방명`/`패키지명`, `진료일자`, `최근시술일`, `패키지상태`, `현재회차`/`총회차`, `사용횟수`/`총횟수`, `비대면진료상태`, `비급여처방관리Id(s)`, `예약일시`), `hasMore`. 그 밖에 `GET /settings/nonbenefits/v2`, `GET /patients/{id}/memos`, `POST /patients/{pid}/memos`를 씁니다.
- **상태 저장:** 컴포넌트 로컬 ref(탭·필터·선택 행). `useDeskAppointmentsTelemedicineCancelledQuery`, `useMembersUpstreamClinicsMyQuery`.
- **근거:** `re-upstream/restored/views/NonBenefitPatientsView.vue`, `re-upstream/restored/components/nonbenefit/NonBenefitPatientsViewToolbar.vue`, `re-upstream/restored/components/nonbenefit/NonBenefitPatientsViewTelemedicineBanner.vue`

## 연락 목록(v1) — `/crm/contacts` (`crm-contacts`)
- **목적:** 연락 규칙(contact-list rules)과 수 복용관리 스케줄러(lite trigger)가 만든 환자별 연락 일정을 보고 완료 처리합니다.
- **접근 조건:** `permissionCode: 연락목록`(`call_list`), `permissionRequired`.
- **화면 구성:** `CrmContactsViewHeader`(스케줄러 켜기/끄기, 규칙 패널), `CrmContactsViewList`(-2) → `CrmContactsViewListTable` / `CrmContactsViewListLiteTriggerTable`, 셀(`ContactDatesCell`·`ContactDatesPicker`·`PrescriptionCell`·`ActionsCell`·`AutoSendPreview`), 우측 420px `CrmContactsViewDetail`(-2)(탭: 경과 기록 / 메모 / 연락 이력).
- **동작:**
  - **목록:** `GET emrClient /crm/contact-list/schedules`, `/schedules/summary`, `/scheduler`, `/scheduler/summary`. 필터는 진료의·환자명이고, 구분은 전체 / 스케줄러 / 직접 연락, 오늘 / 내일입니다(추정: 라벨만 확인).
  - **연락 완료 / 완료 취소:** `POST /crm/contact-list/schedules/{id}/complete` · `/uncomplete`. 내일 예정 건은 "오늘 완료로 처리하시겠습니까?"를 확인합니다.
  - **연락 예정일 변경:** 캘린더 팝오버에서 처리합니다. `GET /schedules/patient/{patientId}/schedules`로 불러오고, `POST …/bulk-process`(`actions`)로 반영하고, 되돌리기는 `POST /schedules/restore`(`undoToken`)입니다. 연락 사유도 입력합니다.
  - **스케줄러 행 조작:** `PATCH /crm/contact-list/scheduler/{logId}`.
  - **스케줄러 켜기:** `GET /crm/lite-trigger/events` 결과 전체에 `POST /crm/lite-trigger/events/{id}/opt-in`을 보냅니다.
  - **스케줄러 끄기:** `activeRuleCount > 0`인 이벤트에 `POST …/opt-out`을 보냅니다.
  - **문자 전송:** 행 액션 → 환자 발송 사이드패널.
  - **상세:** `GET /crm/contact-list/schedules/patient/{patientId}`(최근 3개월 처방, 예정된 예약, 최종내원일), `GET /crm/contact-list/action-logs/patient/{patientId}`.
- **데이터:** 행 = `환자`(`id`, `이름`, `성별`, `주민등록번호앞7자리`, `등급명`/`등급색명`, `휴대전화번호`, `최근진료`, `최근상담메모`), `처방정보[]`(`규칙Id`/`규칙명`/`규칙색상`/`진료기준일시` → `N일차`), `schedule`(`id`, `scheduledDate`/`effectiveAt`, `status`, `completedAt`), `nextContactSchedule`. 그 밖에 `GET crmClient /lite-triggers/status`, `GET /crm/contact-list/rules`.
- **상태 저장:** queryKey `["crm","liteTriggers",…]`(`tf`), `["crm","contactActionLogs",…]`.
- **근거:** `re-upstream/restored/views/CrmContactsView-2.vue`, `re-upstream/restored/components/crm/CrmContactsViewHeader.vue`, `re-upstream/restored/components/crm/CrmContactsViewListTable.vue`, `re-upstream/restored/components/crm/CrmContactsViewListTableContactDatesPickerContent.vue`, `re-upstream/restored/api/crm/requests-4.js`

## 연락 일정(v2, 트리거 엔진) — `/crm/contacts-v2` (`crm-contacts-v2`)
- **목적:** 트리거 엔진의 프로그램(연락 시나리오)이 만든 실행 로그(연락·자동 발송)를 목록과 캘린더로 관리합니다.
- **접근 조건:** `permissionCode: 연락목록`, `permissionRequired`. MCP 승인 대기 배너와 `McpApprovalContactsSidePanel`은 `Yu()`(dev)일 때만 켜집니다.
- **화면 구성:**
  - 상단: `CrmPromoBanner`, `SendAuthNoticeBanner`, 제목 "연락 일정" + 오늘 날짜, `CrmTrialExpiryAlert`.
  - 툴바: `CrmProgramGroupOptInBanner`(복용관리 스케줄러 켜기/끄기), 탭(`?tab=list|calendar`), `CrmScheduleAddPatientContactButton`(개별 일정 추가), `CrmContactRulesTriggerButton`(연락 스케줄러 관리).
  - 본문: `CrmContactsViewList` → `CrmContactsViewListDashboard`(카드·행) 또는 `CrmContactsViewCalendar`(+`CrmScheduleCalendarBusyLegend`).
  - 우측: 너비를 조절할 수 있는(320–960px) `CrmContactsViewDetail`(환자상세 / 예약 / 문자 발송, 예정된 연락 `CrmContactsViewDetailScheduledContacts`, 패키지, 기록).
  - 모달: `CrmScheduleCalendarModal`, `CrmContactRulesEditModal`, `CrmTrialIntroModal`.
- **동작:**

  | 사용자 동작 | API (`emrClient`) |
  |---|---|
  | 목록·캘린더 조회 | `GET /crm/trigger-engine/worklist/logs`, `GET /crm/trigger-engine/programs`, `GET /subscriptions/me` |
  | 환자 활동/상세 | `GET /crm/trigger-engine/worklist/patients/{patientId}/activity`, `GET /crm/trigger-engine/execution-logs/{id}`, `GET /patients/{id}/packages` |
  | 완료 / 완료 취소 / 모두 완료 | `POST /crm/trigger-engine/execution-logs/complete` · `/uncomplete` |
  | 연락 취소 | `POST …/execution-logs/cancel` |
  | 자동 발송 켜기/끄기 | `POST …/execution-logs/toggle` (예정 시각이 지나면 막힘) |
  | 일정 변경 | `POST …/execution-logs/reschedule`, 묶음 이동 `…/shift-group` (+`/preview`) |
  | 되돌리기 | `POST …/execution-logs/undo` |
  | 개별 일정 추가 | `POST …/execution-logs/manual`, `…/manual-auto` |
  | 시나리오(프로그램) 생성·수정 | `POST`/`PUT /crm/trigger-engine/programs[/{id}]` (`CrmContactRulesEditModal`) |
  | 스케줄러 켜기/끄기(프로그램 그룹) | `POST /crm/trigger-engine/program-groups/{key}/opt-in` · `/opt-out`, 병원 변수 `PATCH /crm/trigger-engine/hospital-variables` |
  | 전송 상태 조회 | `POST crmClient /messages/delivery-status` |
  | 상담 템플릿 열기 | `window.open('/crm/consult-script?patientId=…&logId=…&name…', 'crm-consult-script')` |

- **데이터:** 실행 로그(`log_id`, `patient`, `scheduled_date`, `status`, `delivery_mode`(`semi_auto` 등), `completed_at`, `isEnabled`, 채널, 연락 사유/규칙). 정렬 옵션: 예정일순 / 환자명순.
- **상태 저장:** 탭은 URL query `tab`(`useRouteQueryRef`), 패널 너비는 로컬 ref, queryKey `["crm","messageResults","crmDeliveryStatus",…]`.
- **근거:** `re-upstream/restored/views/CrmContactsView.vue`, `re-upstream/restored/components/crm/CrmContactsViewDetailScheduledContacts.vue`, `re-upstream/restored/components/crm/CrmContactsViewCalendarChip.vue`, `re-upstream/restored/api/crm/requests-5.js`, `re-upstream/restored/modules/CrmContactsView/part-20.js`

### 연락 일정 상태

| 출처 | 값 | 의미(화면) |
|---|---|---|
| contact-list `schedule.status` (v1) | `PENDING` | 예정 |
| | `COMPLETED` | 연락 완료(행 비활성 처리) |
| | `FAILED` | 전송 실패(lite trigger 셀) |
| lite trigger 셀 라벨 | 자동전송 / 전송완료 / 전송실패 / 전송 제외 | 채널: 문자·카카오톡 |
| 트리거 엔진 로그 `status` (v2) | `scheduled` | 예정된 연락 |
| | `completed` | 완료 |
| | `failed` | 실패 |
| | `skipped` | 건너뜀 |

## 수 복용 스케줄러 — `/crm/soo-scheduler` (`crm-soo-scheduler`)
- **목적:** 수(soo) 복용관리 스케줄러(lite trigger)가 만든 연락 예정 목록과 적용 규칙을 봅니다.
- **접근 조건:** `permissionCode: 연락목록`. 사이드바 메뉴는 lite trigger 기능이 켜져 있고 `soo` 연동이거나 원탕 계약만 있는 계정에만 보입니다(docs/access-control.md).
- **화면 구성:** `CrmSooSchedulerViewHeader`(켜기/끄기, `CrmLiteTriggerSchedulerSetupModal`, `CrmLiteTriggerVariableInputModal`, `CrmFreeTrialBadge`), `CrmSooSchedulerViewList`(전체/오늘/내일, 진료의, 환자명 검색) → `CrmSooSchedulerTable`·`CrmSooSchedulerContactDatesCell`, `CrmSooSchedulerRulesPanel`("수 복용 스케줄러 규칙"), 우측 `CrmContactsViewDetail`.
- **동작:**
  - 켜기/끄기는 `/crm/contacts`와 같습니다(`lite-trigger/events/{id}/opt-in`·`opt-out`).
  - 규칙 조회와 수정: `GET /crm/lite-trigger/rules`, `PATCH /crm/lite-trigger/rules/{id}`.
- **데이터:** `GET crmClient /lite-triggers/status`, `GET /crm/contact-list/scheduler`, `/scheduler/summary`, `GET /crm/lite-trigger/events`, `GET /crm/contact-list/rules`.
- **상태 저장:** queryKey `["crm","liteTriggers","status"|"events"|"rules"|…]`.
- **근거:** `re-upstream/restored/views/CrmSooSchedulerView.vue`, `re-upstream/restored/components/crm/CrmSooSchedulerViewHeader.vue`, `re-upstream/restored/api/crm/requests-4.js`

## 상담 스크립트 — `/crm/consult-script` (`crm-consult-script`)
- **목적:** 연락 일정 하나를 두고 상담 템플릿을 보며 전화 상담을 한 뒤, 문자나 카카오톡으로 보내고 연락을 완료합니다. 별도 팝업 창(1280×960)으로 열립니다.
- **접근 조건:** 최상위 라우트(`/crm` 자식이 아님), `requiresAuth`, `permissionCode: 연락목록`.
- **화면 구성:**
  - 헤더: 환자명·성별·나이, 등급, 최종 내원, 최근 전화, 예약.
  - 본문: `CrmConsultScriptScheduleList`(예정 로그), `CrmConsultScriptTemplatePane`(템플릿 트리·검색, "내 템플릿", 처방별 추천, 문자/카카오톡으로 전송).
  - 우측: 접을 수 있는 `PatientMemo`(초기 탭 `상담`).
  - 하단: "N건 연락 완료".
  - 발송: `CrmPatientMessageSendSidePanel`(`variant="full"`).
- **동작:**
  - **query:** `patientId`, `logId`, prefill(`name`, `gender`, `rrn7`, `levelName`, `levelColor`)를 받습니다.
  - **예정 로그:** `GET /crm/trigger-engine/worklist/logs`(`patient_id`, `delivery_mode: "all"`, `status: "scheduled"`). 최근 전화는 `delivery_mode: "semi_auto"`, `status: "completed"`, `order_by: "completed_at"`, `limit: 1`로 구합니다.
  - **템플릿:** `GET crmClient /consult-templates/groups/tree`, `POST /consult-templates/templates/by-prescriptions`(처방 쌍), `GET …/worklist/logs/{logId}/prescription-cumulative-count`.
  - **전송:** 치환한 본문을 `초기본문`으로, 채널(`sms`→`message`, `kakao`)을 `초기플랫폼`으로 사이드패널에 넘깁니다.
  - **연락 완료:** 오늘까지 예정된 `semi_auto` 로그를 `POST /crm/trigger-engine/execution-logs/complete`(`logIds`)로 완료하고 창을 닫습니다(`window.close()`).
- **데이터:** `GET /crm/contact-list/schedules/patient/{patientId}`(`prescriptionMonths: 3`), `GET crmClient /messages/patients/{patientId}/template-variables`.
- **상태 저장:** 로컬 ref(선택 로그, 패널 열림), queryKey `["crm","consultTemplates",…]`, `["patientMessageSend",…]`.
- **근거:** `re-upstream/restored/views/CrmConsultScriptView.vue`, `re-upstream/restored/components/crm/CrmConsultScriptTemplatePane.vue`, `re-upstream/restored/modules/CrmContactsView/part-20.js`

## 환자 목록 — `/crm/patients` (`crm-emr-patients`)
- **목적:** CRM용 EMR 환자 전체 목록을 보고, 엑셀로 올리거나 내려받고, 행 단위 작업을 합니다.
- **접근 조건:** `permissionCode: 환자목록`(`patient_list`). 행 액션은 `canCreate$(예약생성)`, `canCreate$(접수생성)`, `canUpdate$(환자수정)`, `canCreate$(문서발급)`, `canDelete$(환자삭제)`로 각각 막습니다.
- **화면 구성:** 헤더(환자 목록 N명, 환자 업로드, 엑셀 다운로드), 검색(이름/차트번호/주소), 토글 "휴대폰 번호가 같은 환자만", `EmrPatientsViewTable`(가족·소개자·메모·광고 수신/알림·공지 수신 동의 열), `EmrPatientsViewTableActions`(접수 / 예약 / 정보 수정 / 문서 발급 / 환자 삭제), `EmrPatientsExcelUploadModal`(이름·휴대폰·성별·생년월일·차트번호 열 매핑), `ExcelDownloadReasonModal`.
- **동작:**
  - 목록: `GET emrClient /crm/patients`, `/crm/patients/count`.
  - 삭제: `DELETE /crm/patients/{pid}`.
  - 엑셀 업로드: `POST /async-tasks/patient-excel-import`(`덮어쓰기옵션`)를 보내고 `GET /async-tasks/{id}`를 폴링합니다. 결과로 실패·중복·스킵 건수를 보여줍니다.
  - 엑셀 다운로드: 사유를 입력하면 `POST /patients/download-logs`를 보낸 뒤 파일을 생성합니다.
- **데이터:** 행(`환자Id`, `이름`, `차트번호`, `주민등록번호앞7자리`/`생일`, `광고수신동의여부`, `알림정보수신동의여부`(동의/거부/미정), `가족정보`, `소개환자정보`, `메모`).
- **상태 저장:** queryKey `["asyncTasks",…]`, AG Grid `gridApi`.
- **근거:** `re-upstream/restored/views/EmrPatientsView.vue`, `re-upstream/restored/components/emr/EmrPatientsViewTableActions.vue`, `re-upstream/restored/components/emr/EmrPatientsExcelUploadModal.vue`

## 문자·카카오톡 보내기 — `/crm/message` (`crm-message`)
- **목적:** 여러 환자에게 문자 또는 카카오톡(브랜드 메시지·알림톡)을 즉시 또는 예약 발송합니다.
- **접근 조건:** `permissionCode: 일반문자`(`sms`), `permissionRequired`. 발송 전에 결제수단을 확인합니다(`checkPaymentMethodBeforeSend`). 없으면 `BillingPaymentMethodModal`을 띄웁니다.
- **화면 구성:**
  - 좌측 440px: `MessageViewReceivers`(전송 대상).
    - 추가 방법: 직접 입력 `MessageViewPatientInput` / 주소록 `MessageViewContactGroups` / 조건 설정 `MessageViewSearchFilterConditions` / 엑셀 업로드 `MessageViewExcelUpload` / 환자 전체 불러오기.
    - 표 `MessageViewReceiversTable`, 중복 번호 `MessageViewReceiversTableDuplicate`, 주소록 저장 `MessageViewContactGroupSave`.
  - 중앙: `SendAuthNoticeBanner`, 야간 경고·광고 동의 미정 배너, `MessageViewSend`.
    - 내부는 `CrmCommonSend`이고 문자 / 카카오톡 탭을 둡니다.
    - 그 밖에 발신번호 선택, 예약, 장문 자동 전환 토글, 예상 금액, 테스트 전송, 전송, `MessageSendGroupDraftBanner`가 있습니다.
  - 우측: 1440px 이상이면 `CrmMessagePreviewAdapter`, 미만이면 `CrmMessagePreviewPopover`.
  - 사이드패널: `CrmSendAsideTabs`(문구 / 콘텐츠).
- **동작:**
  - **발송 그룹(서버 임시저장):**
    - 처음 입력하거나 대상을 추가할 때 `POST crmClient /messages/send/groups`를 한 번 보냅니다(`ft`, 동시 호출은 합칩니다).
    - 이후 입력이 바뀌면 2초 debounce(최대 5초)로 저장합니다.
      - 문자: `PUT /messages/send/groups/{id}`(`messageType`, `messageTitle`, `messageText`, `reservedAt`, `attachmentIds`, `callerNumberId`, `smsOverflowPolicy`).
      - 브랜드 메시지: `PUT /messages/kakao/brand/groups/{id}`.
      - 알림톡: `PUT /messages/kakao/alimtalk/groups/{id}`(+`fallback`).
    - 값이 같으면 저장하지 않습니다.
  - **진입 시 복원:**
    - `history.state.messageSendGroupId`(재전송에서 옴) 또는 `?group-id=`/`?messageSendGroupId=`가 있으면 해당 그룹을 불러옵니다. query는 제거합니다.
    - 둘 다 없으면 최근 그룹을 조회합니다. 비어 있으면 삭제하고, 내용이 있으면 임시저장 배너(불러오기 / 삭제)를 띄웁니다.
    - 템플릿 라이브러리 query가 있으면 템플릿을 적용합니다.
  - **대상 추가:** `POST messages/send/groups/{id}/receivers`(`receivers`), `…/add/emr-patients`(`emrPatientIds`), `…/add/contact-groups`(`contactGroupIds`), `…/add/filters`(`filterId`|`filterJson`), `…/add/all`.
  - **대상 삭제:** `POST …/receivers/remove`(`receiverIds`), `DELETE …/receivers`(전체).
  - **중복 번호:** `GET …/receivers/duplicates`, `POST …/receivers/duplicates/handle`의 `deduplicationMode`는 다음 셋 중 하나입니다.
    - `send_one`: 행 단위로 1건만 보냅니다.
    - `send_each`: 중복 번호당 1건씩 보냅니다.
    - `send_all`: 모두 보냅니다.
    - 발송 시점에 미해결 중복이 있으면 확인창을 띄우고, 거절하면 중복 패널을 엽니다.
  - **주소록·조건:** `GET/DELETE /contacts/groups[/{id}]`, `POST /contacts/groups/from-message-send-group`(`name`), `POST /contacts/groups/members/add/from-message-send-group`, `GET/POST /contacts/filters`, `POST /contacts/filters/{id}/use`, `DELETE /contacts/filters/recent-usage`. 조건은 환자 구분·등급·성별·기간·미내원 기간입니다.
  - **예상 금액:** `POST /messages/send/groups/{id}/estimate`(`estimatedAmount`, `excluded`, `limitExceeded`)와 `GET /billing/invoices/unit-prices`(VAT 별도).
  - **테스트 전송:** `POST /messages/send/test`(`messageSendGroupId`, `receiverNumber`) 또는 `/messages/send/test/manual`, 카카오는 `/messages/kakao/{alimtalk|brand}/test/manual`.
  - **전송:**
    1. 수신자 수가 0이면 오류, 본문이 없으면 "메시지를 입력해주세요."를 띄웁니다.
    2. 카카오는 편집기 검증(`validateKakaoMessage`)을 거칩니다.
    3. 저장을 강제로 마칩니다.
    4. 중복을 확인합니다.
    5. 확인 모달(수신자 수, 첫 수신자 이름, 비호환 문자, 자동 치환되지 않는 변수)을 띄웁니다.
    6. `POST crmClient /messages/send`(`messageSendGroupId`)를 보냅니다.
    7. 결과 메시지: 예약이면 "…에 전송될 예정입니다.", 즉시면 "전송 결과는 2일 이내로 확인할 수 있습니다." 응답에 `excludedCount`가 있으면 "N명은 전송 전 제외했습니다"를 덧붙입니다.
    8. 폼을 초기화합니다(`messageType: "광고"`, 카카오 `brand`/`FT`).
- **데이터:** 발송 그룹(`id`, `platformType`, `messageType`, `messageTitle`, `messageText`, `attachments[]`, `callerNumber{id,phone,isDefault}`, `reservedAt`, `smsOverflowPolicy`, `kakaoOptions{type, kakaoChannel, bizType, content, attachment, carousel, kakaoTemplateId, variables}`). 그 밖에 `GET …/receivers/count`, `GET …/receivers/marketing-consent-undecided`(`count`, `exists` → "광고 수신 동의 여부 '미정'인 환자가 N명" 배너), `GET /settings/patient-levels`, `GET /settings/hospitals`.
- **상태 저장:**
  - localStorage `crm-message-send-current-tab`(`message`|`kakao`).
  - queryKey `["crm","messages","sendGroupById",id,withCount]`, `…"sendGroupReceivers"`, `…"sendGroupReceiverCount"`, `…"sendGroupEstimate"`, `…"sendGroupDuplicateReceivers"`.
  - `useOnboardingGuideSessionStore`.
- **근거:** `re-upstream/restored/views/MessageView.vue`, `re-upstream/restored/components/message/MessageViewReceivers.vue`, `re-upstream/restored/components/message/MessageViewSend.vue`, `re-upstream/restored/api/messages/sendGroups.js`, `re-upstream/restored/api/messages/requests-2.js`, `re-upstream/restored/modules/CrmCommonMessageFormReservedAt/useMessagesSendGroupsQuery.js`

## 전송 완료 — `/crm/message/send-completed` (`crm-message-send-completed`)
- **목적:** 발송 직후 결과를 안내합니다.
- **접근 조건:** `permissionCode: 일반문자`.
- **화면 구성:** `BaseCompleted`(보조 버튼 "전송내역 보기", 주 버튼 "다른 문자 전송").
- **동작:**
  - `?group-id`가 없거나 `GET crmClient /messages/send/groups/{id}`가 실패하면 `/crm/message`로 replace합니다.
  - `reservedAt`이 있으면 "문자 전송을 예약했습니다.", 없으면 "지금 문자를 전송합니다."를 보여줍니다.
  - 버튼은 각각 `/crm/message/results`와 `/crm/message`로 이동합니다.
- **데이터:** 발송 그룹 `reservedAt`.
- **상태 저장:** 없음(로컬 ref).
- **근거:** `re-upstream/restored/views/MessageSendCompletedView.vue`

## 전송 내역 — `/crm/message/results` (`crm-message-results`)
- **목적:** 문자·카카오톡 발송 이력, 비용, 수신자별 결과를 확인하고 예약을 관리하거나 재전송합니다.
- **접근 조건:** `permissionCode: 전송이력`(`send_history`).
- **화면 구성:**
  - 제목 "문자 ∙ 카카오톡 전송 내역".
  - 기간 프리셋(이번주 / 이번달 / 3개월 / 6개월, 날짜 선택기 프리셋에는 1년도 있음).
  - `MessageResultsDashboard`(총 전송 건수 완료/예정, 예상 결제 총액 VAT 포함).
  - `MessageResultsList` → `MessageResultsListTable`(검색: 환자명·차트번호·휴대폰 번호, 상태·결과 필터, 목록 다운로드).
  - 상세 사이드패널 `MessageResultsDetailSidePanel` → `MessageResultsDetail`(전송 정보 `MessageResultsDetailSendingInfo`, 링크 클릭 `MessageResultsDetailLinks`, 수신자 `MessageResultsDetailReceivers`, 결제 금액) + `MessageResultsDetailSidePanelFooter`.
- **동작:**
  - **목록:** `GET crmClient /messages/results/list`(`limit`, `offset`, `order`), `/list/count`, 대시보드 `GET /messages/results`. 선택한 그룹은 URL query `groupId`로 유지합니다.
  - **필터:** 상태 `all`/`reserved`/`sending`/`completed`/`failed_canceled`(→ `messageStatus` 배열). 결과 조건은 `hasFailure`, `hasLinkClick`, `hasFallback`, `receiverScope`(`single`|`multiple`, 하나만 골랐을 때만 적용)입니다.
  - **목록 다운로드:** `POST /messages/results/list/download`(`startDate`, `endDate`, `messageStatus`, `searchKeyword`, …).
  - **상세:** `GET /messages/send/groups/{id}`, `GET /messages/results/{id}/links`, `GET /messages/results/{id}/receivers`(`messageStatus`, `hasFallback`, `hasLinkClicked`, `linkId`, `searchKeyword`, `withCount`), `…/receivers/count`(`failCount`, `pendingCount`), 수신자별 `…/receivers/{receiverId}[/kakao]`.
  - **상태별 버튼:**

    | 그룹 `messageStatus` | 버튼 | API |
    |---|---|---|
    | `reserved` | 전송 취소 | `DELETE /messages/results/{id}/reservation` |
    | | 시간 변경 (`reservedAt`이 있을 때) | `PATCH /messages/results/{id}/reservation`(`reservedAt`) |
    | | 즉시 전송 | `PATCH …/reservation`(`reservedAt: null`) |
    | `completed`·`failed`·`canceled` | 전체 재전송 | `POST /messages/results/{id}/resend` |
    | | 실패 N건 재전송 (대기 수신자가 있으면 막힘) | `POST …/resend`(`messageStatus: ["failed"]`) |

    - 재전송 응답의 새 그룹 `id`를 `history.state.messageSendGroupId`에 담아 `/crm/message`로 push합니다.
    - 수신자 선택 후 "N명에게 새로 전송"도 할 수 있습니다.
- **데이터:** 목록 행(`messageStatus`, `reservedAt`, `receiverCount`, `successCount`, `failCount`, `platformType`, `messageType`, `sendingType`). 수신자(`status`, `fallbackStatus`, `fallbackType`, `failureReason`).
- **상태 저장:** queryKey `["crm","messageResults",…]`(`crmMessageResultsList`, `…Receivers`, `…ReceiverDetail`, `crmKakaoMessageResultsReceiverDetail`, `crmMessageResultsLinkInfo`), 스토어 `useCrmMessageResultLinksStore`.
- **근거:** `re-upstream/restored/views/MessageResultsView.vue`, `re-upstream/restored/components/message/MessageResultsList.vue`, `re-upstream/restored/components/message/MessageResultsDetailSidePanelFooter.vue`, `re-upstream/restored/modules/MessageResultsDetailSidePanel/part-3.js`, `re-upstream/restored/api/messages/requests-4.js`

### 전송 상태

| 그룹 `messageStatus` | 라벨 | 톤 |
|---|---|---|
| `reserved` | 전송 대기 | gray |
| `queued` | 전송 중 (`reservedAt`이 있으면 "전송 대기") | gray |
| `sending` | 결과 확인 중 | gray |
| `completed` | 전송 완료 | success |
| `failed`, `canceled` | 전송 불가 | error |
| 그 밖 | 알수없음 | gray |

| 수신자 결과 (`status` / `fallbackStatus`) | 라벨 |
|---|---|
| `reserved` | 전송 대기 |
| `canceled` | 전송 불가 (예약 전송 취소) |
| `sending` | 결과 확인 중 |
| `completed` | 성공 |
| 카카오 `failed` + 대체 `success` | 성공 (단문/장문/그림 문자로 대체 전송) |
| 카카오 `failed` + 대체 없음 | 문자로 대체 전송 중 |
| 카카오 `failed` + 대체 `failed` | 문자로 대체 전송 실패 (`failureReason`) |
| 그 밖 | 실패 (`failureReason`) |

## 수신거부 목록 — `/crm/refusal` (`crm-refusal`)
- **목적:** 광고 수신거부와 알림/공지 수신거부를 관리합니다.
- **접근 조건:** `permissionCode: 수신거부목록`(`rejected_list`).
- **화면 구성:** 탭 `한의원 등록`(`CrmRefusalViewListHospital`) / `환자 직접 등록`(`CrmRefusalViewList080`), `RefreshButton`.
  - 한의원 탭: 항목 필터(전체 / 광고 / 알림·공지), 검색(환자명·휴대폰 뒷자리), `CrmRefusalViewListHospitalRegisterPanel`, `CrmRefusalViewExcelUploadButton`, `CrmRefusalViewListTableHospital`(+`ActionCell`, `AgreementsCell`).
  - 080 탭: 요청시각·처리시각 표.
- **동작:**
  - 한의원 목록: `GET crmClient /refusals`(`refusalType`: `marketing`|`info`, `searchKeyword`, `limit`, `offset`, `withCount`).
  - 080 목록: `GET /refusals/080`. 080으로 환자가 직접 등록한 거부는 병원이 해제할 수 없습니다(안내 문구).
  - 환자 선택 등록: `PATCH /refusals/contact/{contactId}`(`isMarketingAgreed: false` / `isInfoMessageAgreed: false`).
  - 번호·엑셀 등록: `POST /refusals`(`phones`) → `succeedCount`/`failedCount`. 엑셀은 최대 20,000개이고 열 매핑과 거부 타입을 고릅니다.
  - 동의 상태 변경: `PATCH /refusals/{id}`(`isMarketingAgreed` 또는 `isInfoMessageAgreed`). EMR에 없는 환자는 환자 상세 링크를 막습니다.
  - 다운로드: 사유 입력 모달 → `POST /refusals/download`(`refusalSource`, `searchKeyword`, body `reason`) → 파일 `수신거부목록_…`.
- **데이터:** 행(`id`, `contactId`, `emrPatientId`, 환자명, 휴대폰번호, `emrSsnPrefix`, 동의 상태, 등록일).
- **상태 저장:** queryKey `["crm","refusals",…]`.
- **근거:** `re-upstream/restored/views/CrmRefusalView.vue`, `re-upstream/restored/components/crm/CrmRefusalViewListHospital.vue`, `re-upstream/restored/components/crm/CrmRefusalViewListHospitalRegisterPanel.vue`, `re-upstream/restored/api/refusals/requests.js`

## 콘텐츠 환자 열람 미리보기 — `/crm/contents/view/:token` (`crm-contents-view`)
- **목적:** 메시지에 첨부한 콘텐츠 묶음을 환자가 보는 화면 그대로 미리 봅니다(상단에 "환자 열람 페이지 (미리보기)" 표시).
- **접근 조건:** `permissionCode: 일반문자`.
- **화면 구성:** `CrmContentPatientPreview`.
  - 병원명 헤더.
  - 첫 콘텐츠: `embedUrl`이면 iframe, `image`이면 이미지 목록, 그 밖에는 썸네일. `naver_blog`면 "블로그에서 읽기" 링크.
  - 공유 버튼(카카오톡 / 메시지 / 링크 복사).
- **동작:**
  - 데이터를 받으면 `POST crmClient /contents/bundles/{token}/events`(`eventType: "page_view"`, `entrySource: "message"`)를 한 번 보냅니다.
  - 공유 클릭 시 `eventType: "share_click"`, `contentId`, `shareChannel`을 보냅니다. 실제 공유는 하지 않고 "공유 이벤트가 기록되었습니다 (데모)"만 표시합니다.
  - 응답이 없으면 "링크가 만료되었거나 찾을 수 없습니다", 콘텐츠가 없으면 "콘텐츠가 더 이상 제공되지 않습니다"를 보여줍니다.
- **데이터:** `GET /contents/bundles/{token}` → `hospitalName`, `contents[]`(`id`, `title`, `contentType`, `embedUrl`, `images[]`, `thumbnailUrl`, `sourceUrl`).
- **상태 저장:** `useContentsBundlesQuery`(queryKey `["crm","contents",…]`).
- **근거:** `re-upstream/restored/components/crm/CrmContentPatientPreview.vue`, `re-upstream/restored/api/contents/requests.js`

## 발신번호 및 채널 설정 — `/setting/caller-numbers` (`setting-caller-numbers`)
- **목적:** 문자 발신번호를 등록·심사·기본값으로 지정하고, 카카오톡 채널을 연동합니다.
- **접근 조건:** `permissionCode: 발신번호설정`(`caller_number_setting`).
- **화면 구성:** `CrmSettingCallerNumbers`(검색: 발신번호·채널 아이디, 상태 도움말 모달), `CrmSettingCallerNumbersTable`(셀: CallerNumber / Status / Note / Action / Remove), `CrmCommonCallerNumbersAddModal`(명의: 본인명의(개인)/의료기관명의, 본인인증 `CrmCommonIdentityVerificationModal`, 통신서비스 이용가입증명원 첨부 `CrmCommonDocumentAttachment`), `CrmKakaoChannelsAddModal`.
- **동작:**
  - 목록: `GET crmClient /messages/caller-numbers`.
  - 등록 신청: `POST /messages/caller-numbers`(`callerNumber`, `numberHolder`, `attachmentIds`, `txSeqNo`).
  - 재승인 신청(반려 건)과 기본 번호 설정: `PATCH /messages/caller-numbers/{id}`(`isDefault`).
  - 삭제: `DELETE /messages/caller-numbers/{id}`. 기본 번호는 삭제할 수 없습니다.
  - 채널 목록: `GET /kakao/channels`. 기본 채널: `PATCH /kakao/channels/{id}/default`.
  - 채널 연동: `GET /kakao/channels/categories` → `POST /kakao/channels/token`(`phoneNumber`, `yellowId`) → 인증번호 입력 → `POST /kakao/channels`(`categoryCode`, `phoneNumber`, `token`, `yellowId`). 공개·검색 허용과 비즈니스 인증이 된 채널이어야 합니다.
- **데이터:** 발신번호(`id`, `callerNumber`, `numberHolder`, `status`, `isDefault`, 비고). 최대 15개까지 등록할 수 있고, 증명원은 1개월 이내에 발급한 것이어야 합니다.
- **상태 저장:** queryKey `["crm","callerNumbers",…]`, `useOnboardingGuideSessionStore`.
- **근거:** `re-upstream/restored/components/crm/CrmSettingCallerNumbers.vue`, `re-upstream/restored/components/crm/CrmSettingCallerNumbersTableCellStatus.vue`, `re-upstream/restored/components/crm/CrmSettingCallerNumbersTableCellAction.vue`, `re-upstream/restored/components/crm/CrmCommonCallerNumbersAddModal.vue`, `re-upstream/restored/components/crm/CrmKakaoChannelsAddModal.vue`

| 발신번호 `status` | 배지 | 의미 |
|---|---|---|
| `전송가능` | 사용 가능 | 서류 승인, 문자 전송 가능. 기본 번호로 설정 가능 |
| `서류확인중` | 심사 중 | 승인 전에는 전송 불가 |
| `서류반려` | 심사반려 | 사유 확인 후 재승인 신청 |
| 그 밖 | 알수없음 | — |

## 상담 템플릿 관리 — `/setting/consult-templates` (`setting-consult-templates`)
- **목적:** 상담 스크립트에서 쓰는 상담 템플릿을 그룹 트리로 관리합니다.
- **접근 조건:** `permissionCode: 연락목록`.
- **화면 구성:** `CrmSettingConsultTemplates` → `CrmConsultTemplatesManager`(`CrmConsultTemplatesTreeItem`, `CrmConsultTemplatesEditor`, `CrmConsultTemplatesGroupNameModal`). "내 템플릿", 검색, 새 그룹·새 템플릿.
- **동작:**
  - 트리 조회: `GET crmClient /consult-templates/groups/tree`.
  - 그룹: `POST`/`PATCH`/`DELETE /consult-templates/groups[/{id}]`(`name`). 그룹을 삭제하면 포함된 템플릿도 함께 삭제됩니다.
  - 템플릿: `POST`/`PATCH`/`DELETE /consult-templates/templates[/{id}]`(`groupId`, `title`, `body`).
- **데이터:** 그룹·템플릿 트리. 본문은 `#{변수}`를 포함할 수 있습니다(추정: 상담 스크립트에서 치환하므로).
- **상태 저장:** queryKey `["crm","consultTemplates",…]`.
- **근거:** `re-upstream/restored/components/crm/CrmSettingConsultTemplates.vue`, `re-upstream/restored/components/crm/CrmConsultTemplatesManager.vue`, `re-upstream/restored/api/consult-templates/requests.js`

## 메시지 템플릿 관리 — `/setting/message-templates` (`setting-message-templates`)
- **목적:** 문자와 카카오톡(알림톡·브랜드) 템플릿, 템플릿 그룹을 관리합니다.
- **접근 조건:** `permissionCode: 메시지템플릿관리`(`message_template_setting`).
- **화면 구성:** `CrmSettingMessageTemplates` → `CrmMessageTemplatesManager`(채널 문자/카카오톡, 유형 광고/알림·공지, 검색, 그룹), `CrmTemplateFormPanel` → `CrmMessageTemplateEdit` → `CrmCommonMessageForm`(발신번호 선택·등록 포함).
- **동작:**
  - 그룹: `GET`/`POST`/`PATCH`/`DELETE /messages/template-groups[/{id}]`.
  - 문자 템플릿: `POST /messages/templates`(`templateTitle`, `messageType`, `messageTitle`, `messageText`, `attachmentIds`, `callerNumber`, `groupId`, `parentTemplateId`, `parentTemplateType`), `PATCH`/`DELETE /messages/templates/{id}`, `GET /messages/templates/{templateType}/{id}`.
  - 카카오 개인 템플릿: `POST`/`PUT /messages/kakao-templates/private/{alimtalk|brand}[/{id}]`(`templateName`, `templateData`, `groupId`, `bizType`), `DELETE /messages/kakao-templates/private/{id}`.
  - 라이브러리: `GET /messages/template-library`, `/messages/templates/sources[/counts]`, `/messages/kakao-templates/frequently-used`.
  - 문구: `GET`/`POST`/`PATCH`/`DELETE /messages/phrases`.
- **상태 저장:** queryKey `["crm","templates","messageTemplates",…]`, `["crm","templates","templateSources",…]`.
- **근거:** `re-upstream/restored/components/crm/CrmSettingMessageTemplates.vue`, `re-upstream/restored/components/crm/CrmMessageTemplatesManager.vue`

## 콘텐츠 관리 — `/setting/contents` (`setting-contents`)
- **목적:** 메시지에 첨부해 환자에게 보낼 콘텐츠(링크·이미지)를 그룹별로 등록합니다.
- **접근 조건:** `permissionCode: 일반문자`.
- **화면 구성:** `CrmSettingContents` → `CrmContentManagerPane`(`CrmSettingContentsSidebar`, `CrmContentRegisterPane`, `CrmContentDetailPane`, `CrmContentMobilePreview`, `CrmContentThumbnailUpload`, `CrmContentGroupNameModal`).
- **동작:**
  - 목록·그룹 조회: `GET crmClient /contents`, `GET /contents/groups`.
  - 링크 등록: `POST /contents/scrape`(`url`)로 제목과 썸네일을 자동으로 채웁니다. 실패하면 직접 입력합니다. 같은 콘텐츠가 있으면 경고만 하고 등록을 계속할 수 있습니다.
  - 등록: `POST /contents`(`contentType`, `title`, `sourceUrl`, `images`, `groupId`). 첫 번째 이미지가 대표 썸네일이 됩니다.
  - 수정·비활성: `PATCH /contents/{id}`(`title`, `groupId`, `isActive`).
  - 그룹: `POST`/`PATCH`/`DELETE /contents/groups[/{id}]`(`name`).
  - 발송 화면에서는 `CrmSendAsideTabs` → `CrmContentListDock`으로 첨부합니다.
- **상태 저장:** queryKey `["crm","contents",…]`.
- **근거:** `re-upstream/restored/components/crm/CrmSettingContents.vue`, `re-upstream/restored/components/crm/CrmContentRegisterPane.vue`, `re-upstream/restored/api/contents/requests.js`

## dev 전용 라우트 (prod 미등록)

`Yu()`(dev 빌드)일 때만 `/crm` 자식으로 등록되며, 이 번들(prd)에는 등록되지 않습니다.

| 경로 | 이름 | 화면 | 주요 API |
|---|---|---|---|
| `/crm/routines` | `crm-routines` | `CrmRoutineView` (루틴 목록, 템플릿 시작) | `crmClient /schedulers`, `/schedulers/templates`, `/categories` |
| `/crm/routines/new`, `/crm/routines/:routineId` | `crm-routines-new`, `crm-routines-detail` | `CrmRoutineCanvasView` (대상·메시지·해피콜 노드 캔버스) | `GET /schedulers/{id}`, `PUT /schedulers/{id}/routines/batch`, `POST /happycall/templates` |
| `/crm/reminder` | `crm-reminder` | `CrmReminderView` (리마인더 대시보드) | 확인된 엔드포인트 없음 |

## 흐름

### 다건 발송: 대상 선택 → 작성 → 발송 → 결과
1. **진입:** 사이드바에서 `/crm/message`로 들어가거나, 다른 화면에서 발송 그룹을 미리 만들고 `?group-id=`로 넘어옵니다(비급여 환자 다중 선택). 결과 화면의 재전송은 `history.state.messageSendGroupId`로 들어옵니다.
2. **대상 선택:** 직접 입력 / 주소록 / 조건 / 엑셀 / 전체 환자로 `messages/send/groups/{id}/receivers…`에 추가합니다. 중복 번호를 정리하고, 광고 동의 "미정" 인원을 확인합니다.
3. **작성:** 채널(문자·카카오톡)과 유형(광고·알림)을 고르고, 발신번호나 채널, 본문, `#{변수}`, 첨부·콘텐츠·단축 링크, 예약 시각을 정합니다. 2초 debounce로 그룹에 자동 저장됩니다. 미리보기로 수신자별 치환 결과를 확인합니다.
4. **검증·발송:** 결제수단 → 야간 광고 제한 → 수신자 수 → 저장을 강제로 마침 → 중복 → 확인 모달 → `POST /messages/send` 순입니다.
5. **결과:** `/crm/message/results`에서 상태와 수신자별 결과(대체 발송 포함), 링크 클릭을 확인합니다. 예약 건은 취소, 시간 변경, 즉시 전송을 할 수 있습니다. 끝난 건은 전체 또는 실패 건만 재전송할 수 있고, 새 그룹을 만든 뒤 2단계로 돌아갑니다.

### 개별 발송
- 비급여 환자, 연락 목록, 상담 스크립트에서 `CrmPatientMessageSendSidePanel`을 엽니다. `POST /messages/send/patient`(문자), `/messages/kakao/{alimtalk|brand}/patient`(`patientIds`)로 보내고, 비용은 `/messages/send/patients/estimate`로 추정합니다.

### 연락 목록 업무 흐름
1. **설정:** 연락 규칙이나 프로그램(시나리오)을 만듭니다(`/crm/contact-list/rules`, `/crm/trigger-engine/programs`). 수 복용관리 스케줄러를 켭니다(lite-trigger opt-in 또는 program-group opt-in). 필요하면 발신번호와 카카오 채널을 등록하고 병원 변수를 입력합니다.
2. **일정 생성:** 처방이나 진료 기준일로부터 규칙이 연락 일정을 만듭니다(서버). 직원이 "개별 일정 추가"로 수동 일정을 넣을 수도 있습니다(`execution-logs/manual`).
3. **오늘 업무:** `/crm/contacts-v2`(또는 v1 `/crm/contacts`, `/crm/soo-scheduler`)에서 오늘과 내일 예정 건을 확인합니다. 자동 발송 건은 켜거나 끄고, 반자동(`semi_auto`) 건은 상담 템플릿을 엽니다.
4. **상담:** `/crm/consult-script` 팝업에서 템플릿을 보며 전화하고, 메모를 남기거나 문자·카카오톡을 보냅니다. 끝나면 "N건 연락 완료"(`execution-logs/complete`)를 누르고 창을 닫습니다.
5. **조정:** 일정을 변경, 묶음 이동, 취소하거나 되돌립니다(`reschedule`/`shift-group`/`cancel`/`undo`). 완료를 취소할 수도 있습니다(`uncomplete`).

## 레거시 차트(OK차트) 대비

이 절은 한메디 OK차트 매뉴얼(https://www.okmedi.net/Manual/)을 근거로 정리한 것이며, 현행 Upstream 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무

- **조건 검색 기반 대상 추출(OKCRM SMS/DM):** 여러 조건을 겹쳐 환자 목록을 만들고, 그 목록에 바로 문자를 보냅니다. 두 번째 조건의 결과를 "기존 목록에 추가"해 합집합 목록을 만들 수도 있습니다. 현행 조건 설정(환자 구분·등급·성별·기간·미내원 기간)보다 범위가 넓습니다. ([OK차트: OKCRM(SMS/DM) 활용](https://www.okmedi.net/Manual/?idx=389))

  | 조건 묶음 | 항목 |
  |---|---|
  | 인적 정보 | 차트번호, 이름, 전화번호, 휴대폰번호, 성별, 나이, 등록일자, VIP(등급), 유입경로, 주치의, 생일자 |
  | 진료·수납 | 진료기간, 진료비 발생 금액, 수납 금액, 내원 횟수 |
  | 진료 내용 | 상병명, 진료 항목, 진단명, 처방명, 유효율 |
  | 특수 검색 | 이탈자, 임신부(기간), 자보/산재(기간 + 자보·산재 구분), 패키지 이탈자(기간), 수험생(출생년월 범위), 특정 진료 횟수(기간 + 처방테마 또는 처방명), 수신동의 재안내 |

  - 특수 검색 출처: ([OK차트: OKCRM - 이탈자 검색](https://www.okmedi.net/Manual/?idx=945)), ([OK차트: OKCRM - 임신부 검색](https://www.okmedi.net/Manual/?idx=946)), ([OK차트: OKCRM - 자보/산재 검색](https://www.okmedi.net/Manual/?idx=947)), ([OK차트: OKCRM - 패키지 이탈자 검색](https://www.okmedi.net/Manual/?idx=955)), ([OK차트: OKCRM - 수험생 검색](https://www.okmedi.net/Manual/?idx=948)), ([OK차트: OKCRM - 특정 진료 횟수 검색](https://www.okmedi.net/Manual/?idx=949)), ([OK차트: OKCRM - 수신동의 재 안내 검색](https://www.okmedi.net/Manual/?idx=950))
  - 매뉴얼은 진료 항목(비급여 클리닉)을 목감기·코감기처럼 잘게 나눠 기록해 두어야 시즌별 주력 환자군을 뽑아 안내 문자를 보낼 수 있다고 안내합니다. 처방·진료항목 기준 검색이 이 용도의 전제입니다. ([OK차트: 우리 한의원의 시즌별 주력환자군을 알아보기](https://www.okmedi.net/Manual/?idx=800))
- **이탈률 분석:** 이탈자 검색은 목록과 함께 이탈 비율을 보여줍니다. 내원 횟수 기준(1회 이상, 2회 이상 …)을 바꿔 가며 장단기 이탈률을 비교할 수 있습니다. ([OK차트: OKCRM - 이탈자 검색](https://www.okmedi.net/Manual/?idx=945))
- **일상 자동 문자(OKEasyCRM):** 날짜(기본 오늘)를 기준으로 세 그룹에 미리 고른 문구를 일괄 발송합니다. 문구와 장문 여부는 처음 한 번만 설정합니다. 현행에서는 트리거 엔진 프로그램으로 대체할 수 있을지 확인이 필요합니다(추정). ([OK차트: OKEasyCRM에서 문자메시지 전송](https://www.okmedi.net/Manual/?idx=388))
  - 신환: 그날 등록한 신규 환자.
  - 내원: 그날 내원한 환자. "신환 제외" 옵션이 있습니다.
  - 내일 생일: 즉시 발송 또는 생일 당일 설정 시각 예약 발송 중에서 고릅니다.
  - 날짜를 골라 목록을 다시 만들면 그날의 발송 현황도 볼 수 있습니다.
- **상담 기록(OKCodi / 모든Codi):** 전화·방문 상담을 환자별로 누적 기록하고 집계합니다. ([OK차트: OKCodi 및 모든Codi 관리](https://www.okmedi.net/Manual/?idx=387)), ([OK차트: 우리 한의원의 상담환자 발굴, 분류, 관리 안내](https://www.okmedi.net/Manual/?idx=718))
  - 상담 1건의 분류 축: 상담구분, 유입경로, 진료구분, 상담결과, 상담자. 각 축의 값 목록은 병원이 직접 추가·수정합니다.
  - 상담마다 "다음 콜 시각"을 지정하면 "오늘 콜"·"전체 다음 콜"(오늘 이후 예정 모두) 목록에 잡힙니다. 상담 화면에서 바로 예약을 잡을 수 있습니다.
  - EMR에 등록되지 않은 사람(문의 전화 등)도 상담을 기록할 수 있습니다(미등록 환자 상담).
  - "상담 종결" 체크로 후속 조치(전화 요망, 다음 내원 시 전달 사항, 직원 간 지시)가 끝났는지 관리합니다.
  - 상담 현황판: 기간을 정해 분류 축별 상담 건수와 비율(파이 차트)을 집계합니다. 엑셀 저장을 지원합니다.
  - 현행 상담 스크립트는 연락 일정(실행 로그)에 딸린 상담만 다루고, 이런 분류·집계용 상담 이력 모델은 이 문서 범위에서 보이지 않습니다.
- **묶음 문자(OKCodi):** 여러 문자를 한 묶음으로 정해 두고 순서대로 발송합니다. 간격·조건은 매뉴얼에 나오지 않습니다. ([OK차트: OKCodi 묶음 문자 전송](https://www.okmedi.net/Manual/?idx=1226))
- **발신자 표시(CTI) 연동:** 전화가 오면 번호로 환자를 찾아 정보를 띄우고, 그 자리에서 상담을 등록하거나 예약·차트 보기·전화 걸기를 합니다. 수신 통화 목록과 수신 문자 목록을 보고 상담 메모를 덧붙일 수 있습니다. 백엔드 관점에서는 "전화번호 → 환자 조회"와 "수신 통화 이력" 기능이 필요합니다. ([OK차트: OKCTI 발신자 표시 서비스](https://www.okmedi.net/Manual/?idx=385)), ([OK차트: OKCodi 및 모든Codi 관리](https://www.okmedi.net/Manual/?idx=387))
  - 통화 중 문자 / 안내 문자: 수신 팝업에서 버튼 하나로 미리 지정한 문구를 발신자에게 보냅니다.
- **주의 환자 관리:** ([OK차트: 주의환자 명단 관리 및 알람기능](https://www.okmedi.net/Manual/?idx=407)), ([OK차트: 관리정보, 가족관리, 소개자 등 입력](https://www.okmedi.net/Manual/?idx=349))
  - 경고 명단: EMR 등록 전 사람을 이름·출생년도·경고 메시지로 미리 등록해 두고, 같은 사람이 신환 등록되면 경고를 띄웁니다.
  - 주의 표시: 기존 환자에 [주의]를 체크하고 주의 메모를 남기면, 그 환자를 검색·선택할 때마다 경고음과 메모 창으로 알립니다. CTI 수신 팝업에서 "주의"로 등록한 건도 같은 목록에 모입니다.
- **한약 복용 관리·내원 콜:** 예약 플래너 안의 별도 기능입니다. 현행 "비급여 환자 관리"·"연락 일정"과 목적이 같습니다. ([OK차트: 한약복용환자 내원콜 관리](https://www.okmedi.net/Manual/?idx=414)), ([OK차트: 우리 한의원의 한약복용 환자 목록, 복약지도 관리하기](https://www.okmedi.net/Manual/?idx=1088)), ([OK차트: SMS, 예약플래너, 한약복용관리 환경설정](https://www.okmedi.net/Manual/?idx=338))
  1. 한약을 진료 항목 카테고리로 나눠 기록합니다. 매뉴얼은 "한약 환자" 하나로 묶으면 어떤 한약을 얼마에 복용 중인지 구분할 수 없다고 강조합니다.
  2. 한약 처방 환자 목록(처방명·투약일수·진료비)에서 골라 "복용 관리"에 추가합니다.
  3. 복용 관리 목록은 진료일·발송 예정일·복용 시작일·복용 종료일로 정렬하고, 달력 보드로도 봅니다. 환자별로 진행 상태를 고르고 해피콜 등 완료 여부를 체크해 저장합니다.
  4. 환경설정에서 해피콜 등 항목별 사용 여부와 기준 일수, 자동 문자 문구를 정하면 콜 일정이 자동 등록됩니다. 택배 문자나 예약 문자도 추가로 보낼 수 있습니다.
- **소개자 통계:** 환자의 소개자를 기록하고, 기간별 소개 관계를 트리 구조와 소개 건수 랭킹으로 집계합니다. 고른 환자에게 바로 문자를 보낼 수 있습니다. 현행 환자 목록에는 `소개환자정보` 열만 있습니다. ([OK차트: 소개자 기록 및 통계](https://www.okmedi.net/Manual/?idx=401))
- **수신 동의·거부 처리 결과 통지:** 동의·거부를 받으면 처리 결과를 환자에게 알리는 문자를 보내는 절차가 따로 있습니다. 거부한 환자에게도 보내야 하므로 OK차트는 발송 시 "수신거부자 포함" 체크를 따로 둡니다. 현행 수신거부 목록에는 이런 통지 기록이나 발송 경로가 보이지 않습니다. ([OK차트: 광고성 정보 수신 거부 관리하기](https://www.okmedi.net/Manual/?idx=698)), ([OK차트: 개인정보동의 서명(싸인패드, 펜차트)](https://www.okmedi.net/Manual/?idx=343))

### 업무 규칙

- **문자 유형과 단가(매뉴얼 기준):** 단문 SMS는 90byte까지 건당 33원, 장문 LMS는 2,000byte까지 건당 77원, 이미지를 붙인 MMS는 건당 187원입니다. 한약 복용 관리에서 보내는 문자는 LMS로만 나갑니다. ([OK차트: SMS 보내기 - 문자보내기](https://www.okmedi.net/Manual/?idx=376)), ([OK차트: SMS, 예약플래너, 한약복용관리 환경설정](https://www.okmedi.net/Manual/?idx=338))
- **광고 표기:** 광고성 문자에는 `(광고)` + 병원 상호, 무료 수신거부 080 번호, 회신 번호를 넣습니다. 병원은 거래 통신사에서 080 수신자 부담 번호(최저 요금제)를 받아 두어야 합니다. ([OK차트: 광고성 정보 전송 표기 의무 안내](https://www.okmedi.net/Manual/?idx=652)), ([OK차트: SMS, 예약플래너, 한약복용관리 환경설정](https://www.okmedi.net/Manual/?idx=338))
- **광고성 판정:** ([OK차트: 광고성 정보 전송 표기 의무 안내](https://www.okmedi.net/Manual/?idx=652)), ([OK차트: SMS 보내기 - 문자보내기](https://www.okmedi.net/Manual/?idx=376))
  - 광고가 아님(표기·수신 동의 불필요): 예약 확인, 계약 조건 안내, 수신자가 받을 권리가 있는 재화(택배) 안내, 결제 완료 안내.
  - 광고일 수 있음(정보통신망법에 맞춰 보내야 함): 새해 인사, 생일 축하, 안부, 한약 복용 안내, 방문 인사, 진료 시간·변경 안내, 휴진 안내, 이전 안내.
- **거래관계 예외:** 거래가 시작된 날부터 거래 종료 후 6개월까지는 수신 동의 없이도 광고성 정보를 보낼 수 있습니다. 한의원에서는 내원해 진료비를 낸 날이 거래 시작일이고, 상담만 하고 진료비를 내지 않았다면 거래관계로 보지 않습니다. 또 거래 과정에서 환자에게 직접 개인정보 수집·이용 동의와 연락처를 받은 경우에만 적용됩니다. ([OK차트: OKCRM - 수신동의 재 안내 검색](https://www.okmedi.net/Manual/?idx=950))
- **수신 동의 정기 확인(정보통신망법 제50조 제8항, 시행령 제62조의3, 2014-11-29 시행):** ([OK차트: 스팸 관련 개정 정보통신망법 시행령 및 안내서 Q&A](https://www.okmedi.net/Manual/?idx=725)), ([OK차트: 광고성 정보 정기적 수신동의 확인 안내 문자보내기](https://www.okmedi.net/Manual/?idx=697)), ([OK차트: OKCRM - 수신동의 재 안내 검색](https://www.okmedi.net/Manual/?idx=950))
  - 기한: 수신 동의일부터 2년마다, 2년째 되는 해의 동의일과 같은 날 전까지 확인합니다. 기한 안이면 아무 때나 보내도 되고, 기한이 비슷한 사람을 모아 일괄로 보내도 됩니다.
  - 필수 내용: 전송자 명칭, 수신 동의 사실과 동의 날짜, 동의 유지·철회 방법. 매뉴얼 예시 문구는 080 무료 전화를 철회 방법으로 씁니다.
  - 위반 시 3천만 원 이하 과태료(법 제76조).
  - 동의일 산정: 2014-11-29 이전에 받은 동의는 2014-11-29에 받은 것으로 봅니다(개정 시행령 부칙 제6조). 이후 건은 전산에 입력된 날짜를 씁니다. 동의한 달만 알고 날짜를 모르면 그 달 1일을 동의일로 봅니다.
  - 동의일 기록이 없으면 1년마다 전체에게 확인 문자를 보내는 방법도 있다고 안내합니다.
  - OK차트는 정기 확인 문구에 신환 등록일(`[F등록일]`)을 동의일로 씁니다. 따라서 "동의일 = 등록일"이라는 가정이 깔려 있습니다(추정). 재설계에서는 동의 일시를 따로 저장해야 합니다.
- **동의·거부 처리 결과 통지:** ([OK차트: 광고성 정보 수신 거부 관리하기](https://www.okmedi.net/Manual/?idx=698)), ([OK차트: OKCRM - 수신동의 재 안내 검색](https://www.okmedi.net/Manual/?idx=950)), ([OK차트: 개인정보동의 서명(싸인패드, 펜차트)](https://www.okmedi.net/Manual/?idx=343))
  - 의사 표시(동의, 거부, 동의 철회)를 받은 날부터 14일 안에 처리 결과를 알립니다.
  - 필수 내용: 전송자 명칭, 동의·거부·철회 사실, 의사를 표시한 날짜, 처리 결과.
  - 구두로 알려도 되지만, KISA는 분쟁 예방을 위해 문자 통지를 권합니다.
  - 이 통지는 광고가 아니므로 `(광고)`·080 표기가 필요 없습니다.
  - 알리지 않거나 14일을 넘기면 1천만 원 이하 과태료.
- **수신 거부 플래그의 효과:** 환자 관리 정보의 "SMS 거부"를 체크하면 예약 문자를 뺀 모든 문자 발송에서 빠집니다. 개인정보 수집·이용에는 동의했지만 광고 수신만 거부한 경우에도 이 플래그를 씁니다. 개인정보 이용 동의는 미정·동의·거부 세 값입니다. ([OK차트: 관리정보, 가족관리, 소개자 등 입력](https://www.okmedi.net/Manual/?idx=349)), ([OK차트: 개인정보동의 서명(싸인패드, 펜차트)](https://www.okmedi.net/Manual/?idx=343))
- **외부 문자 업체 이용:** 병원이 외부 업체(예: 문자나라)로 수신 동의 문자를 보내려면 환자에게 개인정보 제3자 제공 동의를 받고, 홈페이지나 원내에 제공 사실(업체명, 제공 항목: 이름·휴대폰 번호)을 게시해야 합니다. ([OK차트: OKCRM - 수신동의 재 안내 검색](https://www.okmedi.net/Manual/?idx=950))
- **발신번호 등록제(전기통신사업법 제84조, 2015-10-08 시행):** 발신번호로 쓸 병원 전화의 이용증명원(가입사실 확인서)과 사업자등록증을 내야 합니다. 통신사별 서류명은 KT 이용증명원, LG U+ 가입사실 확인서, SKT 이용계약 등록사항 증명서입니다. 별도로 문자 서비스 약관 동의가 필요합니다. ([OK차트: 문자보내기 발신번호등록제 증빙서류 제출](https://www.okmedi.net/Manual/?idx=651))
- **전송자격인증제(서브 사용자):** 대표자 말고 직원 계정으로 문자를 보내려면 직원마다 재직증명서와 발신번호 사용권한 신청서(직원·대표자 모두 서명)를 내야 합니다. 근거는 전송자격인증제 고시 가이드라인 3차 개정 "2.2 이용자 관리의 적정성 - 계정관리"입니다. ([OK차트: 문자보내기 서브사용자 서류 제출 안내](https://www.okmedi.net/Manual/?idx=1321))
- **발송자 본인 확인:** 대표자는 반드시, 직원은 문자를 쓰는 계정마다 본인확인기관 인증을 거쳐 그 결과를 계정에 연결합니다. ([OK차트: 문자보내기 사용권한 부여 및 본인인증 안내](https://www.okmedi.net/Manual/?idx=1322))
  - 로그인 후 첫 발송(예약 발송 포함 모든 유형)에서 인증을 요구하고, 프로그램을 끌 때까지 유지합니다.
  - 수동 발송은 추가 인증이 필요하고, 인증 후 8시간이 지나거나 500건을 넘으면 다시 인증합니다.
- **번호도용 문자차단:** 휴대폰 번호를 발신번호로 쓰는데 그 번호에 통신사의 "번호도용 문자차단" 부가서비스가 걸려 있으면, 시스템에는 전송된 것으로 보여도 통신사가 발신을 막습니다. 해지 후 약 1주일 뒤부터 발송됩니다. 그래서 매뉴얼은 대량 발송 전에 다른 번호로 테스트 발송해 보라고 권합니다. ([OK차트: 번호도용 문자차단 서비스](https://www.okmedi.net/Manual/?idx=880)), ([OK차트: 문자보내기 발신번호등록제 증빙서류 제출](https://www.okmedi.net/Manual/?idx=651))
- **이탈자 판정:** 설정 기간 동안 N회 이상 내원한 환자 중, 기간 끝 이후 오늘까지 진료 기록이 없는 환자를 이탈자로 봅니다. 내원 여부는 진료 기록 유무로만 판정하고 급여·비급여를 구분하지 않습니다. 보험 초진·재진 구분과는 무관합니다. ([OK차트: OKCRM - 이탈자 검색](https://www.okmedi.net/Manual/?idx=945))

### 현행과 다른 점

- **변수 문법과 날짜 서식:** 현행은 `#{변수명}`이고, OK차트는 `[F…]` 필드 변환을 씁니다. OK차트는 같은 예약 일시를 여러 서식으로 제공합니다. 현행에서 쓸 수 있는 변수 목록과 서식은 이 문서에서 확인하지 못했습니다. ([OK차트: SMS 보내기 - 문자보내기](https://www.okmedi.net/Manual/?idx=376)), ([OK차트: 광고성 정보 정기적 수신동의 확인 안내 문자보내기](https://www.okmedi.net/Manual/?idx=697))

  | OK차트 변수 | 치환 결과 |
  |---|---|
  | `[F이름]` | 환자 이름 |
  | `[F처방]` | 처방명 |
  | `[F등록일]` | 신환 등록일 |
  | `[F예약L]` / `[F예약S]` | `MM월DD일 오전/오후 HH시mm분` / `DD일 오전/오후 HH시mm분` |
  | `[F예약LD]` / `[F예약SD]` / `[F예약DD]` | `MM월DD일E요일 오전/오후 HH시mm분` / `DD일E요일 …` / `E요일 오전/오후 HH시mm분` |
  | `[F예약SS]` | `오전/오후 HH시mm분` |
  | `[F생일L]` / `[F생일S]` | `YYYY년MM월DD일` / `MM월DD일` |

- **수신 거부 모델:** OK차트는 환자 한 명에 "SMS 거부" 플래그 하나만 두고, 예약 문자만 예외로 보냅니다. 현행은 광고 수신 동의와 알림·공지 수신 동의를 따로 두고, 병원 등록과 080 환자 직접 등록을 구분합니다. OK차트의 080 거부는 전화로 받아 직원이 수동으로 체크합니다. ([OK차트: 관리정보, 가족관리, 소개자 등 입력](https://www.okmedi.net/Manual/?idx=349)), ([OK차트: 광고성 정보 전송 표기 의무 안내](https://www.okmedi.net/Manual/?idx=652))
- **광고 표기 적용:** OK차트는 광고 문구를 직원이 "광고안내표기" 버튼으로 직접 넣습니다. 현행은 `messageType: 광고`이면 머리말·꼬리말을 자동으로 붙입니다. 야간(20:50–08:00) 광고 차단 규칙은 매뉴얼에서 찾지 못했습니다. ([OK차트: 광고성 정보 전송 표기 의무 안내](https://www.okmedi.net/Manual/?idx=652))
- **중복 번호 처리:** OK차트는 중복 번호를 검사해 한 명에게만 보내도록 체크한 뒤 나머지를 목록에서 지우는 한 가지 방식입니다. 현행 `send_one`에 해당하고, 현행은 `send_each`·`send_all`도 있습니다. ([OK차트: SMS 보내기 - 문자보내기](https://www.okmedi.net/Manual/?idx=376))
- **비용 정산:** OK차트는 선불 적립식입니다. 계좌 입금(업무 시간 외 입금은 다음 날 오전 적립)이나 카드 결제로 적립금을 채우고 차감합니다. 현행은 결제수단 등록과 청구서 단가(`/billing/invoices/unit-prices`) 기반이라 후불로 보입니다(추정). ([OK차트: 문자메시지 비용을 카드로 결제하여 적립하기](https://www.okmedi.net/Manual/?idx=711))
- **복용 관리 대상 등록:** OK차트는 한약 처방 환자 목록에서 직원이 골라 "복용 관리"에 넣어야 콜 일정이 생깁니다. 현행은 비급여 처방·패키지가 생기면 자동으로 관리 대상이 되고, 규칙·프로그램이 연락 일정을 만듭니다. OK차트의 진행 상태·해피콜 완료 체크는 현행 실행 로그 완료(`complete`)에 대응합니다(추정). ([OK차트: 한약복용환자 내원콜 관리](https://www.okmedi.net/Manual/?idx=414))
- **전송 이력 범위:** OK차트는 환자 차트에서 그 환자의 전송 내역을 바로 보고, 전체 내역은 전송 완료 / 전송 대기로 나눠 기간 조회합니다. 예약 건 취소는 전송 대기 목록에서 합니다. 현행 전송 내역은 발송 그룹 단위 목록이 중심이고, 환자 단위 이력 화면은 이 문서에서 보이지 않습니다. ([OK차트: SMS 보내기 - 문자보내기](https://www.okmedi.net/Manual/?idx=376))
- **발신번호 증빙:** OK차트는 이용증명원과 사업자등록증을 팩스·카카오 채널로 한메디에 냅니다. 현행은 화면에서 명의(본인/의료기관)를 고르고 본인인증과 1개월 이내 증명원 첨부로 신청합니다. ([OK차트: 문자보내기 발신번호등록제 증빙서류 제출](https://www.okmedi.net/Manual/?idx=651))

## 미확인·추정

- `/crm` 자체로 들어오면 매칭되는 기본 자식이 없어 `RouterView`가 비어 보입니다(추정). 리다이렉트 코드는 찾지 못했습니다.
- `crm-nonbenefit-patients`는 페이지 권한 메타가 없어 `고객관리` 권한만 있으면 열립니다. `l0e`가 `route.matched`에서 path가 같은 레코드의 `meta`만 보기 때문입니다.
- v1 연락 목록의 "전체 / 스케줄러 / 직접 연락", "오늘 / 내일"은 라벨만 확인했고, 정확한 필터 파라미터는 추적하지 않았습니다(추정).
- `PATCH /crm/contact-list/scheduler/{logId}`의 본문 키는 확인하지 못했습니다.
- `/crm/contacts`(v1)와 `/crm/contacts-v2`가 둘 다 prod에 등록되어 있습니다. 사이드바가 어느 쪽을 노출하는지는 이 문서에서 확인하지 않았습니다.
- 콘텐츠 미리보기의 공유 버튼은 "(데모)" 문구로 보아 내부 미리보기 전용입니다. 실제 환자용 열람 페이지는 다른 도메인에 있다고 추정합니다.
- 최상위 `/message` 라우트(`modules/MessageView.js`)는 이 영역의 `MessageView` 컴포넌트와 별개 모듈로 보입니다. 용도는 확인하지 못했습니다.
- 트리거 엔진 로그 상태 중 `skipped`/`failed`는 캘린더 칩에서만 확인했습니다. 서버 전체 상태 목록은 알 수 없습니다.
