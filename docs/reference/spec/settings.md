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
- **근거:** `re-upstream/restored/views/SettingView.vue.js`, `re-upstream/restored/router/routes.js:422`, `re-upstream/restored/modules/index/Group.js:323`, `re-upstream/restored/modules/index/part-74.js:76`, part-63.js (`Sct`) (`re-upstream/restored/lib/index/part-63.js`), `re-upstream/restored/lib/index/enabled.js`, part-60.js (`nc`) (`re-upstream/restored/modules/index/part-60.js`)

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
- **근거:** `re-upstream/restored/views/SettingCommonView.vue`, `re-upstream/restored/components/setting/SettingCommonViewClinicHoursConfig.vue`, `re-upstream/restored/components/setting/SettingCommonViewPatientSettings.vue`, `re-upstream/restored/components/setting/SettingCommonViewTreatmentListConfig.vue`, `re-upstream/restored/modules/index/Tab.js`

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
- **근거:** `re-upstream/restored/views/SettingTelemedicineView.vue`, `re-upstream/restored/components/setting/SettingCommonViewTelemedicineConfig.vue`, `re-upstream/restored/router/guards.js:69`, `re-upstream/restored/lib/index/part-41.js:54`

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
- **근거:** `re-upstream/restored/views/SettingServiceIntegrationView.vue.js`, `re-upstream/restored/api/integrations/sooSignUp.js`

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
- **근거:** `re-upstream/restored/views/SettingHospitalView.vue`, `re-upstream/restored/views/SettingHospitalView.helpers.js`, `re-upstream/restored/components/setting/SettingHospitalFieldBadge.vue.js`, `re-upstream/restored/components/setting/SettingHospitalJejuClaim.vue`, `re-upstream/restored/api/users/requests.js`

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
- **근거:** `re-upstream/restored/views/SettingTreatmentView.vue`, `re-upstream/restored/components/setting/SettingTreatmentViewExaminationClaim.vue.js:296`, `re-upstream/restored/components/setting/SettingTreatmentViewVitaTreatmentRoomsTreatmentRooms.vue`

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
- **근거:** `re-upstream/restored/views/SettingPrescriptionView.vue`, Tab.js (`Tab$_4`, `SubTab$`) (`re-upstream/restored/modules/index/Tab.js`), `re-upstream/restored/components/setting/SettingPrescriptionViewReservedMain.vue`, `re-upstream/restored/components/setting/SettingPrescriptionViewNonBenefitRegistrationPanel.vue`, `re-upstream/restored/components/setting/SettingPrescriptionViewPackageEditPanel.vue`, `re-upstream/restored/components/setting/SettingPrescriptionViewInsuranceMedicineCustomPrescription.vue`, `re-upstream/restored/components/setting/SettingPrescriptionViewChubyak.vue`, `re-upstream/restored/stores/settingHerb.js`

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
- **근거:** `re-upstream/restored/components/setting/SettingEditorTemplates.vue`, `re-upstream/restored/components/setting/SettingEditorTemplatesMain.vue`, `re-upstream/restored/components/setting/SettingEditorTemplatesSidebar.vue`

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
- **근거:** `re-upstream/restored/views/AccountPermissionsView.vue`, `re-upstream/restored/components/account/AccountPermissionsListDetail.vue`, `re-upstream/restored/components/account/AccountPermissionsTable.vue`

## 계정 이력 — `/setting/account-history` (`setting-account-history`)

- **목적:** 계정 권한 부여·로그인 기록·개인정보 접근·진료기록 수정 이력을 보여주는 화면입니다 (미완성)
- **접근 조건:** `permissionCode: ""`라서 `SettingView` 검사를 그냥 통과합니다. 사이드바 메뉴는 없고 URL로만 들어갈 수 있습니다
- **화면 구성:** 제목은 "계정 권한 설정"입니다. 탭은 `permission`, `login`, `access`, `record`입니다
- **동작:**
  - 표 3개(`AccountHistoryTable*`)는 하드코딩된 샘플 행을 5번 반복해 그립니다. API 호출은 없습니다
  - `record` 탭은 "디자인 작업 완료후 작업 예정" 텍스트만 보여줍니다
- **근거:** `re-upstream/restored/views/AccountHistoryView.vue`, `re-upstream/restored/views/AccountHistoryView.helpers.js`, `re-upstream/restored/components/account/AccountHistoryTableLoginLog.vue.js`

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
- **근거:** `re-upstream/restored/views/SettingTabletView.vue`, `re-upstream/restored/views/TabletAccountView.vue`, `re-upstream/restored/components/tablet/TabletAdminPinCard.vue`

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
- **근거:** `re-upstream/restored/views/SettingDocumentManagementView.vue`, `re-upstream/restored/components/setting/SettingTabletQuestionnaire.vue`, `re-upstream/restored/components/setting/SettingTabletConsent.vue`, `re-upstream/restored/components/setting/SettingTabletConsentEditor.vue`

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
- **근거:** `re-upstream/restored/views/CrmBillingView.vue`, `re-upstream/restored/components/billing/BillingPaySidePanel.vue`, `re-upstream/restored/components/insurance/InsurancePaymentMethodModal.vue`

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
- **근거:** `re-upstream/restored/components/m/MCPTokens.vue`, `re-upstream/restored/modules/index/Group.js:420`

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
- **근거:** `re-upstream/restored/components/mcp/McpPendingContacts.vue`, `re-upstream/restored/components/mcp/McpApprovalContactsTab.vue`, `re-upstream/restored/components/mcp/McpApprovalNotesTab.vue`

## 지출내역 수집 — `/setting/expense-collection` (`setting-expense-collection`)

- **목적:** 재무 원격 앱의 지출내역 수집 화면을 설정 안에 띄웁니다
- **접근 조건:** 라우트는 `permissionRequired: false`이지만 `SettingView`와 사이드바(`requiredPermission`)가 `finance_expense_collect`에 `canWrite$`가 있는지 봅니다
- **화면 구성:** `FinanceContainer initial-path="/expense-collection"`
  - `finance-prd` remoteEntry를 federation으로 로드해 마운트합니다
  - 토큰을 동기화(`ls:change`)하고 `update({ token, initialPath })`로 넘깁니다
- **데이터:** 원격 앱 코드가 번들에 없어서 API는 알 수 없습니다. 자세한 내용은 [analytics-and-remote-apps.md](analytics-and-remote-apps.md)를 보세요
- **근거:** `re-upstream/restored/views/SettingExpenseCollectionView.vue`, `re-upstream/restored/components/finance/FinanceContainer.vue.js`, `re-upstream/restored/components/finance/FinanceContainer.helpers.js`

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
- **근거:** `re-upstream/restored/views/RemoteSettlementView.vue`, `re-upstream/restored/components/remote/RemoteSettlementTableContent.vue`, `re-upstream/restored/router/routes.js:604`

## 레거시 차트(OK차트) 대비

이 절은 한메디 OK차트 매뉴얼을 근거로 정리했으며, 현행 Upstream 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무

- **병원 단위 운영 정책 토글:** OK차트의 한의원 환경설정은 환자 삭제 허용, 대기실·치료실 관리 사용, 접수실 사용자 권한 제한, 진료비 수납·현금영수증 승인 방식, 진료기록 관련 옵션을 병원 단위로 켜고 끕니다. 현행 기본 설정·진료 설정에는 환자 삭제 허용 여부나 수납·현금영수증 정책 같은 항목이 없습니다 ([OK차트: 한의원 환경설정](https://www.okmedi.net/Manual/?idx=799))
- **자보 첩약·탕전료 일투·일수 자동 지정:** 자동차보험 진료에서 한방 첩약과 탕전료를 기록하면 일투·일수를 자동으로 채우는 옵션입니다. 현행 진료 설정의 "첩약 기본 투여량"이 같은 역할을 하는지는 알 수 없습니다 (추정) ([OK차트: 한의원 환경설정](https://www.okmedi.net/Manual/?idx=799))
- **신환 차트번호 구분자·지역번호 자동 입력:** 새 환자를 등록할 때 차트번호 앞에 붙일 구분자를 고르고, 전화번호에 병원 지역번호를 자동으로 채웁니다. 현행에는 1씩 증가하는 추천 차트번호만 있습니다 ([OK차트: 한의원 환경설정](https://www.okmedi.net/Manual/?idx=799))
- **청구·DUR 환경:** 건강보험 EDI 기본 수신처(심평원 지원), 차등지수 적용 여부, 심평원 DUR 모듈 사용 여부를 병원 설정으로 둡니다. 현행 병원 정보에는 `청구대행단체`만 있고 수신처나 DUR 사용 여부가 없습니다. 수신처 매핑은 아래 업무 규칙에 적었습니다 ([OK차트: 한의원 환경설정](https://www.okmedi.net/Manual/?idx=799), [OK차트: OK차트 환경설정 저장](https://www.okmedi.net/Manual/?idx=1077))
- **개인정보보호 로그인 정책:** 환경설정의 "개인정보보호법 관련 설정"에서 다음을 정합니다 ([OK차트: 개인정보보호 자동 로그아웃](https://www.okmedi.net/Manual/?idx=847), [OK차트: 개인정보보호 비밀번호 잠김](https://www.okmedi.net/Manual/?idx=848), [OK차트: 개인정보보호법 적용 로그인 기능 안내](https://www.okmedi.net/Manual/?idx=691))
  - 일정 시간(60분) 넘게 쓰지 않으면 자동 로그아웃합니다. 현행 병원 정보의 "로그인 유지 시간"이 이에 해당하는지는 알 수 없습니다 (추정)
  - 비밀번호를 정한 횟수 이상 틀리면 계정을 잠급니다. 횟수를 0으로 두면 잠금을 쓰지 않습니다
  - 접수실 프로그램에도 사용자별 로그인과 비밀번호 규칙을 강제할지 고릅니다
  - 사용자가 자리를 비울 때 쓰는 수동 화면 잠금이 있습니다
- **잠긴 계정 복구 흐름:** 관리자 권한이 있는 한의사가 잠긴 사용자에게 임시 비밀번호를 지정하면, 그 사용자가 임시 비밀번호로 로그인한 뒤 규칙에 맞는 새 비밀번호로 바꿉니다. 유일한 관리자 계정이 잠기면 작업동의서를 받아 개발사가 초기화합니다. 관리자 외의 제3자에게 비밀번호 설정을 맡기면 개인정보보호법 위반이라고 안내합니다 ([OK차트: OK차트 사용자의 임시비밀번호 지정하기](https://www.okmedi.net/Manual/?idx=1124), [OK차트: 개인정보보호 비밀번호 잠김](https://www.okmedi.net/Manual/?idx=848))
- **진료한의사 속성:** 진료한의사 계정에 다음 값을 둡니다. 현행 계정 생성은 `근무형태`·`입사일자`를 받지만, 이 값이 차등수가 인정 인원이나 추나 급여 자격과 연결되는지는 스펙에 없습니다 ([OK차트: 진료한의사 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=336), [OK차트: 진료 한의사 관리](https://www.okmedi.net/Manual/?idx=410), [OK차트: 대진의 심평원에 신고 및 OK차트에 추가 방법 안내](https://www.okmedi.net/Manual/?idx=866))
  - 실명, 한의사 면허번호, 주민번호 앞자리
  - `관리자`: 경영관리(통계·설정)를 포함한 모든 기능을 씁니다. 해제하면 경영관리 메뉴가 숨겨집니다
  - 근무 형태: 상근(미체크)·대진의·비상근(격일제)·비상근(시간제)·기타. 차등수가 인원 산정에 쓰입니다 (아래 업무 규칙)
  - `추나급여`: 추나요법 급여 사전 교육을 이수하고 심평원에 인력 신고한 한의사만 체크합니다
  - `연동솔루션에 노출`: 외부 접수 앱 화면에 한의사 이름을 보일지 정합니다
  - `권한 제한`: 개별 기능을 막습니다
  - 대진의는 심평원 보건의료자원통합신고포털에 먼저 신고한 뒤 차트에 추가합니다
- **진료의 바로변경:** 여러 진료의가 함께 쓰는 치료실 PC에서, 로그인 사용자는 그대로 두고 진료기록의 진료의만 바꿔 기록합니다. 이때 경영관리·양식 출력·보험청구·통계 같은 기능은 관리자 권한을 공유하지 않고 가립니다. 반면 "다른 사용자로 로그인"은 비밀번호를 다시 받고 그 사용자의 권한을 모두 씁니다 ([OK차트: 진료의 바로변경](https://www.okmedi.net/Manual/?idx=912), [OK차트: 진료 한의사 관리](https://www.okmedi.net/Manual/?idx=410))
- **가감처방 등록:** 기준처방(보험 한약제제)을 고르고 약재를 더하거나 빼서 병원 전용 보험처방을 만듭니다. 현행 보험약 탭의 `from-mixture`가 가감처방에 해당하는지는 확인하지 못했습니다 (추정) ([OK차트: 가감, 임의처방 등록](https://www.okmedi.net/Manual/?idx=393))
- **한자 사전:** 상용구와 별도로 "한글 표기 → 한자" 추천 단어를 등록해 진료메모를 한자로 바꿉니다. 상용구와 함께 서버에 올리고 내려받습니다 ([OK차트: 상용구 등록·사용 및 서버에 저장](https://www.okmedi.net/Manual/?idx=400))
- **환자 관리정보 지정 항목 일괄 변경·삭제:** 주치의, VIP, 유입경로, 직업, 진행중치료, 예정된치료, 소개자관계는 병원이 정의한 선택지입니다 ([OK차트: 관리정보에서의 지정 항목 관리](https://www.okmedi.net/Manual/?idx=855), [OK차트: 주치의 지정 항목 관리](https://www.okmedi.net/Manual/?idx=1040), [OK차트: 관리정보 입력 항목 일괄 수정](https://www.okmedi.net/Manual/?idx=394))
  - 선택지 값을 바꾸면 그 값이 저장된 모든 환자의 관리정보가 함께 바뀝니다. 빈 값으로 바꾸면 삭제됩니다
  - 주치의는 대기실·치료실로 보낼 때 지정하는 담당의사와 연동됩니다
  - 환자 데이터와 묶여 있어 작업 전 백업을 권하고, 별도 암호로 화면을 보호합니다
  - 현행 기본 설정에는 내원 경로(사용/미사용)와 환자 등급만 있습니다. 직업·진행중치료·예정된치료 같은 항목과 값 일괄 치환은 없습니다
- **보험약·치료재료 입고/재고 관리:** ([OK차트: 보험처방, 치료재료 매입/재고 관리](https://www.okmedi.net/Manual/?idx=399))
  - 보험약 입고는 "며칠분" 단위로 기록합니다 (예: 300포 100일분이면 100)
  - 치료재료(일회용 부항컵·탄력붕대 등) 입고는 개수 단위이고, 제조원 제품별로 따로 관리합니다
  - 재고가 실제와 다르면 재고조정으로 맞춥니다. 실제 재고가 적으면 음수로 입력합니다
  - 매입사(거래처)를 등록해 둡니다
  - 진료기록에서 보험약이나 습식부항·이체부항을 고를 때 현재 재고를 보여주고, 사용 개수만큼 차감합니다
  - 현행 치료재료대 탭에는 구매 내역(`histories`)이 있지만, 보험약 재고나 진료기록 연동 차감은 스펙에 없습니다
- **치료재료 실구입가 기간 관리:** 상한가보다 싸게 산 치료재료는 제조사별 실구입단가를 적용 시작일·종료일과 함께 등록합니다. 재고를 다 쓰면 종료일을 넣고, 그 뒤로는 상한금액으로 자동 기록합니다. 같은 제품을 다른 단가로 다시 사면 기존 행을 종료하고 새 행을 추가합니다. 현행 구매 내역에 단가 적용 기간 개념이 있는지는 확인하지 못했습니다 (추정) ([OK차트: 치료재료 실구입가 관리](https://www.okmedi.net/Manual/?idx=412))
- **금전출납부 계정과목:** 수입·지출 계정과목을 병원이 정의하고, 일자별로 계정과목·금액·거래처를 기록합니다. 수납 데이터에서 현금분만, 또는 현금+카드분(환불 포함)을 불러와 수입으로 넣을 수 있습니다. 현행 재무 원격 앱의 지출내역 수집과 겹칠 수 있습니다 (추정). 통계는 [analytics-and-remote-apps.md](analytics-and-remote-apps.md)의 같은 절에 적었습니다 ([OK차트: 금전출납부 기록 및 통계](https://www.okmedi.net/Manual/?idx=395))
- **화면 배치 저장:** PC(원장실·접수실)마다 첫 화면의 대기실·치료실·치료완료·수납현황 목록 배치와 표시 항목, 진료차트와 진료내역의 컬럼 순서·폭·숨김을 저장하고 초기화합니다. 기록 시각 컬럼을 켜면 차트 출력에도 기록 시각이 찍힙니다. 재설계에서는 사용자별 또는 기기별 UI 설정 저장소가 필요할 수 있습니다 (추정) ([OK차트: 화면 배치저장 활용](https://www.okmedi.net/Manual/?idx=339))
- **진료의별 메모장:** 진료의 개인 메모 문서를 만들어 둡니다 ([OK차트: 진료 한의사 관리](https://www.okmedi.net/Manual/?idx=410))

### 업무 규칙

- **비밀번호 규칙:** 영문·숫자를 섞어 10자 이상입니다. 같은 문자나 연속 문자를 4번 이상 쓸 수 없고, 같은 비밀번호를 6개월 넘게 쓸 수 없습니다. 오입력 잠금은 5회를 권장합니다. 자동 로그아웃(60분 미사용)과 잠금은 개인정보보호 자율점검 3.2.9·3.2.8 항목에 대응합니다 ([OK차트: 진료한의사 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=336), [OK차트: 개인정보보호 자동 로그아웃](https://www.okmedi.net/Manual/?idx=847), [OK차트: 개인정보보호 비밀번호 잠김](https://www.okmedi.net/Manual/?idx=848))
- **근무 형태별 차등수가 인정 인원:** 매뉴얼 기준입니다 ([OK차트: 진료한의사 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=336), [OK차트: 진료 한의사 관리](https://www.okmedi.net/Manual/?idx=410), [OK차트: (용어) - 차등수가제 : 차등지수](https://www.okmedi.net/Manual/?idx=746))

  | 근무 형태 | 조건 | 인정 인원 |
  |---|---|---|
  | 상근 | 주 5일, 주 40시간 이상, 3개월 이상 고용계약 | 1인 |
  | 대진의 | 상근의(휴가자)를 대신해 근무 | 1인 |
  | 비상근(격일제) | 주 3일 종일 근무 | 0.5인 |
  | 비상근(시간제) | 오전 또는 오후만 근무, 주 20시간 이상 (주 3일인지 주 5일인지는 항목마다 다름) | 0.5인 |
  | 기타 | 주 20시간 미만, 후입사 기관 근무 | 0 (청구 시 차등 진료일수에서 자동 제외) |

  - 매뉴얼 안에서 비상근 기준이 엇갈립니다. 한 항목은 "주 3일 종일·주 20시간 이상 비상근"을 1인으로, 다른 두 항목은 같은 조건을 0.5인으로 적었습니다. 실제 기준은 심평원 고시로 확인해야 합니다
- **임의처방 범위와 단가:** ([OK차트: 가감, 임의처방 등록](https://www.okmedi.net/Manual/?idx=393))
  - 구성 약제는 종료일이 없는(현재 유효한) 한약제제만 고릅니다. EX산제량에는 1일 총 투여량을 넣습니다
  - 1일 15종, 50g 이내이고 총 투약가는 3,000원까지입니다. 현행 스펙의 임의처방 검증 규칙과 같습니다
  - 수가가 바뀌면 기존 처방을 고치지 않고 다른 이름으로 새로 등록합니다
  - 1일 약가 = Σ(약제 단위가격 × 1일 투여량)이고, 원 미만은 사사오입합니다. 예: 작약 7.41×67 = 496.47, 감초 3.7×60 = 222, 합계 718.47 → 718원
  - 단미엑스산제를 나눠 투여하면 1일 투여량은 소수 셋째 자리에서 사사오입하고, 총 투여일수는 실제 투여일수로 적습니다
  - 금액 = 1일 약가(또는 상한금액표 단위가격) × 1일 투여량 × 투여일수
- **가감처방 범위:** 기준처방에 1일 5종, 10g 이내로 더하거나 뺄 수 있습니다 ([OK차트: 가감, 임의처방 등록](https://www.okmedi.net/Manual/?idx=393))
- **묶음처방 유지:** 보험수가는 해마다 바뀌므로 연도가 바뀌면 묶음처방을 다시 구성해야 의도한 본인부담금이 나옵니다. 심평원은 세트 기록을 지양하라고 안내합니다 ([OK차트: 묶음처방 등록 활용 & 관리하기](https://www.okmedi.net/Manual/?idx=398))
- **치료재료 제출과 단가:** 일회용 부항컵은 살 때마다 요양기관 업무포털에 구입내역을 제출해야 합니다. 실구입가 입력은 상한가 이하로 샀을 때만 합니다. 상한가 제한 시행일 이후에는 변경된 단가까지만 인정되므로, 이전 재고는 환불 후 재구매하는 방법도 안내합니다 ([OK차트: 치료재료 실구입가 관리](https://www.okmedi.net/Manual/?idx=412))
- **한방물리요법 산정:** 매뉴얼 기준입니다 ([OK차트: 한방물리요법 관리](https://www.okmedi.net/Manual/?idx=809), [OK차트: 우리 한의원의 물리요법 산정횟수와 월평균 시술현황](https://www.okmedi.net/Manual/?idx=731))
  - 급여 항목은 경피경근온열(핫팩 등)·경피적외선조사(IR)·경피경근한냉(냉팩) 3가지입니다. 나머지 한방물리요법은 비급여입니다
  - 한의사가 실시하고 결과를 진료기록부에 적어야 산정합니다
  - 하루 2회 이상 해도 외래는 1일 1회, 입원은 1일 2회만 산정합니다. 3가지를 동시에 해도 1가지만 산정합니다
  - 상근 한의사 1인당 실시 인원은 월평균(또는 주평균) 1일 30명까지 인정하고, 의료급여 환자를 포함합니다. 주 3일 이상·주 20시간 이상의 시간제·격일제는 0.5인으로 보아 15명입니다
  - 월(주)평균 실시 인원 = 기간 내 한방물리요법 총 청구건수 ÷ 기간 내 한의사 근무일수. 하루 환자 수 자체를 제한하는 규정은 아닙니다
  - OK차트는 당일 산정 횟수가 30회에 이르면 그 뒤로 알림을 반복해 띄웁니다. 자보·산재 환자는 횟수에서 뺍니다
- **건강보험 EDI 기본 수신처(심평원 지원) 매핑:** 매뉴얼 기준입니다 ([OK차트: 한의원 환경설정](https://www.okmedi.net/Manual/?idx=799), [OK차트: OK차트 환경설정 저장](https://www.okmedi.net/Manual/?idx=1077))

  | 수신처 | 관할 |
  |---|---|
  | 서울본부 | 서울시 |
  | 부산제주본부 | 부산시, 제주도 |
  | 대구경북본부 | 대구시, 경상북도 |
  | 광주전남본부 | 광주시, 전라남도 |
  | 대전충청본부 | 대전시, 충청북도, 충청남도, 세종시 |
  | 경기남부본부 | 수원·성남·안양·부천·광명·평택·안산·과천·오산·시흥·군포·의왕·하남·용인·이천·안성·김포·화성·광주·여주시, 양평군 |
  | 울산경남본부 | 울산시, 경상남도 |
  | 경기북부강원본부 | 의정부·동두천·고양·구리·남양주·파주·양주·포천시, 연천군, 가평군, 강원도 |
  | 전북본부 | 전라북도 |
  | 인천본부 | 인천시 |

- **백업 정책:** 「전자의무기록의 관리·보존에 필요한 시설과 장비에 관한 기준」(보건복지부 고시, 매뉴얼은 2016-08-06 시행본과 2021-01-05 개정본을 인용)과 의료법 시행규칙 제16조를 근거로 듭니다 ([OK차트: OK차트 백업 경로 설정하기](https://www.okmedi.net/Manual/?idx=1045), [OK차트: OK관리툴에서 데이터 백업 관리](https://www.okmedi.net/Manual/?idx=827), [OK차트: 전자의무기록의 관리·보존에 필요한 시설과 장비에 관한 기준](https://www.okmedi.net/Manual/?idx=1102))
  - 백업 장비로 USB·외장하드·NAS·자기테이프, DR 센터, 클라우드 스토리지를 쓸 수 있습니다. 개인용 클라우드(네이버 MYBOX, OneDrive, iCloud 등)는 인정되지 않고, 클라우드는 보안인증을 받은 사업자여야 합니다
  - 같은 PC의 별도 디스크나 늘 꽂혀 있는 USB는 독립된 백업 장치로 보지 않습니다
  - 백업 주기(일·주·월)는 기관이 정하고, 개인정보보호법 제29조의 내부관리계획에 반영해야 합니다
  - 백업 장치는 잠금장치가 있는 곳에 보관합니다. 기관 출입문 잠금만으로는 부족합니다
  - 진료기록을 추가 기재·수정하면 원본도 모두 보존해야 하고, 원본 대조는 날짜별 백업본으로 합니다. 시행규칙 제16조 제2항은 추가 기재·수정 시 접속 기록을 따로 보관하라고 정합니다
  - OK차트는 매번 개원일부터의 전체 데이터를 누적 백업하고, 1차·2차(외부 장치 또는 클라우드 동기화 폴더) 두 경로와 예약 백업 스케줄을 둡니다. 백업 파일은 지우지 않고 보관합니다. 랜섬웨어를 피하려고 백업 파일 확장자를 바꿔 저장합니다. 백업이 안 되고 있으면 종료 시 경고를 띄웁니다
- **제증명수수료:** 「의료기관의 제증명수수료 항목 및 금액에 관한 기준」(보건복지부 고시 제2017-166호)을 따릅니다. 2017-09-21부터 시행했고, 인터넷 홈페이지 고지 의무는 2017-10-21부터입니다. 매뉴얼 본문에 항목별 금액은 없습니다(이미지). 현행 스펙에는 서식별 수수료 설정이 보이지 않아, 재설계 때 서식 발급 수수료 상한을 둘지 정해야 합니다 (추정) ([OK차트: 제증명수수료 항목 및 금액에 관한 기준](https://www.okmedi.net/Manual/?idx=825))

### 현행과 다른 점

- **설정 저장 위치:** OK차트는 원장실·접수실 프로그램마다 환경설정·복용관리설정·SMS설정을 따로 저장하고, 화면 배치도 PC별로 저장합니다. 병원 공통 정책은 "한의원 환경설정"에 모읍니다. 현행은 설정을 서버 API(`/settings/*`)로 병원 단위로 저장합니다 ([OK차트: 원장실 및 접수실 프로그램 환경설정](https://www.okmedi.net/Manual/?idx=337), [OK차트: 화면 배치저장 활용](https://www.okmedi.net/Manual/?idx=339))
- **권한 모델:** OK차트는 사용자 종류(진료한의사 / 접수실 사용자)와 `관리자` 플래그, 기능별 `권한 제한` 체크로 권한을 나눕니다. 현행은 역할 타입과 권한 트리(`/permissions`)를 씁니다 ([OK차트: 진료한의사 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=336), [OK차트: 접수실프로그램 사용자 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=1130))
- **퇴사 처리:** OK차트는 계정을 지우지 않고 `퇴사`를 체크해 남깁니다. 현행은 비활성화(시작일 지정)와 완전 삭제를 둘 다 둡니다. 진료기록의 진료의 실명 보존을 생각하면 삭제보다 비활성화가 맞습니다 (추정) ([OK차트: 진료한의사 추가 및 퇴사 관리](https://www.okmedi.net/Manual/?idx=336))
- **묶음처방 ↔ 약속처방:** OK차트 묶음처방은 기존 진료내역 하루치를 오른쪽 클릭으로 그대로 저장하는 방식입니다. 범위는 보험진료만 / 보험+일반 / 일반만 중에서 고릅니다. 이름 기준 숫자순·가나다순으로 정렬하고, 일괄 삭제 위험 때문에 한 개씩만 지웁니다. 현행 약속처방은 그룹·정렬 순서·사용 범위(개인/모든 진료의)를 두고 진료기록·상병·처방을 직접 구성합니다 ([OK차트: 묶음처방 등록 활용 & 관리하기](https://www.okmedi.net/Manual/?idx=398))
- **상용구:** OK차트 상용구는 메모에서 문구를 끌어 선택하고 단축키로 이름을 붙여 등록하고, 이름을 치고 단축키를 누르면 바뀝니다. PC 로컬 파일에 저장되고 다른 PC와는 "서버에 저장 / 서버에서 내려받기"로 수동으로 맞춥니다. 범위 구분은 없습니다. 현행은 서버에 저장하고 범위(전역·서식·처방별)를 나눕니다 ([OK차트: 상용구 등록·사용 및 서버에 저장](https://www.okmedi.net/Manual/?idx=400))
- **도장 이미지:** OK차트는 한의원 도장과 진료의 도장을 출력 양식 환경설정에서 추가하고, "도장 이미지 출력" 옵션으로 진단서·진료비계산서 등에 찍을지 정합니다. 배경 제거는 사용자가 외부 도구로 합니다. 전자서명 사용 여부와는 별개입니다. 현행은 병원 대표자 도장과 진료의 계정 도장을 업로드하면 배경을 자동으로 지우고, 출력 여부 옵션은 스펙에 없습니다 ([OK차트: 도장 이미지 추가 및 사용](https://www.okmedi.net/Manual/?idx=397))
- **유입경로:** OK차트 유입경로는 관리정보 지정 항목 중 하나라서, 값을 바꾸면 기존 환자 기록까지 일괄로 바뀝니다. 현행 내원 경로는 사용/미사용으로 나눠 관리하고, 수정이 기존 환자에게 어떻게 반영되는지는 스펙에 없습니다 ([OK차트: 주치의 지정 항목 관리](https://www.okmedi.net/Manual/?idx=1040))

## 미확인·추정

- **사이드바 권한 코드 불일치:** 설정 하위 메뉴의 `permissionCode`는 `normal_settings`, `info_settings`처럼 복수형입니다. 라우트 enum은 `normal_setting` 같은 단수형입니다. 사이드바는 하위 항목의 `permissionCode`로 거르지 않아서 동작에는 영향이 없습니다. 권한이 없는 메뉴도 보이고, 눌렀을 때 `SettingView`가 막습니다
- **`태블릿설정`(`tablet_settings`):** enum에만 있고 라우트나 사이드바 검사에는 쓰이지 않습니다. 개별 기능에서 쓰는지는 확인하지 않았습니다
- **`/setting` 자체로 들어갈 때:** 하위 라우트 redirect가 없어 빈 `RouterView`가 뜰 것으로 보입니다. 사이드바는 하위 메뉴로만 연결합니다 (추정)
- **처방별 상용구 API:** `treatment-phrase` 모듈(`X()`)이 `/settings/treatment-templates`를 호출한다고 봤습니다. 응답 키 `진료기록상용구`와 Main의 `진료기록상용구Id`가 근거입니다 (추정)
- **진찰료 및 청구 탭의 저장:** 개별 항목 저장이 `PATCH /settings/treatments/{id}` 한 곳으로 모이는지, 명세서 저장 위치를 서버에 저장하는지는 확인하지 않았습니다 (추정)
- **실손 연동 카드의 연동 후 모달(`open`):** 대상 컴포넌트를 확인하지 않았습니다
- **원격 앱 API:** 지출내역 수집과 재무 화면의 API는 원격 앱 코드가 없어서 알 수 없습니다
- **계정 이력:** 화면이 목업이고 이력을 조회하는 API가 없습니다. 실제 출시 여부는 알 수 없습니다
