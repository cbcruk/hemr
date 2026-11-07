# Patients

환자와 환자에 딸린 장기 데이터(연락처·주소·가족·동의·메모·보험 자격·패키지 계약·선수금)를 다룹니다. 하루 단위 흐름(예약·내원·수납)은 [front-desk.md](front-desk.md)에 있습니다.

## 현행에서 고칠 점

- **`환자Id`와 `차트Id`가 따로 있습니다.** 수납·선수금은 `차트Id`, 나머지는 `환자Id`로 조회합니다. 한 환자에 차트가 여럿인 경우가 관찰되지 않았습니다 (추정: 레거시 이관 흔적)
- **같은 데이터가 여러 경로에 있습니다.** 메모(`/patients/{pid}/memos/{id}` vs `/patients/memos/{id}`), 수납상세 조회 3개 경로, 자보 접수(`/patients/{id}/car-waiting` 생성 vs `/patients/car-waiting/{id}` 수정)
- **차트번호 검증과 저장 사이에 경쟁 조건이 있습니다.** `GET .../validations` → `POST /patients/new`
- **패키지 사용내역이 두 이름입니다.** `usage-records/{id}/cancel`과 `usage/{id}/revive`
- **동의 데이터가 두 군데입니다.** EMR 환자의 `광고수신동의여부`(동의/거부/미정)와 CRM 수신거부의 `isMarketingAgreed`(bool). 동기화 방식이 보이지 않습니다
- **주민등록번호가 목록 응답에 실립니다** (추정: 화면 설정으로 뒷자리를 가림)

## 용어

| 업무 용어 | 키 |
|---|---|
| 환자 | `Patient` |
| 차트번호 | `chartNumber` |
| 주민등록번호 | `rrn` (응답은 `rrnMasked`) |
| 건강보험증번호 | `nhisCardNumber` |
| 최초내원일 | `firstVisitDate` |
| 동의 (목적별 기록) | `Consent` (`purpose`, `status`, `source`) |
| 내원경로 / 소개자 | `referralSourceId` / `referrerPatientId` |
| 환자 등급 | `gradeId` |
| 자보 / 산재 / 의료급여 | `AUTO_INSURANCE` / `INDUSTRIAL_ACCIDENT` / `MEDICAL_AID` |
| 비급여 패키지 계약 | `PackageContract` |
| 선수금 | `PrepaidAccount` |

## 환자 애그리거트

```
Patient
├─ identity: name, rrn(암호화), birthDate, isLunarBirthday, sex
├─ chartNumber (테넌트 내 유일)
├─ contacts[]: { kind: MOBILE|HOME|GUARDIAN, number, isPrimary }
├─ addresses[]: { roadAddress, detail, zipCode, isPrimary }
├─ family: familyId, relation
├─ profile: gradeId, referralSourceId, referrerPatientId, notes, profileImageId
├─ consents[]: { purpose, status, channel, decidedAt, source }
├─ firstVisitDate (파생: 첫 내원 완료 시 서버가 설정)
└─ status: ACTIVE | MERGED | DELETED
```

- **차트 개념은 없앱니다.** `chartNumber`는 환자의 속성이고, 수납·선수금도 `patientId`로 묶습니다. 이관 데이터에 환자 하나 = 차트 여럿인 경우가 실제로 있다면 `MERGED` 상태와 병합 이력으로 처리합니다
- **주소·연락처는 환자 하위 컬렉션입니다.** 현행 `/desk/addresses/{환자Id}`(+`POST .../delete/{id}`)를 `/patients/{id}/addresses`로 옮깁니다

### 엔드포인트

```
GET    /patients?q=&grade=&lastVisitFrom=&cursor=     q는 이름·차트번호·전화번호 뒷자리·초성
POST   /patients                                       { ..., chartNumber? }  # 비우면 정책대로 자동 채번
GET    /patients/{id}
PATCH  /patients/{id}                                  If-Match
DELETE /patients/{id}                                  진료 이력이 있으면 409 (아래 보존 규칙)
GET    /patients/{id}/rrn                              X-Access-Reason 필수, 감사 기록
POST   /patients:merge                                 { sourceId, targetId }
POST   /patients:import                                → Job (현행 /async-tasks/patient-excel-import)
POST   /patients:export                                → Job, X-Access-Reason 필수
GET    /patients/{id}/timeline?types=visit,encounter,receipt,document,message
```

- **중복 확인:** `POST /patients`가 같은 주민번호면 409 `PATIENT_DUPLICATE_RRN`과 기존 `patientId`를 줍니다. 입력 중 확인은 `?dryRun=true`. 현행 `POST /patients/check-ssn`은 없앱니다
- **차트번호:** DB 유일 제약으로 보장합니다. 추천 번호는 `GET /patients:next-chart-number`로 보여 주기만 하고, 저장 시 비우면 서버가 그 순간 채번합니다. 오프라인 신환은 엣지가 미리 빌린 번호를 씁니다 ([offline.md](offline.md#차트번호))
- **보존:** 진료기록이 있는 환자는 삭제하지 않습니다 ([compliance.md](compliance.md#보존)). `DELETE`는 진료 이력이 없는 잘못 등록된 환자에만 허용합니다
- **타임라인:** 현행 환자 상세가 진료·수납·서류·문자·동의 이력을 각각 부르던 것을 한 번에 커서로 받습니다

### 가족

```
GET  /patients/{id}/family                  → { familyId, members[{ patientId, relation }] }
PUT  /patients/{id}/family                  { familyId?, relation }
GET  /reference/family-relations
```

### 메모

```
GET    /patients/{id}/memos?category=
POST   /patients/{id}/memos                 { category: STAFF|DOCTOR|CONSULT|OTHER, body, pinned }
PATCH  /memos/{memoId}
DELETE /memos/{memoId}
```

- AI 에이전트(API 토큰)가 만든 메모는 `status: PROPOSED`로 생성되고, `POST /memos/{id}:approve` / `:reject`로 확정합니다. 현행 `/patients/me/pending-notes`, `/patients/memos/{id}/approve`를 대체합니다

### 동의

동의는 목적별 최신 상태 + 이력으로 둡니다. CRM은 이 값을 읽기만 합니다 ([crm.md](crm.md#동의와-수신거부)).

| `purpose` | 의미 |
|---|---|
| `MARKETING_SMS`, `MARKETING_KAKAO` | 광고성 정보 수신 |
| `MARKETING_NIGHT` | 21:00–08:00 광고성 정보 수신 (정보통신망법상 별도 동의) |
| `INFO_MESSAGE` | 알림성 정보 수신 |
| `THIRD_PARTY_PROVISION` | 제3자 제공 |
| `TREATMENT_CONSENT:{templateId}` | 시술 동의서 (태블릿 서명) |

- `status`: `GRANTED`, `DENIED`, `UNDECIDED`, `WITHDRAWN`
- `source`: `DESK`, `TABLET`, `PATIENT_080`(080 수신거부, 병원이 되돌릴 수 없음), `IMPORT`
- 080 거부는 Integrations가 받아 `consent.changed` 이벤트로 반영합니다
- **환자로 등록되지 않은 전화번호의 수신거부**(080, 번호·엑셀 일괄 등록)는 환자 동의에 담을 수 없으므로 CRM의 번호 단위 `Suppression`에 둡니다 ([crm.md](crm.md#동의와-수신거부)). 발송 시에는 두 곳을 모두 검사합니다

```
GET  /patients/{id}/consents
POST /patients/{id}/consents                { purpose, status, source, evidenceDocumentId? }   # 이력 추가, 덮어쓰지 않음
GET  /patients/{id}/consents/history
```

### 등록·조회·동의 구현 결정

구현은 [src/modules/patients](../../src/modules/patients)에 있습니다 (#15).

- **범위:** 신원(이름·주민번호·생년월일·음력 여부·성별), 차트번호, 연락처·주소, 메모(`notes`), 동의입니다. `POST/GET/PATCH /patients`, `GET /patients:next-chart-number`, `GET /patients/{id}/rrn`, `GET/POST /patients/{id}/consents`, `GET /patients/{id}/consents/history`를 엽니다
  - 미룸: 가족, 메모(`memos`), 등급·내원경로·소개자·사진, `DELETE`, `:merge`·`:import`·`:export`, 타임라인, `?dryRun=true`, 차트번호 임대, `grade`·`lastVisitFrom` 필터, `firstVisitDate` 설정(내원 완료가 생길 때)
- **차트번호:** 비우면 그 병원의 숫자 차트번호 중 가장 큰 값 + 1입니다(`chart_seq`). 숫자가 아닌 번호(`A-12`)는 채번에서 빠지고, `0041`은 41로 셉니다. 숫자로만 된 수동 번호는 12자리까지 받고 채번은 15자리까지 세어, 큰 수동 번호 하나 때문에 자동 채번이 계속 실패하지 않습니다. 채번과 쓰기를 한 트랜잭션에서 하고 `(tenant_id, chart_number)` 유일 제약이 마지막으로 막습니다. 겹치면 409 `CHART_NUMBER_TAKEN`입니다
  - 대안: 병원별 채번 카운터 테이블. 수동 번호와 섞이면 카운터가 실제 최댓값과 어긋나 버렸습니다. 환자 수가 많아지면 `(tenant_id, chart_seq)` 색인으로 최댓값을 찾습니다
- **주민등록번호 저장:** 원문 열이 없습니다. 세 값만 둡니다
  - `rrn_sealed`: AES-256-GCM 암호문. 병원 + 환자 ID를 연관 데이터로 묶어 다른 행으로 옮겨 붙이면 풀리지 않습니다
  - `rrn_index`: 병원별 키의 HMAC-SHA256. `(tenant_id, rrn_index)` 유일 제약으로 중복을 막고, 409 `PATIENT_DUPLICATE_RRN`에 기존 `patientId`를 줍니다. 병원마다 값이 달라 색인으로 병원 사이를 잇지 못합니다(compliance.md "테넌트별 솔트")
  - `rrn_masked`: `900101-1******`. 읽을 때마다 복호화하지 않으려고 저장합니다. 화면 설정 "주민번호 뒷자리 표시"가 생기면 이 값 대신 설정에 맞춰 만듭니다
  - 키는 `PATIENT_DATA_KEY`(base64, 32바이트 이상) 하나에서 HKDF로 나눕니다. 없으면 서버가 시작하지 않고, 로컬 개발 모드에서만 저장소에 있는 고정 개발 키를 씁니다. 개발 DB를 재시작 뒤에도 읽어야 해서 프로세스마다 만들지 않습니다. 키 교체(다시 암호화)는 미룹니다
  - 검증: `900101-1234567` 또는 13자리, 실제 생년월일. 끝자리 검증식은 2020년 10월부터 맞지 않아 보지 않습니다
- **생년월일·성별:** 등록 때 비어 있으면 주민번호에서 채웁니다. 주민번호와 함께 있으면 맞아야 하고(`RRN_MISMATCH`), 수정은 채우지 않고 검사만 합니다. 번호를 바꾸면 생년월일도 함께 보내야 합니다. 대표 연락처·주소는 하나까지입니다(`MULTIPLE_PRIMARY`)
- **원문 조회:** `GET /patients/{id}/rrn`은 새 권한 `patient.rrn:read`(대표원장·봉직의·실장·데스크, 치료사 제외)와 `X-Access-Reason`이 필요합니다. 헤더는 ASCII만 실을 수 있어 한글 사유는 `encodeURIComponent`로 보내고, 풀고 나서 1–200자여야 합니다. 원문을 주기 전에 `access_logs`에 `READ_RRN`과 사유를 남깁니다. 기록이 실패하면 원문도 나가지 않습니다
  - 대안: `patient:read`로 충분하게 하기. 치료사도 원문을 보게 돼 버렸습니다
  - 미룸: 상세·목록 조회의 열람 기록(conventions.md는 조회도 남기라고 합니다), 열람 기록 조회 API, 기록의 IP·기기, 기록을 고칠 수 없게 막기(compliance.md)
- **검색 `q`:** 숫자(하이픈 허용)면 차트번호 앞부분이나 전화번호 끝자리, 초성만이면 이름 초성, 그 밖이면 이름 일부(대소문자 무시)나 차트번호 앞부분입니다. 숫자 검색은 하이픈을 뺀 값과 입력 그대로를 함께 써서 `2024-001` 같은 차트번호도 찾습니다. 검색용 파생 열 `name_initials`·`name_folded`(JS로 소문자로 바꾼 이름. SQLite `lower()`는 ASCII만 바꿉니다)·`phone_digits`를 저장할 때 만듭니다. 정렬은 이름, ID이고 커서는 앞 쪽 마지막 환자의 ID입니다. 커서에 이름을 실으면 URL과 로그에 남아, 이름은 서버가 다시 읽습니다
- **수정:** `PATCH`는 보낸 필드만 바꾸고 `null`은 지웁니다. 컬렉션은 통째로 바꿉니다. 바뀐 것이 없으면 버전을 올리지 않습니다. `If-Match`는 내원 커맨드처럼 선택이고, 없으면 다시 읽어 3번까지 되풀이합니다
  - 대안: `If-Match` 필수(428). 이름·연락처 수정이 덮어써질 위험은 있지만 같은 API 안에서 규칙을 하나로 두려고 미뤘습니다. 동시 수정 사고가 보이면 필수로 바꿉니다
- **동의:** 기록을 쌓기만 하고 목적별 마지막 기록이 현재 상태입니다. 환자 응답의 `consents`가 현재 상태라 CRM은 이것만 읽습니다. 직원 세션의 기록은 출처가 늘 `DESK`이고 본문으로 바꿀 수 없습니다. `TABLET`은 환자 본인의 기록이라 기기 토큰(`consent:sign`)이 생기면 그 입구에서만 쓰고, `PATIENT_080`·`IMPORT`는 연동·이관 작업이 저장소에 직접 씁니다. 마지막 080 거부(`DENIED`·`WITHDRAWN`) 뒤에 환자 본인의 `GRANTED`(`TABLET`·`PATIENT_080`)가 없으면 직원이 `GRANTED`를 기록할 수 없습니다(409 `CONSENT_LOCKED_BY_PATIENT`). 사이에 `UNDECIDED` 같은 기록을 끼워 넣어도 풀리지 않습니다. 동의는 환자 버전을 올리지 않습니다
  - 확인과 쓰기 사이에 080 거부가 끼어들면 데스크 동의가 뒤에 쌓일 수 있습니다. 080 연동이 생길 때 한 트랜잭션으로 묶습니다
- **이벤트:** `patient.created { patientId, chartNumber }`, `patient.updated { patientId, fields }`(바뀐 필드 이름만, 값은 없음), `consent.changed { patientId, purpose, status, source }`. 모두 `tenantId`·`actor`를 채우고 주민번호는 싣지 않습니다
- **되돌릴 조건:** 병원이 수동 채번만 쓰면 자동 채번을 끄는 설정을 더합니다. 검색이 느려지면 SQLite FTS로 옮깁니다

### 문진·시술동의서 기록

태블릿에서 받은 문진과 동의서는 [documents.md](documents.md#태블릿-문진동의서)의 `IntakeSubmission`으로 저장하고, 환자에서는 목록만 봅니다.

```
GET /patients/{id}/intake-submissions?kind=QUESTIONNAIRE|CONSENT
GET /patients/{id}/questionnaire-trends?questionKey=
```

### 보험 자격

접수 시 조회한 결과를 그 내원의 **스냅샷**으로 남기고, 환자에는 장기적인 보험 정보만 둡니다.

| 리소스 | 내용 | 현행 |
|---|---|---|
| `AutoInsuranceCase` | 자동차보험 사고 건: `accidentReportNumber`(사고접수번호), `guaranteeNumber`, `insurerCode`, `guaranteeFrom/To`, `guaranteeLimit`, `status: ACTIVE|CLOSED` | `/patients/{id}/car-waiting` |
| `IndustrialAccidentCase` | 산재 건: `businessType`(요양/예방), `employerRegistrationNumber`, `approvalNumber`, `accidentDate`, `approvedOn`, `treatmentEndOn` | `/patients/{id}/sanjae-waiting` |
| `JejuSubsidyEnrollment` | 제주 지원사업 자격: `program`, `activeFrom/To`, `status` | `/patients/{id}/jeju-supports` |

```
GET   /patients/{id}/auto-insurance-cases
POST  /patients/{id}/auto-insurance-cases
PATCH /auto-insurance-cases/{caseId}
POST  /auto-insurance-cases/{caseId}:close
GET   /auto-insurance-cases/{caseId}/usage        → { billedTotal, guaranteeLimit, remaining }  # 현행 car-waiting/amount/{사고접수번호}
```

산재·제주도 같은 형태입니다. 현행 제주는 `PATCH .../deactivate`를 `:deactivate` 커맨드로, 산재에 없던 생성·삭제를 추가합니다.

## 패키지 계약

비급여 패키지 상품([catalog.md](catalog.md#진료-항목가격표))을 환자가 구매한 것입니다.

```
PackageContract
├─ productId, productSnapshot (구매 시점 상품 복사)
├─ type: SESSION_COUNT | FIXED_AMOUNT
├─ totalSessions, usedSessions (SESSION_COUNT)
├─ totalAmount, usedAmount (FIXED_AMOUNT)
├─ startsAt, expiresAt
├─ status: ACTIVE | EXPIRED | TERMINATED
└─ usages[]: { id, encounterId, prescriptionLineId, sessions|amount, status: APPLIED|CANCELED, appliedAt }
```

```mermaid
stateDiagram-v2
  [*] --> ACTIVE: 수납 시 구매
  ACTIVE --> EXPIRED: 만료일 경과 (서버 스케줄러)
  ACTIVE --> TERMINATED: :terminate {reason}
  EXPIRED --> ACTIVE: :extend {expiresAt}
  TERMINATED --> ACTIVE: :reactivate
  ACTIVE --> ACTIVE: 사용 / 사용 취소
```

```
GET  /patients/{id}/package-contracts?status=
GET  /package-contracts/{contractId}
POST /package-contracts/{contractId}:terminate     { reason }
POST /package-contracts/{contractId}:reactivate
POST /package-contracts/{contractId}:extend        { expiresAt }
GET  /package-contracts/{contractId}/usages
POST /package-usages/{usageId}:cancel
POST /package-usages/{usageId}:restore
GET  /package-contracts/{contractId}/history
```

- **재개 조건(서버):** 만료일이 하루 이상 남아 있고, `SESSION_COUNT`면 잔여 횟수가 있어야 합니다. 현행은 클라이언트만 확인했습니다. 어긋나면 409 `PACKAGE_NOT_REACTIVATABLE`
- `EXPIRED`는 현행에 명시적 상태로 보이지 않았지만(CRM 목록에만 `EXPIRED`가 있음) 서버 스케줄러가 전이시켜 상태로 둡니다
- **사용 생성은 처방에서만 합니다.** 진료의 처방 라인이 `packageContractId`를 가지면, 그 라인의 금액이 확정될 때(진료 완료와 수납 중 먼저 오는 쪽) 사용이 생깁니다. 사용 내역을 직접 만드는 API는 두지 않습니다. 현행 `DELETE usage/{id}`(사용내역 삭제)는 `:cancel`로 대체하고 지우지 않습니다

## 선수금

```
PrepaidAccount (환자당 계열별 하나)
├─ patientId
├─ kind: CASH_LIKE | CARD_LIKE          # 현행 선수금계열. 환불 수단 제약 때문에 분리
├─ balance (파생)
└─ transactions[]: { type: CHARGE|USE|REFUND|CHARGE_CANCEL|REFUND_CANCEL, amount, method, receiptId?, by, memo, at }
```

```
GET  /patients/{id}/prepaid                         → { accounts[{ kind, balance }] }
GET  /patients/{id}/prepaid/transactions?cursor=
POST /patients/{id}/prepaid:charge                   { kind, amount, method, memo }        Idempotency-Key
POST /patients/{id}/prepaid:refund                   { amounts: [{ kind, amount }], refundMethod, reason }   Idempotency-Key
POST /prepaid-transactions/{txId}:cancel
```

- 현행은 계열마다 환불을 따로 불렀습니다. 재설계는 한 요청에 계열별 금액을 받아 한 트랜잭션으로 처리합니다
- 사용(`USE`)은 수납 커맨드 안에서만 생깁니다 ([front-desk.md](front-desk.md#수납))

## 이벤트

`patient.created`, `patient.updated`, `patient.merged`, `patient.photo_updated`, `memo.created/updated/deleted`, `memo.proposed`, `consent.changed`, `package_contract.status_changed`, `prepaid.changed`
