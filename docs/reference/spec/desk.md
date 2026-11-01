# 원무 (데스크)

원무 화면(`/desk`)은 하루의 환자 흐름을 **예약 → 대기 → 치료 → 수납 → 수납 완료** 5개 칸반 컬럼으로 보여 주고, 카드 드래그·메뉴로 접수 상태를 바꿉니다. 접수·환자 등록·환자 상세·수납·서류 발급·문자 발송은 오른쪽 사이드패널로 열립니다.
두 번째 탭 **수납현황**은 일자별 수납 내역, 현금 시재·정산, 지출 내역을 다룹니다. 목록은 1분 폴링과 Socket.IO 메시지로 갱신됩니다.

## 화면 레이아웃·탭

- **목적:** 원무 업무의 진입점입니다. 날짜별 내원 현황과 수납 현황을 탭으로 전환합니다
- **접근 조건:**
  - route meta: `requiresAuth: true`, `usesGlobalLayout: true`, `personalInfoKoPageName: "원무"`
  - `permissionCode`가 없어서 로그인한 사용자는 누구나 들어올 수 있습니다
  - 서비스 연동이 `emr`이면 기본 홈이 `desk`입니다 ([access-control.md](../access-control.md))
- **화면 구성:**
  - `DeskSuspense`: `DeskView`를 `defineAsyncComponent`로 불러옵니다 (`timeout: 30000`, 로딩 `RouteViewLoadingFallback`, 오류 `RouteViewErrorFallback`)
  - `DeskView` 상단:
    - `BaseTabBar`: 탭 `내원현황` / `수납현황`
    - `TodaySummaryBar`: 오늘 총 예약 건수(비대면 제외), 내원 인원(`/desk/waiting` 건수), 수납액, "HH시 mm분 기준" 시각
  - `내원현황` 탭 → `DeskVisitView`, `수납현황` 탭 → `DeskPaymentsView`
  - `useTouchDragAndDropPolyfill`: 터치 기기에서도 카드 드래그가 되게 합니다
- **동작:**
  - 탭을 바꾸면 `router.push({ query: { view } })`가 실행됩니다. `?view=수납현황`이 아니면 `내원현황`을 보여 줍니다
  - `?date=yyyyMMdd`로 들어오면 `useDeskDateStore.deskDate`가 그 날짜로 맞춰집니다. 파싱에 실패하면 오늘로 돌아갑니다
- **상태 저장:**
  - Pinia `deskDate`: `deskDate`, `deskScrollPositions`
    - 스크롤 위치는 날짜·컬럼(`data-desk-scroll` = `board`/`appointment`/`waiting`/`treatment`) 단위로 저장했다가 복원합니다
    - `onActivated`/`onDeactivated` 훅을 쓰므로 keep-alive 안에서 동작합니다 (추정)
- **근거:** `re-upstream/restored/router/routes.js`, `re-upstream/restored/components/desk/DeskSuspense.vue`, `re-upstream/restored/views/DeskView.vue`, `re-upstream/restored/components/today/TodaySummaryBar.vue`, `re-upstream/restored/stores/deskDate.js`, `re-upstream/restored/modules/DeskView/part-3.js` (`Ff` 스크롤 복원)

## 내원현황 보드 (5개 컬럼)

- **목적:** 선택한 날짜의 예약과 접수 환자를 상태별 컬럼으로 보여 줍니다
- **접근 조건:** 없음. 카드 단위 행위마다 권한을 검사합니다 (아래 각 절)
- **화면 구성:**
  - `DeskVisitHeader`
    - `EmrDatePickerButton`, 이전·다음·오늘 버튼
    - `DoctorsButtonGroup`: 진료의 필터
    - 그룹핑 `BaseSelectBox`
    - "차팅완료" 범례
    - 환자 검색 입력: `f(이름, 검색어)`, 한글 초성 매칭 (추정)
  - 컬럼은 `grid-cols-[repeat(5,minmax(284px,404px))]` 그리드로 배치됩니다

    | 컬럼 | 컴포넌트 | 내부 리스트 | 데이터 |
    |---|---|---|---|
    | 예약 | `DeskVisitAppointment` | `AppointmentColumn`(시간대별 `AppointmentColumnTime`, 시간 미정 `AppointmentColumnUnscheduled`), EMR 모드에서는 `DeskVisitTelemedicineCard` | `/desk/appointments` |
    | 대기 | `DeskVisitWaiting` | `WaitingColumn` | `/desk/waiting` 중 `상태 === "대기"` |
    | 치료 | `DeskVisitTreatment` | `TreatmentColumn` | `상태 === "치료"` |
    | 수납 | `DeskVisitPayment` | `PaymentColumn` | `상태 === "수납"` |
    | 수납 완료 | `DeskVisitPaymentComplete` | `PaymentCompleteColumn` | `상태 === "수납완료"` |

  - 데이터가 하나도 없으면 `DeskVisitEmptySection`을 보여 줍니다. 문구는 "표시할 환자 목록이 없습니다."이고 `환자 예약`·`환자 접수` 버튼이 있습니다
  - 각 컬럼 헤더(`DeskVisitPatientCardHeader`)에 제목, 건수, 카드 형태 전환 버튼(`normal` ↔ `simple`)이 있습니다. `simple`은 접힌 카드 `PatientCardFolded`입니다
- **동작:**
  - **필터**
    - 진료의 필터: `진료의Id === selectedDoctorId`
    - 이름 검색: 대기 목록은 `환자이름`, 예약 목록은 `이름`을 씁니다
    - `비대면여부`인 항목은 모든 컬럼에서 뺍니다
  - **정렬**
    - 대기·치료·수납 목록은 `대기시간` 오름차순입니다
    - 대기 항목에 `예약Id`가 있으면 예약 데이터의 `예약시간`과 외부 `주문출처`를 붙입니다(`외부예약주문출처`)
  - **그룹핑** (`zs`, 대기·치료 컬럼에 적용)
    - 값: `진료의`(진료의별 보기, 기본) / `진료항목` / `보험구분` / `없음`(접수순 보기)
    - 진료의가 1명 이하이면 진료의 그룹핑을 하지 않습니다
    - 보험구분 배지 색: 건보 blue-light, 자보 indigo, 산재·급여 warning, 일반 gray
  - **예약 컬럼 토글:** "내원 n · 부도 n · 취소 n 숨김"을 켜면 `vl()` 결과가 `내원`/`취소`/`부도`인 카드를 숨깁니다. 판정 기준은 `예약변경내역`의 마지막 `to.예약상태`입니다
  - **카드 상태 표시** (`card-state`)
    - `highlighted`: 방금 접수한 환자 (`usePatientStore.recentAcceptPatientId`, 2초 뒤 초기화)
    - `success`: `차팅완료여부`
    - 그 밖: `default`
  - **카드 조작**
    - 더블클릭: 환자상세 사이드패널을 엽니다. `canAccess$(환자상세)`가 없으면 "현재 권한으로 실행할 수 없습니다." 다이얼로그를 띄웁니다
    - `차트보기` 버튼: `canAccess$(진료)`일 때 `switchPatient({ 환자Id, 진료Id, 보험구분 })`로 진료 화면으로 갑니다
    - 카드 메모 팝오버 `DeskVisitPatientCardMemoPopover`: `POST /patients/{id}/memos` (`내용`, `카테고리` = 직원/진료의/상담/기타)
- **데이터:**

  | 훅 | 엔드포인트 | 비고 |
  |---|---|---|
  | `useDeskWaitingQuery(date)` | `GET /desk/waiting?date=yyyyMMdd` → `results.환자목록` | `refetchInterval: 1분`, 백그라운드에서는 폴링하지 않음 |
  | `useDeskAppointmentsByValueQuery(date)` | `GET /desk/appointments?date=` → `results.예약`, `results.시간미정예약내역` | 1분 폴링 + `refetchOnWindowFocus`. `select`로 `{ patients(시간대별), unscheduled }`로 바꿈 |
  | `useSettingsDoctorsQuery` | `GET /settings/doctors` | 진료의 목록·그룹핑 판단 |
  | `useSettingsTreatmentsRoomsQuery` | 치료실 설정 | 치료 이동 전 치료실이 있는지 확인 |

  - 대기 항목에서 쓰는 주요 필드:
    - 식별·상태: `내원Id`, `환자Id`, `진료Id`, `상태`, `대기시간`, `접수일시`
    - 환자: `환자이름`, `차트번호`, `주민등록번호앞7자리`
    - 진료: `진료의Id`, `진료의`, `진료항목목록`, `보험구분`, `진료타입`, `예약Id`
    - 보험 조회: `건강보험조회`, `산재보험조회`
    - 진행 상태: `차팅완료여부`, `수납존재여부`, `치료실현황`
    - 금액: `미수금액`, `과수금액`, `선수금잔액`
    - 기타: `메모목록`, `제주지원사업목록`, `방문진료대상구분`, `한방첩약상병구분코드`, `비대면시범사업여부`, `진행중인패키지여부`
- **상태 저장:**
  - query key: `["desk","waiting",date]`, `["desk","appointment",date]`
  - localStorage:
    - 그룹핑 기준: `deskVisitGroupingCriteria` (`Bxe` 훅)
    - 컬럼별 카드 형태: `patientCardType`(예약), `waitingPatientCardType`, `treatmentPatientCardType`, `paymentPatientCardType`, `paymentCompletePatientCardType`
    - 예약 컬럼 숨김 토글: `deskVisitHideCancelledNoShow`
- **근거:** `re-upstream/restored/views/DeskVisitView.vue`, `re-upstream/restored/components/desk/DeskVisitHeader.vue`, `re-upstream/restored/components/desk/DeskVisitAppointment.vue`, `re-upstream/restored/components/desk/DeskVisitWaiting.vue`, `re-upstream/restored/components/desk/DeskVisitEmptySection.vue`, `re-upstream/restored/modules/DeskView/part-3.js`, `re-upstream/restored/modules/index/useDeskWaitingQuery.js`, `re-upstream/restored/modules/index/useDeskAppointmentsByValueQuery.js`, `re-upstream/restored/components/waiting/WaitingColumn.vue`

## 접수·대기 상태 값

### 내원(접수) `상태`

| 값 | 컬럼 | 들어오는 경로 |
|---|---|---|
| `대기` | 대기 | 접수 생성(기본값), 다른 컬럼에서 드롭, 치료 카드의 "대기로 이동" |
| `치료` | 치료 | 접수 시 `치료` 선택, 베드 배정 모달 완료, 수납 카드의 "치료로 이동" |
| `수납` | 수납 | 대기·치료·수납완료 카드를 수납 컬럼에 드롭 |
| `수납완료` | 수납 완료 | 수납 완료 처리(`DeskVisitPaymentCheckOut`) 후 자동, 또는 수납 내역이 있는 카드를 드롭 |

- 화면 문구용 이동 단계(`_D`)에는 `차팅 완료`도 있습니다: `["차팅 완료","대기","치료","수납"]`. 분석 이벤트 값은 `no_move`/`waiting`/`treatment`/`payment`/`payment_done`입니다 (`re-upstream/restored/modules/SidePanelDeskActions/part-2.js`)

### 보험구분 (`S0e`)

`건보`, `자보`, `급여`, `산재`, `일반` (`re-upstream/restored/api/patients/queries-2.js`)

### 예약 상태

- `예약변경내역[].to.예약상태` 원본 값: `내원`, `예약취소`, `부도`
- `PatientCardAppointment`가 화면용으로 바꾼 값: `등록`, `예약 취소`, `예약 부도`, `예약 거절`, `내원완료`, `부도후_내원`, `취소후_예약일자_변경`
- 상태별 카드 메뉴 표 `Pn`의 키: `예약확정`, `부도`, `내원`, `부도후내원`, `취소`, `거절`

## 접수 (환자 접수 사이드패널)

- **목적:** 환자의 당일 내원을 등록합니다. 보험 자격 조회·진료의·진료항목을 정하고 대기 또는 치료로 보냅니다
- **접근 조건:**
  - `openSidePanel환자접수`는 `canCreate$(접수생성 = waiting_create)`일 때만 패널을 엽니다
  - `openSidePanel환자접수수정`은 `canUpdate$(접수수정 = waiting_update)`가 필요합니다
  - 진입 경로:
    - 헤더 `HeaderLayout`의 `접수` 버튼·검색
    - `DeskVisitEmptySection`/`DeskPatientAcceptModal`의 환자 검색 → `접수`
    - 예약 카드 메뉴 `접수`
    - 수납·수납완료 카드 메뉴 `접수`
    - 예약 카드를 대기·치료 컬럼에 드롭 (`최초내원일`이 있는 환자)
  - `DeskPatientAcceptModal`은 `Xi`(= `chartLayout === "full"`, EMR 구성)일 때 "환자 접수"로 동작합니다. 아니면 "차트 생성"(`차트생성` 패널)으로 동작합니다
- **화면 구성:** `SidePanelDeskActionsPatientAccept` → `DeskPatientAccept` (너비 1048px)
  - 왼쪽: `DeskPatientAcceptPatientInfo`
  - 오른쪽 상단: 프로필(`PatientProfileAvatarUpload`), 이름·성별·나이, 등급, 핸드폰·차트번호, `초진`/`재진` 배지, `상세 정보` 버튼
  - `DeskPatientAcceptInsuranceType`: 보험 구분 라디오, 건보 자격 표(`DeskPatientInsuranceEligibilityTable` → `PatientHealthInsuranceEligibilityTable`), 자보(`DeskPatientAcceptCar`), 산재(`DeskPatientAcceptIndustrial`), 제주지원(`DeskPatientAcceptJejuSupport`), 의뢰서 배너
  - 특이사항
    - `임산부` 체크: 나이·성별 조건 `QD`를 만족할 때만 보입니다
    - `미수: n원`, `과수납금`, `선수금` 잔액
  - `진료 항목`(필수) 라디오, `진료의`(필수) 라디오. 휴진 태그가 있는 진료의는 뒤로 정렬합니다
  - `접수 메모`: TipTap 에디터. 신규 접수에만 있습니다
  - 일차의료방문시범사업이면 "접수 완료 후 동의서 링크 보내기" 체크가 보입니다
  - 하단
    - `취소`
    - 건보이면 `DeskPatientAcceptInsuranceIdentityVerification`(본인확인)
    - 신규: `StageMoveControl`(옵션 `대기`/`치료`). 수정: `접수 수정` 버튼
- **동작:**
  1. **기본값 채우기** (신규 접수). 진료의·진료항목·보험구분을 아래 순서로 정합니다
     - 오늘 예약(`예약Id` 일치, 없으면 같은 `환자Id`)
     - 재진이면 직전 내원(`GET /patients/{id}/waiting/latest` → `직전내원현황`)
     - 첫 번째 진료의, 진료항목이 1개뿐이면 그 항목
     - 보험구분 기본값은 `건보`입니다
     - 자보이고 직전 내원에 `자동차보험조회`가 있으면 가져옵니다. 단 보증종료일이 지났으면 가져오지 않습니다
  2. 건보 자격 조회 결과에 `급여제한여부`가 있으면 보험구분을 `일반`으로 바꾸고 "건강보험 무자격자로 확인되어 보험 구분을 일반으로 변경했습니다." 경고를 띄웁니다
  3. 조회한 `시설기호증번호`가 환자의 `건강보험증번호`와 다르면 `PATCH /patients/{pid}`로 갱신합니다
  4. **선택의료기관(본인부담 B005) 처리**
     - 직전 내원의 `건강보험조회.본인부담여부`가 `B005`이고 선택기관이 있으면 "지난 의뢰 승계" 안내를 띄우고 그 기관을 미리 선택합니다
     - 우리 기관이 선택기관이 아닌데 기관을 고르지 않으면 "선택의료기관 환자입니다." 다이얼로그로 막습니다
  5. **검증** (`validateInsuranceType`, `AD`, 제주지원 `validate`)
     - 버튼 활성 조건 `kl`: `차트번호`, 보험구분, 진료항목, 진료의, 건보/자보 필수 필드가 모두 있어야 합니다
     - 자보이고 "본부금 100%"를 체크하지 않았는데 누적 진료비(`GET /patients/{id}/car-waiting/amount/{사고접수번호}` → `진료비총액`)가 `보증한도금액`을 넘으면 "누적 진료비가 보증한도를 초과했습니다." 다이얼로그를 띄웁니다
  6. **신규 접수:** `POST /desk/waiting`
     - body: `{ 접수경로: "DESK", 차트Id, 상태(대기|치료), 접수일시, 배정치료실: "", 접수메모, 진료의Id, 진료항목Ids:[1개], 초진여부, 보험구분, 예약Id, options{…}, 내원일자, 건강보험원본, 건강보험조회, 자동차보험조회, 산재보험조회, 본인확인여부, 선택된기관기호, 선택된기관이름 }`
     - `options`: `_100여부`, `임산부여부`, `산정특례특정기호`, `산정특례등록번호`, `희귀난치의료비지원진료여부`, `한방첩약본인부담률구분코드`, `한방첩약상병구분코드`, `방문진료대상구분`, `비대면시범사업여부`
     - 응답 `{ 진료Id, 내원현황Id }`. 제주지원사업이 있으면 `persist(진료Id)`로 저장합니다 (`/desk/jeju-snapshot/*`)
     - 토스트: "{이름}님이 대기로 이동했습니다." (`gD`)
     - `moveToTreatment`이면 `switchRecord(진료Id)`로 진료 화면으로 갑니다
  7. **접수 수정:** `PATCH /desk/waiting/{내원Id}`. 바뀐 필드만 보냅니다
     - 자보이면 `본인확인여부`는 빼고, 자동차/산재 조회는 값이 달라졌을 때만 넣습니다
     - 이미 `승인여부`인 처방이 있으면 보험구분을 바꿀 수 없습니다 ("이미 제출된 …이/가 있어 보험 구분을 변경할 수 없습니다.")
     - 보험구분 변경으로 무효가 되는 처방이 있으면 확인을 받은 뒤 `POST /record/{rid}/save`로 그 처방을 지웁니다
     - 토스트: "환자 접수 수정이 완료되었습니다."
  8. 끝나면 `patientStore.setRecentAcceptPatientId(환자Id)`로 카드를 강조합니다. 방문진료 동의서 링크 체크가 되어 있으면 `intakeLinkPromptStore.열기({ 제목: "방문진료 동의서 전송" })`를 부릅니다
- **데이터:** `POST /desk/waiting`, `PATCH /desk/waiting/{id}`, `GET /patients/{id}`, `GET /patients/{id}/waiting/latest`, `GET /desk/appointments/{id}/history`, `GET /settings/doctors/appointments/{date}`(휴진 태그), `POST /nhic/m2/get-data`(건보 자격조회: `수진자성명`, `수진자주민등록번호`, `건강보험증번호`, `본인확인여부`, `진료일자`), `GET /patients/{id}/car-waiting`, `GET /patients/{id}/sanjae-waiting`, `GET /desk/prepaid/charts/{차트Id}`
- **상태 저장:**
  - `usePostDeskWaitingMutation` 성공 시 무효화: `desk.waiting(today)`, `desk.appointment(today)`, `appointmentsPlanner.all`, 환자 `QueryKey$.all`, `patientHistory`
  - `usePatchDeskWaitingMutation` 성공 시: `waiting`이 들어간 모든 키를 무효화합니다
  - 패널 상태는 `xft()`가 만든 `sidePanelContextState` ref에 둡니다 (`{ panel, data }`)
- **근거:** `re-upstream/restored/components/desk/DeskPatientAccept.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsPatientAccept.vue`, `re-upstream/restored/components/desk/DeskPatientAcceptModal.vue`, `re-upstream/restored/api/desk/requests-4.js` (`postDeskWaiting`), `re-upstream/restored/modules/mutations/usePostPatientsNewMutation.js`, `re-upstream/restored/modules/index/part-86.js` (`xft`), `re-upstream/restored/components/patient/PatientHealthInsuranceEligibilityTable.vue`

## 대기 상태 전환 (드래그·카드 메뉴)

- **목적:** 카드를 다른 컬럼으로 옮겨 내원 `상태`를 바꿉니다
- **접근 조건:**
  - 상태 이동 드롭: `canUpdate$(접수수정)`. 없으면 권한 다이얼로그를 띄웁니다
  - 예약 카드 드롭: 재진이면 `canCreate$(접수생성)`, 신환이면 `canCreate$(환자생성)`
  - 카드 메뉴 비활성 규칙 (`PatientCard.disable$`)

    | 메뉴 | 필요한 권한 |
    |---|---|
    | 예약 | `예약생성` |
    | 접수 | `접수생성` |
    | 문서 발급 | `문서발급` |
    | 접수 수정·대기로 이동·치료로 이동·베드 수정 | `접수수정` |
    | 접수 취소 | `canDelete$(접수삭제)` |
    | 수납 기록 | `수납생성` |

- **동작:**
  - **드롭 규칙** (`DeskVisitPatientCardDropArea`): 허용하지 않는 출발 컬럼이면 "진료 순서로 인해 환자를 이 열로 옮길 수 없습니다."를 보여 줍니다

    | 도착 컬럼 | 허용 출발 | 결과 |
    |---|---|---|
    | 대기 | 예약·치료·수납·수납완료 | 예약 → 재진(`최초내원일` 있음)은 접수 패널(`예약Id` 포함), 신환은 환자 등록 패널(`예약Id`, `메모`). 그 밖은 `PATCH 상태: "대기"` |
    | 치료 | 예약·대기·수납·수납완료 | 예약은 대기와 같습니다. 그 밖은 `movePatientToTreatment` → 베드 배정 모달 |
    | 수납 | 대기·치료·수납완료 | `PATCH 상태: "수납"` |
    | 수납 완료 | 수납(항상). 치료·대기는 끌고 온 카드에 `수납존재여부`가 있을 때만 | 수납에서: `수납존재여부`면 `PATCH 상태: "수납완료"`, 없으면 `canCreate$(수납생성)` 확인 후 수납 패널을 엽니다. 치료에서: `수납존재여부`면 `PATCH 상태: "수납완료"` |

  - **치료 이동 (베드 배정)**
    - 치료실이 하나도 없으면 "환자 이동 전 치료실 등록이 필요합니다." 확인 후 `/setting/treatment?tab=바이탈+및+치료실`로 갑니다
    - `치료실현황.치료완료일시`가 있으면 `DuplicateTreatmentRoomConfirmDialog`로 한 번 더 묻습니다
    - `TreatmentRoomBedAssignModal` 저장 시 처리:
      - 전달사항: `PUT /noti/instructions` (`내원Id`, `내용`). 비우면 `DELETE /noti/instructions/{id}`
      - 진료의를 바꿨으면: `PATCH /desk/waiting/{id}` (`진료의Id`)
      - 베드를 골랐으면: `PUT /treatments/patients/{내원Id}` (`치료실설정Id`, `치료실베드`) → "{이름}님을 {치료실명} {n}번 베드에 배정했습니다."
      - 베드를 고르지 않았으면: `PATCH /desk/waiting/{id}` (`상태: "치료"`)
    - 치료 카드의 `베드 수정` 메뉴는 같은 모달을 `mode: "수정"`으로 엽니다
  - **카드 메뉴** (`desk-patient/_hoisted_1.js`)

    | 컬럼 | 메뉴 |
    |---|---|
    | 대기 (`sr`) | 접수 수정, 예약, 문자 발송, 문진 링크 전송, 문서 발급, 접수 취소 |
    | 치료 (`cr`) | 접수 수정, 예약, 문자 발송, 문진 링크 전송, 문서 발급, 대기로 이동, 베드 수정 |
    | 수납 (`dr`) | 접수, 예약, 문자 발송, 문진 링크 전송, 문서 발급, 치료로 이동, 수납 기록 |
    | 수납 완료 (`_hoisted_1`) | 접수, 예약, 문자 발송, 문진 링크 전송, 문서 발급 |

    - 오늘 자보 카드에는 `접수 수정` 다음에 `자보 접수 이력`(`PatientCarHistoryModal`)이 붙습니다
    - 과거 날짜에서는 `예약`·`문자 발송`·`문진 링크 전송`·`문서 발급`·`수납 기록`만 남습니다 (`ir`)
    - `문진 링크 전송`은 `Sct(me.요양기관기호)`가 참일 때만 보입니다 → `IntakeLinkSendModal`
  - **접수 취소**
    - 확인 문구: "환자 접수를 취소하시겠습니까? 접수한 날짜의 진료 기록과 수납 내역이 함께 삭제됩니다."
    - `DELETE /desk/waiting/{내원Id}`를 보냅니다. 낙관적으로 목록에서 먼저 빼고, 실패하면 되돌립니다
    - 토스트: "접수를 취소했습니다."
  - **상태 PATCH 공통** (`ss().moveWaitingPatient` → `usePatchDeskWaitingByIdMutation`)
    - `onMutate`가 `desk.waiting(date)` 캐시의 `상태`를 먼저 바꿉니다 (낙관적 갱신)
    - 같은 `내원Id`로 진행 중인 요청은 `AbortController`로 취소합니다
    - 실패하면 롤백하고 "{상태}로 이동하지 못했습니다." 토스트를 띄웁니다
    - `이전상태`는 요청 body에서 뺍니다
- **데이터:** `PATCH /desk/waiting/{id}` (`상태`, `진료의Id` 등), `DELETE /desk/waiting/{id}`, `PUT /treatments/patients/{내원Id}`, `PUT`/`DELETE /noti/instructions`
- **상태 저장:** query `["desk","waiting",date]` 낙관적 갱신. 드래그 데이터 `{ type: Tt.PATIENT_CARD, from: "예약"|"대기"|"치료"|"수납"|"수납완료", …Data }`
- **근거:** `re-upstream/restored/components/waiting/WaitingColumn.vue`, `re-upstream/restored/components/treatment/TreatmentColumn.vue`, `re-upstream/restored/components/payment/PaymentColumn.vue`, `re-upstream/restored/components/payment/PaymentCompleteColumn.vue`, `re-upstream/restored/components/desk/DeskVisitPatientCardDropArea.vue`, `re-upstream/restored/modules/DeskView/part-4.js`, `re-upstream/restored/modules/CardDropArea/usePutTreatmentsPatientsMutation.js`, `re-upstream/restored/components/treatment/TreatmentRoomBedAssignModal.vue`, `re-upstream/restored/modules/desk-patient/_hoisted_1.js`, `re-upstream/restored/components/patient/PatientCard.vue.js`

## 예약 카드 (데스크 측)

- **목적:** 당일 예약을 시간대별로 보여 주고, 예약 카드에서 바로 접수·예약 수정·취소를 합니다. 예약 플래너 자체는 [appointment.md](appointment.md)에서 다룹니다
- **접근 조건:**
  - 메뉴 비활성 규칙: 예약 → `예약생성`, 예약 수정 → `예약수정`, 예약 취소·삭제 → `예약삭제`, 접수 → `접수생성`
  - `AppointmentCardContextMenuWrapper`의 `$()` 검사도 같은 규칙입니다
- **화면 구성:**
  - `AppointmentColumnTime`: `PatientCardAppointment`/`PatientCardFoldedAppointment`
  - 오늘 날짜면 현재 시각에 가장 가까운 시간대로 스크롤합니다
  - 시간 미정 예약은 위에 고정(sticky)됩니다
- **동작:**
  - **메뉴** (`Je`)
    - 항목: 접수, 예약, 문자 발송, 문진 링크 전송, 문서 발급, 예약 수정, 예약 취소, 예약 삭제
    - `예약 부도`이고 과거 날짜면 `접수`·`예약 수정`을 숨깁니다
    - `예약 취소`/`거절`/`내원완료`/`취소후_예약일자_변경`/`부도후_내원`이면 `접수`·`예약 수정`·`예약 취소`를 숨깁니다
  - **예약 취소:** `AppointmentPlannerCancelDialog`에서 사유를 받아 `PATCH /desk/appointments/{예약Id}` (`취소여부: true`, `변경사유`)를 보냅니다
  - **예약 삭제:** "예약을 삭제하시겠습니까? … 예약 안내 메시지도 함께 삭제됩니다." 확인 후 `DELETE /desk/appointments/{id}`를 보냅니다
  - **시간 이동 드래그:** 예약 카드를 다른 시간대에 놓으면 `PATCH /desk/appointments` (`예약시간`)를 보냅니다. 조건이 `source.time < target.time`이라 **더 늦은 시간대로만** 옮겨집니다
  - **드래그 제한:** 마지막 상태가 `예약취소`·`내원`인 카드와 과거 날짜 카드(`b`)는 끌 수 없습니다
  - `PatientCardAppointment`의 `차트 조회`/`차트 생성` 버튼: `createChart` → `openSidePanel차트생성`
- **데이터:** `GET /desk/appointments?date=`, `PATCH /desk/appointments/{id}`, `DELETE /desk/appointments/{id}`. 비대면은 `GET /desk/appointments/telemedicine`(`DeskVisitTelemedicineCard`)입니다
- **상태 저장:**
  - `usePatchDeskAppointmentsMutation`이 `desk.appointment(date)` 캐시의 `예약`·`시간미정예약내역`을 낙관적으로 갱신합니다
  - 성공하면 `appointmentsByDateAndDoctor`, `appointmentsPlanner.all`, `doctalk.all`, 환자 예약 이력 키를 무효화합니다
- **근거:** `re-upstream/restored/components/appointment/AppointmentColumn.vue`, `re-upstream/restored/components/appointment/AppointmentColumnTime.vue`, `re-upstream/restored/components/patient/PatientCardAppointment.vue`, `re-upstream/restored/components/appointment/AppointmentCardContextMenuWrapper.vue`, `re-upstream/restored/components/desk/DeskVisitTelemedicineCard.vue`

## 수납 (환자 수납 사이드패널)

- **목적:** 선택한 진료 건의 본인부담금·비급여 진료비를 결제수단별로 받습니다. 끝나면 내원을 `수납완료`로 옮깁니다
- **접근 조건:**
  - 수납 카드의 `수납기록` 버튼(`move-to-payment`)과 `수납 기록` 메뉴: `canCreate$(수납생성 = receipt_create)`
  - 수납 완료 컬럼 드롭: 수납 내역이 없으면 `수납생성`을 확인합니다
  - 비급여 진료 추가: `PRN처방생성수정삭제`에 `canWrite$`가 필요합니다. 적용 규칙이 `담당환자`면 내 `진료의Id`와 진료의 진료의가 같아야 합니다
- **화면 구성:** `DeskVisitPaymentCheckOut` (`BaseSidePanel`, `#side-panel`)
  - 헤더: `SidePanelPatientDescriptionHeader` "환자 수납"
  - 왼쪽 "진료비": 최근 처방 `PatientInfoDetailRecordsListLastRecordMedicines`, 진료 건 카드 `DeskVisitPaymentCheckOutTreatmentCard`(선택 체크), 그 아래 "과수납" 구분선과 과수납 카드
    - 카드 상세 `DeskVisitPaymentCheckOutTreatmentCardDetail`: 급여 본인부담, 비급여, 본인부담 총액, 제주 지원금, 과수납금 미수, `비급여 진료 추가`, 처방 금액·할인 수정
  - 가운데 `PaymentCalculator`
    - 수납일(`EmrDatePickerButton`), `선수금 충전`
    - `DeskVisitPaymentCheckOutCalculator`: 받을 금액(비과세/과세), 결제 수단 행, 남은 금액, 과수납금 사용, 전액 미수 처리
    - 체크: `의료비 소득공제제외`, `손비 처리`
    - `수납 메모`, `담당자` (원장/부원장/실장(기본)/데스크/치료실/간호사)
  - 오른쪽: `자격여부`가 `7`/`8`(의료급여)일 때만 `MedicalAidsM3SidePanelRight`
  - 하단 `DeskVisitPaymentCheckOutFooter`
    - `취소`
    - 자보이면 주간 내원 수(`JaboWeeklyVisitCount`)와 `내원일수 조회`(`JaboVisitDaysModal`)
    - `다음 내원 예약`: 예약 패널. `보험구분`과 `진료항목Ids`를 미리 채웁니다
    - `수납완료`
- **동작:**
  1. **진료 건 표시**
     - `GET /patients/v2/chart/{차트Id}/medical-receipts`의 진료 건 `상태`: `수납필요`, `미수납`, `과수납`
     - 처음 선택: 넘겨받은 `진료Id`가 목록에 있으면 그날(과거 날짜면 데스크 날짜) 진료를 모두 고릅니다. 없으면 첫 건을 고릅니다
     - 수납일 기본값은 선택한 진료 중 가장 늦은 `진료일자`입니다 (`eq`)
  2. **결제 수단**
     - 기본 행: `선수금`, `카드`, `현금`, `통장`
     - 추가할 수 있는 수단: 카카오페이, 지역 화폐, 제로페이, 임신 바우처 등
     - 제주지원금이 있으면 `제주지원금` 행이 맨 앞에 자동으로 들어갑니다 (`min(지원금 합, 받을 금액)`)
     - `선수금` 행은 잔액에 맞춰 `선수금(현금)`/`선수금(카드)`로 나눠 보냅니다 (`ZU`)
  3. **결산** (`남은금액상태`): 받은 금액 − 받을 금액이 음수면 `과수납`, `손비처리`면 `손비`, 양수면 `미수`입니다. 과수납이면 손비 처리를 끕니다
  4. **미수 확인:** 받을 금액이 남아 있는데 입력한 금액이 0이고 과수납금·손비·전액 미수를 고르지 않았으면 "받은 금액이 입력되지 않았습니다. 미수금으로 처리하시겠습니까?"를 묻습니다
  5. **처방 변경 반영:** 수납 화면에서 처방 금액을 바꾸거나 비급여를 추가했으면 진료마다 먼저 `POST /record/{진료Id}/save`를 보냅니다 (`할인금액`, `진료처방`)
  6. **수납 저장:** `POST /desk/v2/receipts`
     - body: `{ 공제제외여부, 담당자, 메모, 수납일자(yyyyMMdd), 차트Id, 과수납금사용여부{비과세,과세}, 손비처리, 진료목록:[{진료Id}], 결제목록:[{결제Id, 결제수단, 결제정보:"{}", 과세금액, 비과세금액}] }`
     - 응답에 `선수금`이 있으면 선수금 캐시를 바로 갱신합니다 (`Nc`)
  7. 그날 대기 목록에서 같은 환자·`내원Id`를 찾아 `PATCH /desk/waiting/{id}` (`상태: "수납완료"`)를 보냅니다. 반복 수납(`isRepeatCheckout`)이면 상태를 바꾸지 않고 `check-out` 이벤트만 냅니다
  8. 토스트: "수납을 완료했습니다."
  - **선수금:** 충전 `POST /desk/prepaid/charts/{차트Id}/charges` (`금액`, `결제수단`, `담당자`, `메모`), 환불 `POST /desk/prepaid/charts/{차트Id}/refunds` (`선수금계열`, `금액`, `환불수단`, `담당자`, `사유`). 환불은 계열별로 나눠 여러 번 보냅니다
- **데이터:** `GET /patients/{id}`, `GET /patients/v2/chart/{차트Id}/medical-receipts`, `GET /desk/prepaid/charts/{차트Id}`, `POST /desk/v2/receipts`, `PATCH /desk/waiting/{id}`, `POST /record/{rid}/save`, 진료기록 조회(`useRecordPatientQuery`, `useRecordQuery`)
- **상태 저장:**
  - 수납 후 무효화: `desk.waiting(date)`, `desk.medicalReceipts(차트Id)`, 그리고 키에 `waiting`/`patientInfo`/`getReceiptsKeysByPatientId`/`getReceiptDetailsKeysByPatientId`/`medicalReceipts`가 들어간 모든 쿼리
  - `finally`에서 `desk.receipts(today)`도 무효화합니다
- **근거:** `re-upstream/restored/components/desk/DeskVisitPaymentCheckOut.vue`, `re-upstream/restored/components/payment/PaymentCalculator.vue`, `re-upstream/restored/components/desk/DeskVisitPaymentCheckOutCalculator.vue`, `re-upstream/restored/components/desk/DeskVisitPaymentCheckOutFooter.vue`, `re-upstream/restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue`, `re-upstream/restored/modules/SidePanelDeskActions/usePostDeskPrepaidChartsChargesMutation.js`

## 수납현황 탭 (수납 내역·시재·지출)

- **목적:** 데스크 날짜의 수납 내역 집계, 현금 시재 입력·정산, 현금 지출 기록을 다룹니다
- **접근 조건:** 별도 권한 검사가 보이지 않습니다
- **화면 구성:** `DeskPaymentsView`
  - 왼쪽
    - `DeskPaymentsHeader`: 날짜 이동
    - `DeskPaymentsDashboard`: 총 수납액·총 수납건, 카드/현금/통장/기타, 미수·과수납·환불, 초진/재진/재초진
    - `DeskPaymentsHistoryTable`: AgGrid. 결제 수단·보험구분 필터, 처음/마지막 이동, 상세 행을 펼쳐 진료별 내역을 봅니다
  - 오른쪽 320px
    - `DeskPaymentsCashBalance`: 시작 금액, 현금 수납·환불·지출, 현재 돈통 금액, 마감 금액
    - `DeskPaymentsExpenseHistory`: 지출 내역
  - `DeskPaymentsUnusualPatients` "미수·선수금 현황 보기" → `DeskPaymentsUnusualPatientsPanel`: 환자별 미수금·선수금 잔액. 행을 고르면 환자상세 `수납 내역` 탭이 열립니다
- **동작:**
  - 테이블 행 클릭·`수납내역` 버튼 → `PatientInfoDetail`(`initial-tab="수납 내역"`, `initial-receipt-sort="수납일 기준"`)
  - `본인부담금 수납대장` → `CopaymentLedger` 사이드패널
  - `엑셀 다운로드`: `ExcelDownloadReasonModal`에서 사유를 입력해야 받을 수 있습니다
  - **시재 상태** (`yr`)

    | 상태 | 조건 | 버튼 |
    |---|---|---|
    | `미등록` | `시작금액 === null` | `시재입력` |
    | `정산전` | `현금정산일시` 없음 | `금액 정산` |
    | `정산완료` | 정산했고 이후 수정 없음 | `다시 정산` |
    | `정산후수정` | 정산 뒤 `마감후수정여부` | `다시 정산`. 경고 "마감 후 수납/지출 내역이 수정됐습니다." |

  - **예상마감금액**
    - 서버가 준 `현금흐름.예상마감금액`이 있으면 그 값을 씁니다
    - 없으면 `시작금액 + 현금수납 − (현금지출 + 현금환불)`로 계산합니다. 현금수납 = 수납현금 + 선수금현금충전입니다
  - **시재 입력·수정:** `POST /desk/cash-registers` (`시작금액`, `현금시재금액재사용`("다음에도 같은 시재 사용"), `현금시재일자`), `PUT /desk/cash-registers/{id}`
  - **정산:** `POST /desk/settlements/cash/{date}`
  - **지출**
    - 입력: `POST /desk/expenses` (`지출금액`, `지출일자`, `지출항목Id`)
    - 삭제: `DELETE /desk/expenses/{id}`
    - 출금 사유: `POST /desk/expenses/items` (`지출사유`), 삭제 `POST /desk/expenses/items/delete` (`지출항목Ids`)
    - 시재가 없으면 지출 입력을 막습니다 ("시재 입력 후 지출 내역을 입력해 주세요.")
    - 정산 뒤에 입력·삭제하면 "다시 정산이 필요합니다."라고 안내합니다
  - **변경 감지:** `GET /desk/receipts/updated-checks/{date}?datetime=` → `isUpdated`이면 "수납 현황에 변경된 내역이 있습니다. 새로고침 후 변경된 내역을 확인해 주세요."를 보여 줍니다
- **데이터:** `GET /desk/receipts/{date}` → `results.수납현황`, `GET /desk/cash-registers?date=`, `GET /desk/expenses?date=`, `GET desk/expenses/items`, `GET /desk/balances` (`limit`, `offset`, `type`), `GET`/`POST /documents/copayment-ledger`
- **상태 저장:** query key `desk.receipts(date)`, `desk.cashBalance(date)`, `desk.expenseReceipts(date)`, `desk.expenseItems()`, `desk.checkReceiptUpdate(date, datetime)`
- **근거:** `re-upstream/restored/views/DeskPaymentsView.vue`, `re-upstream/restored/components/desk/DeskPaymentsHistoryTable.vue`, `re-upstream/restored/components/desk/DeskPaymentsCashBalance.vue`, `re-upstream/restored/components/desk/DeskPaymentsCashBalanceForm.vue`, `re-upstream/restored/components/desk/DeskPaymentsCashBalanceSettlement.vue`, `re-upstream/restored/components/desk/DeskPaymentsExpenseHistory.vue`, `re-upstream/restored/components/desk/DeskPaymentsUnusualPatients.vue`, `re-upstream/restored/modules/DeskView/part-2.js`, `re-upstream/restored/components/copayment/CopaymentLedger.vue`

## 환자 등록·검색

- **목적:** 신규 환자를 등록하거나 기존 환자 정보를 고칩니다. 등록 직후 바로 접수로 이어갈 수 있습니다
- **접근 조건:**
  - `openSidePanel환자등록`: `canCreate$(환자생성 = chart_create)`
  - `openSidePanel환자수정`: `canUpdate$(환자수정 = chart_update)`
  - 패널 종류: `등록`, `접수전등록`(검색어를 이름으로 미리 채움), `환자수정`
- **화면 구성:** `SidePanelDeskActionsPatientRegisterOrModify` → `DeskPatientRegister`
  - 기본 정보: 이름, 주민등록번호(`DeskPatientRegisterJumin`), 성별·생일·음력, 휴대폰·전화·보호자 번호, 이메일, 보험증번호
  - `DeskPatientRegisterChartNumber`, 주소(`DeskPatientRegisterAddress`), 등급, 내원 경로, 소개자, 특이사항
  - 신체 정보(`DeskPatientRegisterPhysical`), 가족관계(`DeskPatientRelationships`), 동의(`DeskPatientRegisterAgreements`), 제주지원사업(`DeskPatientRegisterJejuSupport`)
  - 버튼: `등록 완료`/`수정 완료`, `등록 후 접수`
- **동작:**
  - **주민번호 중복:** `POST /patients/check-ssn` 결과 `isDuplicated`이면 "이미 등록된 주민번호입니다."를 보여 줍니다
  - **차트번호**
    - 추천: `GET /desk/chart-numbers/recommendations` → `추천차트번호`
    - 저장 직전 검증: `GET /desk/chart-numbers/{no}/validations` → `isValid`
    - 중복일 때: 직접 입력한 번호면 "중복된 차트번호가 있어 변경이 필요합니다."를 띄웁니다. 추천 번호였으면 새로 추천받아 "중복된 차트번호가 있어 자동으로 변경했습니다."를 띄웁니다
  - **등록:** `POST /patients/new` → `환자Id`, 이어서 제주지원 `persist`
    - 토스트: "환자를 등록했습니다."
    - `등록 후 접수`면 `proceed-reception`을 내보냅니다. 패널이 `접수`(`예약Id`, `환자Id`, `건보자격조회결과데이터`)로 바뀌고, 조회한 자격 결과를 접수 화면이 그대로 씁니다
  - **수정:** `PATCH /patients/{pid}` → "환자 정보를 수정했습니다." 수정 화면에서도 `등록 후 접수`(`대기로접수`)로 접수에 들어갈 수 있습니다
  - **주소:** `POST`/`PATCH /desk/addresses/{환자Id}`, `POST /desk/addresses/delete/{환자Id}`. 모두 낙관적 갱신이고, 대표주소를 먼저 정렬합니다
  - 패널 밖을 누르면 `requestClose()`가 미저장 변경을 확인합니다
  - **검색**
    - `PatientSearch`(접수 모달)와 헤더 `DeskViewAutoCompleteSearch`가 `GET /patients/list` (`search_keyword`, `limit`)를 씁니다. `usePatientsListQuery_2`는 무한 스크롤(`next`)입니다
    - 검색 결과가 없으면 "{검색어}님을 환자로 등록 후 접수"/"신규 환자 등록"을 보여 줍니다
- **데이터:** `POST /patients/new`, `PATCH /patients/{pid}`, `POST /patients/check-ssn`, `GET /desk/chart-numbers/*`, `/desk/addresses/*`, `GET /desk/families/{id}/members-relations`, `GET /desk/families/relation-dictionaries`, `/desk/body-measurements/*`
- **상태 저장:**
  - 등록·수정 후 무효화: `desk.waiting(date)`, `desk.appointment(date)`, `patientInfo`, `patientProfileImage`, `relationship`, `patientAddresses`, `appointmentInfo`, 동의 이력
  - `usePostPatientsNewMutation`은 환자 `QueryKey$.all`을 무효화합니다
- **근거:** `re-upstream/restored/components/desk/DeskPatientRegister.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsPatientRegisterOrModify.vue`, `re-upstream/restored/components/desk/DeskPatientAcceptModal.vue`, `re-upstream/restored/components/patient/PatientSearch.vue`, `re-upstream/restored/modules/index/useDeskWaitingQuery.js`, `re-upstream/restored/components/header/HeaderLayout.vue`

## 사이드패널 (환자 상세 외)

- **목적:** 원무 화면의 모든 보조 작업을 오른쪽 패널 하나로 엽니다
- **접근 조건:** 패널마다 `xft()`에서 권한을 검사합니다. 권한이 없으면 아무 일도 일어나지 않습니다

  | panel | 여는 함수 | 권한 | 컴포넌트 |
  |---|---|---|---|
  | `환자상세` | `openSidePanel환자상세(환자Id, {initialTab, initialPackageId})` | `canAccess$(환자상세 = patient_info)` | `PatientInfoDetail` |
  | `등록`/`접수전등록`/`환자수정` | `openSidePanel환자등록`/`환자수정` | `환자생성`/`환자수정` | `DeskPatientRegister` |
  | `접수` / `접수 수정` | `openSidePanel환자접수`/`환자접수수정` | `접수생성`/`접수수정` | `DeskPatientAccept` |
  | `예약` / `예약 변경` | `openSidePanel예약`/`예약변경` | `예약생성`/`예약수정` | `DeskViewPatientAppointment` |
  | `문서발급` | `openSidePanel문서발급(환자Id)` | `canCreate$(문서발급 = document_create)` | `DocumentIssueView` |
  | `문자 발송` | `openSidePanel문자발송(id\|ids)` | `canAccess$(일반문자 = sms)` | `CrmPatientMessageSendSidePanel` |
  | `차트생성` | `openSidePanel차트생성(환자Id, 예약Id, {이름, 핸드폰번호})` | `canCreate$(접수생성)` | `SooChartCreatePanel` |

- **화면 구성:**
  - `SidePanelDeskActions`가 `validActions`에 있는 패널만 `#side-panel`로 텔레포트해 그립니다
  - `DeskVisitView`는 `bsn.provide`로 카드 컴포넌트에 콜백을 내려 줍니다: `sendMessage`, `printDocument`, `patientDetail`, `createPatient`, `createPatientAccept`, `createAppointment`, `editPatientAccept`, `editAppointment`, `createChart`
- **동작:**
  - **환자상세 (`PatientInfoDetail`)**
    - 탭(EMR 구성): 홈 / 예약 내역 / 수납 내역 / 패키지 내역 / 문진표 / 동의서. EMR이 아니면 `연락 이력`이 더 있습니다
    - 조건에 따라 `문진표`·`동의서` 탭이 빠지고, `vx`(soo 단독)이면 `수납 내역` 탭이 빠집니다
    - 홈 탭: `DeskPatientInfoBasicInfo`, 진료기록 목록(읽기 전용), `PatientMemo`
    - 액션 버튼:
      - 문자 발송 (`일반문자`)
      - 문서 발급 (`문서발급`)
      - 자보 접수 이력 (`접수수정`, EMR)
      - 예약 (`예약생성`)
      - 접수 (`접수생성`): EMR이면 접수 패널, 아니면 차트 생성
    - `canAccess$(환자상세)`가 없으면 "접근 권한이 없습니다."를 보여 줍니다
  - 수납 완료 카드의 `수납 내역` 버튼은 환자상세를 `initialTab: "수납 내역"`으로 엽니다
- **상태 저장:** `sidePanelContextState` ref (`{ panel, data }`). `_hoisted_2_2.provide`로 하위에 전달합니다
- **근거:** `re-upstream/restored/components/side/SidePanelDeskActions.vue`, `re-upstream/restored/modules/index/part-86.js`, `re-upstream/restored/components/patient/PatientInfoDetail.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsPatientInfoDetail.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsChartCreate.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsMessageSend.vue`

## 서류 발급

- **목적:** 환자의 진료비 영수증·세부산정내역서·진단서 등 서식을 작성·출력합니다
- **접근 조건:** `canCreate$(문서발급)`. 카드 메뉴 `문서 발급`, 환자상세 `문서 발급` 버튼에서 엽니다
- **화면 구성:**
  - `SidePanelDeskActionsDocumentIssue` → `DocumentIssueView`
  - 왼쪽 `DocumentIssueViewFormSelector`: "작성 가능한 문서" 목록과 "문서 검색"
  - 오른쪽 `DocumentIssueViewContainer`
- **동작:**
  - **서식 목록:** 상해진단서, 진료기록부 사본, 진료비(약제비) 납입 확인서, 진료비 세부산정내역서, 진료ㆍ통원확인서, 진단서, 요양급여의뢰서·회송서, 처방전(일반 한약), 첩약 처방ㆍ조제내역 안내, 한방진료비 계산서ㆍ영수증, 의료급여의뢰서·회송서·일수 연장승인 신청서, 진료의뢰서, 소견서, 약제소견서, 세관신고서(영문), 회송소견서, 향후 치료비 추정서, 근로능력평가용 진단서
  - **임시 저장:** 새 문서는 `POST /documents/drafts` (`환자Id`, `documentType`, `documentData`), 기존 초안은 `PATCH /documents/drafts/{id}` (`문서내용`) → "작성 내용을 임시 저장했습니다."
  - **닫기:** 미저장 내용이 있으면 "저장하지 않은 작성 내용이 있습니다." (저장하고 이동 / 저장안함)
  - **영수증류:** `POST /documents/patients/{pid}/medical-payment-receipt` (`진료Ids`), `POST /documents/patients/{pid}/herbal-medicine-receipt` (`진료Ids`, `합쳐서출력여부`), `POST /documents/patients/{pid}/medical-statement` (`진료Ids`)
  - **본인부담금 수납대장:** `/documents/copayment-ledger` (수납현황 탭)
- **데이터:** `/documents/*` ([endpoints.md](../../endpoints.md) `/documents` 절)
- **상태 저장:** Pinia `useDocumentIssueStore` (`currentDocumentType`, `selectedDraftItemId`, `isTempSaving`, `isCompletedSave`, snapshot)
- **근거:** `re-upstream/restored/views/DocumentIssueView.vue`, `re-upstream/restored/components/side/SidePanelDeskActionsDocumentIssue.vue`, `re-upstream/restored/modules/DocumentIssueView/진료내용.js`, `re-upstream/restored/stores/documentIssue.js`

## 실시간 동기화

- **목적:** 다른 단말(데스크·태블릿·진료실)에서 일어난 변경을 데스크 보드에 반영합니다
- **접근 조건:** 앱 셸 `App.vue`가 `XVt()`로 핸들러를 한 번만 구독합니다 (중복 등록 방지 플래그 `s`)
- **화면 구성:** 화면 없음. 새 접수가 오면 시스템 알림 "새 접수"가 뜹니다
- **동작:**
  - Socket.IO `message` 이벤트로 `{ type, payload }`를 받습니다. `useSocketClientStore.subscribe(type, handler)`로 분배합니다

    | type | 처리 |
    |---|---|
    | `ACTION_WAITING` | `desk.waiting(date)`, `desk.appointment(date)`, 예약 플래너 일/주 키 무효화. `actionType === "CREATE"`이면 `setRecentAcceptPatientId`와 접수 알림 |
    | `ACTION_APPOINTMENT` | `desk.appointment(date)`, `appointmentsByDateAndDoctor`, 환자 예약 이력, `appointmentHistory(예약Id)`, 플래너 |
    | `ACTION_APPOINTMENT_PLANNER` | 플래너 daily/weekly 키 |
    | `ACTION_TREATMENT` | 오늘 대기 목록, `treatmentPatientsBasic`/`treatmentPatients`/침 제거 키. `subType`이 `TIMER_CONFIG_UPDATE`/`GROUP_CONFIG_UPDATE`면 치료실 v2 설정 |
    | `ACTION_RECEIPT` | `desk.receipts(date)`, `expenseReceipts`, `cashBalance`, `checkReceiptUpdate` |
    | `ACTION_RECORD` | 오늘 대기, `medicalReceipts`, OCS 목록, 진료기록(`진료Id`/`진료Ids`), 환자 기록 목록, `patientInfo` |
    | `ACTION_MEMO` | 환자 메모 전체 + `desk.waiting(date)` |
    | `ACTION_PATIENT_PHOTO` | `patientProfileImage`, `patientInfo` |
    | `connect`(재연결 포함) | 오늘 `waiting`/`receipts`/`appointment`/메모/치료실 키를 일괄 무효화 |

  - **접수 알림 (`NUt`)**
    - 띄우는 조건:
      - `알림사용`이 켜져 있고 `접수경로`별 설정(`접수.태블릿`/`접수.데스크`)이 켜져 있음
      - React Native WebView가 아님
      - 로컬 알림 중재기 `reception:{내원Id}`가 허락함
    - `접수.알림음`을 재생하고 다음 문구로 알립니다:
      - 이름을 알면 "{이름}님이 태블릿으로 접수했습니다." / "{이름}님이 접수되었습니다."
      - 모르면 "환자가 태블릿으로 접수했습니다." / "데스크에서 접수되었습니다."
    - 환자 이름은 `GET /desk/waiting`을 다시 불러 찾습니다. 3초 안에 못 찾으면 이름 없이 알립니다
    - 알림을 누르면 `requestFocusPatient(환자Id)` → 대기 카드로 스크롤하고 강조합니다
  - 소켓과 별도로 대기·예약 쿼리가 1분마다 폴링합니다
  - `BT(queryClient, keys)` 디바운스 무효화 헬퍼를 씁니다 (`maxWait`, 추정)
- **데이터:** Socket.IO `https://socket.upstream.co.kr` ([non-axios-channels.md](../non-axios-channels.md))
- **상태 저장:** Pinia `socketClient`, `patient` (`recentAcceptPatientId`, `focusRequestPatientId`). `useTreatmentStore`는 데스크 보드 코드에서 쓰지 않습니다
- **근거:** `re-upstream/restored/modules/index/part-239.js` (`XVt`), `re-upstream/restored/modules/index/part-233.js` (`NUt`), `re-upstream/restored/stores/socketClient.js`, `re-upstream/restored/stores/patient.js`, `re-upstream/restored/components/app/App.vue`

## 흐름

1. **환자 도착**
   - 예약 환자: 예약 컬럼 카드를 대기(또는 치료) 컬럼으로 끌거나 메뉴 `접수`를 누릅니다 → `openSidePanel환자접수(환자Id, {예약Id})`. 예약 환자가 신환(`최초내원일` 없음)이면 먼저 환자 등록 패널이 열립니다
   - 비예약 환자: 헤더 검색 또는 `DeskPatientAcceptModal`에서 환자를 고릅니다. 없으면 "환자로 등록 후 접수" → `DeskPatientRegister` → `proceed-reception`
   - 태블릿 접수는 소켓 `ACTION_WAITING`(`접수경로: "TABLET"`)으로 들어와 알림을 띄웁니다
2. **접수:** `DeskPatientAccept`에서 보험 자격 조회(`POST /nhic/m2/get-data`)를 하고 진료의·진료항목을 고릅니다 → `POST /desk/waiting` (`상태: "대기"` 또는 `"치료"`)
3. **진료 대기:** 대기 컬럼에 `대기시간` 순으로 쌓입니다. 진료실은 `차트보기`(`switchPatient`)로 진료 화면에 들어갑니다 ([treatment.md](treatment.md))
4. **진료·치료:** 치료 컬럼으로 끌면 베드 배정 모달이 열립니다 → `PUT /treatments/patients/{내원Id}` 또는 `PATCH /desk/waiting/{id}` `상태: "치료"`. 차팅이 끝나면 카드가 `success`로 바뀝니다 (`차팅완료여부`, `ACTION_RECORD`로 갱신)
5. **수납:** 수납 컬럼으로 옮깁니다(`PATCH 상태: "수납"`) → 카드 `수납기록` → `DeskVisitPaymentCheckOut` → `POST /desk/v2/receipts`
6. **귀가:** 수납을 저장하면 자동으로 `PATCH 상태: "수납완료"`가 나가 수납 완료 컬럼으로 옮겨집니다. 필요하면 `다음 내원 예약`(예약 패널)과 서류 발급(`문서 발급`)을 합니다. 하루 마감은 수납현황 탭에서 시재 정산(`POST /desk/settlements/cash/{date}`)으로 합니다

## 미확인·추정

- `DeskVisitView`의 `SidePanelDeskActions`는 `validActions` 기본값을 씁니다. 기본값에 `차트생성`이 없어서, 예약 카드의 `차트 생성` 버튼(`createChart` → `openSidePanel차트생성`)을 눌러도 이 화면에서는 패널이 그려지지 않는 것으로 보입니다. 비EMR 구성 전용 버튼일 수 있습니다 (추정)
- `PaymentCompleteColumn`은 `isPaymentComplete`일 때 `대기`에서 끌어온 카드도 드롭을 허용합니다. 그런데 `handleDrop`에 `대기` 분기가 없어 아무 일도 일어나지 않습니다
- 예약 시간대 드래그는 코드상 더 늦은 시간대로만 옮길 수 있습니다(`source.time < target.time`). 의도한 제약인지는 알 수 없습니다
- `PaymentCalculator`의 `현금영수증` 모델은 수납 화면에서 `false`로만 넘어갑니다. 이 모델을 켜는 UI는 찾지 못했습니다
- `isSummary` 모드의 "발급 문서(영수증/세부산정내역서)" 체크값(`d`, `_`)은 어디에도 쓰이지 않습니다
- `receipt_update`/`receipt_delete` 권한 코드는 정적 참조가 없습니다. 수납 상세 수정·삭제·환불(`PATCH`/`DELETE /desk/receipts/details/*`, `…/refund`)은 환자상세 `수납 내역` 탭에서 일어나는 것으로 보입니다 (추정)
- `예약`/`예약 변경` 패널은 `SidePanelDeskActionsPatientAppointment*` → `DeskViewPatientAppointment`로 연결됩니다. 패널 내부 동작은 [appointment.md](appointment.md) 범위라 여기서 읽지 않았습니다
- 서버 응답의 정확한 스키마(예: `/desk/waiting` 항목 전체 필드)는 호출부에서 쓰는 필드만 적었습니다
- `Sct(요양기관기호)`(문진 링크 노출 조건)와 `QD`(임산부 체크 노출 조건)의 구체 규칙은 확인하지 않았습니다
