# 아키텍처 지도

라우트 → 화면 → 컴포넌트 → 훅 → API 관계를 `restored/` 트리에서 정적으로 추출한 문서입니다. 재생성: `pnpm architecture`

- **전용 컴포넌트:** 화면 이름으로 시작하는 컴포넌트 (`OcsView` → `OcsViewList`, `OcsViewListTable`). 트리에서 **굵게** 표시하고 안까지 펼쳤습니다
- **공유 컴포넌트 ↗:** 그 밖의 컴포넌트. 이름만 적었고, API를 호출하는 컴포넌트는 [component-api.md](component-api.md)로 링크했습니다
- **화면 API:** 화면과 전용 컴포넌트가 직접 쓰는 훅·호출. **전체 도달:** 공유 컴포넌트까지 따라가 닿는 API 수 (스토어 제외)
- **경계:** Pinia 스토어, 라우터, axios 인터셉터에서는 탐색을 멈춥니다. 스토어 API는 [스토어](#스토어) 절에 따로 있습니다
- **훅:** `use…Query` / `use…Mutation` 바인딩과 `queryClient.prefetchQuery`로 미리 불러오는 `prefetch…Query`. 훅을 거치지 않는 호출은 `(직접)`. 엔드포인트는 `메서드 클라이언트 경로`, 경로의 `{…}`는 복원 코드의 템플릿 식입니다
- **원격:** `component-module`로 federation 원격 앱(bi, finance, portal 등)을 띄우는 화면. 원격 코드는 이 번들에 없어 API가 비어 있습니다
- 정적 도달 범위이므로 조건부 렌더링·사용자 동작에 따라 실제로는 호출되지 않을 수 있습니다
- 엔드포인트 → 사용처 역색인: [endpoint-screens.md](endpoint-screens.md) · 데이터: `rea-output/architecture.json`

## 클라이언트

| 이름 | baseURL | 파일 |
|---|---|---|
| `accountClient` | `"https://auth-api.upstream.co.kr/api"` | [api/MembersView/client.js](../restored/api/MembersView/client.js) |
| `accountApplicationClient` | `"https://auth-api.upstream.co.kr/api"` | [api/accountApplications/client.js](../restored/api/accountApplications/client.js) |
| `authClient` | `"https://auth-api.upstream.co.kr/api/auth"` | [api/clients/authClient.js](../restored/api/clients/authClient.js) |
| `syncClient` | `"https://sync-api.upstream.co.kr/v1"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `emrClient` | `"https://emr-api.upstream.co.kr"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `staticClient` | `"https://static.upstream.co.kr/upstream-emr/master"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `crmClient` | `"https://crm-api.upstream.co.kr"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `accountClient` | `"https://auth-api.upstream.co.kr/api"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `thesooClient` | `"https://public-api.thesoo.co"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `medistreamClient` | `"https://public-api.medistream.co.kr/"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `insuranceClient` | `"https://insurance-api.upstream.co.kr"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `biClient` | `"https://public-api.upstream.co.kr/bi"` | [api/clients/index.js](../restored/api/clients/index.js) |
| `jusoClient` | `"https://business.juso.go.kr/addrlink/addrLinkApi.do"` | [api/clients/jusoClient.js](../restored/api/clients/jusoClient.js) |
| `portalClient` | `"https://public-api.upstream.co.kr/portal"` | [api/clients/portalClient.js](../restored/api/clients/portalClient.js) |
| `webClient` | `baseURL$` | [api/clients/webClient.js](../restored/api/clients/webClient.js) |

## 라우트

| 경로 | 이름 | 화면 | meta · 조건 | 전용 / 공유 컴포넌트 | 화면 API | 전체 도달 API |
|---|---|---|---|---|---|---|
| `/` | home | → `() => ({ name: iDt() })` | `requiresAuth` | | | |
| [`/crm/consult-script`](#route-crm-consult-script) | crm-consult-script | CrmConsultScriptView | 권한 `연락목록` · `requiresAuth` | 3 / 11 | 7 | 102 |
| [`/login`](#route-auth-login) | auth-login | LoginView |  | 1 / 4 | 3 | 3 |
| `/login/soo` | soo-login | → `{ name: "auth-login" }` |  | | | |
| [`/login/unlock`](#route-auth-unlock) | auth-unlock | AccountUnlockView |  | 3 / 10 | 2 | 2 |
| [`/auth/callback`](#route-auth-callback) | auth-callback | AccountApplicationsAuth |  | 1 / 3 | 7 | 7 |
| [`/logout`](#route-logout) | logout | LogoutView | `requiresAuth` | 1 / 0 | 0 | 0 |
| [`/onboarding`](#route-auth-onboarding) | auth-onboarding | OnboardingView |  | 1 / 8 | 2 | 13 |
| [`/sign-up/soo`](#route-soo-sign-up) | soo-sign-up | SooSignUpView |  | 1 / 0 | 0 | 0 |
| [`/sign-up/soo/form`](#route-soo-sign-up-form) | soo-sign-up-form | SooSignUpFormView |  | 1 / 3 | 6 | 8 |
| [`/sign-up/soo/complete`](#route-soo-sign-up-complete) | soo-sign-up-complete | SooSignUpCompleteView |  | 1 / 1 | 0 | 0 |
| [`/sign-up/ondang`](#route-ondang-sign-up) | ondang-sign-up | OndangSignUpView |  | 1 / 0 | 0 | 0 |
| [`/sign-up/ondang/form`](#route-ondang-sign-up-form) | ondang-sign-up-form | OndangSignUpFormView |  | 1 / 8 | 7 | 8 |
| [`/sign-up/ondang/complete`](#route-ondang-sign-up-complete) | ondang-sign-up-complete | OndangSignUpCompleteView |  | 1 / 1 | 0 | 0 |
| [`/terms/:documentNumber`](#route-terms-content) | terms-content | TermsContentView |  | 1 / 0 | 1 | 1 |
| [`/terms/doctalk/:type`](#route-doctalk-terms) | doctalk-terms | DoctalkTermsView |  | 1 / 0 | 0 | 0 |
| [`/preview`](#route-component-preview) | component-preview | ComponentPreview | `requiresAuth` · `usesGlobalLayout` | 1 / 29 | 0 | 4 |
| [`/canvas`](#route-canvas) | canvas | CanvasView |  | 6 / 17 | 12 | 12 |
| [`/desk`](#route-desk) | desk | DeskSuspense | `requiresAuth` · `usesGlobalLayout` | 1 / 3 | 0 | 324 |
| [`/treatment`](#route-treatment) | treatment | TreatmentSuspense | 권한 `진료` · `requiresAuth` · `usesGlobalLayout` | 1 / 4 | 0 | 19 |
| [`/treatment/repeat-results`](#route-treatment-repeat-results) | treatment-repeat-results | TreatmentRepeatResultsView | `usesGlobalLayout` | 2 / 4 | 2 | 293 |
| [`/treatment-rooms`](#route-treatment-rooms) | treatment-rooms | TreatmentRoomsSuspense | 권한 `치료실` · `requiresAuth` · `usesGlobalLayout` | 1 / 4 | 0 | 329 |
| [`/tablet/auth-link`](#route-tablet-auth-link) | tablet-auth-link | TabletAuthLinkView |  | 1 / 0 | 2 | 2 |
| [`/tablet/treatment-rooms`](#route-tablet-treatment-rooms) | tablet-treatment-rooms | TabletTreatmentRoomsView | 권한 `치료실` · `requiresAuth` | 1 / 1 | 0 | 329 |
| [`/appointment-planner`](#route-appointment-planner) | appointment-planner | AppointmentPlannerView | 권한 `예약관리` · `requiresAuth` · `usesGlobalLayout` | 11 / 49 | 18 | 305 |
| [`/ocs`](#route-ocs) | ocs | OcsView | 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout` | 21 / 49 | 19 | 80 |
| [`/ocs/prescription/list`](#route-tangjeon-prescription-list) | tangjeon-prescription-list | TangjeonPrescriptionListView | 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout` | 2 / 17 | 11 | 163 |
| [`/ocs/prescription/create`](#route-tangjeon-prescription-create) | tangjeon-prescription-create | TangjeonPrescriptionCreateView | 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout` | 2 / 15 | 12 | 19 |
| [`/ocs-v2-herb-order-create`](#route-ocs-v2-herb-order-create) | ocs-v2-herb-order-create | OndangGateView | 권한 `메디원탕` · `requiresAuth` · `usesGlobalLayout` | 1 / 5 | 2 | 88 |
| [`/ocs-v2-herb-order-list`](#route-ocs-v2-herb-order-list) | ocs-v2-herb-order-list | OndangGateView | 권한 `메디원탕` · `requiresAuth` · `usesGlobalLayout` | 1 / 5 | 2 | 88 |
| [`/crm`](#route-crm) | crm | CrmView | 권한 `고객관리` · `requiresAuth` · `usesGlobalLayout` | 1 / 6 | 1 | 3 |
| [`/crm/routines`](#route-crm-routines) | crm-routines | CrmRoutineView | `Yu()` | 19 / 27 | 10 | 46 |
| [`/crm/routines/new`](#route-crm-routines-new) | crm-routines-new | CrmRoutineCanvasView | `Yu()` | 16 / 21 | 6 | 43 |
| [`/crm/routines/:routineId`](#route-crm-routines-detail) | crm-routines-detail | CrmRoutineCanvasView | `Yu()` | 16 / 21 | 6 | 43 |
| [`/crm/reminder`](#route-crm-reminder) | crm-reminder | CrmReminderView | `Yu()` | 8 / 13 | 0 | 1 |
| [`/crm/nonbenefit-patients`](#route-crm-nonbenefit-patients) | crm-nonbenefit-patients | NonBenefitPatientsView |  | 15 / 27 | 17 | 307 |
| [`/crm/contacts`](#route-crm-contacts) | crm-contacts | CrmContactsView | 권한 `연락목록` | 17 / 38 | 20 | 311 |
| [`/crm/contacts-v2`](#route-crm-contacts-v2) | crm-contacts-v2 | CrmContactsView | 권한 `연락목록` | 14 / 55 | 21 | 337 |
| [`/crm/soo-scheduler`](#route-crm-soo-scheduler) | crm-soo-scheduler | CrmSooSchedulerView | 권한 `연락목록` | 7 / 22 | 8 | 88 |
| [`/crm/patients`](#route-crm-emr-patients) | crm-emr-patients | EmrPatientsView | 권한 `환자목록` | 6 / 21 | 6 | 298 |
| [`/crm/message`](#route-crm-message) | crm-message | MessageView | 권한 `일반문자` | 22 / 43 | 42 | 326 |
| [`/crm/contents/view/:token`](#route-crm-contents-view) | crm-contents-view | CrmContentPatientPreview | 권한 `일반문자` | 1 / 0 | 2 | 2 |
| [`/crm/message/send-completed`](#route-crm-message-send-completed) | crm-message-send-completed | MessageSendCompletedView | 권한 `일반문자` | 1 / 1 | 1 | 1 |
| [`/crm/message/results`](#route-crm-message-results) | crm-message-results | MessageResultsView | 권한 `전송이력` | 16 / 28 | 13 | 18 |
| [`/crm/refusal`](#route-crm-refusal) | crm-refusal | CrmRefusalView | 권한 `수신거부목록` | 9 / 27 | 6 | 299 |
| [`/message`](#route--message) |  | MessageView | `requiresAuth` | 0 / 0 | 0 | 0 |
| [`/claim`](#route--claim) |  | ClaimView | 권한 `청구` · `requiresAuth` · `usesGlobalLayout` | 1 / 3 | 0 | 0 |
| [`/claim/hira`](#route-claim-hira) | claim-hira | ClaimHiraView | 권한 `심평원청구` | 1 / 4 | 0 | 338 |
| [`/claim/hira-submit-items`](#route-claim-hira-submit-items) | claim-hira-submit-items | HiraSubmitItemsView | 권한 `추나첩약제출현황` | 20 / 25 | 15 | 43 |
| [`/claim/medical-aids`](#route-claim-medical-aids) | claim-medical-aids | MedicalAidsView | 권한 `의료급여진료승인현황` | 10 / 17 | 8 | 9 |
| [`/claim/home-visit`](#route-claim-home-visit) | claim-home-visit | ClaimHomeVisitView | 권한 `청구` | 1 / 5 | 2 | 2 |
| [`/claim/telemedicine-pilot`](#route-claim-telemedicine-pilot) | claim-telemedicine-pilot | ClaimTelemedicinePilotView | 권한 `청구` | 1 / 3 | 2 | 2 |
| [`/claim/year-settlement`](#route-year-settlement) | year-settlement | YearSettlement | 권한 `청구` | 14 / 19 | 6 | 6 |
| [`/insurance-inquiry`](#route-insurance-inquiry) | insurance-inquiry | InsuranceInquiryView | `requiresAuth` · `usesGlobalLayout` | 2 / 11 | 11 | 115 |
| [`/electronic-signature`](#route-electronic-signature) | electronic-signature | ElectronicSignatureView | `requiresAuth` · `usesGlobalLayout` | 1 / 8 | 1 | 22 |
| [`/setting`](#route-setting) | setting | SettingView | 권한 `설정` · `requiresAuth` · `usesGlobalLayout` | 1 / 2 | 1 | 1 |
| [`/setting/common`](#route-setting-common) | setting-common | SettingCommonView | 권한 `기본설정` | 8 / 16 | 24 | 31 |
| [`/setting/telemedicine`](#route-setting-telemedicine) | setting-telemedicine | SettingTelemedicineView | 권한 `기본설정` | 1 / 2 | 0 | 8 |
| [`/setting/service-integration`](#route-setting-service-integration) | setting-service-integration | SettingServiceIntegrationView | 권한 `기본설정` | 1 / 6 | 3 | 13 |
| [`/setting/hospital`](#route-setting-hospital-info) | setting-hospital-info | SettingHospitalView | 권한 `병원정보설정` | 6 / 11 | 28 | 29 |
| [`/setting/treatment`](#route-setting-treatment) | setting-treatment | SettingTreatmentView | 권한 `진료설정` | 7 / 14 | 14 | 16 |
| [`/setting/prescription`](#route-setting-prescription) | setting-prescription | SettingPrescriptionView | 권한 `처방수가설정` | 81 / 66 | 111 | 137 |
| [`/setting/templates`](#route-setting-templates) | setting-templates | SettingEditorTemplates | 권한 `상용구설정` | 8 / 16 | 19 | 19 |
| [`/setting/caller-numbers`](#route-setting-caller-numbers) | setting-caller-numbers | CrmSettingCallerNumbers | 권한 `발신번호설정` | 7 / 17 | 7 | 19 |
| [`/setting/consult-templates`](#route-setting-consult-templates) | setting-consult-templates | CrmSettingConsultTemplates | 권한 `연락목록` | 1 / 1 | 0 | 7 |
| [`/setting/message-templates`](#route-setting-message-templates) | setting-message-templates | CrmSettingMessageTemplates | 권한 `메시지템플릿관리` | 1 / 1 | 0 | 36 |
| [`/setting/contents`](#route-setting-contents) | setting-contents | CrmSettingContents | 권한 `일반문자` | 1 / 1 | 0 | 9 |
| [`/setting/account-permission`](#route-setting-account-permission) | setting-account-permission | AccountPermissionsView | 권한 `계정권한설정` | 8 / 17 | 11 | 19 |
| [`/setting/account-history`](#route-setting-account-history) | setting-account-history | AccountHistoryView |  | 5 / 2 | 0 | 0 |
| [`/setting/tablet`](#route-setting-tablet) | setting-tablet | SettingTabletView |  | 1 / 3 | 0 | 18 |
| [`/setting/document-management`](#route-setting-document-management) | setting-document-management | SettingDocumentManagementView |  | 1 / 3 | 0 | 18 |
| [`/setting/schedule`](#route-setting-schedule) | setting-schedule | ScheduleView | 권한 `진료스케줄설정` | 7 / 13 | 8 | 8 |
| [`/setting/billing`](#route-setting-billing) | setting-billing | CrmBillingView | 권한 `결제메뉴접근` · `supportsMobile` | 1 / 8 | 1 | 15 |
| [`/setting/appointment`](#route-setting-appointment) | setting-appointment | SettingAppointment | 권한 `예약설정` | 4 / 13 | 9 | 40 |
| [`/setting/mcp-tokens`](#route-setting-mcp-tokens) | setting-mcp-tokens | MCPTokens | `requiresAuth` · `requiresDemoAccountInPrd` · `Yu() \|\| Un()` | 1 / 8 | 5 | 5 |
| [`/setting/mcp-pending-contacts`](#route-setting-mcp-pending-contacts) | setting-mcp-pending-contacts | McpPendingContacts | `requiresAuth` · `requiresDemoAccountInPrd` · `Yu() \|\| Un()` | 1 / 4 | 0 | 16 |
| [`/setting/expense-collection`](#route-setting-expense-collection) | setting-expense-collection | SettingExpenseCollectionView |  | 1 / 1 | 0 | 0 |
| [`/remote-settlement`](#route-remote-settlement) | remote-settlement | RemoteSettlementView | `requiresAuth` · `usesGlobalLayout` | 6 / 4 | 2 | 2 |
| [`/help`](#route--help) |  | HelpView | `requiresAuth` | 0 / 0 | 0 | 0 |
| [`/analytics`](#route-analytics) | analytics | AnalyticsView | 권한 `경영지표` · `requiresAuth` · `usesGlobalLayout` | 1 / 2 | 0 | 0 |
| [`/analytics/revenue`](#route-analytics-revenue) | analytics-revenue | RevenueTableView → 원격 `upstream-bi-frontend/RevenueTableContainer` | 권한 `경영지표` | 1 / 1 | 0 | 0 |
| [`/analytics/appointment`](#route-analytics-appointment) | analytics-appointment | AppointmentTableView → 원격 `upstream-bi-frontend/AppointmentTableContainer` | 권한 `경영지표` | 1 / 1 | 0 | 0 |
| [`/analytics/patient`](#route-analytics-patient) | analytics-patient | PatientTableView → 원격 `upstream-bi-frontend/PatientTableContainer` | 권한 `경영지표` | 1 / 1 | 0 | 0 |
| [`/analytics/soo-dashboard`](#route-analytics-soo-dashboard) | analytics-soo-dashboard | SooDashboardView → 원격 `upstream-bi-frontend/SooDashboardContainer` |  | 1 / 1 | 0 | 0 |
| [`/analytics/incoming-path`](#route-analytics-incoming-path) | analytics-incoming-path | IncomingPathTableView → 원격 `upstream-bi-frontend/IncomingPathTableContainer` | 권한 `경영지표` | 1 / 3 | 0 | 292 |
| [`/analytics/doctor`](#route-analytics-doctor) | analytics-doctor | DoctorTableView → 원격 `upstream-bi-frontend/DoctorTableContainer` | 권한 `경영지표` | 1 / 1 | 0 | 0 |
| [`/finance`](#route-finance) | finance | FinanceView | `requiresAuth` · `usesGlobalLayout` | 1 / 2 | 0 | 0 |
| [`/finance/daily-briefing`](#route-finance-daily-briefing) | finance-daily-briefing | DailyBriefingView |  | 1 / 1 | 0 | 0 |
| [`/finance/expenses`](#route-finance-expenses) | finance-expenses | ExpensesView |  | 1 / 1 | 0 | 0 |
| [`/finance/pnl`](#route-finance-pnl) | finance-pnl | PnlView |  | 1 / 1 | 0 | 0 |
| [`/finance/budget`](#route-finance-budget) | finance-budget | BudgetView |  | 1 / 1 | 0 | 0 |
| [`/finance/cashflow`](#route-finance-cashflow) | finance-cashflow | CashflowView |  | 1 / 1 | 0 | 0 |
| [`/challenge`](#route-challenge) | challenge | ChallengeView → 원격 `upstream-bi-frontend/SooRisingContainer` | `requiresAuth` · `usesGlobalLayout` | 1 / 3 | 2 | 5 |
| [`/portal`](#route-portal) | portal | SooView → 원격 `upstream-emr-portal/SooPortalContainer` | `requiresAuth` · `usesGlobalLayout` · `supportsMobile` | 1 / 1 | 0 | 0 |
| [`/library`](#route-library-window) | library-window | LibraryWindowView → 원격 `upstream-emr-portal/SooPortalContainer` | `requiresAuth` | 1 / 2 | 0 | 1 |
| [`/members/:pathMatch(.*)*`](#route-members) | members | MembersView | `requiresAuth` · `usesGlobalLayout` · `supportsMobile` | 1 / 3 | 2 | 296 |
| `/:pathMatch(.*)*` | not-found | → `() => ({ name: "home" })` |  | | | |

## 앱 셸

모든 화면을 감싸는 [App](../restored/components/app/App.vue)과 `components/app/`·`Layout*` 컴포넌트입니다.

- 스토어: `useOnboardingGuideSessionStore`, `usePatientStore`, `useSocketClientStore`, `useToastNotificationStore`, `useTreatmentStore`

<details>
<summary>컴포넌트 트리</summary>

- [AccountWorkTypeRequiredModal](component-api.md#c-components-account-accountworktyperequiredmodal) ↗
- AiAgentTrigger ↗
- BaseButton ↗
- GlobalIntakeLinkSendModal ↗
- **LayoutView**
  - GuideFloatingTrigger ↗
  - GuideReentryTooltip ↗
  - [HeaderLayout](component-api.md#c-components-header-headerlayout) ↗
  - [OnboardingGuidePanel](component-api.md#c-components-onboarding-onboardingguidepanel) ↗
  - [PasswordResetNoticeHost](component-api.md#c-components-password-passwordresetnoticehost) ↗
  - ShortcutHintOverlay ↗
  - [SidebarLayout](component-api.md#c-components-sidebar-sidebarlayout) ↗
- SooMigrationOverlay ↗

</details>

<details>
<summary>훅 → API (17)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostSettingsDevicesMutation` | `POST emrClient <SETTINGS_DEVICES_PATH>` |
| `useSettingsNotificationsQuery` | `GET emrClient <SETTINGS_NOTIFICATIONS_PATH>` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useTreatmentsSnapshotQuery` | `GET emrClient /treatments/snapshot` |
| `useUsersQuery` | `GET accountClient /users` |
| `getSettingsHospitals` (직접) | `GET emrClient /settings/hospitals` |
| `getSettingsRecord` (직접) | `GET emrClient /settings/record` |
| `getSettingsReferencesReimbursementAvailableDates` (직접) | `GET emrClient /settings/references/reimbursement-available-dates` |
| `getSettingsReferencesReimbursementCodes` (직접) | `GET emrClient /settings/references/reimbursement-codes` |
| `getDeskWaiting` (직접) | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `getJaboReimbursement20260101Json` (직접) | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>` |
| `getJaboReimbursement20260101Json` (직접) | `GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `getKcd20260101Json` (직접) | `GET staticClient <KCD_20250722_JSON_PATH>` |
| `getKcd20260101Json` (직접) | `GET staticClient <KCD_20260101_JSON_PATH>` |
| `getRareDiseases20241018Json` (직접) | `GET staticClient <RARE_DISEASES_20241018_JSON_PATH>` |

</details>

## 화면

<a id="route-crm-consult-script"></a>

### `/crm/consult-script` · crm-consult-script

- 화면: [CrmConsultScriptView](../restored/views/CrmConsultScriptView.vue)
- meta: 권한 `연락목록` · `requiresAuth`
- 컴포넌트: 전용 3 · 공유 11 · API: 화면 7 · 전체 도달 102
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- ContentDivider ↗
- **CrmConsultScriptScheduleList**
  - BaseTabBar ↗
- **CrmConsultScriptTemplatePane**
  - BaseSelectBox ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
- [CrmPatientMessageSendSidePanel](component-api.md#c-components-crm-crmpatientmessagesendsidepanel) ↗
- PatientLevelDot ↗
- [PatientMemo](component-api.md#c-components-patient-patientmemo) ↗
- PatientNameGenderAgeText ↗

</details>

<details>
<summary>훅 → API (7)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useConsultTemplatesGroupsTreeQuery` | `GET crmClient /consult-templates/groups/tree` |
| `useConsultTemplatesTemplatesByPrescriptionsQuery` | `POST crmClient /consult-templates/templates/by-prescriptions` |
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmTriggerEngineWorklistLogsPrescriptionCumulativeCountQuery` | `GET emrClient /crm/trigger-engine/worklist/logs/{logId}/prescription-cumulative-count` |
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `useMessagesPatientsTemplateVariablesByPatientIdQuery` | `GET crmClient /messages/patients/{args.patientId}/template-variables` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |

</details>

<a id="route-auth-login"></a>

### `/login` · auth-login

- 화면: [LoginView](../restored/views/LoginView.vue)
- 컴포넌트: 전용 1 · 공유 4 · API: 화면 3 · 전체 도달 3
- 스토어: `useDeskDateStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseTextInput ↗
- BaseTextInputButtonModule ↗
- ContentDivider ↗

</details>

<details>
<summary>훅 → API (3)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postLogin` (직접) | `POST authClient /login` |
| `postSsoLinkToken` (직접) | `POST authClient /sso/link-token` |

</details>

<a id="route-auth-unlock"></a>

### `/login/unlock` · auth-unlock

- 화면: [AccountUnlockView](../restored/views/AccountUnlockView.vue)
- 컴포넌트: 전용 3 · 공유 10 · API: 화면 2 · 전체 도달 2
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **AccountUnlockIdentityVerificationModal**
  - **AccountUnlockStepPhoneVerification**
    - BaseButton ↗
    - BaseLabel ↗
    - BaseTextInput ↗
    - BaseTextInputPlainModule ↗
    - OverlayScrollbar ↗
  - BaseButton ↗
  - BaseCloseButton ↗
  - BaseConfirmDialog ↗
  - CrmCommonStepSelectTelecom ↗
- BaseButton ↗
- BaseFeaturedIcon ↗
- BaseTextInput ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostUnlockConfirmOtpMutation` | `POST authClient /unlock/confirm-otp` |
| `usePostUnlockRequestOtpMutation` | `POST authClient /unlock/request-otp` |

</details>

<a id="route-auth-callback"></a>

### `/auth/callback` · auth-callback

- 화면: [AccountApplicationsAuth](../restored/components/account/AccountApplicationsAuth.vue)
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 7 · 전체 도달 7
- 스토어: `useAccountApplicationsAuthStore`, `useMembersSignUpStore`, `useSooSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- AccountApplicationsLayout ↗
- BaseConfirmDialog ↗
- MedistreamAuth ↗

</details>

<details>
<summary>훅 → API (7)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostAccountApplicationTokenMutation` | `POST accountApplicationClient /account-application/token` |
| `getAuthCheckSsoid` (직접) | `GET accountApplicationClient /auth/check-ssoid` |
| `getIntegrationsOnboardingSooProfile` (직접) | `GET accountApplicationClient /integrations/onboarding/soo/profile` |
| `getIntegrationsSoo` (직접) | `GET accountApplicationClient /integrations/soo` |
| `getIntegrationsMembers` (직접) | `GET accountApplicationClient <INTEGRATIONS_MEMBERS_PATH>` |
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postSsoMedistreamToken` (직접) | `POST authClient /sso/medistream/token` |

</details>

<a id="route-logout"></a>

### `/logout` · logout

- 화면: [LogoutView](../restored/views/LogoutView.vue)
- meta: `requiresAuth`
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 0 · 전체 도달 0
- 스토어: `useAiAgentStore`, `useClaimWarningStore`, `useDeskDateStore`, `useMedicalAidsStore`, `usePatientStore`, `useSocketClientStore`, `useToastNotificationStore`, `useTreatmentStore`, `useWindowStore`

<a id="route-auth-onboarding"></a>

### `/onboarding` · auth-onboarding

- 화면: [OnboardingView](../restored/views/OnboardingView.vue)
- 컴포넌트: 전용 1 · 공유 8 · API: 화면 2 · 전체 도달 13
- 스토어: `useSooSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- AccountApplicationsAuthGuard ↗
- [AccountApplicationsForm](component-api.md#c-components-account-accountapplicationsform) ↗
- AccountApplicationsLayout ↗
- [AccountApplicationsRejected](component-api.md#c-components-account-accountapplicationsrejected) ↗
- [AccountApplicationsRequested](component-api.md#c-components-account-accountapplicationsrequested) ↗
- AccountApplicationsStepIsHasUsedChart ↗
- [AccountApplicationsStepSelectChart](component-api.md#c-components-account-accountapplicationsstepselectchart) ↗
- [AccountApplicationWaiting](component-api.md#c-components-account-accountapplicationwaiting) ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAccountApplicationApplicationsQuery` | `GET accountApplicationClient /account-application/applications` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |

</details>

<a id="route-soo-sign-up"></a>

### `/sign-up/soo` · soo-sign-up

- 화면: [SooSignUpView](../restored/views/SooSignUpView.vue)
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 0 · 전체 도달 0
- 스토어: `useSooSignUpStore`

<a id="route-soo-sign-up-form"></a>

### `/sign-up/soo/form` · soo-sign-up-form

- 화면: [SooSignUpFormView](../restored/views/SooSignUpFormView.vue)
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 6 · 전체 도달 8
- 스토어: `useSooSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- [ServiceSignUpFormView](component-api.md#c-views-servicesignupformview) ↗

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsQuery` | `GET accountApplicationClient /terms` |
| `getIntegrationsOnboardingSooEmployees` (직접) | `GET accountApplicationClient /integrations/onboarding/soo/employees` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |
| `postIntegrationsOnboardingInsuranceSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/insurance/signup` |
| `postIntegrationsOnboardingSooSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/soo/signup` |
| `postIntegrationsSooLink` (직접) | `POST accountClient /integrations/soo/link` |

</details>

<a id="route-soo-sign-up-complete"></a>

### `/sign-up/soo/complete` · soo-sign-up-complete

- 화면: [SooSignUpCompleteView](../restored/views/SooSignUpCompleteView.vue)
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0
- 스토어: `useSooSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗

</details>

<a id="route-ondang-sign-up"></a>

### `/sign-up/ondang` · ondang-sign-up

- 화면: [OndangSignUpView](../restored/views/OndangSignUpView.vue)
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 0 · 전체 도달 0
- 스토어: `useAccountApplicationsAuthStore`, `useOndangSignUpStore`

<a id="route-ondang-sign-up-form"></a>

### `/sign-up/ondang/form` · ondang-sign-up-form

- 화면: [OndangSignUpFormView](../restored/views/OndangSignUpFormView.vue)
- 컴포넌트: 전용 1 · 공유 8 · API: 화면 7 · 전체 도달 8
- 스토어: `useOndangSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseCheckBox ↗
- BaseConfirmDialog ↗
- [OndangSignUpStepAccount](component-api.md#c-components-ondang-ondangsignupstepaccount) ↗
- OndangSignUpStepBusiness ↗
- OndangSignUpStepConfirm ↗
- OndangSignUpStepStaff ↗
- [OndangSignUpStepTerms](component-api.md#c-components-ondang-ondangsignupstepterms) ↗
- ServiceSignUpLayout ↗

</details>

<details>
<summary>훅 → API (7)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useIntegrationsOnboardingWontangProfileQuery` | `GET accountApplicationClient {INTEGRATIONS_ONBOARDING_WONTANG_PATH}/profile` |
| `useTermsQuery` | `GET accountApplicationClient /terms` |
| `getIntegrationsOnboardingSooProfile` (직접) | `GET accountApplicationClient /integrations/onboarding/soo/profile` |
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postIntegrationsOnboardingWontangSignup` (직접) | `POST accountApplicationClient {INTEGRATIONS_ONBOARDING_WONTANG_PATH}/signup` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |
| `postIntegrationsOnboardingSooSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/soo/signup` |

</details>

<a id="route-ondang-sign-up-complete"></a>

### `/sign-up/ondang/complete` · ondang-sign-up-complete

- 화면: [OndangSignUpCompleteView](../restored/views/OndangSignUpCompleteView.vue)
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0
- 스토어: `useOndangSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗

</details>

<a id="route-terms-content"></a>

### `/terms/:documentNumber` · terms-content

- 화면: [TermsContentView](../restored/views/TermsContentView.vue)
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 1 · 전체 도달 1

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMarketingAgreementTermsListQuery` | `GET medistreamClient /marketing-agreement/terms/list` |

</details>

<a id="route-doctalk-terms"></a>

### `/terms/doctalk/:type` · doctalk-terms

- 화면: [DoctalkTermsView](../restored/views/DoctalkTermsView.vue)
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 0 · 전체 도달 0

<a id="route-component-preview"></a>

### `/preview` · component-preview

- 화면: [ComponentPreview](../restored/components/component/ComponentPreview.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 29 · API: 화면 0 · 전체 도달 4
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseBadge ↗
- BaseButton ↗
- BaseButtonGroup ↗
- BaseButtonGroupItem ↗
- BaseCheckBox ↗
- BaseCheckBoxCard ↗
- BaseDialogModal ↗
- BaseDot ↗
- BaseDraggableTabBar ↗
- BaseDropDownSelect ↗
- BaseInputDropdown ↗
- BaseNoteEditor ↗
- BasePagination ↗
- BaseRadio ↗
- BaseSelect ↗
- BaseSelectableButton ↗
- BaseSidePanel ↗
- BaseTabBar ↗
- BaseTagsInput ↗
- BaseTagsInputDropDown ↗
- BaseTelephoneInput ↗
- BaseTextInput ↗
- BaseTextInputButtonModule ↗
- BaseTextInputPlainModule ↗
- BaseToggleSwitch ↗
- BaseTooltip ↗
- CollapsibleSection ↗
- CrmKakaoBrandMessageEditor ↗

</details>

<a id="route-canvas"></a>

### `/canvas` · canvas

- 화면: [CanvasView](../restored/views/CanvasView.vue)
- 컴포넌트: 전용 6 · 공유 17 · API: 화면 12 · 전체 도달 12
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseConfirmDialog ↗
- CanvasGridPane ↗
- CanvasVideoCaptureModal ↗
- **CanvasViewList**
  - BaseTabBar ↗
  - **CanvasViewPatientImageList**
    - BodyMapAnswerView ↗
    - **CanvasViewImageCard**
      - BaseTextInput ↗
      - CursorFollowingTooltip ↗
    - EmptyPatient ↗
    - OverlayScrollbar ↗
  - **CanvasViewTemplateList**
    - BaseTextInputPlainModule ↗
    - **CanvasViewImageUploader**
    - FileUploadButton ↗
- ContentDivider ↗
- PatientLevelDot ↗
- PatientNameGenderAgeText ↗
- UpCanvasToolbar ↗

</details>

<details>
<summary>훅 → API (12)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsCanvasImagesQuery` | `GET emrClient /patients/{id}/canvas/images/{iid}` |
| `prefetchRecordCanvasTemplatesCategoryIdQuery` | `GET emrClient /record/canvas/templates/category/{category}/id/{id}` |
| `useDeletePatientsCanvasImagesMutation` | `DELETE emrClient /patients/{id}/canvas/images/{iid}` |
| `useDeleteRecordCanvasTemplatesMutation` | `DELETE emrClient /record/canvas/templates/{id}` |
| `usePatchPatientsCanvasImagesNameMutation` | `PATCH emrClient /patients/{id}/canvas/images/{iid}/name` |
| `usePatchRecordCanvasTemplatesMutation` | `PATCH emrClient /record/canvas/templates/{id}` |
| `usePatientsCanvasImagesQuery` | `GET emrClient /patients/{id}/canvas/images` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostPatientsCanvasImagesMutation` | `POST emrClient /patients/{id}/canvas/images` |
| `usePostRecordCanvasTemplatesMutation` | `POST emrClient /record/canvas/templates` |
| `usePutPatientsCanvasImagesMutation` | `PUT emrClient /patients/{id}/canvas/images/{iid}` |
| `useRecordCanvasTemplatesQuery` | `GET emrClient /record/canvas/templates` |

</details>

<a id="route-desk"></a>

### `/desk` · desk

- 화면: [DeskSuspense](../restored/components/desk/DeskSuspense.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 0 · 전체 도달 324

<details>
<summary>컴포넌트 트리</summary>

- DeskView ↗
- RouteViewErrorFallback ↗
- RouteViewLoadingFallback ↗

</details>

<a id="route-treatment"></a>

### `/treatment` · treatment

- 화면: [TreatmentSuspense](../restored/components/treatment/TreatmentSuspense.vue)
- meta: 권한 `진료` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 4 · API: 화면 0 · 전체 도달 19

<details>
<summary>컴포넌트 트리</summary>

- RouteAccessDenied ↗
- RouteViewErrorFallback ↗
- RouteViewLoadingFallback ↗
- [TreatmentView](component-api.md#c-views-treatmentview) ↗

</details>

<a id="route-treatment-repeat-results"></a>

### `/treatment/repeat-results` · treatment-repeat-results

- 화면: [TreatmentRepeatResultsView](../restored/views/TreatmentRepeatResultsView.vue)
- meta: `usesGlobalLayout`
- 컴포넌트: 전용 2 · 공유 4 · API: 화면 2 · 전체 도달 293
- 스토어: `useRepeatedTreatmentStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseSidePanel ↗
- [DeskVisitPaymentCheckOut](component-api.md#c-components-desk-deskvisitpaymentcheckout) ↗
- **TreatmentRepeatResultsViewTable**
  - OverlayScrollbar ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchRecordQuery` | `GET emrClient /record/{input}` |
| `usePatchDeskWaitingByIdMutation_2` | `PATCH emrClient <"/desk/waiting/" + input.id>` |

</details>

<a id="route-treatment-rooms"></a>

### `/treatment-rooms` · treatment-rooms

- 화면: [TreatmentRoomsSuspense](../restored/components/treatment/TreatmentRoomsSuspense.vue)
- meta: 권한 `치료실` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 4 · API: 화면 0 · 전체 도달 329

<details>
<summary>컴포넌트 트리</summary>

- RouteAccessDenied ↗
- RouteViewErrorFallback ↗
- RouteViewLoadingFallback ↗
- [TreatmentRoomsView](component-api.md#c-views-treatmentroomsview) ↗

</details>

<a id="route-tablet-auth-link"></a>

### `/tablet/auth-link` · tablet-auth-link

- 화면: [TabletAuthLinkView](../restored/views/TabletAuthLinkView.vue)
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 2 · 전체 도달 2
- 스토어: `useDeskDateStore`

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postSsoExchange` (직접) | `POST authClient /sso/exchange` |

</details>

<a id="route-tablet-treatment-rooms"></a>

### `/tablet/treatment-rooms` · tablet-treatment-rooms

- 화면: [TabletTreatmentRoomsView](../restored/views/TabletTreatmentRoomsView.vue)
- meta: 권한 `치료실` · `requiresAuth`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 329

<details>
<summary>컴포넌트 트리</summary>

- TreatmentRoomsSuspense ↗

</details>

<a id="route-appointment-planner"></a>

### `/appointment-planner` · appointment-planner

- 화면: [AppointmentPlannerView](../restored/views/AppointmentPlannerView.vue)
- meta: 권한 `예약관리` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 11 · 공유 49 · API: 화면 18 · 전체 도달 305
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- **AppointmentPlannerContent**
  - **AppointmentPlannerCancelDialog**
    - BaseButton ↗
    - BaseCheckBox ↗
    - BaseConfirmDialog ↗
    - BaseTextInput ↗
  - **AppointmentPlannerDaily**
    - AppointmentDayHeader ↗
    - **AppointmentPlannerDailyCell**
    - AppointmentTimeAxiosCell ↗
    - OverlayScrollbar ↗
    - PlannerCurrentTimeLineIndicator ↗
    - [PlannerDragBlockingDialog](component-api.md#c-components-planner-plannerdragblockingdialog) ↗
    - [PlannerDragMarkingContextMenu](component-api.md#c-components-planner-plannerdragmarkingcontextmenu) ↗
    - PlannerDragSelectionArea ↗
    - PlannerDragSelectionContextMenu ↗
    - UnscheduledAppointmentArea ↗
    - UnscheduledAppointmentDailyColumn ↗
  - **AppointmentPlannerHeader**
    - BaseTabBar ↗
    - BaseTextInputPlainModule ↗
    - BaseToggleSwitch ↗
    - ContentDivider ↗
    - ExcelDownloadReasonModal ↗
    - ExternalChannelBadge ↗
    - RefreshButton ↗
  - **AppointmentPlannerSidebar**
    - BaseBadge ↗
    - BaseLabel ↗
    - CursorFollowingTooltip ↗
    - DoctorNameBadge ↗
    - [EmrDatePicker](component-api.md#c-components-emr-emrdatepicker) ↗
  - **AppointmentPlannerSideDetail**
    - **AppointmentPlannerHistory**
      - BaseLottie ↗
      - TimeLineBadge ↗
    - BaseCloseButton ↗
    - PatientBadges ↗
    - [PatientMemo](component-api.md#c-components-patient-patientmemo) ↗
    - PatientNameGenderAgeText ↗
    - [PatientProfileAvatarUpload](component-api.md#c-components-patient-patientprofileavatarupload) ↗
  - **AppointmentPlannerWeekly**
    - **AppointmentPlannerWeeklyCell**
    - PlannerTodayIndicator ↗
  - BaseConfirmDialog ↗
  - LoadingBoxWithSpinner ↗
  - [NaverReservationDetail](component-api.md#c-components-naver-naverreservationdetail) ↗
  - [NaverReservationPanel](component-api.md#c-components-naver-naverreservationpanel) ↗
  - NonBenefitPatientsViewTelemedicineCancelModal ↗
  - [NonBenefitPatientsViewTelemedicineModal](component-api.md#c-components-nonbenefit-nonbenefitpatientsviewtelemedicinemodal) ↗
  - SidePanelDeskActions ↗
- LoadingBoxWithSpinner ↗

</details>

<details>
<summary>훅 → API (18)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteDeskAppointmentsMutation_2` | `DELETE emrClient /desk/appointments/{input}` |
| `useDeskAppointmentsHistoryQuery` | `GET emrClient /desk/appointments/{input}/history` |
| `useDeskAppointmentsPlannerQuery` | `GET emrClient /desk/appointments/planner` |
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useDoctalkSyncStatusQuery` | `POST emrClient /doctalk/sync-status` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |
| `usePatchDeskTelemedicineConsultationsStatusMutation` | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostDeskAppointmentsMutation` | `POST emrClient /desk/appointments` |
| `usePostDeskBookingRequestsConfirmMutation` | `POST emrClient /desk/booking-requests/confirm` |
| `usePostDeskBookingRequestsRejectMutation` | `POST emrClient /desk/booking-requests/reject` |
| `usePostPatientsDownloadLogsMutation` | `POST emrClient /patients/download-logs` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

</details>

<a id="route-ocs"></a>

### `/ocs` · ocs

- 화면: [OcsView](../restored/views/OcsView.vue)
- meta: 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 21 · 공유 49 · API: 화면 19 · 전체 도달 80
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- **OcsViewContent**
  - MetricTab ↗
  - **OcsViewHeader**
    - BaseButton ↗
    - EmrDateRangePickerButton ↗
  - **OcsViewList**
    - BaseButtonGroup ↗
    - BaseButtonGroupItem ↗
    - BaseTextInput ↗
    - BaseTextInputPlainModule ↗
    - ContentDivider ↗
    - [DoctorsDropdown](component-api.md#c-components-doctors-doctorsdropdown) ↗
    - **OcsViewListTable**
      - AgGridTable ↗
      - AgGridTableBadgeCell ↗
      - AgGridTableDatePickerCell ↗
      - [AgGridTableDoctorsCell](component-api.md#c-components-aggrid-aggridtabledoctorscell) ↗
      - AgGridTableHeaderCell ↗
      - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
      - BaseSidePanel ↗
      - **OcsViewListTableActionsCell**
      - **OcsViewListTableDetailRow**
        - BaseLabel ↗
        - **OcsViewListTableDetailRowHerbsRow**
          - BaseSummaryBadge ↗
          - SimpleTableCell ↗
          - SimpleTableRow ↗
        - OverlayScrollbar ↗
        - SimpleTable ↗
      - **OcsViewListTableDispensingStatusCell**
        - BaseBadge ↗
        - BaseSelectBox ↗
        - BaseTooltip ↗
      - **OcsViewListTableOrderNameCell**
      - **OcsViewListTablePrescriptionCell**
      - **OcsViewListTablePrescriptionSidePanel**
        - HerbalPrescriptionIssueButton ↗
        - HerbalPrescriptionIssuePanel ↗
        - **OcsViewPrescriptionPanel**
          - EmrDatePickerButton ↗
          - HerbCopyButton ↗
          - [HerbTableEditor](component-api.md#c-components-herb-herbtableeditor) ↗
          - **OcsViewPrescriptionBasicInfo**
            - BaseRadio ↗
            - BaseTextArea ↗
            - TangjeonDosageFields ↗
          - **OcsViewPrescriptionHerbsList**
            - **OcsViewPrescriptionHerbsListRow**
              - BaseCheckBox ↗
              - SimpleTableRowAction ↗
          - **OcsViewPrescriptionHistoryList**
            - **OcsViewPrescriptionHistoryListItem**
              - BaseHoverCard ↗
            - PrescriptionSearchInput ↗
          - **OcsViewPrescriptionOcsDictionary**
            - BaseTabBar ↗
            - CursorFollowingTooltip ↗
          - PatientLevelDot ↗
          - PatientNameGenderAgeText ↗
          - SidePanelHeaderContainer ↗
      - **OcsViewListTableReceiveTypeCell**
        - BasePopover ↗
        - **OcsViewListTableReceiveTypeDelivery**
          - AddressCardRadio ↗
          - [RegisterAddress](component-api.md#c-components-register-registeraddress) ↗

</details>

<details>
<summary>훅 → API (19)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `useOcsDictionariesCategoriesQuery` | `GET emrClient /ocs/dictionaries/categories` |
| `useOcsDictionariesQuery` | `GET emrClient /ocs/dictionaries` |
| `useOcsListQuery` | `GET emrClient /ocs/list` |
| `useOcsListStatsQuery` | `GET emrClient /ocs/list/stats` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatchDeskAddressesMutation` | `PATCH emrClient /desk/addresses/{input}` |
| `usePatchOcsDeliveryMutation` | `PATCH emrClient /ocs/{ocsId}/delivery` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |
| `usePatchOcsTakingMutation` | `PATCH emrClient /ocs/{ocsId}/taking` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostDeskAddressesDeleteMutation` | `POST emrClient /desk/addresses/delete/{input}` |
| `usePostDeskAddressesMutation` | `POST emrClient /desk/addresses/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsReferenceFormulasSearchQuery_2` | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

</details>

<a id="route-tangjeon-prescription-list"></a>

### `/ocs/prescription/list` · tangjeon-prescription-list

- 화면: [TangjeonPrescriptionListView](../restored/views/TangjeonPrescriptionListView.vue)
- meta: 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 2 · 공유 17 · API: 화면 11 · 전체 도달 163
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- **TangjeonPrescriptionListContent**
  - BaseErrorRetry ↗
  - [TangjeonDocumentLedgerFilters](component-api.md#c-components-tangjeon-tangjeondocumentledgerfilters) ↗
  - TangjeonDocumentLedgerTable ↗
  - TangjeonListCreatePanel ↗
  - [TangjeonListFilters](component-api.md#c-components-tangjeon-tangjeonlistfilters) ↗
  - TangjeonListHeader ↗
  - [TangjeonListSidePanel](component-api.md#c-components-tangjeon-tangjeonlistsidepanel) ↗
  - TangjeonListStatusTabs ↗
  - [TangjeonListTable](component-api.md#c-components-tangjeon-tangjeonlisttable) ↗
  - [TangjeonOcsV2OrderModal](component-api.md#c-components-tangjeon-tangjeonocsv2ordermodal) ↗
  - [TangjeonPrescriptionIssuePanels](component-api.md#c-components-tangjeon-tangjeonprescriptionissuepanels) ↗
  - TangjeonUnregisteredFilters ↗
  - TangjeonUnregisteredTable ↗

</details>

<details>
<summary>훅 → API (11)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteTangjeonPrescriptionsMutation` | `DELETE emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |
| `usePatchTangjeonPrescriptionsStatusMutation` | `PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/status` |
| `usePutTangjeonPrescriptionsMutation` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useTangjeonDispensaryRoomsQuery` | `GET emrClient /tangjeon/dispensary-rooms` |
| `useTangjeonPrescriptionDocumentsQuery` | `GET emrClient /tangjeon/prescription-documents` |
| `useTangjeonPrescriptionsQuery_2` | `GET emrClient <TANGJEON_PRESCRIPTIONS_PATH>` |
| `useTangjeonPrescriptionsQuery_4` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |
| `useTangjeonPrescriptionsStatsQuery` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/stats` |
| `useTangjeonTreatmentPrescriptionsUnregisteredQuery` | `GET emrClient /tangjeon/treatment-prescriptions/unregistered` |

</details>

<a id="route-tangjeon-prescription-create"></a>

### `/ocs/prescription/create` · tangjeon-prescription-create

- 화면: [TangjeonPrescriptionCreateView](../restored/views/TangjeonPrescriptionCreateView.vue)
- meta: 권한 `탕전관리` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 2 · 공유 15 · API: 화면 12 · 전체 도달 19
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- **TangjeonPrescriptionCreateContent**
  - BaseConfirmDialog ↗
  - BaseErrorRetry ↗
  - OverlayScrollbar ↗
  - TangjeonCreateContentHeader ↗
  - [TangjeonCreateDictionaryCard](component-api.md#c-components-tangjeon-tangjeoncreatedictionarycard) ↗
  - [TangjeonCreateHistoryStrip](component-api.md#c-components-tangjeon-tangjeoncreatehistorystrip) ↗
  - [TangjeonCreateInsuranceFields](component-api.md#c-components-tangjeon-tangjeoncreateinsurancefields) ↗
  - [TangjeonCreatePatientCard](component-api.md#c-components-tangjeon-tangjeoncreatepatientcard) ↗
  - [TangjeonCreatePrescriptionCard](component-api.md#c-components-tangjeon-tangjeoncreateprescriptioncard) ↗
  - TangjeonCreateSummaryPanel ↗
  - TangjeonCreateTreatmentLink ↗
  - [TangjeonCreateTreatmentRecordCard](component-api.md#c-components-tangjeon-tangjeoncreatetreatmentrecordcard) ↗

</details>

<details>
<summary>훅 → API (12)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchTangjeonHerbsQuery` | `GET emrClient /tangjeon/herbs` |
| `prefetchTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions`<br>`GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |
| `usePostTangjeonPrescriptionsFromPackageMutation` | `POST emrClient {TANGJEON_PRESCRIPTIONS_PATH}/from-package` |
| `usePostTangjeonPrescriptionsMutation` | `POST emrClient <TANGJEON_PRESCRIPTIONS_PATH>` |
| `usePutTangjeonPrescriptionsMutation_5` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |
| `useRecordPatientRecordDateQuery` | `GET emrClient /record/patient/{input}/record/date` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |
| `useTangjeonDispensaryRoomsQuery` | `GET emrClient /tangjeon/dispensary-rooms` |
| `useTangjeonPrescriptionsQuery` | `GET emrClient <TANGJEON_PRESCRIPTIONS_PATH>` |
| `useTangjeonTreatmentPrescriptionsQuery` | `GET emrClient /tangjeon/treatment-prescriptions` |
| `getTangjeonPrescriptions_2` (직접) | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |

</details>

<a id="route-ocs-v2-herb-order-create"></a>

### `/ocs-v2-herb-order-create` · ocs-v2-herb-order-create

- 화면: [OndangGateView](../restored/views/OndangGateView.vue)
- meta: 권한 `메디원탕` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 5 · API: 화면 2 · 전체 도달 88

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- [OcsV2OrderCreateView](component-api.md#c-views-ocsv2ordercreateview) ↗
- [OcsV2OrderListView](component-api.md#c-views-ocsv2orderlistview) ↗
- [OndangContractRequiredModal](component-api.md#c-components-ondang-ondangcontractrequiredmodal) ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSubscriptionsSooProQuery` | `GET emrClient /subscriptions/soo-pro` |

</details>

<a id="route-ocs-v2-herb-order-list"></a>

### `/ocs-v2-herb-order-list` · ocs-v2-herb-order-list

- 화면: [OndangGateView](../restored/views/OndangGateView.vue)
- meta: 권한 `메디원탕` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 5 · API: 화면 2 · 전체 도달 88

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- [OcsV2OrderCreateView](component-api.md#c-views-ocsv2ordercreateview) ↗
- [OcsV2OrderListView](component-api.md#c-views-ocsv2orderlistview) ↗
- [OndangContractRequiredModal](component-api.md#c-components-ondang-ondangcontractrequiredmodal) ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSubscriptionsSooProQuery` | `GET emrClient /subscriptions/soo-pro` |

</details>

<a id="route-crm"></a>

### `/crm` · crm

- 화면: [CrmView](../restored/views/CrmView.vue)
- meta: 권한 `고객관리` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 6 · API: 화면 1 · 전체 도달 3

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- BaseButton ↗
- BrandDotLoader ↗
- LoadingBoxWithSpinner ↗
- [UnifiedTermsConsentScreen](component-api.md#c-components-unified-unifiedtermsconsentscreen) ↗
- UnifiedTermsWaitingScreen ↗

</details>

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsHospitalAgreementsQuery` | `GET accountClient /terms/hospital-agreements` |

</details>

<a id="route-crm-routines"></a>

### `/crm/routines` · crm-routines

- 화면: [CrmRoutineView](../restored/views/CrmRoutineView.vue) · 부모 라우트 `crm`
- 등록 조건: `Yu()`
- 컴포넌트: 전용 19 · 공유 27 · API: 화면 10 · 전체 도달 46
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- **CrmRoutineViewRoutines**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseTabBar ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - BaseToggleSwitch ↗
  - ContentDivider ↗
  - **CrmRoutineViewRoutineItem**
    - BaseBadge ↗
    - **CrmRoutineViewCategoryIcon**
      - BaseFeaturedIcon ↗
  - EmptyPatient ↗
  - OverlayScrollbar ↗
- **CrmRoutineViewStartWithScratch**
  - BaseCloseButton ↗
  - BaseLabel ↗
  - BaseTextArea ↗
  - InputRangeDatePicker ↗
- **CrmRoutineViewStartWithTemplate**
  - BaseDot ↗
  - **CrmRoutineCanvasViewCanvas**
    - BaseConfirmDialog ↗
    - **CrmRoutineCanvasNodeRoutineHappyCall**
      - **CrmRoutineCanvasNodeRoutine**
        - **CrmRoutineCanvasNode**
    - **CrmRoutineCanvasNodeRoutineMessage**
    - **CrmRoutineCanvasNodeTargetUser**
    - **CrmRoutineCanvasViewConnector**
      - BaseMenu ↗
      - **CrmRoutineCanvasViewConnectorLine**
    - **CrmRoutineCanvasViewPanel**
    - **CrmRoutineCanvasViewPanelRoutine**
      - BaseSelectBox ↗
    - **CrmRoutineCanvasViewPanelRoutineHappyCall**
      - CrmCommonHappyCallForm ↗
      - [CrmHappyCallTemplatesModal](component-api.md#c-components-crm-crmhappycalltemplatesmodal) ↗
    - **CrmRoutineCanvasViewPanelRoutineMessage**
      - BaseSidePanel ↗
      - [CrmCommonMessageForm](component-api.md#c-components-crm-crmcommonmessageform) ↗
      - CrmMessageTemplateName ↗
      - [CrmTemplateLibraryModal](component-api.md#c-components-crm-crmtemplatelibrarymodal) ↗
    - **CrmRoutineCanvasViewPanelTargetUser**

</details>

<details>
<summary>훅 → API (10)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCategoriesQuery` | `GET crmClient /categories` |
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |
| `usePostHappycallTemplatesMutation` | `POST crmClient /happycall/templates` |
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |
| `usePostSchedulersInfoMutation` | `POST crmClient /schedulers/info` |
| `usePostSchedulersTemplatesApplyByTemplateIdMutation` | `POST crmClient /schedulers/templates/{args.templateId}/apply` |
| `useSchedulersSearchQuery` | `GET crmClient /schedulers`<br>`GET crmClient /schedulers/search` |
| `useSchedulersTemplatesByIdQuery` | `GET crmClient /schedulers/templates/{args.id}` |
| `useSchedulersTemplatesQuery` | `GET crmClient /schedulers/templates` |

</details>

<a id="route-crm-routines-new"></a>

### `/crm/routines/new` · crm-routines-new

- 화면: [CrmRoutineCanvasView](../restored/views/CrmRoutineCanvasView.vue) · 부모 라우트 `crm`
- 등록 조건: `Yu()`
- 컴포넌트: 전용 16 · 공유 21 · API: 화면 6 · 전체 도달 43
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **CrmRoutineCanvasExecuteModal**
  - BaseButton ↗
  - BaseDialogModal ↗
  - BaseLabel ↗
  - BaseRadio ↗
  - BaseSelectBox ↗
  - InputRangeDatePicker ↗
- **CrmRoutineCanvasViewCanvas**
  - BaseConfirmDialog ↗
  - ContentDivider ↗
  - **CrmRoutineCanvasNodeRoutineHappyCall**
    - **CrmRoutineCanvasNodeRoutine**
      - **CrmRoutineCanvasNode**
        - BaseBadge ↗
  - **CrmRoutineCanvasNodeRoutineMessage**
  - **CrmRoutineCanvasNodeTargetUser**
  - **CrmRoutineCanvasViewConnector**
    - BaseMenu ↗
    - **CrmRoutineCanvasViewConnectorLine**
  - **CrmRoutineCanvasViewPanel**
    - BaseCloseButton ↗
  - **CrmRoutineCanvasViewPanelRoutine**
    - OverlayScrollbar ↗
  - **CrmRoutineCanvasViewPanelRoutineHappyCall**
    - CrmCommonHappyCallForm ↗
    - [CrmHappyCallTemplatesModal](component-api.md#c-components-crm-crmhappycalltemplatesmodal) ↗
  - **CrmRoutineCanvasViewPanelRoutineMessage**
    - BaseSidePanel ↗
    - [CrmCommonMessageForm](component-api.md#c-components-crm-crmcommonmessageform) ↗
    - CrmMessageTemplateName ↗
    - [CrmTemplateLibraryModal](component-api.md#c-components-crm-crmtemplatelibrarymodal) ↗
  - **CrmRoutineCanvasViewPanelTargetUser**
- **CrmRoutineCanvasViewHeader**
  - [CrmRoutineViewBasicInfoModal](component-api.md#c-components-crm-crmroutineviewbasicinfomodal) ↗
  - [CrmRoutineViewOperationInfoPopover](component-api.md#c-components-crm-crmroutineviewoperationinfopopover) ↗

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |
| `usePostHappycallTemplatesMutation` | `POST crmClient /happycall/templates` |
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |
| `usePutSchedulersRoutinesBatchMutation` | `PUT crmClient /schedulers/{schedulerId}/routines/batch` |
| `useSchedulersAssigneesQuery` | `GET crmClient /schedulers/assignees` |
| `useSchedulersByIdQuery` | `GET crmClient /schedulers/{args.id}` |

</details>

<a id="route-crm-routines-detail"></a>

### `/crm/routines/:routineId` · crm-routines-detail

- 화면: [CrmRoutineCanvasView](../restored/views/CrmRoutineCanvasView.vue) · 부모 라우트 `crm`
- 등록 조건: `Yu()`
- 컴포넌트: 전용 16 · 공유 21 · API: 화면 6 · 전체 도달 43
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **CrmRoutineCanvasExecuteModal**
  - BaseButton ↗
  - BaseDialogModal ↗
  - BaseLabel ↗
  - BaseRadio ↗
  - BaseSelectBox ↗
  - InputRangeDatePicker ↗
- **CrmRoutineCanvasViewCanvas**
  - BaseConfirmDialog ↗
  - ContentDivider ↗
  - **CrmRoutineCanvasNodeRoutineHappyCall**
    - **CrmRoutineCanvasNodeRoutine**
      - **CrmRoutineCanvasNode**
        - BaseBadge ↗
  - **CrmRoutineCanvasNodeRoutineMessage**
  - **CrmRoutineCanvasNodeTargetUser**
  - **CrmRoutineCanvasViewConnector**
    - BaseMenu ↗
    - **CrmRoutineCanvasViewConnectorLine**
  - **CrmRoutineCanvasViewPanel**
    - BaseCloseButton ↗
  - **CrmRoutineCanvasViewPanelRoutine**
    - OverlayScrollbar ↗
  - **CrmRoutineCanvasViewPanelRoutineHappyCall**
    - CrmCommonHappyCallForm ↗
    - [CrmHappyCallTemplatesModal](component-api.md#c-components-crm-crmhappycalltemplatesmodal) ↗
  - **CrmRoutineCanvasViewPanelRoutineMessage**
    - BaseSidePanel ↗
    - [CrmCommonMessageForm](component-api.md#c-components-crm-crmcommonmessageform) ↗
    - CrmMessageTemplateName ↗
    - [CrmTemplateLibraryModal](component-api.md#c-components-crm-crmtemplatelibrarymodal) ↗
  - **CrmRoutineCanvasViewPanelTargetUser**
- **CrmRoutineCanvasViewHeader**
  - [CrmRoutineViewBasicInfoModal](component-api.md#c-components-crm-crmroutineviewbasicinfomodal) ↗
  - [CrmRoutineViewOperationInfoPopover](component-api.md#c-components-crm-crmroutineviewoperationinfopopover) ↗

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |
| `usePostHappycallTemplatesMutation` | `POST crmClient /happycall/templates` |
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |
| `usePutSchedulersRoutinesBatchMutation` | `PUT crmClient /schedulers/{schedulerId}/routines/batch` |
| `useSchedulersAssigneesQuery` | `GET crmClient /schedulers/assignees` |
| `useSchedulersByIdQuery` | `GET crmClient /schedulers/{args.id}` |

</details>

<a id="route-crm-reminder"></a>

### `/crm/reminder` · crm-reminder

- 화면: [CrmReminderView](../restored/views/CrmReminderView.vue) · 부모 라우트 `crm`
- 등록 조건: `Yu()`
- 컴포넌트: 전용 8 · 공유 13 · API: 화면 0 · 전체 도달 1
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **CrmReminderDashboard**
  - **CrmReminderDashboardDailySms**
    - **CrmReminderDashboardDailySmsBoard**
      - BaseBadge ↗
      - CrmPatientCard ↗
      - OverlayScrollbar ↗
  - **CrmReminderDashboardHeader**
    - BaseButton ↗
    - BaseButtonGroup ↗
    - BaseButtonGroupItem ↗
    - BaseTabBar ↗
    - BaseTextInput ↗
    - BaseTextInputPlainModule ↗
    - BaseToggleSwitch ↗
- **CrmReminderMainMetrics**
  - **CrmReminderMainMetricsCard**
  - [DoctorsDropdown](component-api.md#c-components-doctors-doctorsdropdown) ↗
- **CrmReminderSubMetrics**
  - BarChart ↗

</details>

<a id="route-crm-nonbenefit-patients"></a>

### `/crm/nonbenefit-patients` · crm-nonbenefit-patients

- 화면: [NonBenefitPatientsView](../restored/views/NonBenefitPatientsView.vue) · 부모 라우트 `crm`
- 컴포넌트: 전용 15 · 공유 27 · API: 화면 17 · 전체 도달 307
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseCloseButton ↗
- BaseTabBar ↗
- [CrmPatientMessageSendSidePanel](component-api.md#c-components-crm-crmpatientmessagesendsidepanel) ↗
- **NonBenefitPatientsViewCancelledTelemedicineModal**
- **NonBenefitPatientsViewMain**
  - LoadingBoxWithSpinner ↗
  - **NonBenefitPatientsViewTable**
- **NonBenefitPatientsViewTelemedicineBanner**
  - **NonBenefitPatientsViewTelemedicineModal**
    - BaseBadge ↗
    - [DeskViewPatientAppointment](component-api.md#c-components-desk-deskviewpatientappointment) ↗
    - **NonBenefitPatientsViewTelemedicineCancelModal**
      - BaseRadio ↗
      - BaseTextInput ↗
    - **NonBenefitPatientsViewTelemedicineMemo**
      - [BaseTipTapEditor](component-api.md#c-components-base-basetiptapeditor) ↗
      - ContentDivider ↗
      - OverlayScrollbar ↗
      - [PatientMemoListItem](component-api.md#c-components-patient-patientmemolistitem) ↗
    - OverlayScrollbar ↗
    - SidePanelHeaderContainer ↗
- **NonBenefitPatientsViewTelemedicineModal**
- **NonBenefitPatientsViewToolbar**
- TelemedicineSignupIntroModal ↗
- [TelemedicineSignupWizard](component-api.md#c-components-telemedicine-telemedicinesignupwizard) ↗

</details>

<details>
<summary>훅 → API (17)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsOrderSooQuery` | `GET emrClient /desk/appointments/order/soo/{input}` |
| `useDeskAppointmentsTelemedicineCancelledQuery` | `GET emrClient /desk/appointments/telemedicine/cancelled` |
| `useDeskAppointmentsTelemedicineQuery` | `GET emrClient /desk/appointments/telemedicine` |
| `useMembersUpstreamClinicsMyQuery` | `GET thesooClient /members/upstream/clinics/my` |
| `useMembersUpstreamOrdersQuery` | `GET thesooClient members/upstream/orders/{input}` |
| `usePatchCrmNonbenefitPatientsRestartMutation` | `PATCH emrClient /crm/nonbenefit-patients/restart` |
| `usePatchCrmNonbenefitPatientsTerminateMutation` | `PATCH emrClient /crm/nonbenefit-patients/terminate` |
| `usePatchDeskTelemedicineConsultationsStatusMutation` | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `usePatientsMemosCountQuery` | `GET emrClient /patients/{input}/memos/count` |
| `usePatientsMemosQuery` | `GET emrClient /patients/{id}/memos` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostPatientsMemosMutation` | `POST emrClient /patients/{pid}/memos` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `getMessagesSendGroupsReceiversCount` (직접) | `GET crmClient /messages/send/groups/{id}/receivers/count` |
| `getCrmNonbenefitPatients` (직접) | `GET emrClient /crm/nonbenefit-patients` |
| `postMessagesSendGroups` (직접) | `POST crmClient /messages/send/groups` |
| `postMessagesSendGroupsReceiversAddEmrPatients` (직접) | `POST crmClient messages/send/groups/{id}/receivers/add/emr-patients` |

</details>

<a id="route-crm-contacts"></a>

### `/crm/contacts` · crm-contacts

- 화면: [CrmContactsView](../restored/views/CrmContactsView-2.vue) · 부모 라우트 `crm`
- meta: 권한 `연락목록`
- 컴포넌트: 전용 17 · 공유 38 · API: 화면 20 · 전체 도달 311
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **CrmContactsViewDetail**
  - BaseButton ↗
  - BaseCloseButton ↗
  - BaseFeaturedIcon ↗
  - BaseTabBar ↗
  - BaseToggleSwitch ↗
  - ContentDivider ↗
  - **CrmContactsViewDetailActionLogs**
    - OverlayScrollbar ↗
    - TimeLineBadge ↗
    - [TreatmentViewBoardAsideDmSchedules](component-api.md#c-components-treatment-treatmentviewboardasidedmschedules) ↗
  - **CrmContactsViewDetailRecords**
    - **CrmContactsViewDetailRecordsText**
    - TimeLineCircle ↗
    - [TreatmentViewBoardRecordsList](component-api.md#c-components-treatment-treatmentviewboardrecordslist) ↗
  - **CrmContactsViewListTableAutoSendPreview**
    - BaseHoverCard ↗
    - KakaoTemplateHoverPreview ↗
  - EditableText ↗
  - OverlayScrollbar ↗
  - [PatientMemo](component-api.md#c-components-patient-patientmemo) ↗
  - PatientNameGenderAgeText ↗
  - [PatientProfileAvatarUpload](component-api.md#c-components-patient-patientprofileavatarupload) ↗
- **CrmContactsViewHeader**
  - CrmContactRulesTriggerButton ↗
  - CrmFreeTrialBadge ↗
  - [CrmLiteTriggerSchedulerSetupModal](component-api.md#c-components-crm-crmlitetriggerschedulersetupmodal) ↗
  - [CrmLiteTriggerVariableInputModal](component-api.md#c-components-crm-crmlitetriggervariableinputmodal) ↗
- **CrmContactsViewList**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - [CrmContactRulesFilter](component-api.md#c-components-crm-crmcontactrulesfilter) ↗
  - **CrmContactsViewListLiteTriggerTable**
    - AgGridTable ↗
    - AgGridTableBadgeCell ↗
    - AgGridTableHeaderCell ↗
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - AgGridTableTextCell ↗
    - **CrmContactsViewListLiteTriggerContactDatesCell**
    - **CrmContactsViewListTableNoRowsOverlay**
      - AgGridNoRowsOverlay ↗
  - **CrmContactsViewListTable**
    - BaseConfirmDialog ↗
    - **CrmContactsViewListTableActionsCell**
    - **CrmContactsViewListTableContactDatesCell**
      - **CrmContactsViewListTableContactDatesPicker**
        - BasePopover ↗
        - **CrmContactsViewListTableContactDatesPickerContent**
          - BaseDatePicker ↗
    - **CrmContactsViewListTablePrescriptionCell**
  - [DoctorsButtonGroup](component-api.md#c-components-doctors-doctorsbuttongroup) ↗
  - SidePanelDeskActions ↗

</details>

<details>
<summary>훅 → API (20)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListActionLogsPatientQuery` | `GET emrClient /crm/contact-list/action-logs/patient/{patientId}` |
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |
| `useCrmContactListSchedulerQuery` | `GET emrClient /crm/contact-list/scheduler` |
| `useCrmContactListSchedulerSummaryQuery` | `GET emrClient /crm/contact-list/scheduler/summary` |
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmContactListSchedulesPatientSchedulesQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}/schedules` |
| `useCrmContactListSchedulesPatientSchedulesQuery_2` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}/schedules` |
| `useCrmContactListSchedulesQuery` | `GET emrClient /crm/contact-list/schedules` |
| `useCrmContactListSchedulesSummaryQuery` | `GET emrClient /crm/contact-list/schedules/summary` |
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |
| `usePatchCrmContactListSchedulerMutation` | `PATCH emrClient /crm/contact-list/scheduler/{logId}` |
| `usePostCrmContactListSchedulesCompleteMutation` | `POST emrClient /crm/contact-list/schedules/{id}/complete` |
| `usePostCrmContactListSchedulesPatientBulkProcessMutation` | `POST emrClient /crm/contact-list/schedules/patient/{patientId}/bulk-process` |
| `usePostCrmContactListSchedulesRestoreMutation` | `POST emrClient /crm/contact-list/schedules/restore` |
| `usePostCrmContactListSchedulesUncompleteMutation` | `POST emrClient /crm/contact-list/schedules/{id}/uncomplete` |
| `Aln` (직접) | `POST emrClient /crm/lite-trigger/events/{n.id}/opt-out` |
| `Iln` (직접) | `POST emrClient /crm/lite-trigger/events/{r.id}/opt-in` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

</details>

<a id="route-crm-contacts-v2"></a>

### `/crm/contacts-v2` · crm-contacts-v2

- 화면: [CrmContactsView](../restored/views/CrmContactsView.vue) · 부모 라우트 `crm`
- meta: 권한 `연락목록`
- 컴포넌트: 전용 14 · 공유 55 · API: 화면 21 · 전체 도달 337
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseAlert ↗
- BaseButton ↗
- BaseTabBar ↗
- ContentDivider ↗
- [CrmContactRulesEditModal](component-api.md#c-components-crm-crmcontactruleseditmodal) ↗
- CrmContactRulesTriggerButton ↗
- **CrmContactsViewCalendar**
  - BaseCalendar ↗
  - BaseCalendarDayItems ↗
  - BaseSidePanel ↗
  - CrmContactScheduleFilterBar ↗
  - **CrmContactsViewCalendarChip**
    - [CrmContactChannelMessagePreview](component-api.md#c-components-crm-crmcontactchannelmessagepreview) ↗
  - [CrmScheduleAddContactPopover](component-api.md#c-components-crm-crmscheduleaddcontactpopover) ↗
  - CrmScheduleAddContextMenu ↗
  - CrmScheduleCalendarEventMenu ↗
  - [CrmScheduleCalendarModal](component-api.md#c-components-crm-crmschedulecalendarmodal) ↗
  - CrmScheduleDeleteConfirmDialog ↗
  - CrmScheduleGroupShiftBanner ↗
  - [MessageResultsDetailSidePanel](component-api.md#c-components-message-messageresultsdetailsidepanel) ↗
- **CrmContactsViewDetail**
  - BaseCloseButton ↗
  - **CrmContactsViewDetailActionLogs**
    - OverlayScrollbar ↗
    - TimeLineBadge ↗
    - [TreatmentViewBoardAsideDmSchedules](component-api.md#c-components-treatment-treatmentviewboardasidedmschedules) ↗
  - **CrmContactsViewDetailPackages**
    - PatientPackageCardMenu ↗
    - [PatientPackageExpirationModal](component-api.md#c-components-patient-patientpackageexpirationmodal) ↗
    - [PatientPackageTerminateModal](component-api.md#c-components-patient-patientpackageterminatemodal) ↗
  - **CrmContactsViewDetailRecords**
    - **CrmContactsViewDetailRecordsText**
    - TimeLineCircle ↗
    - [TreatmentViewBoardRecordsList](component-api.md#c-components-treatment-treatmentviewboardrecordslist) ↗
  - **CrmContactsViewDetailScheduledContacts**
    - BaseFeaturedIcon ↗
    - [CrmScheduleRescheduleDatePopover](component-api.md#c-components-crm-crmschedulerescheduledatepopover) ↗
    - EditableText ↗
  - OverlayScrollbar ↗
  - [PatientMemo](component-api.md#c-components-patient-patientmemo) ↗
  - PatientNameGenderAgeText ↗
  - [PatientProfileAvatarUpload](component-api.md#c-components-patient-patientprofileavatarupload) ↗
  - ResizableDiv ↗
  - SidePanelDeskActions ↗
- **CrmContactsViewList**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - **CrmContactsViewListDashboard**
  - MetricTab ↗
- [CrmProgramGroupOptInBanner](component-api.md#c-components-crm-crmprogramgroupoptinbanner) ↗
- CrmPromoBanner ↗
- [CrmScheduleAddPatientContactButton](component-api.md#c-components-crm-crmscheduleaddpatientcontactbutton) ↗
- CrmScheduleCalendarBusyLegend ↗
- [CrmScheduleCalendarModal](component-api.md#c-components-crm-crmschedulecalendarmodal) ↗
- [CrmTrialExpiryAlert](component-api.md#c-components-crm-crmtrialexpiryalert) ↗
- [CrmTrialIntroModal](component-api.md#c-components-crm-crmtrialintromodal) ↗
- [McpApprovalContactsSidePanel](component-api.md#c-components-mcp-mcpapprovalcontactssidepanel) ↗
- ResizableDiv ↗
- SendAuthNoticeBanner ↗

</details>

<details>
<summary>훅 → API (21)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmTriggerEngineMcpApprovalsPendingQuery` | `GET emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/pending` |
| `useCrmTriggerEngineProgramsQuery` | `GET emrClient /crm/trigger-engine/programs` |
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `useCrmTriggerEngineWorklistLogsQuery_2` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `useCrmTriggerEngineWorklistPatientsActivityQuery` | `GET emrClient /crm/trigger-engine/worklist/patients/{patientId}/activity` |
| `usePostCrmTriggerEngineExecutionLogsCancelMutation` | `POST emrClient /crm/trigger-engine/execution-logs/cancel` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |
| `usePostCrmTriggerEngineExecutionLogsManualAutoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual-auto` |
| `usePostCrmTriggerEngineExecutionLogsManualMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual` |
| `usePostCrmTriggerEngineExecutionLogsRescheduleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/reschedule` |
| `usePostCrmTriggerEngineExecutionLogsShiftGroupMutation` | `POST emrClient /crm/trigger-engine/execution-logs/shift-group` |
| `usePostCrmTriggerEngineExecutionLogsToggleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/toggle` |
| `usePostCrmTriggerEngineExecutionLogsUncompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/uncomplete` |
| `usePostCrmTriggerEngineExecutionLogsUndoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/undo` |
| `useSubscriptionsMeQuery` | `GET emrClient /subscriptions/me` |
| `getCrmTriggerEngineExecutionLogs` (직접) | `GET emrClient /crm/trigger-engine/execution-logs/{id}` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |
| `postMessagesDeliveryStatus` (직접) | `POST crmClient /messages/delivery-status` |
| `postCrmTriggerEngineExecutionLogsShiftGroupPreview` (직접) | `POST emrClient /crm/trigger-engine/execution-logs/shift-group/preview` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

</details>

<a id="route-crm-soo-scheduler"></a>

### `/crm/soo-scheduler` · crm-soo-scheduler

- 화면: [CrmSooSchedulerView](../restored/views/CrmSooSchedulerView.vue) · 부모 라우트 `crm`
- meta: 권한 `연락목록`
- 컴포넌트: 전용 7 · 공유 22 · API: 화면 8 · 전체 도달 88
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- [CrmContactsViewDetail](component-api.md#c-components-crm-crmcontactsviewdetail-2) ↗
- **CrmSooSchedulerViewHeader**
  - BaseButton ↗
  - CrmFreeTrialBadge ↗
  - [CrmLiteTriggerSchedulerSetupModal](component-api.md#c-components-crm-crmlitetriggerschedulersetupmodal) ↗
  - [CrmLiteTriggerVariableInputModal](component-api.md#c-components-crm-crmlitetriggervariableinputmodal) ↗
  - **CrmSooSchedulerRulesPanel**
    - BaseCloseButton ↗
    - BaseSidePanel ↗
    - [CrmLiteTriggerRulesGroupCard](component-api.md#c-components-crm-crmlitetriggerrulesgroupcard) ↗
    - OverlayScrollbar ↗
- **CrmSooSchedulerViewList**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - ContentDivider ↗
  - **CrmSooSchedulerTable**
    - AgGridTable ↗
    - AgGridTableBadgeCell ↗
    - AgGridTableHeaderCell ↗
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - AgGridTableTextCell ↗
    - **CrmSooSchedulerContactDatesCell**
    - **CrmSooSchedulerNoRowsOverlay**
      - AgGridNoRowsOverlay ↗
  - [DoctorsButtonGroup](component-api.md#c-components-doctors-doctorsbuttongroup) ↗

</details>

<details>
<summary>훅 → API (8)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |
| `useCrmContactListSchedulerQuery` | `GET emrClient /crm/contact-list/scheduler` |
| `useCrmContactListSchedulerSummaryQuery` | `GET emrClient /crm/contact-list/scheduler/summary` |
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useCrmLiteTriggerRulesQuery` | `GET emrClient /crm/lite-trigger/rules` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `Aln` (직접) | `POST emrClient /crm/lite-trigger/events/{n.id}/opt-out` |
| `Iln` (직접) | `POST emrClient /crm/lite-trigger/events/{r.id}/opt-in` |

</details>

<a id="route-crm-emr-patients"></a>

### `/crm/patients` · crm-emr-patients

- 화면: [EmrPatientsView](../restored/views/EmrPatientsView.vue) · 부모 라우트 `crm`
- meta: 권한 `환자목록`
- 컴포넌트: 전용 6 · 공유 21 · API: 화면 6 · 전체 도달 298
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseConfirmDialog ↗
- BaseTextInput ↗
- BaseTextInputPlainModule ↗
- BaseToggleSwitch ↗
- **EmrPatientsExcelUploadModal**
  - BaseCloseButton ↗
  - CrmCommonExcelColumnTable ↗
  - OverlayScrollbar ↗
- **EmrPatientsViewTable**
  - AgGridTable ↗
  - AgGridTableBadgeCell ↗
  - AgGridTableHeaderCell ↗
  - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
  - AgGridTableTextCell ↗
  - **EmrPatientsViewTableActions**
    - BaseMenu ↗
    - ContentDivider ↗
    - CursorFollowingTooltip ↗
  - **EmrPatientsViewTableFamilies**
    - PatientInfoFamilies ↗
  - **EmrPatientsViewTableReferrer**
    - [PatientInfoReferrer](component-api.md#c-components-patient-patientinforeferrer) ↗
  - SidePanelDeskActions ↗
- ExcelDownloadReasonModal ↗

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAsyncTasksQuery` | `GET emrClient /async-tasks/{input}` |
| `useDeleteCrmPatientsMutation` | `DELETE emrClient /crm/patients/{pid}` |
| `usePostAsyncTasksPatientExcelImportMutation` | `POST emrClient /async-tasks/patient-excel-import` |
| `usePostPatientsDownloadLogsMutation` | `POST emrClient /patients/download-logs` |
| `getCrmPatients` (직접) | `GET emrClient /crm/patients` |
| `getCrmPatientsCount` (직접) | `GET emrClient /crm/patients/count` |

</details>

<a id="route-crm-message"></a>

### `/crm/message` · crm-message

- 화면: [MessageView](../restored/views/MessageView.vue) · 부모 라우트 `crm`
- meta: 권한 `일반문자`
- 컴포넌트: 전용 22 · 공유 43 · API: 화면 42 · 전체 도달 326
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseAlert ↗
- BaseSidePanel ↗
- [BillingPaymentMethodModal](component-api.md#c-components-billing-billingpaymentmethodmodal) ↗
- CrmMessagePreviewAdapter ↗
- CrmMessagePreviewPopover ↗
- CrmSendAsideTabs ↗
- **MessageViewReceivers**
  - BaseButton ↗
  - BaseConfirmDialog ↗
  - BaseTabBar ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - CrmCommonAccordionItem ↗
  - **MessageViewContactGroups**
    - **MessageViewContactGroupCard**
      - BaseCheckBox ↗
      - BaseCheckBoxCard ↗
      - BaseMenu ↗
    - **MessageViewContactGroupMembers**
      - BaseCloseButton ↗
      - OverlayScrollbar ↗
      - PatientNameGenderAgeText ↗
      - [PatientSearchDropDownCrm](component-api.md#c-components-patient-patientsearchdropdowncrm) ↗
    - **MessageViewContactGroupsConfirm**
    - OverlayScrollbar ↗
  - **MessageViewContactGroupSave**
    - BaseDropDownInfinite ↗
    - BaseDropDownInfiniteOption ↗
    - BaseRadio ↗
    - BaseTextInputWithMax ↗
  - **MessageViewExcelUpload**
    - CrmCommonExcelColumnConfirm ↗
    - CrmCommonExcelUploadConfirm ↗
    - CrmCommonExcelUploader ↗
  - **MessageViewPatientInput**
    - ModalBottomActionButton ↗
    - [PatientSearchDropDownEmr](component-api.md#c-components-patient-patientsearchdropdownemr) ↗
  - **MessageViewReceiversTable**
    - AgGridTable ↗
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - **MessageViewReceiversTableActionCell**
      - [PatientInfoDetail](component-api.md#c-components-patient-patientinfodetail) ↗
  - **MessageViewReceiversTableDuplicate**
  - **MessageViewSearchFilterConditions**
    - **MessageViewRecentConditions**
    - **MessageViewSearchConditionsModal**
      - BaseTextInputButtonModule ↗
    - **MessageViewSearchConditionsSaveConfirm**
    - **MessageViewSearchFilterConditionsDateRange**
      - BaseSelectableButton ↗
      - **MessageViewSearchFilterConditionsDateRangeItem**
        - EmrDateRangePickerButton ↗
      - **MessageViewSearchFilterConditionsDateRangeItemNoVisitDate**
        - **MessageViewSearchFilterConditionsDateRangeItemNoVisitDatePopover**
    - PatientLevelDot ↗
- **MessageViewSend**
  - BaseToggleSwitch ↗
  - CrmCommonSend ↗
  - MessageSendGroupDraftBanner ↗
- OverlayScrollbar ↗
- SendAuthNoticeBanner ↗

</details>

<details>
<summary>훅 → API (42)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingInvoicesUnitPricesQuery` | `GET crmClient /billing/invoices/unit-prices` |
| `useContactsFiltersQuery` | `GET crmClient /contacts/filters` |
| `useContactsGroupsByIdQuery` | `GET crmClient /contacts/groups/{args.id}` |
| `useContactsGroupsQuery` | `GET crmClient /contacts/groups` |
| `useDeleteContactsFiltersRecentUsageMutation` | `DELETE crmClient /contacts/filters/recent-usage` |
| `useDeleteContactsGroupsByIdMutation` | `DELETE crmClient /contacts/groups/{args.id}` |
| `useDeleteMessagesSendGroupsMutation` | `DELETE crmClient /messages/send/groups/{id}` |
| `useDeleteMessagesSendGroupsReceiversMutation` | `DELETE crmClient /messages/send/groups/{id}/receivers` |
| `useMessagesResultsReceiversKakaoQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}/kakao` |
| `useMessagesResultsReceiversQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}` |
| `useMessagesSendGroupsEstimateQuery` | `POST crmClient /messages/send/groups/{id}/estimate` |
| `useMessagesSendGroupsReceiversCountQuery` | `GET crmClient /messages/send/groups/{id}/receivers/count` |
| `useMessagesSendGroupsReceiversDuplicatesQuery` | `GET crmClient /messages/send/groups/{id}/receivers/duplicates` |
| `useMessagesSendGroupsReceiversMarketingConsentUndecidedQuery` | `GET crmClient /messages/send/groups/{id}/receivers/marketing-consent-undecided` |
| `usePostContactsFiltersMutation` | `POST crmClient /contacts/filters` |
| `usePostContactsFiltersUseByIdMutation` | `POST crmClient /contacts/filters/{args.id}/use` |
| `usePostContactsGroupsFromMessageSendGroupMutation` | `POST crmClient /contacts/groups/from-message-send-group` |
| `usePostContactsGroupsMembersAddFromMessageSendGroupMutation` | `POST crmClient /contacts/groups/members/add/from-message-send-group` |
| `usePostContactsGroupsMembersAddMutation` | `POST crmClient /contacts/groups/{id}/members/add` |
| `usePostContactsGroupsMembersRemoveMutation` | `POST crmClient /contacts/groups/{id}/members/remove` |
| `usePostMessagesSendGroupsMutation` | `POST crmClient /messages/send/groups` |
| `usePostMessagesSendGroupsReceiversAddAllMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/all` |
| `usePostMessagesSendGroupsReceiversAddContactGroupsMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/contact-groups` |
| `usePostMessagesSendGroupsReceiversAddEmrPatientsMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/emr-patients` |
| `usePostMessagesSendGroupsReceiversAddFiltersMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/filters` |
| `usePostMessagesSendGroupsReceiversDuplicatesHandleMutation` | `POST crmClient /messages/send/groups/{id}/receivers/duplicates/handle` |
| `usePostMessagesSendGroupsReceiversMutation` | `POST crmClient messages/send/groups/{id}/receivers` |
| `usePostMessagesSendGroupsReceiversRemoveMutation` | `POST crmClient /messages/send/groups/{id}/receivers/remove` |
| `usePostMessagesSendMutation` | `POST crmClient /messages/send` |
| `usePutMessagesSendGroupsMutation` | `PUT crmClient /messages/send/groups/{id}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |
| `getMessagesSendGroups` (직접) | `GET crmClient /messages/send/groups` |
| `getMessagesSendGroups_2` (직접) | `GET crmClient /messages/send/groups/{id}` |
| `getMessagesTemplatesByTemplateTypeAndId` (직접) | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |
| `getMessagesSendGroupsReceivers` (직접) | `GET crmClient messages/send/groups/{id}/receivers` |
| `putMessagesKakaoAlimtalkGroups` (직접) | `PUT crmClient /messages/kakao/alimtalk/groups/{id}` |
| `putMessagesKakaoBrandGroups` (직접) | `PUT crmClient /messages/kakao/brand/groups/{id}` |

</details>

<a id="route-crm-contents-view"></a>

### `/crm/contents/view/:token` · crm-contents-view

- 화면: [CrmContentPatientPreview](../restored/components/crm/CrmContentPatientPreview.vue) · 부모 라우트 `crm`
- meta: 권한 `일반문자`
- 컴포넌트: 전용 1 · 공유 0 · API: 화면 2 · 전체 도달 2

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsBundlesQuery` | `GET crmClient /contents/bundles/{input}` |
| `postContentsBundlesEvents` (직접) | `POST crmClient /contents/bundles/{token}/events` |

</details>

<a id="route-crm-message-send-completed"></a>

### `/crm/message/send-completed` · crm-message-send-completed

- 화면: [MessageSendCompletedView](../restored/views/MessageSendCompletedView.vue) · 부모 라우트 `crm`
- meta: 권한 `일반문자`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 1 · 전체 도달 1

<details>
<summary>컴포넌트 트리</summary>

- BaseCompleted ↗

</details>

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMessagesSendGroups_2` (직접) | `GET crmClient /messages/send/groups/{id}` |

</details>

<a id="route-crm-message-results"></a>

### `/crm/message/results` · crm-message-results

- 화면: [MessageResultsView](../restored/views/MessageResultsView.vue) · 부모 라우트 `crm`
- meta: 권한 `전송이력`
- 컴포넌트: 전용 16 · 공유 28 · API: 화면 13 · 전체 도달 18
- 스토어: `useCrmMessageResultLinksStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButtonGroup ↗
- BaseButtonGroupItem ↗
- EmrDateRangePickerButton ↗
- **MessageResultsDashboard**
  - LoadingBoxWithSpinner ↗
- **MessageResultsList**
  - BaseButton ↗
  - BaseCheckBoxDropDown ↗
  - BaseSelectBox ↗
  - BaseSidePanel ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - ContentDivider ↗
  - **MessageResultsDetailSidePanel**
    - BaseCloseButton ↗
    - **MessageResultsDetail**
      - CrmMessagePreviewAdapter ↗
      - **MessageResultsDetailLinks**
        - **MessageResultsDetailLink**
      - **MessageResultsDetailReceivers**
        - BaseTabBar ↗
        - BaseToggleSwitch ↗
        - CrmCommonTableContainer ↗
        - **MessageResultsDetailReceiversTable**
      - **MessageResultsDetailSendingInfo**
        - **MessageResultsDetailPaymentAmount**
      - OverlayScrollbar ↗
      - RefreshButton ↗
    - **MessageResultsDetailSidePanelFooter**
      - **MessageResultsReservedAtConfirm**
        - CrmCommonMessageFormReservedAt ↗
  - **MessageResultsListTable**
  - RefreshButton ↗

</details>

<details>
<summary>훅 → API (13)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesResultsReservationMutation` | `DELETE crmClient /messages/results/{id}/reservation` |
| `useMessagesResultsLinksByIdQuery` | `GET crmClient /messages/results/{args.id}/links` |
| `useMessagesResultsQuery` | `GET crmClient /messages/results` |
| `useMessagesResultsReceiversCountQuery` | `GET crmClient /messages/results/{id}/receivers/count` |
| `useMessagesResultsReceiversKakaoQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}/kakao` |
| `useMessagesResultsReceiversQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}` |
| `useMessagesSendGroupsQuery` | `GET crmClient /messages/send/groups/{id}` |
| `usePatchMessagesResultsReservationMutation` | `PATCH crmClient /messages/results/{id}/reservation` |
| `usePostMessagesResultsListDownloadMutation` | `POST crmClient /messages/results/list/download` |
| `usePostMessagesResultsResendMutation` | `POST crmClient /messages/results/{id}/resend` |
| `getMessagesResultsReceivers` (직접) | `GET crmClient /messages/results/{id}/receivers` |
| `getMessagesResultsList` (직접) | `GET crmClient /messages/results/list` |
| `getMessagesResultsListCount` (직접) | `GET crmClient /messages/results/list/count` |

</details>

<a id="route-crm-refusal"></a>

### `/crm/refusal` · crm-refusal

- 화면: [CrmRefusalView](../restored/views/CrmRefusalView.vue) · 부모 라우트 `crm`
- meta: 권한 `수신거부목록`
- 컴포넌트: 전용 9 · 공유 27 · API: 화면 6 · 전체 도달 299
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- **CrmRefusalViewList080**
  - BaseButton ↗
  - BaseDialogModal ↗
  - BaseFeaturedIcon ↗
  - BaseLabel ↗
  - BaseTextArea ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - ContentDivider ↗
  - **CrmRefusalViewListTable080**
    - AgGridTable ↗
- **CrmRefusalViewListHospital**
  - BaseSelectBox ↗
  - **CrmRefusalViewListHospitalRegisterPanel**
    - BaseCheckBox ↗
    - **CrmRefusalViewExcelUploadButton**
      - BaseCloseButton ↗
      - BasePopover ↗
      - CrmCommonExcelColumnConfirm ↗
      - CrmCommonExcelUploadConfirm ↗
      - CrmCommonExcelUploader ↗
    - [PatientAutoCompleteSearchCrm](component-api.md#c-components-patient-patientautocompletesearchcrm) ↗
  - **CrmRefusalViewListTableHospital**
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - **CrmRefusalViewListTableHospitalActionCell**
      - AgreementsPopover ↗
      - BaseConfirmDialog ↗
      - BaseSidePanel ↗
      - OverlayScrollbar ↗
      - [PatientInfoDetail](component-api.md#c-components-patient-patientinfodetail) ↗
    - **CrmRefusalViewListTableHospitalAgreementsCell**
      - BaseBadge ↗
- RefreshButton ↗

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRefusalsContactMutation` | `PATCH crmClient /refusals/contact/{contactId}` |
| `usePatchRefusalsMutation` | `PATCH crmClient /refusals/{id}` |
| `usePostRefusalsDownloadMutation` | `POST crmClient /refusals/download` |
| `getRefusals` (직접) | `GET crmClient /refusals` |
| `getRefusals080` (직접) | `GET crmClient /refusals/080` |
| `postRefusals` (직접) | `POST crmClient /refusals` |

</details>

<a id="route--message"></a>

### `/message` · 

- 화면: [MessageView](../restored/modules/MessageView)
- meta: `requiresAuth`
- 컴포넌트: 전용 0 · 공유 0 · API: 화면 0 · 전체 도달 0

<a id="route--claim"></a>

### `/claim` · 

- 화면: [ClaimView](../restored/views/ClaimView.vue)
- meta: 권한 `청구` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- SooProV2FeatureRestrictionBanner ↗

</details>

<a id="route-claim-hira"></a>

### `/claim/hira` · claim-hira

- 화면: [ClaimHiraView](../restored/views/ClaimHiraView.vue)
- meta: 권한 `심평원청구`
- 컴포넌트: 전용 1 · 공유 4 · API: 화면 0 · 전체 도달 338

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- [ClaimJejuEntryButton](component-api.md#c-components-claim-claimjejuentrybutton) ↗
- [ClaimResultView](component-api.md#c-views-claimresultview) ↗
- [ClaimV2InboxView](component-api.md#c-views-claimv2inboxview) ↗

</details>

<a id="route-claim-hira-submit-items"></a>

### `/claim/hira-submit-items` · claim-hira-submit-items

- 화면: [HiraSubmitItemsView](../restored/views/HiraSubmitItemsView.vue)
- meta: 권한 `추나첩약제출현황`
- 컴포넌트: 전용 20 · 공유 25 · API: 화면 15 · 전체 도달 43
- 스토어: `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseFeaturedIcon ↗
- **HiraSubmitItemsViewChunaFilters**
  - BaseButton ↗
  - BaseCheckBoxDropDown ↗
- **HiraSubmitItemsViewHeader**
  - PageHeaderBar ↗
  - RefreshButton ↗
- **HiraSubmitItemsViewMainChubyak**
  - EmptyPatient ↗
  - **HiraSubmitItemsViewChubyakTable**
    - AgGridTable ↗
    - AgGridTableBadgeCell ↗
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - AgGridTableTextCell ↗
    - **HiraSubmitItemsViewChubyakModifyModal**
      - **HiraSubmitItemsViewChubyakModifyContent**
        - BaseCloseButton ↗
        - [ChubyakForm](component-api.md#c-components-chubyak-chubyakform) ↗
        - ChubyakInfoTable ↗
        - OverlayScrollbar ↗
    - **HiraSubmitItemsViewChubyakTableActionCell**
    - **HiraSubmitItemsViewChubyakTableDetailRow**
  - **HiraSubmitItemsViewFloatingBanner**
  - ProgressSpinner ↗
- **HiraSubmitItemsViewMainChubyakJabo**
  - **HiraSubmitItemsViewChubyakJaboTable**
    - **HiraSubmitItemsViewChubyakJaboModifyModal**
      - **HiraSubmitItemsViewChubyakJaboModifyContent**
        - ChubyakJaboFormDispensaryRoomType ↗
        - [ChubyakJaboFormEffects](component-api.md#c-components-chubyak-chubyakjaboformeffects) ↗
        - ChubyakJaboFormLongAgreements ↗
        - ChubyakJaboFormRemarks ↗
        - [ChubyakJaboFormSyndromes](component-api.md#c-components-chubyak-chubyakjaboformsyndromes) ↗
        - ChubyakJaboInfoTable ↗
    - **HiraSubmitItemsViewChubyakJaboTableActionCell**
    - **HiraSubmitItemsViewChubyakJaboTableDetailRow**
- **HiraSubmitItemsViewMainChuna**
  - **HiraSubmitItemsViewChunaTable**
    - [AgGridTableDoctorsCell](component-api.md#c-components-aggrid-aggridtabledoctorscell) ↗
    - **HiraSubmitItemsViewChunaTableActionCell**
    - **HiraSubmitItemsViewChunaTableDetailRow**
- MetricTab ↗

</details>

<details>
<summary>훅 → API (15)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `prefetchSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatchRecordPrescriptionsByIdMutation` | `PATCH emrClient /record/prescriptions/{body.id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPcmdChecklistMutation` | `POST emrClient /record/hira/pcmd-checklist` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordHiraCarPcmdQuery` | `GET emrClient /record/hira/car-pcmd` |
| `useRecordHiraChunaQuery` | `GET emrClient /record/hira/chuna` |
| `useRecordHiraPcmdQuery` | `GET emrClient /record/hira/pcmd` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |

</details>

<a id="route-claim-medical-aids"></a>

### `/claim/medical-aids` · claim-medical-aids

- 화면: [MedicalAidsView](../restored/views/MedicalAidsView.vue)
- meta: 권한 `의료급여진료승인현황`
- 컴포넌트: 전용 10 · 공유 17 · API: 화면 8 · 전체 도달 9
- 스토어: `useMedicalAidsStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

<details>
<summary>컴포넌트 트리</summary>

- **MedicalAidsViewHeader**
  - PageHeaderBar ↗
- **MedicalAidsViewMain**
  - EmptyPatient ↗
  - HiraSubmitItemsViewFloatingBanner ↗
  - **MedicalAidsViewTable**
    - AgGridTable ↗
    - AgGridTableBadgeCell ↗
    - [AgGridTablePatientNameCell](component-api.md#c-components-aggrid-aggridtablepatientnamecell) ↗
    - AgGridTableTextCell ↗
    - **MedicalAidsM3ModifyModal**
      - **MedicalAidsM3ModifyModalContent**
        - BaseButton ↗
        - BaseCloseButton ↗
        - **MedicalAidsM3M4Form**
          - BaseSelectBox ↗
          - BaseTextInput ↗
          - CursorFollowingTooltip ↗
          - **MedicalAidsHospitalSelect**
        - **MedicalAidsM3M4InfoDisplay**
          - BaseDot ↗
          - BasePopover ↗
        - OverlayScrollbar ↗
    - **MedicalAidsViewTableActionsCell**
- MetricTab ↗

</details>

<details>
<summary>훅 → API (8)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM3Query_2` | `GET emrClient /nhic/m3` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `getRecord` (직접) | `GET emrClient /record/{input}` |

</details>

<a id="route-claim-home-visit"></a>

### `/claim/home-visit` · claim-home-visit

- 화면: [ClaimHomeVisitView](../restored/views/ClaimHomeVisitView.vue)
- meta: 권한 `청구`
- 컴포넌트: 전용 1 · 공유 5 · API: 화면 2 · 전체 도달 2
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseBadge ↗
- BaseButton ↗
- MetricTab ↗
- PageHeaderBar ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRecordHomeVisitFormStatusMutation` | `PATCH emrClient /record/home-visit/{rid}/form-status` |
| `useRecordHomeVisitQuery` | `GET emrClient /record/home-visit` |

</details>

<a id="route-claim-telemedicine-pilot"></a>

### `/claim/telemedicine-pilot` · claim-telemedicine-pilot

- 화면: [ClaimTelemedicinePilotView](../restored/views/ClaimTelemedicinePilotView.vue)
- meta: 권한 `청구`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 2 · 전체 도달 2

<details>
<summary>컴포넌트 트리</summary>

- BaseBadge ↗
- MetricTab ↗
- PageHeaderBar ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordTelemedicinePilotRatioQuery` | `GET emrClient /record/telemedicine-pilot/ratio` |
| `useRecordTelemedicinePilotRecordsQuery` | `GET emrClient /record/telemedicine-pilot/records` |

</details>

<a id="route-year-settlement"></a>

### `/claim/year-settlement` · year-settlement

- 화면: [YearSettlement](../restored/components/year/YearSettlement.vue)
- meta: 권한 `청구`
- 컴포넌트: 전용 14 · 공유 19 · API: 화면 6 · 전체 도달 6
- 스토어: `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- **YearSettlementContainer**
  - **YearSettlementByTreatmentTable**
  - **YearSettlementHeader**
    - BaseButton ↗
    - BaseButtonGroup ↗
    - BaseButtonGroupItem ↗
    - BasePopover ↗
    - BaseSelectableButton ↗
    - BaseTextInput ↗
    - BaseTextInputPlainModule ↗
    - BaseToggleSwitch ↗
    - ContentDivider ↗
    - EmrDateRangePickerButton ↗
  - **YearSettlementHospitalInfoModal**
    - BaseCloseButton ↗
  - **YearSettlementTable**

</details>

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsYearEndTaxSettlementDetailsCountQuery` | `GET emrClient /documents/year-end-tax-settlement/details/count` |
| `useDocumentsYearEndTaxSettlementDetailsQuery` | `GET emrClient /documents/year-end-tax-settlement/details` |
| `useDocumentsYearEndTaxSettlementQuery` | `GET emrClient /documents/year-end-tax-settlement` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation_2` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePostDocumentsYearEndTaxSettlementDownloadMutation` | `POST emrClient /documents/year-end-tax-settlement/download` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

</details>

<a id="route-insurance-inquiry"></a>

### `/insurance-inquiry` · insurance-inquiry

- 화면: [InsuranceInquiryView](../restored/views/InsuranceInquiryView.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 2 · 공유 11 · API: 화면 11 · 전체 도달 115
- 스토어: `useSocketClientStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- [HospitalTermsConsentScreen](component-api.md#c-components-hospital-hospitaltermsconsentscreen) ↗
- HospitalTermsWaitingScreen ↗
- **InsuranceInquiryWorkbench**
  - ClaimMigrationModal ↗
  - [PatientAddModal](component-api.md#c-components-patient-patientaddmodal) ↗
  - [PatientDetailPanel](component-api.md#c-components-patient-patientdetailpanel) ↗
  - PatientHistoryPanel ↗
  - [QrOutputModal](component-api.md#c-components-qr-qroutputmodal) ↗
- InsuranceSubscriptionRequiredScreen ↗
- LoadingBoxWithSpinner ↗

</details>

<details>
<summary>훅 → API (11)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeletePatientsMutation` | `DELETE insuranceClient /patients/{input}` |
| `useHospitalClaimMigrationJobsCurrentQuery` | `GET insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/current` |
| `useHospitalTermsQuery` | `GET insuranceClient /hospital/terms` |
| `usePatchPatientsMutation` | `PATCH insuranceClient /patients/{input}` |
| `usePatientsQuery` | `GET insuranceClient /patients` |
| `usePostHospitalClaimMigrationJobsCancelMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/{input}/cancel` |
| `usePostHospitalClaimMigrationJobsConfirmMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/{input}/confirm` |
| `usePostHospitalClaimMigrationJobsMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs` |
| `usePostPatientsMutation` | `POST insuranceClient /patients` |
| `useSubscriptionsUsageQuery` | `GET insuranceClient /subscriptions/usage` |

</details>

<a id="route-electronic-signature"></a>

### `/electronic-signature` · electronic-signature

- 화면: [ElectronicSignatureView](../restored/views/ElectronicSignatureView.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 8 · API: 화면 1 · 전체 도달 22

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- BaseSidePanel ↗
- BaseTabBar ↗
- CompleteView ↗
- LoadingBoxWithSpinner ↗
- [NaverSignModal](component-api.md#c-components-naver-naversignmodal) ↗
- [RequiredView](component-api.md#c-views-requiredview) ↗
- SignatureSidePanelView ↗

</details>

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

</details>

<a id="route-setting"></a>

### `/setting` · setting

- 화면: [SettingView](../restored/views/SettingView.vue)
- meta: 권한 `설정` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 2 · API: 화면 1 · 전체 도달 1

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗

</details>

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

</details>

<a id="route-setting-common"></a>

### `/setting/common` · setting-common

- 화면: [SettingCommonView](../restored/views/SettingCommonView.vue) · 부모 라우트 `setting`
- meta: 권한 `기본설정`
- 컴포넌트: 전용 8 · 공유 16 · API: 화면 24 · 전체 도달 31
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- **SettingCommonViewClinicHoursConfig**
  - BaseButton ↗
  - BaseConfirmDialog ↗
  - BaseToggleSwitch ↗
  - SettingTimeSection ↗
  - SettingTreatmentTimeEditModal ↗
  - [TemporaryHoursOrMonthlyHoliday](component-api.md#c-components-temporary-temporaryhoursormonthlyholiday) ↗
- **SettingCommonViewPatientSettings**
- **SettingCommonViewTreatmentListConfig**
  - BaseCheckBox ↗
  - ContentDivider ↗
  - OverlayScrollbar ↗
  - [PatientCard](component-api.md#c-components-patient-patientcard) ↗
  - **SettingCommonViewTreatmentListItem**
    - BaseTextInput ↗
    - **SettingCommonViewTreatmentColorSelect**
      - SelectPortal ↗
      - SelectRoot ↗

</details>

<details>
<summary>훅 → API (24)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsMedicalTreatmentsMutation` | `DELETE emrClient /settings/medical-treatments/{id}` |
| `useDeleteSettingsPatientLevelsMutation` | `DELETE emrClient /settings/patient-levels/{input}` |
| `useDeleteSettingsVisitPathwaysMutation` | `DELETE emrClient /settings/visit-pathways/{id}` |
| `usePatchSettingsClinicHoursMutation` | `PATCH emrClient /settings/clinic-hours` |
| `usePatchSettingsDisplayChartNumbersMutation` | `PATCH emrClient /settings/display/chart-numbers` |
| `usePatchSettingsDisplayResidentNumbersMutation` | `PATCH emrClient /settings/display/resident-numbers` |
| `usePatchSettingsHospitalsChartNumberMutation` | `PATCH emrClient /settings/hospitals/chart-number` |
| `usePatchSettingsMedicalTreatmentsMutation` | `PATCH emrClient /settings/medical-treatments/{id}` |
| `usePatchSettingsPatientLevelsMutation` | `PATCH emrClient /settings/patient-levels/{id}` |
| `usePatchSettingsVisitPathwaysMutation` | `PATCH emrClient /settings/visit-pathways/{id}` |
| `usePostSettingsMedicalTreatmentsMutation` | `POST emrClient /settings/medical-treatments` |
| `usePostSettingsPatientLevelsMutation` | `POST emrClient /settings/patient-levels` |
| `usePostSettingsVisitPathwaysMutation` | `POST emrClient /settings/visit-pathways` |
| `usePutSettingsClinicCalendarDaysMutation` | `PUT emrClient /settings/clinic-calendar/days` |
| `useSettingsClinicCalendarYearQuery` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsHospitalsChartNumberQuery` | `GET emrClient /settings/hospitals/chart-number` |
| `useSettingsMedicalTreatmentsQuery` | `GET emrClient /settings/medical-treatments` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |
| `useSettingsVisitPathwaysQuery` | `GET emrClient /settings/visit-pathways` |

</details>

<a id="route-setting-telemedicine"></a>

### `/setting/telemedicine` · setting-telemedicine

- 화면: [SettingTelemedicineView](../restored/views/SettingTelemedicineView.vue) · 부모 라우트 `setting`
- meta: 권한 `기본설정`
- 컴포넌트: 전용 1 · 공유 2 · API: 화면 0 · 전체 도달 8

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- [SettingCommonViewTelemedicineConfig](component-api.md#c-components-setting-settingcommonviewtelemedicineconfig) ↗

</details>

<a id="route-setting-service-integration"></a>

### `/setting/service-integration` · setting-service-integration

- 화면: [SettingServiceIntegrationView](../restored/views/SettingServiceIntegrationView.vue) · 부모 라우트 `setting`
- meta: 권한 `기본설정`
- 컴포넌트: 전용 1 · 공유 6 · API: 화면 3 · 전체 도달 13
- 스토어: `useOnboardingGuideSessionStore`, `useSooSignUpStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseConfirmDialog ↗
- [InsuranceSubscriptionModal](component-api.md#c-components-insurance-insurancesubscriptionmodal) ↗
- ServiceConnectModal ↗
- ServiceConnectorCard ↗
- [ServiceManageModal](component-api.md#c-components-service-servicemanagemodal) ↗
- SooLinkConnectModal ↗

</details>

<details>
<summary>훅 → API (3)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostIntegrationsSooLinkMutation` | `POST accountClient /integrations/soo/link` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

</details>

<a id="route-setting-hospital-info"></a>

### `/setting/hospital` · setting-hospital-info

- 화면: [SettingHospitalView](../restored/views/SettingHospitalView.vue) · 부모 라우트 `setting`
- meta: 권한 `병원정보설정`
- 컴포넌트: 전용 6 · 공유 11 · API: 화면 28 · 전체 도달 29
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseAlert ↗
- BaseButton ↗
- BaseCheckBox ↗
- BaseLabel ↗
- BaseTextInput ↗
- BaseTextInputButtonModule ↗
- OverlayScrollbar ↗
- [RegisterAddress](component-api.md#c-components-register-registeraddress) ↗
- **SettingHospitalBusinessCard**
  - **SettingHospitalFieldBadge**
    - BaseBadge ↗
  - **SettingHospitalProofBlock**
- **SettingHospitalImage**
- **SettingHospitalJejuClaim**
  - BaseSelectBox ↗

</details>

<details>
<summary>훅 → API (28)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useMembersUpstreamClinicsMyQuery` | `GET thesooClient /members/upstream/clinics/my` |
| `usePatchMembersUpstreamClinicsMyMutation` | `PATCH thesooClient /members/upstream/clinics/my` |
| `usePatchSettingsHospitalsMutation` | `PATCH emrClient /settings/hospitals` |
| `usePatchSettingsHospitalsMutation_2` | `PATCH emrClient /settings/hospitals` |
| `usePostNhicCertFilesMutation` | `POST emrClient /nhic/cert-files` |
| `usePutTermsOptionalAgreementsMutation` | `PUT accountClient /terms/optional-agreements` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useTermsMyAgreementsQuery` | `GET accountClient /terms/my-agreements` |
| `getChangeRequestsDocument` (직접) | `GET accountClient {mI}/{id}/document` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `getNhicCertFiles` (직접) | `GET emrClient /nhic/cert-files` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `postSettingsImagesPrivate` (직접) | `POST emrClient /settings/images/private` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

</details>

<a id="route-setting-treatment"></a>

### `/setting/treatment` · setting-treatment

- 화면: [SettingTreatmentView](../restored/views/SettingTreatmentView.vue) · 부모 라우트 `setting`
- meta: 권한 `진료설정`
- 컴포넌트: 전용 7 · 공유 14 · API: 화면 14 · 전체 도달 16
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- **SettingTreatmentViewAcupuncturePositions**
  - BaseButton ↗
  - BaseCheckBox ↗
  - BaseTextInput ↗
  - OverlayScrollbar ↗
- **SettingTreatmentViewExaminationClaim**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseConfirmDialog ↗
  - BaseToggleSwitch ↗
  - InputTimePicker ↗
- **SettingTreatmentViewProcedureTest**
- **SettingTreatmentViewVitalTreatmentRooms**
  - **SettingTreatmentViewVitalTreatmentRoomsVital**
    - BaseCheckBoxCard ↗
  - **SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms**
    - BaseDialogModal ↗
    - [TreatmentRoomRegisterOrModifyModal](component-api.md#c-components-treatment-treatmentroomregisterormodifymodal) ↗

</details>

<details>
<summary>훅 → API (14)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsTreatmentsRoomsMutation` | `DELETE emrClient /settings/treatments/rooms/{input}` |
| `usePatchSettingsInitialRecordsMutation` | `PATCH emrClient /settings/initial-records` |
| `usePatchSettingsTreatmentsAutoRecordMutation` | `PATCH emrClient /settings/treatments/auto-record` |
| `usePatchSettingsTreatmentsMutation` | `PATCH emrClient /settings/treatments/{id}` |
| `usePatchSettingsTreatmentsVitalsMutation` | `PATCH emrClient /settings/treatments/vitals/{id}` |
| `useSettingsInitialRecordsQuery` | `GET emrClient /settings/initial-records` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsReferencesAcupointsQuery` | `GET emrClient /settings/references/acupoints` |
| `useSettingsTreatmentsAutoRecordQuery` | `GET emrClient /settings/treatments/auto-record` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `useSettingsTreatmentsVitalsQuery` | `GET emrClient /settings/treatments/vitals` |
| `useTreatmentsPatientsBasicQuery` | `GET emrClient /treatments/patients/basic` |

</details>

<a id="route-setting-prescription"></a>

### `/setting/prescription` · setting-prescription

- 화면: [SettingPrescriptionView](../restored/views/SettingPrescriptionView.vue) · 부모 라우트 `setting`
- meta: 권한 `처방수가설정`
- 컴포넌트: 전용 81 · 공유 66 · API: 화면 111 · 전체 도달 137
- 스토어: `useOnboardingGuideSessionStore`, `useSettingChubyakPrescriptionStore`, `useSettingHerbStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseConfirmDialog ↗
- BaseFeaturedIcon ↗
- BaseTabBar ↗
- **SettingPrescriptionViewChubyak**
  - **SettingPrescriptionViewChubyakDispensaryRooms**
    - EmptyPatient ↗
    - **SettingPrescriptionViewChubyakDispensaryRoomsAddModal**
      - BaseCloseButton ↗
      - BaseLabel ↗
      - BaseSelectableButton ↗
      - BaseSelectBox ↗
      - BaseTextInput ↗
      - BaseTextInputPlainModule ↗
      - [SearchAddress](component-api.md#c-components-search-searchaddress) ↗
    - **SettingPrescriptionViewChubyakDispensaryRoomsCard**
  - **SettingPrescriptionViewChubyakHerbs**
    - **SettingPrescriptionViewChubyakHerbsConfig**
      - **SettingPrescriptionViewChubyakHerbsConfigGroupByCode**
        - BaseCollapsible ↗
        - **SettingPrescriptionViewChubyakHerbsConfigGroupByCodeTable**
          - InputDatePicker ↗
          - SimpleTable ↗
          - SimpleTableRowAction ↗
      - **SettingPrescriptionViewChubyakHerbsConfigGroupByDate**
        - LoadingBoxWithSpinner ↗
        - **SettingPrescriptionViewChubyakHerbsConfigGroupByDateTable**
      - **SettingPrescriptionViewChubyakHerbsConfigHeader**
        - BaseCheckBoxDropDown ↗
        - BaseToggleSwitch ↗
    - **SettingPrescriptionViewChubyakHerbsEmptyDispensaryRoom**
    - **SettingPrescriptionViewChubyakHerbsSide**
      - **SettingPrescriptionViewChubyakHerbsSideExcel**
        - BaseMenu ↗
        - FileUploadButton ↗
        - **SettingPrescriptionViewChubyakHerbsExcelCheckModal**
          - OverlayScrollbar ↗
          - **SettingPrescriptionViewChubyakHerbsExcelConfirmModal**
      - **SettingPrescriptionViewChubyakHerbsSideManual**
        - [BaseHerbProductSearch](component-api.md#c-components-base-baseherbproductsearch) ↗
  - **SettingPrescriptionViewChubyakPrescriptions**
    - **SettingPrescriptionViewChubyakPrescriptionsConfig**
      - **SettingPrescriptionViewChubyakPrescriptionsConfigHeader**
      - **SettingPrescriptionViewChubyakPrescriptionsConfigListView**
        - BaseAlert ↗
        - BaseBadge ↗
        - ContentDivider ↗
        - **SettingPrescriptionViewChubyakPrescriptionsConfigTable**
          - ChubyakHerbRegisterModal ↗
          - [HerbTableEditor](component-api.md#c-components-herb-herbtableeditor) ↗
          - **SettingPrescriptionViewChubyakPrescriptionsConfigTableAlias**
            - BaseTextInputButtonModule ↗
    - **SettingPrescriptionViewChubyakPrescriptionsSide**
- **SettingPrescriptionViewExpendable**
  - **SettingPrescriptionViewExpendableHistory**
- **SettingPrescriptionViewIndustrial**
  - **SettingPrescriptionViewInsuranceChubyak**
    - **SettingPrescriptionViewInsuranceChubyakList**
      - **SettingPrescriptionViewInsuranceChubyakNameDialog**
      - **SettingPrescriptionViewInsuranceChubyakTable**
    - **SettingPrescriptionViewInsuranceChubyakRegisterDialog**
- **SettingPrescriptionViewInsuranceMedicines**
  - **SettingPrescriptionViewInsuranceMedicineCustomPrescription**
    - BaseInputDropdown ↗
  - **SettingPrescriptionViewInsuranceMedicinesActivesTable**
    - [DiseaseSearchModal](component-api.md#c-components-disease-diseasesearchmodal) ↗
    - **SettingPrescriptionViewInsuranceMedicinesActivesTableRow**
      - SimpleTableCell ↗
      - SimpleTableRow ↗
  - **SettingPrescriptionViewInsuranceMedicinesTable**
- **SettingPrescriptionViewInsuranceMedicinesDosages**
  - BaseRadio ↗
- **SettingPrescriptionViewJabo**
  - **SettingPrescriptionViewJaboMedicine**
  - **SettingPrescriptionViewJaboProcedure**
    - **SettingPrescriptionViewJaboProcedureTableRow**
  - **SettingPrescriptionViewJaboYakchim**
    - AgGridNoRowsOverlay ↗
    - **SettingPrescriptionViewJaboYakchimCollapsible**
    - **SettingPrescriptionViewJaboYakchimRegisterModal**
      - BaseCheckBox ↗
- **SettingPrescriptionViewNonBenefit**
- **SettingPrescriptionViewPackage**
  - [PackageReviewSidePanel](component-api.md#c-components-package-packagereviewsidepanel) ↗
  - **SettingPrescriptionViewPackageEditPanel**
    - BaseButtonGroup ↗
    - BaseButtonGroupItem ↗
    - BaseCombobox ↗
    - [PrescriptionInputSearch](component-api.md#c-components-prescription-prescriptioninputsearch) ↗
    - **SettingPrescriptionViewPackagePrescriptionTable**
      - BaseSummaryBadge ↗
      - TreatmentViewBoardPrescriptionEditableCell ↗
  - **SettingPrescriptionViewPackageEmpty**
  - **SettingPrescriptionViewPackageGroupModal**
    - BaseTextInputWithMax ↗
  - **SettingPrescriptionViewPackageList**
  - **SettingPrescriptionViewPackagePrescriptionSidePanel**
    - BaseSidePanel ↗
    - [NonBenefitPrescriptionPicker](component-api.md#c-components-nonbenefit-nonbenefitprescriptionpicker) ↗
    - NonBenefitPrescriptionQuantityPopover ↗
    - NonBenefitPrescriptionRowBody ↗
- **SettingPrescriptionViewPersonalFormula**
  - **SettingPrescriptionViewPersonalFormulaMain**
    - **SettingPrescriptionViewPersonalFormulaCreateDialog**
      - BaseTextArea ↗
      - [PersonalFormulaHerbRowsEditor](component-api.md#c-components-personal-personalformulaherbrowseditor) ↗
    - **SettingPrescriptionViewPersonalFormulaItem**
  - **SettingPrescriptionViewPersonalFormulaSidebar**
- **SettingPrescriptionViewReserved**
  - **SettingPrescriptionViewReservedMain**
    - [ReservedDisease](component-api.md#c-components-reserved-reserveddisease) ↗
    - **SettingPrescriptionViewReservedEditor**
      - [BaseTreatmentEditor](component-api.md#c-components-base-basetreatmenteditor) ↗
      - NoteEditorMenu ↗
    - **SettingPrescriptionViewReservedGroupAddDialog**
    - **SettingPrescriptionViewReservedPrescription**
      - ChubyakJaboSubmitInfoSummary ↗
      - [PrescriptionInputSearchTreatment](component-api.md#c-components-prescription-prescriptioninputsearchtreatment) ↗
      - ReservedPrescriptionNonBenefitFeeCell ↗
      - [ReservedPrescriptionsEditPanel](component-api.md#c-components-reserved-reservedprescriptionseditpanel) ↗
  - **SettingPrescriptionViewReservedSidebar**

</details>

<details>
<summary>훅 → API (111)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsAppointedPrescriptionsGroupsMutation` | `DELETE emrClient /settings/appointed-prescriptions/groups/{input}` |
| `useDeleteSettingsAppointedPrescriptionsMutation` | `DELETE emrClient /settings/appointed-prescriptions/{input}` |
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsCarInsurancesHerbalMedicinesMutation` | `DELETE emrClient /settings/car-insurances/herbal-medicines/{input}` |
| `useDeleteSettingsCarInsurancesPharmacopuncturesMutation` | `DELETE emrClient /settings/car-insurances/pharmacopunctures/{input}` |
| `useDeleteSettingsDispensaryRoomsMutation` | `DELETE emrClient /settings/dispensary-rooms/{input}` |
| `useDeleteSettingsHospitalsChubyakPilotsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/herbs?{e}` |
| `useDeleteSettingsHospitalsChubyakPilotsPrescriptionsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{input}` |
| `useDeleteSettingsHospitalsChubyakPilotsPrescriptionsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/prescriptions/{input}` |
| `useDeleteSettingsMedicinesMutation` | `DELETE emrClient /settings/medicines/{input}` |
| `useDeleteSettingsNonbenefitGroupsMutation` | `DELETE emrClient /settings/nonbenefit-groups/{id}` |
| `useDeleteSettingsNonbenefitsMutation` | `DELETE emrClient /settings/nonbenefits/{input}` |
| `useDeleteSettingsPersonalFormulasMutation` | `DELETE emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsTreatmentsExpendablesHistoriesMutation` | `DELETE emrClient /settings/treatments/expendables/{expendablesId}/histories/{historyId}` |
| `useJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePatchSettingsAppointedPrescriptionsGroupsMutation` | `PATCH emrClient /settings/appointed-prescriptions/groups/{id}` |
| `usePatchSettingsAppointedPrescriptionsMutation` | `PATCH emrClient /settings/appointed-prescriptions/{id}` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsCarInsurancesHerbalMedicinesMutation` | `PATCH emrClient /settings/car-insurances/herbal-medicines/{id}` |
| `usePatchSettingsCarInsurancesPharmacopuncturesMutation` | `PATCH emrClient /settings/car-insurances/pharmacopunctures/{id}` |
| `usePatchSettingsCarInsurancesProcedureFeeMutation` | `PATCH emrClient /settings/car-insurances/procedure-fee/{code}` |
| `usePatchSettingsDispensaryRoomsMutation` | `PATCH emrClient /settings/dispensary-rooms/{id}` |
| `usePatchSettingsHospitalsChubyakPilotsHerbsMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/herbs/{id}` |
| `usePatchSettingsHospitalsChubyakPilotsPrescriptionsAliasMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/prescriptions/{id}/alias` |
| `usePatchSettingsHospitalsChubyakPilotsPrescriptionsHerbsMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{id}` |
| `usePatchSettingsMedicinesDosagesMutation` | `PATCH emrClient /settings/medicines/dosages` |
| `usePatchSettingsMedicinesMutation` | `PATCH emrClient /settings/medicines/{id}` |
| `usePatchSettingsNonbenefitGroupsMutation` | `PATCH emrClient /settings/nonbenefit-groups/{id}` |
| `usePatchSettingsNonbenefitsGroupsMutation` | `PATCH emrClient /settings/nonbenefits/groups` |
| `usePatchSettingsNonbenefitsV2Mutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}` |
| `usePatchSettingsNonreimbursedHerbTemplatesMutation` | `PATCH emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{id}` |
| `usePatchSettingsPersonalFormulasMutation` | `PATCH emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{id}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsTreatmentsExpendablesHistoriesMutation` | `PATCH emrClient /settings/treatments/expendables/{expendablesId}/histories/{historyId}` |
| `usePatchSettingsTreatmentsExpendablesMutation` | `PATCH emrClient /settings/treatments/expendables/{id}` |
| `usePostSettingsAppointedPrescriptionsGroupsMutation` | `POST emrClient /settings/appointed-prescriptions/groups` |
| `usePostSettingsAppointedPrescriptionsMutation` | `POST emrClient /settings/appointed-prescriptions` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsCarInsurancesHerbalMedicinesMutation` | `POST emrClient /settings/car-insurances/herbal-medicines` |
| `usePostSettingsCarInsurancesPharmacopuncturesMutation` | `POST emrClient /settings/car-insurances/pharmacopunctures` |
| `usePostSettingsDispensaryRoomsMutation` | `POST emrClient /settings/dispensary-rooms` |
| `usePostSettingsHospitalsChubyakPilotsHerbsMutation` | `POST emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `usePostSettingsHospitalsChubyakPilotsPrescriptionsMutation` | `POST emrClient /settings/hospitals/chubyak-pilots/prescriptions` |
| `usePostSettingsMedicinesFromCustomMutation` | `POST emrClient /settings/medicines/from-custom` |
| `usePostSettingsMedicinesFromMixtureMutation` | `POST emrClient /settings/medicines/from-mixture` |
| `usePostSettingsNonbenefitGroupsMutation` | `POST emrClient /settings/nonbenefit-groups` |
| `usePostSettingsNonbenefitsBulkDeleteMutation` | `POST emrClient /settings/nonbenefits/bulk-delete` |
| `usePostSettingsNonbenefitsV2Mutation` | `POST emrClient /settings/nonbenefits/v2` |
| `usePostSettingsNonbenefitsValidateMutation` | `POST emrClient /settings/nonbenefits/validate` |
| `usePostSettingsNonreimbursedHerbTemplatesMutation` | `POST emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `usePostSettingsPersonalFormulasDuplicateMutation` | `POST emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}/duplicate` |
| `usePostSettingsPersonalFormulasMutation` | `POST emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `usePostSettingsTreatmentsExpendablesHistoriesMutation` | `POST emrClient /settings/treatments/expendables/{id}/histories` |
| `usePutSettingsAppointedPrescriptionsGroupsSortOrderMutation` | `PUT emrClient /settings/appointed-prescriptions/groups/sort-order` |
| `usePutSettingsAppointedPrescriptionsSortOrderMutation` | `PUT emrClient /settings/appointed-prescriptions/sort-order` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions/{input}` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalMedicinesQuery` | `GET emrClient /settings/car-insurances/herbal-medicines` |
| `useSettingsCarInsurancesPharmacopunctureReferencesQuery` | `GET emrClient /settings/car-insurances/pharmacopuncture-references` |
| `useSettingsCarInsurancesPharmacopuncturesQuery` | `GET emrClient /settings/car-insurances/pharmacopunctures` |
| `useSettingsCarInsurancesProcedureReferencesQuery` | `GET emrClient /settings/car-insurances/procedure-references` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsChubyakPilotsHerbsAvailableProductCodesQuery` | `GET emrClient /settings/chubyak-pilots/herbs/available-product-codes` |
| `useSettingsChubyakPilotsPrescriptionsQuery` | `GET emrClient /settings/chubyak-pilots/prescriptions` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `useSettingsDispensaryRoomsQuery_2` | `GET emrClient /settings/dispensary-rooms/{input}` |
| `useSettingsHospitalsChubyakPilotsHerbsQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsByIdQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/{args.id}` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsMedicinesDosagesQuery` | `GET emrClient /settings/medicines/dosages` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `useSettingsPersonalFormulasQuery_2` | `GET emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |
| `useSettingsReferenceFormulasSearchQuery` | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `useSettingsReferencesAcupointsQuery` | `GET emrClient /settings/references/acupoints` |
| `useSettingsReferencesSimpleExtractMixedQuery_2` | `GET emrClient settings/references/simple-extract-mixed` |
| `useSettingsReferencesSimpleExtractsQuery` | `GET emrClient settings/references/simple-extracts` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsTreatmentsExpendablesHistoriesQuery` | `GET emrClient /settings/treatments/expendables/{input}/histories` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |
| `Ir` (직접) | `DELETE emrClient /settings/nonbenefit-package-groups/{t}` |
| `br` (직접) | `DELETE emrClient /settings/nonbenefit-packages/{t}` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |
| `getSettingsChubyakPilotsHerbsProducts` (직접) | `GET emrClient /settings/chubyak-pilots/herbs/products` |
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |
| `getSettingsNonbenefitsAffectedPackagesDelete` (직접) | `GET emrClient /settings/nonbenefits/{input}/affected-packages/delete` |
| `Cr` (직접) | `PATCH emrClient /settings/nonbenefit-package-groups/{t}` |
| `_r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}` |
| `$r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}/favorite` |
| `postSettingsHospitalsChubyakPilotsPrescriptionsHerbs` (직접) | `POST emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{id}` |
| `kr` (직접) | `POST emrClient /settings/nonbenefit-package-groups` |
| `u0` (직접) | `POST emrClient /settings/nonbenefit-package-groups/validate` |
| `yr` (직접) | `POST emrClient /settings/nonbenefit-packages` |
| `wr` (직접) | `POST emrClient /settings/nonbenefit-packages/validate` |
| `postSettingsNonbenefitsAffectedPackagesUpdate` (직접) | `POST emrClient /settings/nonbenefits/{input}/affected-packages/update` |

</details>

<a id="route-setting-templates"></a>

### `/setting/templates` · setting-templates

- 화면: [SettingEditorTemplates](../restored/components/setting/SettingEditorTemplates.vue) · 부모 라우트 `setting`
- meta: 권한 `상용구설정`
- 컴포넌트: 전용 8 · 공유 16 · API: 화면 19 · 전체 도달 19
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **SettingEditorTemplatesMain**
  - BaseButton ↗
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseConfirmDialog ↗
  - BaseTextInput ↗
  - BaseTextInputPlainModule ↗
  - EmptyPatient ↗
  - **SettingEditorTemplatesEditor**
    - [BaseTreatmentEditor](component-api.md#c-components-base-basetreatmenteditor) ↗
    - NoteEditorMenu ↗
  - **SettingEditorTemplatesPrescriptionSelect**
    - BasePopover ↗
    - BaseTextInputButtonModule ↗
  - **SettingEditorTemplatesReferencePanel**
  - TextareaSnippetDropdown ↗
- **SettingEditorTemplatesSidebar**

</details>

<details>
<summary>훅 → API (19)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsTemplatesMutation` | `DELETE emrClient /settings/templates/{input}` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatchSettingsTemplatesMutation` | `PATCH emrClient /settings/templates/{id}` |
| `usePostSettingsTemplatesMutation` | `POST emrClient /settings/templates` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTemplatesQuery` | `GET emrClient /settings/templates` |
| `deleteDocumentsPhrases` (직접) | `DELETE emrClient /documents/phrases/{id}` |
| `deleteSettingsTreatmentTemplates` (직접) | `DELETE emrClient /settings/treatment-templates/{input}` |
| `getDocumentsPhrases` (직접) | `GET emrClient /documents/phrases` |
| `getSettingsTreatmentTemplates` (직접) | `GET emrClient /settings/treatment-templates` |
| `patchDocumentsPhrases` (직접) | `PATCH emrClient /documents/phrases/{id}` |
| `patchSettingsTreatmentTemplates` (직접) | `PATCH emrClient /settings/treatment-templates/{id}` |
| `postDocumentsPhrases` (직접) | `POST emrClient /documents/phrases` |
| `postSettingsTreatmentTemplates` (직접) | `POST emrClient /settings/treatment-templates` |

</details>

<a id="route-setting-caller-numbers"></a>

### `/setting/caller-numbers` · setting-caller-numbers

- 화면: [CrmSettingCallerNumbers](../restored/components/crm/CrmSettingCallerNumbers.vue) · 부모 라우트 `setting`
- meta: 권한 `발신번호설정`
- 컴포넌트: 전용 7 · 공유 17 · API: 화면 7 · 전체 도달 19
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseCloseButton ↗
- BaseFeaturedIcon ↗
- BaseTextInput ↗
- BaseTextInputPlainModule ↗
- [CallerNumberAddModal](component-api.md#c-components-caller-callernumberaddmodal) ↗
- [CrmKakaoChannelsAddModal](component-api.md#c-components-crm-crmkakaochannelsaddmodal) ↗
- **CrmSettingCallerNumbersTable**
  - AgGridTable ↗
  - **CrmSettingCallerNumbersTableCellAction**
    - [CrmCommonCallerNumbersAddModal](component-api.md#c-components-crm-crmcommoncallernumbersaddmodal) ↗
  - **CrmSettingCallerNumbersTableCellCallerNumber**
    - BaseBadge ↗
  - **CrmSettingCallerNumbersTableCellNote**
  - **CrmSettingCallerNumbersTableCellRemove**
    - BaseConfirmDialog ↗
  - **CrmSettingCallerNumbersTableCellStatus**
    - BaseDot ↗
  - SenderTypeCell ↗
  - StatusHeaderWithHelp ↗
- OverlayScrollbar ↗
- SenderRegisterDropdown ↗

</details>

<details>
<summary>훅 → API (7)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteMessagesCallerNumbersMutation` | `DELETE crmClient /messages/caller-numbers/{id}` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesCallerNumbersQuery` | `GET crmClient /messages/caller-numbers` |
| `usePatchKakaoChannelsDefaultByIdMutation` | `PATCH crmClient /kakao/channels/{args.id}/default` |
| `usePatchMessagesCallerNumbersMutation` | `PATCH crmClient /messages/caller-numbers/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

</details>

<a id="route-setting-consult-templates"></a>

### `/setting/consult-templates` · setting-consult-templates

- 화면: [CrmSettingConsultTemplates](../restored/components/crm/CrmSettingConsultTemplates.vue) · 부모 라우트 `setting`
- meta: 권한 `연락목록`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 7

<details>
<summary>컴포넌트 트리</summary>

- [CrmConsultTemplatesManager](component-api.md#c-components-crm-crmconsulttemplatesmanager) ↗

</details>

<a id="route-setting-message-templates"></a>

### `/setting/message-templates` · setting-message-templates

- 화면: [CrmSettingMessageTemplates](../restored/components/crm/CrmSettingMessageTemplates.vue) · 부모 라우트 `setting`
- meta: 권한 `메시지템플릿관리`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 36

<details>
<summary>컴포넌트 트리</summary>

- [CrmMessageTemplatesManager](component-api.md#c-components-crm-crmmessagetemplatesmanager) ↗

</details>

<a id="route-setting-contents"></a>

### `/setting/contents` · setting-contents

- 화면: [CrmSettingContents](../restored/components/crm/CrmSettingContents.vue) · 부모 라우트 `setting`
- meta: 권한 `일반문자`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 9

<details>
<summary>컴포넌트 트리</summary>

- CrmContentManagerPane ↗

</details>

<a id="route-setting-account-permission"></a>

### `/setting/account-permission` · setting-account-permission

- 화면: [AccountPermissionsView](../restored/views/AccountPermissionsView.vue) · 부모 라우트 `setting`
- meta: 권한 `계정권한설정`
- 컴포넌트: 전용 8 · 공유 17 · API: 화면 11 · 전체 도달 19
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- [AccountCreateModal](component-api.md#c-components-account-accountcreatemodal) ↗
- [AccountDeactivateModal](component-api.md#c-components-account-accountdeactivatemodal) ↗
- [AccountEditAccountInfoModal](component-api.md#c-components-account-accounteditaccountinfomodal) ↗
- AccountEditEmploymentInfoModal ↗
- AccountEditPasswordModal ↗
- [AccountPermissionSetModal](component-api.md#c-components-account-accountpermissionsetmodal) ↗
- **AccountPermissionsHeader**
  - BaseButton ↗
- **AccountPermissionsListSection**
  - **AccountPermissionsListControls**
    - BaseSelectBox ↗
    - BaseTextInput ↗
    - BaseTextInputButtonModule ↗
  - **AccountPermissionsTable**
- **AccountPermissionsSidebar**
  - **AccountPermissionsListDetail**
    - AccountAccessPermissionSection ↗
    - BaseBadge ↗
    - BaseConfirmDialog ↗
  - BaseCloseButton ↗
  - ProfileAvatarPlaceholder ↗
- BaseConfirmDialog ↗

</details>

<details>
<summary>훅 → API (11)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteUsersMutation` | `DELETE accountClient /users/{input}` |
| `usePatchUsersDeactivateMutation` | `PATCH accountClient /users/{userId}/deactivate` |
| `usePatchUsersMutation` | `PATCH accountClient /users/{userId}` |
| `usePermissionsQuery` | `GET accountClient /permissions` |
| `usePostUsersPasswordMutation` | `POST accountClient /users/{userId}/password` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useUsersQuery` | `GET accountClient /users` |
| `deleteUsersStamp` (직접) | `DELETE accountClient /users/{id}/stamp` |
| `getSettingsDoctors` (직접) | `GET emrClient /settings/doctors` |
| `postUsersStamp` (직접) | `POST accountClient /users/{userId}/stamp` |

</details>

<a id="route-setting-account-history"></a>

### `/setting/account-history` · setting-account-history

- 화면: [AccountHistoryView](../restored/views/AccountHistoryView.vue) · 부모 라우트 `setting`
- 컴포넌트: 전용 5 · 공유 2 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- **AccountHistoryTableLoginLog**
  - **AccountHistoryTableRow**
    - ProfileAvatarPlaceholder ↗
- **AccountHistoryTablePermissionAssignment**
- **AccountHistoryTablePersonalAccess**
- BaseTabBar ↗

</details>

<a id="route-setting-tablet"></a>

### `/setting/tablet` · setting-tablet

- 화면: [SettingTabletView](../restored/views/SettingTabletView.vue) · 부모 라우트 `setting`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 0 · 전체 도달 18

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- [TabletAccountView](component-api.md#c-views-tabletaccountview) ↗
- TabletReceptionSettingView ↗

</details>

<a id="route-setting-document-management"></a>

### `/setting/document-management` · setting-document-management

- 화면: [SettingDocumentManagementView](../restored/views/SettingDocumentManagementView.vue) · 부모 라우트 `setting`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 0 · 전체 도달 18

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- [SettingTabletConsent](component-api.md#c-components-setting-settingtabletconsent) ↗
- [SettingTabletQuestionnaire](component-api.md#c-components-setting-settingtabletquestionnaire) ↗

</details>

<a id="route-setting-schedule"></a>

### `/setting/schedule` · setting-schedule

- 화면: [ScheduleView](../restored/views/ScheduleView.vue) · 부모 라우트 `setting`
- meta: 권한 `진료스케줄설정`
- 컴포넌트: 전용 7 · 공유 13 · API: 화면 8 · 전체 도달 8
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- **ScheduleViewCalendarWrapper**
  - **ScheduleViewCalendar**
    - BaseBadge ↗
    - BasePopover ↗
    - **ScheduleViewCalendarScheduleSettingModal**
      - BaseButton ↗
      - BaseCheckBox ↗
      - BaseSelectableButton ↗
      - InputTimePicker ↗
  - **ScheduleViewCalendarController**
    - BaseSelectBox ↗
- **ScheduleViewController**

</details>

<details>
<summary>훅 → API (8)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsClinicSchedulesMutation` | `PATCH emrClient /settings/clinic-schedules/{id}` |
| `usePatchSettingsDoctorSchedulesDoctorMutation` | `PATCH emrClient /settings/doctor-schedules/doctor/{id}` |
| `useSettingsClinicCalendarYearQuery_2` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsClinicSchedulesQuery` | `GET emrClient /settings/clinic-schedules` |
| `useSettingsDoctorSchedulesQuery` | `GET emrClient /settings/doctor-schedules` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

</details>

<a id="route-setting-billing"></a>

### `/setting/billing` · setting-billing

- 화면: [CrmBillingView](../restored/views/CrmBillingView.vue) · 부모 라우트 `setting`
- meta: 권한 `결제메뉴접근` · `supportsMobile`
- 컴포넌트: 전용 1 · 공유 8 · API: 화면 1 · 전체 도달 15

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BillingCombinedPayBanner ↗
- BillingInvoiceList ↗
- [BillingInvoiceSidePanel](component-api.md#c-components-billing-billinginvoicesidepanel) ↗
- [BillingPaymentMethod](component-api.md#c-components-billing-billingpaymentmethod) ↗
- [BillingPaySidePanel](component-api.md#c-components-billing-billingpaysidepanel) ↗
- LoadingBoxWithSpinner ↗
- OverlayScrollbar ↗

</details>

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingInvoicesParamQuery` | `GET crmClient /billing/invoices{n ? '?${n}' : ""}` |
| `useBillingInvoicesParamQuery_2` | `GET crmClient /billing/invoices{n ? '?${n}' : ""}` |

</details>

<a id="route-setting-appointment"></a>

### `/setting/appointment` · setting-appointment

- 화면: [SettingAppointment](../restored/components/setting/SettingAppointment.vue) · 부모 라우트 `setting`
- meta: 권한 `예약설정`
- 컴포넌트: 전용 4 · 공유 13 · API: 화면 9 · 전체 도달 40
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- [CrmAppointmentNotificationsSetting](component-api.md#c-components-crm-crmappointmentnotificationssetting) ↗
- **SettingAppointmentExternalChannel**
  - BaseBadge ↗
  - BaseButton ↗
  - DoctalkSetupGuide ↗
  - [DoctalkSignupModal](component-api.md#c-components-doctalk-doctalksignupmodal) ↗
  - ExternalChannelBadge ↗
- **SettingAppointmentGeneral**
  - BaseButtonGroup ↗
  - BaseButtonGroupItem ↗
  - BaseTextInput ↗
- **SettingAppointmentTreatmentTime**
  - BaseSelectBox ↗
  - BaseToggleSwitch ↗

</details>

<details>
<summary>훅 → API (9)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useDoctalkSyncStatusQuery` | `POST emrClient /doctalk/sync-status` |
| `usePatchSettingsAppointmentsMutation` | `PATCH emrClient /settings/appointments` |
| `usePatchSettingsMedicalTreatmentsMutation` | `PATCH emrClient /settings/medical-treatments/{id}` |
| `usePostDoctalkSignupMutation` | `POST emrClient /doctalk/signup` |
| `usePostDoctalkSsoTokenMutation` | `POST emrClient /doctalk/sso/token` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsMedicalTreatmentsQuery` | `GET emrClient /settings/medical-treatments` |

</details>

<a id="route-setting-mcp-tokens"></a>

### `/setting/mcp-tokens` · setting-mcp-tokens

- 화면: [MCPTokens](../restored/components/m/MCPTokens.vue) · 부모 라우트 `setting`
- meta: `requiresAuth` · `requiresDemoAccountInPrd`
- 등록 조건: `Yu() \|\| Un()`
- 컴포넌트: 전용 1 · 공유 8 · API: 화면 5 · 전체 도달 5
- 스토어: `useOnboardingGuideSessionStore`, `useToastNotificationStore`

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- BaseCloseButton ↗
- BaseConfirmDialog ↗
- BaseDialogModal ↗
- BaseSidePanel ↗
- LoadingBoxWithSpinner ↗
- SimpleTable ↗

</details>

<details>
<summary>훅 → API (5)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `_hoisted_1` (직접) | `DELETE accountClient /auth/mcp-tokens/{d}` |
| `_hoisted_1` (직접) | `GET accountClient /auth/mcp-tokens` |
| `_hoisted_1` (직접) | `POST accountClient /auth/mcp-tokens` |

</details>

<a id="route-setting-mcp-pending-contacts"></a>

### `/setting/mcp-pending-contacts` · setting-mcp-pending-contacts

- 화면: [McpPendingContacts](../restored/components/mcp/McpPendingContacts.vue) · 부모 라우트 `setting`
- meta: `requiresAuth` · `requiresDemoAccountInPrd`
- 등록 조건: `Yu() \|\| Un()`
- 컴포넌트: 전용 1 · 공유 4 · API: 화면 0 · 전체 도달 16

<details>
<summary>컴포넌트 트리</summary>

- BaseButtonGroup ↗
- BaseButtonGroupItem ↗
- [McpApprovalContactsTab](component-api.md#c-components-mcp-mcpapprovalcontactstab) ↗
- [McpApprovalNotesTab](component-api.md#c-components-mcp-mcpapprovalnotestab) ↗

</details>

<a id="route-setting-expense-collection"></a>

### `/setting/expense-collection` · setting-expense-collection

- 화면: [SettingExpenseCollectionView](../restored/views/SettingExpenseCollectionView.vue) · 부모 라우트 `setting`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-remote-settlement"></a>

### `/remote-settlement` · remote-settlement

- 화면: [RemoteSettlementView](../restored/views/RemoteSettlementView.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 6 · 공유 4 · API: 화면 2 · 전체 도달 2

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗
- **RemoteSettlementContent**
  - **RemoteSettlementCostSummary**
  - **RemoteSettlementDataHandler**
    - BaseButton ↗
  - **RemoteSettlementInfoContent**
  - **RemoteSettlementTableContent**
    - AgGridTable ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettlementUpstreamSettlementsQuery` | `GET thesooClient /settlement/upstream/settlements` |

</details>

<a id="route--help"></a>

### `/help` · 

- 화면: [HelpView](../restored/modules/HelpView.js)
- meta: `requiresAuth`
- 컴포넌트: 전용 0 · 공유 0 · API: 화면 0 · 전체 도달 0

<a id="route-analytics"></a>

### `/analytics` · analytics

- 화면: [AnalyticsView](../restored/views/AnalyticsView.vue)
- meta: 권한 `경영지표` · `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 2 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗

</details>

<a id="route-analytics-revenue"></a>

### `/analytics/revenue` · analytics-revenue

- 화면: [RevenueTableView](../restored/views/RevenueTableView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/RevenueTableContainer`
- meta: 권한 `경영지표`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗

</details>

<a id="route-analytics-appointment"></a>

### `/analytics/appointment` · analytics-appointment

- 화면: [AppointmentTableView](../restored/views/AppointmentTableView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/AppointmentTableContainer`
- meta: 권한 `경영지표`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗

</details>

<a id="route-analytics-patient"></a>

### `/analytics/patient` · analytics-patient

- 화면: [PatientTableView](../restored/views/PatientTableView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/PatientTableContainer`
- meta: 권한 `경영지표`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗

</details>

<a id="route-analytics-soo-dashboard"></a>

### `/analytics/soo-dashboard` · analytics-soo-dashboard

- 화면: [SooDashboardView](../restored/views/SooDashboardView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/SooDashboardContainer`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗

</details>

<a id="route-analytics-incoming-path"></a>

### `/analytics/incoming-path` · analytics-incoming-path

- 화면: [IncomingPathTableView](../restored/views/IncomingPathTableView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/IncomingPathTableContainer`
- meta: 권한 `경영지표`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 0 · 전체 도달 292

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗
- SidePanelDeskActionsMessageSend ↗
- SidePanelDeskActionsPatientInfoDetail ↗

</details>

<a id="route-analytics-doctor"></a>

### `/analytics/doctor` · analytics-doctor

- 화면: [DoctorTableView](../restored/views/DoctorTableView.vue) · 부모 라우트 `analytics`
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/DoctorTableContainer`
- meta: 권한 `경영지표`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- BiContainer ↗

</details>

<a id="route-finance"></a>

### `/finance` · finance

- 화면: [FinanceView](../restored/views/FinanceView.vue)
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 2 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- AccessDeniedNotice ↗
- LoadingBoxWithSpinner ↗

</details>

<a id="route-finance-daily-briefing"></a>

### `/finance/daily-briefing` · finance-daily-briefing

- 화면: [DailyBriefingView](../restored/views/DailyBriefingView.vue) · 부모 라우트 `finance`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-finance-expenses"></a>

### `/finance/expenses` · finance-expenses

- 화면: [ExpensesView](../restored/views/ExpensesView.vue) · 부모 라우트 `finance`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-finance-pnl"></a>

### `/finance/pnl` · finance-pnl

- 화면: [PnlView](../restored/views/PnlView.vue) · 부모 라우트 `finance`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-finance-budget"></a>

### `/finance/budget` · finance-budget

- 화면: [BudgetView](../restored/views/BudgetView.vue) · 부모 라우트 `finance`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-finance-cashflow"></a>

### `/finance/cashflow` · finance-cashflow

- 화면: [CashflowView](../restored/views/CashflowView.vue) · 부모 라우트 `finance`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- FinanceContainer ↗

</details>

<a id="route-challenge"></a>

### `/challenge` · challenge

- 화면: [ChallengeView](../restored/views/ChallengeView.vue)
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-bi-frontend/SooRisingContainer`
- meta: `requiresAuth` · `usesGlobalLayout`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 2 · 전체 도달 5

<details>
<summary>컴포넌트 트리</summary>

- BaseTabBar ↗
- BiContainer ↗
- [SooRisingMaterialsPane](component-api.md#c-components-soo-soorisingmaterialspane) ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |

</details>

<a id="route-portal"></a>

### `/portal` · portal

- 화면: [SooView](../restored/views/SooView.vue)
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-emr-portal/SooPortalContainer`
- meta: `requiresAuth` · `usesGlobalLayout` · `supportsMobile`
- 컴포넌트: 전용 1 · 공유 1 · API: 화면 0 · 전체 도달 0

<details>
<summary>컴포넌트 트리</summary>

- PortalContainer ↗

</details>

<a id="route-library-window"></a>

### `/library` · library-window

- 화면: [LibraryWindowView](../restored/views/LibraryWindowView.vue)
- 원격 모듈 (federation, 이 번들에 코드 없음): `upstream-emr-portal/SooPortalContainer`
- meta: `requiresAuth`
- 컴포넌트: 전용 1 · 공유 2 · API: 화면 0 · 전체 도달 1

<details>
<summary>컴포넌트 트리</summary>

- [AvatarLabelGroup](component-api.md#c-components-avatar-avatarlabelgroup) ↗
- PortalContainer ↗

</details>

<a id="route-members"></a>

### `/members/:pathMatch(.*)*` · members

- 화면: [MembersView](../restored/views/MembersView.vue)
- meta: `requiresAuth` · `usesGlobalLayout` · `supportsMobile`
- 컴포넌트: 전용 1 · 공유 3 · API: 화면 2 · 전체 도달 296

<details>
<summary>컴포넌트 트리</summary>

- BaseButton ↗
- IncomingPathTableView ↗
- [MembersRetroTermsGate](component-api.md#c-components-members-membersretrotermsgate) ↗

</details>

<details>
<summary>훅 → API (2)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Ee` (직접) | `GET accountClient /integrations/members/subscribers` |
| `postTokenRefresh` (직접) | `POST authClient /token/refresh` |

</details>

## 스토어

스토어 정의에서 닿는 API입니다. 다른 스토어는 이름만 적었습니다.

### `useAccountApplicationsAuthStore`

- 파일: [stores/accountApplicationsAuth.js](../restored/stores/accountApplicationsAuth.js)

_API 호출 없음_

### `useAiAgentStore`

- 파일: [stores/aiAgent.js](../restored/stores/aiAgent.js)

_API 호출 없음_

### `useClaimWarningOffStore`

- 파일: [stores/claimWarningOff.js](../restored/stores/claimWarningOff.js)

_API 호출 없음_

### `useClaimWarningStore`

- 파일: [stores/claimWarning.js](../restored/stores/claimWarning.js)

_API 호출 없음_

### `useCrmMessageResultLinksStore`

- 파일: [stores/crmMessageResultLinks.js](../restored/stores/crmMessageResultLinks.js)

_API 호출 없음_

### `useDeskDateStore`

- 파일: [stores/deskDate.js](../restored/stores/deskDate.js)

_API 호출 없음_

### `useDocumentIssueStore`

- 파일: [stores/documentIssue.js](../restored/stores/documentIssue.js)

_API 호출 없음_

### `useHiraSubmissionStore`

- 파일: [stores/hiraSubmission.js](../restored/stores/hiraSubmission.js)

_API 호출 없음_

### `useInquiryBotStore`

- 파일: [stores/inquiryBot.js](../restored/stores/inquiryBot.js)

<details>
<summary>훅 → API (6)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getApiBotStreamUrl` (직접) | `GET webClient /api/bot-stream-url` |
| `postApiBotFeedback` (직접) | `POST webClient /api/bot-feedback` |
| `postApiChanneltalkBetaChat` (직접) | `POST webClient /api/channeltalk/beta-chat` |
| `postApiChanneltalkBetaConsent` (직접) | `POST webClient /api/channeltalk/beta-consent` |
| `postApiChanneltalkBetaHandoffClick` (직접) | `POST webClient /api/channeltalk/beta-handoff-click` |
| `postApiChanneltalkBetaUpload` (직접) | `POST webClient /api/channeltalk/beta-upload` |

</details>

### `useIntakeLinkPromptStore`

- 파일: [stores/intakeLinkPrompt.js](../restored/stores/intakeLinkPrompt.js)

_API 호출 없음_

### `useMedicalAidsStore`

- 파일: [stores/medicalAids.js](../restored/stores/medicalAids.js)

_API 호출 없음_

### `useMembersSignUpStore`

- 파일: [stores/membersSignUp.js](../restored/stores/membersSignUp.js)

_API 호출 없음_

### `useOnboardingGuideSessionStore`

- 파일: [stores/onboardingGuideSession.js](../restored/stores/onboardingGuideSession.js)

_API 호출 없음_

### `useOndangSignUpStore`

- 파일: [stores/ondangSignUp.js](../restored/stores/ondangSignUp.js)

_API 호출 없음_

### `usePatientStore`

- 파일: [stores/patient.js](../restored/stores/patient.js)

_API 호출 없음_

### `useRepeatedTreatmentStore`

- 파일: [stores/repeatedTreatment.js](../restored/stores/repeatedTreatment.js)

_API 호출 없음_

### `useSettingChubyakPrescriptionStore`

- 파일: [stores/settingChubyakPrescription.js](../restored/stores/settingChubyakPrescription.js)

_API 호출 없음_

### `useSettingHerbStore`

- 파일: [stores/settingHerb.js](../restored/stores/settingHerb.js)

_API 호출 없음_

### `useSocketClientStore`

- 파일: [stores/socketClient.js](../restored/stores/socketClient.js)

<details>
<summary>훅 → API (1)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postTokenRefresh` (직접) | `POST authClient /token/refresh` |

</details>

### `useSooSignUpStore`

- 파일: [stores/sooSignUp.js](../restored/stores/sooSignUp.js)

_API 호출 없음_

### `useToastNotificationStore`

- 파일: [stores/toastNotification.js](../restored/stores/toastNotification.js)

_API 호출 없음_

### `useTreatmentStore`

- 파일: [stores/treatment.js](../restored/stores/treatment.js) · 참조 스토어 `useClaimWarningStore`

<details>
<summary>훅 → API (17)</summary>

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useRareDiseases20241018JsonQuery` | `GET staticClient <RARE_DISEASES_20241018_JSON_PATH>` |
| `useRecordHomeVisitCountsQuery` | `GET emrClient /record/home-visit/counts` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useRecordTelemedicinePilotCountsQuery` | `GET emrClient /record/telemedicine-pilot/counts` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

</details>

### `useTreatmentWindowStore`

- 파일: [stores/treatmentWindow.js](../restored/stores/treatmentWindow.js)

_API 호출 없음_

### `useWindowStore`

- 파일: [stores/window.js](../restored/stores/window.js) · 참조 스토어 `usePatientStore`

_API 호출 없음_

## 클라이언트 인터셉터

클라이언트 모듈의 최상위 문장(인터셉터 등)에서 호출하는 API입니다. 모든 요청에 걸리므로 화면 목록에서는 뺐습니다.

- [api/MembersView/client.js](../restored/api/MembersView/client.js): `POST authClient /token/refresh`
- [api/clients/index.js](../restored/api/clients/index.js): API 호출 없음
- [api/clients/portalClient.js](../restored/api/clients/portalClient.js): API 호출 없음
- [api/clients/webClient.js](../restored/api/clients/webClient.js): `POST authClient /token/refresh`

## 참조되지 않는 호출

어떤 컴포넌트·스토어·셸에서도 닿지 않는 API 함수입니다. 번들에 남은 미사용 코드로 보입니다.

| 함수 | 엔드포인트 |
|---|---|
| [postChangeRequestsDocuments](../restored/api/users/requests.js) | `POST accountClient {mI}/documents` |
| [postChangeRequests](../restored/api/users/requests.js) | `POST accountClient <mI>` |
| [getChangeRequests](../restored/api/users/requests.js) | `GET accountClient <mI>` |
