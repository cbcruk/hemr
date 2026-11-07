# 예약

진료의·시간 슬롯 단위로 예약을 만들고 바꾸고 취소·삭제하는 기능입니다. 중심 화면은 일간/주간 플래너(`/appointment-planner`)이고, 원무 화면 예약 컬럼·환자 카드·헤더에서도 같은 예약 사이드 패널(`DeskViewPatientAppointment`)을 엽니다.
네이버·카카오(예약 중개 서비스) 외부 예약 요청 확정/거절, 마킹·예약 차단, 예약 설정(`/setting/appointment`), 진료 스케줄(`/setting/schedule`), 연휴 대비 안내도 이 문서에서 다룹니다.

## 예약 플래너 — `/appointment-planner`
- **목적:** 날짜별(일간) 또는 주간 예약 현황을 진료의 × 시간 격자로 보고, 이 화면에서 예약을 생성·이동·수정·취소·삭제·접수합니다.
- **접근 조건:**
  - route meta: `requiresAuth`, `usesGlobalLayout`, `permissionCode: "예약관리"`(`appointment_planner`), `permissionRequired`, `personalInfoKoPageName: "플래너"`
  - `l0e()`가 `canAccess$`로 확인합니다. 실패하면 "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."를 보여줍니다
  - 채널 구분 필터와 "외부 예약 관리" 버튼은 `Cpt()`(`/auth/me`의 `me.요양기관기호`가 있을 때)일 때만 보입니다
- **화면 구성:** `AppointmentPlannerContent` 아래
  - `AppointmentPlannerSidebar`(280px): 인라인 `EmrDatePicker`(주간 탭이면 주 단위로 선택), **진료의 구분**(진료의가 2명 이상일 때), **환자 구분**(초진/재진/재초진), **채널 구분**(한의원에서 예약/네이버 예약/카카오). 각 그룹은 최소 1개를 선택해야 합니다. 외부 예약이 연동되지 않았으면 네이버·카카오 항목이 비활성화되고 "외부 예약 연동 후 이용할 수 있습니다." 툴팁이 뜹니다
  - `AppointmentPlannerHeader`: `일간`/`주간` 탭, 새로고침(`RefreshButton`), "예약 설정" 버튼(`/setting/appointment`로 이동), 날짜 이동(이전/다음/오늘), 집계 `예약(초진/재진/재초진) 합계(초/재/재초)`·`부도`·`취소`, 토글(주간: "휴진일 표시", 일간: "시간별 예약 수 표시"), "외부 예약 관리" 버튼, 환자 이름 검색, "엑셀 다운로드"
  - `AppointmentPlannerDaily`: 상단 `AppointmentDayHeader`(`예약: 전체예약건수`, `워크인: n`), 진료의별 시간 미정 예약 영역(`UnscheduledAppointmentDailyColumn` / `UnscheduledAppointmentArea`), 시간축 `AppointmentTimeAxiosCell`과 진료의별 열 `AppointmentPlannerDailyCell`, 현재 시각선 `PlannerCurrentTimeLineIndicator`
  - `AppointmentPlannerWeekly` / `AppointmentPlannerWeeklyCell`: 요일 × 시간 격자. 시간 미정 예약을 모두 접기/펼치기할 수 있습니다
  - 셀 안: `AppointmentCountStatus`(`예약건수/예약가능건수`, 초과하면 "예약초과"), `SlotOccupancyPopover`(앞 예약의 소요시간이 이어지는 점유 슬롯), `AppointmentCard`(`AppointmentCardDraggableWrapper` + `AppointmentCardContextMenuWrapper`로 감쌈), `PlannerMarkingBlockingArea`(마킹·차단 표시)
  - 오른쪽 패널(1440px 이상에서는 격자 옆에 붙고, 그보다 좁으면 오버레이): `AppointmentPlannerSideDetail`(일반 예약), `NaverReservationDetail`(외부 채널 예약), `NaverReservationPanel`(외부 예약 관리)
  - 다이얼로그: `AppointmentPlannerCancelDialog`, `NonBenefitPatientsViewTelemedicineCancelModal`(비대면 진료 취소), `NonBenefitPatientsViewTelemedicineModal`(접수 정보 보기), `SidePanelDeskActions`(`접수`, `예약`, `예약 변경`, `환자상세`, `차트생성`), 권한 부족 안내 `BaseConfirmDialog`("현재 권한으로 실행할 수 없습니다.")
- **동작:**
  - **조회:** 탭이나 날짜를 바꾸면 `GET /desk/appointments/planner`를 `{ date: yyyyMMdd, search_type: "daily" | "weekly" }`로 다시 부릅니다. 주간이면 `date`가 `ai(f)`(주 기준일로 추정)입니다. URL `?date=yyyyMMdd`가 있으면 그 날짜로 엽니다
  - **필터링(클라이언트):** 선택한 진료의, `진료타입`(초진/재진/재초진), `주문출처`→채널(`crn`)로 거릅니다. "휴진일 표시"를 끄면 `병원휴진여부`인 날을 숨깁니다. 대기 중인 예약 요청(`예약요청내역` 중 `요청상태 === "대기"`)은 `Trn`이 해당 시간/진료의 칸이나 시간 미정 영역에 끼워 넣습니다. 그날 휴진인 진료의 열은 뒤로 정렬됩니다. `비활성화시작일자`가 지난 진료의는 빠집니다
  - **예약 생성:** 빈 셀을 더블클릭하면 `onMoveToAppointment({예약일자, 예약시간, 진료의Id})` → `openSidePanel예약`이 실행됩니다. 다음 경우에는 막습니다
    - `canCreate$(예약생성)`이 없으면 권한 안내 다이얼로그를 띄웁니다
    - 병원 휴진일이면 아무 반응이 없습니다
    - 진료의 휴진(`휴진일태그`: `휴진` / `오전 휴진` / `오후 휴진`, 점심휴게시간 기준으로 오전·오후를 나눔)이면 "해당 진료의는 휴진일입니다."를 보여줍니다
    - 과거 시간이면 "과거 시간에는 예약을 생성할 수 없습니다."를 보여줍니다
    - 휴게 시간이면 "휴게 시간에는 예약을 생성할 수 없습니다."를 보여줍니다
    - 차단된 시간이면 "선택한 시간은 예약 차단된 시간입니다. 그래도 예약하시겠습니까?"를 확인한 뒤 진행합니다
  - **드래그 이동(`AppointmentCardDroppableAreaWrapper`):** 카드를 다른 칸에 놓으면 이동합니다
    - 일간: `PATCH /desk/appointments/{예약Id}` `{예약시간, 예약일자, 진료의Id, 진료의}`
    - 주간: `{예약일자, 예약시간, 기준일자, 변경요일}`
    - 놓기 전에 검사합니다: 권한(`canUpdate$(예약수정)`), 진료시간이 아님("진료시간이 아닌 경우 예약을 이동할 수 없습니다."), 병원 휴진일, 의사 휴진일, 과거 시간, 휴게 시간, 차단 시간(확인 후 진행)
    - 대기 중인 외부 예약 요청은 `PATCH /desk/booking-requests/{예약요청Id}` `{예약일자, 예약시간}`으로 옮깁니다. 일간에서 진료의를 바꾸려 하면 "예약 요청은 진료의를 변경할 수 없습니다. 예약 확정 후 변경해주세요."로 막습니다
    - 터치 환경에서는 `useTouchDragAndDropPolyfill`을 씁니다
  - **카드 컨텍스트 메뉴(`AppointmentCardContextMenuWrapper`):**
    - 일반 예약: `예약 복사`, `접수`(풀 차트 `Xi`가 아니면 `차트 생성`), `예약 수정`, `예약 취소`, `예약 삭제`
      - 부도이고 내원하지 않았으면 `예약 취소`를 숨깁니다
      - 내원·취소·거절 상태면 `접수`/`예약 수정`/`예약 취소`를 숨깁니다
    - 대기 중인 외부 요청(`Lnt`): `예약 확정`, `예약 거절`만 보입니다
    - 권한: 복사=`canCreate$(예약생성)`, 수정·확정·거절=`canUpdate$(예약수정)`, 취소·삭제=`canDelete$(예약삭제)`, 접수=`canCreate$(접수생성)`. 권한이 없으면 항목을 비활성화하고 툴팁(`ZC`)을 붙입니다
  - **복사/붙여넣기:** 복사하면 예약 정보를 `sessionStorage[ap_copy]`에 넣고 3분 뒤 지웁니다. 일간에서 셀을 드래그로 선택하면 `PlannerDragSelectionContextMenu`(`예약 붙여넣기` / `마킹등록` / `예약차단`)가 뜹니다. 붙여넣기는 선택 영역의 첫 진료의·일자·시간으로 `POST /desk/appointments`를 보냅니다(메모·이름·환자Id·보험구분·핸드폰번호·진료의Id·진료항목Ids를 복사)
  - **마킹:** `PlannerDragMarkingContextMenu`에서 색(`primary`, `utility-success`, `orange-dark`, `utility-error`, `utility-purple`, `utility-fuchsia`)과 메모를 고르면 `POST /desk/appointment-markings` `{markingData: [{마킹일자, 마킹시간, 마킹색, 메모}]}`를 보냅니다. 선택 영역에 차단 시간이나 휴게 시간이 있으면 거부합니다. 삭제는 `DELETE /desk/appointment-markings/group/{그룹Id}`입니다
  - **예약 차단:** `PlannerDragBlockingDialog`("차단 사유")에서 `POST /desk/appointment-blocks` `{blockData: [{차단일자, 차단시간, 메모}]}`를 보냅니다. 해제는 `DELETE /desk/appointment-blocks/group/{그룹Id}`입니다
  - **취소:** `AppointmentPlannerCancelDialog`에서 "취소 사유"(최대 30자)를 받아 `PATCH /desk/appointments/{예약Id}` `{취소여부: true, 변경사유}`를 보냅니다
  - **삭제:** "삭제된 예약은 복구할 수 없으며, 예약 안내 메시지도 함께 삭제됩니다." 확인 후 `DELETE /desk/appointments/{예약Id}`를 보냅니다
  - **수정:** `openSidePanel예약변경`으로 "예약 수정" 사이드 패널을 엽니다(아래 예약 사이드 패널 참고)
  - **접수/차트 생성:** 풀 차트(`Xi`)이면 `openSidePanel환자접수(환자Id, {예약Id})`, 아니면 `openSidePanel차트생성`입니다. LITE 비대면 예약(`비대면여부 && 주문출처 === "lite"`)이 아직 대기 상태이면 대신 `NonBenefitPatientsViewTelemedicineModal`을 엽니다
  - **비대면 진료 취소 및 환불:** `PATCH /desk/telemedicine-consultations/{예약Id}/status` `{status: "cancel", cancelReason}`
  - **외부 예약 확정/거절:** `POST /desk/booking-requests/confirm` / `reject` `{예약요청Ids: [id]}`. 응답의 `summary.성공 > 0`이면 성공 토스트를, 아니면 `items[].상태 === "실패"`의 `오류.message`를 보여줍니다
  - **검색:** 화면에 로드된 예약 중 `이름`에 검색어가 포함된 것을 찾습니다. ↑/↓/←/→로 이동, Enter로 상세 열기, Esc로 지웁니다
  - **엑셀:** `ExcelDownloadReasonModal`에서 사유를 받고 받습니다. 파일명은 `예약환자_목록_{yyyy-MM-dd}[_주간]`이고, 열은 환자명·예약일자·예약시간(없으면 "시간미정")·진료의·진료항목·구분·보험구분·연락처·예약메모·취소여부·변경사유입니다. 대기 중인 외부 요청은 빠집니다. `다운로드위치: "예약환자목록"`이며 `POST /patients/download-logs`로 기록하는 것으로 추정합니다
- **데이터:**
  - `GET /desk/appointments/planner` 응답은 날짜 키로 된 객체입니다(추정: 일간은 1개, 주간은 7개)
    - 일자별 필드: `날짜`, `요일`, `전체예약건수`, `워크인`, `병원휴진여부`, `점심휴게시간{시작시간,종료시간}`, `의사근무정보[{진료의Id, 휴진일여부, 휴진일태그}]`, `마킹내역[{마킹시간, 마킹색, 그룹Id}]`, `차단내역[{차단시간, 그룹Id}]`, `예약내역[{시간, 진료의별예약내역[{진료의Id, 예약내역[], 점유내역[], 예약가능건수}]}]`, `시간미정예약내역[{진료의Id, 예약내역[]}]`, `예약요청내역[]`
    - 예약 항목 필드: `예약Id`, `예약요청Id`, `환자Id`, `이름`, `핸드폰번호`, `차트번호`, `예약일자`, `예약시간`, `소요시간`, `진료의Id`, `진료의`, `진료타입`, `진료항목목록[{이름, 추가예약제한}]`, `보험구분`, `예약메모`, `변경사유`, `내원여부`, `취소여부`, `부도여부`, `삭제여부`, `주문출처`, `주문식별자`, `비대면여부`, `예약변경내역[{from, to}]`
    - 점유 항목 필드: `원본예약Id`, `원본예약시간`, `소요시간`, `진료항목명`, `추가예약제한`
  - 셀의 예약 가능 수: 유효 예약(`mrn`: 취소·부도·거절·대기 요청 제외) 중 하나라도 `추가예약제한`이면 1, 아니면 `예약가능건수`입니다. 유효 예약 수 + 점유 수가 이보다 크면 "예약초과"(배경 warning)입니다
  - 그 밖에 `GET /settings/doctors`(`진료의색명`, `비활성화시작일자`), `GET /settings/appointments`, `GET /settings/clinic-hours`, `GET /desk/appointments/{id}/history`, `POST /booking/sync-status`, `GET /desk/booking-requests`
- **상태 저장:**
  - localStorage: `ap_view`(`일간`/`주간`), `ap_hH`(휴진일 표시 `Y`/`N`)
  - sessionStorage: `ap_copy`(복사한 예약, 3분 TTL)
  - query key: `appointmentsPlannerKeys.appointmentsPlanner({date, search_type})`(`["appointmentsPlanner", …]`). 이전 데이터를 placeholder로 유지합니다
  - 예약 mutation이 성공하면 `appointmentsPlannerKeys.all`, `deskKeys.appointment(date)`, `deskKeys.appointmentsByDateAndDoctor`, `bookingKeys.all`, 환자별 예약 이력·요약·`appointmentHistory(예약Id)`를 무효화합니다. 수정 시 `내원여부`가 아니면 `deskKeys.appointment`에 낙관적 갱신을 먼저 반영합니다
  - provide/inject: 카드 액션 핸들러, 예약 요약 Map, 검색 상태, 권한 거부 콜백
- **근거:** `restored/views/AppointmentPlannerView.vue`, `restored/components/appointment/AppointmentPlannerContent.vue`, `restored/components/appointment/AppointmentPlannerHeader.vue`, `restored/components/appointment/AppointmentPlannerSidebar.vue`, `restored/components/appointment/AppointmentPlannerDaily.vue`, `restored/components/appointment/AppointmentPlannerDailyCell.vue`, `restored/components/appointment/AppointmentCardDroppableAreaWrapper.vue`, `restored/components/appointment/AppointmentCardContextMenuWrapper.vue`, `restored/components/planner/PlannerDragBlockingDialog.vue`, `restored/components/planner/PlannerDragMarkingContextMenu.vue`, `restored/modules/index/orderSource.js`, `restored/modules/mutations/usePostPatientsNewMutation.js`, `restored/modules/SidePanelDeskActions/useDeskAppointmentsPlannerQuery.js`

## 예약 상세 패널 — `AppointmentPlannerSideDetail`
- **목적:** 선택한 예약의 환자 정보, 일시, 진료의, 상태, 메모, 이력을 보여주고 상태에 맞는 액션 버튼을 제공합니다.
- **접근 조건:** 버튼마다 권한을 확인합니다. 수정은 `canUpdate$(예약수정)`, 취소·삭제는 `canDelete$(예약삭제)`, 접수는 `canCreate$(접수생성)`, 환자상세 이동은 `canAccess$(환자상세)`입니다. **접수/차트 생성은 `예약일자`가 오늘일 때만 켜집니다**(`DDe`).
- **화면 구성:** 헤더(이름·성별·나이, 채널 배지, 진료의, 일시, 상태 배지, 변경사유), 탭 `예약 이력`(`AppointmentPlannerHistory`) / `메모`(`PatientMemo`), 하단 액션 영역
- **동작:** 상태별 하단 버튼
  - 일반 예약: `삭제`, `예약 취소`(상태가 `등록`일 때만), `수정`, `접수`/`차트 생성`(등록·취소·부도 계열일 때)
  - 부도 계열(`부도`, `부도후_예약시간_변경`, `부도후_예약일자_변경`): `접수`/`차트 생성`만
  - 대기 중인 외부 요청: `예약 거절`, `수정`, `예약 확정`
  - LITE 비대면(`등록` 상태): `접수 정보 보기`, `진료 취소 및 환불`, `수정`
- **데이터:** `GET /patients/{환자Id}`, `GET /settings/display/resident-numbers`, `GET /desk/appointments/{예약Id}/history`(`results`: `{from, to, diff}` 목록과 `비대면여부`)
- **근거:** `restored/components/appointment/AppointmentPlannerSideDetail.vue`, `restored/components/appointment/AppointmentPlannerHistory.vue`

## 예약 사이드 패널(생성·수정) — `DeskViewPatientAppointment`
- **목적:** 환자, 날짜, 진료의, 시간(여러 슬롯 선택 가능), 진료 항목, 보험 구분, 메모, 예약 알림을 입력해 예약을 만들거나 고칩니다.
- **접근 조건:**
  - `openSidePanel예약`은 `canCreate$(예약생성)`일 때, `openSidePanel예약변경`은 `canUpdate$(예약수정)`일 때만 패널을 엽니다
  - 진입 지점: 플래너, 헤더 "예약" 버튼(`HeaderLayout`), 원무 예약 컬럼(`AppointmentColumnTime`), 환자 카드·자동완성·환자 목록(`PatientCard*`, `PatientAutoCompleteResultItems`, `EmrPatientsViewTableActions`), `TreatmentColumn`, `WaitingColumn` 등(permissions.md의 `appointment_create` 사용처)
- **화면 구성:**
  - 패널 래퍼: `SidePanelDeskActionsPatientAppointment`(제목 "진료 예약"), `SidePanelDeskActionsPatientAppointmentEdit`(제목 "예약 수정")
  - 입력: `DeskViewPatientAppointmentPatientInput`, `EmrDatePicker`(오늘·휴진 표시), 진료의 선택(휴진 태그 표시), `PatientAppointmentTimeSlotGrid`(오전/오후/야간), "시간 미정" 토글("시간을 지정하지 않고 예약합니다."), `PatientAppointmentMedicalTreatmentSelect`, 보험 구분, 예약 메모 에디터
  - 알림: `CrmAppointmentNotificationsForm` / `CrmAppointmentUpdatedNotificationFooter`
  - 기타: `DeskViewPatientAppointmentHistory`
- **동작:**
  - 보험 구분은 풀 차트(`Xi`)이면 `건보`/`급여`/`자보`/`일반`/`산재`, 아니면 `일반`만 있습니다. 외부 채널 예약이면 숨깁니다
  - 진료의 기본값은 `c6` helper가 정합니다(기존 예약 → 사용자 선택 → 직전 진료의 → 로그인 진료의 순서로 추정)
  - 진료 항목 기본값은 기존 예약 → `직전내원현황.진료항목Ids[0]`입니다
  - 경고 문구: "선택한 날짜는 한의원 휴진일입니다.", "선택한 진료의는 예약 날짜에 휴진입니다." / "선택한 진료의는 [오전, 오후] 시간 휴진입니다.", "선택한 시간에 추가 예약이 제한된 예약이 있습니다.", "예약 가능한 시간이 없습니다."
  - 휴게 시간(점심·저녁) 슬롯은 막습니다
  - 생성: `POST /desk/appointments` `{예약일자, 예약시간|null, 진료의Id, 이름, 핸드폰번호, 진료항목Ids, 보험구분, 메모(HTML), 환자Id, 소요시간?, 알림설정?}`
    - `소요시간` = 선택한 슬롯 수 × `예약시간단위`(기본 30)
    - `알림설정`은 `{생성시, 당일, 하루전}` 중 값이 있는 것만 보냅니다. 전송 채널이 `alimtalk`이면 알림톡용 값을, 아니면 SMS용 값을 씁니다
    - 성공하면 "진료 예약을 완료했습니다." 후 `patientStore.setRecentAppointmentPatientId(예약Id)`
  - 수정: `PATCH /desk/appointments/{예약Id}`. 같은 필드에 `알림설정: {수정시}`를 붙입니다. 플래너에서 열었으면 `?date=`를 새 예약일자로 바꿉니다
  - 외부 채널 요청을 수정하면: 날짜가 바뀐 경우 먼저 `PATCH /desk/booking-requests/{예약요청Id}`, 이어서 `POST /desk/booking-requests/confirm`, 받은 `예약Id`로 PATCH 수정. 확정에 실패하면 "예약 확정에 실패하여 수정할 수 없습니다."
  - 서버가 **409**를 돌려주면 "중복된 예약이 있습니다. 다른 예약 일시를 선택해 주세요."를 보여줍니다
- **데이터:** `GET /settings/doctors/appointments/{yyyyMMdd}`(`의사별예약정보[{진료의Id, 휴진일태그, 표기이름}]`), `GET /desk/appointments/planner`(해당 일 점유·추가예약제한 계산), `GET /settings/appointments`(`예약시간단위`), `GET /settings/closed-days/{…}`(`병원휴진일`), `GET /chart/medical-treatments`, `GET /patients/{id}`, `GET /patients/{id}/appointments/history`, `GET /patients/{id}/waiting/latest`(`직전내원현황`), `GET crmClient /appointment-notifications/settings?channel=sms|alimtalk`
- **상태 저장:** `useDeskDateStore.deskDate`(무효화할 원무 날짜), `usePatientStore.recentAppointmentPatientId`
- **근거:** `restored/components/desk/DeskViewPatientAppointment.vue`, `restored/components/side/SidePanelDeskActionsPatientAppointment.vue`, `restored/components/side/SidePanelDeskActionsPatientAppointmentEdit.vue`, `restored/modules/index/part-86.js`, `restored/components/header/HeaderLayout.vue`

## 원무 예약 컬럼 — `AppointmentColumn` (원무 `DeskVisitView`, `PatientsStatusAppointments`)
- **목적:** 원무 화면에서 당일 예약을 시간대별 카드 목록으로 보여줍니다.
- **접근 조건:** 메뉴 항목에 `canCreate$`/`canUpdate$`/`canDelete$`가 걸립니다. "문진 링크 전송"은 `Sct(요양기관기호)`가 참일 때만 나옵니다.
- **화면 구성:** `DeskVisitAppointment` 헤더(건수, "내원 n · 부도 n · 취소 n 숨김" 토글, 카드 normal/simple 전환), `DeskVisitTelemedicineCard`(풀 차트일 때), `AppointmentColumnTime`, `AppointmentColumnUnscheduled`("외 예약 n개"), `AppointmentColumnUnscheduledCard`
- **동작:**
  - 카드 메뉴: `예약`, `예약 수정`, `접수`, `예약 취소`, `예약 삭제`, `문진 링크 전송`, `문서 발급`, `문자 발송`, 차트 생성/조회
  - 시간대 사이로 드래그하면 `PATCH /desk/appointments/{예약Id}` `{예약시간}`
  - 취소·삭제 동작은 플래너와 같습니다
- **상태 저장:** localStorage `patientCardType`, `deskVisitHideCancelledNoShow`
- **근거:** `restored/components/desk/DeskVisitAppointment.vue`, `restored/components/appointment/AppointmentColumnTime.vue`, `restored/components/appointment/AppointmentColumnUnscheduledCard.vue`

## 외부 예약 관리(온라인 예약 요청) — `NaverReservationPanel`
- **목적:** 네이버·카카오(예약 중개 서비스 경유) 예약 요청을 모아 보고 확정하거나 거절합니다.
- **접근 조건:**
  - 헤더 버튼은 `Cpt()`일 때만 보입니다
  - 연동 여부(`Ssn().외부예약미연동여부`)는 `POST /booking/sync-status`의 `status`(`NONE`/`SENT`/`COMPLETED`/`FAILED`)가 `COMPLETED`이고, 넓은 기간의 `GET /desk/booking-requests`(`limit: 1`)에 결과가 있는지로 판단합니다
  - 연동되지 않았으면 "외부 예약 연동 후 이용할 수 있습니다." / "연동 설정으로 이동"(→ `/setting/appointment`의 `외부채널예약` 탭)을 보여줍니다
  - 확정·거절 버튼은 `canUpdate$(예약수정)`이 필요합니다
- **화면 구성:** 채널 필터(전체/네이버/카카오), "예약 요청만 표시" 토글(기본 켬), 날짜별 그룹 카드 목록("(오늘)" 표시), "더 보기"(무한 스크롤), "예약 n건 확정"(일괄), 상세 `NaverReservationDetail` / `NaverReservationHistory`
- **동작:**
  - 조회: `GET /desk/booking-requests?시작일자=선택일&종료일자=선택일+3&요청상태=대기|전체&limit=50`, 다음 페이지는 `next`로 받습니다
  - 일괄 확정: "각 예약은 직전 진료의(없으면 대표 원장)로 배정되며, 확정 후 수정할 수 있습니다." 확인 후 100건씩 나눠 `POST /desk/booking-requests/confirm`. 결과 `summary{요청, 성공, 처리중, 실패}`와 `items[].상태`(`성공`/`실패`/`처리중`/`재조회필요`)에 따라 토스트를 띄웁니다
  - 거절: "거절한 예약은 복구되지 않습니다." 확인 후 `POST /desk/booking-requests/reject`
  - 수정: 사이드 패널로 엽니다(위 외부 채널 요청 수정 흐름)
- **데이터:** 요청 항목 필드는 `예약요청Id`, `요청상태`(`대기`/`승인`/`거절`), `주문출처`, `예약일자`, `예약시간`, `이름`, `휴대전화번호`, `진료항목[]`, `진료의Id`, `환자Id`
- **상태 저장:** query key `bookingKeys.reservations(시작일자, 종료일자, 요청상태, limit)`. 패널 열림 상태는 컴포넌트 로컬입니다(일반 상세 패널과 동시에 열리지 않음)
- **근거:** `restored/components/naver/NaverReservationPanel.vue`, `restored/modules/index/part-94.js`, `restored/modules/index/useDeskBookingRequestsQuery.js`

## 예약 설정 — `/setting/appointment`
- **목적:** 예약 시간 단위·시간당 가능 수·부도 처리 시점, 진료 항목별 예약 시간, 예약 알림 채널, 외부 채널 예약 연동을 설정합니다.
- **접근 조건:** `permissionCode: "예약설정"`(`appointment_setting`), `permissionRequired`. `외부채널예약` 탭은 `Cpt()`(요양기관기호가 있을 때)만 보입니다. 온보딩 가이드 `auto-dm` 진행 중 다른 탭으로 가면 가이드를 종료합니다.
- **화면 구성:** `SettingAppointment` 탭 `일반예약` / `외부채널예약`
  - `SettingAppointmentGeneral` "일반 예약":
    - 예약 시간 단위: 10/15/30분
    - 시간당 예약 가능 수: 숫자 입력, 300ms debounce
    - 예약 부도 처리 시점: 10/30/60분 후, 또는 "진료 마감 후"
  - `CrmAppointmentNotificationsSetting`: 전송 채널(문자 / 카카오톡 알림톡), "전송 실패 시 문자로 전송"(대체 전송)
  - `SettingAppointmentTreatmentTime` "예약 시 진료별 시간": 진료 항목별 사용 여부, 기본 진료 시간, "같은 시간 추가 예약 참고"(추가 예약이 있으면 경고)
  - `SettingAppointmentExternalChannel` "외부 채널 예약": 예약 중개 서비스 가입/연동 상태와 채널 설정. 안내 문구 "외부 예약 확정 시 직전 진료의(없으면 대표 원장)로 자동 배정됩니다.", "진료 일정 변경(휴무일·임시 진료시간)은 예약 중개 서비스 예약 관리의 임시 스케줄에서 직접 등록합니다."
- **동작:**
  - 일반: 바뀐 필드만 `PATCH /settings/appointments`(`예약시간단위`, `예약가능건수`, `부도처리시점`, `진료마감부도처리여부`)
  - 진료별 시간: `PATCH /settings/medical-treatments/{id}` `{사용여부}` | `{기본소요시간}` | `{추가예약제한}`. 실패하면 토스트를 띄우고 다시 불러옵니다
  - 알림: `PUT crmClient /appointment-notifications/settings` `{channel, notifications}`
  - 외부 채널: `POST /booking/signup` `{약관동의여부}`, `POST /booking/sso/token`(예약 중개 서비스 관리 화면 열기). 상태 `SENT`면 loading, `COMPLETED`면 success로 보여줍니다
- **데이터:** `GET /settings/appointments`, `GET /settings/medical-treatments`, `GET crmClient /appointment-notifications/settings`, `GET crmClient /lite-triggers/status`, `POST /booking/sync-status`, `GET /desk/booking-requests`
- **상태 저장:** `useOnboardingGuideSessionStore`(탭 요청 `request탭`), `useGuideTabControl`
- **근거:** `restored/components/setting/SettingAppointment.vue`, `restored/components/setting/SettingAppointmentGeneral.vue`, `restored/components/setting/SettingAppointmentTreatmentTime.vue`, `restored/components/setting/SettingAppointmentExternalChannel.vue`, `restored/components/crm/CrmAppointmentNotificationsSetting.vue`

## 진료 스케줄 — `/setting/schedule`
- **목적:** 진료의별 정기 스케줄(요일별 시간·휴진)과 날짜별 진료 일정을 관리합니다. 플래너와 예약 패널의 휴진·진료시간 판단에 반영되는 것으로 추정합니다.
- **접근 조건:** `permissionCode: "진료스케줄설정"`(`schedule_setting`), `permissionRequired`
- **화면 구성:** `ScheduleView` = 왼쪽 `ScheduleViewController`(진료의별 "정기 스케줄", 요일별 시간/휴진, "편집") + 오른쪽 `ScheduleViewCalendarWrapper` → `ScheduleViewCalendarController`(월 이동, 오늘, 진료의 필터 "진료의 전체", "이미지로 저장") + `ScheduleViewCalendar`(월 달력, "한의원 휴무", "임시 진료", 진료의별 휴진 표시)
- **동작:**
  - 정기 스케줄 편집(`ScheduleViewCalendarDoctorScheduleSettingModal`): 요일 선택("모든 요일 선택"), "오전, 오후로 설정" 또는 "시간 설정", "휴진 처리" → `PATCH /settings/doctor-schedules/doctor/{진료의Id}` `{schedules: [{요일, 휴진여부, 시작시간, 종료시간}]}`
    - 응답에 `변경실패요일`이 있으면 "…은 한의원 휴무일이 되어 스케줄이 설정되지 않았습니다."를 띄웁니다
    - 성공하면 `deskKeys.appointmentsByDoctor()`를 무효화합니다
  - 날짜별 일정(`ScheduleViewCalendarScheduleSettingModal`): 시작/종료 시간, "휴진 처리", "다음 진료의로 진료 시간 대체"(`대체진료의Id`) → `PATCH /settings/clinic-schedules/{병원진료일정Id}` `{시작시간, 종료시간, 휴진여부, 대체진료의Id?}`. 임시 진료일이면 "근무·휴진 여부만 설정 가능"합니다
  - 이미지 저장 파일명: `[진료의_]yyyy_MM_진료 스케줄.png`
- **데이터:** `GET /settings/doctor-schedules`, `GET /settings/clinic-schedules?start_date&end_date`, `GET /settings/clinic-calendar/year/{yyyy}`(시작·종료 연도 각각, `휴무여부`, `임시진료여부`, `임시진료시간`), `GET /settings/doctors`, `GET /settings/onboarding-guide`
- **근거:** `restored/views/ScheduleView.vue`, `restored/components/schedule/ScheduleViewCalendar.vue`, `restored/components/schedule/ScheduleViewCalendarDoctorScheduleSettingModal.vue`, `restored/components/schedule/ScheduleViewCalendarScheduleSettingModal.vue`

## 연휴 대비 안내 — `HolidayPrepBanner` (전역 `HeaderLayout`)
- **목적:** 연휴 전에 진료 일정을 설정하도록 안내하고, 예약 중개 서비스 연동 병원에는 외부 채널에도 일정을 반영하도록 안내하는 플로팅 카드입니다.
- **접근 조건:** `me.역할타입`이 `01`/`02`(대표원장)이고 `canAccess$(기본설정)`일 때만 보입니다. 노출 기간(`노출시작`~`노출종료`) 안이어야 하고, 설정 영역 안에서는 띄우지 않습니다.
- **동작:** `fgt`가 안내 단계를 정합니다
  - `일정설정` 단계(`HolidayPrepFloatingCard`): 연휴 중 일정을 설정하지 않은 날짜가 있을 때. 문구 "{연휴} 진료 일정을 설정하셨나요?", 버튼 "연휴 일정 설정하기"(→ `/setting/common?tab=진료시간설정`, 첫 미설정 날짜로 이동), "다시 보지 않기"(캠페인 id 저장), 닫기(오늘 하루)
  - `외부채널확인` 단계(`HolidayExternalChannelCheckCard`): 연휴 설정은 끝났지만 예약 중개 서비스 상품의 예약 가능 시간에 반영되지 않았을 때. 버튼 "이어서 설정하기"(예약 중개 서비스 SSO로 관리 화면 열기), "나중에 하기"
  - 그 외에는 `없음`
  - CTA 클릭과 닫기는 추적 이벤트로 남깁니다
- **데이터:** `GET /settings/holidays/schedule-banner`(`id`, `연휴이름`, `연휴시작`, `연휴종료`, `노출시작`, `노출종료`), `GET /settings/clinic-calendar/year/{yyyy}`, `GET /settings/appointments`(`예약시간단위`), `GET /booking/products`, `GET /booking/products/bookable-times`, `POST /booking/sso/token`
- **상태 저장:** localStorage `bt.연휴대비안내다시보지않기`(캠페인 id), `bt.연휴대비안내닫은날짜`, `bt.연휴외부채널안내닫은날짜`(yyyy-MM-dd)
- **근거:** `restored/components/holiday/HolidayPrepBanner.vue`, `restored/components/holiday/HolidayPrepBanner.helpers.js`, `restored/components/holiday/HolidayPrepBanner.helpers.helpers.js`, `restored/modules/index/useSettingsHolidaysScheduleBannerQuery.js`

## 예약 상태·종류 값

| 구분 | 값 | 의미 / 출처 |
|---|---|---|
| 진료타입(환자 구분) | `초진`(pink), `재진`(gray), `재초진`(purple) | `arn`, 플래너 필터·집계 |
| 채널 키 | `한의원`, `네이버`, `카카오` | `qv` / `lrn` |
| 주문출처 | `naver_booking`, `kakao_booking`, `daangn_booking`, `lite`(비대면), 없음=한의원 | `orderSource.js` |
| 플래그 | `내원여부`, `취소여부`, `부도여부`, `삭제여부` | 예약 항목 boolean |
| 변경이력 `예약상태` | `등록`, `수정`, `예약취소`, `부도`, `내원`, `승인`, `거절` | `예약변경내역[].to.예약상태`, history API |
| 파생 상태(카드·이력) | `취소후_예약일자_변경`, `부도후_내원`, `부도후_예약시간_변경`, `부도후_예약일자_변경` | `AppointmentCard`, `AppointmentPlannerHistory` |
| 요청상태(외부) | `대기`→"요청", `승인`→"확정", `거절`, + `내원`/`부도`/`취소` | `Nnt`, `brn`, `Srn` |
| 외부 표시 상태 | `예약확정`, `내원`, `부도`, `부도후내원`, `취소`, `거절` | `vrn` |
| 보험구분 | `건보`, `급여`, `자보`, `일반`, `산재` (비풀차트는 `일반`) | `DeskViewPatientAppointment` |
| 휴진일태그 | `휴진`, `오전 휴진`, `오후 휴진` (+`야간`) | `의사근무정보`, `의사별예약정보` |
| 예약 중개 서비스 sync status | `NONE`, `SENT`, `COMPLETED`, `FAILED` | `Mpe` |

- 대기 요청 판정(`Lnt`): 외부 주문출처이면서 `예약변경내역`에 `등록`/`승인`/`거절`/`부도`/`내원`/`예약취소`가 하나도 없는 경우입니다.

## 흐름
1. **생성:** 플래너 빈 셀 더블클릭이나 헤더·환자 카드의 "예약" → 사이드 패널 → `POST /desk/appointments`(알림설정 `생성시`/`당일`/`하루전` 포함 가능). 409면 중복 안내를 띄웁니다
   - 외부 채널: 고객 요청이 `예약요청내역`(`대기`)으로 들어옵니다 → 플래너/외부 예약 관리에서 `confirm`(→ `승인`, 예약Id 생성)하거나 `reject`(→ `거절`)합니다
2. **변경:** 드래그 이동이나 "예약 수정" → `PATCH /desk/appointments/{예약Id}`(알림설정 `수정시`). 대기 요청은 `PATCH /desk/booking-requests/{id}`로 일자·시간만 바꿀 수 있습니다
3. **내원 → 접수 전환:** 예약일이 오늘일 때 `접수`(풀 차트) 또는 `차트 생성` → `openSidePanel환자접수(환자Id, {예약Id})` / `openSidePanel차트생성(환자Id, 예약Id, …)`. 접수가 만들어지면 서버가 `내원여부`를 세우는 것으로 추정합니다(클라이언트에서 `내원여부`를 PATCH하는 코드는 이 화면에서 보지 못했습니다). 부도 뒤 내원하면 `부도후_내원`으로 표시합니다
4. **취소:** 취소 사유(≤30자) → `PATCH {취소여부: true, 변경사유}`. 날짜를 바꾸면서 취소된 경우는 `취소후_예약일자_변경`으로 표시합니다
5. **부도:** 설정한 `부도처리시점`(분)이 지나거나 `진료마감부도처리여부`이면 진료 마감 후 서버가 자동으로 부도 처리합니다(이력 문구 "예약시간이 지나 부도 처리됐습니다."). 부도 예약도 접수할 수 있습니다
6. **삭제:** `DELETE /desk/appointments/{예약Id}`. 예약 안내 메시지도 함께 삭제된다고 안내합니다

## 레거시 차트 대비
이 절은 레거시 차트 사용자 매뉴얼을 근거로 정리한 것이며, 현행 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무
- **진료구분 마스터:** 레거시 차트는 예약에 `진료구분`과 `진료항목`을 따로 답니다. 진료구분은 한의원이 이름과 표시순서를 직접 등록하는 분류 목록이고, 대기실·치료실 "참고" 목록과 같은 관리 화면에서 관리합니다. 현행은 `진료타입`(초진/재진/재초진)이 고정값이고 사용자 정의 분류가 없습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」, 레거시 차트 매뉴얼 「원장실프로그램 메뉴 버튼 안내」)
- **진료항목의 예약 노출 여부:** 진료항목은 비급여 항목 관리에서 만들고 표시순서를 정하며, 항목별 "진료예약에서 숨김" 플래그로 예약 화면 선택지에서 뺄 수 있습니다. 현행 `사용여부`와 비슷하지만, 레거시 차트는 진료 기록용 항목과 예약 선택지 노출을 따로 제어합니다 (추정) (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **반복 휴진일:** 한의원 전체나 한의사별로 휴진일을 지정할 수 있고, 매주 또는 매월 반복되는 휴진일을 한 번에 설정·해제할 수 있습니다. 현행 진료 스케줄은 요일별 정기 스케줄과 날짜별 일정만 있어 "매월 n번째 요일" 같은 월 단위 반복은 확인되지 않습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **예약 대상 일괄 문자:** 플래너에서 "예약 부도 / 내일 예약 / 오늘 예약 / 특정 기간 예약" 환자 목록을 만들어 한꺼번에 문자를 보낼 수 있습니다. 백엔드에는 예약 상태·기간으로 수신자 목록을 뽑는 조회가 필요합니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **예약 리스트 조회:** 격자와 별도로 예약을 목록으로 보며 예약·취소·내원 여부를 한 번에 확인합니다. 접수 화면의 예약환자관리는 오늘/내일/이번 주/다음 주, 진료의·진료항목·진료구분·예약일 기준으로 거를 수 있습니다. 현행은 플래너 격자, 이름 검색, 엑셀 다운로드만 있습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」, 레거시 차트 매뉴얼 「재진환자 접수」)
- **플래너 보기 기준:** 기본 화면은 주간이고, 진료의 외에 진료항목·진료구분 기준으로도 열을 나눠 볼 수 있습니다. 현행은 진료의 열만 있습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **한의원 공지사항:** 플래너 안에 직원끼리 공유하는 업무 메모를 저장하는 칸이 있습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **패키지진료 진행 표시:** 매뉴얼은 패키지(회차권) 진료를 플래너에 추가해 진행 중인 환자와 회차를 예약 현황에서 확인하는 방식을 권장합니다. 회차 차감은 진료부·메모로 관리합니다 (추정: 예약에 패키지·회차 정보를 연결하는 기능) (레거시 차트 매뉴얼 「패키지진료 관리하기」)
- **상담에서 바로 예약:** OKCodi(전화 상담 관리, CTI 연동)에서 상담 기록 중 "예약하기"를 누르면 플래너 예약으로 이어집니다. 현행 진입 지점 목록에는 상담 화면이 없습니다 (레거시 차트 매뉴얼 「OKCodi 및 모든Codi 관리」, 레거시 차트 매뉴얼 「우리 한의원의 상담환자 발굴, 분류, 관리 안내」)

### 업무 규칙
- **예약 문자 발송 시점:** 네 가지 방식이 있습니다. 둘 이상을 같이 켤 수 있는 것으로 보입니다 (추정) (레거시 차트 매뉴얼 「SMS, 예약플래너, 한약복용관리 환경설정」, 레거시 차트 매뉴얼 「예약플래너에서 예약문자 자동으로 전송하기」)

  | 방식 | 발송 시각 |
  |---|---|
  | 바로전송 | 예약을 등록하는 즉시 |
  | 예약으로 전송 | 예약 시각 24시간 전 |
  | 진료예약 전날 보내기 | 예약 전날, 한의원이 정한 시각 |
  | 진료예약 당일 보내기 | 예약 당일, 한의원이 정한 시각 |

- **예약 문자 템플릿 변수:** 예약 일시를 넣는 치환 필드가 여러 형식으로 있습니다. `[F예약L]` = MM월DD일 오전/오후 HH시mm분, `[F예약S]` = DD일 …, `[F예약LD]` = MM월DD일 요일 …, `[F예약SD]` = DD일 요일 …, `[F예약DD]` = 요일 …, `[F예약SS]` = 오전/오후 HH시mm분. 그 밖에 `[F이름]`, `[F처방]`, `[F생일L]`, `[F생일S]`가 있습니다 (레거시 차트 매뉴얼 「SMS 보내기 - 문자보내기」)
- **예약 변경·취소 시 대기 문자 처리:** 예약 일시를 바꾸거나 취소하면, 이미 전송 대기 중인 이전 예약 문자를 전송대기 목록에서 직접 "예약전송 취소"해야 합니다. 삭제할 때는 대기 문자 취소를 같이 해 줍니다. 재설계에서는 예약을 수정·취소·삭제할 때 아직 보내지 않은 예약 알림을 서버가 함께 정리해야 합니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」, 레거시 차트 매뉴얼 「SMS 보내기 - 문자보내기」)
- **예약 문자는 광고성 정보가 아님:** 정보통신망법상 예약 확인 문자는 광고성 정보의 예외라서 수신 동의가 없어도 보낼 수 있고 "(광고)" 표기도 필요 없습니다. 반면 진료시간 변경 안내, 휴진 안내, 이전 안내, 안부·생일 문자 등은 광고성 정보로 볼 수 있어 수신 동의와 표기 의무를 지켜야 합니다. 휴진·진료시간 변경을 일괄 안내하는 기능은 광고성 발송 규칙을 따라야 합니다 (레거시 차트 매뉴얼 「SMS 보내기 - 문자보내기」)
- **예약 문자 사용 전제:** 자동 발송을 쓰려면 문자 약관 동의서와 통신서비스 가입증명원을 미리 내고, 발신번호를 등록해야 합니다 (발신번호 등록제) (레거시 차트 매뉴얼 「예약플래너에서 예약문자 자동으로 전송하기」, 레거시 차트 매뉴얼 「SMS, 예약플래너, 한약복용관리 환경설정」)
- **접수하면 내원 처리:** 예약 환자를 대기실이나 치료실로 보내면(접수) 예약의 내원 여부가 자동으로 체크되고 표시가 "내원"으로 바뀝니다. 현행 스펙에서 서버 동작으로 추정한 "접수 생성 → `내원여부`" 흐름과 맞습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **미등록 환자 예약 → 내원 시 등록:** 차트가 없는 신규 환자도 인적 사항만으로 예약할 수 있습니다. 내원하면 예약 환자를 "대기실로 보내기"할 때 신환 등록 창이 열리고, 저장하면서 바로 대기 접수까지 할 수 있습니다. 이때 예약과 새 환자 차트가 연결되어야 합니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **취소와 삭제 구분:** 취소한 예약은 기록이 남고 회색으로 표시합니다. 삭제한 예약은 기록이 완전히 사라집니다. 상태 표시는 예약(하늘색), 내원(연두색), 취소(회색) 세 가지입니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **공휴일 달력:** 공휴일 달력은 벤더가 자동으로 업데이트합니다. 매뉴얼은 직접 설정하지 말라고 안내합니다. 임시공휴일(매뉴얼 예: 10월 2일)도 보건복지부 공문에 맞춰 미리 반영해 배포합니다. 재설계에서는 법정·임시공휴일 목록을 중앙에서 관리해 내려 주고, 휴진 판단과 진찰료 공휴일 가산이 같은 달력을 써야 합니다 (레거시 차트 매뉴얼 「원장실프로그램 메뉴 버튼 안내」, 레거시 차트 매뉴얼 「임시공휴일(10월 2일) 진료비 가산 적용 및 본인부담금 부과 방법 안내」)
- **진료 시간대별 진찰료 가산(매뉴얼 기준):** 진료 스케줄·시간대 설정과 맞물리는 규칙입니다. 산정 자체는 진료·청구 문서 영역입니다 (레거시 차트 매뉴얼 「진찰료 평일 야간가산」, 레거시 차트 매뉴얼 「진찰료 토요일 주간가산」, 레거시 차트 매뉴얼 「(용어) - 진찰료」)

  | 구분 | 시간대 | 가산 |
  |---|---|---|
  | 평일 야간 | 18시 ~ 다음 날 09시 | 기본진찰료 30% |
  | 토요일 주간(의원급만) | 09시 ~ 13시 | 기본진찰료 30% |
  | 토요일 야간 | 13시 ~ 다음 날 09시 | 기본진찰료 30% |
  | 공휴일(관공서의 공휴일에 관한 규정) | 종일 | 기본진찰료 30% |
  | 만 6세 미만 심야 | 20시 ~ 다음 날 07시 | 기본진찰료 100% |

  - 판정 시각: 레거시 차트는 대기실·치료실로 보낸(접수한) 시점의 PC 시각을 기준으로 자동 체크합니다. 근거 고시(보건복지부 고시 제2006-9호, 2006.2.1.)는 가산 시간대에 내원했으면 진료를 시작한 시각, 그 밖의 시각에 내원했으면 도착 시각을 기준으로 합니다
  - "오전에 대한 야간가산 적용 안 함" 옵션이 기본으로 켜져 있어, 09시 이전 진료에는 야간가산을 붙이지 않습니다(환자에게 유리하게 적용 권장)
  - 토요일 주간가산과 야간가산은 중복 산정할 수 없습니다. 13시 전에 접수하고 13시 뒤에 진료를 기록해도 둘 중 하나만 붙습니다
  - 환자별로 진료기록에서 "야간"·"토요주간"을 수동으로 켜고 끌 수 있습니다

### 현행과 다른 점
- **휴진일 예약:** 레거시 차트는 휴진일에 예약하면 확인 알림창을 띄웁니다(경고 뒤 진행 가능으로 추정). 현행은 병원 휴진일 셀 더블클릭에 반응하지 않고, 진료의 휴진은 막습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **알림 시점 기준:** 레거시 차트에는 "예약 시각 24시간 전" 상대 시점과 "전날/당일 지정 시각"이 함께 있습니다. 현행 `알림설정`은 `생성시`/`당일`/`하루전`(+ 수정 시 `수정시`)이고, 24시간 전 상대 시점은 확인되지 않습니다 (레거시 차트 매뉴얼 「SMS, 예약플래너, 한약복용관리 환경설정」)
- **예약 변경 시 문자 정리:** 레거시 차트는 예약을 고칠 때 "SMS 완료" 체크를 풀고 이전 대기 문자를 사람이 취소합니다. 현행은 수정할 때 `알림설정.수정시`를 보내고, 삭제할 때 안내 메시지도 함께 삭제한다고 안내합니다(서버 처리로 추정) (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)
- **네이버 예약 연동 방식:** 레거시 차트는 네이버 스마트플레이스와 직접 연동합니다(별도 중계 서버, 월 유지보수료 22,000원). 현행은 예약 중개 서비스을 거쳐 네이버·카카오를 받습니다. 레거시 차트 연동의 특징은 다음과 같습니다 (레거시 차트 매뉴얼 「네이버 예약과 예약플래너 연동」, 레거시 차트 매뉴얼 「네이버 스마트플레이스에 업체정보 등록」)
  - 스마트플레이스의 예약 확정 방식은 반드시 "관리자 확인 후 확정"으로 둡니다. 그래서 모든 네이버 예약이 요청 상태로 들어오고 한의원이 확정·변경·취소합니다. 현행의 `대기` → `confirm`/`reject` 흐름과 같습니다
  - 확정할 때 진료의를 직접 지정합니다. 현행은 직전 진료의(없으면 대표 원장)로 자동 배정하고 확정 뒤에 바꿉니다
  - 확정하면 플래너에 예약이 생기고 "네이버 예약 환자 등록"으로 환자와 연결합니다
  - 연동을 시작하면 네이버 쪽 기존 예약 목록이 초기화됩니다. 그래서 연동 전에 기존 예약을 내려받아 보관하라고 안내합니다. 재설계에서 외부 채널을 새로 연동하거나 바꿀 때 기존 예약을 옮기거나 보존하는 절차가 필요합니다 (추정)
  - 새 예약 알림(문자·전화·이메일)은 스마트플레이스 설정으로 한의원 관리자에게 갑니다
- **휴진 설정 위치:** 레거시 차트는 휴진일을 예약플래너 안에서 설정하고 예약 보드에 바로 표시합니다. 현행은 `/setting/schedule`과 `/setting/common` 진료시간 설정으로 나뉘어 있습니다 (레거시 차트 매뉴얼 「예약플래너에서 예약 및 예약문자 전송」)

## 미확인·추정
- 주간 조회의 `date` 값(`ai(f)`)이 주 시작일인지는 date-fns 별칭을 확인하지 못해 추정입니다.
- `AppointmentPlannerCancelDialog`의 "취소 안내 문자 보내기" 체크박스는 `Yu()`(환경이 `dev`)일 때만 보이고, 체크 값(`p`)은 emit payload에 들어가지 않습니다. 운영 번들에서는 쓰이지 않습니다.
- `외부예약미연동여부` 판단에 쓰는 `GET /desk/booking-requests` 기본 기간(`VO(t,5)` ~ `BO(t,1)`)의 단위(년/월)는 미확인입니다.
- 내원 처리, 자동 부도, 예약 알림 발송 시점은 서버 동작으로 추정합니다. 클라이언트는 `알림설정` 값만 보냅니다.
- 진료 스케줄과 `/setting/common` 진료시간 설정이 플래너의 `의사근무정보`·`병원휴진여부`·`점심휴게시간`에 반영되는 경로는 서버 쪽이라 추정입니다.
- `usePublicHolidays` 청크는 이름과 달리 처방 관련 모듈을 묶은 것으로, 예약 화면에서는 쓰이지 않습니다. 공휴일 API `GET /settings/holidays/public-holidays/{…}`(`법정공휴일`)는 `TemporaryHoursOrMonthlyHoliday` 쪽에서만 확인됩니다.
- `/analytics/appointment`(`AppointmentTableView`, 권한 `경영지표`)는 예약 통계 화면으로 보이며 이 문서에서는 다루지 않습니다.
