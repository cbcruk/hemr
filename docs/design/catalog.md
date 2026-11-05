# Catalog: 참조데이터와 병원 설정

진료·수납·청구가 참조하는 코드표와 병원별 설정을 다룹니다. 현행 `/settings/*` 181개 엔드포인트와 static CDN JSON을 정리합니다.

## 현행에서 고칠 점

- **버전 선택이 클라이언트 하드코딩입니다.** KCD·KOICD·자보수가는 `2026-01-01` 컷오프를 코드에 박아 두고 진료 `기준일시`로 구버전/신버전을 고릅니다. 수가코드만 서버가 준 `적용일자목록`에서 고릅니다. 다음 개정 때마다 클라이언트 배포가 필요합니다
- **검색이 클라이언트에 있습니다.** KCD 전체 JSON을 내려받아 브라우저에서 검색합니다
- **같은 개념이 여러 경로에 있습니다.** `/settings/nonbenefits`(v1, 삭제)와 `/v2`(생성·수정·즐겨찾기), `/settings/chubyak-pilots/*`(레퍼런스)와 `/settings/hospitals/chubyak-pilots/*`(병원 소유), `/settings/treatments/rooms`(설정)와 `/treatments/*`(런타임)
- **메서드가 섞여 있습니다.** 단일 객체 설정에 PATCH와 PUT, 정렬에 `PATCH {순서}`와 `PUT .../sort-order`
- **검증 전용 엔드포인트**(`/validate`)와 **삭제 영향 미리보기 GET**(`GET .../affected-packages/delete`)이 있습니다

## 참조데이터 (전국 공통, 읽기 전용)

모든 참조데이터를 **유효기간이 있는 행**으로 저장하고, 조회 시 기준일을 받습니다.

```
GET /reference/{dataset}?asOf=2025-12-31&q=요통&limit=20
GET /reference/{dataset}/{code}?asOf=2025-12-31
GET /reference/{dataset}/versions
```

| `dataset` | 현행 | 비고 |
|---|---|---|
| `diagnoses-kcd` | `kcd/20250722.json`, `kcd/20260101.json` | 상병. `q`는 코드·한글명·영문명·초성 검색 |
| `diagnoses-koicd` | `koicd/*.json` | 한의 상병 |
| `fee-codes` | `/settings/references/reimbursement-codes?적용일자` | 수가코드·단가·카테고리 |
| `auto-insurance-fees` | `jaboReimbursement/*.json` | 자보 수가 |
| `auto-insurance-herbal-*` | `jaboHerbalComponents`, `jaboHerbalEffects`, `jaboSyndromes` | 자보 첩약 |
| `herbal-applicable-diseases` | `herbalApplicableDiseases/*.json` | 첩약 적용 상병 |
| `rare-diseases` | `rareDiseases/*.json` | 산정특례 |
| `acupoints`, `herbal-pharmacopoeia`, `reference-formulas`, `simple-extracts` | `/settings/references/*` | 경혈·공정서·원방·단미엑스 |
| `regulatory-limits` | (클라이언트 상수) | 첩약 처방 한도 8/60/600, 추나 연 20회 등 고시 한도값 ([clinical.md](clinical.md#완료-검증-규칙)) |
| `retention-policies` | (없음) | 기록 종류별 보존기간·기산점 ([compliance.md](compliance.md#보존)) |
| `family-relations` | `/desk/families/relation-dictionaries` | 가족 관계 사전 |

- 각 행: `{ code, name, validFrom, validTo, attributes }`
- `asOf`를 빼면 오늘 기준입니다. 진료·청구 서버 로직은 항상 해당 진료일을 `asOf`로 씁니다
- 버전은 `{ versionId, validFrom, validTo }`이고 `validFrom ≤ asOf < validTo`인 버전을 씁니다. 없으면 422 `REFERENCE_DATA_UNAVAILABLE`입니다. 진료 시각은 병원 시간대 날짜로 바꿔 비교합니다. 판정은 [reference-version.ts](../../src/modules/catalog/reference/reference-version.ts)
- 클라이언트가 오프라인 검색을 원하면 `GET /reference/{dataset}/snapshot?asOf=` → 서명된 CDN URL을 받습니다. 어떤 스냅샷을 쓸지는 서버가 정합니다
- 새 고시가 나오면 데이터 적재만 하면 됩니다. 클라이언트 배포가 필요 없습니다

## 병원 설정

181개 엔드포인트를 리소스 20여 개로 묶습니다. 모든 컬렉션은 같은 CRUD 형태를 따릅니다.

```
GET    /settings/{resource}                 목록 (정렬 순서대로)
POST   /settings/{resource}                 생성 (중복은 409)
PATCH  /settings/{resource}/{id}            수정 (If-Match)
DELETE /settings/{resource}/{id}            삭제 (참조 중이면 409 + 영향 목록)
PUT    /settings/{resource}:reorder         { ids: [...] }
POST   /settings/{resource}/{id}:duplicate
```

단일 객체 설정(진료시간, 예약 정책)은 `GET/PATCH /settings/{name}` 형태입니다.

### 진료 항목·가격표

| 리소스 | 현행 | 핵심 필드 |
|---|---|---|
| `nonbenefit-items` | `/settings/nonbenefits`(v1·v2 혼재), `/nonbenefit-groups`, `/nonreimbursed-herb-templates` | `name`, `code`, `unitPrice`, `taxType`(`TAXABLE`/`TAX_EXEMPT`), `reportCode`(비급여 보고코드), `groupId`, `favorite`, `validFrom` |
| `nonbenefit-item-groups` | `/settings/nonbenefit-groups` | |
| `package-products` | `/settings/nonbenefit-packages`, `/nonbenefit-package-groups` | `type`(`SESSION_COUNT` 횟수차감형 / `FIXED_AMOUNT` 정액형), `validityDays`, `price`, `items[]` |
| `medicines` | `/settings/medicines` (+`from-custom`, `from-mixture`, `dosages`) | 보험 한약제제. 생성 출처는 `source: CUSTOM | MIXTURE` 필드로 |
| `preset-prescriptions` | `/settings/appointed-prescriptions` (+groups, sort-order) | 약속처방 |
| `personal-formulas` | `/settings/personal-formulas` | 원장 개인 방제 |
| `auto-insurance-items` | `/settings/car-insurances/{herbal-decoctions, herbal-medicines, pharmacopunctures, procedure-fee}` | `kind` 필드로 하나로 |
| `industrial-accident-items` | `/settings/sanjae-insurances/herbal-decoctions` | |
| `pilot-herbal-products` | `/settings/hospitals/chubyak-pilots/herbs`, `/prescriptions` | 첩약 시범사업 병원 보유 약재·처방 |
| `expendables` | `/settings/treatments/expendables` (+histories) | 치료재료. 구매 이력은 `expendables/{id}/purchases` |

- **가격 변경 영향:** 비급여 단가·과세구분을 바꾸면 그 항목을 쓰는 패키지 상품이 영향을 받습니다. 현행은 `GET .../affected-packages/delete`로 미리 보고 `POST .../affected-packages/update`로 반영합니다
  - 재설계: `PATCH /settings/nonbenefit-items/{id}?dryRun=true`가 `impacts.packageProducts[]`를 돌려주고, 실제 PATCH 본문의 `propagateTo: ["packageProducts"]`로 함께 반영합니다
- **검증 규칙(서버):** 임의처방 약재 15종·50g·3,000원 이하(약재별 반올림 후 합산), 비급여 금액 10,000,000원 이하, 한 패키지에 과세·면세 혼합 불가, 이름 중복 불가. 현행 동작과 경계값은 [settings-validation](../reference/rules/settings-validation.md)
- **가격은 기간을 가집니다.** 진료 당시 단가로 수납·청구를 다시 계산할 수 있도록 `validFrom`을 둡니다. 처방 라인은 생성 시 단가를 복사해 둡니다 ([clinical.md](clinical.md#처방-라인))

### 운영

| 리소스 | 현행 | 비고 |
|---|---|---|
| `clinic-hours` (단일) | `/settings/clinic-hours` | 요일별 진료·휴게 시간 |
| `clinic-calendar` | `/settings/clinic-calendar/days`, `/closed-days`, `/holidays/*` | `GET /settings/clinic-calendar?from=&to=` → 일자별 `{ closed, specialHours }`. 공휴일은 참조데이터 |
| `doctor-schedules` | `/settings/doctor-schedules`, `/clinic-schedules`, `/doctors/{id}` | 의사별 주간 패턴 + 일자별 예외(`대체진료의Id` 포함) |
| `appointment-policy` (단일) | `/settings/appointments` | `slotMinutes`, `capacityPerSlot`, `noShowAfterMinutes`(10/30/60), `noShowAtClinicClose` |
| `visit-types` | `/settings/medical-treatments` | 현행 "진료항목". 이름 충돌을 피하려고 `visit-types`로 바꿈. `defaultDurationMinutes`, `exclusiveBooking`(현행 `추가예약제한`) |
| `patient-grades` | `/settings/patient-levels` | `discountRate` |
| `referral-sources` | `/settings/visit-pathways` | 내원경로 |
| `treatment-rooms` | `/settings/treatments/rooms` | 치료실 최대 10개, 치료실당 `bedCount` 1–20 정수 (현행은 소수도 통과) |
| `procedure-sets` | `/treatments/groups` | 치료실 세트. 현행은 설정인데 런타임 경로에 있음 |
| `procedure-timers` (단일) | `/treatments/timer-config` | |
| `encounter-policy` (단일) | `/settings/treatments`, `/treatments/auto-record`, `/initial-records`, `/treatments/vitals` | 초진 산정일수, 시술 자동기록, 초진기록 자동고정, 추나 자동승인, 활력징후 항목 |
| `text-snippets` | `/settings/templates`, `/treatment-templates`, `/documents/phrases`, `/messages/phrases` | `context: RECORD | DOCUMENT | MESSAGE | GENERAL`로 하나의 리소스 |
| `herbal-dispensaries` | `/settings/dispensary-rooms` | 원내·원외 탕전실 |
| `display` (단일) | `/settings/display/*` | 차트번호 표기, 주민번호 뒷자리 표시 |
| `jeju-program` (단일) | `/settings/jeju-claim` | 제주 지원사업 운영 여부·지급계좌 |
| `chart-number-policy` (단일) | `/settings/hospitals/chart-number` | 자동 채번 방식 |
| `expense-categories` | `/desk/expenses/items` | 지출 항목 ([front-desk.md](front-desk.md#시재와-지출)) |
| `drawing-templates` | `/record/canvas/templates` | 그림 차트 템플릿 ([clinical.md](clinical.md#캔버스-그림-차트)) |
| `form-templates` | `/tablet/questionnaire-templates`, `/tablet/consent-document-templates` | 문진·동의서 ([documents.md](documents.md#태블릿-문진동의서)) |
| `tablet` (단일) | `/tablet/settings/{admin-pin, languages, review-links, treatment-items}` | 키오스크 PIN, 언어, 리뷰 링크, 셀프 접수 진료항목 |
| `nhic-certificate` (단일) | `/nhic/cert-files` | 공단 인증서 ([claims.md](claims.md#자격조회-nhic)) |

- 설정 쓰기 권한은 `setting.{area}:update` 하나로 판정합니다. 현행 `normal_setting`, `info_setting`, `record_setting` 등은 area 이름이 됩니다
- 현행 사이드바 메뉴 코드(`normal_settings`)와 권한 enum(`normal_setting`)의 철자 불일치 같은 문제는 서버가 메뉴 노출 권한을 계산해 주면 생기지 않습니다

## 이벤트

- `settings.changed { resource, id }`: 다른 단말의 캐시 무효화용
- `reference.dataset_published { dataset, validFrom }`: 새 고시 적재
