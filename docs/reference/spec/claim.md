# 청구·보험

`/claim` 아래의 청구 화면들(심평원 청구, 추나·첩약 제출 현황, 의료급여 진료 승인, 일차의료 방문, 비대면진료 시범사업, 연말정산)과 실손보험 조회(`/insurance-inquiry`), 전자서명(`/electronic-signature`)을 다룹니다.
심평원 전송·심사결과 수신·추나/첩약 제출은 모두 데스크톱 앱(Electron)의 `window.electronAPI.hiraDdmdProxy` / `hiraDynamicServiceProxy`를 통해 로컬 심평원 프로그램(DDMD, HIRA e-Form Agent)을 호출합니다. 웹에서는 대부분 막히거나 안내만 표시됩니다.
청구서 데이터는 서버 `emrClient`의 `/chunggu/*`, 실손 조회는 별도 `insuranceClient`를 씁니다.

## 공통: 청구 컨테이너 — `/claim` (이름 없음)
- **목적:** 청구 하위 화면의 권한 게이트이자 레이아웃입니다.
- **접근 조건:** `meta { requiresAuth, usesGlobalLayout, permissionCode: 청구(chunggu), permissionRequired }`
  - `l0e()`는 **현재 경로와 정확히 일치하는** 라우트의 `meta.permissionCode`를 `canAccess$`로 확인합니다. 그래서 `/claim/hira`는 `chunggu`가 아니라 `spw_chunggu`로 판단됩니다
  - EMR이 아닌 구성의 계정(홈이 `desk`가 아님)은 `claim-hira`, `claim-hira-submit-items`, `claim-medical-aids` 진입 시 홈으로 돌려보내집니다 (`re-upstream/restored/lib/index/part-261.js` `WQt`)
- **화면 구성:** 권한 확인 중이면 `LoadingBoxWithSpinner`, 통과하면 `SooProV2FeatureRestrictionBanner` + `RouterView`, 실패하면 `AccessDeniedNotice`("접근 권한이 없습니다. 대표원장에게 권한을 요청해 주세요.")
  - `KeepAlive :max="3"`로 하위 화면을 캐시합니다. `HiraSubmitItemsView`는 캐시에서 뺍니다
- **근거:** `re-upstream/restored/views/ClaimView.vue`, `re-upstream/restored/router/routes.js`, [access-control.md](../access-control.md)

| 경로 | route name | permissionCode (표시명 → 코드) |
|---|---|---|
| `/claim/hira` | `claim-hira` | 심평원청구 → `spw_chunggu` |
| `/claim/hira-submit-items` | `claim-hira-submit-items` | 추나첩약제출현황 → `chuna_chubyak_submission` |
| `/claim/medical-aids` | `claim-medical-aids` | 의료급여진료승인현황 → `medical_aid_approval` |
| `/claim/home-visit` | `claim-home-visit` | 청구 → `chunggu` |
| `/claim/telemedicine-pilot` | `claim-telemedicine-pilot` | 청구 → `chunggu` |
| `/claim/year-settlement` | `year-settlement` | 청구 → `chunggu` |

## 심평원 청구 — `/claim/hira` (`claim-hira`)
- **목적:** 진료 데이터로 서버가 모아 둔 청구서를 검토·수정한 뒤 심평원(건보·의료급여·자보)으로 전송하고, 근로복지공단(산재) 청구서는 내려받게 합니다. 전송한 뒤에는 심사결과를 받아 오고 보완청구를 만듭니다.
- **접근 조건:** `spw_chunggu` (access). 전송·사전점검·심사결과 불러오기는 Electron 앱(`isElectron`)에서만 됩니다. 웹에서는 "청구서 전송은 업스트림 앱에서만 가능합니다." / "심사결과 불러오기는 업스트림 앱에서만 가능합니다." 대화상자를 띄웁니다
- **화면 구성:** `BaseTabBar` 탭 `청구필요` / `청구결과` (쿼리 `?tab=`, `replace`). 오른쪽 위에 `ClaimJejuEntryButton`이 있습니다
  - `청구필요` → `ClaimV2InboxView`
  - `청구결과` → `ClaimResultView`
- **근거:** `re-upstream/restored/views/ClaimHiraView.vue`

### 청구필요 탭 (`ClaimV2InboxView`)
- **화면 구성:**
  - 왼쪽 440px: `ClaimV2InboxViewCardList`("청구서 목록"). 카드는 `ClaimSummaryCard 단계="청구필요"`이고 상태 배지, 진료기준월, 보험구분, 원청구/재청구 건수, 총청구액, 삭감위험금액을 보여줍니다
    - 재청구 카드에는 "원청구번호"와 "청구 접수 확인 필요"가 표시됩니다
  - 오른쪽 위: `ClaimV2InboxViewTitle`(진료기간, 건수 내역), `ClaimV2InboxViewSum`(총 청구액, N원 삭감위험)
    - 건수 내역은 건보면 "건보/의료급여", 산재면 "합병증 예방·관리/일반 치료"로 나눠 보여줍니다
  - 산재 청구서는 사업구분 탭 `합병증 예방·관리`(`OK.예방="2"`) / `일반 치료`(`OK.요양="1"`)로 나뉩니다. `사업구분별청구[코드].청구Id`로 하위 청구서를 엽니다
  - 본문:
    - `청구유형 === "보완청구"`이면 `ClaimV2InboxViewUnpaidList`(지급불능 명세서, 사유코드 입력)를 보여줍니다
    - 그 밖에는 `ClaimV2InboxViewDangerList`(삭감위험) → `ClaimV2InboxViewSafeList`(정상) → `ClaimV2InboxViewPostponeList`(미룬 진료) 순서로 보여줍니다
  - 아래: `ClaimV2InboxViewFooter` (사전점검 / 청구서 전송 / 청구서 다운로드). `ClaimV2InboxViewFloatingBar`의 다중선택 전송은 `console.info`만 남기고 실제 동작은 없습니다
  - 비어 있으면 "청구할 내역이 없습니다. 건강보험, 자동차보험, 산재보험 진료건이 등록되면 자동으로 생성됩니다."를 표시합니다
- **동작:**
  - 화면에 들어올 때 `["chunggu","document"]` 쿼리를 무효화합니다. 목록은 `GET /chunggu/before`, 상세는 `GET /chunggu/before/{id}`입니다
    - 상세 응답의 `에러코드 === "N0002"`는 클라이언트가 빈 문자열로 바꿉니다
  - `?selectedClaimId=`로 카드를 미리 선택합니다
  - **삭감위험 목록:** `청구진료`를 `에러코드`별로 묶습니다. 무시한 코드(`useClaimWarningOffStore`)와 `미루기여부=true`는 뺍니다
    - 에러코드 카탈로그 `os(code)`(`re-upstream/restored/modules/TreatmentViewBoardPrescriptionV2/_hoisted_1.js`)에는 `경고문구`, `안내문구`, `위험도`(`높음`/`중간`), `자동수정가능`이 들어 있습니다. 88개 코드 중 21개가 자동수정 가능합니다
    - 자동수정 가능 → `ClaimV2InboxViewDangerAutoFix`: 진료 기록과 환자 정보를 가져와 `jf()`로 수정안을 만들고 `POST /record/{rid}/save`로 저장한 뒤 청구 쿼리를 무효화합니다. `N0028`은 별도 경로를 탑니다
    - 자동수정 불가 → `ClaimV2InboxViewDangerManualFix`: `진료일자수정`(`ClaimJarakHistoryEditor`) 또는 `차트직접수정`(`ClaimV2CommonEditPanelPrototype` 사이드패널)
    - `ClaimCutBackWarningTable`의 버튼은 `수정` / `수정 안함`(이 청구서에서 코드 무시) / `청구 미루기`입니다
  - **청구 미루기 / 이번에 청구:** `PATCH /chunggu/before/chunggu-treatment/{청구진료Id}` `{ 미루기여부: true|false }`. 미룬 진료건은 다음달 청구로 넘어갑니다
  - **보완청구 사유코드:** 같은 엔드포인트에 `{ 심사불능사유코드 }`를 보냅니다
  - **차트 직접 수정 패널(`ClaimV2CommonEditPanelPrototype`):**
    - 왼쪽 `ClaimV2CommonEditPanelSideBar`(진료건 목록), 본문 `ClaimV2CommonEditPanelPrototypeMain`(상병·처방·명세서 특정내역·자보 지급보증 정보)
    - 버튼: `저장` / `저장하고 다음건 보기` / `청구 미루기`
    - 저장은 `POST /record/{rid}/save`입니다. 패널을 열 때 `useClaimWarningStore.defaultErrorCode`를 해당 코드로 맞춥니다
  - **산재 청구서 다운로드:**
    - 산재기관번호가 없으면 "병원정보설정으로 이동"(`setting-hospital-info`)을 안내합니다
    - 있으면 `POST /chunggu/sam/{id}` 후 `GET /chunggu/sam/{id}` → `getSignedUrls`의 파일을 차례로 내려받습니다. 이후 근로복지공단 토탈서비스 업로드를 안내합니다
    - "청구 완료 처리" 체크박스는 `PATCH /chunggu/before/{id}/status` `{ 상태: "전송완료" | "집계중" }`입니다
  - **사전점검 / 청구서 전송 (건보·자보, Electron):** 아래 [흐름](#흐름) 참고
  - 오류 처리:
    - 409 `code: "근무형태_미지정"`이면 `GET /users`로 근무형태가 없는 한의사 계정을 찾아 `AccountWorkTypeRequiredForClaimModal`을 띄웁니다
    - 찾지 못하면 `setting-account-permission`으로 안내합니다
- **데이터:**
  - `GET /chunggu/before` → `청구목록[{ 청구Id, 보험구분, 진료기준, 재청구원본청구번호, 상태, 총청구액, 총삭감위험금액, 원청구건수, 청구유형 … }]`
  - `GET /chunggu/before/{id}` → `청구 { 상태, 보험구분, 청구유형, 진료기준, 시작일자, 종료일자, 원청구Id, 원접수번호, 원청구건수, 건보청구건수, 급여청구건수, 총청구액, 총삭감위험금액, 사업구분별청구?, 청구진료[{ 청구진료Id, 진료Id, 환자Id, 에러코드, 예상삭감액, 미루기여부, 사업구분, 명세서일련번호, 원명세서일련번호, 심사불능사유코드, 급여청구액 … }] }`
  - `POST /chunggu/sam/{id}` (timeout 60s) → `청구Id`; `GET /chunggu/sam/{id}` → `getSignedUrls`
  - `POST /chunggu/after` body `{ 청구Id, 청구문서Id, 점검시작일자, 점검종료일자, 청구문서건수, 청구문서제목, 청구문서번호 }`: 전송 완료를 서버에 기록합니다
    - 값은 DDMD 결과의 `DMD_DOC_ID`, `EXM_DT`, `REG_DT`, `DMD_DOC_CNT - 1`, `DMD_TTL`, `DMD_NO`에서 채웁니다
- **상태 저장:**
  - query keys `chungguKeys`: `["chunggu","document-list"]`(목록), `["chunggu","document", id]`(상세)
  - Pinia `claimWarningOff`(`errorCodesToIgnore: Map<청구Id, Set<에러코드>>`, 메모리에만 있음), `claimWarning`
  - localStorage `claim:unsentGuard`: 점검했지만 아직 전송하지 않은 청구서 메모입니다 (`gh`/`Ur`/`_a`)
- **근거:** `re-upstream/restored/views/ClaimV2InboxView.vue`, `re-upstream/restored/components/claim/ClaimV2InboxViewFooter.vue.js`, `re-upstream/restored/api/chunggu/queries.js`, `re-upstream/restored/api/chunggu/query-keys.js`, `re-upstream/restored/components/claim/ClaimV2InboxViewDangerAutoFix.vue`, `re-upstream/restored/components/claim/ClaimV2CommonEditPanelPrototype.vue`, `re-upstream/restored/modules/ClaimHiraView/part-2.js`

### 청구결과 탭 (`ClaimResultView`)
- **화면 구성:**
  - 위: `MonthRangePicker`(진료기준월 범위), `BaseCheckBoxDropDown` "보험 구분" 필터(`Xx`)
  - 왼쪽: `ClaimResultList`("전송한 청구건")
    - 카드는 `ClaimSummaryCard 단계="청구결과"`입니다. 상태, 금액(미확정금액 우선), 청구문서번호, "N원 삭감 · N원 지급불능"을 보여줍니다
    - 마우스를 올리면 "심사결과 불러오기" 버튼이 나옵니다. `SummaryChungguPrice`도 있습니다
    - `ClaimCardContextMenu`에서 `DocumentNumberEditModal`(청구 문서번호 변경, 20자 이내)을 엽니다
  - 오른쪽:
    - 심사결과를 받는 중이면 `ClaimLoading`("이 화면을 벗어나도 완료되면 알려드립니다.")
    - 아무것도 선택하지 않았고 심사완료 건이 있으면 `ClaimResultViewSummary`(삭감·지급불능 요약)
    - 선택하면 `ClaimResultMain` + `ResultFooter`(다시 청구하기 / 심사결과 불러오기)
    - 다시 청구된 원본에는 `RetriedClaimBanner`를 붙입니다
  - `ClaimResultMain` 탭: `심사결과` / `명세서 전체`
    - `심사결과`: 심사 상세, 보험사별 심사 상세(자보), 상계환급금, 담당자 정보, "재심사·이의신청 기한 YYYY-MM-DD D-n"(통보일 + 90일)
    - `명세서 전체`: `StatementOriginalPanel`, SAM 원문입니다
- **동작:**
  - 목록 `GET /chunggu/after?from=yyyyMM&to=yyyyMM&보험구분[]`
  - 상세 `GET /chunggu/examresult/{청구Id}`(`select: 심사결과`), 요약 `GET /chunggu/examresult/patients?from&to`
  - **다시 청구하기:**
    - `상태 === "전송완료"`이고, 재청구된 적이 없고, 산재가 아닐 때만 됩니다. 사유 문구는 "심사 완료 건은 보완청구를 이용해주세요." 등입니다
    - 확인하면 `POST /chunggu/after/{id}/retry` → 새 `청구Id`를 받고 "청구필요로 이동"(`?tab=청구필요&청구Id=`) 토스트를 띄웁니다. 400이면 서버 `message`를 그대로 보여줍니다
  - **문서번호 변경:** `PATCH /chunggu/after/{id}/document-number` `{ 청구문서번호 }`
  - **보완 청구서 생성** (`ClaimResultMain.helpers.js`):
    - `GET /chunggu/after/{원청구Id}/supplementary` → `명세서목록`에서 고르고, 기본 선택은 `기본선택여부`입니다
    - 사유코드가 없는 행이 있으면 "사유코드를 선택해 주세요"로 막습니다
    - `POST /chunggu/after/{id}/supplementary` body `{ 명세서목록: [{ 청구진료Id, 명세서일련번호, 심사불능사유코드 }] }` → `{ 청구Id, 명세서건수, 총청구액 }`. 새 보완청구서는 청구필요 목록에 나타납니다
  - **심사결과 불러오기** (`wC().loadResult`, Electron): [흐름](#흐름) 5단계
- **데이터:**
  - `GET /chunggu/after` → `청구목록[{ 청구Id, 상태, 보험구분, 진료기준, 시작일자, 종료일자, 청구문서Id, 청구문서번호, 청구번호, 재청구청구Id, 원청구Id, 삭감금액, 지급불능금액, 미확정금액 … }]`
  - `GET /chunggu/examresult/{청구Id}` → `심사결과 { 심사결정액, 삭감액, 심사차수, 삭감환자내역[{ 명일련번호, 조정사유코드, 심사불능사유코드, 조정금액, 청구액 }], 보험사별상세[], 심결사항_* 합계들, 담당자, 담당부서, 전화번호 … }`
  - `GET /chunggu/after/{id}?limit&offset` (infinite) → `patients`, `청구`
  - `POST /chunggu/examresult` (일괄) → 404면 `POST /chunggu/examresult/{청구Id}`로 다시 보냅니다
- **상태 저장:** `chungguKeys_2`: `["chunggu","after","list",params]`, `[…,"examresult",청구Id]`, `[…,"examresult-patients",{from,to}]`, `[…,"supplementary-targets",원청구Id]`. 월 범위는 `wC()`(모듈 단위 공유 ref (추정))에 둡니다
- **근거:** `re-upstream/restored/views/ClaimResultView.vue`, `re-upstream/restored/components/claim/ClaimResultMain.vue.js`, `re-upstream/restored/components/claim/ClaimResultMain.helpers.js`, `re-upstream/restored/modules/ClaimHiraView/progressText.js`, `re-upstream/restored/components/claim/ClaimSummaryCard.vue`

### 청구 상태 값

| 값 | 표시 단계 | 의미 / 근거 |
|---|---|---|
| `집계중` | 청구필요 | 회색 배지. 산재는 "청구 완료 처리"를 끄면 이 값이 됩니다 |
| `청구가능` | 청구필요·청구결과 | 초록 배지 |
| `전송대기` | 청구필요 | 회색 배지 |
| `전송완료` | 청구결과 | 다시 청구·심사결과 불러오기가 가능합니다. 산재는 체크박스로 직접 설정합니다 |
| `보완청구` | 청구결과 | 심사결과 불러오기가 가능합니다 |
| `심사중` | 카드 목록 판정에 사용 | `["심사중","심사완료"]` 검사 (`re-upstream/restored/components/claim/ClaimV2InboxViewCardList.vue.js`) |
| `심사완료` | 청구결과 | 파란 배지. 다시 청구는 불가하고 보완청구로 처리합니다 |

- `청구유형`: `원청구`(기본값), `보완청구`. 재청구는 `재청구원본청구번호`가 있는 카드입니다
- `보험구분`: `건보`, `급여`(의료급여), `자보`, `산재`, `첩건`(첩약 건보)
- `청구구분코드`(`gn`): `0` 실청구, `1` 사전점검, `2` 청구SW점검, `3` 개발서버
- 통보서 상태(`L0`): `0` 전체, `1` 신규, `2` 열람, `3` 수신성공, `4` 수신실패
- 보험 종류 코드(`Or`): `Y` 건강보험, `V` 자동차보험

## 제주 지원사업 청구 — `ClaimJejuEntryButton` (`/claim/hira` 헤더)
- **목적:** 제주 해녀(잠수어업인), 4·3 생존희생자·유족·며느리 진료비 지원사업의 월별 청구서와 내역서를 만듭니다.
- **접근 조건:** `GET /settings/jeju-claim`의 `운영사업`이 비어 있지 않을 때(`제주지원사업사용중`)만 버튼이 보입니다
- **화면 구성:**
  - 버튼 "제주 지원사업 청구". `GET /chunggu/jeju/badge`의 `지난달건수 >= 1`이면 빨간 "N" 배지를 붙입니다
  - `ClaimJejuModal`: 사업 탭 `해녀` / `제주 4·3`(`사삼`), `ClaimJejuInstitutionInfo`(상호·대표자·사업자번호·소재지·지급 계좌 등), `ClaimJejuTable`, `ClaimJejuNoAddressBlock`(주소 없는 환자에 "주소등록" 버튼), `ClaimJejuActionBar`
- **동작:**
  - 월·사업별 요약 `GET /chunggu/jeju/summary?청구월&사업구분`
  - 해녀는 "청구서 · 내역서 인쇄" 후 제주시·서귀포시로 우편 발송합니다
  - 4·3은 "청구서 · 내역서 다운로드" 후 4·3 사업 사이트에 직접 업로드합니다. 안내 문구에 외부 URL이 하드코딩돼 있습니다
  - 문서 생성 `POST /chunggu/jeju/documents`, 제출 표시 `PUT /chunggu/jeju/submitted`
  - 이미 제출한 달이면 "정정본이 필요한 경우에만 다시 생성하세요."라고 경고합니다. 지급 계좌가 비면 경고만 하고 생성은 됩니다
- **상태 저장:** `jejuKeys.claimSetting()`, `chungguBadge()`, `chungguSummary(월, 사업)`
- **근거:** `re-upstream/restored/components/claim/ClaimJejuEntryButton.vue`, `re-upstream/restored/components/claim/ClaimJejuModal.vue`, `re-upstream/restored/api/patients/requests-4.js`, `re-upstream/restored/modules/useJejuSupport/part-1.js`

## 추나·첩약 제출 현황 — `/claim/hira-submit-items` (`claim-hira-submit-items`)
- **목적:** 추나요법, 자보 첩약, 첩약 건보(시범사업) 건을 심평원 측 등록 데이터와 차트 데이터로 맞춰 보고, 승인 요청·제출·삭제를 합니다.
- **접근 조건:**
  - `chuna_chubyak_submission`
  - 웹이면(`!Yh()`) "앱에서 확인해주세요. 웹에서는 데이터가 실제와 다를 수 있으며 승인 요청할 수 없습니다." 배너를 띄웁니다
  - 심평원 조회에 실패하면 "HIRA e-Form Agent를 재시작하세요" 배너를 띄웁니다
- **화면 구성:**
  - `HiraSubmitItemsViewHeader`: 탭 `추나요법` / `자보 첩약` / `첩약 건보`(`?selectedTab=`), 기간(`?startDate&endDate`), 새로고침
  - `MetricTab` 상태 필터
  - 추나는 `HiraSubmitItemsViewChunaFilters`(보험구분·시술자·시술명)
  - 탭별 본문 `HiraSubmitItemsViewMainChuna` / `…MainChubyakJabo` / `…MainChubyak`. 행 액션은 `…TableActionCell`에 있습니다
- **동작:**
  - 차트 쪽: `GET /record/hira/chuna`, `GET /record/hira/car-pcmd`, `GET /record/hira/pcmd` (`start_date`, `end_date` yyyyMMdd)
  - 심평원 쪽은 Electron `hiraDynamicServiceProxy`를 씁니다
    - 추나: `selectYadmChunaList`·`selectPatChunaCnt`·`createChunaData`·`deleteChunaData`
    - 자보 첩약: `selectCarPcmd`·`selectCarPcmdAcdtRcvNoList`·`insertCarPcmdPrscCpmdDesc`·`deleteCarPcmd`
    - 첩약 건보: `selectPcmdList`·`selectPatPcmdList`·`createPcmdData`·`deletePcmdData`·`selectLink`(체크리스트 팝업)
  - 두 데이터를 비교해 행 상태를 정한 뒤, 차트의 승인 플래그를 서버에 동기화합니다
    - `POST /record/hira/prescriptions/approval` `{ 진료처방Ids, 승인여부 }`
    - `POST /record/hira/pcmd-checklist` `{ 진료처방Ids, 첩건체크리스트제출여부 }`
  - 행 액션:
    - 추나: 승인 요청 / 재승인 요청 / 요청 삭제 / 차트 수정. 일괄 "N건을 승인 요청하시겠습니까?"는 진행률을 보여줍니다
    - 첩약 건보: 제출 / 재제출 / 제출 내역 삭제 / 체크리스트 작성·보기 / 차트 수정
    - 자보 첩약: 제출 / 재제출 / 상병 입력 / 수정 / 제출 내역 삭제
    - 수정은 `PATCH /record/prescriptions/{id}`, `POST /record/{rid}/save`
  - 진료 창(`useTreatmentWindowStore().treatmentWindow`)의 `pagehide` 때 세 목록 쿼리를 무효화합니다
- **행 상태:**

| 탭 | 상태 값 |
|---|---|
| 추나요법 | 전체, `승인필요`, `차트내역 없음`, `차트내역 불일치` (행 `승인`) |
| 자보 첩약 | 전체, `승인필요`(표시 "제출필요"), `차트내역 없음`, `차트내역 불일치` |
| 첩약 건보 | 전체, `승인필요`(표시 "제출필요"), `체크리스트 작성 필요`, `차트내역 없음`, `차트내역 불일치` |

- **상태 저장:** `recordKeys.pcmdRecordsAll()` 등, 라우트 쿼리 `selectedTab`, `startDate`, `endDate`
- **근거:** `re-upstream/restored/views/HiraSubmitItemsView.vue`, `re-upstream/restored/views/HiraSubmitItemsView.helpers.js`, `re-upstream/restored/views/HiraSubmitItemsView.helpers-2.js`, `re-upstream/restored/api/hira/query-keys.js` (`p0e`)

## 의료급여 진료 승인 현황 — `/claim/medical-aids` (`claim-medical-aids`)
- **목적:** 의료급여 수급자 진료건을 공단(NHIC) 온라인 자격·진료 승인(M3/M4/M5 전문)으로 승인 요청하거나 취소합니다.
- **접근 조건:** `medical_aid_approval`
- **화면 구성:**
  - `MedicalAidsViewHeader`("의료급여 진료 승인 현황", 기간은 1달 이내)
  - `MetricTab`(전체 / 승인필요)
  - `MedicalAidsViewMain` + `MedicalAidsViewTable`: 열은 상태, 진료일자, 환자명, 의료급여종류, 주상병, 투약일수, 본인부담여부, 본인부담금, 기관부담금, 건강생활유지비 청구액, 타기관 의뢰여부, 실패사유
  - 행 액션 `MedicalAidsViewTableActionsCell`: 승인 요청 / 수정 / 요청 삭제
  - 수정 모달 `MedicalAidsM3ModifyModal` → `MedicalAidsM3M4Form`, `MedicalAidsHospitalSelect`(선택의료급여기관)
- **동작:**
  - 목록 `GET /nhic/m3?start_date&end_date`, 행 상세 `GET /nhic/m3/{진료Id}`, 승인 상태 `GET /nhic/m4/internal-data/{진료Id}`
  - **승인 요청:** `POST /nhic/m4/get-external-data` body `{ 진료Id, m3: { …m3, 건강생활유지비청구액, 본인일부부담금, 출산전진료비청구액, 타기관의뢰여부, 본인부담여부, 진료의뢰의료급여기관기호, 선택된기관기호?, 선택된기관이름? } }` → `{ 승인여부, 서버로부터의메시지 }`
    - `타기관의뢰여부`는 본인부담여부가 `B005`/`B006`이면 `"Y"`입니다
  - **승인 취소:** `DELETE /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` → `취소여부 === "06"`이면 성공입니다
  - **U001 → B005 전환** ("의뢰서를 제출받았다면 B005(정액)로 변경"):
    - `GET /record/{rid}`로 `내원현황Id`·`보험조회`를 얻습니다
    - 그다음 `PATCH /desk/waiting/{id}` `{ 보험구분: "급여", 건강보험조회: { …, 본인부담여부: "B005", 선택된기관기호, 선택된기관이름 } }`
    - 본인부담금이 정액으로 다시 계산되고, 이미 수납한 금액은 과수납으로 표시됩니다
  - 일괄 "모두 승인 요청"
  - 각 작업 뒤에는 `medicalReceipts`, `m3`, `m4`, `treatmentRecord`, `chungguKeys.all`을 무효화합니다
- **상태 저장:** `medicalAidsStore`(행별 승인/취소 로딩), `deskKeys_2.m3/m4(진료Id)`
- **근거:** `re-upstream/restored/views/MedicalAidsView.vue`, `re-upstream/restored/modules/useMedicalAidsU001ToB005/part-2.js`, `re-upstream/restored/modules/useMedicalAidsU001ToB005/part-4.js`, `re-upstream/restored/components/medical/MedicalAidsM3M4Form.vue`

## 일차의료 방문 현황 — `/claim/home-visit` (`claim-home-visit`)
- **목적:** 일차의료 방문진료 건마다 심평원 점검서식을 작성했는지 관리합니다. 작성완료로 표시해야 청구에 포함됩니다.
- **접근 조건:** `chunggu`
- **화면 구성:**
  - `PageHeaderBar`("일차의료방문 현황", 1달 이내)
  - `MetricTab`(전체 / 점검서식 작성필요)
  - 한의사별 "사용/한도회"
  - 표: 상태, 진료일, 환자명(성별/나이), 진료의, 동일 건물 및 동일 세대, 본인부담률, 처방, 작업
- **동작:**
  - `GET /record/home-visit` (`startDate`, `endDate`) → `목록`, `한의사월횟수목록[{ 진료의표기이름, 횟수, 한도 }]`
  - "작성"/"점검서식 보기"는 외부 심평원 사이트(`hdn`)를 새 창으로 엽니다
  - "작성 완료" → `PATCH /record/home-visit/{rid}/form-status` `{ 점검서식상태: "작성완료" }`
- **상태 값(`mdn`):** `작성필요`, `제출필요`, `작성완료`
- **근거:** `re-upstream/restored/views/ClaimHomeVisitView.vue`, `re-upstream/restored/views/ClaimHomeVisitView.helpers.js`

## 비대면진료 현황 — `/claim/telemedicine-pilot` (`claim-telemedicine-pilot`)
- **목적:** 비대면진료 시범사업에서 기관의 비대면 비율 상한과 환자별 월 산정 한도를 점검합니다.
- **접근 조건:** `chunggu`
- **화면 구성:**
  - `PageHeaderBar`("비대면진료 현황")
  - 지표: 건보 진료 N건, 비대면진료 N건, 비율(상한 N%)
  - `MetricTab`(전체 / 월 N회 초과)
  - 표: 진료일, 시각, 차트번호, 환자명, 진료의, 보험, 관리료(시간대·수가코드, 없으면 "관리료 없음"), 급여총액, 해당 월 산정
- **동작:**
  - `GET /record/telemedicine-pilot/ratio?yearMonth` → `{ 전체건수, 비대면건수, 비율, 상한 }`. 상한 기본값은 0.3입니다
    - `비율 > 상한`이면 "이번 달 비대면진료 비율이 N%를 넘었습니다."를 표시합니다
  - `GET /record/telemedicine-pilot/records?startDate&endDate` → `{ 목록, 환자월한도 }`
- **근거:** `re-upstream/restored/views/ClaimTelemedicinePilotView.vue`, `re-upstream/restored/views/ClaimTelemedicinePilotView.helpers.js`

## 연말정산 — `/claim/year-settlement` (`year-settlement`)
- **목적:** 국세청 연말정산 의료비 간소화 자료를 만듭니다. 수납 내역별로 공제 포함·제외를 정하고 제출 파일을 내려받습니다.
- **접근 조건:** `chunggu`. 컴포넌트가 `l0e()`로 한 번 더 확인합니다
- **화면 구성:**
  - `YearSettlementHeader`: "연말정산 제출내역", 최대 1년, 보험 구분 필터(일반·건보 직장/지역가입자·급여·차상위·자보100), 환자명 검색, "내역 다운로드"
    - "제외할 내역 검토" 토글을 켜면 진료타입 `첩약` / `과세`를 고를 수 있습니다. 안내 문구는 "미용이나 건강증진 목적의 처방은 제외해야 합니다."입니다
    - "자동 제외 내역" 툴팁: 임산부 지원금, 문서 발급 비용, 급여 건생비 등
  - `YearSettlementTable`(수납 기준), `YearSettlementByTreatmentTable`(진료 기준: 상병명·처방명·진료의·과세 여부)
  - `YearSettlementHospitalInfoModal`: 제출할 한의원 정보(상호, 대표자, 사업자등록번호, 요양기관기호, 담당자 …) 확인
- **동작:**
  - `GET /documents/year-end-tax-settlement`, `…/details`, `…/details/count`(→ `herbalCount`, `taxableCount`), 모두 `start_date`, `end_date`
  - 포함/제외: `PATCH /documents/receipt-details/deduction-exclusion` `{ 제외할수납상세Ids, 포함할수납상세Ids }`
  - 다운로드: `POST /documents/year-end-tax-settlement/download?start_date&end_date` body `{ 병원정보 }` → `{ downloadUrl, fileName }`
- **근거:** `re-upstream/restored/components/year/YearSettlement.vue`, `re-upstream/restored/components/year/YearSettlementHeader.vue`, `re-upstream/restored/components/year/YearSettlementTable.vue`

## 실손보험 조회 — `/insurance-inquiry` (`insurance-inquiry`)
- **목적:** 환자의 실손보험 가입·보장 내역을 조회하는 별도 서비스(`insuranceClient`, 업스트림 실손)의 작업 화면입니다.
- **접근 조건:**
  - `meta { requiresAuth, usesGlobalLayout, personalInfoKoPageName: "실손보험 조회" }`. permissionCode는 없습니다
  - 연동 `insurance` 계정의 홈이 이 화면입니다. 사이드바 메뉴 id 75는 `insurance` 연동이 있을 때만 보입니다
  - 게이트 1 (`Nu`/`Jd`): `GET /hospital/terms` → `needsAgreement`면, `canAgree`일 때 `consent`(`HospitalTermsConsentScreen`), 아니면 `waiting`(`HospitalTermsWaitingScreen`)
    - 약관 동의는 대표원장만 할 수 있습니다: `POST /hospital/terms/agreements` `{ termsIds }`
  - 게이트 2 (`Vu`/`Du`): `GET /subscriptions/usage` → `planCode`가 없으면 `error`, 특정 코드(`us`)면 `subscriptionRequired`(`InsuranceSubscriptionRequiredScreen` "업스트림 실손 구독이 필요합니다")
- **화면 구성:** `InsuranceInquiryWorkbench` = `PatientHistoryPanel`(조회 목록, 320px) + `PatientDetailPanel`(선택 환자 상세) + `PatientAddModal`(조회 환자 등록) + `QrOutputModal` + `ClaimMigrationModal`
- **동작:**
  - 환자: `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}`, `GET /patients/search`
  - 조회: `POST /indemnity/patients/{id}/verifications`(·`/resend`) → `POST /indemnity/patients/{id}/lookups`(·`/cancel`), `POST /indemnity/patients/{id}/lookup-links`, `GET/POST /indemnity/qr`
    - 본인인증 후 조회하는 순서로 보입니다 (추정)
  - `POST /patients/{id}/claim`: 용도 미확인
  - **이전 실손 기록 불러오기(`ClaimMigrationModal`):**
    - 메디스트림 실손 계정으로 로그인하면 최근 1년간 완료된 조회 결과를 가져옵니다
    - `POST {HOSPITAL_CLAIM_MIGRATION_PATH}/jobs` `{ claimAccessToken }` → `GET …/jobs/current`(진행·미리보기) → `POST …/jobs/{id}/confirm` 또는 `/cancel`
    - 결과는 기존 환자와 연결 / 신규 등록 / 보류 / 제외로 분류됩니다
- **근거:** `re-upstream/restored/views/InsuranceInquiryView.vue`, `re-upstream/restored/components/insurance/InsuranceInquiryWorkbench.vue`, `re-upstream/restored/lib/InsuranceInquiryView/part-1.js`, `re-upstream/restored/lib/InsuranceInquiryView/part-2.js`, `re-upstream/restored/api/patients/requests-2.js`, `re-upstream/restored/components/claim/ClaimMigrationModal.vue`

## 전자서명 — `/electronic-signature` (`electronic-signature`)
- **목적:** 진료기록부와 본인부담금 수납대장에 의사가 네이버 인증서로 전자서명합니다.
- **접근 조건:**
  - `meta { requiresAuth, usesGlobalLayout }`
  - 컴포넌트 안에서 `canAccess$("digital_signature") && canAccessElectronicSignature`를 확인합니다. `Irt()`의 `canAccessElectronicSignature`는 항상 `true`입니다
  - 수납대장 영역은 `canCreate$("copayment_digital_signature")`일 때만 보입니다
  - EMR이 아닌 계정은 가드에서 홈으로 보냅니다
- **화면 구성:**
  - 탭 `서명 필요`(`RequiredView`) / `서명 완료`(`CompleteView`), 쿼리 `?view=`
  - `RequiredView`: 의사별 탭("내 서명 건" / "OOO 원장님건"), "진료기록부와 수납대장은 서명 필수" 안내, `MedicalRecord`, `CopaymentCollectionLedger`
  - 행을 클릭하면 `SignatureSidePanelView`(사이드패널)가 열립니다
  - 서명은 `NaverSignModal`에서 합니다
- **동작:**
  - 목록:
    - `GET /signing/medical-records/count`, `/signable/{doctor_id}`, `/signed`, `/record/{record_id}`
    - `GET /signing/daily-copayment-ledgers/count`, `/signable`, `/signed`
  - 서명 요청:
    - `POST /signing/medical-records/request` `{ doctorId, signAll, documentIds | start_date,end_date }`
    - 수납대장은 `POST /signing/daily-copayment-ledgers/request`
    - 응답은 `{ 서명Id, txExpiresAt }`입니다
  - `GET /signing/{id}/status`를 5초마다 폴링합니다. `SUCCESS`면 `POST /signing/{id}/finish` → `txStatus`에 따라 성공 / "인증이 완료되지 않았습니다." / "인증 기한이 만료되었습니다."
  - 모달에서 내 정보(이름·생년월일·휴대폰)를 확인하고 수정할 수 있습니다: `PATCH accountClient /users/{userId}`, OTP
- **근거:** `re-upstream/restored/views/ElectronicSignatureView.vue`, `re-upstream/restored/views/RequiredView.vue`, `re-upstream/restored/components/naver/NaverSignModal.vue.js`, `re-upstream/restored/api/signing/requests.js`

## 진료 화면의 청구 경고 — `useClaimWarningStore`
- **목적:** 진료 작성 중 삭감위험 경고를 실시간으로 보여줍니다. 청구 수정 패널과 같은 스토어를 씁니다.
- **동작:**
  - `modules/index/local.js`가 진료 내용(상병·처방·기준일시·진료의·자보 1일 2차·비대면 여부 등)이 바뀌면 300ms debounce 뒤 `HFt(...)`를 실행하고 그 결과로 `setTreatmentWarnings`를 호출합니다
  - `TreatmentViewBoardPrescriptionV2`는 지표 경고를 `setIndicatorWarnings`로 넣습니다
  - `warnings = [...treatment, ...indicator]`입니다. `currentWarning`은 `defaultErrorCode`와 일치하는 경고를 우선하고, 없으면 `warningIdx` 위치의 경고입니다
  - 표시는 `TreatmentViewBoardFooter` → `ClaimWarningCardsPopover`, `…ClaimWarning` 컴포넌트들이 맡습니다
- **근거:** `re-upstream/restored/stores/claimWarning.js`, `re-upstream/restored/stores/claimWarningOff.js`, `re-upstream/restored/modules/index/local.js`
- 참고: `components/car/`(자보 이력·자보 첩약 편집), `components/jabo/`(내원일 달력), `components/eligibility/`(건보 자격 표)는 데스크 접수와 진료 화면에서 쓰입니다(`DeskPatientAcceptCarHistory`, `PatientHealthInsuranceEligibilityTable` 등). 그래서 이 문서에서는 다루지 않습니다.

## 흐름

1. **진료 완료 → 청구서 집계:**
   - 서버가 건보·자보·산재 진료건으로 월별 청구서(`/chunggu/before`)를 자동으로 만듭니다. 클라이언트는 생성 API를 부르지 않습니다
   - 의료급여는 진료마다 `/claim/medical-aids`에서 공단 승인(M4)을 받습니다
   - 방문진료는 점검서식을 `작성완료`로 표시해야 청구에 포함됩니다
2. **청구 전 검토 (청구필요):**
   - 삭감위험 코드별로 자동수정(`POST /record/{rid}/save`)하거나, 차트를 직접 수정하거나, 무시(`claimWarningOff`)하거나, 미룹니다(`미루기여부`)
   - 보완청구서는 지급불능 명세서의 `심사불능사유코드`를 채웁니다
3. **청구서 생성 (SAM):** "청구서 전송" 또는 "사전점검"을 누르면 다음 순서로 진행합니다
   - Electron이 아니면 막습니다
   - `getHiraProgramInfo()`로 DDMD가 설치됐는지 확인합니다
   - 이전 미전송 메모와 남은 문서를 분류합니다 (`wh`: `청구필요`/`접수됨`/`이전버전`/`송신확인필요`/`자기문서미송신`/`이미송신`/`없음` 등). 경우마다 확인 모달을 띄웁니다
   - `POST /chunggu/sam/{청구Id}` → `GET /chunggu/sam/{청구Id}`로 SAM 파일 signed URL을 받습니다
4. **점검·전송 (DDMD):**
   - `hiraDdmdProxy.exam({ urls, ignoreDatabaseError: true, resultTimeout: 10 })`로 내려받고 점검합니다
     - `SND_YN === "N"` 또는 `EXM_STAT_CD === "1"`이면 실패입니다. 오류 최대 5건을 `PAT_NM`, `ERR_TXT`, `MEAS_ITM`(조치)과 함께 보여줍니다
   - 성공하면 `claim:unsentGuard` 메모를 저장합니다
   - 앱이 송신을 지원하면(`inspectSamIn().송신지원`) `sendDdmdDocuments({ dmdDocIdList, 청구구분코드 })`로 바로 송신합니다
     - 사용자는 인증서 창에서 비밀번호를 입력합니다
     - 클라이언트는 `inspectSamIn().recentDocs`로 송신 이력을 최대 5회, 2초 간격으로 다시 확인합니다
     - 그래도 확인되지 않으면 사용자에게 직접 묻습니다
   - 송신을 지원하지 않으면 `runHiraProgram()`으로 청구프로그램을 열어 수동으로 최종 전송하게 합니다
   - 사전점검 결과는 청구프로그램의 사전점검서비스 창에서 봅니다
   - 전송하면 `POST /chunggu/after`로 서버에 기록합니다. 실패하면 "심평원 전송은 완료됐지만 차트 기록에 실패했습니다." 토스트와 [다시 기록] 버튼을 띄우고, 청구서는 다시 보내지 않습니다
   - 산재는 이 단계 대신 SAM 다운로드 → 근로복지공단 토탈서비스 업로드 → "청구 완료 처리" 체크입니다
5. **심사결과 (청구결과):** "심사결과 불러오기"를 누르면 다음 순서로 진행합니다
   - Step 1: `searchNtcList({ from, to: 오늘, 청구구분코드: "0", 통보서상태: "0", 보험구분 })`
   - Step 2: 진료기준과 보험구분으로 통보서를 매칭하고, 접수증 문서도 고릅니다
   - Step 3: `receiveNtcList({ items: [{ ntcDocId, 본지원코드, 청구구분코드, 중계결과문서상태 }] })`
     - 접수증(`parseF010Files`/`parseN010Files`)이 확인되면 미전송 메모를 지웁니다
   - Step 4: 통보서 파싱
     - 자보는 `parseN020Files`
     - 급여는 `parseF060Files`
     - 건보·첩건은 `parseF020Files`
   - Step 5: 우리 요양기관기호로 거르고, 청구번호와 기간으로 헤더를 매칭한 뒤 `POST /chunggu/examresult`로 저장합니다. 404면 `/{청구Id}`로 보냅니다
   - 다른 화면에 있으면 "결과 보러가기" 토스트를 띄웁니다
6. **이후 처리:**
   - `전송완료`인 건은 "다시 청구하기"(`POST /chunggu/after/{id}/retry`)로 청구필요에 새 청구서를 만들 수 있습니다
   - `심사완료`인 건은 "보완 청구서 생성"(`POST /chunggu/after/{id}/supplementary`)으로 지급불능 명세서를 보완청구합니다. 재심사·이의신청 기한은 통보일 + 90일로 안내합니다

## 미확인·추정
- `ClaimV2InboxViewFloatingBar`의 다중 선택 "청구서 전송"은 `console.info`만 남깁니다. 카드 체크박스 노출 조건(`i`)도 확인하지 못했습니다. 미완성 기능으로 보입니다 (추정)
- 가드 목록(`WQt`)에 있는 `claim-year-settlement`는 실제 route name `year-settlement`와 다릅니다. 그래서 연말정산 화면은 EMR 아님 리다이렉트를 받지 않습니다 (코드상 사실. 의도인지는 미확인)
- `ClaimView`가 `KeepAlive`에서 빼는 `HiraSubmitItemsView`의 이유(진료 창 이벤트 리스너 정리 (추정))
- `Xx`(청구결과 보험 구분 필터 항목)와 `us`(실손 구독 필요 planCode)의 실제 값은 확인하지 않았습니다
- `POST insuranceClient /patients/{id}/claim`의 의미(환자 귀속 또는 실손 청구) — 이름만으로 판단할 수 없습니다
- `GET /chunggu/before/one`(`date, patient_id, type` → `청구Id`)은 `ClaimJarakHistoryEditor`에서만 쓰입니다. 정확한 용도는 미확인입니다
- 에러코드 카탈로그는 코드 번호대(`N`·`S`·…)별로 7개 객체(`_hoisted_1`~`_7`)로 나뉘어 있습니다. 각 그룹의 분류 기준은 확인하지 않았습니다
- 청구서 자동 집계 시점(진료 저장 시 또는 배치)은 서버 쪽 동작이라 클라이언트 코드로 알 수 없습니다
