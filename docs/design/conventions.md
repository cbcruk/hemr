# API 규약

모든 모듈이 따르는 형태 규칙입니다. 현행 API에서 같은 개념이 여러 형태로 표현되던 문제(P4)를 없애는 것이 목적입니다.

## 경로

- **리소스는 영문 kebab-case 복수형입니다.** `/patients`, `/visits`, `/herbal-prescriptions`
  - 현행 한글 경로 세그먼트(`/desk/appointments/{id}/진료`)와 UI 이름이 드러난 경로(`/desk/waiting`, `/treatments/procedures/from-popover`)는 없앱니다
- **버전은 경로 맨 앞 하나만 둡니다.** `/v1/...`. 리소스 중간의 `v2`(`/desk/v2/receipts`, `/patients/v2/chart/...`)는 두지 않습니다
- **중첩은 소유 관계일 때 한 단계만 둡니다.** `/patients/{patientId}/memos`는 목록·생성만 받고, 개별 메모는 `/memos/{memoId}`로 다룹니다
  - 현행처럼 같은 메모가 `/patients/{pid}/memos/{id}`와 `/patients/memos/{id}` 두 경로로 노출되는 일을 막습니다
- **경로 변수 이름은 리소스 이름 + `Id`입니다.** `{param}`·`{id}`·`{청구Id}`가 섞이지 않게 합니다
- **삭제는 `DELETE`, 일괄 삭제는 `POST /{resource}:batchDelete`입니다.** 현행 `POST .../delete`, `POST .../bulk-delete`, `DELETE ...?{query}`를 이 형태로 통일합니다

## 필드와 값

- **JSON 키는 영문 camelCase입니다.** 한글 키(`진료Id`, `비급여처방관리Ids`), snake_case(`is_active`, `send_time_kst`)를 섞지 않습니다
  - 업무 용어와 영문 키의 대응은 각 도메인 문서의 **용어** 표에 둡니다. 화면 표시 문자열은 클라이언트의 i18n 사전이 맡습니다
- **enum 값은 영문 `SCREAMING_SNAKE_CASE`입니다.** `WAITING`, `IN_TREATMENT`. 현행 `대기`/`PENDING`/`scheduled` 혼재를 없앱니다
  - 심평원·공단이 정한 코드값(`본인부담률구분코드 = U`, 명세서 코드)은 원래 값을 그대로 쓰고 필드 이름에 `Code`를 붙입니다
- **날짜는 `YYYY-MM-DD`, 시각은 오프셋을 포함한 RFC 3339입니다.** 현행 `yyyyMMdd`, `yyyyMMddHHmm`, `yyyy-MM-dd`가 섞여 서버·클라이언트가 서로 다른 형식을 보내던 문제(연락 일정 v1)를 없앱니다
  - 진료일·예약일처럼 "그날"이 의미인 값은 `date` 타입(`2026-11-01`), 시점은 `dateTime` 타입으로 구분합니다
  - 병원 시간대는 테넌트 설정(`Asia/Seoul`)에 두고, 서버가 "오늘", "진료마감" 같은 경계를 그 시간대로 계산합니다
- **금액은 원 단위 정수입니다.** 과세·비과세처럼 나뉘는 금액은 `{ taxable, taxExempt }` 객체로 둡니다
- **불리언 대신 상태 enum을 우선합니다.** 상태를 나타내는 플래그 여러 개(`취소여부`, `부도여부`, `내원여부`, `삭제여부`)는 `status` 하나로 합칩니다
- **주민등록번호는 응답에 기본으로 넣지 않습니다.** 목록·상세 응답에는 `rrnMasked`(`900101-1******`)만 넣고, 원문은 사유를 받는 별도 엔드포인트로만 줍니다 ([compliance.md](compliance.md#개인정보-최소-노출))

## 응답 형태

envelope 없이 리소스 자체를 돌려줍니다. 현행 `data.results` / `data.data` / `data.result` / `data.message` / `data.messages` / `data.results.<한글키>`를 모두 없앱니다.

```jsonc
// GET /v1/patients/pat_01J...  → 200
{ "id": "pat_01J...", "name": "홍길동", "chartNumber": "1024", ... }

// GET /v1/patients?q=홍  → 200
{ "items": [ ... ], "nextCursor": "eyJ...", "totalCount": 132 }
```

- **ID는 접두사가 붙은 불투명 문자열입니다.** `pat_`, `vis_`, `enc_`, `rcp_`(수납), `pay_`(결제). 현행 v1 OCS처럼 PATCH가 404이면 목록을 뒤져 새 ID로 다시 시도하는 일이 없도록, ID는 생성 후 바뀌지 않습니다
  - ID는 보통 서버가 만들지만, 오프라인 엣지가 보내는 생성 커맨드는 엣지가 만든 ULID를 `id`로 실어 보낼 수 있고 서버는 그대로 씁니다 ([offline.md](offline.md#커맨드-큐))
- **상세 응답에는 `allowedActions`를 넣습니다.** 클라이언트가 버튼을 켜고 끄는 근거입니다

```jsonc
{
  "id": "pay_01J...",
  "status": "PARTIALLY_REFUNDED",
  "allowedActions": ["REFUND"],
  "warnings": [{ "code": "JEJU_SUBSIDY_LOCKED", "message": "Jeju subsidy lines cannot be edited." }]
}
```

## 페이지네이션

목록은 모두 커서 방식 하나만 씁니다. 현행 `limit/offset`, `next`, `before/limit`, `after/before` 4종을 대체합니다.

| 쿼리 | 의미 |
|---|---|
| `limit` | 1–200, 기본 50 |
| `cursor` | 앞 응답의 `nextCursor` |
| `sort` | `field` 또는 `-field` (리소스별 허용 목록) |

- `totalCount`는 비용이 큰 목록에서는 `?includeTotal=true`일 때만 계산합니다
- 엑셀 내보내기처럼 전체가 필요한 경우에는 클라이언트가 끝까지 반복 조회하지 않고 `Export` 작업([작업](#비동기-작업))을 만듭니다. 현행 비급여 목록은 `hasMore`가 거짓일 때까지 반복 호출한 뒤 클라이언트에서 거릅니다

## 오류

[RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)를 씁니다.

```jsonc
// 409
{
  "type": "https://api.example/errors/appointment-slot-full",
  "title": "Appointment slot is full",
  "status": 409,
  "code": "APPOINTMENT_SLOT_FULL",
  "detail": "Doctor doc_01 already has 3 appointments at 10:00.",
  "violations": [{ "field": "startAt", "code": "SLOT_FULL" }]
}
```

- `code`는 영문 상수이고 도메인 문서마다 목록을 둡니다. 현행 `AE_AUTH_ACCOUNT_LOCKED`, `ME_변수미충족수신자전원제외`, `근무형태_미지정` 같은 형식 혼재를 정리합니다
- 사용자에게 보일 문장은 클라이언트가 `code`로 고릅니다. `detail`은 개발자용입니다
- **요청 형식 오류는 400 `VALIDATION_FAILED`입니다.** 경로·쿼리·헤더·본문이 스키마를 통과하지 못하면 첫 오류에서 멈추지 않고 모든 위반을 `violations`에 담습니다
  - `field`는 JSON 경로(`payments[1].amount`)입니다. 값 전체가 잘못됐으면 요청 부분 이름(`path`, `query`, `headers`, `body`)을 씁니다
  - `code`는 `REQUIRED`(빠짐), `INVALID_TYPE`(타입이 다름), `INVALID_VALUE`(형식·범위·허용값이 아님), `UNKNOWN_FIELD`(정의되지 않은 필드) 중 하나입니다. 지금은 정의되지 않은 필드를 무시하므로 `UNKNOWN_FIELD`는 나오지 않습니다
  - 형식은 맞지만 업무 규칙에 어긋나는 요청은 409/422와 도메인 `code`로 구분합니다
- **예상 밖 오류는 500 `INTERNAL`이고 원인은 응답에 싣지 않습니다.** 대신 원인(Cause)을 오류 로그와 오류 보고자(`ErrorReporter`)에 남깁니다(`shared/problem/unexpected-error.ts`). 응답으로 바꾼 오류는 Effect HTTP 서버의 기본 보고·로그에 잡히지 않기 때문입니다. 오류 보고자는 아직 등록하지 않았으므로, 지금은 로그가 유일한 기록입니다. 모니터링을 붙일 때 `server.ts`에서 `ErrorReporter.layer`로 등록합니다
- **검증 전용 엔드포인트를 두지 않습니다.** 현행 `/auth/check-username`, `/settings/nonbenefits/validate`, `/desk/chart-numbers/{no}/validations`는 생성 요청의 409/422로 대체합니다
  - 입력 중 즉시 피드백이 필요한 곳(아이디 중복)은 `?dryRun=true`로 같은 생성 엔드포인트를 부릅니다. 검증 로직이 한 곳에만 있게 됩니다

## 커맨드

상태 전이와 여러 엔티티에 걸친 업무는 **커맨드 엔드포인트**로 받습니다. 형식은 `POST /{resource}/{id}:{command}`입니다.

```
POST /v1/visits/vis_01J...:checkout
POST /v1/encounters/enc_01J...:complete
POST /v1/external-herbal-orders/xho_01J...:hold
```

- **언제 커맨드를 쓰는가:** 서버가 전이 가능 여부를 판정해야 하거나, 부수효과(다른 리소스 변경·이벤트·외부 호출)가 있을 때입니다
- **언제 PATCH를 쓰는가:** 업무 규칙 없이 값만 바꿀 때입니다 (메모 내용, 표시 이름)
- `PATCH {status: "..."}`로 상태를 바꾸는 형태는 쓰지 않습니다. 어떤 전이인지 경로에서 드러나지 않고, 전이마다 필요한 입력(취소 사유 등)을 검증하기 어렵습니다
- 커맨드 응답은 바뀐 주 리소스입니다. 함께 바뀐 리소스는 이벤트로 알립니다
- **되돌리기(undo)는 역커맨드로 둡니다.** 현행은 v1 `undoToken`과 v2 `actionLogId` 두 방식입니다. 재설계에서는 되돌릴 수 있는 커맨드가 응답 헤더 `Undo-Token`을 주고, `POST /v1/undo {token}`이 하나로 받습니다

## 멱등성

외부 효과가 있거나 돈이 오가는 POST는 `Idempotency-Key` 헤더를 필수로 받습니다.

- **대상:** 수납·환불·선수금, 메시지 발송, 청구 전송 기록, 원외탕전 주문, 외부 예약 확정
- 같은 키로 24시간 안에 다시 오면 처음 응답을 그대로 돌려줍니다
- 현행 "청구 전송 후 서버 기록 실패 → 다시 기록" 같은 재시도가 중복 기록을 만들지 않게 합니다

## 동시성

여러 단말이 같은 환자·진료를 동시에 고치는 것이 일상입니다 (데스크·진료실·치료실·태블릿).

- 수정 가능한 리소스는 `version` 정수를 가집니다. 응답의 `ETag: "7"`을 다음 요청의 `If-Match: "7"`로 보내고, 어긋나면 412를 돌려줍니다. 예외: 치료실 시술은 상태 전이 409로 충분해 `If-Match`를 받지 않습니다 ([clinical.md](clinical.md#치료실-구현-결정))
- 진료기록은 현행처럼 클라이언트가 diff한 부분 페이로드를 보내되(`PATCH`), `If-Match`로 다른 사람의 변경을 덮어쓰지 않게 합니다. 현행에는 낙관적 잠금 흔적이 없습니다
- 차트번호처럼 유일해야 하는 값은 DB 유일 제약으로 보장합니다. 현행 "검증 → 저장" 사이 경쟁 조건을 없앱니다

## 비동기 작업

오래 걸리거나 외부 기관에 의존하는 일은 `Job` 리소스로 만듭니다.

```
POST /v1/patients:import          → 202 { "jobId": "job_01J..." }
GET  /v1/jobs/job_01J...          → { "status": "RUNNING", "progress": 0.4 }
```

| `status` | 의미 |
|---|---|
| `QUEUED` | 접수됨 |
| `RUNNING` | 처리 중 |
| `SUCCEEDED` | 완료, `result`에 결과 |
| `PARTIALLY_SUCCEEDED` | 일부 항목 실패, `result.items[].status`에 항목별 결과 |
| `FAILED` | 실패, `error`에 Problem Details |
| `CANCELED` | 취소됨 |

- 끝나면 `job.completed` 이벤트를 보냅니다 ([events.md](events.md)). 클라이언트는 폴링 대신 이벤트를 받습니다
- 여러 단계에 보상이 있는 작업([사가](events.md#정책과-사가))은 `Job`이 진행 상태를 담습니다. 사가의 단계 하나가 끝날 때마다 `progress`가 오르고, 보상까지 끝난 부분 실패는 `PARTIALLY_SUCCEEDED`입니다. 사가가 아닌 한 번짜리 작업(가져오기, 내보내기)도 `Job`입니다
- 현행 `async-tasks`, 수신자 추가 후 `receivers/count` 10회 폴링, 외부 예약 확정의 `summary{요청,성공,처리중,실패}`, 전자서명 5초 폴링, 청구 SAM 생성(60초 타임아웃)이 모두 이 형태가 됩니다

## 감사와 열람 기록

- 모든 쓰기 요청은 감사 로그에 `actor`, `tenant`, `resource`, `action`, `before/after 해시`, `ip`, `device`를 남깁니다
- 개인정보·진료정보 **조회**도 기록합니다. 현행 라우트 `meta.personalInfoKoPageName`이 화면 단위로 표시하던 것을 서버가 리소스 단위로 기록합니다
- 엑셀 다운로드·주민번호 원문 조회처럼 사유가 필요한 요청은 `X-Access-Reason` 헤더를 필수로 받습니다. 현행 `POST /patients/download-logs`, `POST /refusals/download {reason}`처럼 기록을 클라이언트가 따로 보내는 방식은 우회할 수 있습니다

## 코드의 용어

업무 용어를 코드로 옮길 때 번역이 흩어지면 문서와 코드가 어긋납니다(#36에서 산정특례 처리를 문서가 잘못 적은 일). 번역을 한 곳에 묶고, 사람이 읽는 곳은 한글로 씁니다 (#44). 키를 영문으로 두는 결정([D4](review.md#결정-필요))은 그대로입니다.

- **도메인 문서의 용어 표가 번역의 단일 출처입니다.** 업무 개념을 나타내는 새 식별자(형, 상태 값, 커맨드, 필드)는 그 도메인 문서의 용어 표에 먼저 올리고 씁니다. 표에 없는 번역어를 새로 짓지 않습니다
  - 한 한글 용어가 다른 키 둘을 가리키거나(정정: 진료기록 `amend`·수납 `correct`) 한 키가 모듈마다 다른 뜻이면(`:reopen`, `COMPLETED`) 표에 각각 적고 무엇이 다른지 적습니다
  - 영문 대응어가 없는 제도 용어(산정특례, 차상위)는 억지로 새 영어 낱말을 만들지 않고, 고시·공단의 코드 이름을 따릅니다(위 `Code` 규칙)
  - 대안: 따로 용어집 문서(`glossary.md`) 하나 두기. 도메인 문서 표와 내용이 겹쳐 둘이 어긋나므로 버렸습니다. 되돌릴 조건: 여러 도메인에 걸친 용어를 표에서 찾기 어려워지면 표를 모은 색인만 만듭니다
- **테스트 설명(`describe`·`it`)은 한글로 씁니다.** 실패 메시지가 업무 규칙 문장으로 읽히게 합니다. 예: `it('의료급여 미성년자는 면제 코드가 없으면 계산하지 않습니다')`. 기존 영문 설명은 그 테스트를 고칠 때 옮깁니다
  - 대안: 영문 설명 유지. 식별자와 같은 언어라 일관되지만, 업무 규칙을 영어로 옮기는 데서 다시 번역이 생겨 버렸습니다. 되돌릴 조건: 외부 기여자가 생겨 한글 설명이 걸림돌이 되면 영문으로 돌립니다
- **식별자와 외부 계약은 영문입니다.** HTTP 필드·오류 코드·이벤트 타입·DB 이름은 위 규약과 D4대로, 파일 이름은 유니코드 정규화(macOS NFD, Linux NFC) 차이로 git에서 깨질 수 있어 영문입니다. 한글 식별자는 아래 시범 범위에서만 씁니다
- **한글 식별자는 고시 용어를 옮기는 규칙 계산 안에서만 씁니다 (#45 시범).** [insured-copay.ts](../../src/modules/front-desk/receipts/insured-copay.ts)의 내보내지 않는 함수·지역 변수를 한글로 바꿨습니다: `본인부담금`, `상한전본인부담`, `노인외래본인부담`, `정률`, `요양급여비용총액`·`총액`, `투약`, `투약구간확장`, `백분율`, `의료급여1종면제코드`. 내보내는 이름(`insuredCopay`, `CopayBasis`, 입력 필드, 결과 키 `total`·`copay`)과 형의 리터럴(`'NHIS'`)은 영문 그대로라 호출하는 쪽은 바뀌지 않았습니다. 일반 도구 함수(`floorTo`, `blankToNull`)는 업무 용어가 아니라 영문입니다
  - 좋아진 점: 이름이 법령 용어(요양급여비용 총액, 본인부담금, 정률)이거나 그 줄임말이라 규칙 문서와 한 줄씩 맞춰 보기 쉽습니다. `seniorCopay`처럼 영어로 지은 이름이 무엇을 가리키는지 주석으로 되짚을 일이 줄었습니다. tsc 오류(`Cannot find name '정율'`)·스택 트레이스(`at 정률`)·prettier·vitest·grep 모두 문제없었습니다
  - 나빠진 점: 영문 입력(`age`, `dispensed`, `basis.kind`)과 한 줄에 섞입니다(`if (age >= 65) return 노인외래본인부담(총액, dispensed)`). 맞춤법 변형(정률/정율, 띄어쓰기)이 오타가 됩니다. 식별자는 tsc가 잡지만 문자열·객체 키는 못 잡아, 외부 계약에 쓰지 않는 이유가 하나 더 생겼습니다. 법령에 없는 낱말(`노인`, `투약구간확장`)은 결국 새로 지어야 해 번역이 완전히 사라지지는 않습니다. 입력할 때 한/영 전환은 사람이 써 봐야 압니다
  - 결정(#45): 이 모듈 하나로 두고, 저장소 주인이 써 보고 유지로 확정하면 넓힙니다
  - 대안: 내보내는 이름까지 한글(`급여본인부담()`). 호출하는 서비스 코드까지 섞여 범위가 계산 밖으로 번지므로 버렸습니다
- **#48에서 규칙 모듈로 넓혔습니다.** 저장소 주인이 확정했습니다. 코드 입력은 기계(에이전트)가 하므로 한/영 전환은 비용이 아니고, 사람은 함수·상수 목록(아웃라인)으로 구조를 파악할 때 한글이 더 쉽다는 이유입니다. 토큰이 더 드는 것은 감수합니다
  - 범위는 그대로입니다. 규칙 계산 모듈(`docs/reference/rules/`에 규칙 문서가 있는 모듈)의 내보내지 않는 함수·상수·지역 변수를 법령·공단 용어로 씁니다. 내보내는 이름·입력 필드·형의 리터럴·오류 코드는 영문입니다(D4와 외부 계약)
  - 처음에는 그 모듈을 고칠 때 바꾸기로 했습니다. 이름만 바꾸는 PR이 리뷰와 이력을 흐리기 때문입니다. #50에서 저장소 주인의 요청으로 나머지 규칙 모듈을 한 번에 바꿔 이 단서는 끝났습니다(아래)
  - 한글 식별자는 용어 표의 한글 용어를 따르되 표에 행을 더하지는 않습니다. 표는 업무 용어와 영문 키(외부 계약·내보내는 이름)의 대응이고, 내보내지 않는 한글 이름은 번역이 없기 때문입니다. 표에 없는 용어는 그 모듈의 규칙 문서(`docs/reference/rules/<규칙>.md`)가 쓰는 말을 따릅니다(#50). 둘 다에 없으면 새로 지은 말이 무엇을 담는지 주석으로 밝힙니다
  - 두 번째 시범은 [check-in-validation.ts](../../src/modules/front-desk/visits/check-in-validation.ts)입니다. 공단 코드의 뜻을 담은 상수(`접수불가급여제한코드`, `체납급여제한코드`, `선택의료기관적용자코드`, `의뢰본인부담여부코드`, `본인확인유효개월`, `본인확인필요나이`)와 판정 헬퍼(`공단자격조회대상`, `선택의료기관누락`, `저장할선택의료기관기호`)가 이름만으로 무엇을 검사하는지 드러납니다. 내보내는 `validateCheckIn`·`eligibilityKind`·`identityVerificationBlocks`·`subtractMonths`와 날짜 형식 검사(`ISO_DATE`, `assertDates`)는 업무 용어가 아니거나 내보내는 이름이라 영문입니다
  - 새로 알게 된 점: prettier는 한글을 두 칸으로 셉니다. 93자인 줄이 너비 127로 120을 넘어 줄바꿈되었습니다. 한글 이름이 길면 줄이 쉽게 넘치므로, 조건을 나눠 쓰거나 이름을 법령 용어 안에서 짧게 고릅니다
  - 넓힐 조건: 내보내는 이름까지 한글로 하는 것은 서비스·HTTP 코드에 한글이 섞여 D4 경계가 흐려지므로 계속 미룹니다. 저장소 주인이 부르는 쪽(서비스) 코드의 아웃라인도 한글로 읽고 싶다고 하면 다시 봅니다
  - 되돌릴 조건: 맞춤법 변형(정률/정율, 띄어쓰기) 때문에 생긴 버그가 한 번이라도 나오거나, 저장소 주인이 읽기 불편하다고 하면 영문으로 되돌립니다. 이름만 바꾸는 일이라 비용이 작습니다
- **#50에서 나머지 규칙 모듈에 한 번에 적용했습니다.** 저장소 주인의 요청입니다. 진료비(`clinical/fees`), 진료 규칙(추나·첩약 시범사업·산정특례·시술 타이머), 데스크(예약 수용·부도·결산·시재 원장·내원 상태), 그 밖(CRM 메시지·원외탕전 사전점검·설정 검증·참조데이터 버전)을 묶음별 PR로 나눴습니다. 동작은 바꾸지 않았고, 묶음마다 다른 에이전트가 이름의 뜻을 검토했습니다
  - 경계를 명확히 했습니다. **내보내는 함수의 매개변수도 영문입니다.** 부르는 쪽 편집기의 시그니처 힌트에 보여 내보내는 이름과 같은 자리이기 때문입니다. 내보내는 함수 안의 지역 변수와 콜백 매개변수는 한글로 씁니다. 내보내지 않는 형(`interface`·`type`)은 영문으로 두었습니다. 필드가 영문 키라 형 이름만 한글이면 오히려 섞이기 때문입니다
  - 업무 용어가 아닌 도구(날짜·시각 계산, 정렬·비교, 해시, 문자열 정리, `ids`)는 영문입니다. 하나만 들고 도는 반복 변수(`line`, `encounter`)와 결과 키를 그대로 받는 이름(`errors`, `warnings`)도 영문입니다
  - 픽스처 테스트(`*.fixtures.test.ts`)의 설명도 한글로 옮겼습니다. 픽스처 사례 이름(`'%s'`)은 데이터라 그대로입니다
  - 검토에서 되풀이된 실수와 지킬 점: ① 경계와 방향을 이름에 남깁니다(이하·미만, 그날 포함, `시작`·`종료`·`상한`). ② 이름이 코드보다 많이 말하지 않게 합니다(`자정넘김`이 잘못된 시각에도 참이던 것, `청구불가`가 첩약과 함께일 때만인 것). ③ 금액과 여부를 구분합니다(`과수납금사용액`, 판정 함수는 `~인가`·`~임`). ④ 단위를 밝힙니다(`발송시각초`, `백만분율`). ⑤ 용어 표가 동음이의로 표시한 말은 다 씁니다(`진료마감`, `결제취소일`). ⑥ 같은 뜻은 한 어간으로 씁니다
  - 되돌릴 조건은 위와 같습니다

## API 문서

OpenAPI 문서는 손으로 쓰지 않고 HTTP 계약(`Api`)에서 만듭니다([openapi.ts](../../src/openapi.ts)). 키는 영문이고(D4), 업무 담당자가 읽을 한글은 Schema 주석에 답니다 (#55).

- **저장본 [docs/reference/openapi.json](../reference/openapi.json)을 테스트가 지킵니다.** 계약을 바꾸고 `pnpm openapi`를 돌리지 않으면 테스트가 실패해, API 변경이 PR 차이에 그대로 보입니다. 생성 파일이라 GitHub 차이에서는 접힙니다(`.gitattributes`)
  - 대안: `GET /openapi.json`으로 서버가 내주기. 바뀐 것이 리뷰에 보이지 않아 버렸습니다. 문서 화면(Swagger·Scalar)이 필요해지면 저장본과 함께 둡니다
- **리소스·enum Schema는 `identifier`·`title`·`description`을 답니다.** `identifier`는 Schema 상수 이름과 같게 하고, OpenAPI `components`의 이름이 됩니다. `title`은 업무 용어이고, 테스트가 용어 표에서 그 이름을 키로 둔 행에 그 용어가 있는지 확인합니다. 행의 첫 키에 한해 첫 글자 소문자 필드 이름(`coverage` → `Coverage`)도 받습니다. 용어와 키가 `/`로 같은 수만큼 나뉜 행은 순서대로 짝짓고, `·`는 나누지 않습니다(`접수·내원`이 아니라 `내원 (접수)`로 썼습니다). 표 셀의 코드 안 `|`는 `\|`로 씁니다(GFM 표가 셀을 나누지 않게). 용어 표가 번역의 단일 출처라는 규칙을 문서에도 지키려는 것입니다. 용어 표에 없는 Schema는 `title` 없이 `description`만 답니다
- **필드 설명은 `description`으로 쓰고 JSDoc은 지웁니다.** 같은 설명을 두 곳에 두면 어긋나기 때문입니다. 헤더(`If-Match`, `ETag`)와 본문 필드도 같습니다. API를 쓰는 사람이 알 필요 없는 구현 메모(마이그레이션 번호, 앞으로 바꿀 계획, 현행 필드 이름)만 `//` 주석으로 남깁니다. 응답이 `null`일 수 있는 경우, 404·409가 나는 조건처럼 클라이언트가 알아야 할 사실은 설명에 둡니다. 편집기에서 필드 위에 마우스를 올려도 설명이 보이지 않는 것은 감수합니다
- **엔드포인트는 `OpenApi.Summary`, 그룹은 `OpenApi.Description`을 한글로 답니다.** 권한·라우터 사정 같은 구현 설명은 그룹의 JSDoc에 둡니다
- **Effect의 함정 다섯 가지:**
  - `refine`이나 직접 만든 검사(`Schema.makeFilter`)처럼 JSON Schema로 옮길 수 없는 검사가 있으면, 그 뒤에 단 설명이 문서에서 빠집니다. `Schema.String.annotate({ description }).pipe(Schema.refine(…))`, `Schema.Finite.annotate({ description }).check(…)`처럼 앞에 답니다. 같은 이유로 필드 자리에서 ID에 단 설명도 빠지므로, 필드별 설명이 필요하면 `//` 주석으로 둡니다
  - 이름(`identifier`) 있는 Schema를 필드 자리에서 다시 `annotate`하면 `Visit_1`처럼 사본 Schema가 생깁니다. 설명은 Schema 쪽에만 달고, 테스트가 사본이 없는지 확인합니다
  - `Schema.Number`는 문서에 `NaN`·`Infinity` 문자열을 함께 받는 `anyOf`로 나오고 설명과 범위가 빠집니다. 숫자 필드는 `Schema.Finite`(정수는 `Schema.Int`)로 씁니다
  - 변환 Schema(`NumberFromString` 등)는 문서에 인코딩 쪽(문자열)만 나와 뒤에 단 설명이 빠집니다. `Schema.String.annotate({ description }).pipe(Schema.decodeTo(…))`처럼 인코딩 쪽에 답니다
  - 설명이 있는 Schema(`Won`)에 검사를 더해 좁히면(`Won.check(…)`) 문서에 원래 설명이 위에 남고 새 설명은 `allOf` 안에 묻힙니다. 기본 Schema에 설명을 먼저 달고 검사를 다시 적습니다
- `identifier`를 달면 Schema 내부 오류 문구가 이름으로 바뀝니다(`Expected "A" | "B"` → `Expected VisitStatus`). `VALIDATION_FAILED` 응답은 오류 종류와 경로만 쓰므로 바뀌지 않고, 로그와 DB 행 디코딩 오류의 문구만 바뀝니다
- **문제 응답(`HttpApiError.Problem`)은 넷째 인자 `{ description }`에 한글 설명을 달고 JSDoc은 지웁니다.** 이 설명이 OpenAPI 응답의 `description`이 되어 영문 `title`을 대신합니다. 같은 상태 코드의 오류가 여럿이면 ` | `로 이어 붙습니다. 그래서 설명은 오류 코드로 시작하고(`` `ENCOUNTER_BILLED`: … ``), 문장은 짧게 두고, 무엇을 하면 풀리는지(먼저 `:void`, 고정을 풂)를 적습니다. 오류 필드(`currentStatus`, `missing` 등)의 뜻도 이 설명에 적습니다. 오류를 만든 이유 같은 구현 메모는 클래스 위 `//` 주석입니다
  - 문제 클래스가 아닌 Schema를 `error`에 넣으면 500 `application/json` 응답으로 문서에 섞입니다. 테스트가 오류 응답이 모두 `application/problem+json`이고 설명의 조각마다 오류 코드로 시작하는 한글인지 확인합니다
- **성공 응답도 설명을 답니다.** Effect는 성공 Schema의 `description`을 응답 설명으로 쓰고, 없으면 영문 `Success`·`<No Content>`를 씁니다. 목록·묶음처럼 이름 없는 성공 Schema와 `HttpApiSchema.NoContent`에 `annotate({ description })`을 답니다. 커서 목록은 `Page(item, description)`(`shared/http/paging.ts`)을 씁니다. 테스트가 성공 응답 설명이 한글인지 확인합니다
- **커맨드 경로:** 라우터는 커맨드 경로의 콜론을 `::`로 적습니다(`/visits/:id::cancel`). 문서에는 실제 경로(`/visits/{id}:cancel`)로 바꿔 씁니다
- 모듈 묶음별로 열었습니다(#55). 틀과 내원, 진료(진료·정정 제안·처방 라인·치료실), 수납·결제·시재, 환자·인증·공통과 문제 응답입니다. 이제 모든 엔드포인트에 요약이, 모든 그룹에 설명이 있고, 새 엔드포인트도 같이 답니다. API 전체 설명은 `Api`의 `OpenApi.Description`입니다. `Idempotency-Key` 헤더 설명은 공용 Schema(`IdempotencyKey`), 목록의 `limit`·`cursor`는 [paging.ts](../../src/shared/http/paging.ts)에 있습니다
- 응답 리소스가 저장 모델과 다르면(정정 제안의 `stale`) 응답 Schema(`AmendmentProposalView`)에 이름과 `title`을 달고, 용어 표 행에 그 키를 더합니다. 문서에 나오는 것은 응답이기 때문입니다

## 예시 규칙

문서의 예시 경로는 `/v1` 접두사를 생략합니다.
