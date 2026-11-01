# 탕전·OCS

진료에서 나온 한약(첩약) 처방을 탕전 단계로 넘겨 조제·수령·복용 완료까지 관리하는 영역입니다. 화면은 세 갈래입니다. 하나는 진료 처방을 그대로 따라가는 구형 **탕전관리**(`/ocs`), 다른 하나는 처방을 직접 작성·수정하는 신형 **탕전 처방**(`/ocs/prescription/*`), 마지막은 외부 원외탕전에 주문·결제하는 **메디원탕**(`/ocs-v2-herb-order-*`)입니다.
세 화면 모두 처방전 발급(`HerbalPrescriptionIssue*`)과 약재 편집기(`HerbTableEditor`)를 함께 씁니다.

## 접근 구조 (공통)

- **권한 코드:** `/ocs`·`/ocs/prescription/*` → `탕전관리`(`ocs`), `/ocs-v2-herb-order-*` → `메디원탕`(`medi_ocs`). 모든 라우트가 `requiresAuth`, `permissionRequired`, `usesGlobalLayout`입니다
- **화면 안 권한 확인:** 각 뷰는 `l0e()`의 `isPermissionPending`/`hasPageAccess`를 보고 로딩 → 본문 → "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."(`AccessDeniedNotice`) 순으로 분기합니다
- **신형·구형은 서로 배타적입니다** (`re-upstream/restored/router/guards.js`). 가드가 `vne(accessToken)`으로 받은 `요양기관기호`를 하드코딩 목록 판정 `epe()`(`re-upstream/restored/lib/index/part-63.js`)에 넣습니다
  - 목록에 없는 기관이 `tangjeon-prescription-list`/`create`(`GQt`)로 오면 `ocs`로 보냅니다
  - 목록에 든 기관이 `ocs`로 오면 `tangjeon-prescription-list`로 보냅니다
  - 사이드바도 같은 판정을 씁니다. id 50 "탕전관리" 항목의 `href`가 `/ocs` 대신 `/ocs/prescription/list`(`_ct`)로 바뀝니다 (`re-upstream/restored/modules/index/part-74.js`, `re-upstream/restored/modules/index/Group.js`)
  - 같은 판정을 컴포저블로 감싼 것이 `use탕전관리v2활성`이고, 진료 화면의 탭 노출에 쓰입니다 (`re-upstream/restored/composables/use탕전관리v2활성.js`)
- **서비스 연동:** 서비스 연동 조건을 못 채운 계정이 `ocs`로 오면 기본 홈으로 보냅니다 (`WQt`, [access-control.md](../access-control.md))
- **사이드바:** id 55 "메디원탕"(아이콘 `원외탕전`)의 하위 메뉴는 "처방전 작성"(`/ocs-v2-herb-order-create`)과 "처방내역"(`/ocs-v2-herb-order-list`)입니다
- **헤더 제목:** `/ocs` 헤더는 조건(`Yu() || gHe()`)에 따라 "탕전현황" 또는 "탕전관리"로 보입니다. 조건의 뜻은 확인하지 못했습니다

## 탕전관리 (구형) — `/ocs`

- **목적:** 진료에서 생긴 OCS 처방 행을 날짜 범위로 모아 보고, 처방 입력·진행상태·수령 방법·수령일·복용 종료일·복용 완료를 행 안에서 바로 고칩니다
- **접근 조건:** `meta.permissionCode = 탕전관리`. `epe()` 목록에 **없는** 기관만 들어옵니다
- **화면 구성:**
  - `OcsView` → `OcsViewContent`
    - `OcsViewHeader`: 제목, 기간 선택 (기본 최근 1개월~오늘, 최대 오늘)
    - `MetricTab`: 통계 탭
    - `OcsViewList`: 필터와 `OcsViewListTable`(AG Grid, 30건씩 무한 스크롤)
  - 행 셀: `OcsViewListTablePrescriptionCell`, `OcsViewListTableDispensingStatusCell`, `OcsViewListTableReceiveTypeCell`(+`OcsViewListTableReceiveTypeDelivery`), `OcsViewListTableActionsCell`, `OcsViewListTableOrderNameCell`, `OcsViewListTableDetailRow`(약재 목록)
  - 처방 입력: `OcsViewListTablePrescriptionSidePanel` → `OcsViewPrescriptionPanel`
    - 왼쪽: `OcsViewPrescriptionHistoryList`(지난 처방 이력), `OcsViewPrescriptionOcsDictionary`(방제 사전)
    - 가운데: `HerbTableEditor` 또는 `OcsViewPrescriptionHerbsList`
    - 오른쪽: `OcsViewPrescriptionBasicInfo`
- **동작:**
  - **통계 탭:** 전체 / 처방 입력 필요 / 수령 방법 입력 필요 / 복용 완료 처리 필요 (`total`, `no_prescription`, `no_delivery_method`, `not_completed`). 탭을 고르면 목록 `status`에 그 키가 들어갑니다
  - **필터:**
    - 환자명 검색 (`search_keyword`)
    - 구분: 전체/일반/급여/자보/첩건 (`insurance_type`)
    - 수령: 전체/택배/퀵/직접 수령 (`receive_type` = `택배배송`/`퀵`/`직접수령`)
    - 진료의 (`doctor_ids`, 쉼표로 이음)
    - 환자명 열 정렬 (`sort_key=name`, 기본은 `date desc`)
  - **처방 입력/수정:**
    - "처방 입력" 또는 처방명 버튼을 누르면 사이드패널이 열리고, 상세를 `GET /ocs/{ocsId}`로 받습니다
    - 패널에서는 지난 처방이나 방제 사전을 더블클릭해 불러올 수 있습니다. 불러오면 현재차수가 +1 됩니다
    - 완료하면 `PATCH /ocs/{ocsId}`를 보냅니다 (`탕전타입`, `처방명`, `조제상태`, `현재차수`, `전체차수`, `일수`, `첩`, `팩`, `용량`, `메모`, `약재목록[]`의 `ocs처방약재Id`, `한약재품목명`, `원방용량`, `처방용량`, `가감량`, `단위`, `후하`, `action`)
    - 편집할 수 없는 경우: 복용 완료된 행, 그리고 카테고리가 한약·탕전료·첩약·자보/산재 첩약·조제료(`wt()`)가 아닌 행은 "패키지·기타 항목 처방은 탕전관리에서 입력·수정할 수 없습니다."로 막힙니다
    - 첩수·투약일수가 비어 있으면 완료가 막힙니다 (`ocsDosage.g`)
    - 저장 결과가 404(`AE_TARGET_NOT_FOUND` 또는 "ocs처방 데이터중…없습니다")이면 같은 진료·오더명·차수의 새 `ocsId`를 `GET /ocs/list`(당일, limit 200)에서 찾아 한 번 다시 저장합니다
  - **처방전 발급:** 환자가 있는 한약 카테고리(`ao()`)에서만 `HerbalPrescriptionIssueButton`이 보입니다. 누르면 먼저 저장하고 `HerbalPrescriptionIssuePanel`을 엽니다
  - **진행상태:**
    - 고를 수 있는 값은 `조제전`/`조제중`/`조제완료`입니다. 선택하면 `PATCH /ocs/{ocsId}`로 `{조제상태}`를 보내고, 실패하면 이전 값으로 되돌립니다
    - `조제상태수정가능 === false`이면서 `메디원탕주문Id`가 있는 행은 배지만 보이고 툴팁 "메디원탕 주문 상태를 따라갑니다"가 붙습니다
  - **수령 방법:**
    - 팝오버에서 직접 수령(수령 예정일), 택배, 퀵(배송 주소) 중 하나를 고릅니다. 주소 목록은 `GET /desk/addresses/{환자Id}`로 받고, 기본값은 대표주소입니다
    - 주소는 그 자리에서 등록·수정·삭제할 수 있습니다 (`POST`/`PATCH /desk/addresses/{환자Id}`, `POST /desk/addresses/delete/{환자Id}`)
    - 저장은 `PATCH /ocs/{ocsId}/delivery`입니다. 택배 → `주소Id`/`주소`/`상세주소`, 퀵 → 주소 + `수령일`, 직접 → `수령일`
    - 저장에 성공하고 상태 수정이 가능하면 `조제상태: 조제완료`도 이어서 PATCH합니다
  - **수령일/복용 종료일 셀:** `PATCH /ocs/{ocsId}/delivery`로 보냅니다. 수령일을 바꾸면 `복용종료일 = 수령일 + 일수`를 같이 보냅니다. 오늘보다 지난 복용 종료일은 빨간색입니다
  - **복용 완료/취소:**
    - 처방명·수령방법·수령일·복용종료일이 모두 있고 미완료인 행에만 "복용 완료" 버튼이 보입니다
    - 누르면 `PATCH /ocs/{ocsId}/taking`으로 `{복용완료: true|false}`를 보냅니다
- **데이터:**
  - `GET /ocs/list`
    - 요청: `offset`, `limit`, `start_date`, `end_date`, `sort_key`, `sort_order`, `search_keyword`, `status`, `doctor_ids`, `receive_type`, `insurance_type`
    - 응답 `ocsLists[]`: `ocsId`, `frontId`, `진료Id`, `환자Id`, `진료일자`, `환자명`, `보험구분`, `진료의Id`, `오더명`, `처방명`, `조제상태`, `조제상태수정가능`, `메디원탕주문Id`, `패키지처방정보{유형,사용횟수,총횟수}`, `현재차수`/`전체차수`, `일수`/`첩`/`팩`/`용량`, `탕전타입`, `수령방법`, `수령일`, `복용종료일`, `복용완료`, `카테고리숫자코드`
  - `GET /ocs/list/stats` (`start_date`, `end_date`)
  - `GET /ocs/dictionaries` (`limit`, `offset`), `GET /ocs/dictionaries/categories`
  - `GET {SETTINGS_REFERENCE_FORMULAS_PATH}/search`: 개인 방제
- **상태 저장:**
  - TanStack 쿼리 키 `ocsKeys` (`["ocs", "list"|"infiniteList"|"stats"|"detail"|"dictionary"|"category", …]`)
  - `usePatchOcsMutation`은 성공 시 상세·목록·통계와 환자 일반한약처방 목록·상세를 무효화합니다. delivery 뮤테이션은 상세·목록만, taking 뮤테이션은 상세·목록·통계를 무효화합니다
- **근거:** `re-upstream/restored/views/OcsView.vue`, `re-upstream/restored/components/ocs/OcsViewContent.vue`, `re-upstream/restored/components/ocs/OcsViewList.vue`, `re-upstream/restored/components/ocs/OcsViewListTable.vue`, `re-upstream/restored/components/ocs/OcsViewListTableReceiveTypeCell.vue`, `re-upstream/restored/components/ocs/OcsViewListTablePrescriptionSidePanel.vue`, `re-upstream/restored/components/ocs/OcsViewPrescriptionPanel.vue`, `re-upstream/restored/api/ocs/requests.js`, `re-upstream/restored/modules/mutations/usePatchOcsMutation.js`, `re-upstream/restored/api/ocs/query-keys.js`

## 탕전 처방 목록 (신형) — `/ocs/prescription/list`

- **목적:** 탕전 처방(진료 연동 또는 직접 작성)을 조제상태별로 관리합니다. 아직 탕전 처방으로 만들지 않은 진료 처방(미등록)과 처방전 발급 이력도 여기서 봅니다
- **접근 조건:** `meta.permissionCode = 탕전관리`. `epe()` 목록에 **든** 기관만 들어옵니다
- **화면 구성:**
  - `TangjeonPrescriptionListView` → `TangjeonPrescriptionListContent`
  - `TangjeonListHeader`
    - 제목 "처방내역"과 기간 선택
    - "처방 작성" 버튼
    - 상단 탭: `탕전 이력` / `탕전 문서 발급 이력`
  - `TangjeonListStatusTabs`: 전체·조제 전·조제 중·조제 완료·취소 탭과 별도의 "미등록" 탭
  - 탕전 이력: `TangjeonListFilters`(환자·환자 미지정·검색어·보험구분·탕전실·진료의), `TangjeonListTable`
  - 셀:
    - `TangjeonListStatusCell`, `TangjeonListDeliveryCell`, `TangjeonListQuantityCell`, `TangjeonListMemoCell`, `TangjeonListActionsCell`
    - `TangjeonListPatientCell`, `TangjeonListPrescriptionNameCell`, `TangjeonListTreatmentDateCell`
  - 미등록: `TangjeonUnregisteredFilters`, `TangjeonUnregisteredTable`
  - 문서발급이력: `TangjeonDocumentLedgerFilters`, `TangjeonDocumentLedgerTable`(+`TangjeonDocumentLedgerReprintCell`)
  - 오른쪽 상세(480px): `TangjeonListSidePanel`
    - 내용: 환자·처방 정보·탕전 약재·청구 대비·수령 정보·메모
    - 하위 패널: `TangjeonPrescriptionHistory`(변경 이력), `TangjeonPrescriptionIssueHistory`(발급 이력)
  - 오버레이: `TangjeonListCreatePanel`(작성 사이드패널), `TangjeonPrescriptionIssuePanels`, `TangjeonOcsV2OrderModal`
- **동작:**
  - **화면 전환:** 라우트 쿼리 `tab`으로 정합니다. 없으면 탕전이력, `미등록`이면 미등록, `발급이력`이면 문서발급이력입니다. `?처방Id=`가 있으면 그 처방 상세를 엽니다. `?환자Id=`는 환자 필터 초기값입니다
  - **액션 메뉴:** 처방 상태에 따라 항목이 달라집니다 (`처방작성변환.k`)
    - `수정`: 메디원탕 처방이 아니면
    - `복사해서 새 처방`: 항상
    - `처방전 발급`: 취소가 아니면
    - `메디원탕 주문하기`: 메디원탕 계약 완료 + 비급여(54) + 환자 있음 + 취소 아님 + 메디원탕 처방 아님
    - `메디원탕 주문 보기`: 메디원탕 처방이고 주문Id가 있으면
    - `복용 완료`/`복용 취소`: 메디원탕이 아니고 취소가 아니면. 복용 완료는 처방명·수령방법·수령일·복용종료일이 모두 있어야 보입니다
    - `처방 취소`: 상태 수정이 가능하고 `임시저장`/`조제전`/`조제중`일 때
    - `삭제`: 메디원탕 처방이 아니면
  - **메디원탕 처방 판정:** `생성경로 === "메디원탕"`이거나 `메디원탕주문Id`가 있으면 메디원탕 처방입니다 (`Krn`)
  - **각 액션의 API:**
    - 복용 완료/취소: `PUT /tangjeon/prescriptions/{id}`, `{복용완료}`
    - 처방 취소: 확인 대화상자("취소한 처방은 조제 대상에서 빠집니다…") 후 `PATCH /tangjeon/prescriptions/{id}/status`, `{조제상태:"취소"}`
    - 삭제: 확인("삭제한 처방은 복구할 수 없습니다…") 후 `DELETE /tangjeon/prescriptions/{id}`
    - 수정·복사·다시불러오기: `use처방작성진입`의 진입값(`id`, `copyFrom`, `reload`)으로 작성 패널을 엽니다
  - **조제상태 셀:** 조제전/조제중/조제완료 중에서 `PATCH …/{id}/status`로 바꿉니다. 취소된 처방과 메디원탕 처방은 고칠 수 없습니다
  - **수령 셀:**
    - `PATCH /tangjeon/prescriptions/{id}/delivery`로 `수령방법`/`수령일`/`주소Id`를 보냅니다. 이어서 `PUT`으로 복용 종료일을 계산해 넣습니다 (추정)
    - 환자 미지정 처방은 배송 주소를 등록할 수 없습니다
  - **수량 셀:** `PATCH …/{id}/quantity`로 `일수`/`첩`/`팩`/`용량`/`일투팩수`를 보냅니다. 저장 후 "용량이 바뀌었습니다. 수령일을 다시 확인해 주세요." 안내가 뜰 수 있습니다
  - **메모 셀:** `PUT …/{id}`로 `{메모}`를 보냅니다. 입력란 안내 문구는 "탕전실·원무에 전달할 내용"입니다
  - **미등록 탭:** "작성"을 누르면 `환자Id`·`진료처방Id`·`진료의Id`를 실어 작성 패널을 엽니다
  - **청구 대비:** 상세 패널은 탕전 약재와 청구(진료 처방) 약재를 비교해 `동일`/`없음`(청구에 없음)/`용량다름`/`청구에만`을 표시합니다. 청구 약재는 `GET /tangjeon/treatment-prescriptions/{진료처방Id}/draft`로 받습니다 (`처방작성변환.B`)
  - **메디원탕 주문 보기:** `/ocs-v2-herb-order-list?draftId=…`를 새 탭으로 엽니다. 창에 다시 포커스가 오면 `tangjeonKeys.prescriptions()`를 무효화합니다 (`use메디원탕주문보기`)
- **데이터:**
  - `GET /tangjeon/prescriptions`
    - 요청: `시작일`, `종료일`, `환자Id`(미지정이면 `""`), `진료의Id`, `생성경로`, `보험구분`(`일반`/`건보`/`자보`/`산재`), `탕전실Id`, `조제상태`, `search_keyword`, `page`, `limit`
    - 응답 `목록[]`, `total`, `page`
  - 응답 필드 (`p()`로 변환):
    - 식별·연결: `탕전처방Id`, `진료Id`, `진료처방Id`, `ocs처방Id`, `원진료삭제됨`, `원진료처방삭제됨`, `메디원탕주문Id`
    - 처방: `처방명`, `처방일`, `생성경로`(`진료연동`/`직접작성`/`메디원탕`), `보험구분`, `탕전실Id`, `기준일자`, `조제상태`, `조제상태수정가능`, `약재[]`
    - 수량: `일수`, `첩`, `팩`, `일투팩수`, `용량`, `현재차수`, `전체차수`
    - 수령·복용: `수령방법`, `수령일`, `주소Id`, `해피콜일정`, `복용종료일`, `복용완료`, `취소일시`, `패키지차감Ids`
  - `GET /tangjeon/prescriptions/stats`: `전체`, `미지정`, `임시저장`, `조제전`, `조제중`, `조제완료`, `취소`
  - `GET /tangjeon/prescriptions/{id}`, `…/{id}/histories`(`항목`, `이전값`, `다음값`, `변경출처`, `변경자명`), `…/{id}/prescription-documents`(`문서Id`, `연번호`, `출력일시`, `출력자명`)
  - `GET /tangjeon/treatment-prescriptions/unregistered`: `시작일`, `종료일`, `보험구분`, `진료의Id`, `search_keyword`, `page`, `limit`. 응답 항목에 `이전탕전취소됨`이 있습니다
  - `GET /tangjeon/prescription-documents`: 발급 대장 (`시작일`, `종료일`, `환자Id`, `page`, `limit`)
  - `GET /tangjeon/dispensary-rooms`: 탕전실 목록 (`탕전실Id`, `유형`, `타입`, `연번`, `기관명`, `기관기호`, `조제자이름`, `한약사면허번호`)
- **보험구분 코드:**

  | 코드 | 요청 표기 | 라벨 | 약재 출처 라벨 |
  |---|---|---|---|
  | `54` | 일반 | 비급여 | 비급여 약재 |
  | `35` | 건보 | 첩건 | 탕전실 보유 약재 |
  | `74` | 자보 | 자보 | 자보 약재 |
  | `94` | 산재 | 산재 | 산재 약재 |

- **상태 저장:** `tangjeonKeys` (`["tangjeon","prescriptions", "list"|"infinite-list"|"stats"|"detail"|"by-treatment"|"histories"|"prescription-documents"|"document-ledger"|"unregistered", …]`, `["tangjeon","treatment-prescriptions",…]`, `["tangjeon","herbs"|"herbs-all"|"dispensary-rooms"|"dictionaries",…]`). 화면 탭은 라우트 쿼리에 둡니다
- **근거:** `re-upstream/restored/views/TangjeonPrescriptionListView.vue`, `re-upstream/restored/components/tangjeon/TangjeonPrescriptionListContent.vue`, helpers.js (액션) (`re-upstream/restored/components/tangjeon/TangjeonPrescriptionListContent.helpers.js`), helpers-2.js (작성 진입) (`re-upstream/restored/components/tangjeon/TangjeonPrescriptionListContent.helpers-2.js`), `re-upstream/restored/components/tangjeon/TangjeonListStatusCell.vue`, `re-upstream/restored/modules/처방작성변환.js`, `re-upstream/restored/modules/index/part-64.js`, part-4.js (탭) (`re-upstream/restored/modules/TangjeonPrescriptionListView/part-4.js`), `re-upstream/restored/api/tangjeon/requests.js`

## 탕전 처방 작성 — `/ocs/prescription/create`

- **목적:** 탕전 처방을 새로 쓰거나 수정·복사합니다. 진료 처방 불러오기, 패키지 차감 처방, 진료 화면에서 넘어온 조제 지시도 이 화면에서 합니다
- **접근 조건:** `탕전관리` 권한, 신형 기관만 들어옵니다. 같은 본문(`TangjeonPrescriptionCreateContent`)을 세 가지 `표시모드`로 씁니다
  - `페이지`: 이 라우트
  - `목록패널`: `TangjeonListCreatePanel` 사이드패널
  - `진료모달`: 진료 화면의 `TangjeonTreatmentModal`
- **화면 구성:**
  - `TangjeonCreateContentHeader`: 제목은 "처방 작성" / "탕전 처방 수정" / "패키지 차감 처방 작성" / "조제 지시"
  - `TangjeonCreatePatientCard`, `TangjeonCreateHistoryStrip`(지난 처방이력)
  - `TangjeonCreatePrescriptionCard`: 처방명·담당원장·처방일·메모·일수·첩·하루팩수·팩·용량·약재표
  - `TangjeonCreateTreatmentLink`(진료 연결), `TangjeonCreateInsuranceFields`(보험구분·탕전실)
  - `TangjeonCreateDictionaryCard`: 방제사전, 개인방제, 약재목록 탭
  - `TangjeonCreateSummaryPanel`: 처방 요약, "저장 전 확인할 항목"
  - 이탈 확인 `BaseConfirmDialog`: "작성 중인 처방이 있습니다"
- **동작:**
  - **진입:** 라우트 쿼리를 `use처방작성진입.E`가 읽습니다
    - 키: `id`(수정), `copyFrom`(복사), `reload=1`(진료 다시 불러오기), `진료처방Id`, `환자Id`, `package`(쉼표로 이은 패키지 차감 Id → 모드 `패키지`)
    - 처방 상세는 `GET /tangjeon/prescriptions/{id}`, 환자는 `GET /patients/{id}`로 받습니다
    - 수정 대상이 메디원탕 처방이면 편집 대신 "메디원탕 주문에 연결된 처방입니다" 안내와 "메디원탕 주문 보기" 버튼을 보여 줍니다
  - **진료 불러오기:**
    - 환자의 첩약 진료 처방 목록: `GET /tangjeon/treatment-prescriptions` (`환자Id`, `보험구분`, `limit 100`)
    - 처방 초안: `GET /tangjeon/treatment-prescriptions/{진료처방Id}/draft`
    - 내원일 목록: `GET /record/patient/{환자Id}/record/date`
    - 수정 모드에서는 연결된 진료가 살아 있는 동안 연결을 바꿀 수 없습니다 ("[복사해서 새 처방]으로 다시 만들어 주세요")
  - **환자 변경:** 원진료 연결을 해제하고, 첩건이면 탕전실도 비웁니다
  - **약재 매칭:**
    - 약재 검색: `GET /tangjeon/herbs` (`보험구분`, `기준일자`, `탕전실Id`, `search_keyword`, `limit 200`)
    - 보험구분·탕전실·기준일자가 바뀌면 다시 매칭합니다
    - 비급여가 아닌데 목록에 없는 약재가 있으면 "{약재 출처}에 없는 약재가 N개 있습니다"라고 경고합니다
  - **검증 (`vl`):**
    - 처방명이 있어야 합니다
    - 첩건·자보·산재(`Urn`)는 진료 불러오기가 필요합니다 (수정 모드 제외)
    - 첩건은 탕전실이 필요합니다
    - 비급여가 아니거나 원진료가 있거나 패키지 모드이면 환자가 필요합니다. 환자 미지정은 진료 없는 비급여 처방에만 허용됩니다
    - 일수·첩·팩을 모두 입력해야 합니다
    - 약재 매칭이 끝나지 않았거나 미매칭 약재가 있으면 저장할 수 없습니다
  - **저장 (`wl`):**
    - 약재가 없으면 "약재 없이 저장할까요?"를 먼저 묻습니다
    - 신규: `POST /tangjeon/prescriptions`. `생성경로`는 진료가 연결돼 있으면 `진료연동`, 아니면 `직접작성`입니다
    - 수정: `PUT /tangjeon/prescriptions/{id}`. 연결이 바뀌었으면 `연결변경`(`진료처방Id`/`진료Id`/`환자Id`)을 같이 보냅니다
    - 패키지: `POST /tangjeon/prescriptions/from-package` (`차감Id`, 보험구분 54 고정)
    - 페이지 모드에서는 저장 후 `tangjeon-prescription-list?처방Id=`로 이동하고, 패널·모달 모드에서는 `saved`/`close`를 emit합니다
  - **요청 본문:** `조제상태`, `보험구분`(일반/건보/자보/산재), `생성경로`, `기준일자`, `처방일`, `환자Id`, `진료Id`, `진료처방Id`, `진료의Id`, `탕전실Id`, `처방명`, `메모`, `일수`, `첩`, `팩`, `용량`, `일투팩수`
    - 약재 항목(`약재[]`): `한약재명`, `처방용량`, `원방용량`, `단위`, `단가`, `후하`, `메모`, `주성분코드`, `병원첩건약재제품Id`, `제품코드`, `가중평균가`, `레퍼런스한약재공정서Id`
- **데이터:** 위 엔드포인트, `GET /tangjeon/dictionaries`(방제사전: `보험구분`, `search_keyword`), 개인방제(`SETTINGS_PERSONAL_FORMULAS_PATH`), `GET /settings/treatments`
- **상태 저장:** 폼 상태는 컴포넌트 안의 `yl()`이 들고 있습니다 (`isDirty`, `markClean`, 잠금 플래그). 쿼리 키는 `tangjeonKeys`를 씁니다
- **근거:** `re-upstream/restored/views/TangjeonPrescriptionCreateView.vue`, `re-upstream/restored/components/tangjeon/TangjeonPrescriptionCreateContent.vue`, helpers-3.js (검증) (`re-upstream/restored/components/tangjeon/TangjeonPrescriptionCreateContent.helpers-3.js`), helpers-6.js (저장) (`re-upstream/restored/components/tangjeon/TangjeonPrescriptionCreateContent.helpers-6.js`), `re-upstream/restored/composables/use처방작성진입.js`, `re-upstream/restored/components/tangjeon/TangjeonTreatmentModal.vue`

## 진료 화면 연동

- 진료 보드의 첩약 영역(`TreatmentViewBoardAsideNhicChubyak`, `…JaboChubyak`, `…NonBenefitChubyak`, `…SanjaeChubyakHistory`)은 `TangjeonLinkedPrescriptions`를 씁니다
  - 표시: "이 진료로 만든 탕전 처방" 목록 (`GET /tangjeon/prescriptions/by-treatment/{진료Id}`)과 청구 약재 대조 결과
  - 버튼: "탕전실로 조제 지시"(`TangjeonTreatmentModal` 진료모달), "처방전 발급", "탕전관리에서 보기"
- `TreatmentViewBoardAside`에는 `원외탕전주문` 탭이 있고, 그 탭이 `OcsV2DecoctionOrderAsideAccordion`(메디원탕 주문 요약·작성)을 렌더합니다. 탭 노출 조건은 확인하지 못했습니다 (추정)
- 근거: `re-upstream/restored/components/tangjeon/TangjeonLinkedPrescriptions.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardAside.vue`

## 처방전 발급 — `HerbalPrescriptionIssue*`

- **목적:** 탕전·OCS 처방으로 일반한약처방전을 출력합니다. 출력 내용이 원 처방과 다르면 원 처방에도 반영합니다
- **화면 구성:**
  - `HerbalPrescriptionIssueButton`: "처방전 발급" 버튼
  - `HerbalPrescriptionIssuePanel`: `DocumentIssueView`를 `initial-document-type="일반한약처방전"`으로 감싼 사이드패널
  - `HerbalPrescriptionUnassignedIssuePanel`: 환자 미지정 처방전
  - `TangjeonPrescriptionIssuePanels`: 탕전 목록에서 두 패널 중 하나를 고르는 래퍼
- **동작:**
  - 환자가 있으면 `처방Id = ocs처방Id ?? 탕전처방Id`로 환자 고정 패널을 엽니다. 환자가 없으면 미지정 패널을 엽니다
  - 미지정 패널은 `GET /documents/patients/unassigned/herbal-prescription/{rid}`로 데이터를 받고, `POST /documents/general-herbal-prescription`으로 출력합니다. 닫을 때 "환자 미지정 처방전은 임시저장되지 않아 고친 내용이 사라집니다"라고 경고합니다
  - **출력 후 저장 (`만들기`):** 원 탕전 처방이 메디원탕 처방이 아니면 아래를 합니다
    - 출력값(처방명·복용법→메모·첩수·투약일수·팩수·팩용량·발급연월일, 약재별 단위용량·메모)을 원 처방과 비교해 바뀐 칸만 `PUT /tangjeon/prescriptions/{id}`(`바꿀칸`)로 보냅니다
    - 처방전에 새로 추가된 약재는 `GET /tangjeon/herbs`로 매칭해 추가합니다. 못 넣은 약재는 경고합니다
    - 수령희망일이 바뀌었으면 `PATCH …/{id}/delivery`로 `{수령일}`을 보냅니다
  - 패널을 닫으면 `tangjeonKeys.prescriptionDocuments(id)`와 `documentLedgerAll()`을 무효화합니다
- **근거:** `re-upstream/restored/components/tangjeon/TangjeonPrescriptionIssuePanels.vue`, `re-upstream/restored/modules/TangjeonPrescriptionIssuePanels/prefetchTangjeonPrescriptionsQuery.js`, `re-upstream/restored/components/herbal/HerbalPrescriptionIssuePanel.vue`, `re-upstream/restored/components/herbal/HerbalPrescriptionUnassignedIssuePanel.vue.js`

## 약재 편집기·방제 사전

- **`HerbTableEditor`:** OCS 패널, 탕전 작성, 메디원탕 작성, 설정 개인방제(`HerbEditorSidePanel`)가 함께 쓰는 약재 표입니다
  - 열: 순서, 약재명, 제품, 원산지, 후하, 원방 용량, 가감(+/-), 처방 용량, 총량(×첩), 약재 메모, 삭제
  - 일괄 입력: "당귀 4 천궁 2"처럼 여러 약재를 한 번에 넣습니다 (`HerbBulkTagsInput`). 용량이 없거나 목록에 없는 약재는 추가하지 않습니다
  - 키보드 단축키 도움말(`HerbTableShortcutHelp`)과 전체 삭제 확인이 있습니다
  - 합계 줄에 "총 약재비 / 첩당" 금액이 보입니다
- **`HerbCopyButton`:** 약재를 "당귀 4g, 천궁 4g" 형식으로 클립보드에 복사합니다
- **방제 사전:**
  - 구형: `OcsViewPrescriptionOcsDictionary`. 처방명 검색, 카테고리 세로 탭(`/ocs/dictionaries/categories`), 개인 방제와 사전 처방 목록을 보여 주고, 더블클릭하면 적용합니다
  - 신형: `TangjeonCreateDictionaryCard`. 방제사전(`/tangjeon/dictionaries`), 개인방제, 약재목록(`/tangjeon/herbs`) 탭이 있습니다. 첩건은 진료를 불러와 탕전실이 정해져야 약재가 보입니다
- **근거:** `re-upstream/restored/components/herb/HerbTableEditor.vue.js`, `re-upstream/restored/components/ocs/OcsViewPrescriptionOcsDictionary.vue`, `re-upstream/restored/components/tangjeon/TangjeonCreateDictionaryCard.vue.js`

## 메디원탕 게이트·원탕 계약 — `/ocs-v2-herb-order-create`, `/ocs-v2-herb-order-list`

- **목적:** 두 라우트 모두 `OndangGateView`가 받습니다. 라우트 `props.target`(`create`/`list`)에 따라 `OcsV2OrderCreateView` 또는 `OcsV2OrderListView`를 비동기로 띄우고, 계약이 안 된 계정에는 안내 모달을 보여 줍니다
- **접근 조건:** `meta.permissionCode = 메디원탕`. 이용 가능 여부(`이용가능`)는 두 조건을 모두 만족해야 합니다
  - `구독완료`: `GET /subscriptions/soo-pro`의 `sooPro === true`
  - `계약완료`: `/auth/me`의 `me.원탕계약정보.contractedFacilities[].facilityName`에 "금곡"이 포함 (`Bk`)
- **동작:**
  - 권한이 있는데 이용할 수 없으면 `OndangContractRequiredModal`을 하루에 한 번 자동으로 엽니다. 닫은 날짜는 localStorage 키 `bt.메디원탕계약모달닫은날짜`에 남깁니다
  - 모달 내용(`OcsV2OrderAccessBlock`): "원외탕전 조제의뢰를 위해 아래 항목을 완료해 주세요"와 단계 목록
    - 수멤버스PRO 가입 (외부 메디마켓 링크)
    - 수 서비스 연동: `setting-service-integration?openSooConnect=true`. 기본설정 권한이 없으면 "대표원장 계정에서…"라고 안내합니다
    - 금곡원외탕전 공동이용계약 (외부 링크)
  - 모달이 열려 있는 동안 창에 포커스가 오면 `userKeys.me()`와 `sooSubscriptionKeys.sooProStatus()`를 무효화합니다. 이용 가능해지면 모달을 자동으로 닫습니다
  - 하위 화면에는 `provide(계약게이트, { 이용가능, open계약모달 })`로 상태를 넘깁니다
- **원탕 가입:** `/sign-up/ondang/*`에서 합니다 (`GET`/`POST /integrations/onboarding/wontang/profile|signup`). 자세한 내용은 [account-onboarding.md](account-onboarding.md)에 있습니다
- **근거:** `re-upstream/restored/views/OndangGateView.vue.js`, `re-upstream/restored/components/ondang/OndangContractRequiredModal.vue`, _hoisted_1.js (계약 판정) (`re-upstream/restored/modules/OndangContractRequiredModal/_hoisted_1.js`), `re-upstream/restored/modules/index/part-195.js`

## 메디원탕 주문 작성 — `/ocs-v2-herb-order-create`

- **목적:** 외부 원외탕전(메디마켓)에 처방·조제옵션·배송·결제를 담은 주문을 넣습니다. 두 단계(`처방 입력` → `배송 입력 및 결제`)로 진행합니다
- **접근 조건:** 게이트를 통과해야 합니다. 이용 가능할 때만 `GET /ocsv2/eligibility`를 부르고, `valid === false`이면 `OcsV2OrderEligibilityBlockModal`을 띄웁니다
  - 사유에 "도장"·"서명"이 있으면 "대표자 도장 등록이 필요합니다"와 `setting-hospital-info`로 가는 버튼을 보여 줍니다
  - 사유에 "잠시 후 다시 시도"가 있으면 재시도 버튼을 보여 줍니다
- **화면 구성:**
  - `OcsV2OrderCreateView`: 제목 "원외탕전 주문 작성", `OcsV2OrderCreateStepperNav`, 휴무 안내(`OndangHolidayNoticeBanner`/`Modal`)
  - 카드: `OcsV2OrderCreatePatientCard`, `OcsV2OrderCreatePrescriptionCard`, `OcsV2OrderCreateHerbDictionaryCard`, `OcsV2OrderCreateDispensingSection`(파우치·박스·쇼핑백·추가 옵션·날인), `OcsV2OrderCreateMedicationGuideCard`(복용방법·복용안내서 첨부), `OcsV2OrderCreateShippingCard`, `OcsV2OrderCreatePaymentCard`, `OcsV2OrderCreateTaxInvoiceCard`
  - 요약: `OcsV2OrderCreateOrderSummaryPanel`
  - 모달: `OcsV2OrderCreatePaymentCompleteModal`, `OcsV2OrderCreatePaymentGateErrorModal`, 환자 등록 사이드패널(`DeskPatientRegister`)
  - 이 화면은 탕전 목록의 `TangjeonOcsV2OrderModal`(`embedded`, `진료컨텍스트`)과 진료 화면 아코디언에서도 재사용합니다
- **동작:**
  - **진입 사유:** `계속작성` / `수정` / `재주문` / `처방만재주문` / `진료연동`. 사유마다 `GET /ocsv2/drafts/{draftId}`로 초안을 복원하고 "임시저장한 주문을 불러왔습니다" 같은 안내를 띄웁니다
  - **약재·옵션 데이터:**
    - 약재 검색: `POST /ocsv2/herbs/search` (`keyword`, `sort`)
    - 옵션: `GET /ocsv2/order-options`
    - 탕전실 설정: `GET /ocsv2/dispensary`, `GET /ocsv2/contract`
  - **금액 미리보기:** `POST /ocsv2/price-preview` (`약재라인목록`, `부자재목록`, `추가옵션목록`, `조제정보`, `결제수단목록`). 실패하면 결제 단계 금액 표시와 결제를 잠급니다
  - **당일배송 판정:** `POST /ocsv2/sameday/classify` (`address`). 당일 배송은 "오후 1시 마감"입니다
  - **임시저장:** 처음에는 `POST /ocsv2/drafts`, `draftId`가 생긴 뒤에는 `PATCH /ocsv2/drafts/{draftId}`로 보냅니다. 초기화하면 입력을 모두 지웁니다
  - **결제 (`handlePay`):**
    1. 계약이 안 됐으면 계약 모달을 엽니다
    2. 배송 카드를 검증합니다
    3. `POST /ocsv2/precheck`로 확인합니다. 실패 사유는 `OUT_OF_STOCK`=재고 부족, 그 외는 수량 불일치로 표시합니다
    4. "총 N원이 결제됩니다. 결제하면 주문이 접수되어 조제가 시작됩니다."를 확인받습니다
    5. `submitOrderAndPay`: 초안 저장 → 복약지도서 업로드 → `POST /ocsv2/quote`(`draftId`) → 서버 결제총액에 맞춰 결제수단 금액을 조정 → `POST /ocsv2/order`(`draftId`, `견적ID`, `결제수단목록`) → `메디마켓주문ID`
  - **결제수단:** 메디 예치금 카드(할인율·잔액)와 일반 신용·체크카드를 씁니다 (`GET /billing/payment-methods`, crmClient)
  - **중복 결제 방지:** 중복결제 위험 오류가 나면 재시도하지 않고 "주문 상태를 확인해주세요"라고 안내합니다
  - **복약지도서:** `POST /ocsv2/drafts/{draftId}/medication-guide` (`파일명`)
  - **주문 수정:**
    - 수정 진입 시 `POST /ocsv2/orders/{draftId}/hold`로 조제를 보류합니다. 실패하면 "수정 중 조제가 시작될 수 있으니 탕전실에 확인해주세요"라고 안내합니다
    - 처방·옵션·배송유형이 그대로면 정보만 바꿉니다: `PATCH /ocsv2/orders/{draftId}/info` (`처방명`, `수령인명`, `수령인연락처`, `배송메모`, `배송지주소`, `조제정보`) 후 unhold
    - 바뀌었으면 재결제합니다. 결제가 끝나면 기존 주문을 `POST /ocsv2/orders/{draftId}/cancel`로 취소합니다
    - 화면을 나가면 "주문 수정을 종료할까요?… 나가면 주문 보류가 해제되어 조제가 다시 진행됩니다"를 확인받고 `POST …/unhold`를 보냅니다
- **상태 저장:**
  - `ocsV2Keys` (`["ocsV2","drafts","list"|"detail",…]`, `snapshots`, `orderStatus`, `herbs/search`, `orderOptions`, `paymentMethods`, `sameday/classify`, `eligibility`, `contract`)와 `["ocsV2","dispensary"]`
  - 초안 상태(`현재draftId`)는 `sg()`가 들고 있습니다
  - 스냅샷: `GET /ocsv2/drafts/{id}/snapshots`. 주문 상태: `GET /ocsv2/orders/{id}/status`
- **근거:** `re-upstream/restored/views/OcsV2OrderCreateView.vue`, `re-upstream/restored/views/OcsV2OrderCreateView.vue.js`, part-7.js (submitOrderAndPay) (`re-upstream/restored/modules/useOcsV2배송상태/part-7.js`), `re-upstream/restored/api/ocs-v2/query-keys.js`, `re-upstream/restored/components/ocsV2/OcsV2OrderEligibilityBlockModal.vue.js`

## 메디원탕 처방내역 — `/ocs-v2-herb-order-list`

- **목적:** 메디원탕 주문과 임시저장 초안을 목록으로 보고 상태별 후속 액션을 합니다
- **화면 구성:**
  - `OcsV2OrderListView`
  - `OcsV2OrderListHeader`
  - `OcsV2OrderListFilters`: 상태, 기간, "주문번호·환자·수령인·처방명 검색", 엑셀 다운로드
  - `OcsV2OrderListTable`: `OcsV2OrderListTableStatusCell`, `OcsV2OrderListTableActionsCell`
  - `OcsV2OrderListSidePanel`: 주문 상세 (환자·처방·약재·조제 규격·결제)
- **동작:**
  - **목록:** `GET /ocsv2/drafts` (`limit 100`, `offset 0`, `sort`=`created_at`|`updated_at`)
    - 기본 기간은 최근 1개월입니다
    - 검색·상태·기간 필터는 클라이언트에서 적용합니다
  - **열 상세:** `?draftId=` 또는 `?orderNo=`가 있으면 그 행 상세를 엽니다. 상세는 `GET /ocsv2/drafts/{id}`와 `GET /patients/{환자Id}`로 받습니다
  - **상태별 액션 (`get주문액션목록`):**

    | 표시 상태 | 액션 |
    |---|---|
    | 임시 저장 | 계속 작성, 삭제 (`LINKED`이면 삭제 없음) |
    | 조제 전, 수정 중 | 주문 취소, 수정 ("처방정보 변경 시 재결제가 필요합니다" → hold 후 작성 화면) |
    | 조제 중, 배송 중 | 없음 |
    | 배송 완료, 취소 | 재주문, 처방만 재주문 |

  - **삭제:** `DELETE /ocsv2/drafts/{draftId}`. 결제 완료(`COMPLETED`) 주문은 삭제할 수 없습니다
  - **주문 취소:** "환불 예상 금액 N원이 결제하신 수단으로 환불됩니다"를 확인받고 `POST /ocsv2/orders/{draftId}/cancel`을 보냅니다
  - **주문서 열기:** 메디마켓 주문서(`/orders/{메디마켓주문ID}`)를 새 탭으로 엽니다
  - **상태 조회:** `GET /ocsv2/orders/{id}/status` → 토스트 "주문진행상태: …"
  - 계속작성·수정·재주문은 진입 정보를 담아 `ocs-v2-herb-order-create`로 이동합니다
- **근거:** `re-upstream/restored/views/OcsV2OrderListView.vue`, `re-upstream/restored/modules/OcsV2OrderListView/part-1.js`, `re-upstream/restored/modules/OcsV2OrderListView/part-2.js`, `re-upstream/restored/composables/useOcsV2OrderListMock.js`

## 조제·배송 상태 값

### 탕전·OCS `조제상태` (`re-upstream/restored/modules/ocsDispensingStatus.js`)

| 값 | 라벨 | 배지 색 | 수동 선택 | 비고 |
|---|---|---|---|---|
| `임시저장` | 임시 저장 | gray | — | 처방 취소 가능 |
| `조제전` | 조제 전 | gray | ✓ | 처방 취소 가능, 탭 |
| `조제중` | 조제 중 | warning | ✓ | 처방 취소 가능, 탭 |
| `조제완료` | 조제 완료 | success | ✓ | 탭. `/ocs`에서는 수령 방법을 저장하면 자동으로 이 값이 됩니다 |
| `수정중` | 수정 중 | warning | — | 메디원탕 주문 수정 중 (추정) |
| `배송중` | 배송 중 | indigo | — | 메디원탕 연동 |
| `배송완료` | 배송 완료 | success | — | 메디원탕 연동 |
| `취소` | 취소 | gray | — | 탭. `PATCH …/status`로 설정 |
| (없음) | — | gray | — | 미지정 (통계 `미지정`) |

- `조제상태수정가능`이 없으면 `!메디원탕주문Id`로 판정합니다. 메디원탕 연동 처방은 상태를 고칠 수 없고 배지만 보입니다
- 약재 수정 불가 사유(`처방작성변환.Q`/`V`)는 세 가지입니다: `조제완료`/`배송중`/`배송완료` → "이미 조제가 끝난…", `취소` → "취소된…", 메디원탕 → "메디원탕 주문 화면에서 변경해 주세요"

### 수령 방법

| 값 | 라벨 | 필요한 입력 |
|---|---|---|
| `직접수령` | 직접 수령 | 수령(예정)일 |
| `택배배송` | 택배 | 배송 주소 (`주소Id`) |
| `퀵` | 퀵 | 배송 주소 + 수령일 |

### 메디원탕 주문 표시 상태

- `로컬주문상태`는 `DRAFT`/`READY`/`LINKED`/`COMPLETED`/`CANCELED`입니다. `CANCELED`는 "취소", `COMPLETED`는 `주문진행상태`, 그 밖은 "임시 저장"으로 보입니다
- `COMPLETED`일 때 `주문진행상태`(`수정중`/`조제중`/`배송중`/`배송완료`/`취소`, 기본 `조제전`)가 표시 상태 "수정 중", "조제 중", "배송 중", "배송 완료", "취소", "조제 전"이 됩니다
- 배지 색: 임시 저장은 blue, 나머지는 위 표와 같습니다

## 흐름

1. **진료 처방:** 진료에서 첩약·한약 처방을 저장합니다
   - 구형 기관: OCS 행(`/ocs/list`)이 생깁니다 (추정, 서버 측)
   - 신형 기관: 미등록 진료 처방(`/tangjeon/treatment-prescriptions/unregistered`)으로 잡힙니다
2. **탕전 주문 (원내 탕전실):**
   - 구형: `/ocs`에서 "처방 입력"으로 `PATCH /ocs/{id}`
   - 신형: 미등록 "작성", 진료 화면 "탕전실로 조제 지시", 목록 "처방 작성"에서 `POST /tangjeon/prescriptions`
   - 패키지 차감: `POST /tangjeon/prescriptions/from-package`
3. **조제:** 진행상태를 조제전 → 조제중 → 조제완료로 바꿉니다 (`PATCH /ocs/{id}` 또는 `PATCH /tangjeon/prescriptions/{id}/status`). 그만두면 처방 취소
4. **처방전 발급:** 언제든 `HerbalPrescriptionIssuePanel`로 일반한약처방전을 출력할 수 있습니다. 출력 후 달라진 내용은 탕전 처방에 반영합니다
5. **배송/수령:**
   - 수령 방법·수령일·주소 입력: `PATCH /ocs/{id}/delivery` 또는 `PATCH /tangjeon/prescriptions/{id}/delivery`
   - 복용 종료일은 수령일 + 일수로 계산합니다
6. **복용 완료:** `PATCH /ocs/{id}/taking` 또는 `PUT /tangjeon/prescriptions/{id}` `{복용완료}`
7. **원외탕전 (메디원탕) 갈래:**
   - 시작: 신형 목록의 "메디원탕 주문하기"(비급여) 또는 메뉴 "처방전 작성"
   - 주문: 초안 → 견적(`quote`) → 결제·주문(`order`)
   - 이후 상태는 메디원탕 주문을 따라갑니다 (조제 전 → 조제 중 → 배송 중 → 배송 완료). 연결된 탕전 처방은 `생성경로=메디원탕`이 되고 EMR에서 상태·약재를 고칠 수 없습니다

## 미확인·추정

- `/ocs/list` 행이 언제 생기는지(진료 저장 시 서버가 만드는지)는 클라이언트 코드로 확인할 수 없습니다 (추정)
- `OcsViewHeader` 제목 조건 `Yu()`/`gHe()`의 뜻을 확인하지 못했습니다. 이름만 보면 수/라이트 계정 판정 같습니다 (추정)
- `epe()`의 요양기관기호 목록은 일부러 적지 않았습니다. 신형 화면은 일부 기관을 대상으로 한 단계적 배포로 보입니다 (추정)
- `useOcsV2OrderListMock`은 청크 이름에 `Mock`이 들어 있습니다
  - 샘플 약재·주문 데이터와 상태 매핑(`j`)을 담고 있습니다
  - 실제 목록은 `ea()`가 `provide`한 서버 데이터를 씁니다. inject가 없을 때만 로컬 목업 함수로 대체합니다 (추정)
- 주문 작성 화면의 `precheck`가 실패하면 "EP 미가용 — 머지 후 활성" 로그를 남기고 건너뜁니다. 서버 엔드포인트가 아직 배포되지 않았을 수 있습니다 (추정)
- `endpoints.md`에는 `PATCH /ocs/{id}/delivery` 본문으로 `복용종료일`·`수령방법`·`수령일`만 적혀 있습니다. 실제 코드는 `주소Id`·`주소`·`상세주소`도 보냅니다
- `수정중` 조제상태가 탕전 처방 쪽에서 어떤 경로로 설정되는지는 확인하지 못했습니다. 라벨만 정의돼 있습니다
- 진료 화면 `원외탕전주문` 탭의 노출 조건과 `TangjeonClaimHerbPanel`(청구 약재 패널)의 사용처를 확인하지 못했습니다
