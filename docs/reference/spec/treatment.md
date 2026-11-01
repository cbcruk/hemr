# 진료·치료실

원장이 환자 차트를 열어 진료기록·상병·처방을 작성하고 저장·완료하는 **진료 보드**(`/treatment`)와, 내원 환자를 치료실 베드에 배정하고 시술 타이머를 돌리는 **치료실 보드**(`/treatment-rooms`, 태블릿 임베드 포함)를 다룹니다. 차트 그림(`/canvas`)은 진료기록 에디터에서 여는 별도 창입니다.
데스크·수납, 예약, 청구, 탕전은 다른 문서에서 다루며 여기서는 연결 지점만 적습니다.

## 라우트 요약

| 경로 | name | 화면 | meta |
|---|---|---|---|
| `/treatment` | `treatment` | `TreatmentSuspense` → `TreatmentView` → `TreatmentViewBoard` | `requiresAuth`, `usesGlobalLayout`, `permissionCode: 진료`, `permissionRequired`, `personalInfoKoPageName: 진료` |
| `/treatment/repeat-results` | `treatment-repeat-results` | `TreatmentRepeatResultsView` | `usesGlobalLayout` |
| `/treatment-rooms` | `treatment-rooms` | `TreatmentRoomsSuspense` → `TreatmentRoomsView` | `requiresAuth`, `usesGlobalLayout`, `permissionCode: 치료실`, `permissionRequired` |
| `/tablet/treatment-rooms` | `tablet-treatment-rooms` | `TabletTreatmentRoomsView` (안에서 `TreatmentRoomsSuspense`) | `requiresAuth`, `permissionCode: 치료실`, `permissionRequired` (전역 레이아웃 없음) |
| `/tablet/auth-link` | `tablet-auth-link` | `TabletAuthLinkView` | 없음 |
| `/canvas` | `canvas` | `CanvasView` | 없음 |

- `*Suspense` 래퍼는 `l0e()`로 매칭된 라우트의 `permissionCode`를 `canAccess$`로 검사합니다. 권한 정보를 불러오는 중이면 `RouteViewLoadingFallback`, 권한이 없으면 `RouteAccessDenied`, 있으면 화면을 비동기로 로드합니다 (timeout 30초).
- `treatment-rooms`, `tablet-treatment-rooms`는 EMR 전용 라우트라서, 홈이 `desk`가 아닌 계정은 홈으로 보냅니다 ([access-control.md](../access-control.md) §3).
- 근거: `re-upstream/restored/router/routes.js`, `re-upstream/restored/components/treatment/TreatmentSuspense.vue`, `re-upstream/restored/components/treatment/TreatmentRoomsSuspense.vue`, `re-upstream/restored/lib/index/part-196.js`

---

## 진료 화면 셸 — `/treatment`

- **목적:** 진료 보드를 감싸는 화면입니다. 미니 데스크(환자 목록), 비대면(SOO) 주문 상태 바, 페이지 이탈 가드를 맡습니다.
- **접근 조건:** `permissionCode: 진료`. 화면 안에서 쓰는 쓰기 권한은 [진료 보드](#진료-보드--treatmentviewboard)를 참고하세요.
- **화면 구성:**
  - `AiAgent`로 전체를 감쌉니다.
  - 왼쪽 320px 미니 데스크(`PatientsMiniDashboard`)의 탭은 `예약 / 대기 / 치료 / 수납 / 진료한 환자`입니다. SOO 단독 계정(`vx`)은 `예약 / 진료한 환자`만 보입니다.
  - `TreatmentViewSooStatusBar`: 비대면 SOO 진료일 때만 보입니다.
  - 본문은 `TreatmentViewBoard`이고, 모달은 `NonBenefitPatientsViewTelemedicineCancelModal`·`NonBenefitPatientsViewTelemedicineVisitScheduleModal`·`TreatmentViewSooInvoiceModal`입니다.
- **동작:**
  - URL 쿼리 `patientId`, `recordId`, `type`(보험구분), `accidentReportNumber`, `focusChubyak`, `sooOrderId`를 보드 props로 넘깁니다.
  - 다른 환자로 바뀌면 다음 페인트 뒤에 적용하고, 그동안 "차트 정보를 불러오는 중입니다" 오버레이를 띄웁니다 (`bo`/`ho`, 최대 200ms).
  - `patientId`가 없으면 미니 데스크를 엽니다. 단축키 `Def$.대기환자패널`로 토글하고, 방향키·Enter·Esc로 카드를 탐색합니다. 화면 폭이 1992px 이상이면 미니 데스크가 본문을 밀어내고, 그보다 좁으면 오버레이로 뜹니다.
  - 카드를 클릭하면 `switchPatient` → `router.push({ name: "treatment", query: { patientId, recordId } })`.
  - **이탈 가드**(`uZt`/`dZt` = route leave/update 가드): 수정 사항(`진료내용수정됨`)이 있으면 "저장하지 않은 작성 내용이 있습니다." 대화상자를 띄웁니다.
    - **저장하고 이동:** `savePatientRecord`를 호출합니다. 진찰료 중복이나 한약 템플릿 조회 실패로 저장이 중단되면 이동을 막습니다.
    - **저장 안함:** crash-safe draft와 레코드 상태를 지우고 store를 `$reset`합니다.
  - 마이그레이션 진료(`preventPrescriptionRepeat`)는 가드 없이 이동합니다.
  - `window.__treatmentNavigate(patientId, recordId)`를 전역에 등록합니다 (외부 진입용, 추정).
  - **비대면 SOO 상태 바:** 주문 `status`를 `inProgress / complete / pickupWaiting / shipping / delivered / confirmed / pickupComplete / cancel`로 매핑합니다.
    - 진료 취소·환불: `PATCH /desk/telemedicine-consultations/{예약Id}/status` (`status: "cancel"`, `cancelReason`)
    - 방문수령 완료: 같은 API에 `status: "pickupComplete"`
    - 수령일시 전송: `patchSooOrderVisitSchedule(orderId, { visitSchedule })`. 진료시작 상태였다면 이어서 `finishPatientRecord("치료", { skipPickupCheck: true })`를 호출합니다
    - 송장 입력: `POST /desk/telemedicine-consultations/{예약Id}/invoice` (`invoiceList`)
- **데이터:** `GET /desk/waiting?date=`(오늘 대기 목록, `내원Id` 찾기), `GET thesooClient members/upstream/orders/{주문식별자}`, `GET thesooClient members/upstream/consultations/orders/{id}/invoice`
- **상태 저장:**
  - `useTreatmentStore`: 비활성화(deactivate) 때 `인덱스쿼리구독중지`, unmount 때 `$reset`·`$dispose`
  - query key: `sooKeys.all`, `treatmentRecordKeys.treatmentRecord(id)`, `treatmentRecordKeys.treatmentRecordList({ pid })`
  - 재활성화 시 환자 메모를 무효화합니다 (`invalidatePatientMemoQuery`)
- **근거:** `re-upstream/restored/views/TreatmentView.vue`, `re-upstream/restored/views/TreatmentView.helpers.js`

## 진료 보드 — `TreatmentViewBoard`

- **목적:** 한 환자의 한 진료(`진료Id`)를 편집하는 메인 작업 공간입니다.
- **접근 조건** (`s6`, `re-upstream/restored/modules/TreatmentViewBoard/part-32.js`):

  | 값 | 조건 |
  |---|---|
  | `canWriteTreatmentRecordPermission` | `진료기록생성수정삭제`(`treatment_write`)에 `canWrite$`가 있음. 단, 적용된 권한 규칙이 `담당환자`(`owner_only`)면 로그인 사용자의 `진료의Id` = 진료의 `진료의Id`일 때만 |
  | `canWriteTreatmentRecord` | 위 조건 + 마이그레이션 진료(`진료데이터.preventPrescriptionRepeat === true`)가 아님 |
  | `canWritePrescription` | `처방생성수정삭제`(`prescription_write`)에 같은 규칙 + 마이그레이션 진료 아님 |
  | `isDoctor` | `auth/me`의 `me.진료의Id`가 있음 |

  - 마이그레이션 진료에는 "이전 차트에서 이관된 진료 / 이관된 진료는 수정할 수 없습니다." 배너가 뜹니다.
  - 권한이 없는 영역은 `ZC`("현재 권한으로 실행할 수 없습니다.") 툴팁과 함께 읽기 전용이 됩니다.
  - 캔버스 버튼은 `canWriteTreatmentRecordPermission`으로 켜고 끕니다.
- **화면 구성:**
  - 상단: `TreatmentViewBoardPatientInfo`. 환자 배지, 가족, 소개자, 진료의·진료항목 선택이 있고, 메뉴는 `새 차트 생성`(`TreatmentViewBoardNewChart`: 건보/자보/산재/일반, 진료일), `차트 초기화`, `문서 발급`, `탕전 처방 작성`, `메디원탕 주문`, 데스크 액션(`SidePanelDeskActions`)입니다.
  - 외부 열(크기 조절·드래그로 재배치 가능, `IS`): `메모`(`PatientMemo`, 기본 탭 `진료의`), `경과기록`(`TreatmentViewBoardRecordsList`), `문진표`(`TreatmentViewBoardQuestionnairePanel`, 고정 시), `비대면진료`(`TreatmentViewBoardSooOrderPanel`, SOO 주문이 있을 때)
  - 편집 영역:
    - `TreatmentViewBoardEditHeader`: 진료일시, 보험 변경, 명세서 특정내역·산정특례 특정기호, 희귀난치 상병 검색, 연계상병 선택, `첩건` 추가, `방문`(일차의료방문) 추가, `비대면` 시범사업 토글
    - 자보 배너: `TreatmentViewBoardEditHeaderJabo2ndVisitBanner`(자보 1일 2차 진료 지정 → 진찰료 제거, `POST /record/{rid}/save`), `TreatmentViewBoardEditHeaderJaboLongTreatmentBanner`("자보 경상환자 장기치료 검토 대상입니다.", 8주 초과 안내)
    - 섹션: `진료기록`(`TreatmentViewBoardEdit`), `상병`(`TreatmentDisease`, `InsuranceMedicineDiseaseBanner`, 첩약 시범사업이면 `TreatmentViewBoardChubyakDiseaseAdd`), `처방`(`TreatmentViewBoardPrescriptionV2`)
  - 오른쪽: `TreatmentViewBoardAside` (탭 표는 아래)
  - 하단: `TreatmentViewBoardFooter`
  - 오늘 기록이 삭제됐으면 편집 영역 대신 `TreatmentViewBoardNoTodayRecord`가 보입니다.
  - `patientId`가 없으면 `EmptyPatient`("선택된 환자가 없습니다.")가 보입니다.
- **동작:** 섹션별 상세는 아래 하위 절에 있습니다. 보드 레이아웃을 초기화하면 "화면 배치가 초기화되었습니다." 토스트가 뜹니다.
- **데이터** (보드 전체에서 쓰는 쓰기 API):

  | API | 용도 |
  |---|---|
  | `POST /record/{rid}/save` | 진료 저장 |
  | `PATCH /record/{rid}/done` | 진료 완료 |
  | `PATCH /desk/waiting/{id}` | 내원 상태 이동 |
  | `PATCH /treatments/patients/{내원Id}/status` | `치료완료` |
  | `POST /desk/waiting` | 새 차트 생성 |
  | `PATCH /record/prescriptions/{id}` | `시술진료의Id`, `줄단위특정내역` |
  | `POST /record/prescriptions/last-rounds` | 비급여 직전 회차 |
  | `POST /record/hira/prescriptions/approval` | 추나 승인 |
  | `POST /chart/chuna/patients/{pId}` | 추나 내역 |
  | `POST /nhic/m4/get-external-data`, `DELETE /nhic/m5/{treatmentId}/confirmation/{진료확인번호}` | 의료급여 |
  | `PATCH /record/home-visit/{rid}/form-status` | `점검서식상태` |
  | `POST`/`PATCH /desk/nonbenefit-intake` | SOO 단독 계정 저장 |
  | `PATCH /ocs/{ocsId}` | 원내 탕전 OCS |

- **상태 저장:**
  - `useTreatmentStore` (`re-upstream/restored/stores/treatment.js`):
    - `selectRecord({ 진료Id, 환자Id })`로 대상을 고르고 `진료내용`(편집 중 사본), `진료데이터`(서버 원본), `초기스냅샷`, `최근진료기록`, `같은날자보진료기록`, `희귀상병데이터`, `병합된상병Ids/처방Ids`를 가집니다.
    - `진료내용수정됨`은 `진료기록·상병·처방·보험구분·기준일시·진료타입·진료의Id·진료항목Ids·한방첩약시범사업·명세서특정내역·_100여부·할인금액·처방경로·보험조회` 중 하나라도 스냅샷과 다르거나 `ocsDirty`이면 참입니다.
    - `진료데이터` 조회에 실패하면 `/treatment`로 이동합니다.
  - 인덱스 쿼리(`인덱스쿼리구독시작`): KCD 2026, 수가코드(`reimbursement-codes`), 자보 수가 JSON, 희귀질환 JSON을 기준일시에 맞춰 구독합니다. 출처는 `re-upstream/restored/modules/index/local.js`의 `qFt`입니다.
  - 기타 store: `useHiraSubmissionStore`, `useMedicalAidsStore`, `useClaimWarningStore`(청구 경고)
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoard.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardPatientInfo.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardEditHeader.vue`

### 진료기록 에디터 — `TreatmentViewBoardEdit`

- **목적:** 자유 서술 진료기록(HTML)을 작성합니다.
- **화면 구성:**
  - 제목 "진료기록"과 `NoteEditorMenu`(색·굵게·목록), `CanvasTrigger`(캔버스 버튼과 저장된 이미지 수), `CrashSafeDraftRecoveryBanner`가 있습니다.
  - 에디터는 `BaseTreatmentEditor`(ProseMirror)이고, 쓰기 권한이 없으면 HTML을 `v-dompurify-html`로 읽기 전용 표시합니다.
- **동작:**
  - **상용구:** 에디터에서 `/`를 입력하면 슬래시 메뉴가 열립니다 (placeholder "“/” 를 입력해서 상용구 추가"). 항목은 둘입니다.
    - 처방별 슬래시 명령 (`처방별슬래시commands`, `수가코드` 접두 일치)
    - `/settings/record`의 `병원상용구` 중 `전체사용여부`인 것 (`상용구명`, `내용`)
  - **리핏 반영:** 경과기록·약속처방에서 문단을 리핏하면 `appendContent`로 덧붙입니다. 같은 출처(`data-repeat-source`)는 먼저 지우고 다시 넣습니다.
  - **Crash-safe draft:** IndexedDB `crashSafeDraftDB`의 `drafts` 스토어에 `{ treatmentId, patientId, html, savedAt }`를 저장합니다 (500ms 디바운스, 3일 경과 시 폐기). 다시 열면 복구 배너가 뜹니다.
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoardEdit.vue`, `re-upstream/restored/components/base/BaseTreatmentEditor.vue.js`, `re-upstream/restored/modules/index/clearAllDrafts.js`, `re-upstream/restored/lib/index/dbName.js`

### 상병 — `TreatmentDisease`

- **목적:** 주상병·부상병을 입력합니다 (KCD 검색).
- **화면 구성:**
  - `TreatmentDiseaseTable`: 주/부, 상병코드, 상병명, "상병 추가", "상병 전체 삭제"
  - `DiseaseSearchModal`: 분류 필터(전체 분류 / 추나 상병 전체), 주상병·부상병·연계상병 선택, "함께 입력할 산정특례 특정기호"
  - `TreatmentViewBoardDiseaseSelectModal`: "상병을 다음 중 하나로 변경해주세요."
- **동작:**
  - 상병을 검색해 추가합니다. 연계 특정기호가 확정되면 헤더의 `setSpecificCode`로 반영합니다.
  - 리핏(개별 `handle개별상병리핏` / 전체 `handle전체상병리핏`) 때 해당 연도에 없는 코드면 선택 모달을 띄웁니다.
  - 저장 전에는 `validate산정특례특정기호`로 검증합니다.
- **데이터:**
  - static JSON `KCD_20250722`, `KCD_20260101`, `KOICD_20240829`, `KOICD_20260101` (staticClient)
  - `GET chart/kcd/recent`(최근 상병)
- **근거:** `re-upstream/restored/components/treatment/TreatmentDisease.vue`, `re-upstream/restored/components/disease/DiseaseSearchModal.vue`

### 처방 — `TreatmentViewBoardPrescriptionV2`

- **목적:** 보험구분별로 처방을 입력합니다. 표시 여부는 `showEmrFeatures`로 정합니다.
- **화면 구성** (보험구분 `보험구분$`별):

  | 보험구분 | 헤더 | 입력 패널 | 상태 패널 |
  |---|---|---|---|
  | `자보` | `TreatmentViewBoardPrescriptionCarHeader` (처방 검색, 권장 처방 추가, 내원일수 조회, 누적 자보 추나·첩약, 약침, 온냉요법, 변증) | `TreatmentViewBoardPrescriptionCar` → `TreatmentProcedures`, `TreatmentInsuranceMedicines`, `TreatmentCarInsuranceMedicines`, `TreatmentEtcPrescriptions`, `TreatmentNonBenefitPackage` | `PatientPackagePanel` |
  | `산재` | `TreatmentViewBoardPrescriptionNhicHeader` | `TreatmentViewBoardPrescriptionSanjaes` → 위와 같고 + `TreatmentViewBoardPrescriptionSanjaeChubyak` | `TreatmentViewBoardPrescriptionSanjaeInsuranceStatus`, `PatientPackagePanel` |
  | `건보`·`급여`·기타 | `TreatmentViewBoardPrescriptionNhicHeader` (`PrescriptionInputSearchTreatment`) | `TreatmentViewBoardPrescriptionNhics` → `TreatmentProcedures`(침·뜸부항·검사·추나·진찰료 `TreatmentPayment`), `TreatmentInsuranceMedicines`, `TreatmentEtcPrescriptions`, `TreatmentNonBenefitPackage`, `TreatmentViewBoardPrescriptionNhicChubyak` | `TreatmentViewBoardPrescriptionNhicInsuranceStatus` (건보 추나 주차별 횟수, 변증) |
  | EMR 기능 없음 (`showEmrFeatures` 거짓, 추정: SOO 계정) | — | `TreatmentViewBoardPrescriptionSoo` (`SooPrescriptionPanel`). 비대면 SOO 주문이면 읽기 전용 | — |

  - 공통 아래쪽: `TreatmentViewBoardPrescriptionTableV2`(처방명·일투·일수·금액, "처방 전체 삭제"), `TreatmentViewBoardPrescriptionClaimWarning`, `ProxyVisitClaimMemoBanner`가 있습니다.
- **처방 행 종류** (`TreatmentViewBoardPrescriptionTableRow`가 판정 순서대로 고릅니다):

  | 행 컴포넌트 | 대상 |
  |---|---|
  | `...RowAcupunctureCommon` / `Special` / `Bunku` | 침술 (일반 / 특수 / 분구) |
  | `...RowBodyPartSelectable` | 부위를 고를 수 있는 시술 |
  | `...RowPackage` / `...RowPackageDeduction` | 비급여 패키지 / 패키지 차감 (`GET /patients/{pid}/packages/{id}`) |
  | `...RowNonBenefit` | 비급여 (단가 입력, 할인, 처방경로 `PrescriptionRouteDropdown`, 사용 약재·처방 횟수 편집) |
  | `...RowChuna` | 추나 (횟수, `제출`) |
  | `...RowNhicChubyak` | 건보 첩약 시범사업 (클릭하면 aside `건보첩약` 탭) |
  | `...RowChubyak` | 자보·산재 첩약 |
  | `...RowHomeVisit` | 일차의료 방문진료 (`작성`/`제출`) |
  | `...RowInsuranceMedicine` | 보험 한약제제 |
  | `...RowCommon` | 그 밖 (진찰료, 검사, 치료재료 등) |

- **처방 종류와 카테고리 코드** (`카테고리숫자코드`, `re-upstream/restored/modules/index/part-103.js`의 `me`):

  | 종류 | 코드 예 |
  |---|---|
  | 급여 진찰료·시술 (침술·구술·부항·온냉경락·추나) | `31001001`, `33001001`~`33001005` |
  | 급여 보험약·조제료 | `34001001`, `34002001` |
  | 건보 첩약 시범사업 (첩약·한약재·조제탕전료·심층변증) | `35001001`~`35004001` |
  | 비급여 진료·시술·약침·처치·물리요법 | `51…`, `53001001`, `53001002`, `53002001`, `53003001` |
  | 비급여 한약(첩약)·탕전료·외용제·내복약 | `54003001`, `54004001`, `54005001`, `54006001` |
  | 자보 시술·자보약·조제료·첩약 | `73001001`, `74001001`, `74002001`, `74003001` |
  | 산재 시술·조제료·첩약 | `93001001`, `94002001`, `94003001` |

- **PRN:** 비급여 처방 행·검색 결과의 `isPrn`을 처방 항목의 `PRN여부`로 저장합니다. `PRN처방생성수정삭제`(`prescription_prn_write`) 권한 검사는 진료 보드에서는 보이지 않고, 데스크 수납 카드에서만 쓰입니다 ([permissions.md](../permissions.md)).
- **동작:**
  - 처방을 검색해 추가합니다 (`PrescriptionInputSearchTreatment`). 검색 대상은 `/settings/medicines`, `/settings/nonbenefits`, `/settings/nonbenefit-packages`, `/settings/treatments/expendables`, 수가코드, 자보 수가 JSON입니다.
  - 첩약류를 추가하면 aside 해당 탭이 자동으로 열립니다 (`selectAsideTab`).
  - 추나를 추가하면 승인 가드(`get추나승인가드결과`)가 돕니다. 이미 승인 요청한 내역이 있으면 "기존 요청을 취소하고 처방을 변경하시겠습니까?"를 묻습니다. 승인된 추나는 "업스트림 앱에서만 삭제할 수 있습니다."
  - 시술진료의를 지정합니다 (`PATCH /record/prescriptions/{id}`).
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoardPrescriptionV2.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardPrescriptionTableRow.vue`, `re-upstream/restored/modules/TreatmentViewBoard/part-16.js`, `re-upstream/restored/modules/TreatmentViewBoard/part-30.js`

### 경과기록 목록 — `TreatmentViewBoardRecordsList`

- **목적:** 환자의 과거 진료를 보고, 기록·상병·처방을 현재 진료로 리핏합니다.
- **화면 구성:**
  - 헤더: "경과기록", 검색(`진료기록/상병/처방명 검색`), 필터 팝오버(보험 구분, 진료 구분, 한약 포함, 패키지 포함, 기록 표시 구성), 달력 고정, 전체 열고 닫기, 삭제 모드
  - 항목(`TreatmentViewBoardRecordsListItem`): 고정된 기록, `비`/`패`/`한약` 칩, `조제상태` 칩. 리핏 버튼 그룹은 `기록 / 상병 / 처방 / 첩약 / 전체`입니다.
- **동작:**
  - **개별 리핏:** `repeatParagraph`·`repeatDiagnosis`·`repeatAllDiagnosis`·`repeatProcedure`·`repeatMultiProcedure` 이벤트로 현재 진료에 병합합니다. 비대면 진료에서는 처방 리핏을 막습니다 ("비대면 진료에서는 처방을 리핏할 수 없습니다.").
  - **기록 고정:** `PATCH /record/{rid}/fixed` (`고정된기록여부`). 초진료 처방이 있는 진료를 처음 저장하면 자동 고정합니다 (`초진기록자동고정여부`, 기본값 true).
  - **삭제:** `DELETE /record/{rid}`. 사유는 "중복된 기록 입력 / 잘못된 처방 또는 상병 입력 / 테스트 입력 / 기타(100자)" 중에서 고르게 하고, "삭제된 기록은 복구할 수 없으며 전자서명, 통계, 수납, 청구 등 모든 연관 기능에서 제외됩니다."라고 안내합니다. 오늘 기록을 지우면 `todayRecordDeleted`.
  - **다른 날짜에 진료 리핏** (`TreatmentViewBoardRecordsListMultiRepeatModal`): 달력에서 고른 일자마다 아래를 차례로 실행한 뒤 `/treatment/repeat-results`로 이동합니다.
    1. 건보 자격조회 `POST /nhic/m2/get-data` (`수진자성명`, `수진자주민등록번호`, `진료일자`, `본인확인여부`)
    2. 접수 `POST /desk/waiting`
    3. `POST /record/{rid}/save` (`보험구분`, `진료기록`, `진료상병`, `진료처방`, `명세서특정내역`, `할인금액`, `고정된기록여부: false`…)
    4. 오늘이 아니면 `PATCH /record/{id}/done` → `PATCH /desk/waiting/{내원Id}` `상태: "수납"`

    - 첩약 투약(첩건, 자보첩약)은 리핏에서 빠집니다.
    - 오늘 일자에 이미 작성된 내용이 있으면 "오늘 작성된 진료 내용을 대체하시겠습니까?"를 확인합니다.
- **데이터:** `GET /record/patient/{pid}` (`days_ago`, `limit`, `next`, `type`), `GET /record/patient/{pid}/record/date`, `GET /chart/medical-treatments`
- **상태 저장:** `useRepeatedTreatmentStore`(`persist: true`, `repeatedRecords` 최대 100건, type `리핏됨`/`수납필요`/`수납완료`), `treatmentRecordKeys.treatmentRecordList/Infinite({ pid })`, `deskKeys.waiting/appointment(날짜)`
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoardRecordsList.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardRecordsListMultiRepeatModal.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoardRecordListDeleteModal.vue`, `re-upstream/restored/stores/repeatedTreatment.js`

### 하단 바 — `TreatmentViewBoardFooter`

- **화면 구성:** `청구 메모`(`TreatmentViewBoardFooterClaimMemoModal`), `약속처방 등록`, `임시 저장`, 완료 버튼, 수납 금액 요약(`수납:`), 목표 본부금(`TreatmentViewBoardBudgetTargetPopover`), 비급여 선택(`NonBenefitTreatmentSelector`), 청구 경고(`ClaimWarningCardsPopover`)가 있습니다.
  - 완료 버튼은 비대면 SOO면 단일 버튼, 아니면 `StageMoveControl`입니다. `StageMoveControl`의 옵션은 `차팅 완료 / 대기 / 치료 / 수납` 중 현재 상태를 뺀 것입니다.
- **동작:**
  - `임시 저장`: `savePatientRecord({ 진찰료중복안내: true })`
  - 완료(이동): `finishPatientRecord(상태)` (아래 [저장·완료](#저장완료-로직))
  - `약속처방 등록`: `처방수가설정` 권한이 있어야 하고, 진찰료 말고 다른 처방이나 상병이 있을 때만 켜집니다. `TreatmentViewBoardRegisterReservedPrescriptionModal` → `POST /settings/appointed-prescriptions` (그룹, 사용 범위 `내 계정만`/`모든 진료의`, 진찰료 제외)
  - 목표 본부금 프리셋: `PUT /settings/budget-target-presets/doctors/{진료의Id}`
  - 권한이 없으면 "현재 권한으로는 조회만 가능합니다."
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoardFooter.vue`, `re-upstream/restored/modules/TreatmentViewBoard/getRoot.js`

### 저장·완료 로직

- **저장 `savePatientRecord`** (`j6` → `U6`):
  1. 산정특례 특정기호를 검증합니다. 옵션을 주면 동일일자 진찰료 중복도 검증하고, 중복이면 `진찰료중복으로저장중단됨`으로 표시하고 멈춥니다.
  2. 페이로드 `buildPatientRecordPayload()`(`O6`)를 만듭니다. 서버 원본과 달라진 필드만 넣습니다.
     - `보험구분`, `진료상병`, `진료처방`, `진료기록`(에디터 HTML), `한방첩약시범사업`, `방문진료대상구분`, `비대면시범사업여부`, `_100여부`, `희귀난치의료비지원진료여부`, `자보1일2차여부`
     - `진료의Id`·`진료항목Ids`·`기준일시`는 바뀐 경우에만 넣습니다
     - `명세서특정내역`, `건강보험원본`/`재조회건강보험조회`(aside에서 자격을 재조회한 경우), `할인금액`, `한방첩약시범사업승인여부`, `고정된기록여부`, `처방경로`
  3. `POST /record/{rid}/save`로 보냅니다. 탕전관리 v2가 켜져 있으면 비급여 한약 OCS 정보를 페이로드에 넣습니다.
     - SOO 단독 계정(`vx`)이고 비대면 SOO가 아니면 `PATCH /desk/nonbenefit-intake/{id}` 또는 `POST /desk/nonbenefit-intake`를 씁니다
  4. 성공하면 "환자 기록이 저장되었습니다."
- **완료 `finishPatientRecord(상태 = "치료")`** (`I6` → `b6`):
  1. 건보 첩약 승인을 확인합니다 (`checkNhicChubyakApproval`).
  2. 저장 → `PATCH /record/{진료Id}/done` → 추나 자동 승인 (`autoApproveChuna`, `POST /record/hira/prescriptions/approval`, 연간 횟수를 넘으면 건너뜀)
  3. 내원 상태를 옮깁니다 (`PATCH /desk/waiting/{내원Id}` `상태`).
     - 치료실 베드에 있던 환자를 `대기`/`수납`으로 옮기면 먼저 `PATCH /treatments/patients/{내원Id}/status` `치료완료: true`를 보냅니다
     - `차팅 완료`는 이동하지 않습니다
  4. 토스트 "○○님이 수납으로 이동했습니다." 등을 띄웁니다. 오늘 진료이면 다음 대기 환자(같은 진료의)를 미니 데스크에서 포커스합니다.
  - 비대면 SOO는 수령일정이 필요하면(`QS && !YS`) 수령일시 모달을 먼저 요청합니다. 완료 뒤에는 `PATCH /desk/telemedicine-consultations/{예약Id}/status` `complete` → "진료가 완료되었습니다. 이제 약을 배송해주세요."
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoard.helpers-12.js`, `re-upstream/restored/components/treatment/TreatmentViewBoard.helpers-12.helpers.js`, `re-upstream/restored/components/treatment/TreatmentViewBoard.helpers-11.js`, `re-upstream/restored/components/treatment/TreatmentViewBoard.helpers-11.helpers.js`, `re-upstream/restored/modules/TreatmentViewBoard/part-42.js`, `re-upstream/restored/modules/SidePanelDeskActions/part-2.js`

## 진료 보드 사이드 패널 — `TreatmentViewBoardAside`

- **목적:** 진료 중에 참조하거나 부가 입력할 패널을 탭으로 묶은 것입니다. 폭이 좁으면(`shouldHideAside`) 또는 수동으로 접으면 80px 아이콘 레일의 팝오버(`BasePopover`, 560px)로 바뀝니다.
- **기본 탭:** `약속처방`. 비대면 SOO 진료나 SOO 항목 처방이 있으면 `연락이력`이 됩니다.
- **자동 전환** (`NV`):

  | 추가한 처방 | 열리는 탭 |
  |---|---|
  | 추나 | `추나시술내역` |
  | 자보·산재 첩약 | `첩약내역` |
  | 건보첩약 | `건보첩약` |
  | 비급여 한약 | `비급여첩약` |
  | 방문진료 | `일차의료방문` |

  쿼리 `focusChubyak`이 있으면 그 처방의 탭을 열고 약재 편집에 포커스합니다.
- **탭 목록:**

  | 탭 키 | 라벨 | 노출 조건 | 컴포넌트 | 주요 API |
  |---|---|---|---|---|
  | `약속처방` | 약속 처방 | 항상 | `TreatmentViewBoardAsideReserved` (그룹 접기, "접수 조건에 맞는 것만 표시") | `GET /settings/appointed-prescriptions`, `/groups` |
  | `연락이력` | 연락 이력 | 비대면 SOO 진료, 또는 SOO 항목 처방 포함 | `CrmContactsViewDetailActionLogs` | (CRM 문서) |
  | `추나시술내역` | 추나 시술 내역 | SOO 단독 계정(`vx`) 아님 | 산재: `TreatmentViewBoardAsideSanjaeChunaHistory` / 그 밖: `TreatmentViewBoardAsideChunaHistory` (승인필요 표시, 상세 `...ChunaHistoryDetail`) | `GET`·`POST /chart/chuna/patients/{pId}`, `GET /record/hira/chuna`, `POST /record/hira/prescriptions/approval`, `GET chart/sanjae/record/{rid}/chuna` |
  | `첩약내역` | 첩약 내역 | 보험구분 `자보` 또는 `산재` | `TreatmentViewBoardAsideJaboChubyak` (자보 첩약 제출·제출 내역 삭제) / `TreatmentViewBoardAsideSanjaeChubyakHistory` (요양승인번호·비고) | 자보 수가 JSON, `/settings/hospitals` |
  | `건보첩약` | 첩약 내역 | `건보` + (한방첩약시범사업 또는 시범사업 처방 포함) | `TreatmentViewBoardAsideNhicChubyak` (처방 이력, 체크리스트 작성, 첩약 제출) | `GET`·`POST /chart/pcmd/patients/{pId}`, `GET /settings/hospitals/chubyak-pilots/prescriptions/categories/{key}` |
  | `비급여첩약` | 비급여 첩약 | 비급여 한약 처방 포함 또는 탕전관리 v2 활성 | `TreatmentViewBoardAsideNonBenefitChubyak` (사용 약재·용량·복용법·탕전 방식, `탕전 처방 작성`, `메디원탕 주문`) | `GET`·`PATCH /ocs/{ocsId}`, `GET /tangjeon/treatment-prescriptions/{id}/draft`, 비급여 한약 템플릿 |
  | `보험정보` | 보험 정보 | `vx` 아님 | `TreatmentViewBoardAsideInsuranceInfo` (자격 조회, 건보/자보/산재 자격·보장한도·사고접수번호 등) | `POST /nhic/m2/get-data`, `GET /patients/{id}/car-waiting`, `GET /patients/{id}/car-waiting/amount/{report_number}` |
  | `실손조회` | 실손보험 정보 | 항상 | `TreatmentViewBoardAsideInsuranceInquiry` (실손 조회 결과, 기타 보장 특약, 새 창 조회) | `POST insuranceClient /emr/patients/{id}/latest-lookup`, `POST insuranceClient /patients/{id}/claim` |
  | `신체정보` | 신체 정보 | `vx` 아님 | `BodyInfoPanel` | `GET /desk/body-measurements/patients/{id}`, `POST`/`PATCH`/`DELETE /desk/body-measurements…`, `GET /settings/treatments/vitals` |
  | `상용구` | 상용구 | 항상 | `TreatmentViewBoardAsideEditorTemplates` (검색, "처방별 상용구", 더블 클릭으로 적용, 편집은 `상용구설정` 권한) | `GET`/`POST`/`PATCH`/`DELETE /settings/treatment-templates` |
  | `일차의료방문` | 일차의료방문 | 환자 `일차의료방문여부` + 보험 `건보`/`급여` + `방문진료대상구분` | `HomeVisitAsidePanel` (대상자 등록·점검 서식, 동의서 보내기) | `PATCH /record/home-visit/{rid}/form-status` |
  | `제주지원사업` | 제주 지원사업 | 제주 지원사업 사용 중 + 활성 사업 있음 | `TreatmentViewBoardJejuSupportPanel` (대상으로 등록·수정) | `/patients/{id}/jeju-supports…`, `/desk/jeju-snapshot/{recordId}`, `/chunggu/jeju/*` |
  | `문진표` | 문진표 | `문진표노출가능` + 아직 고정 안 됨 | `TreatmentViewBoardQuestionnairePanel` ("문진표 고정"을 누르면 외부 열로 고정) | (태블릿 문진 문서) |
  | `진료승인` | 진료승인 | 보험구분 `급여` (의료급여) | `TreatmentViewBoardAsideMedicalAids` ("진료승인 요청") | `GET /nhic/m3/{id}`, `GET /nhic/m4/internal-data/{id}` |
  | `원외탕전주문` | — | 탭 키는 있으나 레일 버튼이 보이지 않음 | `OcsV2DecoctionOrderAsideAccordion` | (탕전 문서) |

  - 첩약 4종 패널(`자보`/`산재`/`건보`/`비급여`)은 `Teleport`로 펼친 패널이나 팝오버 안에 렌더합니다. 첩약 삭제는 `TreatmentViewBoardAsideChubyakDeleteModal`로 확인합니다.
- **상태 저장:** `asideTab`(ref), `aside수동접힘`, `useIntakeLinkPromptStore`
- **근거:** `re-upstream/restored/components/treatment/TreatmentViewBoardAside.vue`, `re-upstream/restored/components/treatment/TreatmentViewBoard.helpers.js`

## 반복 처방(리핏) 결과 — `/treatment/repeat-results`

- **목적:** "다른 날짜에 진료 리핏"을 끝낸 뒤 결과를 요약하고 수납으로 넘깁니다.
- **접근 조건:** `usesGlobalLayout`만 있고 `requiresAuth`·권한 코드는 없습니다.
- **화면 구성:** "N건의 진료를 리핏했습니다.", 그룹별 `TreatmentRepeatResultsViewTable`, `진료차트로 돌아가기`, 오른쪽 사이드 패널 `DeskVisitPaymentCheckOut`(`is-repeat-checkout`)
  - **수납 필요:** 과거 일자. 공단 승인 안내와 `수납하기` 버튼
  - **리핏됨:** 오늘. "오늘 진료는 저장만 되었습니다. 차트에서 진료를 완료한 뒤 수납해 주세요."
  - **수납 완료**
- **동작:**
  - 표의 각 행은 진료Id마다 `GET /record/{id}`로 채웁니다: 일자, 초진/재진, 보험, 가산(야간·공휴·토요, 진찰료 수가코드로 판정), 본인부담금, 총액.
  - 수납을 끝내면 `finishReceiptRecord(ids)`를 호출하고, 각 `내원Id`에 `PATCH /desk/waiting/{내원Id}` `상태: "수납완료"`를 보냅니다.
  - "진료차트로 돌아가기"는 store를 `$reset`한 뒤 `리핏됨` 진료(없으면 원래 진료)로 `switchPatient`합니다.
- **상태 저장:** `useRepeatedTreatmentStore` (persist)
- **근거:** `re-upstream/restored/views/TreatmentRepeatResultsView.vue`

## 치료실 보드 — `/treatment-rooms`

- **목적:** 오늘 내원 환자를 치료실 베드에 배정하고, 베드별 시술(치료 항목) 진행과 타이머를 관리합니다.
- **접근 조건:**
  - `permissionCode: 치료실`(`treatment_rooms`), EMR 계정만
  - "내 환자만 보기"는 `역할타입`이 대표원장·부원장이고 `진료의Id`가 있을 때만 켤 수 있습니다
- **화면 구성:**
  - 왼쪽 접이식 `TreatmentRoomsPatientsMiniDashboard` (탭 `예약 / 대기 / 치료대기 / 치료완료`, 기본 `치료대기`, 카드 드래그 가능)
  - `TreatmentRoomsHeader`
    - 치료실 탭 (`selectedTab`, 치료실이 여러 개이고 탭을 고르지 않았으면 전체 보기)
    - 환자 검색 (한글 초성 매칭 `f_2`), 내 환자만 보기, 차팅 완료 수
    - `TreatmentRoomsHeaderActingOrder` (원장님 액팅 순서), 타이머 설정, `TreatmentRoomsDisplaySettingsPopover` (베드에 메모 보이기, 치료 타이머 뷰, 모든 기기에 적용), `TreatmentRoomsRoomOrderSetting` (치료실 순서)
  - 본문: 치료실 하나면 `TreatmentRoomsRoomBeds`, 전체 보기면 `TreatmentRoomsRoom`을 반복합니다.
  - 베드 카드(`TreatmentRoomsBedCard`)에는 `TreatmentRoomsDoctorBadge`, 메모, 치료 추가(치료 항목 검색), `TreatmentRoomsTxList`가 있습니다. 시술 보기 방식은 `컬럼형`/`목록형`(`TreatmentRoomsTxViewModeToggle`)입니다.
  - 오른쪽 `PatientInfo` 패널 (기본 탭 "처방 내용", 메모 탭 `직원`)
  - 모달: `TreatmentRoomBedAssignModal`(베드 배정/수정), `TreatmentRoomRegisterOrModifyModal`(치료실 등록), `TreatmentRoomsTimerSettingsModal`
- **동작:**
  - **베드 배정:**
    - 카드를 베드로 드래그하면(`useTouchDragAndDropPolyfill`로 터치 지원) `PUT /treatments/patients/{내원Id}` (`치료실설정Id`, `치료실베드`)
    - 치료실이 없으면 "환자 이동 전 치료실 등록이 필요합니다."
    - 이미 치료를 마친 환자면 `DuplicateTreatmentRoomConfirmDialog`로 확인합니다
  - **배정 모달** (카드 더블클릭: 목록에서는 "베드 배정", 베드에서는 "베드 수정"):
    - 베드 위치, 진료의, 전달사항 (`PUT /noti/instructions` `내원Id`·`내용`, `DELETE /noti/instructions/{id}`), "현재 사용 가능한 베드만 표시"
    - 내원 정보 갱신 `PATCH /desk/waiting/{id}`
  - **치료 완료:** `PATCH /treatments/patients/{내원Id}/status` (`치료완료`). 메모는 `POST /patients/{pid}/memos`로 남깁니다.
  - **시술 타이머** (`Rp`, `re-upstream/restored/modules/TreatmentRoomsView/duration_sec.js`):

    | 동작 | API |
    |---|---|
    | 시작 / 재시작 / 완료 / 완료 해제 | `POST /treatments/procedures/{id}/start` · `/restart` · `/complete` · `/uncomplete` |
    | 타이머 조정 | `PATCH /treatments/procedures/{id}` (`duration_sec`) |
    | 삭제 | `DELETE /treatments/procedures/{id}` |
    | 순서 변경 | `PATCH /treatments/procedures/order` (`orderedIds`, `visitId`) |
    | 팝오버에서 추가 | `POST /treatments/procedures/from-popover` (`treatmentItemConfigId`, `visitId`) |
    | 치료세트 적용·시작·완료 | `POST /treatments/procedures/apply-group` · `/group/start` · `/group/complete` (`groupId`, `visitId`) |

    - 시술 상태는 `running` 등이고, 담당은 `원장`→`doctor` / 그 밖→`staff`입니다. 남은 시간은 서버 `serverNow`와 시계 차이를 보정해 계산합니다.
  - **타이머 설정 모달:** "베드 배정 시 기본으로 시행할 치료의 순서와 타이머". 기본 치료와 추가 치료, 치료세트가 있습니다. `PUT /treatments/timer-config` (`items`), `POST`/`PUT`/`DELETE /treatments/groups` (`그룹명`, `items`, `기본그룹여부`, `순서`)
  - **발침:** `TreatmentRoomsNeedleRemovalPopover`/`...TxColumnNeedleRemover`에서 발침자를 고르거나 직접 입력합니다. `POST /treatments/actings/needle-removals` (`내원Id`, `발침자명`), `GET /treatments/actings/needle-removers`
  - **메시지 전송:** 시술 팝오버에서 채널을 골라 보냅니다. `POST syncClient /quick-messages`, `GET syncClient /rooms`, `/quick-messages/recent-channel`
  - **치료실 등록·수정:** `POST /settings/treatments/rooms`, `PATCH /settings/treatments/rooms/{id}` (`치료실명` 최대 20자, `베드수`)
  - **메모 노출 카테고리:** `PATCH /settings/treatments/rooms/memo-categories` (`치료실노출메모카테고리`)
- **데이터:**

  | API | 내용 |
  |---|---|
  | `GET /settings/treatments/rooms` | `results.치료실설정`: `치료실Id`, `치료실명`, `베드수` |
  | `GET /treatments/patients` | `results.환자목록`: `내원Id`, `환자Id`, `환자이름`, `진료의Id`, `보험구분`, `진료타입`, `진료항목목록`, `치료실현황`, `차팅완료여부`, `진행중인패키지여부`, `예약Id` |
  | `GET /treatments/snapshot` | `results.베드목록[].시술목록`, `serverNow` |
  | `GET /treatments/timer-config`, `GET /treatments/groups` | 타이머 설정, 치료세트 |

- **상태 저장:**
  - query key: `treatmentRoomsKeys.treatmentPatients()` (staleTime 5분), `treatmentRoomsV2Keys.snapshot()` (이 화면에서 5초 polling), `timerConfig()`, `groups()`
  - localStorage: `treatmentRooms:isWaitingListOpen`, `treatmentRooms:showMyPatientsOnly`
- **전역 타이머 알림:** 앱 셸(`ZWt`)은 `치료실` 접근 권한이 있으면 어느 화면에서든 snapshot을 1분마다 polling하고, 시술 종료 시각에 맞춰 setTimeout을 겁니다. 종료되면 알림음과 기기 알림("NN베드 ○○님 … 타이머가 종료되었습니다.")을 냅니다. 태블릿 WebView면 대신 `postMessage({ type: "TREATMENT_TIMER_END" })`를 보냅니다.
- **근거:** `re-upstream/restored/views/TreatmentRoomsView.vue`, `re-upstream/restored/components/treatment/TreatmentRoomBedAssignModal.vue`, `re-upstream/restored/components/treatment/TreatmentRoomsTimerSettingsModal.vue`, `re-upstream/restored/modules/constants/useTreatmentsPatientsQuery.js`, `re-upstream/restored/modules/index/useTreatmentsSnapshotQuery.js`, `re-upstream/restored/components/app/App.helpers-2.js`, `re-upstream/restored/modules/index/part-256.js`

## 태블릿 연동 — `/tablet/auth-link`, `/tablet/treatment-rooms`

- **목적:** 태블릿 앱(React Native WebView)에 치료실 보드를 임베드합니다.
- **접근 조건:** `auth-link`는 meta가 없습니다. `tablet/treatment-rooms`는 `requiresAuth` + `치료실` 권한이 필요합니다.
- **동작:**
  - `/tablet/auth-link?token=…&redirect=…`:
    1. `POST authClient /sso/exchange` (`linkToken`) → `setupLoginSession(결과, "upstream")` → `redirect`로 이동합니다. `redirect`가 `/`로 시작하고 `//`가 아닐 때만 쓰고, 기본값은 `/tablet/treatment-rooms`입니다.
    2. 실패해도 localStorage에 `accessToken`이 남아 있으면 그대로 이동합니다. 아니면 "로그인에 실패했습니다…"를 표시하고 `postMessage({ type: "AUTH_ERROR" })`를 보냅니다.
  - `/tablet/treatment-rooms`: `TreatmentRoomsSuspense`를 `tablet-embed` 전체 화면으로 렌더하고, 마운트되면 `postMessage({ type: "EMBED_READY" })`를 보냅니다.
  - 브리지: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`를 씁니다 (`PUt`, 감지는 `J0e`).
- **관련 설정** (다른 문서): 태블릿 계정·세션(`/tablet/accounts`, `/tablet/sessions`), 사진 요청(`/tablet/photo-requests`), 치료 항목(`/tablet/settings/treatment-items`)
- **근거:** `re-upstream/restored/views/TabletAuthLinkView.vue`, `re-upstream/restored/views/TabletTreatmentRoomsView.vue`, `re-upstream/restored/stores/patient.js`

## 차트 그림(캔버스) — `/canvas`

- **목적:** 환자별 인체도·그림(벡터)을 그리고 저장하는 별도 창입니다.
- **접근 조건:** 라우트 meta가 없습니다. 진료 보드의 `CanvasTrigger`가 `canWriteTreatmentRecordPermission`일 때 켜집니다.
- **동작:**
  - `window.open("/canvas?patientId=…&selectedCanvasTab=new|saved[&disabled=true][&doctorId=…]", "canvas")`로 엽니다. 창이 이미 열려 있으면 `postMessage({ selectedCanvasTab })`로 탭만 바꿉니다.
  - 템플릿 목록(`CanvasViewTemplateList`: 검색, 템플릿 추가, 이미지 업로드 10MB 이하, 영상 캡처)과 저장된 환자 이미지 목록(`CanvasViewPatientImageList`)이 있습니다.
  - 최대 6개(`We`)까지 열어 `CanvasGridPane`에서 편집합니다 (도구 `UpCanvasToolbar`, konva). 저장, 다른 이름으로 저장, 모두 저장, 이름 변경을 지원하고, 닫을 때 변경 내용을 확인합니다.
  - `CanvasVideoCaptureModal`: 영상 장치 화면을 보면서 Space 키로 연속 캡처합니다.
- **데이터:**

  | API | 내용 |
  |---|---|
  | `GET /patients/{id}/canvas/images` (`after`), `GET …/{iid}`, `GET …/count` | 목록·상세·개수 |
  | `POST /patients/{id}/canvas/images` | `벡터데이터`, `이미지명`, `이미지사이즈`, `미리보기이미지사이즈`, `캔버스템플릿Id`, `템플릿카테고리` |
  | `PUT /patients/{id}/canvas/images/{iid}` | 수정 |
  | `PATCH …/{iid}/name` | 이름 변경 |
  | `DELETE …/{iid}` | 삭제 |
  | `GET`/`POST`/`PATCH`/`DELETE /record/canvas/templates`, `GET /record/canvas/templates/category/{category}/id/{id}` | 템플릿 |

- **상태 저장:** `canvasKeys.canvasImageCount(patientId)` (창이 닫히면 무효화)
- **근거:** `re-upstream/restored/views/CanvasView.vue`, `re-upstream/restored/components/canvas/CanvasTrigger.vue.js`, `re-upstream/restored/modules/CanvasView/part-1.js`

## 흐름

1. **환자 호출:**
   - 데스크나 미니 데스크에서 카드를 누르면 `/treatment?patientId=&recordId=`로 이동하고, `useTreatmentStore.selectRecord`가 진료·환자·설정·인덱스 쿼리를 불러옵니다.
   - 오늘 접수가 없으면 `새 차트 생성`으로 `POST /desk/waiting`을 보냅니다.
2. **진료기록 작성:** 에디터에 서술하고 `/` 상용구를 씁니다. 경과기록·약속처방에서 리핏할 수 있고, 캔버스는 별도 창입니다. 작성 내용은 IndexedDB에 draft로 남습니다.
3. **상병:** KCD로 검색하고 산정특례·연계상병을 지정합니다.
4. **처방:** 보험구분별 패널에서 처방을 추가합니다. 첩약·추나는 aside 탭에서 제출·승인하고, 약속처방을 드래그·적용하면 상병·처방·기록이 한꺼번에 들어갑니다.
5. **저장:** `임시 저장` → `POST /record/{rid}/save`
6. **완료와 단계 이동:** `StageMoveControl`에서 `치료`(기본)·`대기`·`수납`·`차팅 완료` 중 고릅니다. `PATCH /record/{id}/done` → `PATCH /desk/waiting/{내원Id}`
7. **치료실:** `치료`로 넘어간 환자는 `/treatment-rooms`의 `치료대기` 탭에 보입니다. 베드에 배정하면 `PUT /treatments/patients/{내원Id}`, 기본 치료세트와 타이머로 시술을 진행합니다 (`/treatments/procedures/*`). 타이머가 끝나면 전역 알림이 뜨고, `치료완료`(`PATCH …/status`)를 거칩니다.
8. **수납:** 다른 문서의 영역입니다. 진료 완료 때 베드에 있던 환자를 `수납`으로 옮기면 치료완료 처리가 함께 됩니다.

## 미확인·추정

- **전자서명:** 진료 보드 안에서 서명을 받는 UI나 API는 보이지 않습니다. 기록 삭제 안내에 "전자서명"이 연관 기능으로 언급되고, 서명 조회는 `GET /signing/medical-records/record/{record_id}`(`ElectronicSignatureView`)에만 있습니다. 진료기록 전자서명은 별도 화면에서 하는 것으로 보입니다 (추정).
- **기록 삭제 사유:** `DELETE /record/{rid}`에 사유를 보내는지 확인하지 못했습니다. endpoints.md에는 body 키가 없습니다.
- **`원외탕전주문` 탭:** 탭 키는 있지만 레일 버튼을 찾지 못했습니다. 다른 경로로 `asideTab`을 정하는 것으로 보입니다 (추정).
- **`/canvas` 접근 제어:** route meta가 없어서 가드의 인증 처리를 확인하지 못했습니다. `disabled=true` 쿼리를 CanvasView가 어떻게 해석하는지도 확인하지 못했습니다.
- **`/treatment/repeat-results`:** `requiresAuth`가 없습니다. 의도인지는 확인하지 못했습니다.
- **`AiAgent`:** 래퍼의 기능은 분석하지 않았습니다. `GET /chart/record-llm/record/{id}`(`진료llm대화목록`)가 TreatmentView 청크에 있습니다.
- **`window.__treatmentNavigate`:** 호출하는 쪽을 찾지 못했습니다 (외부·임베드 진입용으로 추정).
- **`showEmrFeatures` 거짓 경로:** `TreatmentViewBoardPrescriptionSoo`를 SOO(비급여 전용) 계정 화면으로 보았습니다 (추정).
- **minify된 식별자:** `QS`/`YS`/`XS`(SOO 주문 상태 판정), `gle`(오늘 여부)는 사용 맥락으로만 의미를 추정했습니다.
