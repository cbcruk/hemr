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
- 근거: `restored/router/routes.js`, `restored/components/treatment/TreatmentSuspense.vue`, `restored/components/treatment/TreatmentRoomsSuspense.vue`, `restored/lib/index/part-196.js`

---

## 진료 화면 셸 — `/treatment`

- **목적:** 진료 보드를 감싸는 화면입니다. 미니 데스크(환자 목록), 비대면(LITE) 주문 상태 바, 페이지 이탈 가드를 맡습니다.
- **접근 조건:** `permissionCode: 진료`. 화면 안에서 쓰는 쓰기 권한은 [진료 보드](#진료-보드--treatmentviewboard)를 참고하세요.
- **화면 구성:**
  - `AiAgent`로 전체를 감쌉니다.
  - 왼쪽 320px 미니 데스크(`PatientsMiniDashboard`)의 탭은 `예약 / 대기 / 치료 / 수납 / 진료한 환자`입니다. LITE 단독 계정(`vx`)은 `예약 / 진료한 환자`만 보입니다.
  - `TreatmentViewLiteStatusBar`: 비대면 LITE 진료일 때만 보입니다.
  - 본문은 `TreatmentViewBoard`이고, 모달은 `NonBenefitPatientsViewTelemedicineCancelModal`·`NonBenefitPatientsViewTelemedicineVisitScheduleModal`·`TreatmentViewLiteInvoiceModal`입니다.
- **동작:**
  - URL 쿼리 `patientId`, `recordId`, `type`(보험구분), `accidentReportNumber`, `focusChubyak`, `liteOrderId`를 보드 props로 넘깁니다.
  - 다른 환자로 바뀌면 다음 페인트 뒤에 적용하고, 그동안 "차트 정보를 불러오는 중입니다" 오버레이를 띄웁니다 (`bo`/`ho`, 최대 200ms).
  - `patientId`가 없으면 미니 데스크를 엽니다. 단축키 `Def$.대기환자패널`로 토글하고, 방향키·Enter·Esc로 카드를 탐색합니다. 화면 폭이 1992px 이상이면 미니 데스크가 본문을 밀어내고, 그보다 좁으면 오버레이로 뜹니다.
  - 카드를 클릭하면 `switchPatient` → `router.push({ name: "treatment", query: { patientId, recordId } })`.
  - **이탈 가드**(`uZt`/`dZt` = route leave/update 가드): 수정 사항(`진료내용수정됨`)이 있으면 "저장하지 않은 작성 내용이 있습니다." 대화상자를 띄웁니다.
    - **저장하고 이동:** `savePatientRecord`를 호출합니다. 진찰료 중복이나 한약 템플릿 조회 실패로 저장이 중단되면 이동을 막습니다.
    - **저장 안함:** crash-safe draft와 레코드 상태를 지우고 store를 `$reset`합니다.
  - 마이그레이션 진료(`preventPrescriptionRepeat`)는 가드 없이 이동합니다.
  - `window.__treatmentNavigate(patientId, recordId)`를 전역에 등록합니다 (외부 진입용, 추정).
  - **비대면 LITE 상태 바:** 주문 `status`를 `inProgress / complete / pickupWaiting / shipping / delivered / confirmed / pickupComplete / cancel`로 매핑합니다.
    - 진료 취소·환불: `PATCH /desk/telemedicine-consultations/{예약Id}/status` (`status: "cancel"`, `cancelReason`)
    - 방문수령 완료: 같은 API에 `status: "pickupComplete"`
    - 수령일시 전송: `patchLiteOrderVisitSchedule(orderId, { visitSchedule })`. 진료시작 상태였다면 이어서 `finishPatientRecord("치료", { skipPickupCheck: true })`를 호출합니다
    - 송장 입력: `POST /desk/telemedicine-consultations/{예약Id}/invoice` (`invoiceList`)
- **데이터:** `GET /desk/waiting?date=`(오늘 대기 목록, `내원Id` 찾기), `GET liteClient members/emr/orders/{주문식별자}`, `GET liteClient members/emr/consultations/orders/{id}/invoice`
- **상태 저장:**
  - `useTreatmentStore`: 비활성화(deactivate) 때 `인덱스쿼리구독중지`, unmount 때 `$reset`·`$dispose`
  - query key: `liteKeys.all`, `treatmentRecordKeys.treatmentRecord(id)`, `treatmentRecordKeys.treatmentRecordList({ pid })`
  - 재활성화 시 환자 메모를 무효화합니다 (`invalidatePatientMemoQuery`)
- **근거:** `restored/views/TreatmentView.vue`, `restored/views/TreatmentView.helpers.js`

## 진료 보드 — `TreatmentViewBoard`

- **목적:** 한 환자의 한 진료(`진료Id`)를 편집하는 메인 작업 공간입니다.
- **접근 조건** (`s6`, `restored/modules/TreatmentViewBoard/part-32.js`):

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
  - 상단: `TreatmentViewBoardPatientInfo`. 환자 배지, 가족, 소개자, 진료의·진료항목 선택이 있고, 메뉴는 `새 차트 생성`(`TreatmentViewBoardNewChart`: 건보/자보/산재/일반, 진료일), `차트 초기화`, `문서 발급`, `탕전 처방 작성`, `외부원탕 주문`, 데스크 액션(`SidePanelDeskActions`)입니다.
  - 외부 열(크기 조절·드래그로 재배치 가능, `IS`): `메모`(`PatientMemo`, 기본 탭 `진료의`), `경과기록`(`TreatmentViewBoardRecordsList`), `문진표`(`TreatmentViewBoardQuestionnairePanel`, 고정 시), `비대면진료`(`TreatmentViewBoardLiteOrderPanel`, LITE 주문이 있을 때)
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
  | `POST`/`PATCH /desk/nonbenefit-intake` | LITE 단독 계정 저장 |
  | `PATCH /ocs/{ocsId}` | 원내 탕전 OCS |

- **상태 저장:**
  - `useTreatmentStore` (`restored/stores/treatment.js`):
    - `selectRecord({ 진료Id, 환자Id })`로 대상을 고르고 `진료내용`(편집 중 사본), `진료데이터`(서버 원본), `초기스냅샷`, `최근진료기록`, `같은날자보진료기록`, `희귀상병데이터`, `병합된상병Ids/처방Ids`를 가집니다.
    - `진료내용수정됨`은 `진료기록·상병·처방·보험구분·기준일시·진료타입·진료의Id·진료항목Ids·한방첩약시범사업·명세서특정내역·_100여부·할인금액·처방경로·보험조회` 중 하나라도 스냅샷과 다르거나 `ocsDirty`이면 참입니다.
    - `진료데이터` 조회에 실패하면 `/treatment`로 이동합니다.
  - 인덱스 쿼리(`인덱스쿼리구독시작`): KCD 2026, 수가코드(`reimbursement-codes`), 자보 수가 JSON, 희귀질환 JSON을 기준일시에 맞춰 구독합니다. 출처는 `restored/modules/index/local.js`의 `qFt`입니다.
  - 기타 store: `useHiraSubmissionStore`, `useMedicalAidsStore`, `useClaimWarningStore`(청구 경고)
- **근거:** `restored/components/treatment/TreatmentViewBoard.vue`, `restored/components/treatment/TreatmentViewBoardPatientInfo.vue`, `restored/components/treatment/TreatmentViewBoardEditHeader.vue`

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
- **근거:** `restored/components/treatment/TreatmentViewBoardEdit.vue`, `restored/components/base/BaseTreatmentEditor.vue.js`, `restored/modules/index/clearAllDrafts.js`, `restored/lib/index/dbName.js`

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
- **근거:** `restored/components/treatment/TreatmentDisease.vue`, `restored/components/disease/DiseaseSearchModal.vue`

### 처방 — `TreatmentViewBoardPrescriptionV2`

- **목적:** 보험구분별로 처방을 입력합니다. 표시 여부는 `showEmrFeatures`로 정합니다.
- **화면 구성** (보험구분 `보험구분$`별):

  | 보험구분 | 헤더 | 입력 패널 | 상태 패널 |
  |---|---|---|---|
  | `자보` | `TreatmentViewBoardPrescriptionCarHeader` (처방 검색, 권장 처방 추가, 내원일수 조회, 누적 자보 추나·첩약, 약침, 온냉요법, 변증) | `TreatmentViewBoardPrescriptionCar` → `TreatmentProcedures`, `TreatmentInsuranceMedicines`, `TreatmentCarInsuranceMedicines`, `TreatmentEtcPrescriptions`, `TreatmentNonBenefitPackage` | `PatientPackagePanel` |
  | `산재` | `TreatmentViewBoardPrescriptionNhicHeader` | `TreatmentViewBoardPrescriptionSanjaes` → 위와 같고 + `TreatmentViewBoardPrescriptionSanjaeChubyak` | `TreatmentViewBoardPrescriptionSanjaeInsuranceStatus`, `PatientPackagePanel` |
  | `건보`·`급여`·기타 | `TreatmentViewBoardPrescriptionNhicHeader` (`PrescriptionInputSearchTreatment`) | `TreatmentViewBoardPrescriptionNhics` → `TreatmentProcedures`(침·뜸부항·검사·추나·진찰료 `TreatmentPayment`), `TreatmentInsuranceMedicines`, `TreatmentEtcPrescriptions`, `TreatmentNonBenefitPackage`, `TreatmentViewBoardPrescriptionNhicChubyak` | `TreatmentViewBoardPrescriptionNhicInsuranceStatus` (건보 추나 주차별 횟수, 변증) |
  | EMR 기능 없음 (`showEmrFeatures` 거짓, 추정: LITE 계정) | — | `TreatmentViewBoardPrescriptionLite` (`LitePrescriptionPanel`). 비대면 LITE 주문이면 읽기 전용 | — |

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

- **처방 종류와 카테고리 코드** (`카테고리숫자코드`, `restored/modules/index/part-103.js`의 `me`):

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
  - 추나를 추가하면 승인 가드(`get추나승인가드결과`)가 돕니다. 이미 승인 요청한 내역이 있으면 "기존 요청을 취소하고 처방을 변경하시겠습니까?"를 묻습니다. 승인된 추나는 "현행 앱에서만 삭제할 수 있습니다."
  - 시술진료의를 지정합니다 (`PATCH /record/prescriptions/{id}`).
- **근거:** `restored/components/treatment/TreatmentViewBoardPrescriptionV2.vue`, `restored/components/treatment/TreatmentViewBoardPrescriptionTableRow.vue`, `restored/modules/TreatmentViewBoard/part-16.js`, `restored/modules/TreatmentViewBoard/part-30.js`

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
- **근거:** `restored/components/treatment/TreatmentViewBoardRecordsList.vue`, `restored/components/treatment/TreatmentViewBoardRecordsListMultiRepeatModal.vue`, `restored/components/treatment/TreatmentViewBoardRecordListDeleteModal.vue`, `restored/stores/repeatedTreatment.js`

### 하단 바 — `TreatmentViewBoardFooter`

- **화면 구성:** `청구 메모`(`TreatmentViewBoardFooterClaimMemoModal`), `약속처방 등록`, `임시 저장`, 완료 버튼, 수납 금액 요약(`수납:`), 목표 본부금(`TreatmentViewBoardBudgetTargetPopover`), 비급여 선택(`NonBenefitTreatmentSelector`), 청구 경고(`ClaimWarningCardsPopover`)가 있습니다.
  - 완료 버튼은 비대면 LITE면 단일 버튼, 아니면 `StageMoveControl`입니다. `StageMoveControl`의 옵션은 `차팅 완료 / 대기 / 치료 / 수납` 중 현재 상태를 뺀 것입니다.
- **동작:**
  - `임시 저장`: `savePatientRecord({ 진찰료중복안내: true })`
  - 완료(이동): `finishPatientRecord(상태)` (아래 [저장·완료](#저장완료-로직))
  - `약속처방 등록`: `처방수가설정` 권한이 있어야 하고, 진찰료 말고 다른 처방이나 상병이 있을 때만 켜집니다. `TreatmentViewBoardRegisterReservedPrescriptionModal` → `POST /settings/appointed-prescriptions` (그룹, 사용 범위 `내 계정만`/`모든 진료의`, 진찰료 제외)
  - 목표 본부금 프리셋: `PUT /settings/budget-target-presets/doctors/{진료의Id}`
  - 권한이 없으면 "현재 권한으로는 조회만 가능합니다."
- **근거:** `restored/components/treatment/TreatmentViewBoardFooter.vue`, `restored/modules/TreatmentViewBoard/getRoot.js`

### 저장·완료 로직

- **저장 `savePatientRecord`** (`j6` → `U6`):
  1. 산정특례 특정기호를 검증합니다. 옵션을 주면 동일일자 진찰료 중복도 검증하고, 중복이면 `진찰료중복으로저장중단됨`으로 표시하고 멈춥니다.
  2. 페이로드 `buildPatientRecordPayload()`(`O6`)를 만듭니다. 서버 원본과 달라진 필드만 넣습니다.
     - `보험구분`, `진료상병`, `진료처방`, `진료기록`(에디터 HTML), `한방첩약시범사업`, `방문진료대상구분`, `비대면시범사업여부`, `_100여부`, `희귀난치의료비지원진료여부`, `자보1일2차여부`
     - `진료의Id`·`진료항목Ids`·`기준일시`는 바뀐 경우에만 넣습니다
     - `명세서특정내역`, `건강보험원본`/`재조회건강보험조회`(aside에서 자격을 재조회한 경우), `할인금액`, `한방첩약시범사업승인여부`, `고정된기록여부`, `처방경로`
  3. `POST /record/{rid}/save`로 보냅니다. 탕전관리 v2가 켜져 있으면 비급여 한약 OCS 정보를 페이로드에 넣습니다.
     - LITE 단독 계정(`vx`)이고 비대면 LITE가 아니면 `PATCH /desk/nonbenefit-intake/{id}` 또는 `POST /desk/nonbenefit-intake`를 씁니다
  4. 성공하면 "환자 기록이 저장되었습니다."
- **완료 `finishPatientRecord(상태 = "치료")`** (`I6` → `b6`):
  1. 건보 첩약 승인을 확인합니다 (`checkNhicChubyakApproval`).
  2. 저장 → `PATCH /record/{진료Id}/done` → 추나 자동 승인 (`autoApproveChuna`, `POST /record/hira/prescriptions/approval`, 연간 횟수를 넘으면 건너뜀)
  3. 내원 상태를 옮깁니다 (`PATCH /desk/waiting/{내원Id}` `상태`).
     - 치료실 베드에 있던 환자를 `대기`/`수납`으로 옮기면 먼저 `PATCH /treatments/patients/{내원Id}/status` `치료완료: true`를 보냅니다
     - `차팅 완료`는 이동하지 않습니다
  4. 토스트 "○○님이 수납으로 이동했습니다." 등을 띄웁니다. 오늘 진료이면 다음 대기 환자(같은 진료의)를 미니 데스크에서 포커스합니다.
  - 비대면 LITE는 수령일정이 필요하면(`QS && !YS`) 수령일시 모달을 먼저 요청합니다. 완료 뒤에는 `PATCH /desk/telemedicine-consultations/{예약Id}/status` `complete` → "진료가 완료되었습니다. 이제 약을 배송해주세요."
- **근거:** `restored/components/treatment/TreatmentViewBoard.helpers-12.js`, `restored/components/treatment/TreatmentViewBoard.helpers-12.helpers.js`, `restored/components/treatment/TreatmentViewBoard.helpers-11.js`, `restored/components/treatment/TreatmentViewBoard.helpers-11.helpers.js`, `restored/modules/TreatmentViewBoard/part-42.js`, `restored/modules/SidePanelDeskActions/part-2.js`

## 진료 보드 사이드 패널 — `TreatmentViewBoardAside`

- **목적:** 진료 중에 참조하거나 부가 입력할 패널을 탭으로 묶은 것입니다. 폭이 좁으면(`shouldHideAside`) 또는 수동으로 접으면 80px 아이콘 레일의 팝오버(`BasePopover`, 560px)로 바뀝니다.
- **기본 탭:** `약속처방`. 비대면 LITE 진료나 LITE 항목 처방이 있으면 `연락이력`이 됩니다.
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
  | `연락이력` | 연락 이력 | 비대면 LITE 진료, 또는 LITE 항목 처방 포함 | `CrmContactsViewDetailActionLogs` | (CRM 문서) |
  | `추나시술내역` | 추나 시술 내역 | LITE 단독 계정(`vx`) 아님 | 산재: `TreatmentViewBoardAsideSanjaeChunaHistory` / 그 밖: `TreatmentViewBoardAsideChunaHistory` (승인필요 표시, 상세 `...ChunaHistoryDetail`) | `GET`·`POST /chart/chuna/patients/{pId}`, `GET /record/hira/chuna`, `POST /record/hira/prescriptions/approval`, `GET chart/sanjae/record/{rid}/chuna` |
  | `첩약내역` | 첩약 내역 | 보험구분 `자보` 또는 `산재` | `TreatmentViewBoardAsideJaboChubyak` (자보 첩약 제출·제출 내역 삭제) / `TreatmentViewBoardAsideSanjaeChubyakHistory` (요양승인번호·비고) | 자보 수가 JSON, `/settings/hospitals` |
  | `건보첩약` | 첩약 내역 | `건보` + (한방첩약시범사업 또는 시범사업 처방 포함) | `TreatmentViewBoardAsideNhicChubyak` (처방 이력, 체크리스트 작성, 첩약 제출) | `GET`·`POST /chart/pcmd/patients/{pId}`, `GET /settings/hospitals/chubyak-pilots/prescriptions/categories/{key}` |
  | `비급여첩약` | 비급여 첩약 | 비급여 한약 처방 포함 또는 탕전관리 v2 활성 | `TreatmentViewBoardAsideNonBenefitChubyak` (사용 약재·용량·복용법·탕전 방식, `탕전 처방 작성`, `외부원탕 주문`) | `GET`·`PATCH /ocs/{ocsId}`, `GET /tangjeon/treatment-prescriptions/{id}/draft`, 비급여 한약 템플릿 |
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
- **근거:** `restored/components/treatment/TreatmentViewBoardAside.vue`, `restored/components/treatment/TreatmentViewBoard.helpers.js`

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
- **근거:** `restored/views/TreatmentRepeatResultsView.vue`

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
  - **시술 타이머** (`Rp`, `restored/modules/TreatmentRoomsView/duration_sec.js`):

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
- **근거:** `restored/views/TreatmentRoomsView.vue`, `restored/components/treatment/TreatmentRoomBedAssignModal.vue`, `restored/components/treatment/TreatmentRoomsTimerSettingsModal.vue`, `restored/modules/constants/useTreatmentsPatientsQuery.js`, `restored/modules/index/useTreatmentsSnapshotQuery.js`, `restored/components/app/App.helpers-2.js`, `restored/modules/index/part-256.js`

## 태블릿 연동 — `/tablet/auth-link`, `/tablet/treatment-rooms`

- **목적:** 태블릿 앱(React Native WebView)에 치료실 보드를 임베드합니다.
- **접근 조건:** `auth-link`는 meta가 없습니다. `tablet/treatment-rooms`는 `requiresAuth` + `치료실` 권한이 필요합니다.
- **동작:**
  - `/tablet/auth-link?token=…&redirect=…`:
    1. `POST authClient /sso/exchange` (`linkToken`) → `setupLoginSession(결과, "emr")` → `redirect`로 이동합니다. `redirect`가 `/`로 시작하고 `//`가 아닐 때만 쓰고, 기본값은 `/tablet/treatment-rooms`입니다.
    2. 실패해도 localStorage에 `accessToken`이 남아 있으면 그대로 이동합니다. 아니면 "로그인에 실패했습니다…"를 표시하고 `postMessage({ type: "AUTH_ERROR" })`를 보냅니다.
  - `/tablet/treatment-rooms`: `TreatmentRoomsSuspense`를 `tablet-embed` 전체 화면으로 렌더하고, 마운트되면 `postMessage({ type: "EMBED_READY" })`를 보냅니다.
  - 브리지: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`를 씁니다 (`PUt`, 감지는 `J0e`).
- **관련 설정** (다른 문서): 태블릿 계정·세션(`/tablet/accounts`, `/tablet/sessions`), 사진 요청(`/tablet/photo-requests`), 치료 항목(`/tablet/settings/treatment-items`)
- **근거:** `restored/views/TabletAuthLinkView.vue`, `restored/views/TabletTreatmentRoomsView.vue`, `restored/stores/patient.js`

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
- **근거:** `restored/views/CanvasView.vue`, `restored/components/canvas/CanvasTrigger.vue.js`, `restored/modules/CanvasView/part-1.js`

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

## 레거시 차트 대비

이 절은 레거시 차트 사용자 매뉴얼을 근거로 정리한 것이며, 현행 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무

- **상병관리(청구용 추가 상병):** 시술과 매칭하지 않은 상병을 진료일 단위로 따로 둡니다. 진료내역 화면에는 보이지 않지만 차트 출력과 청구 명세서에는 들어갑니다. 구분은 주상병·부상병·배제된 상병이고, 순서를 바꿀 수 있습니다. 시술 없이 부상병을 기록하면 상병관리로 옮길지 묻고, `최근상병` 리핏 때 직전 내원의 상병관리 목록을 다시 쓸지 묻습니다 (환경설정으로 끌 수 있음). (레거시 차트 매뉴얼 「상병관리 기능」, 레거시 차트 매뉴얼 「상병관리 & 최근상병으로 리피트할 시 안내」, 레거시 차트 매뉴얼 「부상병명을 시술 선택없이 기록하고자 할 경우」)
- **진료일별 진료비 특정규칙:** 진료일 하나에 아래 규칙 중 하나를 지정하면 청구 특정내역과 산정 범위가 바뀝니다. (레거시 차트 매뉴얼 「진료차트의 진료내역 메뉴 기능」, 레거시 차트 매뉴얼 「촉탁의 진료기록 및 청구」, 레거시 차트 매뉴얼 「자동차보험에서 1일 2차 진료기록 및 청구 지원」, 레거시 차트 매뉴얼 「협진의뢰 시범사업 진료기록 방법 안내」)

  | 규칙 | 산정 범위 | 청구 표시 |
  |---|---|---|
  | 촉탁의(계약의사) 진료 | 진찰료 없이 처방 약제비·조제료만 | 상해외인 `MT001`=`J`, 내원일수 1, 특정내역 `촉탁` |
  | 자동차보험 2차 진료 | 진찰료 없음 (1차 진료에만 산정) | `MT001`=`U`, 내원일수 0, `자보2차` |
  | 진료의뢰·원격협력진료 시범사업 | 의뢰환자관리료 등만 | 본인부담 0, 다른 진료와 명세서 분리 |

- **청구 조건 전환:** 진료를 기록한 뒤 버튼으로 청구 방식을 바꿉니다. `일반`(청구액까지 전액 본인부담: 무자격·자격조회 불가·외국인), `비청`(청구하지 않고 본인부담금만 받음), `공상`, `산특-암`, `산정특례`(V 특정기호 선택), `지원`(희귀난치 지원), `임신부`(F015/F015-1), `조산아`(F016/F016-1), `자보(본인)`(환자가 보험사에 직접 청구하거나 전액 부담, 심평원에 청구하지 않음). 나중에 자격이 회복되면 `보험`으로 다시 계산하고 차액을 환불합니다. (레거시 차트 매뉴얼 「초진환자의 진료기록」, 레거시 차트 매뉴얼 「자동차보험 진료기록」, 레거시 차트 매뉴얼 「건강보험 무자격자/급여제한자 진료기록과 수납」)
- **내원일 제외:** 진료 없이 서류만 발급한 날을 내원일에서 빼는 플래그입니다. 진료확인서·통원확인서를 만들 때 이 날짜를 빼고 셉니다. (레거시 차트 매뉴얼 「진료확인서 및 진단서 등 작성 시 내원일 제외하기」)
- **진료확인서·진단서·소견서 작성:** 상병명과 내원일을 불러와 진료기간·발병일·진단일·향후 치료의견을 넣고 문구는 상용구로 고릅니다. (레거시 차트 매뉴얼 「진료확인서, 진단서, 소견서 등 출력」)
- **진료기록 전자서명:** 진료내역마다 공인 전자서명을 하는 방식(권장)과, 하루 진료를 마감한 뒤 기간 단위로 한꺼번에 서명하는 방식이 있습니다. 진료내역을 고치면 다시 서명합니다. 진료의가 여럿이면 자기 진료분만 골라 서명합니다. 본인부담금 수납대장도 따로 서명합니다. 매뉴얼은 "당일 진료·당일 수납 기록, 급여·비급여 모두 기록, 전자서명 필수"를 종이차트 없이 쓰는 조건으로 듭니다. (레거시 차트 매뉴얼 「전자서명 기록」, 레거시 차트 매뉴얼 「진료기록부 및 본인부담금 수납대장 작성시 유의사항」)
- **진료의 일괄 변경:** 진료기간·기존 진료의·새 진료의를 지정해 과거 기록의 진료의를 한꺼번에 바꿉니다. 진료일 하나만 바꿀 수도 있습니다. 실명제 때문에 진료의는 청구 명세서 면허정보가 되므로, 이 기능은 감사 로그가 필요합니다 (추정). (레거시 차트 매뉴얼 「진료기록의 진료한의사 변경」)
- **진료의 바로변경:** 여러 원장이 같이 쓰는 치료실 PC에서 다시 로그인하지 않고 기록 주체만 바꾸는 기능입니다. 이때 경영관리·통계·청구 같은 관리 기능은 공유하지 않습니다. 정식 `다른 사용자로 로그인`은 암호를 다시 받고 관리자 권한을 얻을 수 있습니다. (레거시 차트 매뉴얼 「진료의 바로변경」)
- **EDI노트(심사 참고 메모):** 심사할 때 참고할 설명을 명세서에 실어 보냅니다. 진찰료(검사료 포함)만 기록한 진료는 저장할 때 안내를 띄우고 사유를 쓰게 합니다. 진료메모를 EDI노트로 복사할 수 있고, 같은 내용을 특정내역 `MX999`에 적어도 됩니다. (레거시 차트 매뉴얼 「진찰료만 청구하는 경우, 자주 내원하는 경우 EDI노트 메모 기록 안내」)
- **주간요약:** 건보는 초진일, 자보는 수상일을 1일차로 삼아 경과일수와 심평원 주 단위에 맞춘 주차별 시술 횟수를 보여 줍니다. 아래 횟수 제한 규칙을 판단할 때 씁니다. (레거시 차트 매뉴얼 「주간요약 기능」)
- **자보 한도액 안내:** 자보 환자에게 보장 한도액을 입력해 두면 차트를 열 때 한도액·누적 내원횟수·누적 자보 진료비를 띄웁니다. 다른 기관의 진료분은 합산하지 않습니다. (레거시 차트 매뉴얼 「자동차보험 한도액 기록과 안내창 표시」)
- **가감·임의처방 등록:** 한약제제 기준처방에 단미엑스산제를 더한 가감처방과, 단미엑스산제로만 구성한 임의처방을 등록합니다. 수가가 바뀌면 다른 이름으로 새로 등록합니다. 약가 규칙은 [업무 규칙](#업무-규칙)을 참고하세요. (레거시 차트 매뉴얼 「가감, 임의처방 등록」)
- **치료재료 실구입가:** 일회용 부항컵 등을 상한가보다 싸게 산 경우, 제조사별 실구입단가를 적용 시작일·종료일과 함께 관리합니다. 종료일이 지나면 상한금액으로 돌아갑니다. (레거시 차트 매뉴얼 「치료재료 실구입가 관리」)
- **비급여 항목 속성:** 비급여 항목마다 구분(처방·치법·검사·물리요법·기타)과 `루틴`(재진 리핏에 함께 들어감), `과세`, `공제제외`, `약침`, `패키지·횟수` 플래그를 둡니다. 진료차트에서 그 항목을 고르면 공제제외·과세가 자동으로 체크되고, 수납·통계로 이어집니다. (레거시 차트 매뉴얼 「비급여 자료 관리 및 기록」, 레거시 차트 매뉴얼 「공제제외 관리 및 기록」, 레거시 차트 매뉴얼 「과세진료 기록 및 수납」)
- **환자별 검사 수치 기록과 소아성장그래프:** 기초·소변·간기능·생화학·혈액 검사 값을 날짜별로 넣고 항목별 그래프를 봅니다. 소아는 부모 키로 예상키를 계산하고, 체중·신장·BMI를 2007년 소아청소년 표준 성장도표 위에 만 19세까지 그립니다. 생일을 임시로 바꿔 다시 그려 볼 수도 있습니다. (레거시 차트 매뉴얼 「검사기록, 사진 저장」, 레거시 차트 매뉴얼 「소아성장그래프 관리」)
- **개별차트(서식 차트):** 초진기록부·상담차트·예진차트 같은 한의원 고유 서식을 이미지 양식으로 만들어 두고, 그 위에 글과 그림을 입력해 환자별로 저장·출력합니다. (레거시 차트 매뉴얼 「개별차트에서 초진기록부, 상담차트 입력」)
- **펜차트:** 태블릿에서 동의서·문진표·진료 경과 같은 종이 양식을 펜으로 작성하고, 카메라로 환부를 찍어 그 위에 표시한 뒤 환자 화상자료로 저장합니다. 진료내역은 읽기만 됩니다. (레거시 차트 매뉴얼 「펜차트 기능」)
- **기타 진료 항목:** 가족(보호자) 내원 진찰료, 협의진찰료, 1일 2회 외래 진찰료, 원격협의진찰료, 협력기관 간 진료의뢰·회송료(의뢰·회송번호 포함), 비대면진료 시범사업 관리료를 진찰료와 따로 기록합니다. (레거시 차트 매뉴얼 「초진환자의 진료기록」, 레거시 차트 매뉴얼 「원격협의진찰료 기록」, 레거시 차트 매뉴얼 「협력기관 간 진료의료회송 시범사업 기록 방법」, 레거시 차트 매뉴얼 「비대면진료 시범사업 관리료 진료기록 방법」)

### 업무 규칙

- **초진·재진 판정 (고시 기준):** 초진은 해당 상병으로 같은 기관·같은 진료과목 의사에게 진료받은 적이 없는 경우입니다. 치료가 끝나지 않아 계속 오면 간격과 상관없이 재진입니다. 종결 여부가 불분명하면 90일 이내 재방문을 재진으로 봅니다. 종결 후 재발했더라도 30일 이내 재방문이면 재진입니다 (종결 = 내원 또는 투약 종료). 한 상병을 치료하는 중에 다른 상병이 생기면 재진 진찰료를 1회만 산정합니다 (고시 제2001-40호, 제2000-73호). (레거시 차트 매뉴얼 「(용어) - 진찰료」)
- **초진·재진 자동 산정 (레거시 차트 방식):** 다른 상병으로 30일 넘어 오면 초진, 같은 상병으로 90일 이내에 오면 재진, 90일을 넘으면 초진으로 자동 판정하고, 의사가 수동으로 바꿀 수 있습니다. 만성 상병 목록이 고시돼 있지 않으므로 상병별로 자동 판정할 수는 없다고 밝힙니다. (레거시 차트 매뉴얼 「초진 - 재진 진찰료 산정 안내」)
- **1일 2회 내원:**
  - 같은 의사라면 같은 상병이든 다른 상병이든 진찰료는 1회만 산정합니다. 계획에 따라 같은 날 다시 와서 처치를 이어 받는 경우도 1회입니다.
  - 진찰료를 따로 산정할 수 있는 경우는 진료과목이 둘 이상이고 전문의가 상근하는 기관에서, 전문과목이 다른 의사가 다른 상병을 각각 진찰한 경우뿐입니다.
  - 침·구·부항·한방물리요법은 하루 여러 번 해도 외래 1일 1회, 입원 1일 2회만 산정합니다.
  - 두 번째 방문은 진찰료 체크를 풀고 앞 방문과 겹치지 않는 시술만 기록합니다.
  - (레거시 차트 매뉴얼 「1일 2회 동일환자가 내원한 경우 진료기록 방법」)
- **진찰료 가산:**

  | 가산 | 조건 | 비율 |
  |---|---|---|
  | 야간 | 평일 18시~익일 09시, 토요일 13시~익일 09시 | 기본진찰료 30% |
  | 공휴일 | 관공서 공휴일 (임시공휴일 포함) | 기본진찰료 30% |
  | 소아 심야 | 만 6세 미만, 20시~익일 07시 | 기본진찰료 100% |
  | 토요 주간 | 토요일 09시~13시, 의원급만 | 기본진찰료 30% (야간과 중복 불가) |
  | 응급 | 18시~09시 또는 공휴일에 불가피하게 한 시술·처치 | 해당 소정점수 50%, 시술 시작 시각 기준 |
  | 소아 | 만 1세 미만, 만 1세~6세 미만 | 진찰료 소정점수 가산. 침술은 26.45점·10.89점 (2017.7.1.) |

  - 기준 시각 (고시 제2006-9호): 가산 시간대에 도착했으면 진료를 시작한 시각, 그 밖의 시각에 도착했으면 도착한 시각을 기준으로 합니다.
  - 레거시 차트 방식: 대기실·치료실에 등록한 뒤 PC 시각으로 판정합니다. 기본 설정은 "09시 이전 오전에는 야간가산을 적용하지 않음"으로 환자에게 유리하게 둡니다.
  - (레거시 차트 매뉴얼 「진찰료 평일 야간가산」, 레거시 차트 매뉴얼 「진찰료 토요일 주간가산」, 레거시 차트 매뉴얼 「초진환자의 진료기록」, 레거시 차트 매뉴얼 「(용어) - 경혈침술 및 가산되는 침술」)
- **가족(보호자) 내원:** 환자 대신 가족이 와서 상담하고 약이나 처방전만 받으면 재진진찰료 소정점수의 50%를 산정합니다. (레거시 차트 매뉴얼 「(용어) - 진찰료」)
- **침술 조합:**
  - 하루 3종까지 산정합니다. 특수침술 6종(안와내·비강내·복강내·관절내·척추간·투자법)과 레이저침술은 합쳐서 최대 2종이고, 2종 모두 100% 산정합니다.
  - 3종은 응급이 아니면 KCD 대분류가 다른 복합상병일 때만 인정합니다. U코드도 대분류 하나로 인정합니다 (고시 제2017-152호, 2017.9.1.).
  - 가산: 이체(2부위 이상, 신체 5부위 기준) 50%, 자락·도침·산침 20%, 사암·오행·체질·화침·온침 50%. 사암 등을 이체와 함께 쓰면 2종으로 보아 조정될 수 있습니다.
  - 분구침술(두침·족침·수지침 등)과 피내침·피부침·자석침은 다른 침술과 같이 해도 분구침술만 산정합니다. 전자침술과 침전기자극술을 같이 하면 주된 것 하나만 산정합니다.
  - (레거시 차트 매뉴얼 「(용어) - 특수침술」, 레거시 차트 매뉴얼 「(용어) - 경혈침술 및 가산되는 침술」, 레거시 차트 매뉴얼 「침술 1일 3종 시술시 U코드도 대분류로 인정」, 레거시 차트 매뉴얼 「(용어) - 분구침술」, 레거시 차트 매뉴얼 「(용어) - 전자침술」, 레거시 차트 매뉴얼 「(용어) - 레이저침술」)
- **부항:** 자락관법은 같은 상병에 최초 시술일부터 1주까지 매일, 3주까지 주 4회, 그 뒤로 주 2회 인정합니다 (2022.11.1. 시행 기준). 2부위 이상(이체자락관법)은 50% 가산합니다. 일회용 부항컵은 회당 5개까지 별도 산정하고 (2022.3.1.), 자락관법에 쓴 합성거즈 드레싱은 별도 산정할 수 없습니다. (레거시 차트 매뉴얼 「자락관법의 장기 시술 인정여부」, 레거시 차트 매뉴얼 「(용어) - 부항술」)
- **한방물리요법(온냉경락):** 온열·적외선·한냉을 같이 해도 한 가지만 산정합니다. 근골격계 통증 완화 목적일 때 인정합니다. 상근 한의사 1인당 월(주) 평균 1일 30명까지 인정하고, 의료급여 환자도 셉니다. 시간제·격일제(주 3일·20시간 이상)는 0.5인으로 15명입니다 (2021.12.1. 시행. 이전 기준은 20명). (레거시 차트 매뉴얼 「(용어) - 한방물리요법」)
- **변증기술료:**
  - 투약이나 시술을 한 날에만 산정합니다. 초진 당일 1회, 재진은 주 1회입니다. 매뉴얼은 심평원 해석에 따라 "초진 1회 → 재진 1회 → 이후 7일 간격"으로 자동 기록합니다. 예를 들어 전날이 재진 산정이면 오늘은 산정하지 않고, 전날이 초진이면 오늘도 산정합니다. 선별집중심사 대상입니다.
  - 인정 요건 (고시 제2020-19호): 진료메모에 변증 진단명을 쓰고, 문진(聞·問)·망진·절진 중 2가지 이상을 종합한 설명을 씁니다.
  - (레거시 차트 매뉴얼 「(용어) - 변증기술료」, 레거시 차트 매뉴얼 「변증기술료의 개요와 활용」, 레거시 차트 매뉴얼 「변증기술료 기록 시, 초재진 진찰료와 진료일 간격 상관관계」)
- **한방검사료:** 최초 진단과 최종 치료 확인 때 각 1회 산정합니다. 양도락과 경락기능검사를 같이 하면 주된 1종만 산정하고, 3차원 맥영상검사와 맥전도검사는 같은 날 중복 산정할 수 없습니다. 염좌·골절·탈구처럼 원인이 분명한 상병에는 산정하지 않습니다. (레거시 차트 매뉴얼 「(용어) - 한방 검사료」)
- **첩약 관련 배제:**
  - 비급여 첩약을 조제한 날은 진찰료와 양도락·맥전도 검사가 첩약가에 포함되므로 별도 산정할 수 없습니다 (고시 제2000-73호). (레거시 차트 매뉴얼 「첩약조제시 진찰료 및 검사의 급여여부」)
  - 건보 첩약 심층변증방제기술료는 처방일수 10일당 1회이고, 같이 한 검사 3종과 변증기술료는 별도 산정할 수 없습니다. (레거시 차트 매뉴얼 「(용어) - 진찰료」)
- **보험 한약제제:**
  - 소아 1일 투여량은 성인 대비 6개월 미만 0.2, 6개월~1세 미만 0.25, 1~7세 미만 0.5, 7~11세 미만 0.75입니다.
  - 가감처방은 단미엑스산제 1일 5종·10g 이내로 일투 2까지, 임의처방은 1일 15종·50g·총 3,000원 이내로 일투 1까지 허용합니다.
  - 임의처방 1일 약가는 구성 약제마다 단가×용량을 더한 뒤 원 미만을 4사5입합니다 (예: 496.47+222=718.47 → 718원). 1일 총투여량은 소수점 셋째 자리에서 4사5입합니다.
  - 같은 날 서로 다른 상병에 기준처방 2종까지 인정하지만, 진료의가 1명이면 두 번째 처방의 조제료는 인정하지 않습니다 (처방기간이 짧은 쪽을 지움). 처방조제료만 단독으로 기록하거나 조제료 없이 약만 기록할 수는 없습니다.
  - (레거시 차트 매뉴얼 「(용어) - 한약제제(투약 및 조제료)」, 레거시 차트 매뉴얼 「가감, 임의처방 등록」, 레거시 차트 매뉴얼 「보험약 동시 처방할 시 처방조제료 인정 범위」, 레거시 차트 매뉴얼 「소아의 보험약, 자보 첩약 기록」)
- **추나요법:**
  - 건보·자보 각각 환자당 연간 20회, 상근 한의사 1인당 1일 18명까지 인정합니다. 적응증은 M·S·T 코드 근골격계·외상 질환입니다.
  - 건보에서 연 20회를 넘으면 비급여로 기록해야 합니다 (심평원 제출도 거부됨). 자보에서 넘으면 사례별로 인정하므로 필요 소견을 진료메모나 EDI노트에 씁니다.
  - 복잡추나는 임상 소견·변위·시술 부위·기법·시술 후 평가를 기록해야 인정합니다. SOAP 형식 기록을 권장합니다.
  - 본인부담금은 추나 외 진료분 30% + 추나분 50%로 나눠 계산하고, 65세 이상도 같습니다.
  - (레거시 차트 매뉴얼 「추나요법 진료기록」, 레거시 차트 매뉴얼 「추나요법 실시 횟수가 20회 이상인 경우 진료기록 방법」, 레거시 차트 매뉴얼 「(용어) - 추나요법」, 레거시 차트 매뉴얼 「추나요법 본인부담금 계산방식 예시」)
- **상병 기재:** 주상병은 환자 요구가 가장 컸고 실제로 시술한 상병입니다. 외인 코드(V·W·X·Y)는 주상병으로 쓸 수 없습니다. 상해는 S코드를 권장하고, 다친 경위를 진료메모에 적습니다. 명세서에는 주상병(1단), 부상병, 배제된 상병 순으로 쓰고 각 묶음 안은 중요도 순입니다. (레거시 차트 매뉴얼 「초진환자의 진료기록」, 레거시 차트 매뉴얼 「상병관리 기능」)
- **산정특례·본인부담 경감 (진료 기록 단계에서 지정):**

  | 대상 | 지정 | 본인부담 |
  |---|---|---|
  | 암 | `산특-암`, 특정기호 없음, 암 관련 상병일 때만 | 5% |
  | 희귀·중증난치 | V 특정기호. 자격조회에 `V`로만 보이면 환자나 등록기관 진단서로 확인 | 10% (특례 전체로는 5~20%) |
  | 희귀난치 지원 | 지원 대상 상병으로 기록 + `지원` | 10%를 지원금으로 처리 (환자에게 받지 않음, 공제제외) |
  | 중증치매 V800 | 지정 상병 (F000, G3100 등) | 특례 적용 |
  | 중증치매 V810 | 사전승인번호를 특정내역 `MT052`에 진료일마다 기재, 연 최대 60일 | 특례 적용. 승인받은 당일에는 청구하지 않음 |
  | 잠복결핵 V010 | 등록번호 `MT014` (2021.7.1.~) | 특례 적용 |
  | 임신부 | F015 (차상위 F015-1) | 10% (차상위 5%, 정액제 유지) |
  | 조산아 | F016 (차상위 F016-1) | 매뉴얼에 10%와 5%가 섞여 있음 (추정: 확인 필요) |
  | 의료급여 연장승인 미신청자 | 자격조회 B014 → `F023` 자동 | 30% (2019.1.1.~) |

  (레거시 차트 매뉴얼 「산정특례 암, 산정특례 희귀, 산정특례 중증난치, 산정특례 희귀난치지원 환자의 진료기록」, 레거시 차트 매뉴얼 「산정특례 중증치매 기록」, 레거시 차트 매뉴얼 「잠복결핵감염의 건강보험(차상위 포함) 산정특례 적용」, 레거시 차트 매뉴얼 「임신부 진료기록」, 레거시 차트 매뉴얼 「재진환자의 진료기록」, 레거시 차트 매뉴얼 「진료차트의 진료내역 메뉴 기능」)
- **요양병원 입원 환자:** 요양병원의 의뢰서가 있어야 건보로 진료합니다. 산정특례 대상자라면 특정내역 `MT063`에 요양병원 기관기호와 의뢰일자를 적습니다 (진찰료 줄에 저장, 2020.1.1.~). 의뢰서가 없으면 `일반`으로 바꿔 전액 본인부담으로 받습니다. (레거시 차트 매뉴얼 「요양병원에 입원 중인 환자 진료기록」)
- **급여제한자:** 체납으로 급여가 제한된 환자는 청구액까지 본인부담으로 받고, 명세서에도 청구액을 본인부담에 더해 보냅니다. 환급은 공단이 합니다. (레거시 차트 매뉴얼 「건강보험 무자격자/급여제한자 진료기록과 수납」)
- **자동차보험 진료:**
  - 장기치료 심사 경향 (경상: 염좌·긴장 등): 진찰·시술은 수상일부터 3주까지 매일, 11주까지 주 3회, 6개월까지 주 2회, 그 뒤 주 1회입니다. 염좌는 1년, 골절·뇌질환은 2년까지 인정하는 경향입니다. 기왕증과 사고와 무관한 상병은 자보에서 빠집니다.
  - 약침: 경상이면 수상일부터 1주 매일, 2~3주 주 3회, 4~10주 주 2회, 그 뒤 주 1회입니다. 2부위 이상은 50% 가산합니다. 같은 부위에 추나와 함께 하면 추나만 인정합니다.
  - 약침 기재: 2024.4.21. 진료분부터 신고된 약침액만 쓸 수 있고, 줄단위 특정내역 `JJ002`에 약침액명/시술부위/시술용량을 적습니다. 2025.8.1.부터는 탕전실 기관기호도 적고, 2부위 이상이면 부위별로 줄을 나눕니다. 이름이 같은 약침액도 부위마다 따로 적습니다. 약침액명은 중복 등록할 수 없고, 콤마·슬래시·`$`는 금지이며 70자까지입니다.
  - 첩약: 1일 2첩, 1회 7일입니다. 경상환자는 2024.7.1.부터 환자 동의와 한의사 소견이 있으면 10일까지 처방할 수 있고, 7일을 넘길 때마다 동의를 받습니다. 소아 일투는 성인 2 기준으로 7~11세 1.5, 1~7세 1, 6개월~1세 0.5, 6개월 미만 0.4입니다. 탕전료는 첩약과 같은 일투·일수로 따라갑니다. 첩약과 보험 한약제제·복합엑스제는 함께 투여할 수 없습니다.
  - 첩약 제출: 2024.4.21.부터 처방·조제내역(탕전유형·변증·효능·한약재)을 처방할 때마다 바로 심평원에 제출하고, 늦어도 청구 전에 제출해야 합니다. 등록하지 않았거나 명세서와 다르거나 총 투여일수가 다르면 심사불능입니다. 개인정보 동의서는 5년간 유효하고 기관에서 보관합니다.
  - 물리요법 (TENS·ICT·온냉경락·초음파 등): 수상일부터 17일까지 외래 1일 1회·2부위까지, 18일째부터 부위와 상관없이 1회입니다. TENS·ICT·침전기자극술은 1종만 기록합니다.
  - 수기요법: 추나·도인운동요법·근건이완수기요법·견인은 같은 날 주된 1종만 인정합니다. 도인운동요법은 수상 12주 이내, 10분 이상 하고, 할 때마다 ROM·VAS 평가를 기록합니다. 4부위 중 2부위 이상이면 50% 가산합니다.
  - 기타: 소애주구 직접구는 15세 이상만 가능하고, 요배·둔부·견·고·슬관절은 5장 이상, 그 밖은 3장 이상일 때 인정합니다. 체온열검사는 수상 2~3주 뒤 적응증이 의심될 때 1회, 확진 후 1회 더 인정합니다.
  - (레거시 차트 매뉴얼 「자동차보험 진료기록」, 레거시 차트 매뉴얼 「자동차보험 기록 인정범위」, 레거시 차트 매뉴얼 「자동차보험 첩약 진료기록 및 심평원 제출하기」, 레거시 차트 매뉴얼 「자동차보험 약침 진료기록」, 레거시 차트 매뉴얼 「자보 첩약·약침술 관련 질의응답(Q&A)」, 레거시 차트 매뉴얼 「자보 약침술 2부위 이상 진료기록 방법」, 레거시 차트 매뉴얼 「자동차보험 소아 환자의 한방 '첩약 및 탕전료' 일투, 일수 기록하기」)
- **자보 중복 진료:** 같은 날 같은(비슷한) 상병으로 한방병원과 한의원에서 모두 자보 진료를 받으면 주된 치료만 인정되고, 나머지는 환자가 전액 부담합니다. 양방에서 자보 통원·입원 중이면 한방 자보는 안 되고, 사고와 무관한 기존 상병의 건보 진료만 됩니다. (레거시 차트 매뉴얼 「자동차보험 중복진료 구분 요약」)
- **산재:** 첩약은 1일 2첩, 외래 30일·입원 60일이 원칙이고 진료기간 일수를 넘길 수 없습니다. 한·양방에서 병행 진료 중이면 인정하지 않습니다. 추나는 기록만 하고 심평원에 제출하지 않습니다. 합병증 등 예방관리(후유증상) 환자에게는 추나를 인정하지 않으므로, 건보로 추나를 하려면 건보 차트를 따로 만들고 `MT001`=`K`로 기록합니다. 혈맥어혈검사는 치료기간 중 2회입니다. (레거시 차트 매뉴얼 「산재보험 진료기록」)
- **공상(공무상요양):** 급여분은 전부 공단에 청구하고 환자에게는 비급여만 받습니다. 비급여는 공제제외로 처리합니다. 첩약에는 한약 처방 확인서가 필요합니다. (레거시 차트 매뉴얼 「공무상요양(공상) 환자의 진료기록」)
- **비대면진료 관리료 (2025.10.27.~):** 의원급은 초진·재진과 상관없이 의사 판단으로 비대면 진료를 할 수 있습니다. 관리료는 같은 환자에게 월 2회까지 산정하고, 진찰료와 관리료에 각종 가산을 붙일 수 없습니다. 시간대별 코드는 통계용이고 금액은 같습니다. (레거시 차트 매뉴얼 「비대면진료 시범사업 관리료 진료기록 방법」)
- **원격협의진찰·협진의뢰:** 의뢰료와 의뢰료(영상공유)는 같이 산정할 수 있고, 자문료와 자문료(응급)는 하나만 산정합니다. 자문료와 협진의뢰 시범사업 관리료는 본인부담 없이 전액 공단에 청구합니다. 협진의뢰 시범사업은 건보 가입자만 대상입니다. (레거시 차트 매뉴얼 「원격협의진찰료 기록」, 레거시 차트 매뉴얼 「협진의뢰 시범사업 진료기록 방법 안내」)
- **공제제외(연말정산 의료비 자료 제외) 대상:** 미용·성형, 건강증진용 한약(치료 목적 한약은 포함), 국민행복카드·첫만남이용권 결제분, 과세 진료·제품, 의료급여 건강생활유지비, 제증명 수수료입니다. (레거시 차트 매뉴얼 「공제제외 관리 및 기록」, 레거시 차트 매뉴얼 「임신부 진료기록」)
- **진료기록부 기재 사항 (의료법 시행규칙 제14조):** 인적사항, 주된 증상(필요하면 병력·가족력), 진단, 진료경과(재진은 변동이 있을 때), 치료 내용, 진료 일시를 적습니다. 종이차트 없이 운영하면 매일 진료메모를 남겨야 합니다. (레거시 차트 매뉴얼 「진료기록부 등의 기재 사항」, 레거시 차트 매뉴얼 「초진환자의 진료메모 기록」)
- **보존·수정 (의료법 제22·23조, 시행규칙 제15·16조):** 보존 기간은 환자 명부 5년, 진료기록부 10년, 처방전 2년, 검사 기록·방사선 사진 5년, 진단서 부본 3년이고, 계속 진료에 필요하면 1회 연장할 수 있습니다. 기록을 더하거나 고치면 고친 뒤 기록과 원본을 모두 보존하고, 접속기록을 따로 보관합니다. 전자서명 뒤에 바뀌었는지 확인할 수 있는 이력 관리가 필요합니다. (레거시 차트 매뉴얼 「진료기록부 등의 보존 기간」, 레거시 차트 매뉴얼 「진료기록부 및 본인부담금 수납대장 작성시 유의사항」)
- **진료의사 실명제 (고시 제2013-51호, 2013.7.1.~):** 명세서 상병내역에는 주상병을 진단·진료한 한의사 1명의 면허종류(1 의사, 2 치과의사, 3 한의사, 4 약사, 5 한약사)와 면허번호를 적습니다. 외래 진찰료가 생길 때마다 그 진찰을 한 의사를 적습니다. 그래서 진료는 실제 진료한 의사 계정으로 기록해야 합니다. (레거시 차트 매뉴얼 「진료의사 실명제도」, 레거시 차트 매뉴얼 「초진환자의 진료메모 기록」)

### 현행과 다른 점

- **기록 구조:** 레거시 차트는 청구 행 목록인 `진료내역`과 날짜별로 쌓이는 서술 `진료메모`(Progress note: 직전 메모 복사, 주의 표시 필터, 키워드 필터)를 따로 둡니다. 현행은 진료 하나에 `진료기록`(HTML)·`진료상병`·`진료처방`을 함께 저장합니다. (레거시 차트 매뉴얼 「초진환자의 진료메모 기록」)
- **상병-시술 매칭:** 레거시 차트는 시술 항목마다 주·부상병을 매칭하고, 시술이 없는 부상병은 진료내역에 남지 않습니다 (상병관리로 보냄). 현행 스펙에서는 처방 행과 상병을 매칭하는지 확인되지 않습니다 (추정: 매칭 없음). 침술 3종 판정(대분류가 다른 복합상병)에 매칭 정보가 필요합니다. (레거시 차트 매뉴얼 「초진환자의 진료기록」)
- **같은 날 서로 다른 청구 단위:** 레거시 차트는 같은 날 자보와 건보를 병행하거나 협진 시범사업처럼 본인부담률이 다른 진료가 있으면, 같은 환자를 신환으로 한 번 더 등록해 차트 자체를 나눕니다. 자보 2차 진료도 별도 차트에 씁니다. 현행은 `새 차트 생성`(건보/자보/산재/일반)과 `같은날자보진료기록`, `자보1일2차여부`로 한 환자 안에서 진료를 나누는 것으로 보입니다 (추정). (레거시 차트 매뉴얼 「자보치료와 건보치료가 병행된 경우 진료기록」, 레거시 차트 매뉴얼 「협진의뢰 시범사업 진료기록 방법 안내」, 레거시 차트 매뉴얼 「자동차보험에서 1일 2차 진료기록 및 청구 지원」)
- **자보 심사지침 알림:** 레거시 차트는 자보 심사지침이 수시로 바뀌므로 주차별 인정 범위를 자동 경고로 만들지 않고 참고 표만 제공한다고 밝힙니다. 현행은 "경상환자 장기치료 검토 대상"(8주 초과) 배너를 띄웁니다. (레거시 차트 매뉴얼 「자동차보험 기록 인정범위」)
- **초재진 산정:** 레거시 차트는 경과일과 상병으로 진찰료 초진·재진을 자동 판정하고 수동으로 바꿀 수 있게 합니다. 현행 스펙에는 동일일자 진찰료 중복 검증과 초진기록 자동 고정만 있고, 초재진 판정 위치는 보이지 않습니다 (서버에서 하는 것으로 추정). (레거시 차트 매뉴얼 「초진 - 재진 진찰료 산정 안내」)
- **리핏:** 레거시 차트 `최근상병`은 직전 내원의 보험 진료와 `루틴` 비급여를 불러오고 일반 비급여는 빼며, 상병관리도 이어받을지 묻습니다. `덮어쓰기`로 다시 기록해도 비급여 기록은 남습니다. 달력에서 여러 날짜를 골라 같은 내역을 한 번에 기록할 수 있습니다. 현행은 기록·상병·처방·첩약을 골라 리핏하고, 다른 날짜 리핏 때 자격조회와 접수를 함께 실행합니다. (레거시 차트 매뉴얼 「재진환자의 진료기록」, 레거시 차트 매뉴얼 「초진환자의 진료기록」)
- **묶음처방 vs 약속처방:** 레거시 차트 묶음처방은 과거 진료일 하나를 통째로(보험만, 보험+비급여, 비급여만) 등록합니다. 매뉴얼은 심평원이 세트 기록을 지양하라고 한다는 점과, 해가 바뀌어 수가가 바뀌면 목표 본인부담금에 맞게 다시 구성해야 한다는 점을 경고합니다. 삭제는 실수를 막으려고 한 건씩만 됩니다. 현행 약속처방은 진찰료를 빼고 그룹·사용 범위(내 계정/모든 진료의)를 둡니다. (레거시 차트 매뉴얼 「묶음처방 등록 활용 & 관리하기」)
- **상용구:** 레거시 차트는 단축어를 입력하고 F3을 누르면 펼쳐지고, 상용구와 한자 변환 사전을 PC에 두었다가 서버에 올리거나 내려받습니다. 현행은 `/` 슬래시 메뉴와 서버에 저장되는 `병원상용구`·처방별 상용구를 씁니다. 한자 사전은 없습니다. (레거시 차트 매뉴얼 「상용구 등록·사용 및 서버에 저장」)
- **환자 메모:** 레거시 차트는 `현주증상`·`주치의메모`·`간호사메모` 세 칸을 두고 날짜를 찍습니다 (간호사메모는 작성자 이름도 찍음). 차트를 출력할 때 현주증상 중 일부 범위만 출력하도록 지정할 수 있습니다. 현행은 `PatientMemo` 탭(진료의·직원 등)입니다. (레거시 차트 매뉴얼 「현주증상, 주치의메모, 간호사메모 기록」)
- **진료부 그림:** 레거시 차트 그림은 진료일에 붙고, 기본 그림 5종이나 한의원 그림 위에 그립니다. 색상별로 걸러 볼 수 있습니다. 현행 캔버스는 환자 단위 이미지 목록이고, 진료일과 연결되는지는 스펙에 없습니다. (레거시 차트 매뉴얼 「초진환자의 진료메모 기록」)
- **전자서명 위치:** 레거시 차트는 진료차트 안에서 진료내역마다 바로 서명합니다. 현행은 진료 보드에 서명 UI가 없고 별도 화면으로 추정됩니다 ([미확인·추정](#미확인추정) 참고). (레거시 차트 매뉴얼 「전자서명 기록」)
- **치료실 타이머:** 레거시 차트 치료실 시간관리(OKTCS)는 베드 배정 없이 시술 타이머만 쓸 수 있고, 환자별로 치료항목 순서를 저장합니다. 종료 1분 전에 노란색 경고를 띄우고, 종료 알림에서 `다음치료`를 누르면 다음 항목이 자동으로 시작합니다. 현행은 베드 배정이 전제이고, 순서는 내원(`visitId`) 단위로 바꾸며, 기본 순서는 병원 단위 타이머 설정과 치료세트입니다. (레거시 차트 매뉴얼 「치료실 시간관리시스템」)
- **태블릿 용도:** 레거시 차트 태블릿(펜차트)은 서식 작성·촬영·진료내역 조회용입니다. 현행 태블릿 임베드는 치료실 보드입니다. (레거시 차트 매뉴얼 「펜차트 기능」)

## 미확인·추정

- **전자서명:** 진료 보드 안에서 서명을 받는 UI나 API는 보이지 않습니다. 기록 삭제 안내에 "전자서명"이 연관 기능으로 언급되고, 서명 조회는 `GET /signing/medical-records/record/{record_id}`(`ElectronicSignatureView`)에만 있습니다. 진료기록 전자서명은 별도 화면에서 하는 것으로 보입니다 (추정).
- **기록 삭제 사유:** `DELETE /record/{rid}`에 사유를 보내는지 확인하지 못했습니다. endpoints.md에는 body 키가 없습니다.
- **`원외탕전주문` 탭:** 탭 키는 있지만 레일 버튼을 찾지 못했습니다. 다른 경로로 `asideTab`을 정하는 것으로 보입니다 (추정).
- **`/canvas` 접근 제어:** route meta가 없어서 가드의 인증 처리를 확인하지 못했습니다. `disabled=true` 쿼리를 CanvasView가 어떻게 해석하는지도 확인하지 못했습니다.
- **`/treatment/repeat-results`:** `requiresAuth`가 없습니다. 의도인지는 확인하지 못했습니다.
- **`AiAgent`:** 래퍼의 기능은 분석하지 않았습니다. `GET /chart/record-llm/record/{id}`(`진료llm대화목록`)가 TreatmentView 청크에 있습니다.
- **`window.__treatmentNavigate`:** 호출하는 쪽을 찾지 못했습니다 (외부·임베드 진입용으로 추정).
- **`showEmrFeatures` 거짓 경로:** `TreatmentViewBoardPrescriptionLite`를 LITE(비급여 전용) 계정 화면으로 보았습니다 (추정).
- **minify된 식별자:** `QS`/`YS`/`XS`(LITE 주문 상태 판정), `gle`(오늘 여부)는 사용 맥락으로만 의미를 추정했습니다.
