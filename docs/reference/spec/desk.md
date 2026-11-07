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
- **근거:** `restored/router/routes.js`, `restored/components/desk/DeskSuspense.vue`, `restored/views/DeskView.vue`, `restored/components/today/TodaySummaryBar.vue`, `restored/stores/deskDate.js`, `restored/modules/DeskView/part-3.js` (`Ff` 스크롤 복원)

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
- **근거:** `restored/views/DeskVisitView.vue`, `restored/components/desk/DeskVisitHeader.vue`, `restored/components/desk/DeskVisitAppointment.vue`, `restored/components/desk/DeskVisitWaiting.vue`, `restored/components/desk/DeskVisitEmptySection.vue`, `restored/modules/DeskView/part-3.js`, `restored/modules/index/useDeskWaitingQuery.js`, `restored/modules/index/useDeskAppointmentsByValueQuery.js`, `restored/components/waiting/WaitingColumn.vue`

## 접수·대기 상태 값

### 내원(접수) `상태`

| 값 | 컬럼 | 들어오는 경로 |
|---|---|---|
| `대기` | 대기 | 접수 생성(기본값), 다른 컬럼에서 드롭, 치료 카드의 "대기로 이동" |
| `치료` | 치료 | 접수 시 `치료` 선택, 베드 배정 모달 완료, 수납 카드의 "치료로 이동" |
| `수납` | 수납 | 대기·치료·수납완료 카드를 수납 컬럼에 드롭 |
| `수납완료` | 수납 완료 | 수납 완료 처리(`DeskVisitPaymentCheckOut`) 후 자동, 또는 수납 내역이 있는 카드를 드롭 |

- 화면 문구용 이동 단계(`_D`)에는 `차팅 완료`도 있습니다: `["차팅 완료","대기","치료","수납"]`. 분석 이벤트 값은 `no_move`/`waiting`/`treatment`/`payment`/`payment_done`입니다 (`restored/modules/SidePanelDeskActions/part-2.js`)

### 보험구분 (`S0e`)

`건보`, `자보`, `급여`, `산재`, `일반` (`restored/api/patients/queries-2.js`)

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
- **근거:** `restored/components/desk/DeskPatientAccept.vue`, `restored/components/side/SidePanelDeskActionsPatientAccept.vue`, `restored/components/desk/DeskPatientAcceptModal.vue`, `restored/api/desk/requests-4.js` (`postDeskWaiting`), `restored/modules/mutations/usePostPatientsNewMutation.js`, `restored/modules/index/part-86.js` (`xft`), `restored/components/patient/PatientHealthInsuranceEligibilityTable.vue`

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
- **근거:** `restored/components/waiting/WaitingColumn.vue`, `restored/components/treatment/TreatmentColumn.vue`, `restored/components/payment/PaymentColumn.vue`, `restored/components/payment/PaymentCompleteColumn.vue`, `restored/components/desk/DeskVisitPatientCardDropArea.vue`, `restored/modules/DeskView/part-4.js`, `restored/modules/CardDropArea/usePutTreatmentsPatientsMutation.js`, `restored/components/treatment/TreatmentRoomBedAssignModal.vue`, `restored/modules/desk-patient/_hoisted_1.js`, `restored/components/patient/PatientCard.vue.js`

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
  - 성공하면 `appointmentsByDateAndDoctor`, `appointmentsPlanner.all`, `booking.all`, 환자 예약 이력 키를 무효화합니다
- **근거:** `restored/components/appointment/AppointmentColumn.vue`, `restored/components/appointment/AppointmentColumnTime.vue`, `restored/components/patient/PatientCardAppointment.vue`, `restored/components/appointment/AppointmentCardContextMenuWrapper.vue`, `restored/components/desk/DeskVisitTelemedicineCard.vue`

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
- **근거:** `restored/components/desk/DeskVisitPaymentCheckOut.vue`, `restored/components/payment/PaymentCalculator.vue`, `restored/components/desk/DeskVisitPaymentCheckOutCalculator.vue`, `restored/components/desk/DeskVisitPaymentCheckOutFooter.vue`, `restored/components/desk/DeskVisitPaymentCheckOutTreatmentCardDetail.vue`, `restored/modules/SidePanelDeskActions/usePostDeskPrepaidChartsChargesMutation.js`

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
- **근거:** `restored/views/DeskPaymentsView.vue`, `restored/components/desk/DeskPaymentsHistoryTable.vue`, `restored/components/desk/DeskPaymentsCashBalance.vue`, `restored/components/desk/DeskPaymentsCashBalanceForm.vue`, `restored/components/desk/DeskPaymentsCashBalanceSettlement.vue`, `restored/components/desk/DeskPaymentsExpenseHistory.vue`, `restored/components/desk/DeskPaymentsUnusualPatients.vue`, `restored/modules/DeskView/part-2.js`, `restored/components/copayment/CopaymentLedger.vue`

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
- **근거:** `restored/components/desk/DeskPatientRegister.vue`, `restored/components/side/SidePanelDeskActionsPatientRegisterOrModify.vue`, `restored/components/desk/DeskPatientAcceptModal.vue`, `restored/components/patient/PatientSearch.vue`, `restored/modules/index/useDeskWaitingQuery.js`, `restored/components/header/HeaderLayout.vue`

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
  | `차트생성` | `openSidePanel차트생성(환자Id, 예약Id, {이름, 핸드폰번호})` | `canCreate$(접수생성)` | `LiteChartCreatePanel` |

- **화면 구성:**
  - `SidePanelDeskActions`가 `validActions`에 있는 패널만 `#side-panel`로 텔레포트해 그립니다
  - `DeskVisitView`는 `bsn.provide`로 카드 컴포넌트에 콜백을 내려 줍니다: `sendMessage`, `printDocument`, `patientDetail`, `createPatient`, `createPatientAccept`, `createAppointment`, `editPatientAccept`, `editAppointment`, `createChart`
- **동작:**
  - **환자상세 (`PatientInfoDetail`)**
    - 탭(EMR 구성): 홈 / 예약 내역 / 수납 내역 / 패키지 내역 / 문진표 / 동의서. EMR이 아니면 `연락 이력`이 더 있습니다
    - 조건에 따라 `문진표`·`동의서` 탭이 빠지고, `vx`(lite 단독)이면 `수납 내역` 탭이 빠집니다
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
- **근거:** `restored/components/side/SidePanelDeskActions.vue`, `restored/modules/index/part-86.js`, `restored/components/patient/PatientInfoDetail.vue`, `restored/components/side/SidePanelDeskActionsPatientInfoDetail.vue`, `restored/components/side/SidePanelDeskActionsChartCreate.vue`, `restored/components/side/SidePanelDeskActionsMessageSend.vue`

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
- **근거:** `restored/views/DocumentIssueView.vue`, `restored/components/side/SidePanelDeskActionsDocumentIssue.vue`, `restored/modules/DocumentIssueView/진료내용.js`, `restored/stores/documentIssue.js`

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
- **데이터:** Socket.IO `https://socket.example.com` ([non-axios-channels.md](../non-axios-channels.md))
- **상태 저장:** Pinia `socketClient`, `patient` (`recentAcceptPatientId`, `focusRequestPatientId`). `useTreatmentStore`는 데스크 보드 코드에서 쓰지 않습니다
- **근거:** `restored/modules/index/part-239.js` (`XVt`), `restored/modules/index/part-233.js` (`NUt`), `restored/stores/socketClient.js`, `restored/stores/patient.js`, `restored/components/app/App.vue`

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

## 레거시 차트 대비

이 절은 레거시 차트 사용자 매뉴얼을 근거로 정리한 것이며, 현행 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무

- **자격관리(예비심사):** 연·월을 정해 주민번호 오류, 보험기호·증번호가 모두 빈 환자, 진료승인번호가 없는 의료급여 진료를 목록으로 뽑아 고치게 합니다. 청구 전에 데스크가 돌리는 점검 작업입니다 (레거시 차트 매뉴얼 「자격조회, 조회확인, 자격관리 기능」)
- **자격조회 이력(조회확인):** 환자별로 과거 자격조회 결과와 본인확인 여부를 다시 볼 수 있습니다. 잘못 남은 조회 이력(예: 무자격 조회)은 지울 수 있습니다 (레거시 차트 매뉴얼 「자격조회, 조회확인, 자격관리 기능」, 레거시 차트 매뉴얼 「자격조회 - 본인확인 여부 체크하기」)
- **과거 날짜 자격조회:** 진료(조회)일자를 과거로 바꿔 조회합니다. 과거 진료분의 의료급여 승인 요청도 이 조회 결과로 합니다 (레거시 차트 매뉴얼 「과거 날짜로 자격조회하기」)
- **다른 조회 수단:** 건강보험증번호로 조회하면 주민번호 뒷자리가 자동으로 채워집니다. 모바일 건강보험증 번호 입력과 앱 QR 스캔으로도 조회·본인확인을 합니다 (레거시 차트 매뉴얼 「건강보험증번호로 공단 자격조회」, 레거시 차트 매뉴얼 「자격조회 - 모바일 건강보험증, QR코드 접수」)
- **최근 본인확인 경과일:** 본인확인을 체크하면 그 날짜가 남고, 다음 접수 때 마지막 본인확인 뒤 지난 일수를 보여 줍니다 (레거시 차트 매뉴얼 「자격조회 - 본인확인 여부 체크하기」)
- **의료급여 진료승인 요청:** 수납 전에 공단에 진료승인을 요청하고 승인번호를 받습니다. 목록에서 미승인은 빨강, 승인 완료는 파랑으로 구분합니다. 공단 사이트에서 승인을 취소했으면 차트의 승인 정보를 초기화한 뒤 다시 요청합니다 (레거시 차트 매뉴얼 「의료급여 1종 건강생활유지비로 승인」, 레거시 차트 매뉴얼 「의료급여환자의 진료승인취소를 공단 홈페이지에서 취소한 경우」)
- **산전지원비 잔액 승인:** 의료급여 임신부는 산전지원비 잔액으로 승인을 요청하고 `지원금`으로 수납합니다 (레거시 차트 매뉴얼 「산전지원비 잔액으로 승인」)
- **공상(공무상요양) 환자:** 급여 비용은 모두 공단에 청구하고 비급여만 환자에게 받습니다. 그 비급여는 공제제외입니다. 현행 보험구분(`건보`/`자보`/`급여`/`산재`/`일반`)에는 공상이 없습니다 (레거시 차트 매뉴얼 「공무상요양(공상) 환자의 진료기록」)
- **요양병원 입원 중 환자:** 자격조회 결과에 요양병원 입원 여부가 나옵니다. 요양병원 의뢰서가 있으면 그 기관기호와 의뢰일자를 기록합니다. 의뢰서가 없으면 `일반`으로 바꾸고 진료비 전액을 환자에게 받습니다 (레거시 차트 매뉴얼 「요양병원에 입원 중인 환자 접수」)
- **자보 지급보증 이력:** 한 사고접수번호 아래 지급보증서마다 적용시작·적용종료 일자를 두고 여러 건을 쌓습니다. 새 보증을 받으면 이전 건을 전날로 종료하고, 이전 정보를 복사해 새 건을 만듭니다. 합의로 치료가 끝나면 적용종료일을 넣습니다. 수상일과 자보 담당자도 관리합니다 (레거시 차트 매뉴얼 「자동차보험 환자 접수/조회/동의서 출력」, 레거시 차트 매뉴얼 「자동차보험 지불보증번호가 계속 변경되는 경우」)
- **지급보증 API 신청:** 사고접수번호를 넣으면 보험사 API로 지급보증번호를 신청·조회해 자동으로 채웁니다. 매뉴얼 기준(2022년 9월) 삼성·흥국·현대 3개사이고, 팩스·유선으로 보증을 받은 적이 없을 때만 씁니다 (레거시 차트 매뉴얼 「자동차보험 지급보증 API로 접수」)
- **자보 타병원 입원환자 의뢰:** 의뢰기관 요양기관기호와 의뢰일자를 받으면 청구 특정내역 `MT015`=`69`, `MJ006`=의뢰기관 기호/의뢰일자가 자동으로 들어갑니다 (레거시 차트 매뉴얼 「자동차보험 환자 접수/조회/동의서 출력」)
- **산재 자격 정보:** 적용시작일, 재해발생일자, 소속사업장명, 적용종료일을 둡니다. 치료가 끝난 뒤 합병증 등 예방관리 대상이 되면 따로 표시합니다 (레거시 차트 매뉴얼 「산재환자 접수」)
- **접수 시 사전 조회:**
  - 심평원 DUR로 감염병 발생지역 입국자 여부를 접수할 때 자동 조회합니다. 해당 환자가 오면 7일 이내 보건소에 신고해야 합니다 (레거시 차트 매뉴얼 「DUR의 감염병 여부 조회」)
  - 추나 급여 전에 환자의 연간 실시 횟수와 진료의별 당일 횟수를 조회합니다 (레거시 차트 매뉴얼 「추나진료 현황 조회」)
  - 첩약 시범사업은 상병구분별 누적 투약일수와 진료의별 당일 건수를 조회합니다. 개인정보 동의서는 매년 받습니다 (레거시 차트 매뉴얼 「첩약시범사업 접수/조회/동의서 출력」)
- **비접촉 자동접수:**
  - 태블릿, QR 스캔, 키오스크, 바코드(멤버십카드) 스캔으로 초진·재진을 직원 없이 대기열에 넣습니다
  - 태블릿·QR·키오스크에서는 개인정보 동의도 받습니다. 태블릿으로 받은 동의는 출처(예: `굿닥동의`)를 남깁니다
  - 키오스크는 신분증 인식 본인확인과 무인 카드 수납까지 합니다
  - 재진은 개인정보 입력 단계를 건너뜁니다
  - (레거시 차트 매뉴얼 「굿닥 태블릿 비접촉 자동접수」, 레거시 차트 매뉴얼 「QR코드 스캔 비접촉 자동접수」, 레거시 차트 매뉴얼 「키오스크 비접촉 자동접수」, 레거시 차트 매뉴얼 「바코드 스캔 비접촉 자동접수」)
- **환자 관리정보:**
  - 항목: 주치의, VIP 등급, 소개자(관계 포함), 유입경로, 직업, 진행중 치료, 예정된 치료, 개인정보사용(미정/동의/거부), SMS 거부, 주의 환자, 비급여 할인율, 임신부(출산 예정일)
  - `주의`를 켜면 검색할 때마다 경고창을 띄웁니다
  - `할인율`은 수납할 때 비급여 진료비에 자동 적용합니다
  - 주치의는 대기실·치료실로 보낼 때의 담당의사 기본값과 이어집니다
  - 항목 사전의 값을 바꾸거나 지우면 그 값을 가진 모든 환자에게 반영됩니다
  - (레거시 차트 매뉴얼 「관리정보, 가족관리, 소개자 등 입력」, 레거시 차트 매뉴얼 「관리정보에서의 지정 항목 관리 - 변경, 삭제 등」, 레거시 차트 매뉴얼 「주치의 지정 항목 관리 - 변경, 삭제 등」)
- **소개자 트리·랭킹:** 소개 관계를 트리와 랭킹(소개 횟수 등)으로 집계합니다. 가족·소개자 단위 진료비 요약도 봅니다 (레거시 차트 매뉴얼 「소개자 기록 및 통계」)
- **가족 자동 구성:** 신환 등록 때 주소·전화번호·보험정보가 같으면 자동으로 가족으로 묶습니다. 수동으로 묶거나 나눌 수도 있습니다. 수납 화면에 본인 미수와 가족 미수를 함께 보여 줍니다 (레거시 차트 매뉴얼 「관리정보, 가족관리, 소개자 등 입력」, 레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」)
- **환자 등록 보조:**
  - 주민번호를 정확히 모르면 근사 생년월일(예: `230101-1000000`)로 등록합니다
  - 기존 환자의 신상정보를 복사해 새 차트를 만듭니다
  - 차트번호와 등록일을 나중에 고칩니다
  - 진료기록이 없는 환자만 데스크에서 삭제할 수 있습니다
  - 신환을 등록하면 정해 둔 문구·시각에 신환 문자가 자동으로 나갑니다. 환자별로 끌 수 있습니다
  - (레거시 차트 매뉴얼 「신규환자 접수」, 레거시 차트 매뉴얼 「접수실프로그램 메뉴 버튼 안내」)
- **개인정보 동의 결과 고지:** 서명패드나 펜차트로 항목별 동의를 받습니다. 그 뒤 기관명, 동의 일자, 수신 동의 사실, 처리 결과를 환자에게 알립니다(구두 또는 문자). 문자로 알릴 때는 동의 시점부터 14일 이내여야 합니다 (레거시 차트 매뉴얼 「개인정보동의 서명(싸인패드, 펜차트)」)
- **현금영수증 승인·취소·수기 기록:**
  - 수납 건마다 차트에서 VAN사를 거쳐 현금영수증을 승인합니다. 수납 뒤에 승인을 추가하거나 금액을 더할 수도 있습니다
  - 취소는 사유를 골라 하고, 마이너스 금액 건으로 남깁니다. 승인 건과 취소 건을 모두 쌓습니다
  - 카드단말기에서 직접 승인한 건은 금액(본인부담/비급여)과 승인번호(선택)로 수기 기록합니다. 그래야 통계에 잡힙니다
  - 기간·전체 환자 단위로 승인·취소 내역을 조회합니다
  - (레거시 차트 매뉴얼 「현금영수증 승인 및 영수증 출력」, 레거시 차트 매뉴얼 「현금영수증 승인 취소」, 레거시 차트 매뉴얼 「현금영수증 승인 수기 기록」, 레거시 차트 매뉴얼 「현금영수증 승인 관련 내용 정리 요약」)
- **미수금 회수 기록:**
  - 미수를 받을 때 결제수단을 `현금(회수)`·`카드(회수)`·`통장(회수)`로 따로 남깁니다. 일일결산에 회수금 항목으로 집계됩니다
  - 전체 미수금 목록 화면에서 바로 회수하고, 미수금을 지울 수도 있습니다
  - 이전 차트에서 넘어온 미수금은 과거 진료일에 0원 비급여 항목을 기록하고, 그 날짜 건에 회수 수납을 남기는 방식으로 옮깁니다
  - (레거시 차트 매뉴얼 「미수금 수납」, 레거시 차트 매뉴얼 「레거시 차트로 변경한 후 이전 차트에서 발생한 미수금을 수납하기」)
- **환불·재수납:** 수납 내역에 `환불` 종류 행을 환불 날짜·금액·수단(현금/카드)과 함께 추가합니다. 다시 받으면 `수납` 종류 행을 추가합니다. 원래 수납 행을 고치지 않고 행을 덧붙이는 방식입니다 (레거시 차트 매뉴얼 「환불 및 재수납」)
- **비대면 결제:** 받을 금액을 결제 링크 문자로 보냅니다. 휴대폰 번호와 결제기한을 바꿀 수 있고, 건별 발송·주문·결제 상태를 확인합니다. 내원했지만 결제 수단이 없는 환자에게도 씁니다 (레거시 차트 매뉴얼 「진료비 비대면 결제 기능」)
- **카드단말기 금액 송신:** 카드 결제 금액을 연동 단말기로 보내고 15초 안에 카드를 넣게 합니다. 현금영수증·진료비 계산서 요약본도 단말기 프린터로 뽑습니다 (레거시 차트 매뉴얼 「카드단말기에 금액 정보 송신 기능」, 레거시 차트 매뉴얼 「여러가지 계산서 출력」)
- **과세상품 판매관리:** 면세 진료와 분리된 과세 사업자로 물품을 팝니다. 거래처, 물품, 구매 입고, 재고, 판매(단가할인·수량), 반품, 미수, 영수증, 통계가 진료 수납과 별도 데이터로 관리됩니다 (레거시 차트 매뉴얼 「판매관리에서 과세상품 관리」)
- **접수·수납 시각 로그:** 내원마다 최초 접수 시각, 대기실·치료실 입실 시각, 진료기록 시각, 수납기록 시각을 남기고 조회합니다 (레거시 차트 매뉴얼 「접수시각 - 대기실, 치료실 기록 시각 - 수납기록 시각 로그 확인」)
- **서류 보조:**
  - 진료확인서 등을 만들 때, 진료 없이 서류만 발급한 날을 내원일에서 뺍니다 (레거시 차트 매뉴얼 「진료확인서 및 진단서 등 작성 시 내원일 제외하기」)
  - 진료비 납입확인서에 비급여 납입 항목을 손으로 추가합니다 (레거시 차트 매뉴얼 「여러가지 계산서 출력」)
- **실손보험 보장 조회:** 환자 동의(휴대폰 본인인증)를 받아 실손 가입 여부, 보험사, 세대, 보장한도, 자기부담금을 조회하고 이력을 남깁니다. 제휴사 서비스입니다 (레거시 차트 매뉴얼 「실손보험 조회 서비스」)

### 업무 규칙

- **본인일부부담률 (매뉴얼 기준 2024-01-01 이후, 건강보험 외래)** (레거시 차트 매뉴얼 「(기준) - 본인일부부담금 및 세부사항」, 레거시 차트 매뉴얼 「65세이상 경로우대 본인부담금 기준」)

  | 구분 | 본인부담 | 조건·비고 |
  |---|---|---|
  | 만 1세 미만 | 5% | |
  | 만 1세 ~ 6세 미만 | 21% | |
  | 만 6세 ~ 65세 미만 | 30% | |
  | 만 65세 이상, 투약 없음 | 1,500원 / 10% / 20% / 30% | 총진료비 1.5만 이하 / 1.5만 초과 ~ 2만 / 2만 초과 ~ 2.5만 / 2.5만 초과 |
  | 만 65세 이상, 투약 있음 | 1,500원 / 10% / 20% / 30% | 1.5만 이하 / 1.5만 초과 ~ 2.5만 / 2.5만 초과 ~ 3만 / 3만 초과 |
  | 산정특례 암·중증등록 | 5% | |
  | 산정특례 희귀 | 5~10% | 특정기호 V코드 |
  | 희귀난치 지원 | 무료 | 지원단체가 본인부담 지원 |
  | 중증치매 | 10% | `V800`/`V810`. `V810`은 `MT052`에 사전승인번호 |
  | 임신부 / 차상위 임신부 | 10% / 5% | `F015` / `F015-1` |
  | 조산아 (차상위 포함) | 5% | `F016` / `F016-1`. 출생 후 5년까지 |
  | 차상위 1종 | 무료 | |
  | 차상위 2종 | 투약 1,500원 / 미투약 1,000원 | |
  | 차상위 2종 장애 | 투약 750원 / 미투약 250원 | 경감액 750원은 장애인기금으로 같은 달 청구에 포함 |
  | 행려환자 | 무료 | |

  - 정률 본인부담은 100원 미만을 절사하고, 절사한 금액은 청구액에 더합니다
  - 야간·휴일·토요 주간 가산은 기본진찰료의 30%입니다. 만 6세 미만은 20시 ~ 다음 날 07시에 초진 기본진찰료의 200%를 가산합니다(2023-11-01부터)
  - 65세 이상 구간 금액은 매년 수가 변경에 따라 다시 계산됩니다
- **의료급여 본인부담과 승인** (레거시 차트 매뉴얼 「의료급여 환자의 구분」, 레거시 차트 매뉴얼 「의료급여 1종 '건강생활유지비' 지원」, 레거시 차트 매뉴얼 「의료급여 1종 선택병원의원 참여자 승인하기」, 레거시 차트 매뉴얼 「의료급여 2종 환자 승인」, 레거시 차트 매뉴얼 「의료급여 1종 또는 2종 연장승인 미신청자」)
  - 1종은 매월 1일 건강생활유지비 6,000원이 적립됩니다. 본인부담(투약 1,500원 / 미투약 1,000원)을 잔액에서 빼고 `건생비`로 기록하며, 환자에게서는 받지 않습니다. 잔액이 없으면 현금 본인부담으로 승인받고 환자에게 받습니다
  - 전월 진료분은 다음 달에 건강생활유지비로 소급 차감할 수 없습니다. 이때는 건생비 청구액을 0으로 두고 환자 납부로 승인합니다 (레거시 차트 매뉴얼 「진료승인요청이 안 될 경우 해결방법」)
  - 1종 면제(`M003`~`M018`: 18세 미만, 희귀난치, 장기이식, 임산부 등)는 0원으로 승인합니다
  - 1종 선택병의원(`M001`~`M002`): 우리 기관이 1·2차 선택기관이면 무료, 3·4차면 1,500원/1,000원입니다. 선택기관이 아닌 곳에 오면 전액 본인부담입니다. 단 선택기관의 의료급여의뢰서를 가져오면 `B005`와 의뢰기관을 지정해 승인하고 본인부담만 받습니다
  - 의료급여의뢰서는 원본만 받습니다(사본·팩스 불가). 발급 뒤 7일(공휴일 제외) 안에 내야 하고, 해당 상병 진료가 끝날 때까지 유효합니다. 다른 질환이면 새로 받아야 합니다
  - 2종은 투약 1,500원 / 미투약 1,000원, 2종 장애는 750원 / 250원입니다
  - 연장승인 미신청자(`B014`)는 총진료비의 30%를 받고 특정기호 `F023`을 기재합니다(2019-01-01부터)
  - 같은 진료가 이미 승인된 상태("중복된 진료확인 건")면 공단 사이트에서 진료확인번호를 취소한 뒤 다시 요청합니다. "자격조회 정보 없음"이면 진료일로 자격조회를 다시 한 뒤 요청합니다
- **본인확인 의무:** 초진·재진 구분 없이 신분증으로 확인합니다. 확인하지 않고 급여를 하면 과태료 100만 원 이하입니다(국민건강보험법 제119조) (레거시 차트 매뉴얼 「자격조회 - 본인확인 여부 체크하기」)
  - 예외(국민건강보험 시행규칙 제7조의2): 19세 미만, 최근 본인확인 후 6개월 이내 재내원, 진료의뢰·회송, 응급환자, 거동이 현저히 불편한 자 등
  - 자격조회 결과의 예외 대상 표시는 심한 장애인·장기요양등급자·임산부 중 하나면 `Y`입니다. 어느 사유인지는 나오지 않습니다
- **무자격자·급여제한자** (레거시 차트 매뉴얼 「무자격자, 급여제한자, 외국인 접수」, 레거시 차트 매뉴얼 「건강보험 무자격자/급여제한자 진료기록과 수납」, 레거시 차트 매뉴얼 「건강보험 부정수급 방지대책 관련」)
  - 2014-07-01부터 접수 때 급여제한 여부를 꼭 확인해야 합니다. 착오로 청구해도 급여비가 나오지 않습니다
  - 표시: 자격 상실자는 `무자격`, 보험료 6회 이상 체납자는 `급여제한`, 외국인·재외국민 체납자는 `외국인등보험료체납`(2019-08-01부터)
  - 무자격자는 `일반`으로 기록하고 전액을 받습니다. 나중에 상실일로 소급해 자격이 회복되면 그 진료를 `보험`으로 다시 계산하고, 공단부담금만큼 환자에게 환불합니다. 무자격 조회 이력도 지웁니다
  - 급여제한자도 전액을 받습니다. 다만 청구명세서에는 청구금액을 본인부담에 더해 송신하고, 환자가 체납액을 내면 공단이 환자에게 직접 돌려줍니다
- **외국인:** 주민번호 형식 검증에 걸려도 공단 자격이 확인되면 내국인과 같이 진행합니다. 자격조회가 안 되면 `일반`으로 전액을 받습니다. 생년월일이 `570000` 꼴이면 그해 1월 1일(`1957-01-01`)로 저장합니다(공단 지침). 출국자로 조회되면 무자격이 아닐 때만 외국인등록증 확인 뒤 급여를 적용합니다 (레거시 차트 매뉴얼 「무자격자, 급여제한자, 외국인 접수」)
- **임신부·조산아** (레거시 차트 매뉴얼 「임신부 본인부담률 경감 및 '임신확인 - 진료기록 - 수납하기' 안내」, 레거시 차트 매뉴얼 「임신부 및 조산아 접수」)
  - 임신 확인 뒤부터 출산 당일까지 모든 외래에 적용합니다. 유산·사산 관련 외래 당일도 포함합니다. 확인 근거는 임신부 수첩, 산부인과 확인서, 바우처 카드, 공단 정보마당 조회입니다
  - 조산아는 재태 37주 미만 또는 2,500g 이하 출생아로, 출생 후 5년까지 적용합니다. 자격조회 결과로 자동 확인됩니다
  - 1세 이상 조산아는 국민행복카드 지원금으로 결제할 수 없습니다
- **국민행복카드·첫만남이용권** (레거시 차트 매뉴얼 「임신부 지원 카드로 수납」, 레거시 차트 매뉴얼 「임신부 지원 카드의 잔액이 부족한 경우」, 레거시 차트 매뉴얼 「국민행복카드 첫만남이용권 등 요약 안내」)
  - 임신·출산 진료비 바우처는 분만예정일 등으로부터 2년간 씁니다. 단말기에서 할부 개월 칸에 승인코드 `38`을 넣어 결제합니다
  - 지원금으로 낸 금액(급여 본인부담·비급여)은 공제제외입니다. 지원금이 모자라 환자가 낸 차액은 공제대상입니다
  - 첫만남이용권(출생 후 2년, 첫째 200만 원·둘째 이상 300만 원)은 승인코드 없이 일반 일시불로 결제합니다
- **희귀난치 지원 대상:** 본인부담을 `지원금`으로 자동 기록하고 환자에게 받지 않습니다. 이 금액은 공제제외로 체크됩니다 (레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」)
- **제주 지원** (레거시 차트 매뉴얼 「(기준) - 본인일부부담금 및 세부사항」, 레거시 차트 매뉴얼 「제주4·3희생자 유족 및 며느리 진료비 수납」, 레거시 차트 매뉴얼 「제주 해녀 진료비 수납」, 레거시 차트 매뉴얼 「제주4·3희생자 유족 및 며느리 접수」)
  - 4·3 희생자 유족·며느리: 급여 본인부담금의 30%를 지원합니다. 본인부담이 6,000원 이하면 전액 지원합니다. 매월 말일 기준으로 4·3평화재단에 청구합니다
  - 해녀: 급여 본인부담 전액을 지원합니다(환자 무료). 매월 말일 기준으로 제주시청·서귀포시청에 청구합니다
  - 두 경우 모두 비급여는 환자에게 받습니다. 대상 여부는 관리정보의 증번호로 판단합니다
- **공제제외(연말정산 의료비 자료에서 빠지는 금액):** 미용·성형 비용, 건강증진 목적 한약(치료 목적 한약은 포함), 국민행복카드 결제분, 과세 진료·제품, 의료급여 건강생활유지비, 각종 지원금, 진단서 등 제증명수수료가 해당합니다. 근거는 소득세법 시행령 제110조 제2항입니다. 체크하기 전에 환자에게 이유를 설명해야 합니다 (레거시 차트 매뉴얼 「공제제외로 수납」, 레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」)
- **현금영수증** (레거시 차트 매뉴얼 「현금영수증 승인 관련 내용 정리 요약」, 레거시 차트 매뉴얼 「현금영수증 차트에서 승인하고 카드단말기에서 출력하기」, 레거시 차트 매뉴얼 「현금영수증 발행분에 대한 해석 - 세무관련 통계」)
  - 10만 원 이상 현금 거래는 발급 의무입니다(2014-07-01부터, 매뉴얼 기준)
  - 신분확인 번호는 주민번호가 기본입니다. 휴대폰번호, 현금영수증카드, 사업자번호, 보호자 등 다른 사람 번호로 바꿀 수 있습니다. 아무것도 확인되지 않으면 `010-000-1234`로 발급합니다
  - 카드번호가 `154420209`로 시작하면 지출증빙용으로 발행됩니다
  - 신분확인 번호를 바꿔도 결과 문자는 환자 프로필의 번호로 갑니다
  - 승인·취소 정보는 VAN사 서버에 모였다가 일괄로 국세청에 전송됩니다. 그래서 당일 건은 홈택스에서 바로 보이지 않을 수 있습니다
  - 차트와 단말기에서 같은 건을 두 번 승인하지 않게 막아야 합니다
  - 세무 통계는 보험 본인부담과 비보험으로 나눕니다. 보험 본인부담을 현금영수증으로 받은 금액(`현금영수증 본인`)을 따로 집계합니다
- **급여 본인부담 할인:** 급여 본인부담금 할인은 의료법 위반 소지가 있어 주의하라고 안내합니다. 잔액은 할인 또는 미수 중 하나로 처리합니다 (레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」). 임시공휴일 가산분을 평일 수준으로 받을 때는 본인부담 할인 항목으로 맞추라고 합니다(초진 약 1,100원, 재진 약 700원, 매뉴얼 기준) (레거시 차트 매뉴얼 「임시공휴일(10월 2일) 진료비 가산 적용 및 본인부담금 부과 방법 안내」)
- **초진·재진 자동 판정** (접수의 `초진여부` 기본값 참고) (레거시 차트 매뉴얼 「초진 - 재진 진찰료 산정 안내」)
  - 마지막 내원 뒤 30일이 지나 다른 상병으로 오면 초진입니다
  - 같은 상병으로 90일 이내에 오면 재진, 90일이 지나면 초진입니다
  - 고시상 치료가 끝나지 않은 상병은 간격과 관계없이 재진이므로, 직원이 수동으로 바꿀 수 있습니다
- **자보 접수 규칙** (레거시 차트 매뉴얼 「자동차보험 환자 접수/조회/동의서 출력」, 레거시 차트 매뉴얼 「자동차보험 4주 경과 시 지급보증 절차, 진단서 발급」, 레거시 차트 매뉴얼 「자동차보험 지불보증번호가 계속 변경되는 경우」, 레거시 차트 매뉴얼 「자동차보험 중복진료 구분 요약」)
  - 수상일로부터 4주가 지나면, 그 뒤로는 2주마다 진단서를 내고 지급보증을 새로 받습니다
  - 지급보증 적용 기간은 서로 겹치면 안 됩니다
  - 보증 연장용 진단서 비용은 비급여로 받고, 환자가 보험사에 청구합니다
  - 자보 첩약 개인정보 동의서는 5년마다 다시 받습니다
  - 양방에서 자보로 통원·입원 중이면 한방 자보 접수는 할 수 없고, 사고와 무관한 기존 건보 상병만 볼 수 있습니다
- **세부산정내역서 발급비:** 최초 1부는 무료이고, 그 뒤부터 요구자에게 받을 수 있습니다(보건복지부 고시 제2018-21호, 2018-03-02 시행). 제증명수수료 항목·상한은 고시 제2017-166호를 따릅니다 (레거시 차트 매뉴얼 「여러가지 계산서 출력」, 레거시 차트 매뉴얼 「제증명수수료 항목 및 금액에 관한 기준」)
- **본인부담금 수납대장:** 진료와 수납은 당일에 기록하는 것이 원칙이고, 급여·비급여를 모두 남깁니다. 수납대장은 별지 제5호 서식에 맞춥니다 (레거시 차트 매뉴얼 「진료기록부 및 본인부담금 수납대장 작성시 유의사항」)

### 현행과 다른 점

- **급여제한자 처리:** 현행은 `급여제한여부`가 있으면 무자격이든 급여제한이든 보험구분을 `일반`으로 바꿉니다. 레거시 차트는 무자격자만 `일반`으로 돌립니다. 급여제한자는 자격구분 `급여제한`을 유지한 채 전액을 받고, 청구명세서도 만들어 송신합니다 (레거시 차트 매뉴얼 「건강보험 무자격자/급여제한자 진료기록과 수납」)
- **공제제외 단위:** 현행 수납 body의 `공제제외여부`는 수납 한 건 전체에 붙는 플래그입니다. 레거시 차트는 한 번 수납할 때 금액을 공제대상과 공제제외 칸(현금/카드 각각)으로 나눠 받습니다. 과세·지원금·건생비·행복카드분은 수납 내역에 자동으로 공제제외가 체크되고, 나중에 행 단위로 바꿀 수도 있습니다 (레거시 차트 매뉴얼 「공제제외로 수납」, 레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」)
- **급여·비급여 분리 수납:** 레거시 차트는 급여 본인부담과 비급여를 나눈 채로 할인·절사·현금·카드·건생비를 입력하고, 수납 내역도 본인/비급여로 나눠 보여 줍니다. 현행은 받을 금액을 비과세/과세로만 나눕니다 (레거시 차트 매뉴얼 「본인부담금 및 비급여 진료비 수납」)
- **현금영수증:** 현행 `PaymentCalculator`의 `현금영수증` 모델은 항상 `false`입니다(위 미확인 항목). 레거시 차트는 수납 화면에서 바로 승인하고, 승인·취소·수기 내역을 따로 관리합니다 (레거시 차트 매뉴얼 「현금영수증 승인 및 영수증 출력」)
- **임신부 정보:** 현행은 접수할 때 `임산부여부` 체크만 보냅니다. 레거시 차트는 환자 관리정보에 출산 예정일(기간)을 저장해, 그 기간의 접수에 자동으로 적용합니다 (추정) (레거시 차트 매뉴얼 「임신부 및 조산아 접수」)
- **같은 날 자보·건보 병행:** 레거시 차트는 같은 날 자보와 건보 진료가 겹치면 차트(차트번호)를 하나 더 만들어 따로 기록합니다. 그래야 청구명세서가 갈라집니다. 날짜가 다르면 한 차트에서 진료일별로 보험을 다시 계산합니다. 현행은 접수(`내원`) 단위로 `보험구분`을 갖습니다. 그래서 같은 환자를 하루에 두 번 접수하면 분리할 수 있을 것으로 보입니다 (추정) (레거시 차트 매뉴얼 「자보치료와 건보치료가 병행된 경우 진료기록」)
- **패키지·선결제:** 레거시 차트가 권장하는 방식은 예약플래너에 패키지 회차를 표시하는 것입니다. 진료 기록으로 할 때는 첫 회에 총액, 이후 회차는 0원으로 기록하고 회차는 메모로 공유합니다. 선결제 뒤 실손보험금을 받고 결제를 취소하는 악용 사례를 들어 선수납 차감 방식을 권장하지 않습니다. 보험 진료는 패키지로 묶을 수 없습니다. 현행은 `선수금` 충전·차감과 `진행중인패키지여부`를 둡니다 (레거시 차트 매뉴얼 「패키지진료 관리하기」)
- **환불 표현:** 현행 환불은 환자상세 수납 내역의 별도 API로 보입니다(추정). 레거시 차트는 수납 내역에 `환불` 종류 행을 날짜·수단과 함께 덧붙이고, 재수납도 새 행으로 남깁니다 (레거시 차트 매뉴얼 「환불 및 재수납」)
- **지출·시재:** 현행은 현금 시재와 지출 항목·금액만 다룹니다. 레거시 차트 금전출납은 수입·지출 계정과목과 거래처를 두고, 수납현황에서 현금 수납·환불(또는 카드 포함) 금액을 불러와 장부에 반영합니다. 기간별 통계도 냅니다 (레거시 차트 매뉴얼 「금전출납부 기록 및 통계」)
- **대기 목록 정리:** 레거시 차트는 진료기록이 끝난 환자나 목록 전체를 대기실·치료실에서 한꺼번에 빼는 기능이 있고, 드래그로 대기 순서를 바꿉니다. 현행 대기·치료 컬럼은 `대기시간` 오름차순 고정입니다 (레거시 차트 매뉴얼 「접수실프로그램 메뉴 버튼 안내」, 레거시 차트 매뉴얼 「재진환자 접수」)
- **진료비 발생 정보 삭제:** 레거시 차트는 진료기록과 수납기록이 모두 없는 건만 수납현황에서 지울 수 있습니다. 현행 접수 취소는 그날의 진료기록과 수납 내역을 함께 지웁니다 (레거시 차트 매뉴얼 「접수실프로그램 메뉴 버튼 안내」)

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
