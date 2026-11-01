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

## 미확인·추정

- `/crm` 자체로 들어오면 매칭되는 기본 자식이 없어 `RouterView`가 비어 보입니다(추정). 리다이렉트 코드는 찾지 못했습니다.
- `crm-nonbenefit-patients`는 페이지 권한 메타가 없어 `고객관리` 권한만 있으면 열립니다. `l0e`가 `route.matched`에서 path가 같은 레코드의 `meta`만 보기 때문입니다.
- v1 연락 목록의 "전체 / 스케줄러 / 직접 연락", "오늘 / 내일"은 라벨만 확인했고, 정확한 필터 파라미터는 추적하지 않았습니다(추정).
- `PATCH /crm/contact-list/scheduler/{logId}`의 본문 키는 확인하지 못했습니다.
- `/crm/contacts`(v1)와 `/crm/contacts-v2`가 둘 다 prod에 등록되어 있습니다. 사이드바가 어느 쪽을 노출하는지는 이 문서에서 확인하지 않았습니다.
- 콘텐츠 미리보기의 공유 버튼은 "(데모)" 문구로 보아 내부 미리보기 전용입니다. 실제 환자용 열람 페이지는 다른 도메인에 있다고 추정합니다.
- 최상위 `/message` 라우트(`modules/MessageView.js`)는 이 영역의 `MessageView` 컴포넌트와 별개 모듈로 보입니다. 용도는 확인하지 못했습니다.
- 트리거 엔진 로그 상태 중 `skipped`/`failed`는 캘린더 칩에서만 확인했습니다. 서버 전체 상태 목록은 알 수 없습니다.
