# 권한 코드 지도

`PermissionCode` enum의 각 코드가 어떤 라우트에 걸리고, 어떤 행위(`access`/`create`/`update`/`delete`/`write`) 검사로 어디에서 쓰이는지 `restored/`에서 정적으로 모은 문서입니다. 권한 체계 설명은 [access-control.md](access-control.md). 재생성: `pnpm permissions`

- enum: [PermissionCode$](../restored/modules/index/requiredRoleType.js#L1) · 코드 65개
- 행위 검사 함수: `canAccess$` (access), `canCreate$` (create), `canUpdate$` (update), `canDelete$` (delete), `canWrite$` (write)
- 코드를 직접 넘기는 검사 106곳 (문자열 리터럴 2곳 포함), 변수로 넘겨받은 값을 검사하는 곳 9곳
- 코드별 숫자는 정적으로 찾은 호출 수입니다. 0이어도 변수로 넘겨받는 검사나 다른 경로로 쓰일 수 있습니다

## 요약

| 권한 | 코드 | 라우트 | access | create | update | delete | write | 기타 참조 |
|---|---|---|---|---|---|---|---|---|
| [치료실](#treatment_rooms) | `treatment_rooms` | `/treatment-rooms`<br>`/tablet/treatment-rooms` | 1 |  |  |  |  |  |
| [예약관리](#appointment_planner) | `appointment_planner` | `/appointment-planner` |  |  |  |  |  |  |
| [탕전관리](#ocs) | `ocs` | `/ocs`<br>`/ocs/prescription/list`<br>`/ocs/prescription/create` |  |  |  |  |  |  |
| [메디원탕](#medi_ocs) | `medi_ocs` | `/ocs-v2-herb-order-create`<br>`/ocs-v2-herb-order-list` |  |  |  |  |  | 1 |
| [경영지표](#bi) | `bi` | `/analytics`<br>`/analytics/revenue`<br>`/analytics/appointment`<br>`/analytics/patient`<br>`/analytics/incoming-path`<br>`/analytics/doctor` |  |  |  |  |  | 1 |
| [환자상세](#patient_info) | `patient_info` |  | 7 |  |  |  |  |  |
| [예약생성](#appointment_create) | `appointment_create` |  |  | 12 |  |  |  |  |
| [예약수정](#appointment_update) | `appointment_update` |  |  |  | 8 |  |  |  |
| [예약삭제](#appointment_delete) | `appointment_delete` |  |  |  |  | 6 |  |  |
| [환자생성](#chart_create) | `chart_create` |  |  | 5 |  |  |  |  |
| [환자수정](#chart_update) | `chart_update` |  |  |  | 2 |  |  |  |
| [환자삭제](#chart_delete) | `chart_delete` |  |  |  |  | 1 |  |  |
| [접수생성](#waiting_create) | `waiting_create` |  |  | 13 |  |  |  |  |
| [접수수정](#waiting_update) | `waiting_update` |  |  |  | 11 |  |  |  |
| [접수삭제](#waiting_delete) | `waiting_delete` |  |  |  |  | 2 |  |  |
| [수납생성](#receipt_create) | `receipt_create` |  |  | 3 |  |  |  |  |
| [수납수정](#receipt_update) | `receipt_update` |  |  |  |  |  |  |  |
| [수납삭제](#receipt_delete) | `receipt_delete` |  |  |  |  |  |  |  |
| [문서발급](#document_create) | `document_create` |  |  | 11 |  |  |  |  |
| [진료](#treatment) | `treatment` | `/treatment` | 8 |  |  |  |  |  |
| [처방생성수정삭제](#prescription_write) | `prescription_write` |  |  |  |  |  | 1 | 3 |
| [진료기록생성수정삭제](#treatment_write) | `treatment_write` |  |  |  |  |  |  | 3 |
| [PRN처방생성수정삭제](#prescription_prn_write) | `prescription_prn_write` |  |  |  |  |  |  | 1 |
| [전체환지](#all) | `all` |  |  |  |  |  |  |  |
| [담당환자](#owner_only) | `owner_only` |  |  |  |  |  |  | 4 |
| [고객관리](#crm) | `crm` | `/crm` |  |  |  |  |  |  |
| [연락목록](#call_list) | `call_list` | `/crm/consult-script`<br>`/crm/contacts`<br>`/crm/contacts-v2`<br>`/crm/soo-scheduler`<br>`/setting/consult-templates` |  |  |  |  |  | 1 |
| [환자목록](#patient_list) | `patient_list` | `/crm/patients` |  |  |  |  |  |  |
| [일반문자](#sms) | `sms` | `/crm/message`<br>`/crm/contents/view/:token`<br>`/crm/message/send-completed`<br>`/setting/contents` | 1 |  |  |  |  | 1 |
| [전송이력](#send_history) | `send_history` | `/crm/message/results` |  |  |  |  |  |  |
| [수신거부목록](#rejected_list) | `rejected_list` | `/crm/refusal` |  |  |  |  |  |  |
| [메시지템플릿관리](#message_template_setting) | `message_template_setting` | `/setting/message-templates` | 1 |  |  |  |  | 1 |
| [청구](#chunggu) | `chunggu` | `/claim`<br>`/claim/home-visit`<br>`/claim/telemedicine-pilot`<br>`/claim/year-settlement` |  |  |  |  |  |  |
| [심평원청구](#spw_chunggu) | `spw_chunggu` | `/claim/hira` |  |  |  |  |  |  |
| [추나첩약제출현황](#chuna_chubyak_submission) | `chuna_chubyak_submission` | `/claim/hira-submit-items` |  |  |  |  |  |  |
| [의료급여진료승인현황](#medical_aid_approval) | `medical_aid_approval` | `/claim/medical-aids` |  |  |  |  |  |  |
| [일차의료방문현황](#home_visit_status) | `home_visit_status` |  |  |  |  |  |  |  |
| [결제메뉴접근](#billing) | `billing` | `/setting/billing` | 2 |  |  |  |  | 1 |
| [설정](#setting) | `setting` | `/setting` |  |  |  |  |  |  |
| [기본설정](#normal_setting) | `normal_setting` | `/setting/common`<br>`/setting/telemedicine`<br>`/setting/service-integration` | 2 |  |  |  |  |  |
| [병원정보설정](#info_setting) | `info_setting` | `/setting/hospital` |  |  |  |  |  |  |
| [진료설정](#record_setting) | `record_setting` | `/setting/treatment` |  |  |  |  |  |  |
| [처방수가설정](#prescription_setting) | `prescription_setting` | `/setting/prescription` | 1 |  |  |  |  |  |
| [상용구설정](#template_setting) | `template_setting` | `/setting/templates` |  |  |  |  |  |  |
| [예약설정](#appointment_setting) | `appointment_setting` | `/setting/appointment` |  |  |  |  |  |  |
| [발신번호설정](#caller_number_setting) | `caller_number_setting` | `/setting/caller-numbers` |  |  |  |  |  |  |
| [계정권한설정](#system_setting) | `system_setting` | `/setting/account-permission` |  |  |  |  |  |  |
| [태블릿설정](#tablet_settings) | `tablet_settings` |  |  |  |  |  |  |  |
| [진료스케줄설정](#schedule_setting) | `schedule_setting` | `/setting/schedule` |  |  |  |  |  |  |
| [비대면정산](#remote_settlement) | `remote_settlement` |  |  |  |  |  |  |  |
| [재무](#finance) | `finance` |  | 1 |  |  |  |  | 2 |
| [재무매출조회](#finance_sales) | `finance_sales` |  |  |  |  |  |  | 1 |
| [재무지출조회](#finance_expense) | `finance_expense` |  |  |  |  |  |  | 2 |
| [재무지출작성](#finance_expense_write) | `finance_expense_write` |  |  |  |  |  |  |  |
| [재무지출삭제](#finance_expense_delete) | `finance_expense_delete` |  |  |  |  |  |  |  |
| [재무결재조회](#finance_approval) | `finance_approval` |  |  |  |  |  |  |  |
| [재무결재작성](#finance_approval_write) | `finance_approval_write` |  |  |  |  |  |  |  |
| [재무결재삭제](#finance_approval_delete) | `finance_approval_delete` |  |  |  |  |  |  |  |
| [재무결재강제완료](#finance_approval_force_complete) | `finance_approval_force_complete` |  |  |  |  |  |  |  |
| [재무손익조회](#finance_pnl) | `finance_pnl` |  |  |  |  |  |  | 2 |
| [재무예산조회](#finance_budget) | `finance_budget` |  |  |  |  |  |  | 1 |
| [재무예산작성](#finance_budget_write) | `finance_budget_write` |  |  |  |  |  |  |  |
| [재무예산삭제](#finance_budget_delete) | `finance_budget_delete` |  |  |  |  |  |  |  |
| [재무현금흐름조회](#finance_cashflow) | `finance_cashflow` |  |  |  |  |  |  | 1 |
| [재무지출수집](#finance_expense_collect) | `finance_expense_collect` |  |  |  |  |  |  | 1 |

## 코드별 사용처

<a id="treatment_rooms"></a>

### 치료실 · `treatment_rooms`

- 라우트: `/treatment-rooms`, `/tablet/treatment-rooms`
- `access`: [App.helpers-2](../restored/components/app/App.helpers-2.js#L13)

<a id="appointment_planner"></a>

### 예약관리 · `appointment_planner`

- 라우트: `/appointment-planner`

<a id="ocs"></a>

### 탕전관리 · `ocs`

- 라우트: `/ocs`, `/ocs/prescription/list`, `/ocs/prescription/create`

<a id="medi_ocs"></a>

### 메디원탕 · `medi_ocs`

- 라우트: `/ocs-v2-herb-order-create`, `/ocs-v2-herb-order-list`
- 값으로 참조: [Group](../restored/modules/index/Group.js#L109) (`permissionCode`)

<a id="bi"></a>

### 경영지표 · `bi`

- 라우트: `/analytics`, `/analytics/revenue`, `/analytics/appointment`, `/analytics/patient`, `/analytics/incoming-path`, `/analytics/doctor`
- 값으로 참조: [part-255](../restored/modules/index/part-255.js#L43)

<a id="patient_info"></a>

### 환자상세 · `patient_info`

- `access`: [ClaimV2CommonEditPanelPrototypePatientInfo.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypePatientInfo.vue.js#L320), [PatientCardActions.vue](../restored/components/patient/PatientCardActions.vue.js#L50), [TangjeonCreateTreatmentRecordCard.vue](../restored/components/tangjeon/TangjeonCreateTreatmentRecordCard.vue.js#L77), [TreatmentViewBoardPatientInfo.vue](../restored/components/treatment/TreatmentViewBoardPatientInfo.vue.js#L350), [part-86](../restored/modules/index/part-86.js#L49), [DeskVisitView.vue](../restored/views/DeskVisitView.vue.js#L216)

<a id="appointment_create"></a>

### 예약생성 · `appointment_create`

- `create`: [AppointmentCardContextMenuWrapper.vue](../restored/components/appointment/AppointmentCardContextMenuWrapper.vue.js#L126), [AppointmentPlannerDailyCell.vue](../restored/components/appointment/AppointmentPlannerDailyCell.vue.js#L158), [AppointmentPlannerWeeklyCell.vue](../restored/components/appointment/AppointmentPlannerWeeklyCell.vue.js#L132), [EmrPatientsViewTableActions.vue](../restored/components/emr/EmrPatientsViewTableActions.vue.js#L44), [HeaderLayout.vue](../restored/components/header/HeaderLayout.vue.js#L157), [PatientAutoCompleteResultItems.vue](../restored/components/patient/PatientAutoCompleteResultItems.vue.js#L344), [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PatientCardAppointment.vue](../restored/components/patient/PatientCardAppointment.vue.js#L338), [PatientCardFolded.vue](../restored/components/patient/PatientCardFolded.vue.js#L301), [PatientCardFoldedAppointment.vue](../restored/components/patient/PatientCardFoldedAppointment.vue.js#L236), [part-86](../restored/modules/index/part-86.js#L65)

<a id="appointment_update"></a>

### 예약수정 · `appointment_update`

- `update`: [AppointmentCardContextMenuWrapper.vue](../restored/components/appointment/AppointmentCardContextMenuWrapper.vue.js#L126), [AppointmentCardDroppableAreaWrapper.vue](../restored/components/appointment/AppointmentCardDroppableAreaWrapper.vue.js#L160), [PatientCardAppointment.vue](../restored/components/patient/PatientCardAppointment.vue.js#L338), [PatientCardFoldedAppointment.vue](../restored/components/patient/PatientCardFoldedAppointment.vue.js#L236), [PatientInfoAppointmentHistory.vue](../restored/components/patient/PatientInfoAppointmentHistory.vue.js#L360), [PatientInfoAppointmentHistoryCard.vue](../restored/components/patient/PatientInfoAppointmentHistoryCard.vue.js#L109), [part-86](../restored/modules/index/part-86.js#L73)

<a id="appointment_delete"></a>

### 예약삭제 · `appointment_delete`

- `delete`: [AppointmentCardContextMenuWrapper.vue](../restored/components/appointment/AppointmentCardContextMenuWrapper.vue.js#L126), [PatientCardAppointment.vue](../restored/components/patient/PatientCardAppointment.vue.js#L338), [PatientCardFoldedAppointment.vue](../restored/components/patient/PatientCardFoldedAppointment.vue.js#L236), [PatientInfoAppointmentHistory.vue](../restored/components/patient/PatientInfoAppointmentHistory.vue.js#L421), [PatientInfoAppointmentHistoryCard.vue](../restored/components/patient/PatientInfoAppointmentHistoryCard.vue.js#L114)

<a id="chart_create"></a>

### 환자생성 · `chart_create`

- `create`: [HeaderLayout.vue](../restored/components/header/HeaderLayout.vue.js#L176), [TreatmentColumn.vue](../restored/components/treatment/TreatmentColumn.vue.js#L176), [WaitingColumn.vue](../restored/components/waiting/WaitingColumn.vue.js#L215), [part-86](../restored/modules/index/part-86.js#L17)

<a id="chart_update"></a>

### 환자수정 · `chart_update`

- `update`: [EmrPatientsViewTableActions.vue](../restored/components/emr/EmrPatientsViewTableActions.vue.js#L54), [part-86](../restored/modules/index/part-86.js#L25)

<a id="chart_delete"></a>

### 환자삭제 · `chart_delete`

- `delete`: [EmrPatientsViewTableActions.vue](../restored/components/emr/EmrPatientsViewTableActions.vue.js#L59)

<a id="waiting_create"></a>

### 접수생성 · `waiting_create`

- `create`: [AppointmentCardContextMenuWrapper.vue](../restored/components/appointment/AppointmentCardContextMenuWrapper.vue.js#L126), [EmrPatientsViewTableActions.vue](../restored/components/emr/EmrPatientsViewTableActions.vue.js#L49), [HeaderLayout.vue](../restored/components/header/HeaderLayout.vue.js#L181), [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PatientCardAppointment.vue](../restored/components/patient/PatientCardAppointment.vue.js#L338), [PatientCardFolded.vue](../restored/components/patient/PatientCardFolded.vue.js#L301), [PatientCardFoldedAppointment.vue](../restored/components/patient/PatientCardFoldedAppointment.vue.js#L236), [PatientInfoAppointmentHistory.vue](../restored/components/patient/PatientInfoAppointmentHistory.vue.js#L376), [TreatmentColumn.vue](../restored/components/treatment/TreatmentColumn.vue.js#L159), [WaitingColumn.vue](../restored/components/waiting/WaitingColumn.vue.js#L198), [part-86](../restored/modules/index/part-86.js#L136)

<a id="waiting_update"></a>

### 접수수정 · `waiting_update`

- `update`: [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PatientCardFolded.vue](../restored/components/patient/PatientCardFolded.vue.js#L301), [PaymentColumn.vue](../restored/components/payment/PaymentColumn.vue.js#L131), [PaymentCompleteColumn.vue](../restored/components/payment/PaymentCompleteColumn.vue.js#L128), [TreatmentColumn.vue](../restored/components/treatment/TreatmentColumn.vue.js#L243), [TreatmentRoomBedAssignModal.vue](../restored/components/treatment/TreatmentRoomBedAssignModal.vue.js#L311), [TreatmentViewBoardJejuSupportPanel.vue](../restored/components/treatment/TreatmentViewBoardJejuSupportPanel.vue.js#L103), [WaitingColumn.vue](../restored/components/waiting/WaitingColumn.vue.js#L293), [part-86](../restored/modules/index/part-86.js#L41)

<a id="waiting_delete"></a>

### 접수삭제 · `waiting_delete`

- `delete`: [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PatientCardFolded.vue](../restored/components/patient/PatientCardFolded.vue.js#L301)

<a id="receipt_create"></a>

### 수납생성 · `receipt_create`

- `create`: [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PaymentColumn.vue](../restored/components/payment/PaymentColumn.vue.js#L225), [PaymentCompleteColumn.vue](../restored/components/payment/PaymentCompleteColumn.vue.js#L141)

<a id="receipt_update"></a>

### 수납수정 · `receipt_update`

- _참조 없음_

<a id="receipt_delete"></a>

### 수납삭제 · `receipt_delete`

- _참조 없음_

<a id="document_create"></a>

### 문서발급 · `document_create`

- `create`: [ClaimV2CommonEditPanelPrototypePatientInfo.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypePatientInfo.vue.js#L327), [EmrPatientsViewTableActions.vue](../restored/components/emr/EmrPatientsViewTableActions.vue.js#L59), [HerbalPrescriptionUnassignedIssuePanel.vue](../restored/components/herbal/HerbalPrescriptionUnassignedIssuePanel.vue.js#L88), [PatientCard.vue](../restored/components/patient/PatientCard.vue.js#L262), [PatientCardAppointment.vue](../restored/components/patient/PatientCardAppointment.vue.js#L338), [PatientCardFolded.vue](../restored/components/patient/PatientCardFolded.vue.js#L301), [PatientCardFoldedAppointment.vue](../restored/components/patient/PatientCardFoldedAppointment.vue.js#L236), [TreatmentViewBoardPatientInfo.vue](../restored/components/treatment/TreatmentViewBoardPatientInfo.vue.js#L381), [part-86](../restored/modules/index/part-86.js#L57)

<a id="treatment"></a>

### 진료 · `treatment`

- 라우트: `/treatment`
- `access`: [JaboVisitDaysModal.vue](../restored/components/jabo/JaboVisitDaysModal.vue.js#L59), [PatientCardActions.vue](../restored/components/patient/PatientCardActions.vue.js#L50), [PaymentColumn.vue](../restored/components/payment/PaymentColumn.vue.js#L216), [PaymentCompleteColumn.vue](../restored/components/payment/PaymentCompleteColumn.vue.js#L221), [TangjeonCreateTreatmentRecordCard.vue](../restored/components/tangjeon/TangjeonCreateTreatmentRecordCard.vue.js#L77), [TreatmentColumn.vue](../restored/components/treatment/TreatmentColumn.vue.js#L263), [WaitingColumn.vue](../restored/components/waiting/WaitingColumn.vue.js#L324), [part-174](../restored/modules/index/part-174.js#L20)

<a id="prescription_write"></a>

### 처방생성수정삭제 · `prescription_write`

- `write`: [JaboVisitDaysModal.vue](../restored/components/jabo/JaboVisitDaysModal.vue.js#L58)
- 다른 함수에 전달: [ClaimV2CommonEditPanelPrototypeMain.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypeMain.vue.js#L589) (`bc`), [TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue](../restored/components/treatment/TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue.js#L115) (`h`), [part-32](../restored/modules/TreatmentViewBoard/part-32.js#L37) (`o`)

<a id="treatment_write"></a>

### 진료기록생성수정삭제 · `treatment_write`

- 다른 함수에 전달: [ClaimV2CommonEditPanelPrototypeMain.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypeMain.vue.js#L588) (`bc`), [TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue](../restored/components/treatment/TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue.js#L119) (`h`), [part-32](../restored/modules/TreatmentViewBoard/part-32.js#L35) (`o`)

<a id="prescription_prn_write"></a>

### PRN처방생성수정삭제 · `prescription_prn_write`

- 다른 함수에 전달: [DeskVisitPaymentCheckOutTreatmentCardDetail.vue](../restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue.js#L380) (`Drn`)

<a id="all"></a>

### 전체환지 · `all`

- _참조 없음_

<a id="owner_only"></a>

### 담당환자 · `owner_only`

- 값으로 참조: [ClaimV2CommonEditPanelPrototypeMain.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypeMain.vue.js#L990), [DeskVisitPaymentCheckOutTreatmentCardDetail.vue](../restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue.js#L387), [TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue](../restored/components/treatment/TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue.js#L104), [part-32](../restored/modules/TreatmentViewBoard/part-32.js#L32)

<a id="crm"></a>

### 고객관리 · `crm`

- 라우트: `/crm`

<a id="call_list"></a>

### 연락목록 · `call_list`

- 라우트: `/crm/consult-script`, `/crm/contacts`, `/crm/contacts-v2`, `/crm/soo-scheduler`, `/setting/consult-templates`
- 값으로 참조: [Group](../restored/modules/index/Group.js#L367) (`permissionCode`)

<a id="patient_list"></a>

### 환자목록 · `patient_list`

- 라우트: `/crm/patients`

<a id="sms"></a>

### 일반문자 · `sms`

- 라우트: `/crm/message`, `/crm/contents/view/:token`, `/crm/message/send-completed`, `/setting/contents`
- `access`: [part-86](../restored/modules/index/part-86.js#L81)
- 값으로 참조: [Group](../restored/modules/index/Group.js#L377) (`permissionCode`)

<a id="send_history"></a>

### 전송이력 · `send_history`

- 라우트: `/crm/message/results`

<a id="rejected_list"></a>

### 수신거부목록 · `rejected_list`

- 라우트: `/crm/refusal`

<a id="message_template_setting"></a>

### 메시지템플릿관리 · `message_template_setting`

- 라우트: `/setting/message-templates`
- `access`: [useAppointmentNotificationsSettingsQuery](../restored/modules/templatePermission/useAppointmentNotificationsSettingsQuery.js#L18)
- 값으로 참조: [Group](../restored/modules/index/Group.js#L372) (`permissionCode`)

<a id="chunggu"></a>

### 청구 · `chunggu`

- 라우트: `/claim`, `/claim/home-visit`, `/claim/telemedicine-pilot`, `/claim/year-settlement`

<a id="spw_chunggu"></a>

### 심평원청구 · `spw_chunggu`

- 라우트: `/claim/hira`

<a id="chuna_chubyak_submission"></a>

### 추나첩약제출현황 · `chuna_chubyak_submission`

- 라우트: `/claim/hira-submit-items`

<a id="medical_aid_approval"></a>

### 의료급여진료승인현황 · `medical_aid_approval`

- 라우트: `/claim/medical-aids`

<a id="home_visit_status"></a>

### 일차의료방문현황 · `home_visit_status`

- _참조 없음_

<a id="billing"></a>

### 결제메뉴접근 · `billing`

- 라우트: `/setting/billing`
- `access`: [requests-4](../restored/api/crm/requests-4.js#L27), [queries-3](../restored/api/messages/queries-3.js#L44)
- 값으로 참조: [Group](../restored/modules/index/Group.js#L401) (`permissionCode`)

<a id="setting"></a>

### 설정 · `setting`

- 라우트: `/setting`

<a id="normal_setting"></a>

### 기본설정 · `normal_setting`

- 라우트: `/setting/common`, `/setting/telemedicine`, `/setting/service-integration`
- `access`: [HolidayPrepBanner.helpers](../restored/components/holiday/HolidayPrepBanner.helpers.js#L40), [OndangContractRequiredModal.vue](../restored/components/ondang/OndangContractRequiredModal.vue.js#L43)

<a id="info_setting"></a>

### 병원정보설정 · `info_setting`

- 라우트: `/setting/hospital`

<a id="record_setting"></a>

### 진료설정 · `record_setting`

- 라우트: `/setting/treatment`

<a id="prescription_setting"></a>

### 처방수가설정 · `prescription_setting`

- 라우트: `/setting/prescription`
- `access`: [TreatmentViewBoardFooter.vue](../restored/components/treatment/TreatmentViewBoardFooter.vue.js#L393)

<a id="template_setting"></a>

### 상용구설정 · `template_setting`

- 라우트: `/setting/templates`

<a id="appointment_setting"></a>

### 예약설정 · `appointment_setting`

- 라우트: `/setting/appointment`

<a id="caller_number_setting"></a>

### 발신번호설정 · `caller_number_setting`

- 라우트: `/setting/caller-numbers`

<a id="system_setting"></a>

### 계정권한설정 · `system_setting`

- 라우트: `/setting/account-permission`

<a id="tablet_settings"></a>

### 태블릿설정 · `tablet_settings`

- _참조 없음_

<a id="schedule_setting"></a>

### 진료스케줄설정 · `schedule_setting`

- 라우트: `/setting/schedule`

<a id="remote_settlement"></a>

### 비대면정산 · `remote_settlement`

- _참조 없음_

<a id="finance"></a>

### 재무 · `finance`

- `access`: [part-74](../restored/modules/index/part-74.js#L75)
- 값으로 참조: [Group](../restored/modules/index/Group.js#L244) (`permissionCode`), [part-74](../restored/modules/index/part-74.js#L75)

<a id="finance_sales"></a>

### 재무매출조회 · `finance_sales`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L7)

<a id="finance_expense"></a>

### 재무지출조회 · `finance_expense`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L11)

<a id="finance_expense_write"></a>

### 재무지출작성 · `finance_expense_write`

- _참조 없음_

<a id="finance_expense_delete"></a>

### 재무지출삭제 · `finance_expense_delete`

- _참조 없음_

<a id="finance_approval"></a>

### 재무결재조회 · `finance_approval`

- _참조 없음_

<a id="finance_approval_write"></a>

### 재무결재작성 · `finance_approval_write`

- _참조 없음_

<a id="finance_approval_delete"></a>

### 재무결재삭제 · `finance_approval_delete`

- _참조 없음_

<a id="finance_approval_force_complete"></a>

### 재무결재강제완료 · `finance_approval_force_complete`

- _참조 없음_

<a id="finance_pnl"></a>

### 재무손익조회 · `finance_pnl`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L15)

<a id="finance_budget"></a>

### 재무예산조회 · `finance_budget`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L19)

<a id="finance_budget_write"></a>

### 재무예산작성 · `finance_budget_write`

- _참조 없음_

<a id="finance_budget_delete"></a>

### 재무예산삭제 · `finance_budget_delete`

- _참조 없음_

<a id="finance_cashflow"></a>

### 재무현금흐름조회 · `finance_cashflow`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L23)

<a id="finance_expense_collect"></a>

### 재무지출수집 · `finance_expense_collect`

- 값으로 참조: [part-60](../restored/modules/index/part-60.js#L27)

## enum에 없는 코드

`PermissionCode`를 거치지 않고 문자열로만 검사하는 코드입니다.

| 코드 | 행위 | 위치 |
|---|---|---|
| `copayment_digital_signature` | `create` | [CopaymentCollectionLedger-2.vue](../restored/components/copayment/CopaymentCollectionLedger-2.vue.js#L123), [RequiredView.vue](../restored/views/RequiredView.vue.js#L92) |
| `record_digital_signature` | `create` | [MedicalRecord-2.vue](../restored/components/medical/MedicalRecord-2.vue.js#L153) |
| `digital_signature` | `access` | [ElectronicSignatureView.vue](../restored/views/ElectronicSignatureView.vue.js#L69) |

## 넘겨받은 값을 검사하는 곳

라우트 `meta.permissionCode`나 메뉴 정의처럼 코드를 변수로 받아 검사하는 곳입니다.

| 행위 | 위치 | 인자 |
|---|---|---|
| `write` | [ClaimV2CommonEditPanelPrototypeMain.vue](../restored/components/claim/ClaimV2CommonEditPanelPrototypeMain.vue.js#L990) | `B?.권한코드 \|\| ""` |
| `write` | [DeskVisitPaymentCheckOutTreatmentCardDetail.vue](../restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue.js#L381) | `a?.권한코드 \|\| ""` |
| `access` | [OnboardingGuidePanel.helpers-4](../restored/components/onboarding/OnboardingGuidePanel.helpers-4.js#L21) | `meta.permissionCode` |
| `write` | [TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue](../restored/components/treatment/TreatmentViewBoardPrescriptionCarRecommendedEditModal.vue.js#L101) | `r.권한코드 \|\| ""` |
| `access` | [part-196](../restored/lib/index/part-196.js#L28) | `n.value.permissionCode` |
| `write` | [part-32](../restored/modules/TreatmentViewBoard/part-32.js#L32) | `_.권한코드 \|\| ""` |
| `access` | [part-74](../restored/modules/index/part-74.js#L82) | `p.permissionCode` |
| `access` | [AnalyticsView.vue](../restored/views/AnalyticsView.vue.js#L35) | `t` |
| `access` | [SettingView.vue](../restored/views/SettingView.vue.js#L58) | `t` |

## 라우트별 접근 조건

라우트 `meta`와 등록 조건입니다. 서비스 연동·역할에 따른 추가 규칙은 [access-control.md](access-control.md)에 있습니다.

| 경로 | 이름 | requiresAuth | 권한 | 역할 | 기타 meta | 등록 조건 |
|---|---|---|---|---|---|---|
| `/` | home | ✓ |  |  |  |  |
| `/crm/consult-script` | crm-consult-script | ✓ | `연락목록` |  |  |  |
| `/login` | auth-login |  |  |  |  |  |
| `/login/soo` | soo-login |  |  |  |  |  |
| `/login/unlock` | auth-unlock |  |  |  |  |  |
| `/auth/callback` | auth-callback |  |  |  |  |  |
| `/logout` | logout | ✓ |  |  |  |  |
| `/onboarding` | auth-onboarding |  |  |  |  |  |
| `/sign-up/soo` | soo-sign-up |  |  |  |  |  |
| `/sign-up/soo/form` | soo-sign-up-form |  |  |  |  |  |
| `/sign-up/soo/complete` | soo-sign-up-complete |  |  |  |  |  |
| `/sign-up/ondang` | ondang-sign-up |  |  |  |  |  |
| `/sign-up/ondang/form` | ondang-sign-up-form |  |  |  |  |  |
| `/sign-up/ondang/complete` | ondang-sign-up-complete |  |  |  |  |  |
| `/terms/:documentNumber` | terms-content |  |  |  |  |  |
| `/terms/doctalk/:type` | doctalk-terms |  |  |  |  |  |
| `/preview` | component-preview | ✓ |  |  |  |  |
| `/canvas` | canvas |  |  |  |  |  |
| `/desk` | desk | ✓ |  |  | `personalInfoKoPageName`=`원무` |  |
| `/treatment` | treatment | ✓ | `진료` |  | `personalInfoKoPageName`=`진료` |  |
| `/treatment/repeat-results` | treatment-repeat-results |  |  |  |  |  |
| `/treatment-rooms` | treatment-rooms | ✓ | `치료실` |  | `personalInfoKoPageName`=`치료실` |  |
| `/tablet/auth-link` | tablet-auth-link |  |  |  |  |  |
| `/tablet/treatment-rooms` | tablet-treatment-rooms | ✓ | `치료실` |  | `personalInfoKoPageName`=`치료실` |  |
| `/appointment-planner` | appointment-planner | ✓ | `예약관리` |  | `personalInfoKoPageName`=`플래너` |  |
| `/ocs` | ocs | ✓ | `탕전관리` |  |  |  |
| `/ocs/prescription/list` | tangjeon-prescription-list | ✓ | `탕전관리` |  |  |  |
| `/ocs/prescription/create` | tangjeon-prescription-create | ✓ | `탕전관리` |  |  |  |
| `/ocs-v2-herb-order-create` | ocs-v2-herb-order-create | ✓ | `메디원탕` |  |  |  |
| `/ocs-v2-herb-order-list` | ocs-v2-herb-order-list | ✓ | `메디원탕` |  |  |  |
| `/crm` | crm | ✓ | `고객관리` |  |  |  |
| `/crm/routines` | crm-routines |  |  |  |  | `Yu()` |
| `/crm/routines/new` | crm-routines-new |  |  |  |  | `Yu()` |
| `/crm/routines/:routineId` | crm-routines-detail |  |  |  |  | `Yu()` |
| `/crm/reminder` | crm-reminder |  |  |  |  | `Yu()` |
| `/crm/nonbenefit-patients` | crm-nonbenefit-patients |  |  |  |  |  |
| `/crm/contacts` | crm-contacts |  | `연락목록` |  |  |  |
| `/crm/contacts-v2` | crm-contacts-v2 |  | `연락목록` |  |  |  |
| `/crm/soo-scheduler` | crm-soo-scheduler |  | `연락목록` |  |  |  |
| `/crm/patients` | crm-emr-patients |  | `환자목록` |  |  |  |
| `/crm/message` | crm-message |  | `일반문자` |  |  |  |
| `/crm/contents/view/:token` | crm-contents-view |  | `일반문자` |  |  |  |
| `/crm/message/send-completed` | crm-message-send-completed |  | `일반문자` |  |  |  |
| `/crm/message/results` | crm-message-results |  | `전송이력` |  |  |  |
| `/crm/refusal` | crm-refusal |  | `수신거부목록` |  |  |  |
| `/message` |  | ✓ |  |  |  |  |
| `/claim` |  | ✓ | `청구` |  |  |  |
| `/claim/hira` | claim-hira |  | `심평원청구` |  |  |  |
| `/claim/hira-submit-items` | claim-hira-submit-items |  | `추나첩약제출현황` |  |  |  |
| `/claim/medical-aids` | claim-medical-aids |  | `의료급여진료승인현황` |  |  |  |
| `/claim/home-visit` | claim-home-visit |  | `청구` |  |  |  |
| `/claim/telemedicine-pilot` | claim-telemedicine-pilot |  | `청구` |  |  |  |
| `/claim/year-settlement` | year-settlement |  | `청구` |  |  |  |
| `/insurance-inquiry` | insurance-inquiry | ✓ |  |  | `personalInfoKoPageName`=`실손보험 조회` |  |
| `/electronic-signature` | electronic-signature | ✓ |  |  |  |  |
| `/setting` | setting | ✓ | `설정` |  |  |  |
| `/setting/common` | setting-common |  | `기본설정` |  |  |  |
| `/setting/telemedicine` | setting-telemedicine |  | `기본설정` |  |  |  |
| `/setting/service-integration` | setting-service-integration |  | `기본설정` |  |  |  |
| `/setting/hospital` | setting-hospital-info |  | `병원정보설정` |  |  |  |
| `/setting/treatment` | setting-treatment |  | `진료설정` |  |  |  |
| `/setting/prescription` | setting-prescription |  | `처방수가설정` |  |  |  |
| `/setting/templates` | setting-templates |  | `상용구설정` |  |  |  |
| `/setting/caller-numbers` | setting-caller-numbers |  | `발신번호설정` |  |  |  |
| `/setting/consult-templates` | setting-consult-templates |  | `연락목록` |  |  |  |
| `/setting/message-templates` | setting-message-templates |  | `메시지템플릿관리` |  |  |  |
| `/setting/contents` | setting-contents |  | `일반문자` |  |  |  |
| `/setting/account-permission` | setting-account-permission |  | `계정권한설정` |  |  |  |
| `/setting/account-history` | setting-account-history |  |  |  |  |  |
| `/setting/tablet` | setting-tablet |  |  |  |  |  |
| `/setting/document-management` | setting-document-management |  |  |  |  |  |
| `/setting/schedule` | setting-schedule |  | `진료스케줄설정` |  |  |  |
| `/setting/billing` | setting-billing |  | `결제메뉴접근` |  |  |  |
| `/setting/appointment` | setting-appointment |  | `예약설정` |  |  |  |
| `/setting/mcp-tokens` | setting-mcp-tokens | ✓ |  | `01` | `requiresDemoAccountInPrd` | `Yu() || Un()` |
| `/setting/mcp-pending-contacts` | setting-mcp-pending-contacts | ✓ |  | `01` | `requiresDemoAccountInPrd` | `Yu() || Un()` |
| `/setting/expense-collection` | setting-expense-collection |  |  |  |  |  |
| `/remote-settlement` | remote-settlement | ✓ |  | `01` |  |  |
| `/help` |  | ✓ |  |  |  |  |
| `/analytics` | analytics | ✓ | `경영지표` |  |  |  |
| `/analytics/revenue` | analytics-revenue |  | `경영지표` |  |  |  |
| `/analytics/appointment` | analytics-appointment |  | `경영지표` |  |  |  |
| `/analytics/patient` | analytics-patient |  | `경영지표` |  |  |  |
| `/analytics/soo-dashboard` | analytics-soo-dashboard |  |  | `01` |  |  |
| `/analytics/incoming-path` | analytics-incoming-path |  | `경영지표` |  |  |  |
| `/analytics/doctor` | analytics-doctor |  | `경영지표` |  |  |  |
| `/finance` | finance | ✓ |  |  |  |  |
| `/finance/daily-briefing` | finance-daily-briefing |  |  |  |  |  |
| `/finance/expenses` | finance-expenses |  |  |  |  |  |
| `/finance/pnl` | finance-pnl |  |  |  |  |  |
| `/finance/budget` | finance-budget |  |  |  |  |  |
| `/finance/cashflow` | finance-cashflow |  |  |  |  |  |
| `/challenge` | challenge | ✓ |  |  |  |  |
| `/portal` | portal | ✓ |  |  |  |  |
| `/library` | library-window | ✓ |  |  |  |  |
| `/members/:pathMatch(.*)*` | members | ✓ |  |  |  |  |
| `/:pathMatch(.*)*` | not-found |  |  |  |  |  |
