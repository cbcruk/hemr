# 컴포넌트별 API

각 컴포넌트가 **직접** 쓰는 훅과 API입니다. 다른 컴포넌트·스토어 안으로는 들어가지 않으므로, 화면 전체가 쓰는 API는 [architecture.md](architecture.md)의 트리를 따라 합치면 됩니다. 재생성: `pnpm architecture`

- API를 호출하는 컴포넌트 771개 / 전체 1839개

- [components/account](#components-account) (18)
- [components/agGrid](#components-aggrid) (2)
- [components/agreements](#components-agreements) (3)
- [components/ai](#components-ai) (3)
- [components/app](#components-app) (1)
- [components/appointment](#components-appointment) (11)
- [components/avatar](#components-avatar) (1)
- [components/base](#components-base) (3)
- [components/billing](#components-billing) (4)
- [components/body](#components-body) (2)
- [components/caller](#components-caller) (1)
- [components/canvas](#components-canvas) (3)
- [components/car](#components-car) (6)
- [components/chart](#components-chart) (2)
- [components/chubyak](#components-chubyak) (8)
- [components/claim](#components-claim) (21)
- [components/copayment](#components-copayment) (3)
- [components/crm](#components-crm) (108)
- [components/customs](#components-customs) (1)
- [components/desk](#components-desk) (33)
- [components/disease](#components-disease) (2)
- [components/booking](#components-booking) (2)
- [components/doctors](#components-doctors) (2)
- [components/document](#components-document) (22)
- [components/editor](#components-editor) (1)
- [components/emr](#components-emr) (2)
- [components/etc](#components-etc) (1)
- [components/future](#components-future) (1)
- [components/general](#components-general) (5)
- [components/header](#components-header) (1)
- [components/health](#components-health) (3)
- [components/herb](#components-herb) (2)
- [components/herbal](#components-herbal) (2)
- [components/hira](#components-hira) (10)
- [components/history](#components-history) (1)
- [components/holiday](#components-holiday) (1)
- [components/hospital](#components-hospital) (1)
- [components/injury](#components-injury) (1)
- [components/inquiry](#components-inquiry) (2)
- [components/insurance](#components-insurance) (7)
- [components/intake](#components-intake) (1)
- [components/kakao](#components-kakao) (2)
- [components/link](#components-link) (1)
- [components/lookup](#components-lookup) (1)
- [components/m](#components-m) (1)
- [components/mcp](#components-mcp) (3)
- [components/medical](#components-medical) (9)
- [components/medication](#components-medication) (1)
- [components/members](#components-members) (1)
- [components/message](#components-message) (22)
- [components/mobile](#components-mobile) (1)
- [components/moxa](#components-moxa) (1)
- [components/naver](#components-naver) (4)
- [components/nonBenefit](#components-nonbenefit) (9)
- [components/normal](#components-normal) (1)
- [components/notification](#components-notification) (1)
- [components/ocs](#components-ocs) (13)
- [components/ocsV2](#components-ocsv2) (11)
- [components/onboarding](#components-onboarding) (1)
- [components/ondang](#components-ondang) (3)
- [components/outpatient](#components-outpatient) (1)
- [components/package](#components-package) (1)
- [components/password](#components-password) (1)
- [components/patient](#components-patient) (55)
- [components/payment](#components-payment) (3)
- [components/personal](#components-personal) (1)
- [components/planner](#components-planner) (3)
- [components/prescription](#components-prescription) (4)
- [components/preset](#components-preset) (1)
- [components/procedures](#components-procedures) (13)
- [components/qr](#components-qr) (1)
- [components/questionnaire](#components-questionnaire) (2)
- [components/receipt](#components-receipt) (1)
- [components/register](#components-register) (1)
- [components/remote](#components-remote) (1)
- [components/reserved](#components-reserved) (9)
- [components/result](#components-result) (1)
- [components/schedule](#components-schedule) (5)
- [components/search](#components-search) (1)
- [components/send](#components-send) (1)
- [components/service](#components-service) (2)
- [components/setting](#components-setting) (86)
- [components/side](#components-side) (3)
- [components/sidebar](#components-sidebar) (2)
- [components/signature](#components-signature) (2)
- [components/lite](#components-lite) (3)
- [components/tablet](#components-tablet) (5)
- [components/tangjeon](#components-tangjeon) (23)
- [components/telemedicine](#components-telemedicine) (3)
- [components/temporary](#components-temporary) (1)
- [components/today](#components-today) (1)
- [components/treatment](#components-treatment) (85)
- [components/unified](#components-unified) (1)
- [components/unscheduled](#components-unscheduled) (1)
- [components/waiting](#components-waiting) (1)
- [components/work](#components-work) (1)
- [components/year](#components-year) (7)
- [views](#views) (48)

<a id="components-account"></a>

## components/account

<a id="c-components-account-accountapplicationsauth"></a>

### AccountApplicationsAuth

- `restored/components/account/AccountApplicationsAuth.vue` · 스토어 `useAccountApplicationsAuthStore`, `useMembersSignUpStore`, `useLiteSignUpStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostAccountApplicationTokenMutation` | `POST accountApplicationClient /account-application/token` |
| `getAuthCheckSsoid` (직접) | `GET accountApplicationClient /auth/check-ssoid` |
| `getIntegrationsOnboardingLiteProfile` (직접) | `GET accountApplicationClient /integrations/onboarding/lite/profile` |
| `getIntegrationsLite` (직접) | `GET accountApplicationClient /integrations/lite` |
| `getIntegrationsMembers` (직접) | `GET accountApplicationClient <INTEGRATIONS_MEMBERS_PATH>` |
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postSsoPartnerToken` (직접) | `POST authClient /sso/partner/token` |

<a id="c-components-account-accountapplicationsform"></a>

### AccountApplicationsForm

- `restored/components/account/AccountApplicationsForm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostAccountApplicationApplicationsMutation` | `POST accountApplicationClient /account-application/applications` |
| `usePutAccountApplicationApplicationsMutation` | `PUT accountApplicationClient /account-application/applications` |

<a id="c-components-account-accountapplicationsformaccountinfo"></a>

### AccountApplicationsFormAccountInfo

- `restored/components/account/AccountApplicationsFormAccountInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |

<a id="c-components-account-accountapplicationsformhospitalinfo"></a>

### AccountApplicationsFormHospitalInfo

- `restored/components/account/AccountApplicationsFormHospitalInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostAccountApplicationImagesMutation` | `POST accountApplicationClient /account-application/images` |

<a id="c-components-account-accountapplicationsformtermsagreement"></a>

### AccountApplicationsFormTermsAgreement

- `restored/components/account/AccountApplicationsFormTermsAgreement.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsQuery` | `GET accountApplicationClient /terms` |

<a id="c-components-account-accountapplicationsrejected"></a>

### AccountApplicationsRejected

- `restored/components/account/AccountApplicationsRejected.vue` · 스토어 `useAccountApplicationsAuthStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchAccountApplicationApplicationsQuery` | `GET accountApplicationClient /account-application/applications`<br>`GET biClient /api/surachal/cohort`<br>`GET biClient /api/surachal/me`<br>`GET emrClient /auth/me`<br>`PUT accountApplicationClient /account-application/applications/cancel` |
| `usePostAccountApplicationImagesMutation` | `POST accountApplicationClient /account-application/images` |
| `usePutAccountApplicationApplicationsCancelMutation` | `PUT accountApplicationClient /account-application/applications/cancel` |
| `usePutAccountApplicationApplicationsSupplementMutation` | `PUT accountApplicationClient /account-application/applications/supplement` |

<a id="c-components-account-accountapplicationsrequested"></a>

### AccountApplicationsRequested

- `restored/components/account/AccountApplicationsRequested.vue` · 스토어 `useAccountApplicationsAuthStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchAccountApplicationApplicationsQuery` | `GET accountApplicationClient /account-application/applications`<br>`GET biClient /api/surachal/cohort`<br>`GET biClient /api/surachal/me`<br>`GET emrClient /auth/me`<br>`PUT accountApplicationClient /account-application/applications/cancel` |
| `useAccountApplicationBusinessLicenseQuery` | `GET accountApplicationClient /account-application/business-license` |
| `usePutAccountApplicationApplicationsCancelMutation` | `PUT accountApplicationClient /account-application/applications/cancel` |

<a id="c-components-account-accountapplicationsstepselectchart"></a>

### AccountApplicationsStepSelectChart

- `restored/components/account/AccountApplicationsStepSelectChart.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthCheckSsoidQuery` | `GET accountApplicationClient /auth/check-ssoid` |

<a id="c-components-account-accountapplicationwaiting"></a>

### AccountApplicationWaiting

- `restored/components/account/AccountApplicationWaiting.vue` · 스토어 `useAccountApplicationsAuthStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchAccountApplicationApplicationsQuery` | `GET accountApplicationClient /account-application/applications`<br>`GET biClient /api/surachal/cohort`<br>`GET biClient /api/surachal/me`<br>`GET emrClient /auth/me`<br>`PUT accountApplicationClient /account-application/applications/cancel` |
| `usePutAccountApplicationApplicationsCancelMutation` | `PUT accountApplicationClient /account-application/applications/cancel` |

<a id="c-components-account-accountcreatemodal"></a>

### AccountCreateModal

- `restored/components/account/AccountCreateModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostUsersMutation` | `POST accountClient /users` |
| `patchUsers` (직접) | `PATCH accountClient /users/{userId}` |
| `postAuthCheckUsername` (직접) | `POST accountClient /auth/check-username` |
| `postImages` (직접) | `POST accountClient /images` |

<a id="c-components-account-accountdeactivatemodal"></a>

### AccountDeactivateModal

- `restored/components/account/AccountDeactivateModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchUsersDeactivateMutation` | `PATCH accountClient /users/{userId}/deactivate` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-account-accounteditaccountinfomodal"></a>

### AccountEditAccountInfoModal

- `restored/components/account/AccountEditAccountInfoModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `getChangeRequestsDocument` (직접) | `GET accountClient {mI}/{id}/document` |
| `postImages` (직접) | `POST accountClient /images` |

<a id="c-components-account-accountpermissionsetmodal"></a>

### AccountPermissionSetModal

- `restored/components/account/AccountPermissionSetModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPermissionsMutation` | `PATCH accountClient /permissions` |
| `usePermissionsQuery` | `GET accountClient /permissions` |

<a id="c-components-account-accountpermissionslistdetail"></a>

### AccountPermissionsListDetail

- `restored/components/account/AccountPermissionsListDetail.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchUsersDeactivateMutation` | `PATCH accountClient /users/{userId}/deactivate` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `deleteUsersStamp` (직접) | `DELETE accountClient /users/{id}/stamp` |
| `getSettingsDoctors` (직접) | `GET emrClient /settings/doctors` |
| `postUsersStamp` (직접) | `POST accountClient /users/{userId}/stamp` |

<a id="c-components-account-accountpermissionstable"></a>

### AccountPermissionsTable

- `restored/components/account/AccountPermissionsTable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchUsersDeactivateMutation` | `PATCH accountClient /users/{userId}/deactivate` |

<a id="c-components-account-accountunlockstepphoneverification"></a>

### AccountUnlockStepPhoneVerification

- `restored/components/account/AccountUnlockStepPhoneVerification.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostUnlockConfirmOtpMutation` | `POST authClient /unlock/confirm-otp` |
| `usePostUnlockRequestOtpMutation` | `POST authClient /unlock/request-otp` |

<a id="c-components-account-accountworktyperequiredforclaimmodal"></a>

### AccountWorkTypeRequiredForClaimModal

- `restored/components/account/AccountWorkTypeRequiredForClaimModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchUsersMutation` | `PATCH accountClient /users/{userId}` |

<a id="c-components-account-accountworktyperequiredmodal"></a>

### AccountWorkTypeRequiredModal

- `restored/components/account/AccountWorkTypeRequiredModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchUsersMutation` | `PATCH accountClient /users/{userId}` |

<a id="components-aggrid"></a>

## components/agGrid

<a id="c-components-aggrid-aggridtabledoctorscell"></a>

### AgGridTableDoctorsCell

- `restored/components/agGrid/AgGridTableDoctorsCell.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-aggrid-aggridtablepatientnamecell"></a>

### AgGridTablePatientNameCell

- `restored/components/agGrid/AgGridTablePatientNameCell.vue` · 스토어 `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |

<a id="components-agreements"></a>

## components/agreements

<a id="c-components-agreements-agreementscontent"></a>

### AgreementsContent

- `restored/components/agreements/AgreementsContent.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsAgreementHistoryQuery` | `GET emrClient /patients/{id}/agreement-history` |

<a id="c-components-agreements-agreementscontentemr"></a>

### AgreementsContentEmr

- `restored/components/agreements/AgreementsContentEmr.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-agreements-agreementshistorypopover"></a>

### AgreementsHistoryPopover

- `restored/components/agreements/AgreementsHistoryPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsAgreementHistoryQuery` | `GET emrClient /patients/{id}/agreement-history` |

<a id="components-ai"></a>

## components/ai

<a id="c-components-ai-aiagent"></a>

### AiAgent

- `restored/components/ai/AiAgent.vue` · 스토어 `useAiAgentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-ai-aiagentmessages"></a>

### AiAgentMessages

- `restored/components/ai/AiAgentMessages.vue` · 스토어 `useSocketClientStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartRecordLlmGroupQuery` | `GET emrClient /chart/record-llm/group/{id}` |
| `useChartRecordLlmRecordQuery` | `GET emrClient /chart/record-llm/record/{rid}` |
| `usePostChartRecordLlmMutation` | `POST emrClient /chart/record-llm` |

<a id="c-components-ai-aiagentpanel"></a>

### AiAgentPanel

- `restored/components/ai/AiAgentPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchChartRecordLlmMutation` | `PATCH emrClient /chart/record-llm/{id}` |

<a id="components-app"></a>

## components/app

<a id="c-components-app-app"></a>

### App

- `restored/components/app/App.vue` · 스토어 `usePatientStore`, `useSocketClientStore`, `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostSettingsDevicesMutation` | `POST emrClient <SETTINGS_DEVICES_PATH>` |
| `useSettingsNotificationsQuery` | `GET emrClient <SETTINGS_NOTIFICATIONS_PATH>` |
| `useTreatmentsSnapshotQuery` | `GET emrClient /treatments/snapshot` |
| `useUsersQuery` | `GET accountClient /users` |
| `getSettingsHospitals` (직접) | `GET emrClient /settings/hospitals` |
| `getDeskWaiting` (직접) | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |

<a id="components-appointment"></a>

## components/appointment

<a id="c-components-appointment-appointmentcard"></a>

### AppointmentCard

- `restored/components/appointment/AppointmentCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-appointment-appointmentcarddroppableareawrapper"></a>

### AppointmentCardDroppableAreaWrapper

- `restored/components/appointment/AppointmentCardDroppableAreaWrapper.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |
| `usePatchDeskBookingRequestsMutation` | `PATCH emrClient /desk/booking-requests/{input}` |

<a id="c-components-appointment-appointmentcolumntime"></a>

### AppointmentColumnTime

- `restored/components/appointment/AppointmentColumnTime.vue` · 스토어 `useIntakeLinkPromptStore`, `usePatientStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteDeskAppointmentsMutation_2` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |

<a id="c-components-appointment-appointmentcolumnunscheduledcard"></a>

### AppointmentColumnUnscheduledCard

- `restored/components/appointment/AppointmentColumnUnscheduledCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation_2` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |

<a id="c-components-appointment-appointmentplannercontent"></a>

### AppointmentPlannerContent

- `restored/components/appointment/AppointmentPlannerContent.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation_2` | `DELETE emrClient /desk/appointments/{input}` |
| `useDeskAppointmentsPlannerQuery` | `GET emrClient /desk/appointments/planner` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |
| `usePatchDeskTelemedicineConsultationsStatusMutation` | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `usePostDeskAppointmentsMutation` | `POST emrClient /desk/appointments` |
| `usePostDeskBookingRequestsConfirmMutation` | `POST emrClient /desk/booking-requests/confirm` |
| `usePostDeskBookingRequestsRejectMutation` | `POST emrClient /desk/booking-requests/reject` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-appointment-appointmentplannerdaily"></a>

### AppointmentPlannerDaily

- `restored/components/appointment/AppointmentPlannerDaily.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |

<a id="c-components-appointment-appointmentplannerheader"></a>

### AppointmentPlannerHeader

- `restored/components/appointment/AppointmentPlannerHeader.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostPatientsDownloadLogsMutation` | `POST emrClient /patients/download-logs` |

<a id="c-components-appointment-appointmentplannerhistory"></a>

### AppointmentPlannerHistory

- `restored/components/appointment/AppointmentPlannerHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsHistoryQuery` | `GET emrClient /desk/appointments/{input}/history` |

<a id="c-components-appointment-appointmentplannersidebar"></a>

### AppointmentPlannerSidebar

- `restored/components/appointment/AppointmentPlannerSidebar.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useBookingSyncStatusQuery` | `POST emrClient /booking/sync-status` |

<a id="c-components-appointment-appointmentplannersidedetail"></a>

### AppointmentPlannerSideDetail

- `restored/components/appointment/AppointmentPlannerSideDetail.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-appointment-appointmentplannerweekly"></a>

### AppointmentPlannerWeekly

- `restored/components/appointment/AppointmentPlannerWeekly.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |

<a id="components-avatar"></a>

## components/avatar

<a id="c-components-avatar-avatarlabelgroup"></a>

### AvatarLabelGroup

- `restored/components/avatar/AvatarLabelGroup.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="components-base"></a>

## components/base

<a id="c-components-base-baseherbproductsearch"></a>

### BaseHerbProductSearch

- `restored/components/base/BaseHerbProductSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getSettingsChubyakPilotsHerbsProducts` (직접) | `GET emrClient /settings/chubyak-pilots/herbs/products` |

<a id="c-components-base-basetiptapeditor"></a>

### BaseTipTapEditor

- `restored/components/base/BaseTipTapEditor.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsTemplatesQuery` | `GET emrClient /settings/templates` |

<a id="c-components-base-basetreatmenteditor"></a>

### BaseTreatmentEditor

- `restored/components/base/BaseTreatmentEditor.vue` · 스토어 `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="components-billing"></a>

## components/billing

<a id="c-components-billing-billinginvoicesidepanel"></a>

### BillingInvoiceSidePanel

- `restored/components/billing/BillingInvoiceSidePanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingInvoicesQuery` | `GET crmClient /billing/invoices/{input}` |
| `useBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |

<a id="c-components-billing-billingpaymentmethod"></a>

### BillingPaymentMethod

- `restored/components/billing/BillingPaymentMethod.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useBillingPaymentMethodsQuery` | `GET crmClient /billing/payment-methods` |

<a id="c-components-billing-billingpaymentmethodmodal"></a>

### BillingPaymentMethodModal

- `restored/components/billing/BillingPaymentMethodModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingPaymentMethodsQuery` | `GET crmClient /billing/payment-methods` |
| `usePutBillingPaymentMethodsDefaultMutation` | `PUT crmClient /billing/payment-methods/default` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-billing-billingpaysidepanel"></a>

### BillingPaySidePanel

- `restored/components/billing/BillingPaySidePanel.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingPaymentMethodsQuery` | `GET crmClient /billing/payment-methods` |
| `usePostBillingInvoicesPaymentsMutation` | `POST crmClient /billing/invoices/payments` |
| `usePutBillingPaymentMethodsDefaultMutation` | `PUT crmClient /billing/payment-methods/default` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-body"></a>

## components/body

<a id="c-components-body-bodyinfoformmodal"></a>

### BodyInfoFormModal

- `restored/components/body/BodyInfoFormModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsTreatmentsVitalsQuery` | `GET emrClient /settings/treatments/vitals` |

<a id="c-components-body-bodyinfopanel"></a>

### BodyInfoPanel

- `restored/components/body/BodyInfoPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskBodyMeasurementsMutation` | `DELETE emrClient /desk/body-measurements/{input}` |
| `useDeskBodyMeasurementsPatientsQuery` | `GET emrClient /desk/body-measurements/patients/{input}` |
| `usePatchDeskBodyMeasurementsMutation` | `PATCH emrClient /desk/body-measurements/{id}` |
| `usePostDeskBodyMeasurementsMutation` | `POST emrClient /desk/body-measurements` |
| `useSettingsTreatmentsVitalsQuery` | `GET emrClient /settings/treatments/vitals` |

<a id="components-caller"></a>

## components/caller

<a id="c-components-caller-callernumberaddmodal"></a>

### CallerNumberAddModal

- `restored/components/caller/CallerNumberAddModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchMessagesCallerNumbersMutation` | `PATCH crmClient /messages/caller-numbers/{id}` |
| `usePostMessagesCallerNumbersMutation` | `POST crmClient /messages/caller-numbers` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-canvas"></a>

## components/canvas

<a id="c-components-canvas-canvastrigger"></a>

### CanvasTrigger

- `restored/components/canvas/CanvasTrigger.vue.js`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsCanvasImagesCountQuery` | `GET emrClient /patients/{id}/canvas/images/count` |

<a id="c-components-canvas-canvasviewpatientimagelist"></a>

### CanvasViewPatientImageList

- `restored/components/canvas/CanvasViewPatientImageList.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeletePatientsCanvasImagesMutation` | `DELETE emrClient /patients/{id}/canvas/images/{iid}` |
| `usePatchPatientsCanvasImagesNameMutation` | `PATCH emrClient /patients/{id}/canvas/images/{iid}/name` |
| `usePatientsCanvasImagesQuery` | `GET emrClient /patients/{id}/canvas/images` |

<a id="c-components-canvas-canvasviewtemplatelist"></a>

### CanvasViewTemplateList

- `restored/components/canvas/CanvasViewTemplateList.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteRecordCanvasTemplatesMutation` | `DELETE emrClient /record/canvas/templates/{id}` |
| `usePatchRecordCanvasTemplatesMutation` | `PATCH emrClient /record/canvas/templates/{id}` |
| `usePostRecordCanvasTemplatesMutation` | `POST emrClient /record/canvas/templates` |
| `useRecordCanvasTemplatesQuery` | `GET emrClient /record/canvas/templates` |

<a id="components-car"></a>

## components/car

<a id="c-components-car-carinsurancechubyakcreatepanel"></a>

### CarInsuranceChubyakCreatePanel

- `restored/components/car/CarInsuranceChubyakCreatePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-car-carinsurancechubyakeditor"></a>

### CarInsuranceChubyakEditor

- `restored/components/car/CarInsuranceChubyakEditor.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-car-carinsurancechubyakreservedrow"></a>

### CarInsuranceChubyakReservedRow

- `restored/components/car/CarInsuranceChubyakReservedRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="c-components-car-carinsurancechubyakrow"></a>

### CarInsuranceChubyakRow

- `restored/components/car/CarInsuranceChubyakRow.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="c-components-car-carinsurancemedicinereservedrow"></a>

### CarInsuranceMedicineReservedRow

- `restored/components/car/CarInsuranceMedicineReservedRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="c-components-car-carinsurancemedicinerow"></a>

### CarInsuranceMedicineRow

- `restored/components/car/CarInsuranceMedicineRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="components-chart"></a>

## components/chart

<a id="c-components-chart-chartconsultationbanner"></a>

### ChartConsultationBanner

- `restored/components/chart/ChartConsultationBanner.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |

<a id="c-components-chart-chartmanualmodal"></a>

### ChartManualModal

- `restored/components/chart/ChartManualModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |

<a id="components-chubyak"></a>

## components/chubyak

<a id="c-components-chubyak-chubyakform"></a>

### ChubyakForm

- `restored/components/chubyak/ChubyakForm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsDispensaryRoomsHerbsQuery` | `GET emrClient /settings/dispensary-rooms/{id}/herbs` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getSettingsDispensaryRoomsPrescriptions` (직접) | `GET emrClient /settings/dispensary-rooms/{id}/prescriptions/{pId}` |
| `getSettingsDispensaryRoomsReferencePrescriptions` (직접) | `GET emrClient /settings/dispensary-rooms/{id}/reference-prescriptions/{pId}` |

<a id="c-components-chubyak-chubyakformherbeditsidepanel"></a>

### ChubyakFormHerbEditSidePanel

- `restored/components/chubyak/ChubyakFormHerbEditSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `getSettingsDispensaryRoomsHerbs` (직접) | `GET emrClient /settings/dispensary-rooms/{id}/herbs` |

<a id="c-components-chubyak-chubyakhistory"></a>

### ChubyakHistory

- `restored/components/chubyak/ChubyakHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsChubyakRecordsQuery` | `GET emrClient /patients/{pid}/chubyak-records/{rid}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsChubyakRecordsQuery` | `GET emrClient /patients/{pid}/chubyak-records` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-chubyak-chubyakjaboformeffects"></a>

### ChubyakJaboFormEffects

- `restored/components/chubyak/ChubyakJaboFormEffects.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboHerbalEffects20241105JsonQuery` | `GET staticClient <JABO_HERBAL_EFFECTS_20241105_JSON_PATH>` |

<a id="c-components-chubyak-chubyakjaboformherbs"></a>

### ChubyakJaboFormHerbs

- `restored/components/chubyak/ChubyakJaboFormHerbs.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-chubyak-chubyakjaboformsyndromes"></a>

### ChubyakJaboFormSyndromes

- `restored/components/chubyak/ChubyakJaboFormSyndromes.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboSyndromes20241105JsonQuery` | `GET staticClient <JABO_SYNDROMES_20241105_JSON_PATH>` |

<a id="c-components-chubyak-chubyakprescription"></a>

### ChubyakPrescription

- `restored/components/chubyak/ChubyakPrescription.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsChubyakPrescriptionByPidAndRidQuery` | `GET emrClient /documents/patients/{args.pid}/chubyak-prescription/{args.rid}` |

<a id="c-components-chubyak-chubyakprescriptiontreatmentdate"></a>

### ChubyakPrescriptionTreatmentDate

- `restored/components/chubyak/ChubyakPrescriptionTreatmentDate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsChubyakPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/chubyak-prescription` |

<a id="components-claim"></a>

## components/claim

<a id="c-components-claim-claimcuppingedit"></a>

### ClaimCuppingEdit

- `restored/components/claim/ClaimCuppingEdit.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="c-components-claim-claimjarakhistoryeditor"></a>

### ClaimJarakHistoryEditor

- `restored/components/claim/ClaimJarakHistoryEditor.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `getChungguBeforeById` (직접) | `GET emrClient /chunggu/before/{args.id}` |
| `getChungguBeforeOne` (직접) | `GET emrClient /chunggu/before/one` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |
| `getSettingsTreatments` (직접) | `GET emrClient /settings/treatments` |

<a id="c-components-claim-claimjarakhistorytable"></a>

### ClaimJarakHistoryTable

- `restored/components/claim/ClaimJarakHistoryTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-claim-claimjejuentrybutton"></a>

### ClaimJejuEntryButton

- `restored/components/claim/ClaimJejuEntryButton.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-claim-claimjejumodal"></a>

### ClaimJejuModal

- `restored/components/claim/ClaimJejuModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-claim-claimresultlist"></a>

### ClaimResultList

- `restored/components/claim/ClaimResultList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeQuery` | `GET emrClient /chunggu/before` |

<a id="c-components-claim-claimresultmain"></a>

### ClaimResultMain

- `restored/components/claim/ClaimResultMain.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguAfterSupplementaryByIdQuery` | `GET emrClient /chunggu/after/{args.id}/supplementary` |
| `usePostChungguAfterSupplementaryByIdMutation` | `POST emrClient /chunggu/after/{args.params.id}/supplementary` |
| `getChungguBeforeById` (직접) | `GET emrClient /chunggu/before/{args.id}` |
| `getChungguExamresultBy청구Id` (직접) | `GET emrClient /chunggu/examresult/{args.청구Id}` |
| `getChungguSamById` (직접) | `GET emrClient /chunggu/sam/{args.id}` |

<a id="c-components-claim-claimresultviewsummary"></a>

### ClaimResultViewSummary

- `restored/components/claim/ClaimResultViewSummary.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguExamresultPatientsQuery` | `GET emrClient /chunggu/examresult/patients` |

<a id="c-components-claim-claimv2commoneditpanelprototype"></a>

### ClaimV2CommonEditPanelPrototype

- `restored/components/claim/ClaimV2CommonEditPanelPrototype.vue` · 스토어 `useClaimWarningOffStore`, `useClaimWarningStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="c-components-claim-claimv2commoneditpanelprototypemain"></a>

### ClaimV2CommonEditPanelPrototypeMain

- `restored/components/claim/ClaimV2CommonEditPanelPrototypeMain.vue` · 스토어 `useClaimWarningStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useChartTreatmentIndicatorsPatientsQuery` | `GET emrClient /chart/treatment-indicators/patients/{pId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePatchPatientsCarWaitingMutation` | `PATCH emrClient /patients/car-waiting/{id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRareDiseases20241018JsonQuery` | `GET staticClient <RARE_DISEASES_20241018_JSON_PATH>` |
| `useRecordHomeVisitCountsQuery` | `GET emrClient /record/home-visit/counts` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useRecordTelemedicinePilotCountsQuery` | `GET emrClient /record/telemedicine-pilot/counts` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getChungguSamById` (직접) | `GET emrClient /chunggu/sam/{args.id}` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-claim-claimv2commoneditpanelprototypepatientinfo"></a>

### ClaimV2CommonEditPanelPrototypePatientInfo

- `restored/components/claim/ClaimV2CommonEditPanelPrototypePatientInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-claim-claimv2commoneditpanelprototypesummary"></a>

### ClaimV2CommonEditPanelPrototypeSummary

- `restored/components/claim/ClaimV2CommonEditPanelPrototypeSummary.vue` · 스토어 `useClaimWarningStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-claim-claimv2inboxviewcardlist"></a>

### ClaimV2InboxViewCardList

- `restored/components/claim/ClaimV2InboxViewCardList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeQuery` | `GET emrClient /chunggu/before` |
| `getChungguAfter` (직접) | `GET emrClient /chunggu/after` |

<a id="c-components-claim-claimv2inboxviewdangerautofix"></a>

### ClaimV2InboxViewDangerAutoFix

- `restored/components/claim/ClaimV2InboxViewDangerAutoFix.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |
| `getRecord` (직접) | `GET emrClient /record/{input}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="c-components-claim-claimv2inboxviewdangerlist"></a>

### ClaimV2InboxViewDangerList

- `restored/components/claim/ClaimV2InboxViewDangerList.vue` · 스토어 `useClaimWarningOffStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |

<a id="c-components-claim-claimv2inboxviewdangermanualfix"></a>

### ClaimV2InboxViewDangerManualFix

- `restored/components/claim/ClaimV2InboxViewDangerManualFix.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="c-components-claim-claimv2inboxviewfooter"></a>

### ClaimV2InboxViewFooter

- `restored/components/claim/ClaimV2InboxViewFooter.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `usePatchChungguBeforeStatusByIdMutation` | `PATCH emrClient /chunggu/before/{args.id}/status` |
| `usePostChungguSamByIdMutation` | `GET emrClient /chunggu/sam/{args.id}`<br>`POST emrClient /chunggu/sam/{args.id}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `getUsers` (직접) | `GET accountClient /users` |
| `getChungguAfter` (직접) | `GET emrClient /chunggu/after` |
| `getChungguBefore` (직접) | `GET emrClient /chunggu/before` |

<a id="c-components-claim-claimv2inboxviewpostponelist"></a>

### ClaimV2InboxViewPostponeList

- `restored/components/claim/ClaimV2InboxViewPostponeList.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="c-components-claim-claimv2inboxviewsafelist"></a>

### ClaimV2InboxViewSafeList

- `restored/components/claim/ClaimV2InboxViewSafeList.vue` · 스토어 `useClaimWarningOffStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="c-components-claim-claimv2inboxviewsum"></a>

### ClaimV2InboxViewSum

- `restored/components/claim/ClaimV2InboxViewSum.vue` · 스토어 `useClaimWarningOffStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |

<a id="c-components-claim-claimv2inboxviewunpaidlist"></a>

### ClaimV2InboxViewUnpaidList

- `restored/components/claim/ClaimV2InboxViewUnpaidList.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `patchChungguBeforeChungguTreatmentBy청구진료Id` (직접) | `PATCH emrClient /chunggu/before/chunggu-treatment/{params.청구진료Id}` |

<a id="components-copayment"></a>

## components/copayment

<a id="c-components-copayment-copaymentcollectionledger-2"></a>

### CopaymentCollectionLedger

- `restored/components/copayment/CopaymentCollectionLedger-2.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSigningDailyCopaymentLedgersSignableQuery` | `GET emrClient /signing/daily-copayment-ledgers/signable` |

<a id="c-components-copayment-copaymentcollectionledger"></a>

### CopaymentCollectionLedger

- `restored/components/copayment/CopaymentCollectionLedger.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSigningDailyCopaymentLedgersSignedQuery` | `GET emrClient /signing/daily-copayment-ledgers/signed` |

<a id="c-components-copayment-copaymentledger"></a>

### CopaymentLedger

- `restored/components/copayment/CopaymentLedger.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsCopaymentLedgerQuery` | `GET emrClient /documents/copayment-ledger` |
| `postDocumentsCopaymentLedger` (직접) | `POST emrClient /documents/copayment-ledger` |

<a id="components-crm"></a>

## components/crm

<a id="c-components-crm-crmalimtalktemplatesdropdown"></a>

### CrmAlimtalkTemplatesDropdown

- `restored/components/crm/CrmAlimtalkTemplatesDropdown.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET crmClient <d>` |

<a id="c-components-crm-crmappointmentnotificationsalimtalktemplateselect"></a>

### CrmAppointmentNotificationsAlimtalkTemplateSelect

- `restored/components/crm/CrmAppointmentNotificationsAlimtalkTemplateSelect.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesKakaoTemplatesPrivateAlimtalkMutation` | `POST crmClient /messages/kakao-templates/private/alimtalk` |

<a id="c-components-crm-crmappointmentnotificationsform"></a>

### CrmAppointmentNotificationsForm

- `restored/components/crm/CrmAppointmentNotificationsForm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |

<a id="c-components-crm-crmappointmentnotificationssetting"></a>

### CrmAppointmentNotificationsSetting

- `restored/components/crm/CrmAppointmentNotificationsSetting.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `usePutAppointmentNotificationsSettingsMutation` | `PUT crmClient /appointment-notifications/settings` |

<a id="c-components-crm-crmappointmentnotificationssettingmodal"></a>

### CrmAppointmentNotificationsSettingModal

- `restored/components/crm/CrmAppointmentNotificationsSettingModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `usePutAppointmentNotificationsSettingsMutation` | `PUT crmClient /appointment-notifications/settings` |

<a id="c-components-crm-crmappointmentupdatednotificationfooter"></a>

### CrmAppointmentUpdatedNotificationFooter

- `restored/components/crm/CrmAppointmentUpdatedNotificationFooter.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |

<a id="c-components-crm-crmbrandspecdetailmodal"></a>

### CrmBrandSpecDetailModal

- `restored/components/crm/CrmBrandSpecDetailModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |

<a id="c-components-crm-crmcommoncallernumbersaddmodal"></a>

### CrmCommonCallerNumbersAddModal

- `restored/components/crm/CrmCommonCallerNumbersAddModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchMessagesCallerNumbersMutation` | `PATCH crmClient /messages/caller-numbers/{id}` |
| `usePostMessagesCallerNumbersMutation` | `POST crmClient /messages/caller-numbers` |

<a id="c-components-crm-crmcommoncallernumberselect"></a>

### CrmCommonCallerNumberSelect

- `restored/components/crm/CrmCommonCallerNumberSelect.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesCallerNumbersQuery_2` | `GET crmClient /messages/caller-numbers` |

<a id="c-components-crm-crmcommonconvertlink"></a>

### CrmCommonConvertLink

- `restored/components/crm/CrmCommonConvertLink.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesLinksMutation` | `POST crmClient /messages/links` |

<a id="c-components-crm-crmcommondocumentattachment"></a>

### CrmCommonDocumentAttachment

- `restored/components/crm/CrmCommonDocumentAttachment.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postRoot` (직접) | `POST crmClient <input_2>` |

<a id="c-components-crm-crmcommonmessageform"></a>

### CrmCommonMessageForm

- `restored/components/crm/CrmCommonMessageForm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRefusalsCodeQuery` | `GET crmClient /refusals/code` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmcommonmessageimageupload"></a>

### CrmCommonMessageImageUpload

- `restored/components/crm/CrmCommonMessageImageUpload.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postRoot` (직접) | `POST crmClient <input_2>` |

<a id="c-components-crm-crmcommonmessagesend"></a>

### CrmCommonMessageSend

- `restored/components/crm/CrmCommonMessageSend.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesCallerNumbersQuery_2` | `GET crmClient /messages/caller-numbers` |
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |
| `useRefusalsCodeQuery` | `GET crmClient /refusals/code` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmcommonmessagesendtestconfirm"></a>

### CrmCommonMessageSendTestConfirm

- `restored/components/crm/CrmCommonMessageSendTestConfirm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesKakaoAlimtalkTestManualMutation` | `POST crmClient /messages/kakao/alimtalk/test/manual` |
| `usePostMessagesKakaoBrandTestManualMutation` | `POST crmClient /messages/kakao/brand/test/manual` |
| `usePostMessagesSendTestManualMutation` | `POST crmClient /messages/send/test/manual` |
| `usePostMessagesSendTestMutation` | `POST crmClient /messages/send/test` |

<a id="c-components-crm-crmcommonphrases"></a>

### CrmCommonPhrases

- `restored/components/crm/CrmCommonPhrases.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesPhrasesByIdMutation` | `DELETE crmClient /messages/phrases/{args.id}` |
| `useMessagesPhrasesQuery` | `GET crmClient /messages/phrases` |
| `usePatchMessagesPhrasesByIdMutation` | `PATCH crmClient /messages/phrases/{body.id}` |
| `usePostMessagesPhrasesMutation` | `POST crmClient /messages/phrases` |

<a id="c-components-crm-crmcommonstepphoneverification"></a>

### CrmCommonStepPhoneVerification

- `restored/components/crm/CrmCommonStepPhoneVerification.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostVerifyConfirmOtpMutation` | `POST accountClient /verify/confirm-otp` |
| `usePostVerifyRequestOtpMutation` | `POST accountClient /verify/request-otp` |

<a id="c-components-crm-crmconsultscripttemplatepane"></a>

### CrmConsultScriptTemplatePane

- `restored/components/crm/CrmConsultScriptTemplatePane.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useConsultTemplatesGroupsTreeQuery` | `GET crmClient /consult-templates/groups/tree` |
| `useConsultTemplatesTemplatesByPrescriptionsQuery` | `POST crmClient /consult-templates/templates/by-prescriptions` |
| `useCrmTriggerEngineWorklistLogsPrescriptionCumulativeCountQuery` | `GET emrClient /crm/trigger-engine/worklist/logs/{logId}/prescription-cumulative-count` |

<a id="c-components-crm-crmconsulttemplatesmanager"></a>

### CrmConsultTemplatesManager

- `restored/components/crm/CrmConsultTemplatesManager.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useConsultTemplatesGroupsTreeQuery` | `GET crmClient /consult-templates/groups/tree` |
| `useDeleteConsultTemplatesGroupsMutation` | `DELETE crmClient /consult-templates/groups/{id}` |
| `useDeleteConsultTemplatesTemplatesMutation` | `DELETE crmClient /consult-templates/templates/{id}` |
| `usePatchConsultTemplatesGroupsMutation` | `PATCH crmClient /consult-templates/groups/{id}` |
| `usePatchConsultTemplatesTemplatesMutation` | `PATCH crmClient /consult-templates/templates/{id}` |
| `usePostConsultTemplatesGroupsMutation` | `POST crmClient /consult-templates/groups` |
| `usePostConsultTemplatesTemplatesMutation` | `POST crmClient /consult-templates/templates` |

<a id="c-components-crm-crmcontactchannelmessagepreview"></a>

### CrmContactChannelMessagePreview

- `restored/components/crm/CrmContactChannelMessagePreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesPatientsTemplateVariablesByPatientIdQuery` | `GET crmClient /messages/patients/{args.patientId}/template-variables` |
| `useMessagesSendGroupsQuery` | `GET crmClient /messages/send/groups/{id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery_2` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmcontactrulescentralprogramcard"></a>

### CrmContactRulesCentralProgramCard

- `restored/components/crm/CrmContactRulesCentralProgramCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `usePatchCrmTriggerEngineCentralProgramsRulesOverrideMutation` | `PATCH emrClient /crm/trigger-engine/central-programs/{id}/rules/{ruleId}/override` |
| `usePostCrmTriggerEngineProgramsCopyMutation` | `POST emrClient /crm/trigger-engine/programs/{id}/copy` |
| `usePutCrmTriggerEngineCentralProgramsSubscriptionMutation` | `PUT emrClient /crm/trigger-engine/central-programs/{id}/subscription` |

<a id="c-components-crm-crmcontactruleseditmodal"></a>

### CrmContactRulesEditModal

- `restored/components/crm/CrmContactRulesEditModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useCrmTriggerEngineProgramsQuery_2` | `GET emrClient /crm/trigger-engine/programs/{id}` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesCallerNumbersQuery_2` | `GET crmClient /messages/caller-numbers` |
| `usePostCrmTriggerEngineProgramsMutation` | `POST emrClient /crm/trigger-engine/programs` |
| `usePutCrmTriggerEngineProgramsMutation` | `PUT emrClient /crm/trigger-engine/programs/{id}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |
| `getMessagesTemplatesByTemplateTypeAndId` (직접) | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmcontactruleseditmodalprescriptionsearch"></a>

### CrmContactRulesEditModalPrescriptionSearch

- `restored/components/crm/CrmContactRulesEditModalPrescriptionSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `xr` (직접) | `GET emrClient /settings/nonbenefit-packages` |

<a id="c-components-crm-crmcontactrulesfilter"></a>

### CrmContactRulesFilter

- `restored/components/crm/CrmContactRulesFilter.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |

<a id="c-components-crm-crmcontactrulesitem"></a>

### CrmContactRulesItem

- `restored/components/crm/CrmContactRulesItem.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteCrmContactListRulesMutation` | `DELETE emrClient /crm/contact-list/rules/{id}` |
| `usePatchCrmContactListRulesMutation` | `PATCH emrClient /crm/contact-list/rules/{id}` |
| `usePostCrmContactListRulesMutation` | `POST emrClient /crm/contact-list/rules` |

<a id="c-components-crm-crmcontactrulesitemread"></a>

### CrmContactRulesItemRead

- `restored/components/crm/CrmContactRulesItemRead.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchCrmContactListRulesMutation` | `PATCH emrClient /crm/contact-list/rules/{id}` |

<a id="c-components-crm-crmcontactrulesprogramcard"></a>

### CrmContactRulesProgramCard

- `restored/components/crm/CrmContactRulesProgramCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteCrmTriggerEngineProgramsMutation` | `DELETE emrClient /crm/trigger-engine/programs/{id}` |
| `usePatchCrmTriggerEngineProgramsMutation` | `PATCH emrClient /crm/trigger-engine/programs/{id}` |
| `usePatchCrmTriggerEngineProgramsRulesMutation` | `PATCH emrClient /crm/trigger-engine/programs/{id}/rules/{ruleId}` |
| `usePostCrmTriggerEngineProgramsCopyMutation` | `POST emrClient /crm/trigger-engine/programs/{id}/copy` |

<a id="c-components-crm-crmcontactrulessidepanelcontent-2"></a>

### CrmContactRulesSidePanelContent

- `restored/components/crm/CrmContactRulesSidePanelContent-2.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |
| `useCrmLiteTriggerRulesQuery` | `GET emrClient /crm/lite-trigger/rules` |

<a id="c-components-crm-crmcontactrulessidepanelcontent"></a>

### CrmContactRulesSidePanelContent

- `restored/components/crm/CrmContactRulesSidePanelContent.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineCentralProgramsQuery` | `GET emrClient /crm/trigger-engine/central-programs` |
| `useCrmTriggerEngineProgramsQuery` | `GET emrClient /crm/trigger-engine/programs` |
| `useMessagesTemplatesSourcesQuery` | `GET crmClient /messages/templates/sources` |
| `getCrmTriggerEngineProgramGroups_2` (직접) | `GET emrClient /crm/trigger-engine/program-groups` |
| `postCrmTriggerEngineProgramGroupsOptOut` (직접) | `POST emrClient /crm/trigger-engine/program-groups/{encodeURIComponent(input)}/opt-out` |

<a id="c-components-crm-crmcontactsviewcalendar"></a>

### CrmContactsViewCalendar

- `restored/components/crm/CrmContactsViewCalendar.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `usePostCrmTriggerEngineExecutionLogsCancelMutation` | `POST emrClient /crm/trigger-engine/execution-logs/cancel` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |
| `usePostCrmTriggerEngineExecutionLogsManualAutoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual-auto` |
| `usePostCrmTriggerEngineExecutionLogsManualMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual` |
| `usePostCrmTriggerEngineExecutionLogsRescheduleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/reschedule` |
| `usePostCrmTriggerEngineExecutionLogsShiftGroupMutation` | `POST emrClient /crm/trigger-engine/execution-logs/shift-group` |
| `usePostCrmTriggerEngineExecutionLogsToggleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/toggle` |
| `usePostCrmTriggerEngineExecutionLogsUncompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/uncomplete` |
| `usePostCrmTriggerEngineExecutionLogsUndoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/undo` |
| `getCrmTriggerEngineExecutionLogs` (직접) | `GET emrClient /crm/trigger-engine/execution-logs/{id}` |
| `postCrmTriggerEngineExecutionLogsShiftGroupPreview` (직접) | `POST emrClient /crm/trigger-engine/execution-logs/shift-group/preview` |

<a id="c-components-crm-crmcontactsviewdetail-2"></a>

### CrmContactsViewDetail

- `restored/components/crm/CrmContactsViewDetail-2.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmContactListSchedulesPatientSchedulesQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}/schedules` |
| `usePatchCrmContactListSchedulerMutation` | `PATCH emrClient /crm/contact-list/scheduler/{logId}` |
| `usePostCrmContactListSchedulesPatientBulkProcessMutation` | `POST emrClient /crm/contact-list/schedules/patient/{patientId}/bulk-process` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-crm-crmcontactsviewdetail"></a>

### CrmContactsViewDetail

- `restored/components/crm/CrmContactsViewDetail.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-crm-crmcontactsviewdetailactionlogs-2"></a>

### CrmContactsViewDetailActionLogs

- `restored/components/crm/CrmContactsViewDetailActionLogs-2.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineWorklistPatientsActivityQuery` | `GET emrClient /crm/trigger-engine/worklist/patients/{patientId}/activity` |

<a id="c-components-crm-crmcontactsviewdetailactionlogs"></a>

### CrmContactsViewDetailActionLogs

- `restored/components/crm/CrmContactsViewDetailActionLogs.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListActionLogsPatientQuery` | `GET emrClient /crm/contact-list/action-logs/patient/{patientId}` |

<a id="c-components-crm-crmcontactsviewdetailpackages"></a>

### CrmContactsViewDetailPackages

- `restored/components/crm/CrmContactsViewDetailPackages.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |

<a id="c-components-crm-crmcontactsviewdetailscheduledcontacts"></a>

### CrmContactsViewDetailScheduledContacts

- `restored/components/crm/CrmContactsViewDetailScheduledContacts.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |
| `usePostCrmTriggerEngineExecutionLogsRescheduleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/reschedule` |
| `usePostCrmTriggerEngineExecutionLogsToggleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/toggle` |
| `usePostCrmTriggerEngineExecutionLogsUncompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/uncomplete` |
| `getCrmTriggerEngineExecutionLogs` (직접) | `GET emrClient /crm/trigger-engine/execution-logs/{id}` |

<a id="c-components-crm-crmcontactsviewheader"></a>

### CrmContactsViewHeader

- `restored/components/crm/CrmContactsViewHeader.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `Aln` (직접) | `POST emrClient /crm/lite-trigger/events/{n.id}/opt-out` |
| `Iln` (직접) | `POST emrClient /crm/lite-trigger/events/{r.id}/opt-in` |

<a id="c-components-crm-crmcontactsviewlist-2"></a>

### CrmContactsViewList

- `restored/components/crm/CrmContactsViewList-2.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulerQuery` | `GET emrClient /crm/contact-list/scheduler` |
| `useCrmContactListSchedulerSummaryQuery` | `GET emrClient /crm/contact-list/scheduler/summary` |
| `useCrmContactListSchedulesQuery` | `GET emrClient /crm/contact-list/schedules` |
| `useCrmContactListSchedulesSummaryQuery` | `GET emrClient /crm/contact-list/schedules/summary` |

<a id="c-components-crm-crmcontactsviewlist"></a>

### CrmContactsViewList

- `restored/components/crm/CrmContactsViewList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineProgramsQuery` | `GET emrClient /crm/trigger-engine/programs` |
| `useCrmTriggerEngineWorklistLogsQuery_2` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `postMessagesDeliveryStatus` (직접) | `POST crmClient /messages/delivery-status` |

<a id="c-components-crm-crmcontactsviewlistdashboard"></a>

### CrmContactsViewListDashboard

- `restored/components/crm/CrmContactsViewListDashboard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |
| `usePostCrmTriggerEngineExecutionLogsToggleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/toggle` |
| `usePostCrmTriggerEngineExecutionLogsUncompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/uncomplete` |

<a id="c-components-crm-crmcontactsviewlisttable"></a>

### CrmContactsViewListTable

- `restored/components/crm/CrmContactsViewListTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostCrmContactListSchedulesCompleteMutation` | `POST emrClient /crm/contact-list/schedules/{id}/complete` |
| `usePostCrmContactListSchedulesUncompleteMutation` | `POST emrClient /crm/contact-list/schedules/{id}/uncomplete` |

<a id="c-components-crm-crmcontactsviewlisttableautosendpreview"></a>

### CrmContactsViewListTableAutoSendPreview

- `restored/components/crm/CrmContactsViewListTableAutoSendPreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmcontactsviewlisttablecontactdatespickercontent"></a>

### CrmContactsViewListTableContactDatesPickerContent

- `restored/components/crm/CrmContactsViewListTableContactDatesPickerContent.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientSchedulesQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}/schedules` |
| `useCrmContactListSchedulesPatientSchedulesQuery_2` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}/schedules` |
| `usePostCrmContactListSchedulesPatientBulkProcessMutation` | `POST emrClient /crm/contact-list/schedules/patient/{patientId}/bulk-process` |
| `usePostCrmContactListSchedulesRestoreMutation` | `POST emrClient /crm/contact-list/schedules/restore` |

<a id="c-components-crm-crmcontactsviewlisttablenorowsoverlay"></a>

### CrmContactsViewListTableNoRowsOverlay

- `restored/components/crm/CrmContactsViewListTableNoRowsOverlay.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |

<a id="c-components-crm-crmcontentdetailpane"></a>

### CrmContentDetailPane

- `restored/components/crm/CrmContentDetailPane.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsGroupsQuery` | `GET crmClient /contents/groups` |
| `useContentsQuery` | `GET crmClient /contents` |
| `usePatchContentsMutation` | `PATCH crmClient /contents/{id}` |
| `usePostContentsScrapeMutation` | `POST crmClient /contents/scrape` |

<a id="c-components-crm-crmcontentlistdock"></a>

### CrmContentListDock

- `restored/components/crm/CrmContentListDock.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsGroupsQuery` | `GET crmClient /contents/groups` |
| `useContentsQuery` | `GET crmClient /contents` |

<a id="c-components-crm-crmcontentpatientpreview"></a>

### CrmContentPatientPreview

- `restored/components/crm/CrmContentPatientPreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsBundlesQuery` | `GET crmClient /contents/bundles/{input}` |
| `postContentsBundlesEvents` (직접) | `POST crmClient /contents/bundles/{token}/events` |

<a id="c-components-crm-crmcontentregisterpane"></a>

### CrmContentRegisterPane

- `restored/components/crm/CrmContentRegisterPane.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsGroupsQuery` | `GET crmClient /contents/groups` |
| `usePostContentsGroupsMutation` | `POST crmClient /contents/groups` |
| `usePostContentsMutation` | `POST crmClient /contents` |
| `usePostContentsScrapeMutation` | `POST crmClient /contents/scrape` |

<a id="c-components-crm-crmcontentselectmodal"></a>

### CrmContentSelectModal

- `restored/components/crm/CrmContentSelectModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsGroupsQuery` | `GET crmClient /contents/groups` |
| `useContentsQuery` | `GET crmClient /contents` |

<a id="c-components-crm-crmcontentthumbnailupload"></a>

### CrmContentThumbnailUpload

- `restored/components/crm/CrmContentThumbnailUpload.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postRoot` (직접) | `POST crmClient <input_2>` |

<a id="c-components-crm-crmhappycalltemplatesmodal"></a>

### CrmHappyCallTemplatesModal

- `restored/components/crm/CrmHappyCallTemplatesModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET crmClient <e>` |

<a id="c-components-crm-crmhospitalvariablesmodal"></a>

### CrmHospitalVariablesModal

- `restored/components/crm/CrmHospitalVariablesModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getCrmTriggerEngineHospitalVariables` (직접) | `GET emrClient /crm/trigger-engine/hospital-variables` |
| `patchCrmTriggerEngineHospitalVariables` (직접) | `PATCH emrClient /crm/trigger-engine/hospital-variables` |

<a id="c-components-crm-crmkakaoalimtalkmessagepreview"></a>

### CrmKakaoAlimtalkMessagePreview

- `restored/components/crm/CrmKakaoAlimtalkMessagePreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmkakaobrandmessagepreview"></a>

### CrmKakaoBrandMessagePreview

- `restored/components/crm/CrmKakaoBrandMessagePreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmkakaochannelsaddmodal"></a>

### CrmKakaoChannelsAddModal

- `restored/components/crm/CrmKakaoChannelsAddModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useCrmLiteTriggerHospitalVariablesQuery` | `GET emrClient /crm/lite-trigger/hospital-variables` |
| `useKakaoChannelsCategoriesQuery` | `GET crmClient /kakao/channels/categories` |
| `usePostKakaoChannelsMutation` | `POST crmClient /kakao/channels` |
| `usePostKakaoChannelsTokenMutation` | `POST crmClient /kakao/channels/token` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `Iln` (직접) | `POST emrClient /crm/lite-trigger/events/{r.id}/opt-in` |

<a id="c-components-crm-crmkakaochannelsselect"></a>

### CrmKakaoChannelsSelect

- `restored/components/crm/CrmKakaoChannelsSelect.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |

<a id="c-components-crm-crmkakaofallbackinfomodal"></a>

### CrmKakaoFallbackInfoModal

- `restored/components/crm/CrmKakaoFallbackInfoModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostMessagesKakaoAlimtalkTestManualMutation` | `POST crmClient /messages/kakao/alimtalk/test/manual` |
| `useRootQuery` | `GET crmClient <d>` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmkakaotemplatehoverpreviewbyid"></a>

### CrmKakaoTemplateHoverPreviewById

- `restored/components/crm/CrmKakaoTemplateHoverPreviewById.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |

<a id="c-components-crm-crmkakaotemplatesdropdown"></a>

### CrmKakaoTemplatesDropdown

- `restored/components/crm/CrmKakaoTemplatesDropdown.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesTemplatesSourcesQuery` | `GET crmClient /messages/templates/sources` |
| `useRootQuery` | `GET crmClient <d>` |

<a id="c-components-crm-crmkakaotemplatesused"></a>

### CrmKakaoTemplatesUsed

- `restored/components/crm/CrmKakaoTemplatesUsed.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesFrequentlyUsedQuery` | `GET crmClient /messages/kakao-templates/frequently-used` |

<a id="c-components-crm-crmlitetriggerkakaolinkvarmodal"></a>

### CrmLiteTriggerKakaoLinkVarModal

- `restored/components/crm/CrmLiteTriggerKakaoLinkVarModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmLiteTriggerHospitalVariablesQuery` | `GET emrClient /crm/lite-trigger/hospital-variables` |

<a id="c-components-crm-crmlitetriggerrulesgroupcard"></a>

### CrmLiteTriggerRulesGroupCard

- `restored/components/crm/CrmLiteTriggerRulesGroupCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchCrmLiteTriggerRulesMutation` | `PATCH emrClient /crm/lite-trigger/rules/{id}` |

<a id="c-components-crm-crmlitetriggerschedulersetupmodal"></a>

### CrmLiteTriggerSchedulerSetupModal

- `restored/components/crm/CrmLiteTriggerSchedulerSetupModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |

<a id="c-components-crm-crmlitetriggertemplatepreviewicon"></a>

### CrmLiteTriggerTemplatePreviewIcon

- `restored/components/crm/CrmLiteTriggerTemplatePreviewIcon.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |

<a id="c-components-crm-crmlitetriggervariableinputmodal"></a>

### CrmLiteTriggerVariableInputModal

- `restored/components/crm/CrmLiteTriggerVariableInputModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmLiteTriggerHospitalVariablesQuery` | `GET emrClient /crm/lite-trigger/hospital-variables` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-crm-crmmessagetemplateregistersidepanelcontent"></a>

### CrmMessageTemplateRegisterSidePanelContent

- `restored/components/crm/CrmMessageTemplateRegisterSidePanelContent.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |

<a id="c-components-crm-crmmessagetemplatesdropdown"></a>

### CrmMessageTemplatesDropdown

- `restored/components/crm/CrmMessageTemplatesDropdown.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET crmClient <c>` |

<a id="c-components-crm-crmmessagetemplatesmanager"></a>

### CrmMessageTemplatesManager

- `restored/components/crm/CrmMessageTemplatesManager.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useCategoriesQuery` | `GET crmClient /categories` |
| `useDeleteMessagesKakaoTemplatesPrivateByIdMutation` | `DELETE crmClient /messages/kakao-templates/private/{args.id}` |
| `useDeleteMessagesTemplateGroupsMutation` | `DELETE crmClient /messages/template-groups/{id}` |
| `useDeleteMessagesTemplatesByIdMutation` | `DELETE crmClient /messages/templates/{args.id}` |
| `useMessagesTemplateGroupsQuery` | `GET crmClient /messages/template-groups` |
| `useMessagesTemplateLibraryQuery` | `GET crmClient /messages/template-library` |
| `useMessagesTemplatesSourcesCountsQuery` | `GET crmClient /messages/templates/sources/counts` |
| `useMessagesTemplatesSourcesQuery` | `GET crmClient /messages/templates/sources` |
| `usePatchMessagesTemplateGroupsMutation` | `PATCH crmClient /messages/template-groups/{id}` |
| `usePostMessagesTemplateGroupsMutation` | `POST crmClient /messages/template-groups` |

<a id="c-components-crm-crmpatientmessagesendestimate"></a>

### CrmPatientMessageSendEstimate

- `restored/components/crm/CrmPatientMessageSendEstimate.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingInvoicesUnitPricesQuery` | `GET crmClient /billing/invoices/unit-prices` |

<a id="c-components-crm-crmpatientmessagesendsidepanel"></a>

### CrmPatientMessageSendSidePanel

- `restored/components/crm/CrmPatientMessageSendSidePanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useTermsHospitalAgreementsQuery` | `GET accountClient /terms/hospital-agreements` |

<a id="c-components-crm-crmpatientmessagesendsidepanelconfirm"></a>

### CrmPatientMessageSendSidePanelConfirm

- `restored/components/crm/CrmPatientMessageSendSidePanelConfirm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-crm-crmpatientmessagesendsidepanelcontent"></a>

### CrmPatientMessageSendSidePanelContent

- `restored/components/crm/CrmPatientMessageSendSidePanelContent.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesPatientsTemplateVariablesByPatientIdQuery` | `GET crmClient /messages/patients/{args.patientId}/template-variables` |
| `useMessagesSendPatientsEstimateQuery` | `POST crmClient /messages/send/patients/estimate` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostMessagesKakaoAlimtalkPatientMutation` | `POST crmClient /messages/kakao/alimtalk/patient` |
| `usePostMessagesKakaoBrandPatientMutation` | `POST crmClient /messages/kakao/brand/patient` |
| `usePostMessagesSendPatientMutation` | `POST crmClient /messages/send/patient` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |

<a id="c-components-crm-crmprogramgroupoptinbanner"></a>

### CrmProgramGroupOptInBanner

- `restored/components/crm/CrmProgramGroupOptInBanner.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getCrmTriggerEngineProgramGroups_2` (직접) | `GET emrClient /crm/trigger-engine/program-groups` |
| `postCrmTriggerEngineProgramGroupsOptOut` (직접) | `POST emrClient /crm/trigger-engine/program-groups/{encodeURIComponent(input)}/opt-out` |

<a id="c-components-crm-crmprogramgroupoptinmodal"></a>

### CrmProgramGroupOptInModal

- `restored/components/crm/CrmProgramGroupOptInModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `getMessagesTemplatesByTemplateTypeAndId` (직접) | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |
| `getCrmLiteTriggerHospitalVariables` (직접) | `GET emrClient /crm/lite-trigger/hospital-variables` |
| `getCrmTriggerEngineProgramGroups` (직접) | `GET emrClient /crm/trigger-engine/program-groups/{encodeURIComponent(input)}` |
| `getCrmTriggerEngineProgramGroupsTemplates` (직접) | `GET emrClient /crm/trigger-engine/program-groups/{encodeURIComponent(input)}/templates` |
| `patchCrmTriggerEngineHospitalVariables` (직접) | `PATCH emrClient /crm/trigger-engine/hospital-variables` |
| `postCrmTriggerEngineProgramGroupsOptIn` (직접) | `POST emrClient /crm/trigger-engine/program-groups/{encodeURIComponent(input)}/opt-in` |

<a id="c-components-crm-crmrefusalviewlist080"></a>

### CrmRefusalViewList080

- `restored/components/crm/CrmRefusalViewList080.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostRefusalsDownloadMutation` | `POST crmClient /refusals/download` |
| `getRefusals080` (직접) | `GET crmClient /refusals/080` |

<a id="c-components-crm-crmrefusalviewlisthospital"></a>

### CrmRefusalViewListHospital

- `restored/components/crm/CrmRefusalViewListHospital.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostRefusalsDownloadMutation` | `POST crmClient /refusals/download` |
| `getRefusals` (직접) | `GET crmClient /refusals` |

<a id="c-components-crm-crmrefusalviewlisthospitalregisterpanel"></a>

### CrmRefusalViewListHospitalRegisterPanel

- `restored/components/crm/CrmRefusalViewListHospitalRegisterPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRefusalsContactMutation` | `PATCH crmClient /refusals/contact/{contactId}` |
| `postRefusals` (직접) | `POST crmClient /refusals` |

<a id="c-components-crm-crmrefusalviewlisttablehospitalactioncell"></a>

### CrmRefusalViewListTableHospitalActionCell

- `restored/components/crm/CrmRefusalViewListTableHospitalActionCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRefusalsMutation` | `PATCH crmClient /refusals/{id}` |

<a id="c-components-crm-crmroutinecanvasexecutemodal"></a>

### CrmRoutineCanvasExecuteModal

- `restored/components/crm/CrmRoutineCanvasExecuteModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |
| `useSchedulersAssigneesQuery` | `GET crmClient /schedulers/assignees` |

<a id="c-components-crm-crmroutinecanvasviewpanelroutinehappycall"></a>

### CrmRoutineCanvasViewPanelRoutineHappyCall

- `restored/components/crm/CrmRoutineCanvasViewPanelRoutineHappyCall.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostHappycallTemplatesMutation` | `POST crmClient /happycall/templates` |

<a id="c-components-crm-crmroutinecanvasviewpanelroutinemessage"></a>

### CrmRoutineCanvasViewPanelRoutineMessage

- `restored/components/crm/CrmRoutineCanvasViewPanelRoutineMessage.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |

<a id="c-components-crm-crmroutineviewbasicinfomodal"></a>

### CrmRoutineViewBasicInfoModal

- `restored/components/crm/CrmRoutineViewBasicInfoModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |

<a id="c-components-crm-crmroutineviewoperationinfopopover"></a>

### CrmRoutineViewOperationInfoPopover

- `restored/components/crm/CrmRoutineViewOperationInfoPopover.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |

<a id="c-components-crm-crmroutineviewroutines"></a>

### CrmRoutineViewRoutines

- `restored/components/crm/CrmRoutineViewRoutines.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCategoriesQuery` | `GET crmClient /categories` |
| `usePatchSchedulersMutation` | `PATCH crmClient /schedulers/{id}` |
| `useSchedulersSearchQuery` | `GET crmClient /schedulers`<br>`GET crmClient /schedulers/search` |

<a id="c-components-crm-crmroutineviewstartwithscratch"></a>

### CrmRoutineViewStartWithScratch

- `restored/components/crm/CrmRoutineViewStartWithScratch.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCategoriesQuery` | `GET crmClient /categories` |
| `usePostSchedulersInfoMutation` | `POST crmClient /schedulers/info` |

<a id="c-components-crm-crmroutineviewstartwithtemplate"></a>

### CrmRoutineViewStartWithTemplate

- `restored/components/crm/CrmRoutineViewStartWithTemplate.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCategoriesQuery` | `GET crmClient /categories` |
| `usePostSchedulersTemplatesApplyByTemplateIdMutation` | `POST crmClient /schedulers/templates/{args.templateId}/apply` |
| `useSchedulersTemplatesByIdQuery` | `GET crmClient /schedulers/templates/{args.id}` |
| `useSchedulersTemplatesQuery` | `GET crmClient /schedulers/templates` |

<a id="c-components-crm-crmscheduleaddcontactpopover"></a>

### CrmScheduleAddContactPopover

- `restored/components/crm/CrmScheduleAddContactPopover.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesCallerNumbersQuery_2` | `GET crmClient /messages/caller-numbers` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-crm-crmscheduleaddpatientcontactbutton"></a>

### CrmScheduleAddPatientContactButton

- `restored/components/crm/CrmScheduleAddPatientContactButton.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostCrmTriggerEngineExecutionLogsManualAutoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual-auto` |
| `usePostCrmTriggerEngineExecutionLogsManualMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual` |

<a id="c-components-crm-crmschedulecalendarmodal"></a>

### CrmScheduleCalendarModal

- `restored/components/crm/CrmScheduleCalendarModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `usePostCrmTriggerEngineExecutionLogsCancelMutation` | `POST emrClient /crm/trigger-engine/execution-logs/cancel` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |
| `usePostCrmTriggerEngineExecutionLogsManualAutoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual-auto` |
| `usePostCrmTriggerEngineExecutionLogsManualMutation` | `POST emrClient /crm/trigger-engine/execution-logs/manual` |
| `usePostCrmTriggerEngineExecutionLogsRescheduleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/reschedule` |
| `usePostCrmTriggerEngineExecutionLogsShiftGroupMutation` | `POST emrClient /crm/trigger-engine/execution-logs/shift-group` |
| `usePostCrmTriggerEngineExecutionLogsToggleMutation` | `POST emrClient /crm/trigger-engine/execution-logs/toggle` |
| `usePostCrmTriggerEngineExecutionLogsUncompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/uncomplete` |
| `usePostCrmTriggerEngineExecutionLogsUndoMutation` | `POST emrClient /crm/trigger-engine/execution-logs/undo` |
| `getCrmTriggerEngineExecutionLogs` (직접) | `GET emrClient /crm/trigger-engine/execution-logs/{id}` |
| `postCrmTriggerEngineExecutionLogsShiftGroupPreview` (직접) | `POST emrClient /crm/trigger-engine/execution-logs/shift-group/preview` |

<a id="c-components-crm-crmschedulepatientsearch"></a>

### CrmSchedulePatientSearch

- `restored/components/crm/CrmSchedulePatientSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery_2` | `GET emrClient /patients/list` |

<a id="c-components-crm-crmschedulerescheduledatepopover"></a>

### CrmScheduleRescheduleDatePopover

- `restored/components/crm/CrmScheduleRescheduleDatePopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery_2` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmsettingcallernumbers"></a>

### CrmSettingCallerNumbers

- `restored/components/crm/CrmSettingCallerNumbers.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesCallerNumbersQuery` | `GET crmClient /messages/caller-numbers` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-crm-crmsettingcallernumberstablecellaction"></a>

### CrmSettingCallerNumbersTableCellAction

- `restored/components/crm/CrmSettingCallerNumbersTableCellAction.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchKakaoChannelsDefaultByIdMutation` | `PATCH crmClient /kakao/channels/{args.id}/default` |
| `usePatchMessagesCallerNumbersMutation` | `PATCH crmClient /messages/caller-numbers/{id}` |

<a id="c-components-crm-crmsettingcallernumberstablecellremove"></a>

### CrmSettingCallerNumbersTableCellRemove

- `restored/components/crm/CrmSettingCallerNumbersTableCellRemove.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteMessagesCallerNumbersMutation` | `DELETE crmClient /messages/caller-numbers/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-crm-crmsettingcontentssidebar"></a>

### CrmSettingContentsSidebar

- `restored/components/crm/CrmSettingContentsSidebar.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContentsGroupsQuery` | `GET crmClient /contents/groups` |
| `useContentsQuery` | `GET crmClient /contents` |
| `useDeleteContentsGroupsMutation` | `DELETE crmClient /contents/groups/{input}` |
| `usePatchContentsGroupsMutation` | `PATCH crmClient /contents/groups/{id}` |
| `usePostContentsGroupsMutation` | `POST crmClient /contents/groups` |

<a id="c-components-crm-crmsmsfallbackbadge"></a>

### CrmSmsFallbackBadge

- `restored/components/crm/CrmSmsFallbackBadge.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery_2` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmliteschedulernorowsoverlay"></a>

### CrmLiteSchedulerNoRowsOverlay

- `restored/components/crm/CrmLiteSchedulerNoRowsOverlay.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListRulesQuery` | `GET emrClient /crm/contact-list/rules` |

<a id="c-components-crm-crmliteschedulerrulespanel"></a>

### CrmLiteSchedulerRulesPanel

- `restored/components/crm/CrmLiteSchedulerRulesPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmLiteTriggerRulesQuery` | `GET emrClient /crm/lite-trigger/rules` |

<a id="c-components-crm-crmliteschedulerviewheader"></a>

### CrmLiteSchedulerViewHeader

- `restored/components/crm/CrmLiteSchedulerViewHeader.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useLiteTriggersStatusQuery` | `GET crmClient /lite-triggers/status` |
| `Aln` (직접) | `POST emrClient /crm/lite-trigger/events/{n.id}/opt-out` |
| `Iln` (직접) | `POST emrClient /crm/lite-trigger/events/{r.id}/opt-in` |

<a id="c-components-crm-crmliteschedulerviewlist"></a>

### CrmLiteSchedulerViewList

- `restored/components/crm/CrmLiteSchedulerViewList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulerQuery` | `GET emrClient /crm/contact-list/scheduler` |
| `useCrmContactListSchedulerSummaryQuery` | `GET emrClient /crm/contact-list/scheduler/summary` |

<a id="c-components-crm-crmtemplateformpanel"></a>

### CrmTemplateFormPanel

- `restored/components/crm/CrmTemplateFormPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |
| `usePatchMessagesTemplatesMutation` | `PATCH crmClient /messages/templates/{id}` |
| `usePostMessagesKakaoTemplatesPrivateAlimtalkMutation` | `POST crmClient /messages/kakao-templates/private/alimtalk` |
| `usePostMessagesKakaoTemplatesPrivateBrandMutation` | `POST crmClient /messages/kakao-templates/private/brand` |
| `usePostMessagesTemplatesMutation` | `POST crmClient /messages/templates` |
| `usePutMessagesKakaoTemplatesPrivateAlimtalkMutation` | `PUT crmClient /messages/kakao-templates/private/alimtalk/{id}` |
| `usePutMessagesKakaoTemplatesPrivateBrandMutation` | `PUT crmClient /messages/kakao-templates/private/brand/{id}` |

<a id="c-components-crm-crmtemplategroupselect"></a>

### CrmTemplateGroupSelect

- `restored/components/crm/CrmTemplateGroupSelect.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesTemplateGroupsMutation` | `DELETE crmClient /messages/template-groups/{id}` |
| `useMessagesTemplateGroupsQuery` | `GET crmClient /messages/template-groups` |
| `usePatchMessagesTemplateGroupsMutation` | `PATCH crmClient /messages/template-groups/{id}` |
| `usePostMessagesTemplateGroupsMutation` | `POST crmClient /messages/template-groups` |

<a id="c-components-crm-crmtemplatelibrarydetailpreview"></a>

### CrmTemplateLibraryDetailPreview

- `restored/components/crm/CrmTemplateLibraryDetailPreview.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |
| `useMessagesTemplatesByTemplateTypeAndIdQuery` | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmtemplatelibrarymessagedetail"></a>

### CrmTemplateLibraryMessageDetail

- `restored/components/crm/CrmTemplateLibraryMessageDetail.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useDeleteMessagesKakaoTemplatesPrivateByIdMutation` | `DELETE crmClient /messages/kakao-templates/private/{args.id}` |
| `useDeleteMessagesTemplatesByIdMutation` | `DELETE crmClient /messages/templates/{args.id}` |
| `usePatchMessagesTemplatesMutation` | `PATCH crmClient /messages/templates/{id}` |

<a id="c-components-crm-crmtemplatelibrarymodal"></a>

### CrmTemplateLibraryModal

- `restored/components/crm/CrmTemplateLibraryModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useCategoriesQuery` | `GET crmClient /categories` |
| `useDeleteMessagesKakaoTemplatesPrivateByIdMutation` | `DELETE crmClient /messages/kakao-templates/private/{args.id}` |
| `useDeleteMessagesTemplatesByIdMutation` | `DELETE crmClient /messages/templates/{args.id}` |
| `useMessagesTemplateGroupsQuery` | `GET crmClient /messages/template-groups` |
| `useMessagesTemplateLibraryQuery` | `GET crmClient /messages/template-library` |
| `useMessagesTemplatesSourcesCountsQuery` | `GET crmClient /messages/templates/sources/counts` |
| `useMessagesTemplatesSourcesQuery` | `GET crmClient /messages/templates/sources` |
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |
| `getMessagesTemplatesByTemplateTypeAndId` (직접) | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |

<a id="c-components-crm-crmtemplatelibrarytree"></a>

### CrmTemplateLibraryTree

- `restored/components/crm/CrmTemplateLibraryTree.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCategoriesQuery` | `GET crmClient /categories` |
| `useMessagesTemplateGroupsQuery` | `GET crmClient /messages/template-groups` |
| `useMessagesTemplatesSourcesCountsQuery` | `GET crmClient /messages/templates/sources/counts` |
| `useMessagesTemplatesSourcesQuery` | `GET crmClient /messages/templates/sources` |

<a id="c-components-crm-crmtrialexpiryalert"></a>

### CrmTrialExpiryAlert

- `restored/components/crm/CrmTrialExpiryAlert.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSubscriptionsMeQuery` | `GET emrClient /subscriptions/me` |

<a id="c-components-crm-crmtrialintromodal"></a>

### CrmTrialIntroModal

- `restored/components/crm/CrmTrialIntroModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSubscriptionsMeQuery` | `GET emrClient /subscriptions/me` |

<a id="components-customs"></a>

## components/customs

<a id="c-components-customs-customscertificate"></a>

### CustomsCertificate

- `restored/components/customs/CustomsCertificate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsHerbalPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="components-desk"></a>

## components/desk

<a id="c-components-desk-deskpatientaccept"></a>

### DeskPatientAccept

- `restored/components/desk/DeskPatientAccept.vue` · 스토어 `useDeskDateStore`, `useIntakeLinkPromptStore`, `usePatientStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useDeskAppointmentsByValueQuery` | `GET emrClient <"/desk/appointments?date=" + args.value>` |
| `useDeskAppointmentsHistoryQuery` | `GET emrClient /desk/appointments/{input}/history` |
| `useDeskPrepaidChartsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}` |
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `usePatientsCarWaitingAmountByIdAndReportNumberQuery` | `GET emrClient /patients/{args.id}/car-waiting/amount/{args.report_number}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsWaitingLatestQuery` | `GET emrClient /patients/{id}/waiting/latest` |
| `usePostDeskWaitingMutation` | `POST emrClient /desk/waiting` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsAppointmentsQuery` | `GET emrClient <"/settings/doctors/appointments/" + input>` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskpatientacceptcar"></a>

### DeskPatientAcceptCar

- `restored/components/desk/DeskPatientAcceptCar.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartCarPcmdPatientsQuery` | `GET emrClient /chart/car-pcmd/patients/{pId}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePatientsCarWaitingAmountByIdAndReportNumberQuery` | `GET emrClient /patients/{args.id}/car-waiting/amount/{args.report_number}` |
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartCarPcmdPatientsMutation` | `POST emrClient /chart/car-pcmd/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-desk-deskpatientacceptcarhistory"></a>

### DeskPatientAcceptCarHistory

- `restored/components/desk/DeskPatientAcceptCarHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeletePatientsCarWaitingByIdMutation` | `DELETE emrClient /patients/car-waiting/{args.id}` |
| `usePatchPatientsCarWaitingMutation` | `PATCH emrClient /patients/car-waiting/{id}` |
| `usePostPatientsCarWaitingMutation` | `POST emrClient /patients/{id}/car-waiting` |

<a id="c-components-desk-deskpatientacceptindustrial"></a>

### DeskPatientAcceptIndustrial

- `restored/components/desk/DeskPatientAcceptIndustrial.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsSanjaeWaitingMutation` | `PATCH emrClient /patients/sanjae-waiting/{id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsSanjaeWaitingQuery` | `GET emrClient /patients/{input}/sanjae-waiting` |

<a id="c-components-desk-deskpatientacceptindustrialhistory"></a>

### DeskPatientAcceptIndustrialHistory

- `restored/components/desk/DeskPatientAcceptIndustrialHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsSanjaeWaitingMutation` | `PATCH emrClient /patients/sanjae-waiting/{id}` |

<a id="c-components-desk-deskpatientacceptinsuranceidentityverification"></a>

### DeskPatientAcceptInsuranceIdentityVerification

- `restored/components/desk/DeskPatientAcceptInsuranceIdentityVerification.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-desk-deskpatientacceptinsurancetype"></a>

### DeskPatientAcceptInsuranceType

- `restored/components/desk/DeskPatientAcceptInsuranceType.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-desk-deskpatientacceptjejusupport"></a>

### DeskPatientAcceptJejuSupport

- `restored/components/desk/DeskPatientAcceptJejuSupport.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskpatientacceptnhicchunasummary"></a>

### DeskPatientAcceptNhicChunaSummary

- `restored/components/desk/DeskPatientAcceptNhicChunaSummary.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-desk-deskpatientacceptpatientinfo"></a>

### DeskPatientAcceptPatientInfo

- `restored/components/desk/DeskPatientAcceptPatientInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskFamiliesMembersRelationsQuery` | `GET emrClient /desk/families/{input}/members-relations` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskpatientinfobasicinfo"></a>

### DeskPatientInfoBasicInfo

- `restored/components/desk/DeskPatientInfoBasicInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `useDeskFamiliesMembersRelationsQuery` | `GET emrClient /desk/families/{input}/members-relations` |
| `usePatientsAgreementHistoryQuery` | `GET emrClient /patients/{id}/agreement-history` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskpatientregister"></a>

### DeskPatientRegister

- `restored/components/desk/DeskPatientRegister.vue` · 스토어 `useDeskDateStore`, `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `useDeskChartNumbersRecommendationsQuery` | `GET emrClient /desk/chart-numbers/recommendations` |
| `useDeskFamiliesMembersRelationsQuery` | `GET emrClient /desk/families/{input}/members-relations` |
| `useGetDeskChartNumbersValidationsMutation` | `GET emrClient /desk/chart-numbers/{input}/validations` |
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `usePatientsCheckSsnQuery` | `POST emrClient /patients/check-ssn` |
| `usePatientsListQuery` | `GET emrClient /patients/list` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostPatientsNewMutation` | `POST emrClient /patients/new` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |
| `useSettingsVisitPathwaysQuery` | `GET emrClient /settings/visit-pathways` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |
| `postSettingsImagesPrivate` (직접) | `POST emrClient /settings/images/private` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskpatientregisterchartnumber"></a>

### DeskPatientRegisterChartNumber

- `restored/components/desk/DeskPatientRegisterChartNumber.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskChartNumbersValidationsQuery` | `GET emrClient /desk/chart-numbers/{input}/validations` |

<a id="c-components-desk-deskpatientrelationships"></a>

### DeskPatientRelationships

- `restored/components/desk/DeskPatientRelationships.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskFamiliesMembersRelationsQuery` | `GET emrClient /desk/families/{input}/members-relations` |
| `useDeskFamiliesRelationDictionariesQuery` | `GET emrClient /desk/families/relation-dictionaries` |
| `usePatientsListQuery` | `GET emrClient /patients/list` |

<a id="c-components-desk-deskpaymentscashbalance"></a>

### DeskPaymentsCashBalance

- `restored/components/desk/DeskPaymentsCashBalance.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskReceiptsQuery` | `GET emrClient /desk/receipts/{input}` |
| `useDeskReceiptsUpdatedChecksQuery` | `GET emrClient /desk/receipts/updated-checks/{input}` |

<a id="c-components-desk-deskpaymentscashbalanceform"></a>

### DeskPaymentsCashBalanceForm

- `restored/components/desk/DeskPaymentsCashBalanceForm.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDeskCashRegistersMutation` | `POST emrClient /desk/cash-registers` |
| `usePutDeskCashRegistersMutation` | `PUT emrClient /desk/cash-registers/{id}` |

<a id="c-components-desk-deskpaymentscashbalancesettlement"></a>

### DeskPaymentsCashBalanceSettlement

- `restored/components/desk/DeskPaymentsCashBalanceSettlement.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDeskSettlementsCashMutation` | `POST emrClient /desk/settlements/cash/{input}` |

<a id="c-components-desk-deskpaymentsdashboard"></a>

### DeskPaymentsDashboard

- `restored/components/desk/DeskPaymentsDashboard.vue` · 스토어 `useDeskDateStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskReceiptsQuery` | `GET emrClient /desk/receipts/{input}` |

<a id="c-components-desk-deskpaymentsexpensehistory"></a>

### DeskPaymentsExpenseHistory

- `restored/components/desk/DeskPaymentsExpenseHistory.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskExpensesMutation` | `DELETE emrClient /desk/expenses/{input}` |
| `useDeskExpensesItemsQuery` | `GET emrClient desk/expenses/items` |
| `useDeskReceiptsUpdatedChecksQuery` | `GET emrClient /desk/receipts/updated-checks/{input}` |
| `usePostDeskExpensesItemsDeleteMutation` | `POST emrClient /desk/expenses/items/delete` |
| `usePostDeskExpensesItemsMutation` | `POST emrClient /desk/expenses/items` |
| `usePostDeskExpensesMutation` | `POST emrClient /desk/expenses` |

<a id="c-components-desk-deskpaymentshistorytable"></a>

### DeskPaymentsHistoryTable

- `restored/components/desk/DeskPaymentsHistoryTable.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskReceiptsQuery` | `GET emrClient /desk/receipts/{input}` |
| `usePostPatientsDownloadLogsMutation` | `POST emrClient /patients/download-logs` |
| `getApiSurachalCohort` (직접) | `GET biClient /api/surachal/cohort` |
| `getApiSurachalMe` (직접) | `GET biClient /api/surachal/me` |
| `getAuthMe` (직접) | `GET emrClient /auth/me` |

<a id="c-components-desk-deskpaymentsunusualpatientspanel"></a>

### DeskPaymentsUnusualPatientsPanel

- `restored/components/desk/DeskPaymentsUnusualPatientsPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskBalancesQuery` | `GET emrClient /desk/balances` |

<a id="c-components-desk-deskviewautocompletesearch"></a>

### DeskViewAutoCompleteSearch

- `restored/components/desk/DeskViewAutoCompleteSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery_2` | `GET emrClient /patients/list` |

<a id="c-components-desk-deskviewpatientappointment"></a>

### DeskViewPatientAppointment

- `restored/components/desk/DeskViewPatientAppointment.vue` · 스토어 `useDeskDateStore`, `usePatientStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAppointmentNotificationsSettingsQuery` | `GET crmClient /appointment-notifications/settings` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useDeskAppointmentsPlannerQuery` | `GET emrClient /desk/appointments/planner` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |
| `usePatchDeskBookingRequestsMutation` | `PATCH emrClient /desk/booking-requests/{input}` |
| `usePatientsAppointmentsHistoryQuery_2` | `GET emrClient /patients/{id}/appointments/history` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsWaitingLatestQuery` | `GET emrClient /patients/{id}/waiting/latest` |
| `usePostDeskAppointmentsMutation` | `POST emrClient /desk/appointments` |
| `usePostDeskBookingRequestsConfirmMutation` | `POST emrClient /desk/booking-requests/confirm` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClosedDaysQuery` | `GET emrClient /settings/closed-days/{input}` |
| `useSettingsDoctorsAppointmentsQuery` | `GET emrClient <"/settings/doctors/appointments/" + input>` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-desk-deskviewpatientappointmenthistory"></a>

### DeskViewPatientAppointmentHistory

- `restored/components/desk/DeskViewPatientAppointmentHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsAppointmentsHistoryQuery` | `GET emrClient /patients/{id}/appointments/history` |
| `usePatientsAppointmentsInfoQuery` | `GET emrClient /patients/{id}/appointments/info` |
| `usePatientsAppointmentsSummaryQuery` | `GET emrClient /patients/{id}/appointments/summary` |

<a id="c-components-desk-deskviewpatientappointmenthistorycard"></a>

### DeskViewPatientAppointmentHistoryCard

- `restored/components/desk/DeskViewPatientAppointmentHistoryCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |

<a id="c-components-desk-deskviewpatientappointmentpatientinput"></a>

### DeskViewPatientAppointmentPatientInput

- `restored/components/desk/DeskViewPatientAppointmentPatientInput.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery_2` | `GET emrClient /patients/list` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |

<a id="c-components-desk-deskvisitpatientcardmemoeditor"></a>

### DeskVisitPatientCardMemoEditor

- `restored/components/desk/DeskVisitPatientCardMemoEditor.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsTemplatesQuery` | `GET emrClient /settings/templates` |

<a id="c-components-desk-deskvisitpatientcardmemopopover"></a>

### DeskVisitPatientCardMemoPopover

- `restored/components/desk/DeskVisitPatientCardMemoPopover.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostPatientsMemosMutation` | `POST emrClient /patients/{pid}/memos` |

<a id="c-components-desk-deskvisitpaymentcheckout"></a>

### DeskVisitPaymentCheckOut

- `restored/components/desk/DeskVisitPaymentCheckOut.vue` · 스토어 `useDeskDateStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskPrepaidChartsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsV2ChartMedicalReceiptsQuery` | `GET emrClient /patients/v2/chart/{input}/medical-receipts` |
| `usePostDeskV2ReceiptsMutation` | `POST emrClient /desk/v2/receipts` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordPatientQuery` | `GET emrClient /record/patient/{pid}` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |

<a id="c-components-desk-deskvisitpaymentcheckoutfooter"></a>

### DeskVisitPaymentCheckOutFooter

- `restored/components/desk/DeskVisitPaymentCheckOutFooter.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartCarPcmdPatientsQuery` | `GET emrClient /chart/car-pcmd/patients/{pId}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsV2ChartMedicalReceiptsQuery` | `GET emrClient /patients/v2/chart/{input}/medical-receipts` |
| `usePostChartCarPcmdPatientsMutation` | `POST emrClient /chart/car-pcmd/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-desk-deskvisitpaymentcheckouttreatmentcard"></a>

### DeskVisitPaymentCheckOutTreatmentCard

- `restored/components/desk/DeskVisitPaymentCheckOutTreatmentCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsReceiptsDetailsQuery` | `GET emrClient /patients/{id}/receipts-details` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskvisitpaymentcheckouttreatmentcarddetail"></a>

### DeskVisitPaymentCheckOutTreatmentCardDetail

- `restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-desk-deskvisittelemedicinecard"></a>

### DeskVisitTelemedicineCard

- `restored/components/desk/DeskVisitTelemedicineCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsTelemedicineQuery` | `GET emrClient /desk/appointments/telemedicine` |

<a id="components-disease"></a>

## components/disease

<a id="c-components-disease-diseaseinputdropdown"></a>

### DiseaseInputDropdown

- `restored/components/disease/DiseaseInputDropdown.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |

<a id="c-components-disease-diseasesearchmodal"></a>

### DiseaseSearchModal

- `restored/components/disease/DiseaseSearchModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartKcdRecentQuery` | `GET emrClient chart/kcd/recent` |
| `useKoicd20260101JsonQuery` | `GET staticClient <KOICD_20240829_JSON_PATH>`<br>`GET staticClient <KOICD_20260101_JSON_PATH>` |

<a id="components-booking"></a>

## components/booking

<a id="c-components-booking-bookingnotificationdropdown"></a>

### BookingNotificationDropdown

- `restored/components/booking/BookingNotificationDropdown.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `usePostDeskBookingRequestsConfirmMutation` | `POST emrClient /desk/booking-requests/confirm` |
| `usePostDeskBookingRequestsRejectMutation` | `POST emrClient /desk/booking-requests/reject` |

<a id="c-components-booking-bookingsignupmodal"></a>

### BookingSignupModal

- `restored/components/booking/BookingSignupModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-doctors"></a>

## components/doctors

<a id="c-components-doctors-doctorsbuttongroup"></a>

### DoctorsButtonGroup

- `restored/components/doctors/DoctorsButtonGroup.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-doctors-doctorsdropdown"></a>

### DoctorsDropdown

- `restored/components/doctors/DoctorsDropdown.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="components-document"></a>

## components/document

<a id="c-components-document-documentaddressselector"></a>

### DocumentAddressSelector

- `restored/components/document/DocumentAddressSelector.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `usePatchDeskAddressesMutation` | `PATCH emrClient /desk/addresses/{input}` |
| `usePostDeskAddressesMutation` | `POST emrClient /desk/addresses/{input}` |

<a id="c-components-document-documentdiseaseperiodimportmodal"></a>

### DocumentDiseasePeriodImportModal

- `restored/components/document/DocumentDiseasePeriodImportModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsDiagnosisByPidQuery` | `GET emrClient /documents/patients/{args.pid}/diagnosis` |

<a id="c-components-document-documentdiseasesearchmodal"></a>

### DocumentDiseaseSearchModal

- `restored/components/document/DocumentDiseaseSearchModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsDiagnosisByPidQuery` | `GET emrClient /documents/patients/{args.pid}/diagnosis` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `useKoicd20260101JsonQuery` | `GET staticClient <KOICD_20240829_JSON_PATH>`<br>`GET staticClient <KOICD_20260101_JSON_PATH>` |

<a id="c-components-document-documentdiseaseselector"></a>

### DocumentDiseaseSelector

- `restored/components/document/DocumentDiseaseSelector.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `getDocumentsPatientsDiagnosisByPid_2` (직접) | `GET emrClient /documents/patients/{args.pid}/diagnosis` |

<a id="c-components-document-documentdoctorselector"></a>

### DocumentDoctorSelector

- `restored/components/document/DocumentDoctorSelector.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsDoctorsMutation` | `PATCH emrClient /settings/doctors/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors`<br>`GET emrClient /settings/hospitals` |

<a id="c-components-document-documentdrafthistoryall"></a>

### DocumentDraftHistoryAll

- `restored/components/document/DocumentDraftHistoryAll.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsIssuedQuery` | `GET emrClient /documents/issued` |

<a id="c-components-document-documentdrafthistorypatient"></a>

### DocumentDraftHistoryPatient

- `restored/components/document/DocumentDraftHistoryPatient.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDocumentsDraftsMutation` | `DELETE emrClient /documents/drafts/{id}` |
| `useDocumentsDraftsQuery` | `GET emrClient /documents/drafts` |

<a id="c-components-document-documentherbalprescriptionselectmodal"></a>

### DocumentHerbalPrescriptionSelectModal

- `restored/components/document/DocumentHerbalPrescriptionSelectModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsHerbalPrescriptionByPidAndRidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription/{args.rid}` |
| `useDocumentsPatientsHerbalPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription` |

<a id="c-components-document-documenthistorysidebar"></a>

### DocumentHistorySidebar

- `restored/components/document/DocumentHistorySidebar.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors`<br>`GET emrClient /settings/hospitals` |
| `getDocumentsIssued_2` (직접) | `GET emrClient /documents/issued/{id}` |

<a id="c-components-document-documenthospitalenglishaddressregister"></a>

### DocumentHospitalEnglishAddressRegister

- `restored/components/document/DocumentHospitalEnglishAddressRegister.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsHospitalsMutation` | `PATCH emrClient /settings/hospitals` |

<a id="c-components-document-documenthospitalenglishnameregister"></a>

### DocumentHospitalEnglishNameRegister

- `restored/components/document/DocumentHospitalEnglishNameRegister.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsHospitalsMutation` | `PATCH emrClient /settings/hospitals` |

<a id="c-components-document-documentissuedhistory"></a>

### DocumentIssuedHistory

- `restored/components/document/DocumentIssuedHistory.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsIssuedQuery` | `GET emrClient /documents/issued` |

<a id="c-components-document-documentissueviewcontainer"></a>

### DocumentIssueViewContainer

- `restored/components/document/DocumentIssueViewContainer.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteDocumentsDraftsMutation` | `DELETE emrClient /documents/drafts/{id}` |
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `useDocumentsDraftsQuery_2` | `GET emrClient /documents/drafts/{id}` |
| `useDocumentsIssuedQuery_2` | `GET emrClient /documents/issued/{id}` |
| `useDocumentsPatientsChubyakPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/chubyak-prescription` |
| `useDocumentsPatientsDiagnosisByPidQuery` | `GET emrClient /documents/patients/{args.pid}/diagnosis` |
| `useDocumentsPatientsQuery` | `GET emrClient /documents/patients/{input}` |
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |
| `useRecordPatientQuery_2` | `GET emrClient /record/patient/{pid}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors`<br>`GET emrClient /settings/hospitals` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `postDocumentsChubyakPrescriptionGuide` (직접) | `POST emrClient /documents/chubyak-prescription-guide` |
| `postDocumentsCustomsCertificate` (직접) | `POST emrClient /documents/customs-certificate` |
| `postDocumentsFutureMedicalCostEstimate` (직접) | `POST emrClient /documents/future-medical-cost-estimate` |
| `postDocumentsGeneralHerbalPrescription` (직접) | `POST emrClient /documents/general-herbal-prescription` |
| `postDocumentsHerbalMedicineReceipt` (직접) | `POST emrClient /documents/herbal-medicine-receipt` |
| `postDocumentsInjuryCertificate` (직접) | `POST emrClient /documents/injury-certificate` |
| `postDocumentsMedicalAidExtensionApproval` (직접) | `POST emrClient /documents/medical-aid-extension-approval` |
| `postDocumentsMedicalAidReferral` (직접) | `POST emrClient /documents/medical-aid-referral` |
| `postDocumentsMedicalAidTransfer` (직접) | `POST emrClient /documents/medical-aid-transfer` |
| `postDocumentsMedicalCareBenefitReferral` (직접) | `POST emrClient /documents/medical-care-benefit-referral` |
| `postDocumentsMedicalCareBenefitTransfer` (직접) | `POST emrClient /documents/medical-care-benefit-transfer` |
| `postDocumentsMedicalCertificate` (직접) | `POST emrClient /documents/medical-certificate` |
| `postDocumentsMedicalPaymentReceipt` (직접) | `POST emrClient /documents/medical-payment-receipt` |
| `postDocumentsMedicalStatement` (직접) | `POST emrClient /documents/medical-statement` |
| `postDocumentsMedicationOpinion` (직접) | `POST emrClient /documents/medication-opinion` |
| `postDocumentsOpinion` (직접) | `POST emrClient /documents/opinion` |
| `postDocumentsOutpatientMedicalCertificate` (직접) | `POST emrClient /documents/outpatient-medical-certificate` |
| `postDocumentsPatientsHerbalMedicineReceiptByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/herbal-medicine-receipt` |
| `postDocumentsPatientsMedicalPaymentReceiptByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/medical-payment-receipt` |
| `postDocumentsPatientsMedicalStatementByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/medical-statement` |
| `postDocumentsRecord` (직접) | `POST emrClient /documents/record` |
| `postDocumentsReferralLetter` (직접) | `POST emrClient /documents/referral-letter` |
| `postDocumentsTransferOpinion` (직접) | `POST emrClient /documents/transfer-opinion` |
| `postDocumentsWorkAbilityDiagnosis` (직접) | `POST emrClient /documents/work-ability-diagnosis` |

<a id="c-components-document-documentissueviewfooter"></a>

### DocumentIssueViewFooter

- `restored/components/document/DocumentIssueViewFooter.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postDocumentsChubyakPrescriptionGuide` (직접) | `POST emrClient /documents/chubyak-prescription-guide` |
| `postDocumentsCustomsCertificate` (직접) | `POST emrClient /documents/customs-certificate` |
| `postDocumentsFutureMedicalCostEstimate` (직접) | `POST emrClient /documents/future-medical-cost-estimate` |
| `postDocumentsGeneralHerbalPrescription` (직접) | `POST emrClient /documents/general-herbal-prescription` |
| `postDocumentsHerbalMedicineReceipt` (직접) | `POST emrClient /documents/herbal-medicine-receipt` |
| `postDocumentsInjuryCertificate` (직접) | `POST emrClient /documents/injury-certificate` |
| `postDocumentsMedicalAidExtensionApproval` (직접) | `POST emrClient /documents/medical-aid-extension-approval` |
| `postDocumentsMedicalAidReferral` (직접) | `POST emrClient /documents/medical-aid-referral` |
| `postDocumentsMedicalAidTransfer` (직접) | `POST emrClient /documents/medical-aid-transfer` |
| `postDocumentsMedicalCareBenefitReferral` (직접) | `POST emrClient /documents/medical-care-benefit-referral` |
| `postDocumentsMedicalCareBenefitTransfer` (직접) | `POST emrClient /documents/medical-care-benefit-transfer` |
| `postDocumentsMedicalCertificate` (직접) | `POST emrClient /documents/medical-certificate` |
| `postDocumentsMedicalPaymentReceipt` (직접) | `POST emrClient /documents/medical-payment-receipt` |
| `postDocumentsMedicalStatement` (직접) | `POST emrClient /documents/medical-statement` |
| `postDocumentsMedicationOpinion` (직접) | `POST emrClient /documents/medication-opinion` |
| `postDocumentsOpinion` (직접) | `POST emrClient /documents/opinion` |
| `postDocumentsOutpatientMedicalCertificate` (직접) | `POST emrClient /documents/outpatient-medical-certificate` |
| `postDocumentsPatientsHerbalMedicineReceiptByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/herbal-medicine-receipt` |
| `postDocumentsPatientsMedicalPaymentReceiptByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/medical-payment-receipt` |
| `postDocumentsPatientsMedicalStatementByPid` (직접) | `POST emrClient /documents/patients/{args.pid}/medical-statement` |
| `postDocumentsRecord` (직접) | `POST emrClient /documents/record` |
| `postDocumentsReferralLetter` (직접) | `POST emrClient /documents/referral-letter` |
| `postDocumentsTransferOpinion` (직접) | `POST emrClient /documents/transfer-opinion` |
| `postDocumentsWorkAbilityDiagnosis` (직접) | `POST emrClient /documents/work-ability-diagnosis` |

<a id="c-components-document-documentissueviewformrenderer"></a>

### DocumentIssueViewFormRenderer

- `restored/components/document/DocumentIssueViewFormRenderer.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getDocumentsPhrases` (직접) | `GET emrClient /documents/phrases` |

<a id="c-components-document-documentissueviewheader"></a>

### DocumentIssueViewHeader

- `restored/components/document/DocumentIssueViewHeader.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-document-documentlatinnameinput"></a>

### DocumentLatinNameInput

- `restored/components/document/DocumentLatinNameInput.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesHerbalPharmacopoeiaQuery` | `GET emrClient /settings/references/herbal-pharmacopoeia` |

<a id="c-components-document-documentnumbereditmodal"></a>

### DocumentNumberEditModal

- `restored/components/document/DocumentNumberEditModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchChungguAfterDocumentNumberByIdMutation` | `PATCH emrClient /chunggu/after/{args.id}/document-number` |

<a id="c-components-document-documentphrasepanel"></a>

### DocumentPhrasePanel

- `restored/components/document/DocumentPhrasePanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getDocumentsPhrases` (직접) | `GET emrClient /documents/phrases` |

<a id="c-components-document-documentrecordhistory"></a>

### DocumentRecordHistory

- `restored/components/document/DocumentRecordHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordPatientQuery_2` | `GET emrClient /record/patient/{pid}` |

<a id="c-components-document-documentserialnumber"></a>

### DocumentSerialNumber

- `restored/components/document/DocumentSerialNumber.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsQuery` | `GET emrClient /documents/patients/{input}` |

<a id="c-components-document-documenttreatmentperiod"></a>

### DocumentTreatmentPeriod

- `restored/components/document/DocumentTreatmentPeriod.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getDocumentsPatientsDiagnosisByPid_2` (직접) | `GET emrClient /documents/patients/{args.pid}/diagnosis` |

<a id="components-editor"></a>

## components/editor

<a id="c-components-editor-editortemplatecard"></a>

### EditorTemplateCard

- `restored/components/editor/EditorTemplateCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteSettingsTemplatesMutation` | `DELETE emrClient /settings/templates/{input}` |

<a id="components-emr"></a>

## components/emr

<a id="c-components-emr-emrdatepicker"></a>

### EmrDatePicker

- `restored/components/emr/EmrDatePicker.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsClosedDaysQuery` | `GET emrClient /settings/closed-days/{input}` |

<a id="c-components-emr-emrpatientsviewtable"></a>

### EmrPatientsViewTable

- `restored/components/emr/EmrPatientsViewTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteCrmPatientsMutation` | `DELETE emrClient /crm/patients/{pid}` |

<a id="components-etc"></a>

## components/etc

<a id="c-components-etc-etcprescriptionspicker"></a>

### EtcPrescriptionsPicker

- `restored/components/etc/EtcPrescriptionsPicker.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="components-future"></a>

## components/future

<a id="c-components-future-futuremedicalcostestimate"></a>

### FutureMedicalCostEstimate

- `restored/components/future/FutureMedicalCostEstimate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |

<a id="components-general"></a>

## components/general

<a id="c-components-general-generalherbalprescription"></a>

### GeneralHerbalPrescription

- `restored/components/general/GeneralHerbalPrescription.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDocumentsPatientsHerbalPrescriptionByPidAndRidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription/{args.rid}` |
| `useDocumentsPatientsUnassignedHerbalPrescriptionByRidQuery` | `GET emrClient /documents/patients/unassigned/herbal-prescription/{args.rid}` |

<a id="c-components-general-generalherbalprescriptiondosage"></a>

### GeneralHerbalPrescriptionDosage

- `restored/components/general/GeneralHerbalPrescriptionDosage.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-general-generalherbalprescriptionherbeditrow"></a>

### GeneralHerbalPrescriptionHerbEditRow

- `restored/components/general/GeneralHerbalPrescriptionHerbEditRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-general-generalherbalprescriptionherbedittable"></a>

### GeneralHerbalPrescriptionHerbEditTable

- `restored/components/general/GeneralHerbalPrescriptionHerbEditTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="c-components-general-generalherbalprescriptiontreatmentdate"></a>

### GeneralHerbalPrescriptionTreatmentDate

- `restored/components/general/GeneralHerbalPrescriptionTreatmentDate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDocumentsPatientsHerbalPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription` |
| `postDocumentsGeneralHerbalPrescription` (직접) | `POST emrClient /documents/general-herbal-prescription` |

<a id="components-header"></a>

## components/header

<a id="c-components-header-headerlayout"></a>

### HeaderLayout

- `restored/components/header/HeaderLayout.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useNotificationCenterCountsQuery` | `GET syncClient /notification-center/counts` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `postSsoLinkToken` (직접) | `POST authClient /sso/link-token` |

<a id="components-health"></a>

## components/health

<a id="c-components-health-healthinsuranceeligibilitypilotchubyak"></a>

### HealthInsuranceEligibilityPilotChubyak

- `restored/components/health/HealthInsuranceEligibilityPilotChubyak.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useRecordListPcmdCountDoctorByDateAndDoctorIdQuery` | `GET emrClient /record/list/pcmd-count/{args.date}/doctor/{args.doctorId}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `getChartPcmdPatients` (직접) | `GET emrClient /chart/pcmd/patients/{pId}` |
| `postChartPcmdPatients` (직접) | `POST emrClient /chart/pcmd/patients/{pId}` |

<a id="c-components-health-healthinsuranceeligibilitypilotselect"></a>

### HealthInsuranceEligibilityPilotSelect

- `restored/components/health/HealthInsuranceEligibilityPilotSelect.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordHomeVisitCountsQuery` | `GET emrClient /record/home-visit/counts` |
| `useRecordTelemedicinePilotCountsQuery` | `GET emrClient /record/telemedicine-pilot/counts` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-health-healthinsuranceeligibilityspecialaid"></a>

### HealthInsuranceEligibilitySpecialAid

- `restored/components/health/HealthInsuranceEligibilitySpecialAid.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRareDiseases20241018JsonQuery` | `GET staticClient <RARE_DISEASES_20241018_JSON_PATH>` |

<a id="components-herb"></a>

## components/herb

<a id="c-components-herb-herbeditorsidepanel"></a>

### HerbEditorSidePanel

- `restored/components/herb/HerbEditorSidePanel.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-herb-herbtableeditor"></a>

### HerbTableEditor

- `restored/components/herb/HerbTableEditor.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="components-herbal"></a>

## components/herbal

<a id="c-components-herbal-herbalmedicinerecipttreatmentdate"></a>

### HerbalMedicineReciptTreatmentDate

- `restored/components/herbal/HerbalMedicineReciptTreatmentDate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery_2` | `GET emrClient /documents/patients/{pid}/record-date` |

<a id="c-components-herbal-herbalprescriptionunassignedissuepanel"></a>

### HerbalPrescriptionUnassignedIssuePanel

- `restored/components/herbal/HerbalPrescriptionUnassignedIssuePanel.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDocumentsPatientsUnassignedHerbalPrescriptionByRidQuery` | `GET emrClient /documents/patients/unassigned/herbal-prescription/{args.rid}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors`<br>`GET emrClient /settings/hospitals` |
| `postDocumentsGeneralHerbalPrescription` (직접) | `POST emrClient /documents/general-herbal-prescription` |

<a id="components-hira"></a>

## components/hira

<a id="c-components-hira-hirasubmititemsviewchubyakjabomodifycontent"></a>

### HiraSubmitItemsViewChubyakJaboModifyContent

- `restored/components/hira/HiraSubmitItemsViewChubyakJaboModifyContent.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `prefetchSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatchRecordPrescriptionsByIdMutation` | `PATCH emrClient /record/prescriptions/{body.id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-hira-hirasubmititemsviewchubyakjabotableactioncell"></a>

### HiraSubmitItemsViewChubyakJaboTableActionCell

- `restored/components/hira/HiraSubmitItemsViewChubyakJaboTableActionCell.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `prefetchSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-hira-hirasubmititemsviewchubyakmodifycontent"></a>

### HiraSubmitItemsViewChubyakModifyContent

- `restored/components/hira/HiraSubmitItemsViewChubyakModifyContent.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |

<a id="c-components-hira-hirasubmititemsviewchubyaktable"></a>

### HiraSubmitItemsViewChubyakTable

- `restored/components/hira/HiraSubmitItemsViewChubyakTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-hira-hirasubmititemsviewchubyaktableactioncell"></a>

### HiraSubmitItemsViewChubyakTableActionCell

- `restored/components/hira/HiraSubmitItemsViewChubyakTableActionCell.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-hira-hirasubmititemsviewchubyaktabledetailrow"></a>

### HiraSubmitItemsViewChubyakTableDetailRow

- `restored/components/hira/HiraSubmitItemsViewChubyakTableDetailRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-hira-hirasubmititemsviewchunatable"></a>

### HiraSubmitItemsViewChunaTable

- `restored/components/hira/HiraSubmitItemsViewChunaTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRecordPrescriptionsByIdMutation` | `PATCH emrClient /record/prescriptions/{body.id}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-hira-hirasubmititemsviewchunatableactioncell"></a>

### HiraSubmitItemsViewChunaTableActionCell

- `restored/components/hira/HiraSubmitItemsViewChunaTableActionCell.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-hira-hirasubmititemsviewchunatabledetailrow"></a>

### HiraSubmitItemsViewChunaTableDetailRow

- `restored/components/hira/HiraSubmitItemsViewChunaTableDetailRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-hira-hirasubmititemsviewmainchuna"></a>

### HiraSubmitItemsViewMainChuna

- `restored/components/hira/HiraSubmitItemsViewMainChuna.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="components-history"></a>

## components/history

<a id="c-components-history-historyplanusage"></a>

### HistoryPlanUsage

- `restored/components/history/HistoryPlanUsage.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSubscriptionsUsageQuery` | `GET insuranceClient /subscriptions/usage` |

<a id="components-holiday"></a>

## components/holiday

<a id="c-components-holiday-holidayprepbanner"></a>

### HolidayPrepBanner

- `restored/components/holiday/HolidayPrepBanner.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBookingProductsBookableTimesQuery` | `GET emrClient /booking/products/bookable-times` |
| `useBookingProductsQuery` | `GET emrClient /booking/products` |
| `useBookingSyncStatusQuery` | `POST emrClient /booking/sync-status` |
| `usePostBookingSsoTokenMutation` | `POST emrClient /booking/sso/token` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClinicCalendarYearQuery_2` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsHolidaysScheduleBannerQuery` | `GET emrClient /settings/holidays/schedule-banner` |

<a id="components-hospital"></a>

## components/hospital

<a id="c-components-hospital-hospitaltermsconsentscreen"></a>

### HospitalTermsConsentScreen

- `restored/components/hospital/HospitalTermsConsentScreen.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostHospitalTermsAgreementsMutation` | `POST insuranceClient /hospital/terms/agreements` |

<a id="components-injury"></a>

## components/injury

<a id="c-components-injury-injurycertificate"></a>

### InjuryCertificate

- `restored/components/injury/InjuryCertificate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |

<a id="components-inquiry"></a>

## components/inquiry

<a id="c-components-inquiry-inquirybot"></a>

### InquiryBot

- `restored/components/inquiry/InquiryBot.vue` · 스토어 `useInquiryBotStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-inquiry-inquirybotpanel"></a>

### InquiryBotPanel

- `restored/components/inquiry/InquiryBotPanel.vue` · 스토어 `useInquiryBotStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiBotLoadingTipsQuery` | `GET webClient /api/bot-loading-tips` |
| `useApiChanneltalkBetaConvoQuery` | `GET webClient /api/channeltalk/beta-convo` |
| `useApiChanneltalkBetaConvosQuery` | `GET webClient /api/channeltalk/beta-convos` |
| `useApiChanneltalkBetaMeQuery` | `GET webClient /api/channeltalk/beta-me` |

<a id="components-insurance"></a>

## components/insurance

<a id="c-components-insurance-insuranceinquiryworkbench"></a>

### InsuranceInquiryWorkbench

- `restored/components/insurance/InsuranceInquiryWorkbench.vue` · 스토어 `useSocketClientStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeletePatientsMutation` | `DELETE insuranceClient /patients/{input}` |
| `useHospitalClaimMigrationJobsCurrentQuery` | `GET insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/current` |
| `usePatchPatientsMutation` | `PATCH insuranceClient /patients/{input}` |
| `usePatientsQuery` | `GET insuranceClient /patients` |
| `usePostHospitalClaimMigrationJobsCancelMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/{input}/cancel` |
| `usePostHospitalClaimMigrationJobsConfirmMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs/{input}/confirm` |
| `usePostHospitalClaimMigrationJobsMutation` | `POST insuranceClient {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs` |
| `usePostPatientsMutation` | `POST insuranceClient /patients` |

<a id="c-components-insurance-insurancemedicinesprescriptionpicker"></a>

### InsuranceMedicinesPrescriptionPicker

- `restored/components/insurance/InsuranceMedicinesPrescriptionPicker.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHerbalApplicableDiseases20241227JsonQuery` | `GET staticClient <HERBAL_APPLICABLE_DISEASES_20241227_JSON_PATH>` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsReferencesSimpleExtractMixedQuery` | `GET emrClient settings/references/simple-extract-mixed` |

<a id="c-components-insurance-insurancepaymentmethodmodal"></a>

### InsurancePaymentMethodModal

- `restored/components/insurance/InsurancePaymentMethodModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useHospitalPaymentMethodsPartnerPayQuery` | `GET insuranceClient /hospital/payment-methods/partner-pay` |
| `usePostHospitalPaymentMethodsMutation` | `POST insuranceClient /hospital/payment-methods` |
| `usePutHospitalPaymentMethodsMutation` | `PUT insuranceClient /hospital/payment-methods` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-insurance-insurancepaymentmethodrow"></a>

### InsurancePaymentMethodRow

- `restored/components/insurance/InsurancePaymentMethodRow.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteHospitalPaymentMethodsMutation` | `DELETE insuranceClient /hospital/payment-methods` |
| `useHospitalPaymentMethodsQuery` | `GET insuranceClient /hospital/payment-methods` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSubscriptionsQuery` | `GET insuranceClient /subscriptions` |

<a id="c-components-insurance-insuranceplanchangedialog"></a>

### InsurancePlanChangeDialog

- `restored/components/insurance/InsurancePlanChangeDialog.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSubscriptionsChangePreviewQuery` | `GET insuranceClient /subscriptions/change-preview` |

<a id="c-components-insurance-insuranceplanpaymentmodal"></a>

### InsurancePlanPaymentModal

- `restored/components/insurance/InsurancePlanPaymentModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useHospitalPaymentMethodsPartnerPayQuery` | `GET insuranceClient /hospital/payment-methods/partner-pay` |
| `useHospitalPaymentMethodsQuery` | `GET insuranceClient /hospital/payment-methods` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-insurance-insurancesubscriptionmodal"></a>

### InsuranceSubscriptionModal

- `restored/components/insurance/InsuranceSubscriptionModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-intake"></a>

## components/intake

<a id="c-components-intake-intakelinksendmodal"></a>

### IntakeLinkSendModal

- `restored/components/intake/IntakeLinkSendModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostTabletIntakeLinksMutation` | `POST emrClient /tablet/intake-links` |
| `useTabletConsentDocumentTemplatesQuery` | `GET emrClient /tablet/consent-document-templates` |
| `useTabletQuestionnaireTemplatesQuery` | `GET emrClient /tablet/questionnaire-templates` |

<a id="components-kakao"></a>

## components/kakao

<a id="c-components-kakao-kakaomessagesend"></a>

### KakaoMessageSend

- `restored/components/kakao/KakaoMessageSend.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKakaoChannelsByIdQuery` | `GET crmClient /kakao/channels/{args.id}` |
| `useKakaoChannelsQuery` | `GET crmClient /kakao/channels` |
| `useMessagesCallerNumbersQuery_2` | `GET crmClient /messages/caller-numbers` |
| `useMessagesKakaoTemplatesFrequentlyUsedQuery` | `GET crmClient /messages/kakao-templates/frequently-used` |
| `usePostMessagesKakaoTemplatesPrivateAlimtalkMutation` | `POST crmClient /messages/kakao-templates/private/alimtalk` |
| `usePostMessagesKakaoTemplatesPrivateBrandMutation` | `POST crmClient /messages/kakao-templates/private/brand` |
| `usePutMessagesKakaoTemplatesUsageByIdMutation` | `PUT crmClient /messages/kakao-templates/{args.id}/usage` |

<a id="c-components-kakao-kakaomessagesendalimtalk"></a>

### KakaoMessageSendAlimTalk

- `restored/components/kakao/KakaoMessageSendAlimTalk.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesKakaoTemplatesByIdQuery` | `GET crmClient /messages/kakao-templates/{args.id}` |

<a id="components-link"></a>

## components/link

<a id="c-components-link-linksendpanel"></a>

### LinkSendPanel

- `restored/components/link/LinkSendPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHospitalSettingsTreatmentVisibilityQuery` | `GET insuranceClient /hospital/settings/treatment-visibility` |

<a id="components-lookup"></a>

## components/lookup

<a id="c-components-lookup-lookupexecutionform"></a>

### LookupExecutionForm

- `restored/components/lookup/LookupExecutionForm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHospitalSettingsChannelsQuery` | `GET insuranceClient /hospital/settings/channels` |
| `usePostIndemnityPatientsLookupLinksMutation` | `POST insuranceClient /indemnity/patients/{input}/lookup-links` |
| `usePostIndemnityPatientsLookupsCancelMutation` | `POST insuranceClient /indemnity/patients/{input}/lookups/cancel` |
| `usePostIndemnityPatientsLookupsMutation` | `POST insuranceClient /indemnity/patients/{input}/lookups` |
| `usePostIndemnityPatientsVerificationsMutation` | `POST insuranceClient /indemnity/patients/{input}/verifications` |
| `usePostIndemnityPatientsVerificationsResendMutation` | `POST insuranceClient /indemnity/patients/{input}/verifications/resend` |

<a id="components-m"></a>

## components/m

<a id="c-components-m-mcptokens"></a>

### MCPTokens

- `restored/components/m/MCPTokens.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `_hoisted_1` (직접) | `DELETE accountClient /auth/mcp-tokens/{d}` |
| `_hoisted_1` (직접) | `GET accountClient /auth/mcp-tokens` |
| `_hoisted_1` (직접) | `POST accountClient /auth/mcp-tokens` |

<a id="components-mcp"></a>

## components/mcp

<a id="c-components-mcp-mcpapprovalcontactssidepanel"></a>

### McpApprovalContactsSidePanel

- `restored/components/mcp/McpApprovalContactsSidePanel.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-mcp-mcpapprovalcontactstab"></a>

### McpApprovalContactsTab

- `restored/components/mcp/McpApprovalContactsTab.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useCrmTriggerEngineMcpApprovalsPendingQuery` | `GET emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/pending` |
| `usePatchCrmTriggerEngineMcpApprovalsMutation` | `PATCH emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/{id}` |
| `usePostCrmTriggerEngineMcpApprovalsApproveMutation` | `POST emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/{id}/approve` |
| `usePostCrmTriggerEngineMcpApprovalsRejectMutation` | `POST emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/{id}/reject` |
| `useRefusalsCodeQuery` | `GET crmClient /refusals/code` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-mcp-mcpapprovalnotestab"></a>

### McpApprovalNotesTab

- `restored/components/mcp/McpApprovalNotesTab.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `N` (직접) | `DELETE emrClient /patients/memos/{n}` |
| `N` (직접) | `GET emrClient /patients/me/pending-notes` |
| `N` (직접) | `PATCH emrClient /patients/memos/{n}` |
| `N` (직접) | `POST emrClient /patients/memos/{n}/approve` |

<a id="components-medical"></a>

## components/medical

<a id="c-components-medical-medicalaidsm3m4infodisplay"></a>

### MedicalAidsM3M4InfoDisplay

- `restored/components/medical/MedicalAidsM3M4InfoDisplay.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-medical-medicalaidsm3modifymodalcontent"></a>

### MedicalAidsM3ModifyModalContent

- `restored/components/medical/MedicalAidsM3ModifyModalContent.vue` · 스토어 `useMedicalAidsStore`, `useToastNotificationStore`, `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |
| `getRecord` (직접) | `GET emrClient /record/{input}` |

<a id="c-components-medical-medicalaidsm3sidepanelright"></a>

### MedicalAidsM3SidePanelRight

- `restored/components/medical/MedicalAidsM3SidePanelRight.vue` · 스토어 `useMedicalAidsStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |
| `getRecord` (직접) | `GET emrClient /record/{input}` |

<a id="c-components-medical-medicalaidsviewtableactionscell"></a>

### MedicalAidsViewTableActionsCell

- `restored/components/medical/MedicalAidsViewTableActionsCell.vue` · 스토어 `useMedicalAidsStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |

<a id="c-components-medical-medicalcertificate"></a>

### MedicalCertificate

- `restored/components/medical/MedicalCertificate.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-medical-medicalpaymentreceipts"></a>

### MedicalPaymentReceipts

- `restored/components/medical/MedicalPaymentReceipts.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsReceiptsQuery` | `GET emrClient /documents/patients/{pid}/receipts` |

<a id="c-components-medical-medicalrecord-2"></a>

### MedicalRecord

- `restored/components/medical/MedicalRecord-2.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSigningMedicalRecordsSignableByDoctorIdQuery` | `GET emrClient /signing/medical-records/signable/{params.doctor_id}` |

<a id="c-components-medical-medicalrecord"></a>

### MedicalRecord

- `restored/components/medical/MedicalRecord.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSigningMedicalRecordsSignedQuery` | `GET emrClient /signing/medical-records/signed` |

<a id="c-components-medical-medicalstatement"></a>

### MedicalStatement

- `restored/components/medical/MedicalStatement.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsReceiptsQuery` | `GET emrClient /documents/patients/{pid}/receipts` |

<a id="components-medication"></a>

## components/medication

<a id="c-components-medication-medicationopinion"></a>

### MedicationOpinion

- `restored/components/medication/MedicationOpinion.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsHerbalPrescriptionByPidQuery` | `GET emrClient /documents/patients/{args.pid}/herbal-prescription` |

<a id="components-members"></a>

## components/members

<a id="c-components-members-membersretrotermsgate"></a>

### MembersRetroTermsGate

- `restored/components/members/MembersRetroTermsGate.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchTermsMyAgreementsQuery` | `GET accountClient <TERMS_MY_AGREEMENTS_PATH>`<br>`POST accountClient <TERMS_AGREEMENTS_PATH>` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="components-message"></a>

## components/message

<a id="c-components-message-messageresultsdashboard"></a>

### MessageResultsDashboard

- `restored/components/message/MessageResultsDashboard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesResultsQuery` | `GET crmClient /messages/results` |

<a id="c-components-message-messageresultsdetail"></a>

### MessageResultsDetail

- `restored/components/message/MessageResultsDetail.vue` · 스토어 `useCrmMessageResultLinksStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesResultsReceiversKakaoQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}/kakao` |
| `useMessagesResultsReceiversQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}` |

<a id="c-components-message-messageresultsdetailreceivers"></a>

### MessageResultsDetailReceivers

- `restored/components/message/MessageResultsDetailReceivers.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesResultsReceiversCountQuery` | `GET crmClient /messages/results/{id}/receivers/count` |
| `usePostMessagesResultsResendMutation` | `POST crmClient /messages/results/{id}/resend` |
| `getMessagesResultsReceivers` (직접) | `GET crmClient /messages/results/{id}/receivers` |

<a id="c-components-message-messageresultsdetailsidepanel"></a>

### MessageResultsDetailSidePanel

- `restored/components/message/MessageResultsDetailSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMessagesResultsLinksByIdQuery` | `GET crmClient /messages/results/{args.id}/links` |
| `useMessagesSendGroupsQuery` | `GET crmClient /messages/send/groups/{id}` |

<a id="c-components-message-messageresultsdetailsidepanelfooter"></a>

### MessageResultsDetailSidePanelFooter

- `restored/components/message/MessageResultsDetailSidePanelFooter.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesResultsReservationMutation` | `DELETE crmClient /messages/results/{id}/reservation` |
| `useMessagesResultsReceiversCountQuery` | `GET crmClient /messages/results/{id}/receivers/count` |
| `usePatchMessagesResultsReservationMutation` | `PATCH crmClient /messages/results/{id}/reservation` |
| `usePostMessagesResultsResendMutation` | `POST crmClient /messages/results/{id}/resend` |

<a id="c-components-message-messageresultslist"></a>

### MessageResultsList

- `restored/components/message/MessageResultsList.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesResultsListDownloadMutation` | `POST crmClient /messages/results/list/download` |
| `getMessagesResultsList` (직접) | `GET crmClient /messages/results/list` |
| `getMessagesResultsListCount` (직접) | `GET crmClient /messages/results/list/count` |

<a id="c-components-message-messageresultslisttableresultcell"></a>

### MessageResultsListTableResultCell

- `restored/components/message/MessageResultsListTableResultCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesResultsReservationMutation` | `DELETE crmClient /messages/results/{id}/reservation` |

<a id="c-components-message-messageresultsreservedatconfirm"></a>

### MessageResultsReservedAtConfirm

- `restored/components/message/MessageResultsReservedAtConfirm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchMessagesResultsReservationMutation` | `PATCH crmClient /messages/results/{id}/reservation` |

<a id="c-components-message-messageviewcontactgroupmembers"></a>

### MessageViewContactGroupMembers

- `restored/components/message/MessageViewContactGroupMembers.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsGroupsByIdQuery` | `GET crmClient /contacts/groups/{args.id}` |
| `usePostContactsGroupsMembersAddMutation` | `POST crmClient /contacts/groups/{id}/members/add` |
| `usePostContactsGroupsMembersRemoveMutation` | `POST crmClient /contacts/groups/{id}/members/remove` |

<a id="c-components-message-messageviewcontactgroups"></a>

### MessageViewContactGroups

- `restored/components/message/MessageViewContactGroups.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsGroupsQuery` | `GET crmClient /contacts/groups` |
| `useDeleteContactsGroupsByIdMutation` | `DELETE crmClient /contacts/groups/{args.id}` |
| `usePostMessagesSendGroupsReceiversAddContactGroupsMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/contact-groups` |

<a id="c-components-message-messageviewcontactgroupsave"></a>

### MessageViewContactGroupSave

- `restored/components/message/MessageViewContactGroupSave.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsGroupsQuery` | `GET crmClient /contacts/groups` |
| `usePostContactsGroupsFromMessageSendGroupMutation` | `POST crmClient /contacts/groups/from-message-send-group` |
| `usePostContactsGroupsMembersAddFromMessageSendGroupMutation` | `POST crmClient /contacts/groups/members/add/from-message-send-group` |

<a id="c-components-message-messageviewexcelupload"></a>

### MessageViewExcelUpload

- `restored/components/message/MessageViewExcelUpload.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesSendGroupsReceiversMutation` | `POST crmClient messages/send/groups/{id}/receivers` |

<a id="c-components-message-messageviewpatientinput"></a>

### MessageViewPatientInput

- `restored/components/message/MessageViewPatientInput.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesSendGroupsReceiversAddEmrPatientsMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/emr-patients` |
| `usePostMessagesSendGroupsReceiversMutation` | `POST crmClient messages/send/groups/{id}/receivers` |
| `getMessagesSendGroupsReceivers` (직접) | `GET crmClient messages/send/groups/{id}/receivers` |

<a id="c-components-message-messageviewreceivers"></a>

### MessageViewReceivers

- `restored/components/message/MessageViewReceivers.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteMessagesSendGroupsReceiversMutation` | `DELETE crmClient /messages/send/groups/{id}/receivers` |
| `useMessagesSendGroupsReceiversCountQuery` | `GET crmClient /messages/send/groups/{id}/receivers/count` |
| `useMessagesSendGroupsReceiversDuplicatesQuery` | `GET crmClient /messages/send/groups/{id}/receivers/duplicates` |
| `usePostMessagesSendGroupsReceiversAddAllMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/all` |
| `usePostMessagesSendGroupsReceiversDuplicatesHandleMutation` | `POST crmClient /messages/send/groups/{id}/receivers/duplicates/handle` |

<a id="c-components-message-messageviewreceiverstable"></a>

### MessageViewReceiversTable

- `restored/components/message/MessageViewReceiversTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMessagesSendGroupsReceivers` (직접) | `GET crmClient messages/send/groups/{id}/receivers` |

<a id="c-components-message-messageviewreceiverstableactioncell"></a>

### MessageViewReceiversTableActionCell

- `restored/components/message/MessageViewReceiversTableActionCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMessagesSendGroupsReceiversDuplicatesHandleMutation` | `POST crmClient /messages/send/groups/{id}/receivers/duplicates/handle` |
| `usePostMessagesSendGroupsReceiversRemoveMutation` | `POST crmClient /messages/send/groups/{id}/receivers/remove` |

<a id="c-components-message-messageviewreceiverstableduplicate"></a>

### MessageViewReceiversTableDuplicate

- `restored/components/message/MessageViewReceiversTableDuplicate.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMessagesSendGroupsReceiversDuplicates` (직접) | `GET crmClient /messages/send/groups/{id}/receivers/duplicates` |

<a id="c-components-message-messageviewrecentconditions"></a>

### MessageViewRecentConditions

- `restored/components/message/MessageViewRecentConditions.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsFiltersQuery` | `GET crmClient /contacts/filters` |
| `useDeleteContactsFiltersRecentUsageMutation` | `DELETE crmClient /contacts/filters/recent-usage` |

<a id="c-components-message-messageviewsearchconditionsmodal"></a>

### MessageViewSearchConditionsModal

- `restored/components/message/MessageViewSearchConditionsModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsFiltersQuery` | `GET crmClient /contacts/filters` |

<a id="c-components-message-messageviewsearchconditionssaveconfirm"></a>

### MessageViewSearchConditionsSaveConfirm

- `restored/components/message/MessageViewSearchConditionsSaveConfirm.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostContactsFiltersMutation` | `POST crmClient /contacts/filters` |

<a id="c-components-message-messageviewsearchfilterconditions"></a>

### MessageViewSearchFilterConditions

- `restored/components/message/MessageViewSearchFilterConditions.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostContactsFiltersUseByIdMutation` | `POST crmClient /contacts/filters/{args.id}/use` |
| `usePostMessagesSendGroupsReceiversAddFiltersMutation` | `POST crmClient messages/send/groups/{id}/receivers/add/filters` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |

<a id="c-components-message-messageviewsend"></a>

### MessageViewSend

- `restored/components/message/MessageViewSend.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingInvoicesUnitPricesQuery` | `GET crmClient /billing/invoices/unit-prices` |
| `useMessagesSendGroupsEstimateQuery` | `POST crmClient /messages/send/groups/{id}/estimate` |

<a id="components-mobile"></a>

## components/mobile

<a id="c-components-mobile-mobilegnb"></a>

### MobileGnb

- `restored/components/mobile/MobileGnb.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |

<a id="components-moxa"></a>

## components/moxa

<a id="c-components-moxa-moxacuppingcupselector"></a>

### MoxaCuppingCupSelector

- `restored/components/moxa/MoxaCuppingCupSelector.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="components-naver"></a>

## components/naver

<a id="c-components-naver-naverreservationdetail"></a>

### NaverReservationDetail

- `restored/components/naver/NaverReservationDetail.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-naver-naverreservationhistory"></a>

### NaverReservationHistory

- `restored/components/naver/NaverReservationHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsHistoryQuery` | `GET emrClient /desk/appointments/{input}/history` |
| `useDeskBookingRequestsHistoriesQuery` | `GET emrClient /desk/booking-requests/{input}/histories` |

<a id="c-components-naver-naverreservationpanel"></a>

### NaverReservationPanel

- `restored/components/naver/NaverReservationPanel.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useBookingSyncStatusQuery` | `POST emrClient /booking/sync-status` |
| `usePostDeskBookingRequestsConfirmMutation` | `POST emrClient /desk/booking-requests/confirm` |
| `usePostDeskBookingRequestsRejectMutation` | `POST emrClient /desk/booking-requests/reject` |

<a id="c-components-naver-naversignmodal"></a>

### NaverSignModal

- `restored/components/naver/NaverSignModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchUsersMutation` | `PATCH accountClient /users/{userId}` |
| `usePostSigningDailyCopaymentLedgersRequestMutation` | `POST emrClient /signing/daily-copayment-ledgers/request` |
| `usePostSigningFinishByIdMutation` | `POST emrClient /signing/{args.id}/finish` |
| `usePostSigningMedicalRecordsRequestMutation` | `POST emrClient /signing/medical-records/request` |
| `useSigningStatusByIdQuery` | `GET emrClient /signing/{args.id}/status` |
| `useUsersQuery` | `GET accountClient /users` |

<a id="components-nonbenefit"></a>

## components/nonBenefit

<a id="c-components-nonbenefit-nonbenefitpackagereservedrow"></a>

### NonBenefitPackageReservedRow

- `restored/components/nonBenefit/NonBenefitPackageReservedRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `$r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}/favorite` |

<a id="c-components-nonbenefit-nonbenefitpatientsviewcancelledtelemedicinemodal"></a>

### NonBenefitPatientsViewCancelledTelemedicineModal

- `restored/components/nonBenefit/NonBenefitPatientsViewCancelledTelemedicineModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMembersEmrOrders` (직접) | `GET liteClient members/emr/orders/{input}` |

<a id="c-components-nonbenefit-nonbenefitpatientsviewtable"></a>

### NonBenefitPatientsViewTable

- `restored/components/nonBenefit/NonBenefitPatientsViewTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchCrmNonbenefitPatientsRestartMutation` | `PATCH emrClient /crm/nonbenefit-patients/restart` |
| `usePatchCrmNonbenefitPatientsTerminateMutation` | `PATCH emrClient /crm/nonbenefit-patients/terminate` |

<a id="c-components-nonbenefit-nonbenefitpatientsviewtelemedicinebanner"></a>

### NonBenefitPatientsViewTelemedicineBanner

- `restored/components/nonBenefit/NonBenefitPatientsViewTelemedicineBanner.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsTelemedicineQuery` | `GET emrClient /desk/appointments/telemedicine` |

<a id="c-components-nonbenefit-nonbenefitpatientsviewtelemedicinememo"></a>

### NonBenefitPatientsViewTelemedicineMemo

- `restored/components/nonBenefit/NonBenefitPatientsViewTelemedicineMemo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsMemosCountQuery` | `GET emrClient /patients/{input}/memos/count` |
| `usePatientsMemosQuery` | `GET emrClient /patients/{id}/memos` |
| `usePostPatientsMemosMutation` | `POST emrClient /patients/{pid}/memos` |

<a id="c-components-nonbenefit-nonbenefitpatientsviewtelemedicinemodal"></a>

### NonBenefitPatientsViewTelemedicineModal

- `restored/components/nonBenefit/NonBenefitPatientsViewTelemedicineModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMembersEmrOrdersQuery` | `GET liteClient members/emr/orders/{input}` |
| `usePatchDeskTelemedicineConsultationsStatusMutation` | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-nonbenefit-nonbenefitprescriptionpicker"></a>

### NonBenefitPrescriptionPicker

- `restored/components/nonBenefit/NonBenefitPrescriptionPicker.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |

<a id="c-components-nonbenefit-nonbenefitprescriptionquantitywithfeepopover"></a>

### NonBenefitPrescriptionQuantityWithFeePopover

- `restored/components/nonBenefit/NonBenefitPrescriptionQuantityWithFeePopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |

<a id="c-components-nonbenefit-nonbenefitprescriptiontable"></a>

### NonBenefitPrescriptionTable

- `restored/components/nonBenefit/NonBenefitPrescriptionTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsNonbenefitsV2Mutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}` |

<a id="components-normal"></a>

## components/normal

<a id="c-components-normal-normalopinion"></a>

### NormalOpinion

- `restored/components/normal/NormalOpinion.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="components-notification"></a>

## components/notification

<a id="c-components-notification-notificationsettingmodal"></a>

### NotificationSettingModal

- `restored/components/notification/NotificationSettingModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePutSettingsNotificationsMutation` | `PUT emrClient <SETTINGS_NOTIFICATIONS_PATH>` |
| `useSettingsNotificationsQuery` | `GET emrClient <SETTINGS_NOTIFICATIONS_PATH>` |

<a id="components-ocs"></a>

## components/ocs

<a id="c-components-ocs-ocsviewcontent"></a>

### OcsViewContent

- `restored/components/ocs/OcsViewContent.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `useOcsListStatsQuery` | `GET emrClient /ocs/list/stats` |

<a id="c-components-ocs-ocsviewlist"></a>

### OcsViewList

- `restored/components/ocs/OcsViewList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsListQuery` | `GET emrClient /ocs/list` |

<a id="c-components-ocs-ocsviewlisttable"></a>

### OcsViewListTable

- `restored/components/ocs/OcsViewListTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchOcsDeliveryMutation` | `PATCH emrClient /ocs/{ocsId}/delivery` |
| `usePatchOcsTakingMutation` | `PATCH emrClient /ocs/{ocsId}/taking` |

<a id="c-components-ocs-ocsviewlisttabledetailrow"></a>

### OcsViewListTableDetailRow

- `restored/components/ocs/OcsViewListTableDetailRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |

<a id="c-components-ocs-ocsviewlisttabledispensingstatuscell"></a>

### OcsViewListTableDispensingStatusCell

- `restored/components/ocs/OcsViewListTableDispensingStatusCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |

<a id="c-components-ocs-ocsviewlisttableprescriptionsidepanel"></a>

### OcsViewListTablePrescriptionSidePanel

- `restored/components/ocs/OcsViewListTablePrescriptionSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |
| `getOcsList` (직접) | `GET emrClient /ocs/list` |

<a id="c-components-ocs-ocsviewlisttablereceivetypecell"></a>

### OcsViewListTableReceiveTypeCell

- `restored/components/ocs/OcsViewListTableReceiveTypeCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatchOcsDeliveryMutation` | `PATCH emrClient /ocs/{ocsId}/delivery` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |

<a id="c-components-ocs-ocsviewlisttablereceivetypedelivery"></a>

### OcsViewListTableReceiveTypeDelivery

- `restored/components/ocs/OcsViewListTableReceiveTypeDelivery.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDeskAddressesMutation` | `PATCH emrClient /desk/addresses/{input}` |
| `usePostDeskAddressesDeleteMutation` | `POST emrClient /desk/addresses/delete/{input}` |
| `usePostDeskAddressesMutation` | `POST emrClient /desk/addresses/{input}` |

<a id="c-components-ocs-ocsviewprescriptionbasicinfo"></a>

### OcsViewPrescriptionBasicInfo

- `restored/components/ocs/OcsViewPrescriptionBasicInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-ocs-ocsviewprescriptionhistorylist"></a>

### OcsViewPrescriptionHistoryList

- `restored/components/ocs/OcsViewPrescriptionHistoryList.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsListQuery` | `GET emrClient /ocs/list` |

<a id="c-components-ocs-ocsviewprescriptionhistorylistitem"></a>

### OcsViewPrescriptionHistoryListItem

- `restored/components/ocs/OcsViewPrescriptionHistoryListItem.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |

<a id="c-components-ocs-ocsviewprescriptionocsdictionary"></a>

### OcsViewPrescriptionOcsDictionary

- `restored/components/ocs/OcsViewPrescriptionOcsDictionary.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsDictionariesCategoriesQuery` | `GET emrClient /ocs/dictionaries/categories` |
| `useOcsDictionariesQuery` | `GET emrClient /ocs/dictionaries` |
| `useSettingsReferenceFormulasSearchQuery_2` | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |

<a id="c-components-ocs-ocsviewprescriptionpanel"></a>

### OcsViewPrescriptionPanel

- `restored/components/ocs/OcsViewPrescriptionPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="components-ocsv2"></a>

## components/ocsV2

<a id="c-components-ocsv2-ocsv2decoctionorderasideaccordion"></a>

### OcsV2DecoctionOrderAsideAccordion

- `restored/components/ocsV2/OcsV2DecoctionOrderAsideAccordion.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingPaymentMethodsQuery` | `GET crmClient /billing/payment-methods` |
| `useDeleteOcsv2DraftsMutation` | `DELETE emrClient {u}/drafts/{draftId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `useOcsv2ContractQuery` | `GET emrClient {u}/contract` |
| `useOcsv2DispensaryQuery` | `GET emrClient /ocsv2/dispensary` |
| `useOcsv2DraftsQuery` | `GET emrClient {u}/drafts` |
| `useOcsv2DraftsSnapshotsQuery` | `GET emrClient {u}/drafts/{input}/snapshots` |
| `useOcsv2HerbsSearchQuery` | `POST emrClient {u}/herbs/search` |
| `useOcsv2OrderOptionsQuery` | `GET emrClient {u}/order-options` |
| `useOcsv2OrdersStatusQuery` | `GET emrClient {u}/orders/{input}/status` |
| `usePatchOcsv2DraftsMutation` | `PATCH emrClient {u}/drafts/{draftId}` |
| `usePatientsListQuery` | `GET emrClient /patients/list` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostOcsv2DraftsMutation` | `POST emrClient {u}/drafts` |
| `usePostOcsv2OrderMutation` | `POST emrClient {u}/order` |
| `usePostOcsv2QuoteMutation` | `POST emrClient {u}/quote` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |
| `useTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `getSettingsReferenceFormulasSearch` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `getOcsv2Drafts_2` (직접) | `GET emrClient {u}/drafts/{input}` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |
| `postOcsv2DraftsMedicationGuide` (직접) | `POST emrClient {u}/drafts/{input}/medication-guide` |
| `postOcsv2Precheck` (직접) | `POST emrClient {u}/precheck` |
| `postOcsv2PricePreview` (직접) | `POST emrClient {u}/price-preview` |

<a id="c-components-ocsv2-ocsv2decoctionorderdispensinginline"></a>

### OcsV2DecoctionOrderDispensingInline

- `restored/components/ocsV2/OcsV2DecoctionOrderDispensingInline.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-ocsv2-ocsv2decoctionordershippinginline"></a>

### OcsV2DecoctionOrderShippingInline

- `restored/components/ocsV2/OcsV2DecoctionOrderShippingInline.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsv2SamedayClassifyQuery` | `POST emrClient {u}/sameday/classify` |
| `useRootQuery` | `GET jusoClient ` |
| `getDeskAddresses` (직접) | `GET emrClient /desk/addresses/{input}` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |

<a id="c-components-ocsv2-ocsv2medicationguideeditmodal"></a>

### OcsV2MedicationGuideEditModal

- `restored/components/ocsV2/OcsV2MedicationGuideEditModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useOcsv2ContractQuery` | `GET emrClient {u}/contract` |
| `useOcsv2DispensaryQuery` | `GET emrClient /ocsv2/dispensary` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-ocsv2-ocsv2ordercreatedispensingsection"></a>

### OcsV2OrderCreateDispensingSection

- `restored/components/ocsV2/OcsV2OrderCreateDispensingSection.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-ocsv2-ocsv2ordercreateherbdictionarycard"></a>

### OcsV2OrderCreateHerbDictionaryCard

- `restored/components/ocsV2/OcsV2OrderCreateHerbDictionaryCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |

<a id="c-components-ocsv2-ocsv2ordercreatemedicationguidepreviewmodal"></a>

### OcsV2OrderCreateMedicationGuidePreviewModal

- `restored/components/ocsV2/OcsV2OrderCreateMedicationGuidePreviewModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useOcsv2ContractQuery` | `GET emrClient {u}/contract` |
| `useOcsv2DispensaryQuery` | `GET emrClient /ocsv2/dispensary` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-ocsv2-ocsv2ordercreateshippingcard"></a>

### OcsV2OrderCreateShippingCard

- `restored/components/ocsV2/OcsV2OrderCreateShippingCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsv2SamedayClassifyQuery` | `POST emrClient {u}/sameday/classify` |
| `useRootQuery` | `GET jusoClient ` |
| `getDeskAddresses` (직접) | `GET emrClient /desk/addresses/{input}` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |

<a id="c-components-ocsv2-ocsv2ordercreatesnippettextarea"></a>

### OcsV2OrderCreateSnippetTextArea

- `restored/components/ocsV2/OcsV2OrderCreateSnippetTextArea.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-ocsv2-ocsv2ordercreatetaxinvoicecard"></a>

### OcsV2OrderCreateTaxInvoiceCard

- `restored/components/ocsV2/OcsV2OrderCreateTaxInvoiceCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-ocsv2-ocsv2orderlistmedicationguidemodal"></a>

### OcsV2OrderListMedicationGuideModal

- `restored/components/ocsV2/OcsV2OrderListMedicationGuideModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsv2ContractQuery` | `GET emrClient {u}/contract` |
| `useOcsv2DispensaryQuery` | `GET emrClient /ocsv2/dispensary` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `getOcsv2DraftsMedicationGuide` (직접) | `GET emrClient {u}/drafts/{input}/medication-guide` |

<a id="components-onboarding"></a>

## components/onboarding

<a id="c-components-onboarding-onboardingguidepanel"></a>

### OnboardingGuidePanel

- `restored/components/onboarding/OnboardingGuidePanel.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePutSettingsOnboardingGuideProgressMutation` | `PUT emrClient /settings/onboarding-guide/progress` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-ondang"></a>

## components/ondang

<a id="c-components-ondang-ondangcontractrequiredmodal"></a>

### OndangContractRequiredModal

- `restored/components/ondang/OndangContractRequiredModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |

<a id="c-components-ondang-ondangsignupstepaccount"></a>

### OndangSignUpStepAccount

- `restored/components/ondang/OndangSignUpStepAccount.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |

<a id="c-components-ondang-ondangsignupstepterms"></a>

### OndangSignUpStepTerms

- `restored/components/ondang/OndangSignUpStepTerms.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsQuery` | `GET accountApplicationClient /terms` |

<a id="components-outpatient"></a>

## components/outpatient

<a id="c-components-outpatient-outpatientmedicalcertificate"></a>

### OutpatientMedicalCertificate

- `restored/components/outpatient/OutpatientMedicalCertificate.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsDiagnosisByPidQuery` | `GET emrClient /documents/patients/{args.pid}/diagnosis` |

<a id="components-package"></a>

## components/package

<a id="c-components-package-packagereviewsidepanel"></a>

### PackageReviewSidePanel

- `restored/components/package/PackageReviewSidePanel.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `br` (직접) | `DELETE emrClient /settings/nonbenefit-packages/{t}` |
| `Cr` (직접) | `PATCH emrClient /settings/nonbenefit-package-groups/{t}` |
| `_r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}` |
| `kr` (직접) | `POST emrClient /settings/nonbenefit-package-groups` |

<a id="components-password"></a>

## components/password

<a id="c-components-password-passwordresetnoticehost"></a>

### PasswordResetNoticeHost

- `restored/components/password/PasswordResetNoticeHost.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostUsersPasswordMutation` | `POST accountClient /users/{userId}/password` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-patient"></a>

## components/patient

<a id="c-components-patient-patientaddmodal"></a>

### PatientAddModal

- `restored/components/patient/PatientAddModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsSearchQuery` | `GET insuranceClient /patients/search` |

<a id="c-components-patient-patientautocompletesearchcrm"></a>

### PatientAutoCompleteSearchCrm

- `restored/components/patient/PatientAutoCompleteSearchCrm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsPatientsQuery` | `GET crmClient /contacts/patients` |

<a id="c-components-patient-patientcard"></a>

### PatientCard

- `restored/components/patient/PatientCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-patient-patientcardappointment"></a>

### PatientCardAppointment

- `restored/components/patient/PatientCardAppointment.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-patient-patientcarddetail"></a>

### PatientCardDetail

- `restored/components/patient/PatientCardDetail.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostTreatmentsActingsNeedleRemovalsMutation` | `POST emrClient /treatments/actings/needle-removals` |
| `useTreatmentsActingsNeedleRemovalsQuery` | `GET emrClient /treatments/actings/needle-removals/{id}` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-patient-patientcardfolded"></a>

### PatientCardFolded

- `restored/components/patient/PatientCardFolded.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-patient-patientcardfoldedappointment"></a>

### PatientCardFoldedAppointment

- `restored/components/patient/PatientCardFoldedAppointment.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="c-components-patient-patientcarhistorymodal"></a>

### PatientCarHistoryModal

- `restored/components/patient/PatientCarHistoryModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |

<a id="c-components-patient-patientdeposithistorypanel"></a>

### PatientDepositHistoryPanel

- `restored/components/patient/PatientDepositHistoryPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteDeskPrepaidChargesMutation` | `DELETE emrClient /desk/prepaid/charges/{chargeId}` |
| `useDeleteDeskPrepaidRefundsMutation` | `DELETE emrClient /desk/prepaid/refunds/{refundId}` |
| `useDeskPrepaidChartsTransactionsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}/transactions` |

<a id="c-components-patient-patientdepositrefundmodal"></a>

### PatientDepositRefundModal

- `restored/components/patient/PatientDepositRefundModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useUsersQuery` | `GET accountClient /users` |

<a id="c-components-patient-patientdetailpanel"></a>

### PatientDetailPanel

- `restored/components/patient/PatientDetailPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery_2` | `GET insuranceClient /patients/{input}` |

<a id="c-components-patient-patienthealthinsuranceeligibilitytable"></a>

### PatientHealthInsuranceEligibilityTable

- `restored/components/patient/PatientHealthInsuranceEligibilityTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePostNhicM2GetDataMutation` | `POST emrClient /nhic/m2/get-data` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-patient-patienthero"></a>

### PatientHero

- `restored/components/patient/PatientHero.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useGetRecordPatientLatestMutation` | `GET emrClient /record/patient/{input}/latest` |

<a id="c-components-patient-patientinfo"></a>

### PatientInfo

- `restored/components/patient/PatientInfo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useNotiInstructionsQuery` | `GET emrClient /noti/instructions/{pid}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-patient-patientinfoappointmenthistory"></a>

### PatientInfoAppointmentHistory

- `restored/components/patient/PatientInfoAppointmentHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |
| `usePatientsAppointmentsHistoryQuery` | `GET emrClient /patients/{id}/appointments/history` |
| `usePatientsAppointmentsInfoQuery` | `GET emrClient /patients/{id}/appointments/info` |
| `usePatientsAppointmentsSummaryQuery` | `GET emrClient /patients/{id}/appointments/summary` |

<a id="c-components-patient-patientinfoappointmenthistorycard"></a>

### PatientInfoAppointmentHistoryCard

- `restored/components/patient/PatientInfoAppointmentHistoryCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |

<a id="c-components-patient-patientinfocarvisitsummary"></a>

### PatientInfoCarVisitSummary

- `restored/components/patient/PatientInfoCarVisitSummary.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartCarPcmdPatientsQuery` | `GET emrClient /chart/car-pcmd/patients/{pId}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartCarPcmdPatientsMutation` | `POST emrClient /chart/car-pcmd/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-patient-patientinfoconsentdocumentrenderer"></a>

### PatientInfoConsentDocumentRenderer

- `restored/components/patient/PatientInfoConsentDocumentRenderer.vue.js`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsConsentHistoryQuery_2` | `GET emrClient /patients/{input}/consent-history/{input_2}` |

<a id="c-components-patient-patientinfoconsenthistory"></a>

### PatientInfoConsentHistory

- `restored/components/patient/PatientInfoConsentHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsConsentHistoryQuery` | `GET emrClient /patients/{input}/consent-history` |

<a id="c-components-patient-patientinfodepositchargemodal"></a>

### PatientInfoDepositChargeModal

- `restored/components/patient/PatientInfoDepositChargeModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useUsersQuery` | `GET accountClient /users` |

<a id="c-components-patient-patientinfodetail"></a>

### PatientInfoDetail

- `restored/components/patient/PatientInfoDetail.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsWaitingLatestQuery` | `GET emrClient /patients/{id}/waiting/latest` |

<a id="c-components-patient-patientinfodetailrecordslistlastrecordmedicines"></a>

### PatientInfoDetailRecordsListLastRecordMedicines

- `restored/components/patient/PatientInfoDetailRecordsListLastRecordMedicines.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |

<a id="c-components-patient-patientinfofamilymember"></a>

### PatientInfoFamilyMember

- `restored/components/patient/PatientInfoFamilyMember.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |

<a id="c-components-patient-patientinfopackagecontainer"></a>

### PatientInfoPackageContainer

- `restored/components/patient/PatientInfoPackageContainer.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `uf` (직접) | `DELETE emrClient /patients/{t}/packages/{n}` |
| `Ol` (직접) | `GET emrClient /patients/{t}/packages` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `af` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/revive` |

<a id="c-components-patient-patientinfoquestionnairehistory"></a>

### PatientInfoQuestionnaireHistory

- `restored/components/patient/PatientInfoQuestionnaireHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuestionnaireHistoryQuery` | `GET emrClient /patients/{input}/questionnaire-history` |
| `usePatientsQuestionnaireHistoryQuery_2` | `GET emrClient /patients/{input}/questionnaire-history/{input_2}` |
| `usePatientsQuestionnaireTrendsQuery` | `GET emrClient /patients/{input}/questionnaire-trends` |

<a id="c-components-patient-patientinforeceiptcontainer"></a>

### PatientInfoReceiptContainer

- `restored/components/patient/PatientInfoReceiptContainer.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskPrepaidChartsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}` |
| `useDeskReceiptsPatientsTreatmentsQuery` | `GET emrClient /desk/receipts/patients/{id}/treatments` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePatientsReceiptsDetailsQuery` | `GET emrClient /patients/{id}/receipts-details` |
| `usePatientsV2ChartMedicalReceiptsQuery` | `GET emrClient /patients/v2/chart/{input}/medical-receipts` |
| `usePostDeskPrepaidChartsChargesMutation` | `POST emrClient /desk/prepaid/charts/{chartId}/charges` |
| `usePostDeskPrepaidChartsRefundsMutation` | `POST emrClient /desk/prepaid/charts/{chartId}/refunds` |
| `usePostDeskV2ReceiptsMutation` | `POST emrClient /desk/v2/receipts` |

<a id="c-components-patient-patientinforeferrer"></a>

### PatientInfoReferrer

- `restored/components/patient/PatientInfoReferrer.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |

<a id="c-components-patient-patientinfotreatment"></a>

### PatientInfoTreatment

- `restored/components/patient/PatientInfoTreatment.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-patient-patientmemo"></a>

### PatientMemo

- `restored/components/patient/PatientMemo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsMemosCountQuery` | `GET emrClient /patients/{input}/memos/count` |
| `usePatientsMemosQuery` | `GET emrClient /patients/{id}/memos` |

<a id="c-components-patient-patientmemolistitem"></a>

### PatientMemoListItem

- `restored/components/patient/PatientMemoListItem.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsMemosMutation` | `PATCH emrClient /patients/{id}/memos/{memoId}` |

<a id="c-components-patient-patientmemonewmemo"></a>

### PatientMemoNewMemo

- `restored/components/patient/PatientMemoNewMemo.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostPatientsMemosMutation` | `POST emrClient /patients/{pid}/memos` |

<a id="c-components-patient-patientmemotoolbar"></a>

### PatientMemoToolbar

- `restored/components/patient/PatientMemoToolbar.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeletePatientsMemosMutation` | `DELETE emrClient /patients/{id}/memos/{memoId}` |
| `usePatchPatientsMemosMutation` | `PATCH emrClient /patients/{id}/memos/{memoId}` |

<a id="c-components-patient-patientpackagecard"></a>

### PatientPackageCard

- `restored/components/patient/PatientPackageCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |

<a id="c-components-patient-patientpackagedetail"></a>

### PatientPackageDetail

- `restored/components/patient/PatientPackageDetail.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `uf` (직접) | `DELETE emrClient /patients/{t}/packages/{n}` |
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |
| `af` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/revive` |

<a id="c-components-patient-patientpackageexpirationhistorypopover"></a>

### PatientPackageExpirationHistoryPopover

- `restored/components/patient/PatientPackageExpirationHistoryPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Ll` (직접) | `GET emrClient /patients/{t}/packages/{n}/expiration-history` |

<a id="c-components-patient-patientpackageexpirationmodal"></a>

### PatientPackageExpirationModal

- `restored/components/patient/PatientPackageExpirationModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |
| `rf` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/expiration` |

<a id="c-components-patient-patientpackagepanel"></a>

### PatientPackagePanel

- `restored/components/patient/PatientPackagePanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `xr` (직접) | `GET emrClient /settings/nonbenefit-packages` |

<a id="c-components-patient-patientpackageterminatemodal"></a>

### PatientPackageTerminateModal

- `restored/components/patient/PatientPackageTerminateModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `sf` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/terminate` |

<a id="c-components-patient-patientpackageusagehistorytable"></a>

### PatientPackageUsageHistoryTable

- `restored/components/patient/PatientPackageUsageHistoryTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `cf` (직접) | `DELETE emrClient /patients/{t}/packages/{n}/usage/{e}` |
| `of` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/usage-records/{e}/cancel` |
| `lf` (직접) | `PATCH emrClient /patients/{t}/packages/{n}/usage/{e}/revive` |

<a id="c-components-patient-patientprofileavatarbyid"></a>

### PatientProfileAvatarById

- `restored/components/patient/PatientProfileAvatarById.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-patient-patientprofileavatarupload"></a>

### PatientProfileAvatarUpload

- `restored/components/patient/PatientProfileAvatarUpload.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `postSettingsImagesPrivate` (직접) | `POST emrClient /settings/images/private` |

<a id="c-components-patient-patientreceiptdeletemodal"></a>

### PatientReceiptDeleteModal

- `restored/components/patient/PatientReceiptDeleteModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskReceiptsDetailsMutation` | `DELETE emrClient /desk/receipts/details/{id}` |
| `useDeleteDeskReceiptsDetailsPaymentGroupsMutation` | `DELETE emrClient /desk/receipts/details/payment-groups/{id}` |
| `useDeskReceiptsDetailsPaymentGroupsQuery` | `GET emrClient /desk/receipts/details/payment-groups/{id}` |

<a id="c-components-patient-patientreceiptdetailpanel"></a>

### PatientReceiptDetailPanel

- `restored/components/patient/PatientReceiptDetailPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordQuery` | `GET emrClient /record/{input}` |

<a id="c-components-patient-patientreceipteditmodal"></a>

### PatientReceiptEditModal

- `restored/components/patient/PatientReceiptEditModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDeskReceiptsDetailsMutation` | `PATCH emrClient /desk/receipts/details/{id}` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-patient-patientreceiptrefundeditmodal"></a>

### PatientReceiptRefundEditModal

- `restored/components/patient/PatientReceiptRefundEditModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDeskReceiptsDetailsMutation` | `PATCH emrClient /desk/receipts/details/{id}` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-patient-patientreceiptrefundmodal"></a>

### PatientReceiptRefundModal

- `restored/components/patient/PatientReceiptRefundModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskReceiptsDetailsPaymentGroupsQuery` | `GET emrClient /desk/receipts/details/payment-groups/{id}` |
| `usePostDeskReceiptsDetailsPaymentGroupsRefundByGroupIdMutation` | `POST emrClient /desk/receipts/details/payment-groups/{body.groupId}/refund` |
| `usePostDeskReceiptsDetailsRefundByIdMutation` | `POST emrClient /desk/receipts/details/{body.id}/refund` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-patient-patientreceiptselectmodal"></a>

### PatientReceiptSelectModal

- `restored/components/patient/PatientReceiptSelectModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskReceiptsRecordsReceiptsDetailsQuery` | `GET emrClient /desk/receipts/records/{id}/receipts-details` |

<a id="c-components-patient-patientrecord"></a>

### PatientRecord

- `restored/components/patient/PatientRecord.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |
| `useDocumentsPatientsRecordQuery` | `GET emrClient /documents/patients/{pid}/record` |

<a id="c-components-patient-patientsearch"></a>

### PatientSearch

- `restored/components/patient/PatientSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery_2` | `GET emrClient /patients/list` |

<a id="c-components-patient-patientsearchdropdowncrm"></a>

### PatientSearchDropDownCrm

- `restored/components/patient/PatientSearchDropDownCrm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useContactsPatientsQuery` | `GET crmClient /contacts/patients` |

<a id="c-components-patient-patientsearchdropdownemr"></a>

### PatientSearchDropDownEmr

- `restored/components/patient/PatientSearchDropDownEmr.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery` | `GET emrClient /patients/list` |

<a id="c-components-patient-patientsminidashboard"></a>

### PatientsMiniDashboard

- `restored/components/patient/PatientsMiniDashboard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsByValueQuery` | `GET emrClient <"/desk/appointments?date=" + args.value>` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-patient-patientsstatusappointments"></a>

### PatientsStatusAppointments

- `restored/components/patient/PatientsStatusAppointments.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsByValueQuery` | `GET emrClient <"/desk/appointments?date=" + args.value>` |
| `getDeskAppointments진료` (직접) | `GET emrClient /desk/appointments/{input}/진료` |

<a id="c-components-patient-patienttable"></a>

### PatientTable

- `restored/components/patient/PatientTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguAfterQuery_2` | `GET emrClient /chunggu/after/{id}` |

<a id="c-components-patient-patienttreatmentcostdetail"></a>

### PatientTreatmentCostDetail

- `restored/components/patient/PatientTreatmentCostDetail.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDeskReceiptsTreatmentsLossCostsDeleteMutation` | `POST emrClient /desk/receipts/treatments/loss-costs/delete` |

<a id="components-payment"></a>

## components/payment

<a id="c-components-payment-paymentcalculator"></a>

### PaymentCalculator

- `restored/components/payment/PaymentCalculator.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskPrepaidChartsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}` |
| `usePostDeskPrepaidChartsChargesMutation` | `POST emrClient /desk/prepaid/charts/{chartId}/charges` |
| `usePostDeskPrepaidChartsRefundsMutation` | `POST emrClient /desk/prepaid/charts/{chartId}/refunds` |

<a id="c-components-payment-paymentcolumn"></a>

### PaymentColumn

- `restored/components/payment/PaymentColumn.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |

<a id="c-components-payment-paymentcompletecolumn"></a>

### PaymentCompleteColumn

- `restored/components/payment/PaymentCompleteColumn.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |

<a id="components-personal"></a>

## components/personal

<a id="c-components-personal-personalformulaherbrowseditor"></a>

### PersonalFormulaHerbRowsEditor

- `restored/components/personal/PersonalFormulaHerbRowsEditor.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsChubyakPilotsHerbsQuery` | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="components-planner"></a>

## components/planner

<a id="c-components-planner-plannerdragblockingdialog"></a>

### PlannerDragBlockingDialog

- `restored/components/planner/PlannerDragBlockingDialog.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDeskAppointmentBlocksMutation` | `POST emrClient /desk/appointment-blocks` |

<a id="c-components-planner-plannerdragmarkingcontextmenu"></a>

### PlannerDragMarkingContextMenu

- `restored/components/planner/PlannerDragMarkingContextMenu.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDeskAppointmentMarkingsMutation` | `POST emrClient /desk/appointment-markings` |

<a id="c-components-planner-plannermarkingblockingarea"></a>

### PlannerMarkingBlockingArea

- `restored/components/planner/PlannerMarkingBlockingArea.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentBlocksGroupMutation` | `DELETE emrClient /desk/appointment-blocks/group/{input}` |
| `useDeleteDeskAppointmentMarkingsGroupMutation` | `DELETE emrClient /desk/appointment-markings/group/{input}` |

<a id="components-prescription"></a>

## components/prescription

<a id="c-components-prescription-prescriptioninputsearch"></a>

### PrescriptionInputSearch

- `restored/components/prescription/PrescriptionInputSearch.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `xr` (직접) | `GET emrClient /settings/nonbenefit-packages` |

<a id="c-components-prescription-prescriptioninputsearchcrm"></a>

### PrescriptionInputSearchCrm

- `restored/components/prescription/PrescriptionInputSearchCrm.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-prescription-prescriptioninputsearchtreatment"></a>

### PrescriptionInputSearchTreatment

- `restored/components/prescription/PrescriptionInputSearchTreatment.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |
| `xr` (직접) | `GET emrClient /settings/nonbenefit-packages` |

<a id="c-components-prescription-prescriptionproceduresselectbutton"></a>

### PrescriptionProceduresSelectButton

- `restored/components/prescription/PrescriptionProceduresSelectButton.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="components-preset"></a>

## components/preset

<a id="c-components-preset-presetduplicatedialog"></a>

### PresetDuplicateDialog

- `restored/components/preset/PresetDuplicateDialog.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-procedures"></a>

## components/procedures

<a id="c-components-procedures-proceduresacupuncture"></a>

### ProceduresAcupuncture

- `restored/components/procedures/ProceduresAcupuncture.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-procedures-proceduresacupuncturebunkupopover"></a>

### ProceduresAcupunctureBunkuPopover

- `restored/components/procedures/ProceduresAcupunctureBunkuPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresacupuncturecommonpopover"></a>

### ProceduresAcupunctureCommonPopover

- `restored/components/procedures/ProceduresAcupunctureCommonPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresacupunctureetc"></a>

### ProceduresAcupunctureETC

- `restored/components/procedures/ProceduresAcupunctureETC.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresacupuncturespecials"></a>

### ProceduresAcupunctureSpecials

- `restored/components/procedures/ProceduresAcupunctureSpecials.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresacupuncturespecialspopover"></a>

### ProceduresAcupunctureSpecialsPopover

- `restored/components/procedures/ProceduresAcupunctureSpecialsPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresacupunctureyakchim"></a>

### ProceduresAcupunctureYakchim

- `restored/components/procedures/ProceduresAcupunctureYakchim.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsCarInsurancesPharmacopuncturesQuery` | `GET emrClient /settings/car-insurances/pharmacopunctures` |

<a id="c-components-procedures-procedureshotir"></a>

### ProceduresHotIR

- `restored/components/procedures/ProceduresHotIR.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduresmoxacupping"></a>

### ProceduresMoxaCupping

- `restored/components/procedures/ProceduresMoxaCupping.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-procedures-proceduresmoxacuppingwet"></a>

### ProceduresMoxaCuppingWet

- `restored/components/procedures/ProceduresMoxaCuppingWet.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-proceduressonar"></a>

### ProceduresSonar

- `restored/components/procedures/ProceduresSonar.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-procedures-procedurestest"></a>

### ProceduresTest

- `restored/components/procedures/ProceduresTest.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCarInsurancesProcedureReferencesQuery` | `GET emrClient /settings/car-insurances/procedure-references` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-procedures-procedurestesticttens"></a>

### ProceduresTestIctTens

- `restored/components/procedures/ProceduresTestIctTens.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="components-qr"></a>

## components/qr

<a id="c-components-qr-qroutputmodal"></a>

### QrOutputModal

- `restored/components/qr/QrOutputModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useIndemnityQrQuery` | `GET insuranceClient /indemnity/qr` |
| `usePostIndemnityQrMutation` | `POST insuranceClient /indemnity/qr` |

<a id="components-questionnaire"></a>

## components/questionnaire

<a id="c-components-questionnaire-questionnairecorrectionmodal"></a>

### QuestionnaireCorrectionModal

- `restored/components/questionnaire/QuestionnaireCorrectionModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostPatientsQuestionnaireHistoryCorrectionsMutation` | `POST emrClient /patients/{input}/questionnaire-history/{input_2}/corrections` |
| `useTabletQuestionnaireTemplatesQuery` | `GET emrClient /tablet/questionnaire-templates` |

<a id="c-components-questionnaire-questionnairepanelbody"></a>

### QuestionnairePanelBody

- `restored/components/questionnaire/QuestionnairePanelBody.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsConsentHistoryQuery` | `GET emrClient /patients/{input}/consent-history` |
| `usePatientsQuestionnaireHistoryQuery` | `GET emrClient /patients/{input}/questionnaire-history` |
| `usePatientsQuestionnaireHistoryQuery_2` | `GET emrClient /patients/{input}/questionnaire-history/{input_2}` |

<a id="components-receipt"></a>

## components/receipt

<a id="c-components-receipt-receiptherbalmedicine"></a>

### ReceiptHerbalMedicine

- `restored/components/receipt/ReceiptHerbalMedicine.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDocumentsPatientsHerbalMedicineReceiptByPidMutation` | `POST emrClient /documents/patients/{args.pid}/herbal-medicine-receipt` |
| `getDocumentsPatientsDiagnosisByPid` (직접) | `GET emrClient /documents/patients/{args.pid}/diagnosis` |

<a id="components-register"></a>

## components/register

<a id="c-components-register-registeraddress"></a>

### RegisterAddress

- `restored/components/register/RegisterAddress.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET jusoClient ` |

<a id="components-remote"></a>

## components/remote

<a id="c-components-remote-remotesettlementcontent"></a>

### RemoteSettlementContent

- `restored/components/remote/RemoteSettlementContent.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettlementEmrSettlementsQuery` | `GET liteClient /settlement/emr/settlements` |

<a id="components-reserved"></a>

## components/reserved

<a id="c-components-reserved-reserveddisease"></a>

### ReservedDisease

- `restored/components/reserved/ReservedDisease.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `useKoicd20260101JsonQuery` | `GET staticClient <KOICD_20240829_JSON_PATH>`<br>`GET staticClient <KOICD_20260101_JSON_PATH>` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-reserved-reservedprescriptionsbudgetsection"></a>

### ReservedPrescriptionsBudgetSection

- `restored/components/reserved/ReservedPrescriptionsBudgetSection.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |

<a id="c-components-reserved-reservedprescriptionseditpanel"></a>

### ReservedPrescriptionsEditPanel

- `restored/components/reserved/ReservedPrescriptionsEditPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-reserved-reservedprescriptionseditpanelcarjabotab"></a>

### ReservedPrescriptionsEditPanelCarJaboTab

- `restored/components/reserved/ReservedPrescriptionsEditPanelCarJaboTab.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalMedicinesQuery` | `GET emrClient /settings/car-insurances/herbal-medicines` |

<a id="c-components-reserved-reservedprescriptionseditpaneletctab"></a>

### ReservedPrescriptionsEditPanelEtcTab

- `restored/components/reserved/ReservedPrescriptionsEditPanelEtcTab.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-reserved-reservedprescriptionseditpanelinsurancemedicinestab"></a>

### ReservedPrescriptionsEditPanelInsuranceMedicinesTab

- `restored/components/reserved/ReservedPrescriptionsEditPanelInsuranceMedicinesTab.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-reserved-reservedprescriptionseditpanelpackagetab"></a>

### ReservedPrescriptionsEditPanelPackageTab

- `restored/components/reserved/ReservedPrescriptionsEditPanelPackageTab.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |

<a id="c-components-reserved-reservedprocedures"></a>

### ReservedProcedures

- `restored/components/reserved/ReservedProcedures.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-reserved-reservedwarmcoldtwoparts"></a>

### ReservedWarmColdTwoParts

- `restored/components/reserved/ReservedWarmColdTwoParts.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="components-result"></a>

## components/result

<a id="c-components-result-resultworkspace"></a>

### ResultWorkspace

- `restored/components/result/ResultWorkspace.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsQuery` | `GET emrClient /documents/patients/{input}` |
| `usePostPatientsClaimMutation` | `POST insuranceClient /patients/{input}/claim` |

<a id="components-schedule"></a>

## components/schedule

<a id="c-components-schedule-scheduleviewcalendar"></a>

### ScheduleViewCalendar

- `restored/components/schedule/ScheduleViewCalendar.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsClinicCalendarYearQuery_2` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsClinicSchedulesQuery` | `GET emrClient /settings/clinic-schedules` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-schedule-scheduleviewcalendarcontroller"></a>

### ScheduleViewCalendarController

- `restored/components/schedule/ScheduleViewCalendarController.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorSchedulesQuery` | `GET emrClient /settings/doctor-schedules` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-schedule-scheduleviewcalendardoctorschedulesettingmodal"></a>

### ScheduleViewCalendarDoctorScheduleSettingModal

- `restored/components/schedule/ScheduleViewCalendarDoctorScheduleSettingModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsDoctorSchedulesDoctorMutation` | `PATCH emrClient /settings/doctor-schedules/doctor/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-schedule-scheduleviewcalendarschedulesettingmodal"></a>

### ScheduleViewCalendarScheduleSettingModal

- `restored/components/schedule/ScheduleViewCalendarScheduleSettingModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsClinicSchedulesMutation` | `PATCH emrClient /settings/clinic-schedules/{id}` |
| `useSettingsDoctorSchedulesQuery` | `GET emrClient /settings/doctor-schedules` |

<a id="c-components-schedule-scheduleviewcontroller"></a>

### ScheduleViewController

- `restored/components/schedule/ScheduleViewController.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsDoctorSchedulesQuery` | `GET emrClient /settings/doctor-schedules` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-search"></a>

## components/search

<a id="c-components-search-searchaddress"></a>

### SearchAddress

- `restored/components/search/SearchAddress.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET jusoClient ` |

<a id="components-send"></a>

## components/send

<a id="c-components-send-sendmethodsettingsmodal"></a>

### SendMethodSettingsModal

- `restored/components/send/SendMethodSettingsModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHospitalSettingsChannelsQuery` | `GET insuranceClient /hospital/settings/channels` |
| `usePatchHospitalSettingsChannelsMutation` | `PATCH insuranceClient /hospital/settings/channels` |

<a id="components-service"></a>

## components/service

<a id="c-components-service-servicemanagemodal"></a>

### ServiceManageModal

- `restored/components/service/ServiceManageModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |
| `patchSettingsHospitals` (직접) | `PATCH emrClient /settings/hospitals` |

<a id="c-components-service-servicesignupaddresssearchmodal"></a>

### ServiceSignUpAddressSearchModal

- `restored/components/service/ServiceSignUpAddressSearchModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRootQuery` | `GET jusoClient ` |

<a id="components-setting"></a>

## components/setting

<a id="c-components-setting-settingappointment"></a>

### SettingAppointment

- `restored/components/setting/SettingAppointment.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-setting-settingappointmentexternalchannel"></a>

### SettingAppointmentExternalChannel

- `restored/components/setting/SettingAppointmentExternalChannel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskBookingRequestsQuery` | `GET emrClient /desk/booking-requests` |
| `useBookingSyncStatusQuery` | `POST emrClient /booking/sync-status` |
| `usePostBookingSignupMutation` | `POST emrClient /booking/signup` |
| `usePostBookingSsoTokenMutation` | `POST emrClient /booking/sso/token` |

<a id="c-components-setting-settingappointmentgeneral"></a>

### SettingAppointmentGeneral

- `restored/components/setting/SettingAppointmentGeneral.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsAppointmentsMutation` | `PATCH emrClient /settings/appointments` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |

<a id="c-components-setting-settingappointmenttreatmenttime"></a>

### SettingAppointmentTreatmentTime

- `restored/components/setting/SettingAppointmentTreatmentTime.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsMedicalTreatmentsMutation` | `PATCH emrClient /settings/medical-treatments/{id}` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsMedicalTreatmentsQuery` | `GET emrClient /settings/medical-treatments` |

<a id="c-components-setting-settingcommonviewclinichoursconfig"></a>

### SettingCommonViewClinicHoursConfig

- `restored/components/setting/SettingCommonViewClinicHoursConfig.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsClinicHoursMutation` | `PATCH emrClient /settings/clinic-hours` |
| `usePutSettingsClinicCalendarDaysMutation` | `PUT emrClient /settings/clinic-calendar/days` |
| `useSettingsClinicCalendarYearQuery` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingcommonviewpatientresidentnumberdisplay"></a>

### SettingCommonViewPatientResidentNumberDisplay

- `restored/components/setting/SettingCommonViewPatientResidentNumberDisplay.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsDisplayResidentNumbersMutation` | `PATCH emrClient /settings/display/resident-numbers` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |

<a id="c-components-setting-settingcommonviewpatientsettings"></a>

### SettingCommonViewPatientSettings

- `restored/components/setting/SettingCommonViewPatientSettings.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsPatientLevelsMutation` | `DELETE emrClient /settings/patient-levels/{input}` |
| `usePatchSettingsDisplayChartNumbersMutation` | `PATCH emrClient /settings/display/chart-numbers` |
| `usePatchSettingsHospitalsChartNumberMutation` | `PATCH emrClient /settings/hospitals/chart-number` |
| `usePatchSettingsPatientLevelsMutation` | `PATCH emrClient /settings/patient-levels/{id}` |
| `usePostSettingsPatientLevelsMutation` | `POST emrClient /settings/patient-levels` |
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |
| `useSettingsHospitalsChartNumberQuery` | `GET emrClient /settings/hospitals/chart-number` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |

<a id="c-components-setting-settingcommonviewpatientvisitpathconfig"></a>

### SettingCommonViewPatientVisitPathConfig

- `restored/components/setting/SettingCommonViewPatientVisitPathConfig.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsVisitPathwaysMutation` | `DELETE emrClient /settings/visit-pathways/{id}` |
| `usePatchSettingsVisitPathwaysMutation` | `PATCH emrClient /settings/visit-pathways/{id}` |
| `usePostSettingsVisitPathwaysMutation` | `POST emrClient /settings/visit-pathways` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsVisitPathwaysQuery` | `GET emrClient /settings/visit-pathways` |

<a id="c-components-setting-settingcommonviewtelemedicineconfig"></a>

### SettingCommonViewTelemedicineConfig

- `restored/components/setting/SettingCommonViewTelemedicineConfig.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useMembersEmrClinicsCheckLocalQuery` | `GET liteClient /members/emr/clinics/check-local` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |
| `usePatchMembersEmrClinicsMyMutation` | `PATCH liteClient /members/emr/clinics/my` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `postMembersEmrClinicsMyProfile` (직접) | `POST liteClient /members/emr/clinics/my/profile` |

<a id="c-components-setting-settingcommonviewtreatmentlistconfig"></a>

### SettingCommonViewTreatmentListConfig

- `restored/components/setting/SettingCommonViewTreatmentListConfig.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsMedicalTreatmentsMutation` | `DELETE emrClient /settings/medical-treatments/{id}` |
| `usePatchSettingsMedicalTreatmentsMutation` | `PATCH emrClient /settings/medical-treatments/{id}` |
| `usePostSettingsMedicalTreatmentsMutation` | `POST emrClient /settings/medical-treatments` |
| `useSettingsMedicalTreatmentsQuery` | `GET emrClient /settings/medical-treatments` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingeditortemplatesmain"></a>

### SettingEditorTemplatesMain

- `restored/components/setting/SettingEditorTemplatesMain.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

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

<a id="c-components-setting-settingeditortemplatesprescriptionselect"></a>

### SettingEditorTemplatesPrescriptionSelect

- `restored/components/setting/SettingEditorTemplatesPrescriptionSelect.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-setting-settingeditortemplatessidebar"></a>

### SettingEditorTemplatesSidebar

- `restored/components/setting/SettingEditorTemplatesSidebar.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsTemplatesMutation` | `DELETE emrClient /settings/templates/{input}` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatchSettingsTemplatesMutation` | `PATCH emrClient /settings/templates/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTemplatesQuery` | `GET emrClient /settings/templates` |
| `deleteDocumentsPhrases` (직접) | `DELETE emrClient /documents/phrases/{id}` |
| `deleteSettingsTreatmentTemplates` (직접) | `DELETE emrClient /settings/treatment-templates/{input}` |
| `getDocumentsPhrases` (직접) | `GET emrClient /documents/phrases` |
| `getSettingsTreatmentTemplates` (직접) | `GET emrClient /settings/treatment-templates` |
| `patchSettingsTreatmentTemplates` (직접) | `PATCH emrClient /settings/treatment-templates/{id}` |
| `postSettingsTreatmentTemplates` (직접) | `POST emrClient /settings/treatment-templates` |

<a id="c-components-setting-settinghospitaljejuclaim"></a>

### SettingHospitalJejuClaim

- `restored/components/setting/SettingHospitalJejuClaim.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-setting-settingprescriptionviewchubyakdispensaryrooms"></a>

### SettingPrescriptionViewChubyakDispensaryRooms

- `restored/components/setting/SettingPrescriptionViewChubyakDispensaryRooms.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakdispensaryroomsaddmodal"></a>

### SettingPrescriptionViewChubyakDispensaryRoomsAddModal

- `restored/components/setting/SettingPrescriptionViewChubyakDispensaryRoomsAddModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsDispensaryRoomsMutation` | `PATCH emrClient /settings/dispensary-rooms/{id}` |
| `usePostSettingsDispensaryRoomsMutation` | `POST emrClient /settings/dispensary-rooms` |
| `useSettingsDispensaryRoomsQuery_2` | `GET emrClient /settings/dispensary-rooms/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakdispensaryroomscard"></a>

### SettingPrescriptionViewChubyakDispensaryRoomsCard

- `restored/components/setting/SettingPrescriptionViewChubyakDispensaryRoomsCard.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsDispensaryRoomsMutation` | `DELETE emrClient /settings/dispensary-rooms/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbs"></a>

### SettingPrescriptionViewChubyakHerbs

- `restored/components/setting/SettingPrescriptionViewChubyakHerbs.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsconfiggroupbycode"></a>

### SettingPrescriptionViewChubyakHerbsConfigGroupByCode

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsConfigGroupByCode.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsHospitalsChubyakPilotsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/herbs?{e}` |
| `useSettingsHospitalsChubyakPilotsHerbsQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsconfiggroupbycodetable"></a>

### SettingPrescriptionViewChubyakHerbsConfigGroupByCodeTable

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsConfigGroupByCodeTable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsHospitalsChubyakPilotsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/herbs?{e}` |
| `usePatchSettingsHospitalsChubyakPilotsHerbsMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/herbs/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsconfiggroupbydate"></a>

### SettingPrescriptionViewChubyakHerbsConfigGroupByDate

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsConfigGroupByDate.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsHospitalsChubyakPilotsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/herbs?{e}` |
| `useSettingsHospitalsChubyakPilotsHerbsQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsconfiggroupbydatetable"></a>

### SettingPrescriptionViewChubyakHerbsConfigGroupByDateTable

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsConfigGroupByDateTable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsHospitalsChubyakPilotsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/herbs?{e}` |
| `usePatchSettingsHospitalsChubyakPilotsHerbsMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/herbs/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsconfigheader"></a>

### SettingPrescriptionViewChubyakHerbsConfigHeader

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsConfigHeader.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsexcelcheckmodal"></a>

### SettingPrescriptionViewChubyakHerbsExcelCheckModal

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsExcelCheckModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostSettingsHospitalsChubyakPilotsHerbsMutation` | `POST emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `useSettingsChubyakPilotsHerbsAvailableProductCodesQuery` | `GET emrClient /settings/chubyak-pilots/herbs/available-product-codes` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbsexcelconfirmmodal"></a>

### SettingPrescriptionViewChubyakHerbsExcelConfirmModal

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsExcelConfirmModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakherbssideexcel"></a>

### SettingPrescriptionViewChubyakHerbsSideExcel

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsSideExcel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsChubyakPilotsHerbsAvailableProductCodesQuery` | `GET emrClient /settings/chubyak-pilots/herbs/available-product-codes` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-setting-settingprescriptionviewchubyakherbssidemanual"></a>

### SettingPrescriptionViewChubyakHerbsSideManual

- `restored/components/setting/SettingPrescriptionViewChubyakHerbsSideManual.vue` · 스토어 `useSettingHerbStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsHospitalsChubyakPilotsHerbsMutation` | `POST emrClient /settings/hospitals/chubyak-pilots/herbs` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `getSettingsChubyakPilotsHerbsProducts` (직접) | `GET emrClient /settings/chubyak-pilots/herbs/products` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptions"></a>

### SettingPrescriptionViewChubyakPrescriptions

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptions.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptionsconfigheader"></a>

### SettingPrescriptionViewChubyakPrescriptionsConfigHeader

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptionsConfigHeader.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptionsconfigtable"></a>

### SettingPrescriptionViewChubyakPrescriptionsConfigTable

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptionsConfigTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteSettingsHospitalsChubyakPilotsPrescriptionsHerbsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{input}` |
| `usePatchSettingsHospitalsChubyakPilotsPrescriptionsHerbsMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{id}` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsByIdQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/{args.id}` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |
| `postSettingsHospitalsChubyakPilotsPrescriptionsHerbs` (직접) | `POST emrClient /settings/hospitals/chubyak-pilots/prescriptions/herbs/{id}` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptionsconfigtablealias"></a>

### SettingPrescriptionViewChubyakPrescriptionsConfigTableAlias

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptionsConfigTableAlias.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsHospitalsChubyakPilotsPrescriptionsAliasMutation` | `PATCH emrClient /settings/hospitals/chubyak-pilots/prescriptions/{id}/alias` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsByIdQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/{args.id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptionsside"></a>

### SettingPrescriptionViewChubyakPrescriptionsSide

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptionsSide.vue` · 스토어 `useSettingChubyakPrescriptionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsHospitalsChubyakPilotsPrescriptionsMutation` | `POST emrClient /settings/hospitals/chubyak-pilots/prescriptions` |

<a id="c-components-setting-settingprescriptionviewchubyakprescriptionssidetable"></a>

### SettingPrescriptionViewChubyakPrescriptionsSideTable

- `restored/components/setting/SettingPrescriptionViewChubyakPrescriptionsSideTable.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsChubyakPilotsPrescriptionsQuery` | `GET emrClient /settings/chubyak-pilots/prescriptions` |

<a id="c-components-setting-settingprescriptionviewexpendable"></a>

### SettingPrescriptionViewExpendable

- `restored/components/setting/SettingPrescriptionViewExpendable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsTreatmentsExpendablesMutation` | `PATCH emrClient /settings/treatments/expendables/{id}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="c-components-setting-settingprescriptionviewexpendablehistory"></a>

### SettingPrescriptionViewExpendableHistory

- `restored/components/setting/SettingPrescriptionViewExpendableHistory.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsTreatmentsExpendablesHistoriesMutation` | `DELETE emrClient /settings/treatments/expendables/{expendablesId}/histories/{historyId}` |
| `usePatchSettingsTreatmentsExpendablesHistoriesMutation` | `PATCH emrClient /settings/treatments/expendables/{expendablesId}/histories/{historyId}` |
| `usePostSettingsTreatmentsExpendablesHistoriesMutation` | `POST emrClient /settings/treatments/expendables/{id}/histories` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsTreatmentsExpendablesHistoriesQuery` | `GET emrClient /settings/treatments/expendables/{input}/histories` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="c-components-setting-settingprescriptionviewinsurancechubyak"></a>

### SettingPrescriptionViewInsuranceChubyak

- `restored/components/setting/SettingPrescriptionViewInsuranceChubyak.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-setting-settingprescriptionviewinsurancechubyaklist"></a>

### SettingPrescriptionViewInsuranceChubyakList

- `restored/components/setting/SettingPrescriptionViewInsuranceChubyakList.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-setting-settingprescriptionviewinsurancechubyaknamedialog"></a>

### SettingPrescriptionViewInsuranceChubyakNameDialog

- `restored/components/setting/SettingPrescriptionViewInsuranceChubyakNameDialog.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-setting-settingprescriptionviewinsurancechubyakregisterdialog"></a>

### SettingPrescriptionViewInsuranceChubyakRegisterDialog

- `restored/components/setting/SettingPrescriptionViewInsuranceChubyakRegisterDialog.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-setting-settingprescriptionviewinsurancechubyaktable"></a>

### SettingPrescriptionViewInsuranceChubyakTable

- `restored/components/setting/SettingPrescriptionViewInsuranceChubyakTable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useDeleteSettingsCarInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/car-insurances/herbal-decoctions/{input}` |
| `useDeleteSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `DELETE emrClient /settings/sanjae-insurances/herbal-decoctions/{input}` |
| `useJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `usePatchSettingsCarInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/car-insurances/herbal-decoctions/{t}` |
| `usePatchSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `PATCH emrClient /settings/sanjae-insurances/herbal-decoctions/{t}` |
| `usePostSettingsCarInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/car-insurances/herbal-decoctions` |
| `usePostSettingsSanjaeInsurancesHerbalDecoctionsMutation` | `POST emrClient /settings/sanjae-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-setting-settingprescriptionviewinsurancemedicinecustomprescription"></a>

### SettingPrescriptionViewInsuranceMedicineCustomPrescription

- `restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsMedicinesMutation` | `PATCH emrClient /settings/medicines/{id}` |
| `usePostSettingsMedicinesFromCustomMutation` | `POST emrClient /settings/medicines/from-custom` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsReferencesSimpleExtractsQuery` | `GET emrClient settings/references/simple-extracts` |

<a id="c-components-setting-settingprescriptionviewinsurancemedicines"></a>

### SettingPrescriptionViewInsuranceMedicines

- `restored/components/setting/SettingPrescriptionViewInsuranceMedicines.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewinsurancemedicinesactivestable"></a>

### SettingPrescriptionViewInsuranceMedicinesActivesTable

- `restored/components/setting/SettingPrescriptionViewInsuranceMedicinesActivesTable.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsMedicinesMutation` | `DELETE emrClient /settings/medicines/{input}` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePatchSettingsMedicinesMutation` | `PATCH emrClient /settings/medicines/{id}` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewinsurancemedicinesdosages"></a>

### SettingPrescriptionViewInsuranceMedicinesDosages

- `restored/components/setting/SettingPrescriptionViewInsuranceMedicinesDosages.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsMedicinesDosagesMutation` | `PATCH emrClient /settings/medicines/dosages` |
| `useSettingsMedicinesDosagesQuery` | `GET emrClient /settings/medicines/dosages` |

<a id="c-components-setting-settingprescriptionviewinsurancemedicinestable"></a>

### SettingPrescriptionViewInsuranceMedicinesTable

- `restored/components/setting/SettingPrescriptionViewInsuranceMedicinesTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsMedicinesFromMixtureMutation` | `POST emrClient /settings/medicines/from-mixture` |
| `useSettingsReferencesSimpleExtractMixedQuery_2` | `GET emrClient settings/references/simple-extract-mixed` |

<a id="c-components-setting-settingprescriptionviewjabomedicine"></a>

### SettingPrescriptionViewJaboMedicine

- `restored/components/setting/SettingPrescriptionViewJaboMedicine.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteSettingsCarInsurancesHerbalMedicinesMutation` | `DELETE emrClient /settings/car-insurances/herbal-medicines/{input}` |
| `usePatchSettingsCarInsurancesHerbalMedicinesMutation` | `PATCH emrClient /settings/car-insurances/herbal-medicines/{id}` |
| `usePostSettingsCarInsurancesHerbalMedicinesMutation` | `POST emrClient /settings/car-insurances/herbal-medicines` |
| `useSettingsCarInsurancesHerbalMedicinesQuery` | `GET emrClient /settings/car-insurances/herbal-medicines` |

<a id="c-components-setting-settingprescriptionviewjabomedicinetablerow"></a>

### SettingPrescriptionViewJaboMedicineTableRow

- `restored/components/setting/SettingPrescriptionViewJaboMedicineTableRow.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewjaboprocedure"></a>

### SettingPrescriptionViewJaboProcedure

- `restored/components/setting/SettingPrescriptionViewJaboProcedure.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsCarInsurancesProcedureFeeMutation` | `PATCH emrClient /settings/car-insurances/procedure-fee/{code}` |
| `useSettingsCarInsurancesProcedureReferencesQuery` | `GET emrClient /settings/car-insurances/procedure-references` |

<a id="c-components-setting-settingprescriptionviewjaboyakchim"></a>

### SettingPrescriptionViewJaboYakchim

- `restored/components/setting/SettingPrescriptionViewJaboYakchim.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostSettingsCarInsurancesPharmacopuncturesMutation` | `POST emrClient /settings/car-insurances/pharmacopunctures` |
| `useSettingsCarInsurancesPharmacopuncturesQuery` | `GET emrClient /settings/car-insurances/pharmacopunctures` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewjaboyakchimcollapsible"></a>

### SettingPrescriptionViewJaboYakchimCollapsible

- `restored/components/setting/SettingPrescriptionViewJaboYakchimCollapsible.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsCarInsurancesPharmacopuncturesMutation` | `DELETE emrClient /settings/car-insurances/pharmacopunctures/{input}` |
| `usePatchSettingsCarInsurancesPharmacopuncturesMutation` | `PATCH emrClient /settings/car-insurances/pharmacopunctures/{id}` |
| `useSettingsCarInsurancesPharmacopunctureReferencesQuery` | `GET emrClient /settings/car-insurances/pharmacopuncture-references` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewjaboyakchimeditmodal"></a>

### SettingPrescriptionViewJaboYakchimEditModal

- `restored/components/setting/SettingPrescriptionViewJaboYakchimEditModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCarInsurancesPharmacopunctureReferencesQuery` | `GET emrClient /settings/car-insurances/pharmacopuncture-references` |

<a id="c-components-setting-settingprescriptionviewjaboyakchimregistermodal"></a>

### SettingPrescriptionViewJaboYakchimRegisterModal

- `restored/components/setting/SettingPrescriptionViewJaboYakchimRegisterModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCarInsurancesPharmacopunctureReferencesQuery` | `GET emrClient /settings/car-insurances/pharmacopuncture-references` |

<a id="c-components-setting-settingprescriptionviewjaboyakchimtablerow"></a>

### SettingPrescriptionViewJaboYakchimTableRow

- `restored/components/setting/SettingPrescriptionViewJaboYakchimTableRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCarInsurancesPharmacopunctureReferencesQuery` | `GET emrClient /settings/car-insurances/pharmacopuncture-references` |

<a id="c-components-setting-settingprescriptionviewnonbenefit"></a>

### SettingPrescriptionViewNonBenefit

- `restored/components/setting/SettingPrescriptionViewNonBenefit.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsNonbenefitGroupsMutation` | `DELETE emrClient /settings/nonbenefit-groups/{id}` |
| `useDeleteSettingsNonbenefitsMutation` | `DELETE emrClient /settings/nonbenefits/{input}` |
| `usePatchSettingsNonbenefitsGroupsMutation` | `PATCH emrClient /settings/nonbenefits/groups` |
| `usePatchSettingsNonbenefitsV2Mutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}` |
| `usePostSettingsNonbenefitsBulkDeleteMutation` | `POST emrClient /settings/nonbenefits/bulk-delete` |
| `usePostSettingsNonbenefitsV2Mutation` | `POST emrClient /settings/nonbenefits/v2` |
| `usePostSettingsNonreimbursedHerbTemplatesMutation` | `POST emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getSettingsNonbenefitsAffectedPackagesDelete` (직접) | `GET emrClient /settings/nonbenefits/{input}/affected-packages/delete` |

<a id="c-components-setting-settingprescriptionviewnonbenefitcategorymodal"></a>

### SettingPrescriptionViewNonBenefitCategoryModal

- `restored/components/setting/SettingPrescriptionViewNonBenefitCategoryModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsNonbenefitGroupsMutation` | `PATCH emrClient /settings/nonbenefit-groups/{id}` |
| `usePostSettingsNonbenefitGroupsMutation` | `POST emrClient /settings/nonbenefit-groups` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewnonbenefitdeleteconfirmmodal"></a>

### SettingPrescriptionViewNonBenefitDeleteConfirmModal

- `restored/components/setting/SettingPrescriptionViewNonBenefitDeleteConfirmModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewnonbenefiteditmodal"></a>

### SettingPrescriptionViewNonBenefitEditModal

- `restored/components/setting/SettingPrescriptionViewNonBenefitEditModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsNonbenefitsValidateMutation` | `POST emrClient /settings/nonbenefits/validate` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `postSettingsNonbenefitsAffectedPackagesUpdate` (직접) | `POST emrClient /settings/nonbenefits/{input}/affected-packages/update` |

<a id="c-components-setting-settingprescriptionviewnonbenefitherbaddmodal"></a>

### SettingPrescriptionViewNonBenefitHerbAddModal

- `restored/components/setting/SettingPrescriptionViewNonBenefitHerbAddModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsNonreimbursedHerbTemplatesMutation` | `PATCH emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{id}` |
| `usePostSettingsNonreimbursedHerbTemplatesMutation` | `POST emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsReferenceFormulasSearchQuery` | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="c-components-setting-settingprescriptionviewnonbenefitregistrationpanel"></a>

### SettingPrescriptionViewNonBenefitRegistrationPanel

- `restored/components/setting/SettingPrescriptionViewNonBenefitRegistrationPanel.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsNonbenefitsValidateMutation` | `POST emrClient /settings/nonbenefits/validate` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-setting-settingprescriptionviewnonbenefittablerow"></a>

### SettingPrescriptionViewNonBenefitTableRow

- `restored/components/setting/SettingPrescriptionViewNonBenefitTableRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |

<a id="c-components-setting-settingprescriptionviewpackage"></a>

### SettingPrescriptionViewPackage

- `restored/components/setting/SettingPrescriptionViewPackage.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `Ir` (직접) | `DELETE emrClient /settings/nonbenefit-package-groups/{t}` |
| `br` (직접) | `DELETE emrClient /settings/nonbenefit-packages/{t}` |
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |
| `Cr` (직접) | `PATCH emrClient /settings/nonbenefit-package-groups/{t}` |
| `_r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}` |
| `$r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}/favorite` |
| `kr` (직접) | `POST emrClient /settings/nonbenefit-package-groups` |
| `yr` (직접) | `POST emrClient /settings/nonbenefit-packages` |

<a id="c-components-setting-settingprescriptionviewpackageeditpanel"></a>

### SettingPrescriptionViewPackageEditPanel

- `restored/components/setting/SettingPrescriptionViewPackageEditPanel.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `wr` (직접) | `POST emrClient /settings/nonbenefit-packages/validate` |

<a id="c-components-setting-settingprescriptionviewpackagegroupmodal"></a>

### SettingPrescriptionViewPackageGroupModal

- `restored/components/setting/SettingPrescriptionViewPackageGroupModal.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `u0` (직접) | `POST emrClient /settings/nonbenefit-package-groups/validate` |

<a id="c-components-setting-settingprescriptionviewpersonalformula"></a>

### SettingPrescriptionViewPersonalFormula

- `restored/components/setting/SettingPrescriptionViewPersonalFormula.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `postSettingsPersonalFormulas` (직접) | `POST emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |

<a id="c-components-setting-settingprescriptionviewpersonalformulacreatedialog"></a>

### SettingPrescriptionViewPersonalFormulaCreateDialog

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaCreateDialog.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsPersonalFormulasMutation` | `POST emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |

<a id="c-components-setting-settingprescriptionviewpersonalformulacreatesidepanel"></a>

### SettingPrescriptionViewPersonalFormulaCreateSidePanel

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaCreateSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsPersonalFormulasMutation` | `POST emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="c-components-setting-settingprescriptionviewpersonalformulaherbeditsidepanel"></a>

### SettingPrescriptionViewPersonalFormulaHerbEditSidePanel

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaHerbEditSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsPersonalFormulasMutation` | `PATCH emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{id}` |
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `useSettingsPersonalFormulasQuery_2` | `GET emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |
| `getSettingsChubyakPilotsHerbs` (직접) | `GET emrClient /settings/chubyak-pilots/herbs` |

<a id="c-components-setting-settingprescriptionviewpersonalformulaitem"></a>

### SettingPrescriptionViewPersonalFormulaItem

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaItem.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsPersonalFormulasMutation` | `DELETE emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |
| `usePostSettingsPersonalFormulasDuplicateMutation` | `POST emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}/duplicate` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPersonalFormulasQuery_2` | `GET emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |

<a id="c-components-setting-settingprescriptionviewpersonalformulamain"></a>

### SettingPrescriptionViewPersonalFormulaMain

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaMain.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |

<a id="c-components-setting-settingprescriptionviewpersonalformulasidebar"></a>

### SettingPrescriptionViewPersonalFormulaSidebar

- `restored/components/setting/SettingPrescriptionViewPersonalFormulaSidebar.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferenceFormulasSearchQuery` | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |

<a id="c-components-setting-settingprescriptionviewreservedgroupadddialog"></a>

### SettingPrescriptionViewReservedGroupAddDialog

- `restored/components/setting/SettingPrescriptionViewReservedGroupAddDialog.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostSettingsAppointedPrescriptionsGroupsMutation` | `POST emrClient /settings/appointed-prescriptions/groups` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-setting-settingprescriptionviewreservedmain"></a>

### SettingPrescriptionViewReservedMain

- `restored/components/setting/SettingPrescriptionViewReservedMain.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsAppointedPrescriptionsMutation` | `PATCH emrClient /settings/appointed-prescriptions/{id}` |
| `usePostSettingsAppointedPrescriptionsMutation` | `POST emrClient /settings/appointed-prescriptions` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsReferencesAcupointsQuery` | `GET emrClient /settings/references/acupoints` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-setting-settingprescriptionviewreservedprescription"></a>

### SettingPrescriptionViewReservedPrescription

- `restored/components/setting/SettingPrescriptionViewReservedPrescription.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-setting-settingprescriptionviewreservedsidebar"></a>

### SettingPrescriptionViewReservedSidebar

- `restored/components/setting/SettingPrescriptionViewReservedSidebar.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePutSettingsAppointedPrescriptionsGroupsSortOrderMutation` | `PUT emrClient /settings/appointed-prescriptions/groups/sort-order` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-setting-settingprescriptionviewreservedsidebarcollapsible"></a>

### SettingPrescriptionViewReservedSidebarCollapsible

- `restored/components/setting/SettingPrescriptionViewReservedSidebarCollapsible.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsAppointedPrescriptionsGroupsMutation` | `DELETE emrClient /settings/appointed-prescriptions/groups/{input}` |
| `useDeleteSettingsAppointedPrescriptionsMutation` | `DELETE emrClient /settings/appointed-prescriptions/{input}` |
| `usePatchSettingsAppointedPrescriptionsGroupsMutation` | `PATCH emrClient /settings/appointed-prescriptions/groups/{id}` |
| `usePutSettingsAppointedPrescriptionsSortOrderMutation` | `PUT emrClient /settings/appointed-prescriptions/sort-order` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-setting-settingsubnavpanel"></a>

### SettingSubNavPanel

- `restored/components/setting/SettingSubNavPanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |

<a id="c-components-setting-settingtabletconsent"></a>

### SettingTabletConsent

- `restored/components/setting/SettingTabletConsent.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `deleteTabletConsentDocumentTemplates` (직접) | `DELETE emrClient /tablet/consent-document-templates/{input}` |
| `getTabletConsentDocumentTemplates` (직접) | `GET emrClient /tablet/consent-document-templates` |
| `patchTabletConsentDocumentTemplatesStatus` (직접) | `PATCH emrClient /tablet/consent-document-templates/{input}/status` |
| `postTabletConsentDocumentTemplates` (직접) | `POST emrClient /tablet/consent-document-templates` |
| `postTabletConsentDocumentTemplatesDuplicate` (직접) | `POST emrClient /tablet/consent-document-templates/{input}/duplicate` |
| `putTabletConsentDocumentTemplates` (직접) | `PUT emrClient /tablet/consent-document-templates/{input}` |

<a id="c-components-setting-settingtabletconsenteditor"></a>

### SettingTabletConsentEditor

- `restored/components/setting/SettingTabletConsentEditor.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getTabletSettingsLanguages` (직접) | `GET emrClient /tablet/settings/languages` |
| `postTabletConsentDocumentsUpload` (직접) | `POST emrClient /tablet/consent-documents/upload` |
| `putTabletSettingsLanguages` (직접) | `PUT emrClient /tablet/settings/languages` |

<a id="c-components-setting-settingtabletdocumentquestion"></a>

### SettingTabletDocumentQuestion

- `restored/components/setting/SettingTabletDocumentQuestion.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `postTabletQuestionnaireTemplatesUploadImages` (직접) | `POST emrClient /tablet/questionnaire-templates/upload-images` |

<a id="c-components-setting-settingtabletquestionnaire"></a>

### SettingTabletQuestionnaire

- `restored/components/setting/SettingTabletQuestionnaire.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `deleteTabletQuestionnaireTemplates` (직접) | `DELETE emrClient /tablet/questionnaire-templates/{input}` |
| `getTabletQuestionnaireTemplates` (직접) | `GET emrClient /tablet/questionnaire-templates` |
| `patchTabletQuestionnaireTemplatesStatus` (직접) | `PATCH emrClient /tablet/questionnaire-templates/{input}/status` |
| `postTabletQuestionnaireTemplates` (직접) | `POST emrClient /tablet/questionnaire-templates` |
| `postTabletQuestionnaireTemplatesDuplicate` (직접) | `POST emrClient /tablet/questionnaire-templates/{input}/duplicate` |
| `putTabletQuestionnaireTemplates` (직접) | `PUT emrClient /tablet/questionnaire-templates/{input}` |

<a id="c-components-setting-settingtabletquestionnaireeditor"></a>

### SettingTabletQuestionnaireEditor

- `restored/components/setting/SettingTabletQuestionnaireEditor.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getTabletSettingsLanguages` (직접) | `GET emrClient /tablet/settings/languages` |
| `postTabletQuestionnaireTemplatesUploadImages` (직접) | `POST emrClient /tablet/questionnaire-templates/upload-images` |
| `putTabletSettingsLanguages` (직접) | `PUT emrClient /tablet/settings/languages` |

<a id="c-components-setting-settingtreatmentviewacupuncturepositions"></a>

### SettingTreatmentViewAcupuncturePositions

- `restored/components/setting/SettingTreatmentViewAcupuncturePositions.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsTreatmentsMutation` | `PATCH emrClient /settings/treatments/{id}` |
| `useSettingsReferencesAcupointsQuery` | `GET emrClient /settings/references/acupoints` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-setting-settingtreatmentviewexaminationclaim"></a>

### SettingTreatmentViewExaminationClaim

- `restored/components/setting/SettingTreatmentViewExaminationClaim.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsInitialRecordsMutation` | `PATCH emrClient /settings/initial-records` |
| `usePatchSettingsTreatmentsMutation` | `PATCH emrClient /settings/treatments/{id}` |
| `useSettingsInitialRecordsQuery` | `GET emrClient /settings/initial-records` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-setting-settingtreatmentviewproceduretest"></a>

### SettingTreatmentViewProcedureTest

- `restored/components/setting/SettingTreatmentViewProcedureTest.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsTreatmentsAutoRecordMutation` | `PATCH emrClient /settings/treatments/auto-record` |
| `usePatchSettingsTreatmentsMutation` | `PATCH emrClient /settings/treatments/{id}` |
| `useSettingsTreatmentsAutoRecordQuery` | `GET emrClient /settings/treatments/auto-record` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-setting-settingtreatmentviewvitaltreatmentroomsvital"></a>

### SettingTreatmentViewVitalTreatmentRoomsVital

- `restored/components/setting/SettingTreatmentViewVitalTreatmentRoomsVital.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsTreatmentsVitalsMutation` | `PATCH emrClient /settings/treatments/vitals/{id}` |
| `useSettingsTreatmentsVitalsQuery` | `GET emrClient /settings/treatments/vitals` |

<a id="c-components-setting-settingtreatmentviewvitatreatmentroomstreatmentrooms"></a>

### SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms

- `restored/components/setting/SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsTreatmentsRoomsMutation` | `DELETE emrClient /settings/treatments/rooms/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `useTreatmentsPatientsBasicQuery` | `GET emrClient /treatments/patients/basic` |

<a id="components-side"></a>

## components/side

<a id="c-components-side-sidepaneldeskactionspatientappointment"></a>

### SidePanelDeskActionsPatientAppointment

- `restored/components/side/SidePanelDeskActionsPatientAppointment.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-side-sidepaneldeskactionspatientregisterormodify"></a>

### SidePanelDeskActionsPatientRegisterOrModify

- `restored/components/side/SidePanelDeskActionsPatientRegisterOrModify.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-side-sidepanelpatientdescriptionheadercontent"></a>

### SidePanelPatientDescriptionHeaderContent

- `restored/components/side/SidePanelPatientDescriptionHeaderContent.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchPatientsByPidMutation` | `PATCH emrClient /patients/{args.pid}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="components-sidebar"></a>

## components/sidebar

<a id="c-components-sidebar-sidebarlayout"></a>

### SidebarLayout

- `restored/components/sidebar/SidebarLayout.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-components-sidebar-sidebarnav"></a>

### SidebarNav

- `restored/components/sidebar/SidebarNav.vue` · 스토어 `useInquiryBotStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `getV1Banners` (직접) | `GET portalClient /v1/banners` |

<a id="components-signature"></a>

## components/signature

<a id="c-components-signature-signaturedocscontent"></a>

### SignatureDocsContent

- `restored/components/signature/SignatureDocsContent.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsQuery` | `GET emrClient /documents/patients/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSigningMedicalRecordsRecordByRecordIdQuery` | `GET emrClient /signing/medical-records/record/{args.record_id}` |

<a id="c-components-signature-signaturesidebar"></a>

### SignatureSideBar

- `restored/components/signature/SignatureSideBar.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSigningMedicalRecordsCountQuery` | `GET emrClient /signing/medical-records/count` |
| `useSigningMedicalRecordsSignableByDoctorIdQuery` | `GET emrClient /signing/medical-records/signable/{params.doctor_id}` |

<a id="components-lite"></a>

## components/lite

<a id="c-components-lite-litechartcreatepanel"></a>

### LiteChartCreatePanel

- `restored/components/lite/LiteChartCreatePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useCrmLiteTriggerEventsQuery` | `GET emrClient /crm/lite-trigger/events` |
| `useDeskChartNumbersRecommendationsQuery` | `GET emrClient /desk/chart-numbers/recommendations` |
| `usePatchSettingsNonbenefitsV2FavoriteMutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}/favorite` |
| `usePatientsListQuery` | `GET emrClient /patients/list` |
| `usePatientsListQuery_2` | `GET emrClient /patients/list` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostDeskNonbenefitIntakeMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /desk/nonbenefit-intake` |
| `usePostRecordPrescriptionsLastRoundsMutation` | `POST emrClient /record/prescriptions/last-rounds` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsVisitPathwaysQuery` | `GET emrClient /settings/visit-pathways` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |

<a id="c-components-lite-liteprescriptionsection"></a>

### LitePrescriptionSection

- `restored/components/lite/LitePrescriptionSection.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsNonbenefitsV2FavoriteMutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}/favorite` |
| `usePostRecordPrescriptionsLastRoundsMutation` | `POST emrClient /record/prescriptions/last-rounds` |
| `useSettingsCategoriesQuery` | `GET emrClient /settings/categories` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |

<a id="c-components-lite-literisingmaterialspane"></a>

### LiteRisingMaterialsPane

- `restored/components/lite/LiteRisingMaterialsPane.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |
| `useApiSurachalProgressQuery` | `GET biClient /api/surachal/progress` |
| `useApiSurachalSubmissionsQuery` | `GET biClient /api/surachal/submissions` |
| `usePostApiSurachalSubmissionsMutation` | `POST biClient /api/surachal/submissions` |

<a id="components-tablet"></a>

## components/tablet

<a id="c-components-tablet-tabletadminpincard"></a>

### TabletAdminPinCard

- `restored/components/tablet/TabletAdminPinCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutTabletSettingsAdminPinMutation` | `PUT emrClient /tablet/settings/admin-pin` |
| `useTabletSettingsAdminPinQuery` | `GET emrClient /tablet/settings/admin-pin` |

<a id="c-components-tablet-tabletlanguagecard"></a>

### TabletLanguageCard

- `restored/components/tablet/TabletLanguageCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getTabletSettingsLanguages` (직접) | `GET emrClient /tablet/settings/languages` |
| `putTabletSettingsLanguages` (직접) | `PUT emrClient /tablet/settings/languages` |

<a id="c-components-tablet-tabletphotorequestmodal"></a>

### TabletPhotoRequestModal

- `restored/components/tablet/TabletPhotoRequestModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostTabletPhotoRequestsCancelMutation` | `POST emrClient /tablet/photo-requests/{input}/cancel` |
| `usePostTabletPhotoRequestsMutation` | `POST emrClient /tablet/photo-requests` |
| `useTabletPhotoRequestsQuery` | `GET emrClient /tablet/photo-requests` |
| `useTabletSessionsQuery` | `GET accountClient /tablet/sessions` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-tablet-tabletreviewqrcard"></a>

### TabletReviewQrCard

- `restored/components/tablet/TabletReviewQrCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutTabletSettingsReviewLinksMutation` | `PUT emrClient /tablet/settings/review-links` |
| `useTabletSettingsReviewLinksQuery` | `GET emrClient /tablet/settings/review-links` |

<a id="c-components-tablet-tablettreatmentitemcard"></a>

### TabletTreatmentItemCard

- `restored/components/tablet/TabletTreatmentItemCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutTabletSettingsTreatmentItemsMutation` | `PUT emrClient /tablet/settings/treatment-items` |
| `useSettingsMedicalTreatmentsQuery` | `GET emrClient /settings/medical-treatments` |
| `useTabletSettingsTreatmentItemsQuery` | `GET emrClient /tablet/settings/treatment-items` |

<a id="components-tangjeon"></a>

## components/tangjeon

<a id="c-components-tangjeon-tangjeonclaimherbpanel"></a>

### TangjeonClaimHerbPanel

- `restored/components/tangjeon/TangjeonClaimHerbPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchTangjeonPrescriptionsQuery` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |

<a id="c-components-tangjeon-tangjeoncreatedictionarycard"></a>

### TangjeonCreateDictionaryCard

- `restored/components/tangjeon/TangjeonCreateDictionaryCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsPersonalFormulasQuery` | `GET emrClient <SETTINGS_PERSONAL_FORMULAS_PATH>` |
| `useTangjeonDictionariesQuery` | `GET emrClient /tangjeon/dictionaries` |
| `useTangjeonHerbsQuery` | `GET emrClient /tangjeon/herbs` |
| `getSettingsPersonalFormulas_2` (직접) | `GET emrClient {SETTINGS_PERSONAL_FORMULAS_PATH}/{input}` |

<a id="c-components-tangjeon-tangjeoncreatehistorystrip"></a>

### TangjeonCreateHistoryStrip

- `restored/components/tangjeon/TangjeonCreateHistoryStrip.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonPrescriptionsQuery_3` | `GET emrClient <TANGJEON_PRESCRIPTIONS_PATH>` |

<a id="c-components-tangjeon-tangjeoncreateinsurancefields"></a>

### TangjeonCreateInsuranceFields

- `restored/components/tangjeon/TangjeonCreateInsuranceFields.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonDispensaryRoomsQuery` | `GET emrClient /tangjeon/dispensary-rooms` |

<a id="c-components-tangjeon-tangjeoncreatepatientcard"></a>

### TangjeonCreatePatientCard

- `restored/components/tangjeon/TangjeonCreatePatientCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery` | `GET emrClient /patients/list` |

<a id="c-components-tangjeon-tangjeoncreateprescriptioncard"></a>

### TangjeonCreatePrescriptionCard

- `restored/components/tangjeon/TangjeonCreatePrescriptionCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-tangjeon-tangjeoncreatetreatmentrecordcard"></a>

### TangjeonCreateTreatmentRecordCard

- `restored/components/tangjeon/TangjeonCreateTreatmentRecordCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordPatientQuery` | `GET emrClient /record/patient/{pid}` |

<a id="c-components-tangjeon-tangjeondocumentledgerfilters"></a>

### TangjeonDocumentLedgerFilters

- `restored/components/tangjeon/TangjeonDocumentLedgerFilters.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsListQuery` | `GET emrClient /patients/list` |

<a id="c-components-tangjeon-tangjeonlinkedprescriptions"></a>

### TangjeonLinkedPrescriptions

- `restored/components/tangjeon/TangjeonLinkedPrescriptions.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonPrescriptionsByTreatmentQuery` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/by-treatment/{input}` |
| `getTangjeonPrescriptions_2` (직접) | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |

<a id="c-components-tangjeon-tangjeonlistdeliverycell"></a>

### TangjeonListDeliveryCell

- `restored/components/tangjeon/TangjeonListDeliveryCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAddressesQuery` | `GET emrClient /desk/addresses/{input}` |
| `usePatchTangjeonPrescriptionsDeliveryMutation` | `PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/delivery` |
| `usePutTangjeonPrescriptionsMutation_2` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |
| `getTangjeonPrescriptions_2` (직접) | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |

<a id="c-components-tangjeon-tangjeonlistfilters"></a>

### TangjeonListFilters

- `restored/components/tangjeon/TangjeonListFilters.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonDispensaryRoomsQuery` | `GET emrClient /tangjeon/dispensary-rooms` |

<a id="c-components-tangjeon-tangjeonlistmemocell"></a>

### TangjeonListMemoCell

- `restored/components/tangjeon/TangjeonListMemoCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutTangjeonPrescriptionsMutation_3` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |

<a id="c-components-tangjeon-tangjeonlistquantitycell"></a>

### TangjeonListQuantityCell

- `restored/components/tangjeon/TangjeonListQuantityCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchTangjeonPrescriptionsQuantityMutation` | `PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/quantity` |

<a id="c-components-tangjeon-tangjeonlistsidepanel"></a>

### TangjeonListSidePanel

- `restored/components/tangjeon/TangjeonListSidePanel.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |

<a id="c-components-tangjeon-tangjeonliststatuscell"></a>

### TangjeonListStatusCell

- `restored/components/tangjeon/TangjeonListStatusCell.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchTangjeonPrescriptionsStatusMutation` | `PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/status` |

<a id="c-components-tangjeon-tangjeonlisttable"></a>

### TangjeonListTable

- `restored/components/tangjeon/TangjeonListTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutTangjeonPrescriptionsMutation_2` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |

<a id="c-components-tangjeon-tangjeonocsv2ordermodal"></a>

### TangjeonOcsV2OrderModal

- `restored/components/tangjeon/TangjeonOcsV2OrderModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getTangjeonPrescriptions_2` (직접) | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}` |

<a id="c-components-tangjeon-tangjeonprescriptioncreatecontent"></a>

### TangjeonPrescriptionCreateContent

- `restored/components/tangjeon/TangjeonPrescriptionCreateContent.vue` · 스토어 `useToastNotificationStore`

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

<a id="c-components-tangjeon-tangjeonprescriptionhistory"></a>

### TangjeonPrescriptionHistory

- `restored/components/tangjeon/TangjeonPrescriptionHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonPrescriptionsHistoriesQuery` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}/histories` |

<a id="c-components-tangjeon-tangjeonprescriptionissuehistory"></a>

### TangjeonPrescriptionIssueHistory

- `restored/components/tangjeon/TangjeonPrescriptionIssueHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTangjeonPrescriptionsPrescriptionDocumentsQuery` | `GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}/prescription-documents` |

<a id="c-components-tangjeon-tangjeonprescriptionissuepanels"></a>

### TangjeonPrescriptionIssuePanels

- `restored/components/tangjeon/TangjeonPrescriptionIssuePanels.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchTangjeonPrescriptionsQuery` | `GET emrClient /tangjeon/herbs`<br>`GET emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{input}`<br>`PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/delivery`<br>`PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |
| `usePatchTangjeonPrescriptionsDeliveryMutation` | `PATCH emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}/delivery` |
| `usePutTangjeonPrescriptionsMutation_4` | `PUT emrClient {TANGJEON_PRESCRIPTIONS_PATH}/{id}` |

<a id="c-components-tangjeon-tangjeonprescriptionlistcontent"></a>

### TangjeonPrescriptionListContent

- `restored/components/tangjeon/TangjeonPrescriptionListContent.vue` · 스토어 `useToastNotificationStore`

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

<a id="c-components-tangjeon-tangjeonprescriptionreprintbutton"></a>

### TangjeonPrescriptionReprintButton

- `restored/components/tangjeon/TangjeonPrescriptionReprintButton.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors`<br>`GET emrClient /settings/hospitals` |
| `getDocumentsIssued_2` (직접) | `GET emrClient /documents/issued/{id}` |

<a id="components-telemedicine"></a>

## components/telemedicine

<a id="c-components-telemedicine-telemedicinesignupstep1time"></a>

### TelemedicineSignupStep1Time

- `restored/components/telemedicine/TelemedicineSignupStep1Time.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |

<a id="c-components-telemedicine-telemedicinesignupstep2info"></a>

### TelemedicineSignupStep2Info

- `restored/components/telemedicine/TelemedicineSignupStep2Info.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMembersEmrClinicsCheckLocalQuery` | `GET liteClient /members/emr/clinics/check-local` |

<a id="c-components-telemedicine-telemedicinesignupwizard"></a>

### TelemedicineSignupWizard

- `restored/components/telemedicine/TelemedicineSignupWizard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostMembersEmrClinicsMySignupTelemedicineMutation` | `POST liteClient /members/emr/clinics/my/signup-telemedicine` |

<a id="components-temporary"></a>

## components/temporary

<a id="c-components-temporary-temporaryhoursormonthlyholiday"></a>

### TemporaryHoursOrMonthlyHoliday

- `restored/components/temporary/TemporaryHoursOrMonthlyHoliday.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBookingProductsBookableTimesQuery` | `GET emrClient /booking/products/bookable-times` |
| `useBookingProductsQuery` | `GET emrClient /booking/products` |
| `useBookingSyncStatusQuery` | `POST emrClient /booking/sync-status` |
| `usePostBookingSsoTokenMutation` | `POST emrClient /booking/sso/token` |
| `usePutSettingsClinicCalendarDaysMutation` | `PUT emrClient /settings/clinic-calendar/days` |
| `useSettingsAppointmentsQuery` | `GET emrClient /settings/appointments` |
| `useSettingsClinicCalendarYearQuery_2` | `GET emrClient /settings/clinic-calendar/year/{input}` |
| `useSettingsClinicHoursQuery` | `GET emrClient /settings/clinic-hours` |
| `useSettingsHolidaysPublicHolidaysQuery` | `GET emrClient /settings/holidays/public-holidays/{input}` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="components-today"></a>

## components/today

<a id="c-components-today-todaysummarybar"></a>

### TodaySummaryBar

- `restored/components/today/TodaySummaryBar.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsByValueQuery` | `GET emrClient <"/desk/appointments?date=" + args.value>` |
| `useDeskReceiptsQuery` | `GET emrClient /desk/receipts/{input}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |

<a id="components-treatment"></a>

## components/treatment

<a id="c-components-treatment-treatmentcarinsurancemedicines"></a>

### TreatmentCarInsuranceMedicines

- `restored/components/treatment/TreatmentCarInsuranceMedicines.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesHerbalMedicinesQuery` | `GET emrClient /settings/car-insurances/herbal-medicines` |

<a id="c-components-treatment-treatmentchuna"></a>

### TreatmentChuna

- `restored/components/treatment/TreatmentChuna.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentcolumn"></a>

### TreatmentColumn

- `restored/components/treatment/TreatmentColumn.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |

<a id="c-components-treatment-treatmentdisease"></a>

### TreatmentDisease

- `restored/components/treatment/TreatmentDisease.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `useKoicd20260101JsonQuery` | `GET staticClient <KOICD_20240829_JSON_PATH>`<br>`GET staticClient <KOICD_20260101_JSON_PATH>` |

<a id="c-components-treatment-treatmentetcprescriptions"></a>

### TreatmentEtcPrescriptions

- `restored/components/treatment/TreatmentEtcPrescriptions.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="c-components-treatment-treatmentetcprescriptionsrow"></a>

### TreatmentEtcPrescriptionsRow

- `restored/components/treatment/TreatmentEtcPrescriptionsRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentinsurancemedicines"></a>

### TreatmentInsuranceMedicines

- `restored/components/treatment/TreatmentInsuranceMedicines.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsMedicinesQuery` | `GET emrClient /settings/medicines` |
| `useSettingsReferencesSimpleExtractMixedQuery` | `GET emrClient settings/references/simple-extract-mixed` |

<a id="c-components-treatment-treatmentinsurancemedicinesrow"></a>

### TreatmentInsuranceMedicinesRow

- `restored/components/treatment/TreatmentInsuranceMedicinesRow.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHerbalApplicableDiseases20241227JsonQuery` | `GET staticClient <HERBAL_APPLICABLE_DISEASES_20241227_JSON_PATH>` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentnonbenefitpackage"></a>

### TreatmentNonBenefitPackage

- `restored/components/treatment/TreatmentNonBenefitPackage.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |

<a id="c-components-treatment-treatmentnonbenefitpackagerow"></a>

### TreatmentNonBenefitPackageRow

- `restored/components/treatment/TreatmentNonBenefitPackageRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `$r` (직접) | `PATCH emrClient /settings/nonbenefit-packages/{t}/favorite` |

<a id="c-components-treatment-treatmentnonbenefitprescriptions"></a>

### TreatmentNonBenefitPrescriptions

- `restored/components/treatment/TreatmentNonBenefitPrescriptions.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |

<a id="c-components-treatment-treatmentnonbenefitprescriptionsrow"></a>

### TreatmentNonBenefitPrescriptionsRow

- `restored/components/treatment/TreatmentNonBenefitPrescriptionsRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchSettingsNonbenefitsV2FavoriteMutation` | `PATCH emrClient /settings/nonbenefits/v2/{input}/favorite` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordPrescriptionsLastRoundsMutation` | `POST emrClient /record/prescriptions/last-rounds` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsPatientLevelsQuery` | `GET emrClient /settings/patient-levels` |

<a id="c-components-treatment-treatmentpayment"></a>

### TreatmentPayment

- `restored/components/treatment/TreatmentPayment.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsHolidaysPublicHolidaysQuery` | `GET emrClient /settings/holidays/public-holidays/{input}` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-treatment-treatmentprocedures"></a>

### TreatmentProcedures

- `restored/components/treatment/TreatmentProcedures.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-treatment-treatmentroombedassignmodal"></a>

### TreatmentRoomBedAssignModal

- `restored/components/treatment/TreatmentRoomBedAssignModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `prefetchSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `prefetchTreatmentsPatientsQuery` | `GET emrClient /treatments/patients` |
| `useDeleteNotiInstructionsMutation` | `DELETE emrClient /noti/instructions/{id}` |
| `useNotiInstructionsQuery` | `GET emrClient /noti/instructions/{pid}` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePutNotiInstructionsMutation` | `PUT emrClient /noti/instructions` |
| `usePutTreatmentsPatientsMutation` | `GET emrClient /settings/treatments/rooms`<br>`GET emrClient /treatments/patients`<br>`GET emrClient <"/desk/waiting?date=" + toValue(input)>`<br>`PUT emrClient /treatments/patients/{내원Id}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `useTreatmentsPatientsBasicQuery` | `GET emrClient /treatments/patients/basic` |

<a id="c-components-treatment-treatmentroomregisterormodifymodal"></a>

### TreatmentRoomRegisterOrModifyModal

- `restored/components/treatment/TreatmentRoomRegisterOrModifyModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsTreatmentsRoomsMutation` | `PATCH emrClient /settings/treatments/rooms/{id}` |
| `usePostSettingsTreatmentsRoomsMutation` | `POST emrClient /settings/treatments/rooms` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |

<a id="c-components-treatment-treatmentroomsbedcard"></a>

### TreatmentRoomsBedCard

- `restored/components/treatment/TreatmentRoomsBedCard.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchTreatmentsPatientsQuery` | `GET emrClient /treatments/patients` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useNotiInstructionsQuery` | `GET emrClient /noti/instructions/{pid}` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatchTreatmentsPatientsStatusMutation` | `GET emrClient /treatments/patients`<br>`PATCH emrClient /treatments/patients/{내원Id}/status` |
| `usePostPatientsMemosMutation` | `POST emrClient /patients/{pid}/memos` |
| `postPatientsProfileImages` (직접) | `POST emrClient /patients/profile-images` |

<a id="c-components-treatment-treatmentroomsdisplaysettingspopover"></a>

### TreatmentRoomsDisplaySettingsPopover

- `restored/components/treatment/TreatmentRoomsDisplaySettingsPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchSettingsTreatmentsRoomsMemoCategoriesMutation` | `PATCH emrClient /settings/treatments/rooms/memo-categories` |
| `useSettingsTreatmentsRoomsMemoCategoriesQuery` | `GET emrClient /settings/treatments/rooms/memo-categories` |

<a id="c-components-treatment-treatmentroomsheaderactingorder"></a>

### TreatmentRoomsHeaderActingOrder

- `restored/components/treatment/TreatmentRoomsHeaderActingOrder.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-treatment-treatmentroomsneedleremovalpopover"></a>

### TreatmentRoomsNeedleRemovalPopover

- `restored/components/treatment/TreatmentRoomsNeedleRemovalPopover.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostTreatmentsActingsNeedleRemovalsMutation` | `POST emrClient /treatments/actings/needle-removals` |
| `useTreatmentsActingsNeedleRemovalsQuery` | `GET emrClient /treatments/actings/needle-removals/{id}` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-treatment-treatmentroomstxcolumn"></a>

### TreatmentRoomsTxColumn

- `restored/components/treatment/TreatmentRoomsTxColumn.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTreatmentsActingsNeedleRemovalsQuery` | `GET emrClient /treatments/actings/needle-removals/{id}` |

<a id="c-components-treatment-treatmentroomstxcolumnneedleremover"></a>

### TreatmentRoomsTxColumnNeedleRemover

- `restored/components/treatment/TreatmentRoomsTxColumnNeedleRemover.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostTreatmentsActingsNeedleRemovalsMutation` | `POST emrClient /treatments/actings/needle-removals` |
| `useTreatmentsActingsNeedleRemovalsQuery` | `GET emrClient /treatments/actings/needle-removals/{id}` |
| `useTreatmentsActingsNeedleRemoversQuery` | `GET emrClient /treatments/actings/needle-removers` |

<a id="c-components-treatment-treatmentroomstxcolumnpopover"></a>

### TreatmentRoomsTxColumnPopover

- `restored/components/treatment/TreatmentRoomsTxColumnPopover.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostQuickMessagesMutation` | `POST syncClient /quick-messages` |
| `useQuickMessagesRecentChannelQuery` | `GET syncClient /quick-messages/recent-channel` |
| `useRoomsQuery` | `GET syncClient /rooms` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-treatment-treatmentroomstxrow"></a>

### TreatmentRoomsTxRow

- `restored/components/treatment/TreatmentRoomsTxRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTreatmentsActingsNeedleRemovalsQuery` | `GET emrClient /treatments/actings/needle-removals/{id}` |

<a id="c-components-treatment-treatmentviewboard"></a>

### TreatmentViewBoard

- `restored/components/treatment/TreatmentViewBoard.vue` · 스토어 `useHiraSubmissionStore`, `useMedicalAidsStore`, `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `prefetchJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `prefetchKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `prefetchNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `prefetchTreatmentsPatientsQuery` | `GET emrClient /treatments/patients` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useMembersEmrOrdersQuery` | `GET liteClient members/emr/orders/{input}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatchDeskNonbenefitIntakeMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`PATCH emrClient /desk/nonbenefit-intake/{input}` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |
| `usePatchRecordDoneMutation` | `PATCH emrClient /record/{input}/done` |
| `usePatchRecordHomeVisitFormStatusMutation` | `PATCH emrClient /record/home-visit/{rid}/form-status` |
| `usePatchRecordPrescriptionsByIdMutation` | `PATCH emrClient /record/prescriptions/{body.id}` |
| `usePatchTreatmentsPatientsStatusMutation` | `GET emrClient /treatments/patients`<br>`PATCH emrClient /treatments/patients/{내원Id}/status` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `usePostDeskNonbenefitIntakeMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /desk/nonbenefit-intake` |
| `usePostDeskWaitingMutation` | `POST emrClient /desk/waiting` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `usePostRecordPrescriptionsLastRoundsMutation` | `POST emrClient /record/prescriptions/last-rounds` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsInitialRecordsQuery` | `GET emrClient /settings/initial-records` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsAutoRecordQuery` | `GET emrClient /settings/treatments/auto-record` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |
| `deleteSettingsTreatmentTemplates` (직접) | `DELETE emrClient /settings/treatment-templates/{input}` |
| `getOcs` (직접) | `GET emrClient /ocs/{ocsId}` |
| `xr` (직접) | `GET emrClient /settings/nonbenefit-packages` |
| `getSettingsTreatmentTemplates` (직접) | `GET emrClient /settings/treatment-templates` |
| `patchDeskTelemedicineConsultationsStatus` (직접) | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `patchSettingsTreatmentTemplates` (직접) | `PATCH emrClient /settings/treatment-templates/{id}` |
| `postSettingsTreatmentTemplates` (직접) | `POST emrClient /settings/treatment-templates` |

<a id="c-components-treatment-treatmentviewboardaside"></a>

### TreatmentViewBoardAside

- `restored/components/treatment/TreatmentViewBoardAside.vue` · 스토어 `useIntakeLinkPromptStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-treatment-treatmentviewboardasidechunahistory"></a>

### TreatmentViewBoardAsideChunaHistory

- `restored/components/treatment/TreatmentViewBoardAsideChunaHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardasidechunahistorydetail"></a>

### TreatmentViewBoardAsideChunaHistoryDetail

- `restored/components/treatment/TreatmentViewBoardAsideChunaHistoryDetail.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useRecordHiraChunaQuery` | `GET emrClient /record/hira/chuna` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-treatment-treatmentviewboardasidedmschedules"></a>

### TreatmentViewBoardAsideDmSchedules

- `restored/components/treatment/TreatmentViewBoardAsideDmSchedules.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMembersEmrInPersonConsultationsDmSchedulesQuery` | `GET liteClient /members/emr/in-person-consultations/{input}/dm-schedules` |
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |

<a id="c-components-treatment-treatmentviewboardasideeditortemplates"></a>

### TreatmentViewBoardAsideEditorTemplates

- `restored/components/treatment/TreatmentViewBoardAsideEditorTemplates.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `deleteSettingsTreatmentTemplates` (직접) | `DELETE emrClient /settings/treatment-templates/{input}` |
| `getSettingsTreatmentTemplates` (직접) | `GET emrClient /settings/treatment-templates` |
| `patchSettingsTreatmentTemplates` (직접) | `PATCH emrClient /settings/treatment-templates/{id}` |
| `postSettingsTreatmentTemplates` (직접) | `POST emrClient /settings/treatment-templates` |

<a id="c-components-treatment-treatmentviewboardasideinsuranceinfo"></a>

### TreatmentViewBoardAsideInsuranceInfo

- `restored/components/treatment/TreatmentViewBoardAsideInsuranceInfo.vue` · 스토어 `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsCarWaitingAmountByIdAndReportNumberQuery` | `GET emrClient /patients/{args.id}/car-waiting/amount/{args.report_number}` |
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostNhicM2GetDataMutation` | `POST emrClient /nhic/m2/get-data` |

<a id="c-components-treatment-treatmentviewboardasideinsuranceinquiry"></a>

### TreatmentViewBoardAsideInsuranceInquiry

- `restored/components/treatment/TreatmentViewBoardAsideInsuranceInquiry.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostEmrPatientsLatestLookupMutation` | `POST insuranceClient /emr/patients/{input}/latest-lookup` |
| `usePostPatientsClaimMutation` | `POST insuranceClient /patients/{input}/claim` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardasidejabochubyak"></a>

### TreatmentViewBoardAsideJaboChubyak

- `restored/components/treatment/TreatmentViewBoardAsideJaboChubyak.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardasidemedicalaids"></a>

### TreatmentViewBoardAsideMedicalAids

- `restored/components/treatment/TreatmentViewBoardAsideMedicalAids.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardasidenhicchubyak"></a>

### TreatmentViewBoardAsideNhicChubyak

- `restored/components/treatment/TreatmentViewBoardAsideNhicChubyak.vue` · 스토어 `useHiraSubmissionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsCategoriesQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/categories/{key}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `getChartPcmdPatients` (직접) | `GET emrClient /chart/pcmd/patients/{pId}` |
| `postChartPcmdPatients` (직접) | `POST emrClient /chart/pcmd/patients/{pId}` |

<a id="c-components-treatment-treatmentviewboardasidenonbenefitchubyak"></a>

### TreatmentViewBoardAsideNonBenefitChubyak

- `restored/components/treatment/TreatmentViewBoardAsideNonBenefitChubyak.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |

<a id="c-components-treatment-treatmentviewboardasidenonbenefitchubyakprescriptionsidepanel"></a>

### TreatmentViewBoardAsideNonBenefitChubyakPrescriptionSidePanel

- `restored/components/treatment/TreatmentViewBoardAsideNonBenefitChubyakPrescriptionSidePanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatchOcsMutation` | `PATCH emrClient /ocs/{ocsId}` |

<a id="c-components-treatment-treatmentviewboardasidereserved"></a>

### TreatmentViewBoardAsideReserved

- `restored/components/treatment/TreatmentViewBoardAsideReserved.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-treatment-treatmentviewboardasidereservedcollapsible"></a>

### TreatmentViewBoardAsideReservedCollapsible

- `restored/components/treatment/TreatmentViewBoardAsideReservedCollapsible.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsAppointedPrescriptionsQuery` | `GET emrClient /settings/appointed-prescriptions` |

<a id="c-components-treatment-treatmentviewboardasidesanjaechubyakhistory"></a>

### TreatmentViewBoardAsideSanjaeChubyakHistory

- `restored/components/treatment/TreatmentViewBoardAsideSanjaeChubyakHistory.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-components-treatment-treatmentviewboardasidesanjaechunahistory"></a>

### TreatmentViewBoardAsideSanjaeChunaHistory

- `restored/components/treatment/TreatmentViewBoardAsideSanjaeChunaHistory.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartSanjaeRecordChunaQuery` | `GET emrClient chart/sanjae/record/{input}/chuna` |

<a id="c-components-treatment-treatmentviewboardchangeinsurancetypebutton"></a>

### TreatmentViewBoardChangeInsuranceTypeButton

- `restored/components/treatment/TreatmentViewBoardChangeInsuranceTypeButton.vue` · 스토어 `useMedicalAidsStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `prefetchNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `useDeleteNhicM5ConfirmationMutation` | `DELETE emrClient /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` |
| `useNhicM3Query` | `GET emrClient /nhic/m3/{input}` |
| `useNhicM4InternalDataQuery` | `GET emrClient /nhic/m4/internal-data/{input}` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostNhicM4GetExternalDataMutation` | `POST emrClient /nhic/m4/get-external-data` |

<a id="c-components-treatment-treatmentviewboardchangeinsurancetypemodalcontent"></a>

### TreatmentViewBoardChangeInsuranceTypeModalContent

- `restored/components/treatment/TreatmentViewBoardChangeInsuranceTypeModalContent.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDeskWaitingMutation` | `PATCH emrClient /desk/waiting/{id}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-treatment-treatmentviewboardchubyakaddbutton"></a>

### TreatmentViewBoardChubyakAddButton

- `restored/components/treatment/TreatmentViewBoardChubyakAddButton.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-treatment-treatmentviewboardchubyakdiseaseadd"></a>

### TreatmentViewBoardChubyakDiseaseAdd

- `restored/components/treatment/TreatmentViewBoardChubyakDiseaseAdd.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |

<a id="c-components-treatment-treatmentviewboardeditheader"></a>

### TreatmentViewBoardEditHeader

- `restored/components/treatment/TreatmentViewBoardEditHeader.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-treatment-treatmentviewboardeditheaderjabo2ndvisitbanner"></a>

### TreatmentViewBoardEditHeaderJabo2ndVisitBanner

- `restored/components/treatment/TreatmentViewBoardEditHeaderJabo2ndVisitBanner.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |

<a id="c-components-treatment-treatmentviewboardfooter"></a>

### TreatmentViewBoardFooter

- `restored/components/treatment/TreatmentViewBoardFooter.vue` · 스토어 `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskPrepaidChartsQuery` | `GET emrClient /desk/prepaid/charts/{chartId}` |
| `usePatientsCarWaitingAmountByIdAndReportNumberQuery` | `GET emrClient /patients/{args.id}/car-waiting/amount/{args.report_number}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePutRootMutation` | `PUT emrClient <_1(진료의Id)>` |
| `useRootQuery` | `GET emrClient <_1(input)>` |
| `useSettingsHolidaysPublicHolidaysQuery` | `GET emrClient /settings/holidays/public-holidays/{input}` |
| `useSettingsNonbenefitsQuery` | `GET emrClient /settings/nonbenefits` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `hr` (직접) | `GET emrClient /settings/nonbenefit-package-groups` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-treatment-treatmentviewboardhomevisitaddbutton"></a>

### TreatmentViewBoardHomeVisitAddButton

- `restored/components/treatment/TreatmentViewBoardHomeVisitAddButton.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordHomeVisitCountsQuery` | `GET emrClient /record/home-visit/counts` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-treatment-treatmentviewboardjejusupportpanel"></a>

### TreatmentViewBoardJejuSupportPanel

- `restored/components/treatment/TreatmentViewBoardJejuSupportPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-treatment-treatmentviewboardnewchart"></a>

### TreatmentViewBoardNewChart

- `restored/components/treatment/TreatmentViewBoardNewChart.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-treatment-treatmentviewboardnewchartcarinsurance"></a>

### TreatmentViewBoardNewChartCarInsurance

- `restored/components/treatment/TreatmentViewBoardNewChartCarInsurance.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsCarWaitingQuery` | `GET emrClient /patients/{input}/car-waiting` |

<a id="c-components-treatment-treatmentviewboardnewchartindustrial"></a>

### TreatmentViewBoardNewChartIndustrial

- `restored/components/treatment/TreatmentViewBoardNewChartIndustrial.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsSanjaeWaitingQuery` | `GET emrClient /patients/{input}/sanjae-waiting` |

<a id="c-components-treatment-treatmentviewboardpatientinfo"></a>

### TreatmentViewBoardPatientInfo

- `restored/components/treatment/TreatmentViewBoardPatientInfo.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useDeskFamiliesMembersRelationsQuery` | `GET emrClient /desk/families/{input}/members-relations` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDisplayResidentNumbersQuery` | `GET emrClient /settings/display/resident-numbers` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-treatment-treatmentviewboardpatientinfonhicchubyakmodal"></a>

### TreatmentViewBoardPatientInfoNhicChubyakModal

- `restored/components/treatment/TreatmentViewBoardPatientInfoNhicChubyakModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useKcd20260101JsonQuery` | `GET staticClient <KCD_20250722_JSON_PATH>`<br>`GET staticClient <KCD_20260101_JSON_PATH>` |
| `useRecordListPcmdCountDoctorByDateAndDoctorIdQuery` | `GET emrClient /record/list/pcmd-count/{args.date}/doctor/{args.doctorId}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `getChartPcmdPatients` (직접) | `GET emrClient /chart/pcmd/patients/{pId}` |
| `postChartPcmdPatients` (직접) | `POST emrClient /chart/pcmd/patients/{pId}` |

<a id="c-components-treatment-treatmentviewboardprescriptioncarheader"></a>

### TreatmentViewBoardPrescriptionCarHeader

- `restored/components/treatment/TreatmentViewBoardPrescriptionCarHeader.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartCarPcmdPatientsQuery` | `GET emrClient /chart/car-pcmd/patients/{pId}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostChartCarPcmdPatientsMutation` | `POST emrClient /chart/car-pcmd/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardprescriptioncarrecommendededitmodal"></a>

### TreatmentViewBoardPrescriptionCarRecommendedEditModal

- `restored/components/treatment/TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartTreatmentIndicatorsPatientsQuery` | `GET emrClient /chart/treatment-indicators/patients/{pId}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsAutoRecordQuery` | `GET emrClient /settings/treatments/auto-record` |
| `deleteSettingsTreatmentTemplates` (직접) | `DELETE emrClient /settings/treatment-templates/{input}` |
| `getSettingsTreatmentTemplates` (직접) | `GET emrClient /settings/treatment-templates` |
| `patchSettingsTreatmentTemplates` (직접) | `PATCH emrClient /settings/treatment-templates/{id}` |
| `postSettingsTreatmentTemplates` (직접) | `POST emrClient /settings/treatment-templates` |

<a id="c-components-treatment-treatmentviewboardprescriptionnhicchubyak"></a>

### TreatmentViewBoardPrescriptionNhicChubyak

- `restored/components/treatment/TreatmentViewBoardPrescriptionNhicChubyak.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsChubyakPilotsPrescriptionsCategoriesQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/categories/{key}` |

<a id="c-components-treatment-treatmentviewboardprescriptionnhicchubyakallmodal"></a>

### TreatmentViewBoardPrescriptionNhicChubyakAllModal

- `restored/components/treatment/TreatmentViewBoardPrescriptionNhicChubyakAllModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsChubyakPilotsPrescriptionsQuery` | `GET emrClient /settings/chubyak-pilots/prescriptions` |
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getSettingsChubyakPilotsPrescriptions_2` (직접) | `GET emrClient /settings/chubyak-pilots/prescriptions/{input}` |
| `getSettingsDispensaryRoomsPrescriptions` (직접) | `GET emrClient /settings/dispensary-rooms/{id}/prescriptions/{pId}` |

<a id="c-components-treatment-treatmentviewboardprescriptionnhicchubyakrow"></a>

### TreatmentViewBoardPrescriptionNhicChubyakRow

- `restored/components/treatment/TreatmentViewBoardPrescriptionNhicChubyakRow.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDispensaryRoomsQuery` | `GET emrClient /settings/dispensary-rooms` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getSettingsDispensaryRoomsPrescriptions` (직접) | `GET emrClient /settings/dispensary-rooms/{id}/prescriptions/{pId}` |

<a id="c-components-treatment-treatmentviewboardprescriptionnhicinsurancestatus"></a>

### TreatmentViewBoardPrescriptionNhicInsuranceStatus

- `restored/components/treatment/TreatmentViewBoardPrescriptionNhicInsuranceStatus.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useChartChunaPatientsQuery` | `GET emrClient /chart/chuna/patients/{pId}` |
| `usePostChartChunaPatientsMutation` | `POST emrClient /chart/chuna/patients/{pId}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardprescriptionsanjaechubyak"></a>

### TreatmentViewBoardPrescriptionSanjaeChubyak

- `restored/components/treatment/TreatmentViewBoardPrescriptionSanjaeChubyak.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsSanjaeInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/sanjae-insurances/herbal-decoctions` |

<a id="c-components-treatment-treatmentviewboardprescriptionsanjaechubyakcomponentscreate"></a>

### TreatmentViewBoardPrescriptionSanjaeChubyakComponentsCreate

- `restored/components/treatment/TreatmentViewBoardPrescriptionSanjaeChubyakComponentsCreate.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useJaboHerbalComponents20250116JsonQuery` | `GET staticClient <JABO_HERBAL_COMPONENTS_20250116_JSON_PATH>` |
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-treatment-treatmentviewboardprescriptionsanjaechubyakrow"></a>

### TreatmentViewBoardPrescriptionSanjaeChubyakRow

- `restored/components/treatment/TreatmentViewBoardPrescriptionSanjaeChubyakRow.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |

<a id="c-components-treatment-treatmentviewboardprescriptionsanjaeinsurancestatus"></a>

### TreatmentViewBoardPrescriptionSanjaeInsuranceStatus

- `restored/components/treatment/TreatmentViewBoardPrescriptionSanjaeInsuranceStatus.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartSanjaePatientsRecordQuery` | `GET emrClient chart/sanjae/patients/{input}/record/{input_2}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowacupuncturecommon"></a>

### TreatmentViewBoardPrescriptionTableRowAcupunctureCommon

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowAcupunctureCommon.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatientsQuery` | `GET emrClient /patients/{input}` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowchubyak"></a>

### TreatmentViewBoardPrescriptionTableRowChubyak

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowChubyak.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowchuna"></a>

### TreatmentViewBoardPrescriptionTableRowChuna

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowChuna.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowcommon"></a>

### TreatmentViewBoardPrescriptionTableRowCommon

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowCommon.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowinsurancemedicine"></a>

### TreatmentViewBoardPrescriptionTableRowInsuranceMedicine

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowInsuranceMedicine.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerownhicchubyak"></a>

### TreatmentViewBoardPrescriptionTableRowNhicChubyak

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowNhicChubyak.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerownonbenefit"></a>

### TreatmentViewBoardPrescriptionTableRowNonBenefit

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowNonBenefit.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useOcsQuery` | `GET emrClient /ocs/{ocsId}` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useTangjeonTreatmentPrescriptionsDraftQuery` | `GET emrClient /tangjeon/treatment-prescriptions/{input}/draft` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablerowpackagededuction"></a>

### TreatmentViewBoardPrescriptionTableRowPackageDeduction

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableRowPackageDeduction.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Pl` (직접) | `GET emrClient /patients/{t}/packages/{n}` |

<a id="c-components-treatment-treatmentviewboardprescriptiontablev2"></a>

### TreatmentViewBoardPrescriptionTableV2

- `restored/components/treatment/TreatmentViewBoardPrescriptionTableV2.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsNonbenefitGroupsQuery` | `GET emrClient /settings/nonbenefit-groups` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |

<a id="c-components-treatment-treatmentviewboardprescriptionv2"></a>

### TreatmentViewBoardPrescriptionV2

- `restored/components/treatment/TreatmentViewBoardPrescriptionV2.vue` · 스토어 `useClaimWarningStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartTreatmentIndicatorsPatientsQuery` | `GET emrClient /chart/treatment-indicators/patients/{pId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHolidaysPublicHolidaysQuery` | `GET emrClient /settings/holidays/public-holidays/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |

<a id="c-components-treatment-treatmentviewboardrecordslist"></a>

### TreatmentViewBoardRecordsList

- `restored/components/treatment/TreatmentViewBoardRecordsList.vue` · 스토어 `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `useDeleteRecordMutation` | `DELETE emrClient /record/{rid}` |
| `usePatchRecordFixedMutation` | `PATCH emrClient /record/{rid}/fixed` |
| `useRecordPatientQuery` | `GET emrClient /record/patient/{pid}` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |

<a id="c-components-treatment-treatmentviewboardrecordslistheader"></a>

### TreatmentViewBoardRecordsListHeader

- `restored/components/treatment/TreatmentViewBoardRecordsListHeader.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordPatientRecordDateQuery` | `GET emrClient /record/patient/{input}/record/date` |

<a id="c-components-treatment-treatmentviewboardrecordslistheaderfilterpopover"></a>

### TreatmentViewBoardRecordsListHeaderFilterPopover

- `restored/components/treatment/TreatmentViewBoardRecordsListHeaderFilterPopover.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |

<a id="c-components-treatment-treatmentviewboardrecordslistitem"></a>

### TreatmentViewBoardRecordsListItem

- `restored/components/treatment/TreatmentViewBoardRecordsListItem.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useChartMedicalTreatmentsQuery` | `GET emrClient /chart/medical-treatments` |
| `l` (직접) | `GET emrClient /chunggu/jeju/badge` |
| `l` (직접) | `GET emrClient /chunggu/jeju/summary` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `GET emrClient /desk/jeju-snapshot/{recordId}/histories` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `GET emrClient /patients/{id}/jeju-supports/histories` |
| `Nl` (직접) | `GET emrClient /patients/{t}/packages` |
| `l` (직접) | `GET emrClient /settings/jeju-claim` |
| `l` (직접) | `PATCH emrClient /desk/jeju-snapshot/{recordId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}` |
| `l` (직접) | `PATCH emrClient /patients/{id}/jeju-supports/{supportId}/deactivate` |
| `l` (직접) | `PATCH emrClient /settings/jeju-claim` |
| `l` (직접) | `POST emrClient /chunggu/jeju/documents` |
| `l` (직접) | `POST emrClient /patients/{id}/jeju-supports` |
| `l` (직접) | `PUT emrClient /chunggu/jeju/submitted` |
| `l` (직접) | `PUT emrClient /desk/jeju-snapshot/{recordId}` |

<a id="c-components-treatment-treatmentviewboardrecordslistmultirepeatmodal"></a>

### TreatmentViewBoardRecordsListMultiRepeatModal

- `restored/components/treatment/TreatmentViewBoardRecordsListMultiRepeatModal.vue` · 스토어 `useRepeatedTreatmentStore`, `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `prefetchRecordQuery` | `GET emrClient /record/{input}` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePatchDeskWaitingByIdMutation_2` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `usePatchRecordDoneMutation` | `PATCH emrClient /record/{input}/done` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostDeskWaitingMutation` | `POST emrClient /desk/waiting` |
| `usePostNhicM2GetDataMutation` | `POST emrClient /nhic/m2/get-data` |
| `usePostRecordSaveMutation` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>`<br>`GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}`<br>`POST emrClient /record/{rid}/save` |
| `useRecordPatientRecordDateQuery` | `GET emrClient /record/patient/{input}/record/date` |
| `useRecordQuery` | `GET emrClient /record/{input}` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsNonreimbursedHerbTemplatesQuery` | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `useSettingsNonreimbursedHerbTemplatesQuery_2` | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-treatment-treatmentviewboardrecordslistmultirepeatmodallistitem"></a>

### TreatmentViewBoardRecordsListMultiRepeatModalListItem

- `restored/components/treatment/TreatmentViewBoardRecordsListMultiRepeatModalListItem.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsHolidaysPublicHolidaysQuery` | `GET emrClient /settings/holidays/public-holidays/{input}` |
| `useSettingsRecordQuery` | `GET emrClient /settings/record` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsQuery` | `GET emrClient /settings/treatments` |

<a id="c-components-treatment-treatmentviewboardregisterreservedprescriptionmodal"></a>

### TreatmentViewBoardRegisterReservedPrescriptionModal

- `restored/components/treatment/TreatmentViewBoardRegisterReservedPrescriptionModal.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostSettingsAppointedPrescriptionsMutation` | `POST emrClient /settings/appointed-prescriptions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `queryFn$` (직접) | `GET emrClient /settings/appointed-prescriptions/groups` |

<a id="c-components-treatment-treatmentviewboardliteorderpanel"></a>

### TreatmentViewBoardLiteOrderPanel

- `restored/components/treatment/TreatmentViewBoardLiteOrderPanel.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMembersEmrOrdersQuery` | `GET liteClient members/emr/orders/{input}` |
| `usePatchMembersEmrConsultationsOrdersShippingInfoMutation` | `PATCH liteClient members/emr/consultations/orders/{input}/shipping-info` |
| `usePatchMembersEmrConsultationsOrdersShippingMethodMutation` | `PATCH liteClient members/emr/consultations/orders/{input}/shipping-method` |
| `usePatchMembersEmrConsultationsOrdersVisitScheduleMutation` | `PATCH liteClient members/emr/consultations/orders/{input}/visit-schedule` |

<a id="c-components-treatment-treatmentviewprescriptionsidepanelmaximumprocedures"></a>

### TreatmentViewPrescriptionSidePanelMaximumProcedures

- `restored/components/treatment/TreatmentViewPrescriptionSidePanelMaximumProcedures.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useJaboReimbursement20260101JsonQuery` | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>`<br>`GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `useSettingsCarInsurancesHerbalDecoctionsQuery` | `GET emrClient /settings/car-insurances/herbal-decoctions` |
| `useSettingsCarInsurancesPharmacopuncturesQuery` | `GET emrClient /settings/car-insurances/pharmacopunctures` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsReferencesReimbursementAvailableDatesQuery` | `GET emrClient /settings/references/reimbursement-available-dates` |
| `useSettingsReferencesReimbursementCodesQuery` | `GET emrClient /settings/references/reimbursement-codes` |
| `useSettingsTreatmentsExpendablesQuery` | `GET emrClient /settings/treatments/expendables` |

<a id="c-components-treatment-treatmentvisibilitysettingsmodal"></a>

### TreatmentVisibilitySettingsModal

- `restored/components/treatment/TreatmentVisibilitySettingsModal.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHospitalSettingsTreatmentVisibilityQuery` | `GET insuranceClient /hospital/settings/treatment-visibility` |
| `usePatchHospitalSettingsTreatmentVisibilityMutation` | `PATCH insuranceClient /hospital/settings/treatment-visibility` |

<a id="components-unified"></a>

## components/unified

<a id="c-components-unified-unifiedtermsconsentscreen"></a>

### UnifiedTermsConsentScreen

- `restored/components/unified/UnifiedTermsConsentScreen.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostTermsAgreementsMutation` | `POST accountClient /terms/agreements` |
| `useTermsDocumentsQuery` | `GET accountClient /terms/documents` |

<a id="components-unscheduled"></a>

## components/unscheduled

<a id="c-components-unscheduled-unscheduledappointmentcard"></a>

### UnscheduledAppointmentCard

- `restored/components/unscheduled/UnscheduledAppointmentCard.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDisplayChartNumbersQuery` | `GET emrClient /settings/display/chart-numbers` |

<a id="components-waiting"></a>

## components/waiting

<a id="c-components-waiting-waitingcolumn"></a>

### WaitingColumn

- `restored/components/waiting/WaitingColumn.vue` · 스토어 `usePatientStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteDeskWaitingMutation` | `DELETE emrClient /desk/waiting/{내원Id}` |
| `usePatchDeskWaitingByIdMutation` | `PATCH emrClient <"/desk/waiting/" + input.id>` |
| `useTabletStaffWaitingPatientsQuery` | `GET emrClient /tablet/staff/waiting-patients` |

<a id="components-work"></a>

## components/work

<a id="c-components-work-workabilitydiagnosis"></a>

### WorkAbilityDiagnosis

- `restored/components/work/WorkAbilityDiagnosis.vue` · 스토어 `useDocumentIssueStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsPatientsRecordDateQuery` | `GET emrClient /documents/patients/{pid}/record-date` |

<a id="components-year"></a>

## components/year

<a id="c-components-year-yearsettlementbytreatmenttable"></a>

### YearSettlementByTreatmentTable

- `restored/components/year/YearSettlementByTreatmentTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsYearEndTaxSettlementDetailsQuery` | `GET emrClient /documents/year-end-tax-settlement/details` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation_2` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |

<a id="c-components-year-yearsettlementbytreatmenttabledetailrow"></a>

### YearSettlementByTreatmentTableDetailRow

- `restored/components/year/YearSettlementByTreatmentTableDetailRow.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation_2` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |

<a id="c-components-year-yearsettlementcontainer"></a>

### YearSettlementContainer

- `restored/components/year/YearSettlementContainer.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePostDocumentsYearEndTaxSettlementDownloadMutation` | `POST emrClient /documents/year-end-tax-settlement/download` |

<a id="c-components-year-yearsettlementheader"></a>

### YearSettlementHeader

- `restored/components/year/YearSettlementHeader.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsYearEndTaxSettlementDetailsCountQuery` | `GET emrClient /documents/year-end-tax-settlement/details/count` |

<a id="c-components-year-yearsettlementhospitalinfomodal"></a>

### YearSettlementHospitalInfoModal

- `restored/components/year/YearSettlementHospitalInfoModal.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-components-year-yearsettlementtable"></a>

### YearSettlementTable

- `restored/components/year/YearSettlementTable.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDocumentsYearEndTaxSettlementQuery` | `GET emrClient /documents/year-end-tax-settlement` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation_2` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |

<a id="c-components-year-yearsettlementtabledetailrow"></a>

### YearSettlementTableDetailRow

- `restored/components/year/YearSettlementTableDetailRow.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |
| `usePatchDocumentsReceiptDetailsDeductionExclusionMutation_2` | `PATCH emrClient /documents/receipt-details/deduction-exclusion` |

<a id="views"></a>

## views

<a id="c-views-accountpermissionsview"></a>

### AccountPermissionsView

- `restored/views/AccountPermissionsView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteUsersMutation` | `DELETE accountClient /users/{input}` |
| `usePatchUsersMutation` | `PATCH accountClient /users/{userId}` |
| `usePermissionsQuery` | `GET accountClient /permissions` |
| `usePostUsersPasswordMutation` | `POST accountClient /users/{userId}/password` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useUsersQuery` | `GET accountClient /users` |

<a id="c-views-appointmentcolumnunscheduledcardview"></a>

### AppointmentColumnUnscheduledCardView

- `restored/views/AppointmentColumnUnscheduledCardView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteDeskAppointmentsMutation_2` | `DELETE emrClient /desk/appointments/{input}` |
| `usePatchDeskAppointmentsMutation` | `PATCH emrClient /desk/appointments/{예약Id}` |

<a id="c-views-canvasview"></a>

### CanvasView

- `restored/views/CanvasView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsCanvasImagesQuery` | `GET emrClient /patients/{id}/canvas/images/{iid}` |
| `prefetchRecordCanvasTemplatesCategoryIdQuery` | `GET emrClient /record/canvas/templates/category/{category}/id/{id}` |
| `usePatchPatientsCanvasImagesNameMutation` | `PATCH emrClient /patients/{id}/canvas/images/{iid}/name` |
| `usePatientsCanvasImagesQuery` | `GET emrClient /patients/{id}/canvas/images` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostPatientsCanvasImagesMutation` | `POST emrClient /patients/{id}/canvas/images` |
| `usePutPatientsCanvasImagesMutation` | `PUT emrClient /patients/{id}/canvas/images/{iid}` |

<a id="c-views-challengeview"></a>

### ChallengeView

- `restored/views/ChallengeView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useApiSurachalCohortQuery` | `GET biClient /api/surachal/cohort` |
| `useApiSurachalMeQuery` | `GET biClient /api/surachal/me` |

<a id="c-views-claimhomevisitview"></a>

### ClaimHomeVisitView

- `restored/views/ClaimHomeVisitView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchRecordHomeVisitFormStatusMutation` | `PATCH emrClient /record/home-visit/{rid}/form-status` |
| `useRecordHomeVisitQuery` | `GET emrClient /record/home-visit` |

<a id="c-views-claimresultview"></a>

### ClaimResultView

- `restored/views/ClaimResultView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguAfterQuery` | `GET emrClient /chunggu/after` |
| `usePostChungguAfterRetryByIdMutation` | `POST emrClient /chunggu/after/{args.id}/retry` |
| `usePostChungguExamresultMutation` | `POST emrClient /chunggu/examresult/{청구Id}` |
| `usePostChungguExamresultMutation_2` | `POST emrClient /chunggu/examresult` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-views-claimtelemedicinepilotview"></a>

### ClaimTelemedicinePilotView

- `restored/views/ClaimTelemedicinePilotView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useRecordTelemedicinePilotRatioQuery` | `GET emrClient /record/telemedicine-pilot/ratio` |
| `useRecordTelemedicinePilotRecordsQuery` | `GET emrClient /record/telemedicine-pilot/records` |

<a id="c-views-claimv2inboxview"></a>

### ClaimV2InboxView

- `restored/views/ClaimV2InboxView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useChungguBeforeByIdQuery` | `GET emrClient /chunggu/before/{args.id}` |
| `useChungguBeforeQuery` | `GET emrClient /chunggu/before` |
| `usePostChungguAfterMutation` | `POST emrClient /chunggu/after` |

<a id="c-views-crmbillingview"></a>

### CrmBillingView

- `restored/views/CrmBillingView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useBillingInvoicesParamQuery` | `GET crmClient /billing/invoices{n ? '?${n}' : ""}` |
| `useBillingInvoicesParamQuery_2` | `GET crmClient /billing/invoices{n ? '?${n}' : ""}` |

<a id="c-views-crmconsultscriptview"></a>

### CrmConsultScriptView

- `restored/views/CrmConsultScriptView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmContactListSchedulesPatientQuery` | `GET emrClient /crm/contact-list/schedules/patient/{patientId}` |
| `useCrmTriggerEngineWorklistLogsQuery` | `GET emrClient /crm/trigger-engine/worklist/logs` |
| `useMessagesPatientsTemplateVariablesByPatientIdQuery` | `GET crmClient /messages/patients/{args.patientId}/template-variables` |
| `usePostCrmTriggerEngineExecutionLogsCompleteMutation` | `POST emrClient /crm/trigger-engine/execution-logs/complete` |

<a id="c-views-crmcontactsview"></a>

### CrmContactsView

- `restored/views/CrmContactsView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useCrmTriggerEngineMcpApprovalsPendingQuery` | `GET emrClient {CRM_TRIGGER_ENGINE_MCP_APPROVALS_PATH}/pending` |
| `useSubscriptionsMeQuery` | `GET emrClient /subscriptions/me` |

<a id="c-views-crmroutinecanvasview"></a>

### CrmRoutineCanvasView

- `restored/views/CrmRoutineCanvasView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePutSchedulersRoutinesBatchMutation` | `PUT crmClient /schedulers/{schedulerId}/routines/batch` |
| `useSchedulersByIdQuery` | `GET crmClient /schedulers/{args.id}` |

<a id="c-views-crmview"></a>

### CrmView

- `restored/views/CrmView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsHospitalAgreementsQuery` | `GET accountClient /terms/hospital-agreements` |

<a id="c-views-deskpaymentsview"></a>

### DeskPaymentsView

- `restored/views/DeskPaymentsView.vue` · 스토어 `useDeskDateStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskCashRegistersQuery` | `GET emrClient /desk/cash-registers` |
| `useDeskExpensesQuery` | `GET emrClient /desk/expenses` |
| `useDeskReceiptsQuery` | `GET emrClient /desk/receipts/{input}` |

<a id="c-views-deskvisitview"></a>

### DeskVisitView

- `restored/views/DeskVisitView.vue` · 스토어 `useDeskDateStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsByValueQuery` | `GET emrClient <"/desk/appointments?date=" + args.value>` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |

<a id="c-views-documentissueview"></a>

### DocumentIssueView

- `restored/views/DocumentIssueView.vue` · 스토어 `useDocumentIssueStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `usePatchDocumentsDraftsMutation` | `PATCH emrClient /documents/drafts/{id}` |
| `usePostDocumentsDraftsMutation` | `POST emrClient /documents/drafts` |

<a id="c-views-electronicsignatureview"></a>

### ElectronicSignatureView

- `restored/views/ElectronicSignatureView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |

<a id="c-views-emrpatientsview"></a>

### EmrPatientsView

- `restored/views/EmrPatientsView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAsyncTasksQuery` | `GET emrClient /async-tasks/{input}` |
| `usePostAsyncTasksPatientExcelImportMutation` | `POST emrClient /async-tasks/patient-excel-import` |
| `usePostPatientsDownloadLogsMutation` | `POST emrClient /patients/download-logs` |
| `getCrmPatients` (직접) | `GET emrClient /crm/patients` |
| `getCrmPatientsCount` (직접) | `GET emrClient /crm/patients/count` |

<a id="c-views-hirasubmititemsview"></a>

### HiraSubmitItemsView

- `restored/views/HiraSubmitItemsView.vue` · 스토어 `useTreatmentWindowStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchPatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostRecordHiraPcmdChecklistMutation` | `POST emrClient /record/hira/pcmd-checklist` |
| `usePostRecordHiraPrescriptionsApprovalMutation` | `POST emrClient /record/hira/prescriptions/approval` |
| `useRecordHiraCarPcmdQuery` | `GET emrClient /record/hira/car-pcmd` |
| `useRecordHiraChunaQuery` | `GET emrClient /record/hira/chuna` |
| `useRecordHiraPcmdQuery` | `GET emrClient /record/hira/pcmd` |
| `useSettingsDoctorsQuery` | `GET emrClient /settings/doctors` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |

<a id="c-views-insuranceinquiryview"></a>

### InsuranceInquiryView

- `restored/views/InsuranceInquiryView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useHospitalTermsQuery` | `GET insuranceClient /hospital/terms` |
| `useSubscriptionsUsageQuery` | `GET insuranceClient /subscriptions/usage` |

<a id="c-views-insurancesubscriptionview"></a>

### InsuranceSubscriptionView

- `restored/views/InsuranceSubscriptionView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSubscriptionsCancelMutation` | `DELETE insuranceClient /subscriptions/cancel` |
| `usePatchSubscriptionsMutation` | `PATCH insuranceClient /subscriptions` |
| `usePlansQuery` | `GET insuranceClient /plans` |
| `usePostSubscriptionsCancelMutation` | `POST insuranceClient /subscriptions/cancel` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useSubscriptionsQuery` | `GET insuranceClient /subscriptions` |
| `getHospitalPaymentMethods` (직접) | `GET insuranceClient /hospital/payment-methods` |
| `getHospitalPaymentMethodsPartnerPay` (직접) | `GET insuranceClient /hospital/payment-methods/partner-pay` |
| `getSubscriptionsChangePreview` (직접) | `GET insuranceClient /subscriptions/change-preview` |

<a id="c-views-layoutview"></a>

### LayoutView

- `restored/views/LayoutView.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getSettingsRecord` (직접) | `GET emrClient /settings/record` |
| `getSettingsReferencesReimbursementAvailableDates` (직접) | `GET emrClient /settings/references/reimbursement-available-dates` |
| `getSettingsReferencesReimbursementCodes` (직접) | `GET emrClient /settings/references/reimbursement-codes` |
| `getJaboReimbursement20260101Json` (직접) | `GET staticClient <JABO_REIMBURSEMENT_20250108_JSON_PATH>` |
| `getJaboReimbursement20260101Json` (직접) | `GET staticClient <JABO_REIMBURSEMENT_20260101_JSON_PATH>` |
| `getKcd20260101Json` (직접) | `GET staticClient <KCD_20250722_JSON_PATH>` |
| `getKcd20260101Json` (직접) | `GET staticClient <KCD_20260101_JSON_PATH>` |
| `getRareDiseases20241018Json` (직접) | `GET staticClient <RARE_DISEASES_20241018_JSON_PATH>` |

<a id="c-views-loginview"></a>

### LoginView

- `restored/views/LoginView.vue` · 스토어 `useDeskDateStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postLogin` (직접) | `POST authClient /login` |
| `postSsoLinkToken` (직접) | `POST authClient /sso/link-token` |

<a id="c-views-medicalaidsview"></a>

### MedicalAidsView

- `restored/views/MedicalAidsView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useNhicM3Query_2` | `GET emrClient /nhic/m3` |

<a id="c-views-membersview"></a>

### MembersView

- `restored/views/MembersView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `Ee` (직접) | `GET accountClient /integrations/members/subscribers` |
| `postTokenRefresh` (직접) | `POST authClient /token/refresh` |

<a id="c-views-messagesendcompletedview"></a>

### MessageSendCompletedView

- `restored/views/MessageSendCompletedView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getMessagesSendGroups_2` (직접) | `GET crmClient /messages/send/groups/{id}` |

<a id="c-views-messageview"></a>

### MessageView

- `restored/views/MessageView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchBillingPaymentMethodsDefaultQuery` | `GET crmClient /billing/payment-methods/default` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteMessagesSendGroupsMutation` | `DELETE crmClient /messages/send/groups/{id}` |
| `useMessagesResultsReceiversKakaoQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}/kakao` |
| `useMessagesResultsReceiversQuery` | `GET crmClient /messages/results/{id}/receivers/{receiverId}` |
| `useMessagesSendGroupsReceiversCountQuery` | `GET crmClient /messages/send/groups/{id}/receivers/count` |
| `useMessagesSendGroupsReceiversMarketingConsentUndecidedQuery` | `GET crmClient /messages/send/groups/{id}/receivers/marketing-consent-undecided` |
| `usePostMessagesSendGroupsMutation` | `POST crmClient /messages/send/groups` |
| `usePostMessagesSendMutation` | `POST crmClient /messages/send` |
| `usePutMessagesSendGroupsMutation` | `PUT crmClient /messages/send/groups/{id}` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getMessagesKakaoTemplatesById` (직접) | `GET crmClient /messages/kakao-templates/{args.id}` |
| `getMessagesSendGroups` (직접) | `GET crmClient /messages/send/groups` |
| `getMessagesSendGroups_2` (직접) | `GET crmClient /messages/send/groups/{id}` |
| `getMessagesSendGroupsReceiversDuplicates` (직접) | `GET crmClient /messages/send/groups/{id}/receivers/duplicates` |
| `getMessagesTemplatesByTemplateTypeAndId` (직접) | `GET crmClient /messages/templates/{args.templateType}/{args.id}` |
| `getMessagesSendGroupsReceivers` (직접) | `GET crmClient messages/send/groups/{id}/receivers` |
| `putMessagesKakaoAlimtalkGroups` (직접) | `PUT crmClient /messages/kakao/alimtalk/groups/{id}` |
| `putMessagesKakaoBrandGroups` (직접) | `PUT crmClient /messages/kakao/brand/groups/{id}` |

<a id="c-views-nonbenefitpatientsview"></a>

### NonBenefitPatientsView

- `restored/views/NonBenefitPatientsView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskAppointmentsOrderLiteQuery` | `GET emrClient /desk/appointments/order/lite/{input}` |
| `useDeskAppointmentsTelemedicineCancelledQuery` | `GET emrClient /desk/appointments/telemedicine/cancelled` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |
| `usePatchCrmNonbenefitPatientsRestartMutation` | `PATCH emrClient /crm/nonbenefit-patients/restart` |
| `usePatchCrmNonbenefitPatientsTerminateMutation` | `PATCH emrClient /crm/nonbenefit-patients/terminate` |
| `useSettingsNonbenefitsV2Query` | `GET emrClient /settings/nonbenefits/v2` |
| `getMessagesSendGroupsReceiversCount` (직접) | `GET crmClient /messages/send/groups/{id}/receivers/count` |
| `getCrmNonbenefitPatients` (직접) | `GET emrClient /crm/nonbenefit-patients` |
| `postMessagesSendGroups` (직접) | `POST crmClient /messages/send/groups` |
| `postMessagesSendGroupsReceiversAddEmrPatients` (직접) | `POST crmClient messages/send/groups/{id}/receivers/add/emr-patients` |

<a id="c-views-ocsv2ordercreateview"></a>

### OcsV2OrderCreateView

- `restored/views/OcsV2OrderCreateView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useBillingPaymentMethodsQuery` | `GET crmClient /billing/payment-methods` |
| `useDeleteOcsv2DraftsMutation` | `DELETE emrClient {u}/drafts/{draftId}` |
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useOcsv2ContractQuery` | `GET emrClient {u}/contract` |
| `useOcsv2DispensaryQuery` | `GET emrClient /ocsv2/dispensary` |
| `useOcsv2DraftsQuery` | `GET emrClient {u}/drafts` |
| `useOcsv2DraftsSnapshotsQuery` | `GET emrClient {u}/drafts/{input}/snapshots` |
| `useOcsv2EligibilityQuery` | `GET emrClient {u}/eligibility` |
| `useOcsv2HerbsSearchQuery` | `POST emrClient {u}/herbs/search` |
| `useOcsv2OrderOptionsQuery` | `GET emrClient {u}/order-options` |
| `useOcsv2OrdersStatusQuery` | `GET emrClient {u}/orders/{input}/status` |
| `usePatchOcsv2DraftsMutation` | `PATCH emrClient {u}/drafts/{draftId}` |
| `usePatientsListQuery` | `GET emrClient /patients/list` |
| `usePostOcsv2DraftsMutation` | `POST emrClient {u}/drafts` |
| `usePostOcsv2OrderMutation` | `POST emrClient {u}/order` |
| `usePostOcsv2QuoteMutation` | `POST emrClient {u}/quote` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |
| `getSettingsNonreimbursedHerbTemplates_2` (직접) | `GET emrClient {SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH}/{input}` |
| `getSettingsReferenceFormulas` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/{source}/{id}` |
| `getSettingsReferenceFormulasSearch` (직접) | `GET emrClient {SETTINGS_REFERENCE_FORMULAS_PATH}/search` |
| `getOcsv2Drafts_2` (직접) | `GET emrClient {u}/drafts/{input}` |
| `getOcs` (직접) | `GET emrClient /ocs/{ocsId}` |
| `getPatients` (직접) | `GET emrClient /patients/{input}` |
| `getRecordPatient` (직접) | `GET emrClient /record/patient/{pid}` |
| `getSettingsNonreimbursedHerbTemplates` (직접) | `GET emrClient <SETTINGS_NONREIMBURSED_HERB_TEMPLATES_PATH>` |
| `patchOcsv2OrdersInfo` (직접) | `PATCH emrClient {u}/orders/{input}/info` |
| `postOcsv2DraftsMedicationGuide` (직접) | `POST emrClient {u}/drafts/{input}/medication-guide` |
| `postOcsv2OrdersCancel` (직접) | `POST emrClient {u}/orders/{draftId}/cancel` |
| `postOcsv2OrdersHold` (직접) | `POST emrClient {u}/orders/{input}/hold` |
| `postOcsv2OrdersUnhold` (직접) | `POST emrClient {u}/orders/{input}/unhold` |
| `postOcsv2Precheck` (직접) | `POST emrClient {u}/precheck` |
| `postOcsv2PricePreview` (직접) | `POST emrClient {u}/price-preview` |

<a id="c-views-ocsv2orderlistview"></a>

### OcsV2OrderListView

- `restored/views/OcsV2OrderListView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeleteOcsv2DraftsMutation` | `DELETE emrClient {u}/drafts/{draftId}` |
| `useOcsv2DraftsQuery` | `GET emrClient {u}/drafts` |
| `useOcsv2DraftsQuery_2` | `GET emrClient {u}/drafts/{input}` |
| `usePatientsQuery` | `GET emrClient /patients/{input}` |
| `usePostOcsv2OrdersCancelMutation` | `POST emrClient {u}/orders/{draftId}/cancel` |
| `getOcsv2OrdersStatus` (직접) | `GET emrClient {u}/orders/{input}/status` |
| `postOcsv2OrdersHold` (직접) | `POST emrClient {u}/orders/{input}/hold` |

<a id="c-views-onboardingview"></a>

### OnboardingView

- `restored/views/OnboardingView.vue` · 스토어 `useLiteSignUpStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAccountApplicationApplicationsQuery` | `GET accountApplicationClient /account-application/applications` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |

<a id="c-views-ondanggateview"></a>

### OndangGateView

- `restored/views/OndangGateView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSubscriptionsLiteProQuery` | `GET emrClient /subscriptions/lite-pro` |

<a id="c-views-ondangsignupformview"></a>

### OndangSignUpFormView

- `restored/views/OndangSignUpFormView.vue` · 스토어 `useOndangSignUpStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useIntegrationsOnboardingWontangProfileQuery` | `GET accountApplicationClient {INTEGRATIONS_ONBOARDING_WONTANG_PATH}/profile` |
| `useTermsQuery` | `GET accountApplicationClient /terms` |
| `getIntegrationsOnboardingLiteProfile` (직접) | `GET accountApplicationClient /integrations/onboarding/lite/profile` |
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postIntegrationsOnboardingWontangSignup` (직접) | `POST accountApplicationClient {INTEGRATIONS_ONBOARDING_WONTANG_PATH}/signup` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |
| `postIntegrationsOnboardingLiteSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/lite/signup` |

<a id="c-views-remotesettlementview"></a>

### RemoteSettlementView

- `restored/views/RemoteSettlementView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-views-requiredview"></a>

### RequiredView

- `restored/views/RequiredView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSigningDailyCopaymentLedgersCountQuery` | `GET emrClient /signing/daily-copayment-ledgers/count` |
| `useSigningMedicalRecordsCountQuery` | `GET emrClient /signing/medical-records/count` |

<a id="c-views-servicesignupformview"></a>

### ServiceSignUpFormView

- `restored/views/ServiceSignUpFormView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getAuthMe` (직접) | `GET emrClient /auth/me` |

<a id="c-views-settinghospitalview"></a>

### SettingHospitalView

- `restored/views/SettingHospitalView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useMembersEmrClinicsMyQuery` | `GET liteClient /members/emr/clinics/my` |
| `usePatchMembersEmrClinicsMyMutation` | `PATCH liteClient /members/emr/clinics/my` |
| `usePatchSettingsHospitalsMutation` | `PATCH emrClient /settings/hospitals` |
| `usePatchSettingsHospitalsMutation_2` | `PATCH emrClient /settings/hospitals` |
| `usePostNhicCertFilesMutation` | `POST emrClient /nhic/cert-files` |
| `usePutTermsOptionalAgreementsMutation` | `PUT accountClient /terms/optional-agreements` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useTermsMyAgreementsQuery` | `GET accountClient /terms/my-agreements` |
| `getChangeRequestsDocument` (직접) | `GET accountClient {mI}/{id}/document` |
| `getNhicCertFiles` (직접) | `GET emrClient /nhic/cert-files` |
| `postSettingsImagesPrivate` (직접) | `POST emrClient /settings/images/private` |

<a id="c-views-settingprescriptionview"></a>

### SettingPrescriptionView

- `restored/views/SettingPrescriptionView.vue` · 스토어 `useOnboardingGuideSessionStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useSettingsHospitalsQuery` | `GET emrClient /settings/hospitals` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-views-settingprescriptionviewchubyakprescriptionsconfiglistview"></a>

### SettingPrescriptionViewChubyakPrescriptionsConfigListView

- `restored/views/SettingPrescriptionViewChubyakPrescriptionsConfigListView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useSettingChubyakPrescriptionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteSettingsHospitalsChubyakPilotsPrescriptionsMutation` | `DELETE emrClient /settings/hospitals/chubyak-pilots/prescriptions/{input}` |
| `useSettingsHospitalsChubyakPilotsPrescriptionsQuery` | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `getSettingsHospitalsChubyakPilotsPrescriptionsById` (직접) | `GET emrClient /settings/hospitals/chubyak-pilots/prescriptions/{args.id}` |

<a id="c-views-settingserviceintegrationview"></a>

### SettingServiceIntegrationView

- `restored/views/SettingServiceIntegrationView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useLiteSignUpStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `usePostIntegrationsLiteLinkMutation` | `POST accountClient /integrations/lite/link` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |

<a id="c-views-settingview"></a>

### SettingView

- `restored/views/SettingView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |

<a id="c-views-litesignupformview"></a>

### LiteSignUpFormView

- `restored/views/LiteSignUpFormView.vue` · 스토어 `useLiteSignUpStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useTermsQuery` | `GET accountApplicationClient /terms` |
| `getIntegrationsOnboardingLiteEmployees` (직접) | `GET accountApplicationClient /integrations/onboarding/lite/employees` |
| `postAuthCheckUsernameOnboarding` (직접) | `POST accountApplicationClient /auth/check-username-onboarding` |
| `postIntegrationsOnboardingInsuranceSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/insurance/signup` |
| `postIntegrationsOnboardingLiteSignup` (직접) | `POST accountApplicationClient /integrations/onboarding/lite/signup` |
| `postIntegrationsLiteLink` (직접) | `POST accountClient /integrations/lite/link` |

<a id="c-views-tabletaccountview"></a>

### TabletAccountView

- `restored/views/TabletAccountView.vue` · 스토어 `useOnboardingGuideSessionStore`, `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteTabletAccountsMutation` | `DELETE accountClient /tablet/accounts/{input}` |
| `useDeleteTabletSessionsMutation` | `DELETE accountClient /tablet/sessions` |
| `useDeleteTabletSessionsMutation_2` | `DELETE accountClient /tablet/sessions/{input}` |
| `usePatchTabletAccountsMutation` | `PATCH accountClient /tablet/accounts/{id}` |
| `usePostTabletAccountsMutation` | `POST accountClient /tablet/accounts` |
| `useSettingsOnboardingGuideQuery` | `GET emrClient /settings/onboarding-guide` |
| `useTabletAccountsQuery` | `GET accountClient /tablet/accounts` |
| `useTabletSessionsQuery` | `GET accountClient /tablet/sessions` |
| `getTabletSettingsLanguages` (직접) | `GET emrClient /tablet/settings/languages` |
| `putTabletSettingsLanguages` (직접) | `PUT emrClient /tablet/settings/languages` |

<a id="c-views-tabletauthlinkview"></a>

### TabletAuthLinkView

- `restored/views/TabletAuthLinkView.vue` · 스토어 `useDeskDateStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `getAuthMe` (직접) | `GET emrClient /auth/me` |
| `postSsoExchange` (직접) | `POST authClient /sso/exchange` |

<a id="c-views-termscontentview"></a>

### TermsContentView

- `restored/views/TermsContentView.vue`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useMarketingAgreementTermsListQuery` | `GET ssoClient /marketing-agreement/terms/list` |

<a id="c-views-treatmentrepeatresultsview"></a>

### TreatmentRepeatResultsView

- `restored/views/TreatmentRepeatResultsView.vue` · 스토어 `useRepeatedTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchRecordQuery` | `GET emrClient /record/{input}` |
| `usePatchDeskWaitingByIdMutation_2` | `PATCH emrClient <"/desk/waiting/" + input.id>` |

<a id="c-views-treatmentroomsview"></a>

### TreatmentRoomsView

- `restored/views/TreatmentRoomsView.vue` · 스토어 `useToastNotificationStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `prefetchDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `prefetchSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `prefetchTreatmentsPatientsQuery` | `GET emrClient /treatments/patients` |
| `useAuthMeQuery` | `GET emrClient /auth/me` |
| `useDeleteTreatmentsGroupsMutation` | `DELETE emrClient /treatments/groups/{id}` |
| `useDeleteTreatmentsProceduresMutation` | `DELETE emrClient /treatments/procedures/{actingId}` |
| `usePatchTreatmentsProceduresMutation` | `PATCH emrClient /treatments/procedures/{actingId}` |
| `usePatchTreatmentsProceduresOrderMutation` | `PATCH emrClient /treatments/procedures/order` |
| `usePostTreatmentsGroupsMutation` | `POST emrClient /treatments/groups` |
| `usePostTreatmentsProceduresApplyGroupMutation` | `POST emrClient /treatments/procedures/apply-group` |
| `usePostTreatmentsProceduresFromPopoverMutation` | `POST emrClient /treatments/procedures/from-popover` |
| `usePostTreatmentsProceduresGroupCompleteMutation` | `POST emrClient /treatments/procedures/group/complete` |
| `usePostTreatmentsProceduresGroupStartMutation` | `POST emrClient /treatments/procedures/group/start` |
| `usePostTreatmentsProceduresRestartMutation` | `POST emrClient /treatments/procedures/{actingId}/restart` |
| `usePostTreatmentsProceduresStartMutation` | `POST emrClient /treatments/procedures/{actingId}/start` |
| `usePutTreatmentsGroupsMutation` | `PUT emrClient /treatments/groups/{id}` |
| `usePutTreatmentsPatientsMutation` | `GET emrClient /settings/treatments/rooms`<br>`GET emrClient /treatments/patients`<br>`GET emrClient <"/desk/waiting?date=" + toValue(input)>`<br>`PUT emrClient /treatments/patients/{내원Id}` |
| `usePutTreatmentsTimerConfigMutation` | `PUT emrClient /treatments/timer-config` |
| `useSettingsTreatmentsRoomsQuery` | `GET emrClient /settings/treatments/rooms` |
| `useTreatmentsGroupsQuery` | `GET emrClient /treatments/groups` |
| `useTreatmentsPatientsQuery` | `GET emrClient /treatments/patients` |
| `useTreatmentsSnapshotQuery` | `GET emrClient /treatments/snapshot` |
| `useTreatmentsTimerConfigQuery` | `GET emrClient /treatments/timer-config` |
| `postTreatmentsProceduresComplete` (직접) | `POST emrClient /treatments/procedures/{actingId}/complete` |
| `postTreatmentsProceduresUncomplete` (직접) | `POST emrClient /treatments/procedures/{actingId}/uncomplete` |

<a id="c-views-treatmentview"></a>

### TreatmentView

- `restored/views/TreatmentView.vue` · 스토어 `useToastNotificationStore`, `useTreatmentStore`

| 훅 / 함수 | 엔드포인트 |
|---|---|
| `useDeskWaitingQuery` | `GET emrClient <"/desk/waiting?date=" + toValue(input)>` |
| `useMembersEmrConsultationsOrdersInvoiceQuery` | `GET liteClient members/emr/consultations/orders/{input}/invoice` |
| `useMembersEmrOrdersQuery` | `GET liteClient members/emr/orders/{input}` |
| `usePatchDeskTelemedicineConsultationsStatusMutation` | `PATCH emrClient /desk/telemedicine-consultations/{input}/status` |
| `postDeskTelemedicineConsultationsInvoice` (직접) | `POST emrClient /desk/telemedicine-consultations/{input}/invoice` |
