# 설정

`/setting` 아래 하위 라우트로 병원 운영·진료 환경·처방 수가·계정 권한·태블릿·결제·외부 연동을 설정합니다. 공통 컨테이너 `SettingView`가 하위 라우트마다 권한을 검사하고 `KeepAlive`(max 3)로 화면을 띄웁니다. 비대면 진료 정산(`/remote-settlement`)은 `/setting` 밖의 최상위 라우트지만 사이드바 설정 메뉴에 함께 들어 있습니다.

| 경로 | 이름 | 권한 (`meta`) | 비고 |
|---|---|---|---|
| `/setting` | 설정 (컨테이너) | `설정`(`setting`) + `permissionRequired` | `requiresAuth`, `usesGlobalLayout` |
| `/setting/common` | 기본 설정 | `기본설정`(`normal_setting`) | |
| `/setting/telemedicine` | 비대면 진료 설정 | `기본설정` | `soo` 연동 + localStorage `비대면진료등록여부` |
| `/setting/service-integration` | 서비스 연동 | `기본설정` | |
| `/setting/hospital` | 병원 정보 설정 | `병원정보설정`(`info_setting`) | |
| `/setting/treatment` | 진료 설정 | `진료설정`(`record_setting`) | 사이드바는 풀 차트일 때만 |
| `/setting/prescription` | 처방 및 수가 설정 | `처방수가설정`(`prescription_setting`) | 탭 9개 |
| `/setting/templates` | 상용구 설정 | `상용구설정`(`template_setting`) | |
| `/setting/account-permission` | 계정 및 권한 설정 | `계정권한설정`(`system_setting`) | |
| `/setting/account-history` | 계정 이력 | `""` + `permissionRequired` | 사이드바 없음, 목업 화면 |
| `/setting/tablet` | 태블릿 설정 | 없음 | `emr` + 풀 차트 (`Sct`) |
| `/setting/document-management` | 문서 관리 | 없음 | `emr` + 풀 차트 (`Sct`) |
| `/setting/billing` | 결제 정보 | `결제메뉴접근`(`billing`) | `supportsMobile` |
| `/setting/mcp-tokens` | MCP 연동 | 역할 `01` | dev/stg 빌드만 등록, prd는 데모 계정만 |
| `/setting/mcp-pending-contacts` | MCP 승인 대기 | 역할 `01` | 위와 같음 |
| `/setting/expense-collection` | 지출내역 수집 | `finance_expense_collect` write | 재무 원격 앱 |
| `/remote-settlement` | 비대면 진료 정산 | 역할 `01` | `soo` + 비대면진료 등록 |
| `/setting/appointment` | 예약 설정 | `예약설정` | → [appointment.md](appointment.md) |
| `/setting/schedule` | 진료 스케줄 설정 | `진료스케줄설정` | → [appointment.md](appointment.md) |
| `/setting/caller-numbers` | 발신번호 및 채널 설정 | `발신번호설정` | → [crm.md](crm.md) |
| `/setting/consult-templates` | 상담 템플릿 관리 | `연락목록` | → [crm.md](crm.md) |
| `/setting/message-templates` | 메시지 템플릿 관리 | `메시지템플릿관리` | → [crm.md](crm.md) |
| `/setting/contents` | 콘텐츠 관리 | `일반문자` | → [crm.md](crm.md) |

## 공통 컨테이너 — `/setting` (`setting`)

- **목적:** 설정 하위 화면의 권한 검사와 레이아웃을 맡습니다
- **접근 조건:** 라우트 `meta.permissionCode` `설정` + `permissionRequired`. 하위 화면은 `SettingView`가 다시 검사합니다
  - 현재 경로와 `path`가 정확히 같은 `matched` 항목의 `meta`를 씁니다
  - `setting-tablet`, `setting-document-management` → `Sct()`, 즉 서비스 연동에 `emr`가 있고(`nue`) 풀 차트(`a0`)여야 합니다
  - `setting-expense-collection` → `vct(nc.지출내역수집)`, 즉 `finance_expense_collect`에 `canWrite$`가 있어야 합니다
  - 그 밖에는 `permissionCode`와 `permissionRequired`가 모두 있을 때만 `canAccess$(code)`로 검사하고, 아니면 통과입니다. 그래서 `account-history`(`permissionCode: ""`)는 검사 없이 열립니다
  - 권한 트리가 로드되기 전(`DB()`가 false)이고 검사 대상이면 스피너를 보여줍니다. tablet·expense-collection은 항상 검사 대상으로 취급합니다
  - 실패하면 `AccessDeniedNotice`가 "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."를 띄웁니다
- **사이드바 메뉴** (`Group.js`의 id 100 `설정`):
  - 하위 메뉴는 그룹(`병원 운영`·`진료 환경`·`예약·메시지`·`고객 관리`·`연동·기기`·`재무 관리`)으로 묶입니다. `문서 관리`만 그룹이 없습니다
  - 부모 `setting` 권한이 없으면 하위 메뉴 전체를 숨깁니다
  - 하위 항목에는 `R6`(서비스 조건), `requiredRoleType`, `requiresDemoAccountInPrd`, `requiredPermission`만 적용합니다. 태블릿·문서 관리에는 `Sct`도 적용합니다. 하위 항목의 `permissionCode`는 걸러내는 데 쓰지 않습니다
  - 하위 항목이 1개만 남으면 부모 메뉴가 그 경로로 바로 연결됩니다
- **근거:** [SettingView.vue.js](../../restored/views/SettingView.vue.js), [routes.js](../../restored/router/routes.js#L422), [Group.js](../../restored/modules/index/Group.js#L323), [part-74.js](../../restored/modules/index/part-74.js#L76), [part-63.js (`Sct`)](../../restored/lib/index/part-63.js), [enabled.js](../../restored/lib/index/enabled.js), [part-60.js (`nc`)](../../restored/modules/index/part-60.js)

## 기본 설정 — `/setting/common` (`setting-common`)

- **목적:** 진료 시간, 환자 표시·등급·내원경로, 진료 항목을 설정합니다
- **접근 조건:** `기본설정`(`normal_setting`) + `permissionRequired`
- **화면 구성:** 탭 3개. 탭은 `?tab=`(한글 라벨)과 동기화되고, 온보딩 가이드(`useGuideTabControl`)가 탭을 바꿀 수 있습니다
  | 탭 | 컴포넌트 | 내용 |
  |---|---|---|
  | 진료 시간 설정 | `SettingCommonViewClinicHoursConfig` | 요일별 진료 시간·휴게·휴진, 임시 진료·월 휴진일 (`TemporaryHoursOrMonthlyHoliday`) |
  | 환자 설정 | `SettingCommonViewPatientSettings` | 추천 차트번호, 환자 카드 차트번호 표시, 주민번호 뒷자리 표시, 환자 등급, 내원 경로 |
  | 진료 항목 설정 | `SettingCommonViewTreatmentListConfig` | 진료 항목 사용·미사용, 순서, 색, 단축어 (환자 카드 미리보기 포함) |
- **동작:**
  - 요일별 진료 시간 편집 → `PATCH /settings/clinic-hours` (`요일별진료시간`). 날짜별 임시 진료·휴진 → `PUT /settings/clinic-calendar/days` (`일자`)
  - 임시 진료·휴진 화면은 공휴일(`GET /settings/holidays/public-holidays/{year}`)과 닥톡 예약 상품(`GET /doctalk/products`, `/doctalk/products/bookable-times`, `POST /doctalk/sync-status`)을 함께 조회합니다. 외부 채널 영향 안내(`ClosedDayDoctalkAlert`)도 여기서 띄웁니다
  - 휴진일을 지울 때 "임시 진료는 유지 / 임시 진료도 삭제" 중에서 고릅니다
  - 환자 등급 추가·수정·삭제 → `POST`·`PATCH`·`DELETE /settings/patient-levels` (`등급명`, `등급색명`, `할인율`, `기본설정여부`)
  - 내원 경로 추가·수정·삭제 → `/settings/visit-pathways` (`내원경로명`). 사용/미사용 목록으로 나뉩니다
  - 진료 항목 추가·수정·삭제 → `/settings/medical-treatments` (`기본이름`, `이름`, 색, 단축어)
  - 토글: `PATCH /settings/display/chart-numbers` (`차트번호표기여부`), `PATCH /settings/display/resident-numbers` (`주민등록번호뒷자리표시여부`), `PATCH /settings/hospitals/chart-number` (`추천차트번호`. 새 환자 등록 시 이 번호부터 1씩 증가)
- **근거:** [SettingCommonView.vue](../../restored/views/SettingCommonView.vue), [SettingCommonViewClinicHoursConfig.vue](../../restored/components/setting/SettingCommonViewClinicHoursConfig.vue), [SettingCommonViewPatientSettings.vue](../../restored/components/setting/SettingCommonViewPatientSettings.vue), [SettingCommonViewTreatmentListConfig.vue](../../restored/components/setting/SettingCommonViewTreatmentListConfig.vue), [Tab.js](../../restored/modules/index/Tab.js)

## 비대면 진료 설정 — `/setting/telemedicine` (`setting-telemedicine`)

- **목적:** 수(soo) 비대면 진료 접수 설정과 환자용 한의원 홈페이지 정보를 관리합니다
- **접근 조건:** `기본설정` + `permissionRequired`
  - 라우터 가드: localStorage `비대면진료등록여부`가 false면 기본 홈으로 보냅니다 (`jHe`)
  - 사이드바: `soo` 연동 + 비대면 등록(`SL`)일 때만 보입니다 (`R6`의 `FHe`)
- **화면 구성:** 헤더 `저장` 버튼과 `SettingCommonViewTelemedicineConfig` 하나
  - 섹션: 진료 신청 받기/안받기, 비대면 진료 시간(요일별·휴게·휴진), 진료 알림 받을 번호, 진료 원장님 정보(프로필 사진), 한의원 정보, 홈페이지 주소, 네이버 플레이스 링크, 정산 계좌(은행·계좌번호·예금주)
- **동작:**
  - 진입 시 `GET thesooClient /members/upstream/clinics/my`, `GET /settings/hospitals`를 조회합니다. "병원 정보 불러오기"로 EMR 병원 정보를 채울 수 있습니다
  - 홈페이지 주소 중복 확인 → `GET /members/upstream/clinics/check-local?localHomeId=`
  - 프로필 사진(10MB 이하 이미지) → `POST /members/upstream/clinics/my/profile`
  - 저장 → `PATCH /members/upstream/clinics/my`. 변경 사항이 없으면 버튼이 비활성입니다. 주소 검색은 `SearchAddress`(juso)를 씁니다
  - 알림 번호는 환자에게 보이지 않는다고 안내합니다
- **근거:** [SettingTelemedicineView.vue](../../restored/views/SettingTelemedicineView.vue), [SettingCommonViewTelemedicineConfig.vue](../../restored/components/setting/SettingCommonViewTelemedicineConfig.vue), [guards.js](../../restored/router/guards.js#L69), [part-41.js](../../restored/lib/index/part-41.js#L54)

## 서비스 연동 — `/setting/service-integration` (`setting-service-integration`)

- **목적:** 수·실손 서비스 연동 상태를 보여주고 연동을 시작합니다
- **접근 조건:** `기본설정` + `permissionRequired`
- **화면 구성:** `ServiceConnectorCard` 2장 (`soo` "수", `insurance` "실손"). 연동 여부는 각각 `enabled$`(`soo`)와 `rue`(`insurance`)로 판단합니다. 모달은 `SooLinkConnectModal`, `ServiceConnectModal`, `ServiceManageModal`입니다
- **동작:**
  - 미연동 "수" 카드 → `SooLinkConnectModal`에서 `migration` 여부를 고릅니다 → `POST accountClient /integrations/soo/link` (`{ migration }`)
    - 성공 안내: 데이터 이전은 최대 10분 걸릴 수 있다고 알립니다
    - 실패하면 고객센터 안내를 띄웁니다
  - 미연동 "실손" 카드 → `ServiceConnectModal` 확인 → `useSooSignUpStore().실손여부 = true` 후 가입 흐름(`state: "soo"`)으로 이동합니다
  - 연동된 카드: 수는 `ServiceManageModal`, 실손은 별도 모달(`open`)을 엽니다
  - `?openSooConnect=true`로 들어오면 수 연동 모달을 바로 열고 쿼리를 지웁니다
- **근거:** [SettingServiceIntegrationView.vue.js](../../restored/views/SettingServiceIntegrationView.vue.js), [sooSignUp.js](../../restored/api/integrations/sooSignUp.js)

## 병원 정보 설정 — `/setting/hospital` (`setting-hospital-info`)

- **목적:** 요양기관 사업자 정보, 세금계산서 담당자, 공단 인증서, 이미지(CI·약도·도장), 제주 지원사업 계좌, 선택 약관 동의를 관리합니다
- **접근 조건:** `병원정보설정`(`info_setting`) + `permissionRequired`
- **화면 구성:**
  - 좌측 `SettingHospitalBusinessCard`: 사업자등록번호·요양기관기호·산재기관기호·상호(영문)·대표자·생년월일·소재지(영문)·전화·팩스·이메일·청구대행단체·일차의료방문·의료접근성취약지·첩약시범·검사승인번호·로그인 유지 시간. 안에 `SettingHospitalJejuClaim`이 들어갑니다
  - 우측 카드: 세금계산서 담당자, 인증서 등록, 이미지(`SettingHospitalImage`: 병원 CI·약도·대표자 도장), 선택 약관 동의(개인정보처리위탁·처리방침·제3자 제공)
- **필드 분류** (`SettingHospitalFieldBadge`의 `_hoisted_1`):
  - `gated`: 사업자등록번호. 변경하면 사업자등록증 사본을 첨부해야 하고 심사 후 반영됩니다
  - `ro`: 요양기관기호, 검사승인번호
  - `free`: 나머지
- **동작:**
  - 저장 → `PATCH /settings/hospitals`
    - 저장 힌트: "N건 즉시 반영", "N건 심사 후 반영"
    - `gated` 필드가 바뀌면 사업자등록증을 업로드하고(`POST accountClient /change-requests/documents`로 준비 → S3 PUT) `POST accountClient /change-requests`로 신청합니다 (`요청값`, `요청출처`, `이미지경로`, `이미지파일명`, `인증타입`)
    - 신청 실패 메시지: 계정주 대표원장만 신청 가능, 중복 신청, 증빙 확인 실패, 업로드 실패
  - 심사 중이면 "사업자등록번호를 … 으로 변경 신청했습니다" 배너를 띄웁니다. 반려되면 반려 배너를 띄우고 "첨부 확인"으로 `GET /change-requests/{id}/document`를 엽니다
  - 수 비대면 정보가 있으면 저장 시 "수 비대면 진료 홈페이지에 보여줄 정보도 함께 업데이트 하시겠습니까?"를 묻습니다. 함께 업데이트를 고르면 `PATCH thesooClient /members/upstream/clinics/my`도 호출합니다
  - 인증서: `.der`·`.key` 폴더를 고르고 비밀번호를 입력합니다 → `POST /nhic/cert-files`. 등록 상태와 만료예정일은 `GET /nhic/cert-files`로 봅니다. 수 단독 계정(`vx`)에는 이 섹션이 없습니다
  - 이미지 업로드 → `POST /settings/images/private` → signed URL에 PUT. 도장은 배경을 자동으로 지웁니다
  - 제주 지원사업: 운영사업(`해녀`·`생존희생자`·`유족`·`며느리`) 체크와 지급 계좌 → `PATCH /settings/jeju-claim` (`운영사업`, `지급은행`, `지급계좌번호`, `예금주`). 수 단독 계정이 아닐 때만 저장합니다. 병원 정보만 저장되고 이 저장이 실패하면 별도 오류를 띄웁니다
  - 선택 약관 → `GET accountClient /terms/my-agreements`, `PUT /terms/optional-agreements` (`약관동의목록`)
- **근거:** [SettingHospitalView.vue](../../restored/views/SettingHospitalView.vue), [SettingHospitalView.helpers.js](../../restored/views/SettingHospitalView.helpers.js), [SettingHospitalFieldBadge.vue.js](../../restored/components/setting/SettingHospitalFieldBadge.vue.js), [SettingHospitalJejuClaim.vue](../../restored/components/setting/SettingHospitalJejuClaim.vue), [api/users/requests.js](../../restored/api/users/requests.js)

## 진료 설정 — `/setting/treatment` (`setting-treatment`)

- **목적:** 진찰료·청구 기준, 시술 자동기록, 상용 혈자리, 바이탈·치료실을 설정합니다
- **접근 조건:** `진료설정`(`record_setting`) + `permissionRequired`. 사이드바에는 풀 차트(`a0`)일 때만 보입니다 (`DHe`)
- **화면 구성:**
  | 탭 | 컴포넌트 | 주요 설정 |
  |---|---|---|
  | 진찰료 및 청구 | `SettingTreatmentViewExaminationClaim` | 초진 산정 기준(마지막 내원일로부터 N일), 주간 진찰료 시간, 야간·토요일·공휴일 가산, 연령 가산, 산정특례 접수 방식, 변증기술료, 초진 기록 자동 고정, 건보/자보 월·주 단위 청구, 송신·수신 명세서 저장 위치 |
  | 시술 및 검사 | `SettingTreatmentViewProcedureTest` | 시술·검사 항목 사용 여부, 일회용 부항컵 자동 산정, 첩약 기본 투여량, 추나 자동 승인, 처방 시술 진료기록 자동 기재 |
  | 상용 혈자리 | `SettingTreatmentViewAcupuncturePositions` | 부위별 혈자리 선택 (입력 후 Enter로 일괄 선택) |
  | 바이탈 및 치료실 | `SettingTreatmentViewVitalTreatmentRooms` | 바이탈 측정 항목 사용·순서, 치료실·베드 |
- **동작:**
  - 항목별 설정 → `PATCH /settings/treatments/{id}`. 초진 기록 자동 고정 → `PATCH /settings/initial-records` (`초진기록자동고정여부`). 시술 자동기록 → `PATCH /settings/treatments/auto-record` (`시술자동기록여부`)
  - 명세서 저장 위치는 데스크톱 앱에서만 바꿀 수 있습니다. 웹이면 "저장 경로 변경은 앱에서만 가능합니다"를 띄웁니다. 앱에서는 `selectDirectory("samIn"|"samOut")`로 폴더를 고릅니다
  - 혈자리 목록 → `GET /settings/references/acupoints`
  - 바이탈 → `PATCH /settings/treatments/vitals/{id}` (`사용여부`, `순서`)
  - 치료실 → `POST`·`PATCH`·`DELETE /settings/treatments/rooms` (`치료실명`, `베드수`)
    - 최대 10개까지 둘 수 있습니다
    - 치료 중인 환자가 있으면 변경할 수 없습니다 (`GET /treatments/patients/basic`으로 확인)
- **근거:** [SettingTreatmentView.vue](../../restored/views/SettingTreatmentView.vue), [SettingTreatmentViewExaminationClaim.vue.js](../../restored/components/setting/SettingTreatmentViewExaminationClaim.vue.js#L296), [SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue](../../restored/components/setting/SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue)

## 처방 및 수가 설정 — `/setting/prescription` (`setting-prescription`)

- **목적:** 보험약·치료재료·약속처방·비급여·패키지·자보/산재 수가·첩약 시범사업·개인 방제를 관리합니다
- **접근 조건:** `처방수가설정`(`prescription_setting`) + `permissionRequired`
- **탭 노출 규칙:**
  - 수 단독 계정(`vx`)은 `비급여`, `패키지`만 봅니다
  - 그 밖에는 `보험약`, `치료재료대`, `약속처방`, `비급여`, `패키지`, `자동차 보험 수가`가 보입니다. 병원 정보에 `산재기관번호`가 있으면 `산재보험 수가`가 더해지고, 마지막에 `첩건 시범사업`, `개인 방제`가 붙습니다
- **탭 상태:** `?tab=`(한글 라벨)과 동기화됩니다
  - 약속처방 편집 중(`x`)에 탭을 바꾸거나 라우트를 떠나면 "저장하지 않은 변경 내용이 있습니다"(계속 편집/저장 안함)를 묻습니다 (`uZt` 가드)
- **패키지 확인 배너:** 비급여 항목이 바뀌어 확인이 필요한 패키지(`확인필요패키지`)가 있으면 패키지 탭 위에 배너를 띄웁니다. 비급여 탭의 `openPackageReview`는 패키지 쿼리를 무효화한 뒤 패키지 탭의 검토 패널을 엽니다

| 탭 | 컴포넌트 | 하위 구성 | 주요 API |
|---|---|---|---|
| 보험약 | `SettingPrescriptionViewInsuranceMedicines` (+ 하단 `…InsuranceMedicinesDosages`) | 전체 보험약 / 사용 보험약 테이블, 임의처방 등록(`…InsuranceMedicineCustomPrescription`), 투여량(기본/2배) | `GET /settings/medicines`, `PATCH`·`DELETE /settings/medicines/{id}`, `POST /settings/medicines/from-custom`·`from-mixture`, `GET settings/references/simple-extracts`·`simple-extract-mixed`, `GET`·`PATCH /settings/medicines/dosages` (`기본투여량여부`) |
| 치료재료대 | `SettingPrescriptionViewExpendable` | 치료재료대 목록(코드·제품명·제조원·상한 금액·사용 기간), 일회용 부항컵, 구매 내역(`…ExpendableHistory`) | `GET /settings/treatments/expendables`, `PATCH /…/expendables/{id}`, `GET`·`POST`·`PATCH`·`DELETE /…/expendables/{id}/histories[/{historyId}]` |
| 약속처방 | `SettingPrescriptionViewReserved` (`…ReservedSidebar` + `…ReservedMain`) | 그룹·약속처방 목록, 이름(최대 20자), 사용 범위(개인/모든 진료의), 진료기록·상병·처방 구성 | `GET`·`POST /settings/appointed-prescriptions`, `GET`·`PATCH`·`DELETE /…/{id}`, `/…/groups` CRUD, `PUT /…/sort-order`, `PUT /…/groups/sort-order` |
| 비급여 | `SettingPrescriptionViewNonBenefit` | 카테고리·처방 그룹, 비급여 등록 패널(`…NonBenefitRegistrationPanel`: 처방명·코드·단가·과세 구분·보고 코드·세부 구분·약재·탕전 방식), 일괄 삭제, 그룹 변경, 즐겨찾기 | `GET`·`POST /settings/nonbenefits/v2`, `PATCH /…/v2/{id}`, `POST /settings/nonbenefits/validate`·`bulk-delete`, `PATCH /settings/nonbenefits/groups`, `/settings/nonbenefit-groups` CRUD, `GET /settings/nonbenefits/{id}/affected-packages/delete`, `POST /…/affected-packages/update`, `/settings/nonreimbursed-herb-templates` |
| 패키지 | `SettingPrescriptionViewPackage` | 패키지 목록·그룹, 편집 패널(유형 `횟수차감형`/`정액형`, 유효기간, 설정 금액, 처방 항목), 검토 패널 | `/settings/nonbenefit-packages` CRUD, `POST /…/validate`, `PATCH /…/{id}/favorite`, `/settings/nonbenefit-package-groups` CRUD + `validate` |
| 자동차 보험 수가 | `SettingPrescriptionViewJabo` | 세로 하위 탭: 자보 투약(`…InsuranceChubyak variant="jabo"`), 자보 약침, 한방 의약품, 자보 시술 및 처치 | `/settings/car-insurances/herbal-decoctions`·`herbal-medicines`·`pharmacopunctures` CRUD, `GET /…/pharmacopuncture-references`·`procedure-references`, `PATCH /…/procedure-fee/{code}` |
| 산재보험 수가 | `SettingPrescriptionViewIndustrial` | `…InsuranceChubyak variant="sanjae"` (첩약 등록) | `/settings/sanjae-insurances/herbal-decoctions` CRUD |
| 첩건 시범사업 | `SettingPrescriptionViewChubyak` | 버튼 탭(`useSettingHerbStore`): 약재(등록일별/약재별 보기, 엑셀 업로드, 구입이력), 기준처방(사용 처방 별칭, 약재 구성), 탕전실 | `GET /settings/chubyak-pilots/herbs[/products\|/available-product-codes]`, `/settings/hospitals/chubyak-pilots/herbs` CRUD (`약재목록`, `탕전실Id`), `/settings/hospitals/chubyak-pilots/prescriptions[/herbs]` CRUD, `PATCH /…/prescriptions/{id}/alias`, `/settings/dispensary-rooms` CRUD |
| 개인 방제 | `SettingPrescriptionViewPersonalFormula` (`…Sidebar` + `…Main`) | 방제 사전(출전별 원방) 검색 → 사용 처방 등록, 직접 등록, 복제 | `GET /settings/reference-formulas/search`, `GET /settings/reference-formulas/{source}/{id}`, `/settings/personal-formulas` CRUD (`처방명`, `원방Id`, `약재목록`, `처방메모`), `POST /…/{id}/duplicate` |

- **검증 규칙** (UI 문구에서 확인):
  - **임의처방:** 약재는 최대 15종, 총 투약량 50g 이하, 총 투약가 3,000원 이하이고 이름이 중복되면 안 됩니다
  - **패키지:** 과세/면세 혼합 패키지를 만들 수 없고, 패키지 이름이 중복되면 안 됩니다
  - **비급여:** 코드와 처방명이 중복되면 안 되고, 금액은 천만원을 넘을 수 없습니다. 수 서비스 전용 처방은 설정에서 추가할 수 없습니다
  - **약속처방:** 이름이 중복되면 안 됩니다
- **근거:** [SettingPrescriptionView.vue](../../restored/views/SettingPrescriptionView.vue), [Tab.js (`Tab$_4`, `SubTab$`)](../../restored/modules/index/Tab.js), [SettingPrescriptionViewReservedMain.vue](../../restored/components/setting/SettingPrescriptionViewReservedMain.vue), [SettingPrescriptionViewNonBenefitRegistrationPanel.vue](../../restored/components/setting/SettingPrescriptionViewNonBenefitRegistrationPanel.vue), [SettingPrescriptionViewPackageEditPanel.vue](../../restored/components/setting/SettingPrescriptionViewPackageEditPanel.vue), [SettingPrescriptionViewInsuranceMedicineCustomPrescription.vue](../../restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.vue), [SettingPrescriptionViewChubyak.vue](../../restored/components/setting/SettingPrescriptionViewChubyak.vue), [settingHerb.js](../../restored/stores/settingHerb.js)

## 상용구 설정 — `/setting/templates` (`setting-templates`)

- **목적:** 진료기록·메모·서식에 넣을 상용구를 관리합니다
- **접근 조건:** `상용구설정`(`template_setting`) + `permissionRequired`
- **화면 구성:** `SettingEditorTemplatesSidebar`(목록·검색·추가)와 `SettingEditorTemplatesMain`(편집기 `SettingEditorTemplatesEditor`, 처방 선택 `…PrescriptionSelect`, 추나 기법 참고 패널 `…ReferencePanel`)
- **사용 범위 3종:**
  | 범위 | 의미 | API |
  |---|---|---|
  | 전역 | 진료기록·메모·서식 어디서나 사용 | `/settings/templates` CRUD (`상용구명`, `내용`, `전체사용여부`) |
  | 서식 | 서식(문서발급)에서만 사용 | `/documents/phrases` CRUD |
  | 처방별 | 선택한 처방(수가코드)을 진료 때 입력하면 진료기록에 자동 입력 | `/settings/treatment-templates` CRUD (`진료기록상용구`) |
- **동작:**
  - 상용구명은 공백 없이 최대 20자입니다
  - 저장하지 않은 변경이 있으면 이동할 때 확인합니다 (`uZt`)
  - 처방 선택은 수가 코드 사전(`GET /settings/references/reimbursement-codes`, 자보 수가 JSON)으로 검색합니다
- **근거:** [SettingEditorTemplates.vue](../../restored/components/setting/SettingEditorTemplates.vue), [SettingEditorTemplatesMain.vue](../../restored/components/setting/SettingEditorTemplatesMain.vue), [SettingEditorTemplatesSidebar.vue](../../restored/components/setting/SettingEditorTemplatesSidebar.vue)

## 계정 및 권한 설정 — `/setting/account-permission` (`setting-account-permission`)

- **목적:** 병원 직원 계정을 만들고 수정·비활성화·삭제하며, 권한과 도장을 관리합니다
- **접근 조건:** `계정권한설정`(`system_setting`) + `permissionRequired`
- **화면 구성:**
  - `AccountPermissionsHeader`("새 계정 추가")
  - `AccountPermissionsListSection`: 검색, 계정유형 필터, `AccountPermissionsTable`
  - `AccountPermissionsSidebar` → `AccountPermissionsListDetail`: 기본 정보·재직 정보·접근 권한 트리(`AccountAccessPermissionSection`)·도장
  - 모달: `AccountCreateModal`, `AccountEditAccountInfoModal`, `AccountEditEmploymentInfoModal`, `AccountEditPasswordModal`, `AccountPermissionSetModal`, `AccountDeactivateModal`
- **동작:**
  - 계정 생성 → `POST accountClient /auth/check-username` (`아이디`) 후 `POST /users`. 프로필 이미지는 `POST /images`로 올립니다
  - 정보 수정 → `PATCH /users/{userId}` (`근무형태`, `입사일자`, `프로필이미지Id`)
    - `증빙게이트여부`가 있으면 증빙 첨부(`AccountEditProofBlock`)를 요구합니다
    - 휴대폰 OTP 본인확인을 받습니다 (`POST /verify/request-otp`·`confirm-otp`)
  - 비밀번호 변경 → `POST /users/{userId}/password`
  - 비활성화 → `PATCH /users/{userId}/deactivate` (`비활성화시작일자`). 활성화도 같은 API로 합니다
  - 삭제 → `DELETE /users/{id}`. "차트에서 완전히 삭제되며 복구할 수 없습니다"를 안내합니다
  - 권한 편집 → `GET`·`PATCH accountClient /permissions`. MEMBERS 권한 하위 트리(`MembersPermissionToggleSubtree`)도 여기서 편집합니다
  - 도장 → `POST`·`DELETE /users/{id}/stamp` (`이미지명`, `이미지사이즈`). 진료의(대표원장·부원장) 계정에만 등록할 수 있습니다. 배경은 자동으로 제거하고, 실패하면 원본을 그대로 씁니다
- **근거:** [AccountPermissionsView.vue](../../restored/views/AccountPermissionsView.vue), [AccountPermissionsListDetail.vue](../../restored/components/account/AccountPermissionsListDetail.vue), [AccountPermissionsTable.vue](../../restored/components/account/AccountPermissionsTable.vue)

## 계정 이력 — `/setting/account-history` (`setting-account-history`)

- **목적:** 계정 권한 부여·로그인 기록·개인정보 접근·진료기록 수정 이력을 보여주는 화면입니다 (미완성)
- **접근 조건:** `permissionCode: ""`라서 `SettingView` 검사를 그냥 통과합니다. 사이드바 메뉴는 없고 URL로만 들어갈 수 있습니다
- **화면 구성:** 제목은 "계정 권한 설정"입니다. 탭은 `permission`, `login`, `access`, `record`입니다
- **동작:**
  - 표 3개(`AccountHistoryTable*`)는 하드코딩된 샘플 행을 5번 반복해 그립니다. API 호출은 없습니다
  - `record` 탭은 "디자인 작업 완료후 작업 예정" 텍스트만 보여줍니다
- **근거:** [AccountHistoryView.vue](../../restored/views/AccountHistoryView.vue), [AccountHistoryView.helpers.js](../../restored/views/AccountHistoryView.helpers.js), [AccountHistoryTableLoginLog.vue.js](../../restored/components/account/AccountHistoryTableLoginLog.vue.js)

## 태블릿 설정 — `/setting/tablet` (`setting-tablet`)

- **목적:** 접수용 태블릿 계정·기기 세션과 접수 화면 옵션을 관리합니다
- **접근 조건:**
  - 라우트: `permissionRequired: false`
  - `SettingView`: `Sct()`, 즉 `emr` 연동 + 풀 차트
  - 사이드바: `Sct`와 `R6`. 권한 코드 `태블릿설정`(`tablet_settings`)은 enum에만 있고 라우트 검사에 쓰지 않습니다
- **화면 구성:** 탭 2개 (`?tab=basic|reception`)
  - **기본 설정** (`TabletAccountView`): 태블릿 계정 카드(`TabletAccountCard`), 사용 중인 기기(`TabletDeviceSessionList`), 앱 설치 안내(`TabletAppGuideCard`: 아이패드 전용, QR·링크 복사)
  - **접수 설정** (`TabletReceptionSettingView`): 관리자 PIN(`TabletAdminPinCard`), 지원 언어(`TabletLanguageCard`), 리뷰 QR(`TabletReviewQrCard`: 네이버·카카오·구글), 접수 화면 진료항목(`TabletTreatmentItemCard`)
- **동작:**
  - 계정 생성·수정·삭제 → `POST`·`PATCH`·`DELETE accountClient /tablet/accounts` (`아이디`, `비밀번호`). 삭제하면 기기가 자동으로 로그아웃됩니다
  - 기기 로그아웃 → `DELETE /tablet/sessions/{id}`. 모두 로그아웃 → `DELETE /tablet/sessions`
  - 관리자 PIN(접수 화면 로고를 7번 누르면 열리는 메뉴) → `PUT /tablet/settings/admin-pin` (`PIN`, 숫자 4자리). 기본값으로 되돌릴 수 있습니다
  - 언어 → `PUT /tablet/settings/languages` (`languages`). 리뷰 링크 → `PUT /tablet/settings/review-links` (`리뷰링크`)
  - 진료항목 → `PUT /tablet/settings/treatment-items` (`진료항목Ids`). 최소 1개는 남아 있어야 합니다
- **근거:** [SettingTabletView.vue](../../restored/views/SettingTabletView.vue), [TabletAccountView.vue](../../restored/views/TabletAccountView.vue), [TabletAdminPinCard.vue](../../restored/components/tablet/TabletAdminPinCard.vue)

## 문서 관리 — `/setting/document-management` (`setting-document-management`)

- **목적:** 태블릿 접수에 쓸 문진표와 동의서 서식을 만듭니다
- **접근 조건:** 태블릿 설정과 같습니다 (`Sct`). 라우트는 `permissionRequired: false`입니다. `SettingView`는 이 경로를 권한 로딩 대기 대상으로 강제하지 않습니다
- **화면 구성:** 탭 `문진표`(`SettingTabletQuestionnaire`), `동의서`(`SettingTabletConsent`). `?tab=questionnaire|consent`와 동기화됩니다. 각 탭은 목록과 편집기로 구성됩니다
- **동작:**
  - **문진표:**
    - CRUD는 `/tablet/questionnaire-templates`입니다 (`title`, `series`, `status`, `questions`). 상태 → `PATCH /…/{id}/status`, 복제 → `POST /…/{id}/duplicate`, 이미지 → `POST /…/upload-images`
    - 편집기에서 설정할 수 있는 것: 선택지 점수·합계 구간 판정, 조건부 표시(앞 질문의 답에 따라 보이기), 언어 추가, 공개/비공개
  - **동의서:**
    - CRUD는 `/tablet/consent-document-templates`입니다 (`title`, `documentType`, `status`, `variants`). 문서 업로드 → `POST /tablet/consent-documents/upload`
    - 업로드한 문서 위에 서명·체크박스 등 입력폼을 배치합니다. 언어별 variant를 따로 만들 수 있습니다
  - 중앙 배포(공용) 서식은 수정·삭제할 수 없고 복제해서 써야 합니다. 목록에서 내리려면 비공개로 전환합니다
  - 빈 양식 인쇄(`QuestionnaireBlankPrintSheet`, `ConsentBlankPrintSheet`, `TabletFormPrintModal`)를 지원합니다
- **근거:** [SettingDocumentManagementView.vue](../../restored/views/SettingDocumentManagementView.vue), [SettingTabletQuestionnaire.vue](../../restored/components/setting/SettingTabletQuestionnaire.vue), [SettingTabletConsent.vue](../../restored/components/setting/SettingTabletConsent.vue), [SettingTabletConsentEditor.vue](../../restored/components/setting/SettingTabletConsentEditor.vue)

## 결제 정보 — `/setting/billing` (`setting-billing`)

- **목적:** 업스트림 이용료 청구서를 조회·결제하고, 결제 수단과 실손 구독 결제 수단을 관리합니다
- **접근 조건:** `결제메뉴접근`(`billing`) + `permissionRequired`. `supportsMobile`이라 모바일 헤더(`MobileHeader`)를 지원합니다
- **화면 구성:** `CrmBillingView`
  - `BillingCombinedPayBanner`: 합산·즉시 결제 안내
  - `BillingInvoiceList`: 결제 내역. 상태는 결제 대기·완료·실패·유예·연체·환불·미리 결제·발행 예정
  - `BillingInvoiceSidePanel`: 청구서 상세 (문자 유형별 항목·세금계산서·실패 사유)
  - `BillingPaySidePanel`: 결제
  - `BillingPaymentMethod`: 결제 수단, 메디 예치금. 실손 행은 `InsurancePaymentMethodRow`입니다
- **동작:**
  - 목록 → `GET crmClient /billing/invoices?…`. 상세 → `GET /billing/invoices/{id}`
  - 결제 → `POST /billing/invoices/payments` (`invoiceIds`, `paymentMethodId`). 오류 문구: 잔액 부족, 연체·유예 시 예치금 결제 불가, 예치금 합산 결제 불가, 청구서 상태 변경됨
  - 기본 결제 수단·세금계산서 정보 → `PUT /billing/payment-methods/default` (`medipayId`, `depositFallbackEnabled`, `billingTaxInvoice*`)
  - 실손 결제 수단 → `GET`·`POST`·`PUT`·`DELETE insuranceClient /hospital/payment-methods`. 메디페이 카드 목록은 `GET /hospital/payment-methods/medipay`, 구독 정보는 `GET /subscriptions`로 봅니다. 구독료는 매월 1일에 정기 결제된다고 안내합니다
- **근거:** [CrmBillingView.vue](../../restored/views/CrmBillingView.vue), [BillingPaySidePanel.vue](../../restored/components/billing/BillingPaySidePanel.vue), [InsurancePaymentMethodModal.vue](../../restored/components/insurance/InsurancePaymentMethodModal.vue)

## MCP 연동 — `/setting/mcp-tokens` (`setting-mcp-tokens`)

- **목적:** Claude 같은 외부 AI 도구를 EMR에 연결할 API Key를 발급하고 관리합니다 (메뉴 배지 "개발중")
- **접근 조건:**
  - 라우트는 `Yu() || Un()` 빌드에서만 등록됩니다
  - `requiredRoleType` `01`(대표원장)이어야 합니다
  - `requiresDemoAccountInPrd`: prd에서는 하드코딩된 데모 계정만 들어갈 수 있고, 다른 계정은 `not-found`로 갑니다 ([access-control.md](../access-control.md))
- **화면 구성:** `MCPTokens`. 활성 API Key, 사용 가능한 MCP 도구 목록(도구 상세·예시 프롬프트, 읽기/쓰기 권한)
- **동작:**
  - 발급 → `POST accountClient /auth/mcp-tokens`
    - 병원당 1개이고, 원장님만 발급할 수 있습니다
    - 키는 한 번만 표시됩니다
    - 다시 발급하면 기존 키는 즉시 중지됩니다
  - 목록 → `GET /auth/mcp-tokens`. 사용 중지 → `DELETE /auth/mcp-tokens/{id}`
  - 안내 문구: MCP가 작성한 메모·메시지는 본인 확인 뒤에만 정식 저장됩니다. 환자 이름·차트번호·연락처는 모델에 노출하지 않고 핸들로만 다룹니다
- **근거:** [MCPTokens.vue](../../restored/components/m/MCPTokens.vue), [Group.js](../../restored/modules/index/Group.js#L420)

## MCP 승인 대기 — `/setting/mcp-pending-contacts` (`setting-mcp-pending-contacts`)

- **목적:** MCP가 만든 연락(문자·카카오톡·전화)과 차트 메모를 사람이 확인하고 승인합니다
- **접근 조건:** MCP 연동과 같습니다
- **화면 구성:** 버튼 그룹 `연락 승인`(`McpApprovalContactsTab`) / `메모 승인`(`McpApprovalNotesTab`). 둘 다 목록과 상세 편집으로 구성됩니다
- **동작:**
  - **연락:**
    - 목록 → `GET /crm/trigger-engine/mcp-approvals/pending`. 수정 → `PATCH /…/{id}`
    - 승인 → `POST /…/{id}/approve`. 승인하면 발송 대기 상태가 됩니다
    - 거부 → `POST /…/{id}/reject`
    - 만료된 건과 이미 처리된 건은 오류로 안내합니다
    - 편집기는 `CrmCommonMessageEditor`·카카오 브랜드 메시지 편집기와 미리보기를 씁니다
  - **메모:**
    - 목록 → `GET /patients/me/pending-notes`. 수정 → `PATCH /patients/memos/{id}`
    - 승인 → `POST /patients/memos/{id}/approve`. 승인하면 본인 명의로 차트에 저장됩니다
    - 거부 → `DELETE /patients/memos/{id}` (추정)
- **근거:** [McpPendingContacts.vue](../../restored/components/mcp/McpPendingContacts.vue), [McpApprovalContactsTab.vue](../../restored/components/mcp/McpApprovalContactsTab.vue), [McpApprovalNotesTab.vue](../../restored/components/mcp/McpApprovalNotesTab.vue)

## 지출내역 수집 — `/setting/expense-collection` (`setting-expense-collection`)

- **목적:** 재무 원격 앱의 지출내역 수집 화면을 설정 안에 띄웁니다
- **접근 조건:** 라우트는 `permissionRequired: false`이지만 `SettingView`와 사이드바(`requiredPermission`)가 `finance_expense_collect`에 `canWrite$`가 있는지 봅니다
- **화면 구성:** `FinanceContainer initial-path="/expense-collection"`
  - `finance-prd` remoteEntry를 federation으로 로드해 마운트합니다
  - 토큰을 동기화(`ls:change`)하고 `update({ token, initialPath })`로 넘깁니다
- **데이터:** 원격 앱 코드가 번들에 없어서 API는 알 수 없습니다. 자세한 내용은 [analytics-and-remote-apps.md](analytics-and-remote-apps.md)를 보세요
- **근거:** [SettingExpenseCollectionView.vue](../../restored/views/SettingExpenseCollectionView.vue), [FinanceContainer.vue.js](../../restored/components/finance/FinanceContainer.vue.js), [FinanceContainer.helpers.js](../../restored/components/finance/FinanceContainer.helpers.js)

## 비대면 진료 정산 — `/remote-settlement` (`remote-settlement`)

- **목적:** 수 비대면 진료 결제 대금의 월별 정산 내역을 조회합니다
- **접근 조건:**
  - 라우트: `requiredRoleType` `01`. 가드는 다른 역할을 홈으로 보냅니다
  - localStorage `비대면진료등록여부`가 있어야 합니다 (`jHe`)
  - 사이드바: `soo` + 비대면 등록 (`R6`). 메뉴 항목에 붙은 `remote_settlement` 코드는 거르는 데 쓰이지 않습니다
  - 화면도 `역할타입 === "01"`을 다시 확인하고, 아니면 `AccessDeniedNotice`를 띄웁니다
- **화면 구성:** `RemoteSettlementContent` 아래 다음 컴포넌트가 있습니다
  - `RemoteSettlementDataHandler`: 연·월 선택, 엑셀 다운로드
  - `RemoteSettlementCostSummary`: 결제금액·결제 수수료·부가세·정산 금액·정산 예정 금액, 주문·취소 건수
  - `RemoteSettlementTableContent`: AG Grid 표 (주문 번호·처방·수량·결제금액·결제수수료·정산기준금액·주문/정산 상태·결제일)
  - `RemoteSettlementInfoContent`: 정산 기준 안내
- **데이터:** `GET thesooClient /settlement/upstream/settlements?year=&month=` → `data.data`
- **근거:** [RemoteSettlementView.vue](../../restored/views/RemoteSettlementView.vue), [RemoteSettlementTableContent.vue](../../restored/components/remote/RemoteSettlementTableContent.vue), [routes.js](../../restored/router/routes.js#L604)

## 미확인·추정

- **사이드바 권한 코드 불일치:** 설정 하위 메뉴의 `permissionCode`는 `normal_settings`, `info_settings`처럼 복수형입니다. 라우트 enum은 `normal_setting` 같은 단수형입니다. 사이드바는 하위 항목의 `permissionCode`로 거르지 않아서 동작에는 영향이 없습니다. 권한이 없는 메뉴도 보이고, 눌렀을 때 `SettingView`가 막습니다
- **`태블릿설정`(`tablet_settings`):** enum에만 있고 라우트나 사이드바 검사에는 쓰이지 않습니다. 개별 기능에서 쓰는지는 확인하지 않았습니다
- **`/setting` 자체로 들어갈 때:** 하위 라우트 redirect가 없어 빈 `RouterView`가 뜰 것으로 보입니다. 사이드바는 하위 메뉴로만 연결합니다 (추정)
- **처방별 상용구 API:** `treatment-phrase` 모듈(`X()`)이 `/settings/treatment-templates`를 호출한다고 봤습니다. 응답 키 `진료기록상용구`와 Main의 `진료기록상용구Id`가 근거입니다 (추정)
- **진찰료 및 청구 탭의 저장:** 개별 항목 저장이 `PATCH /settings/treatments/{id}` 한 곳으로 모이는지, 명세서 저장 위치를 서버에 저장하는지는 확인하지 않았습니다 (추정)
- **실손 연동 카드의 연동 후 모달(`open`):** 대상 컴포넌트를 확인하지 않았습니다
- **원격 앱 API:** 지출내역 수집과 재무 화면의 API는 원격 앱 코드가 없어서 알 수 없습니다
- **계정 이력:** 화면이 목업이고 이력을 조회하는 API가 없습니다. 실제 출시 여부는 알 수 없습니다
