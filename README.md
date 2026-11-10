# hemr

한의원 EMR 백엔드 API 서버입니다. 현행 EMR 웹 클라이언트를 정적 분석해 업무와 규칙을 뽑고, 같은 업무를 서버가 책임지는 구조로 처음부터 다시 설계했습니다.

현행 구조는 규칙이 클라이언트에 있고, 수납처럼 여러 엔티티를 바꾸는 업무를 클라이언트가 여러 호출로 이어 붙입니다. 이 재설계에서는 서버가 규칙의 단일 출처가 되고, 업무 하나를 요청 하나·트랜잭션 하나로 처리합니다. 배경과 설계 원칙은 [`docs/design/README.md`](docs/design/README.md)에 있습니다.

## 구현한 것

하루 진료가 돌아가는 데 필요한 모듈부터 만들고 있습니다([결정 D7](docs/design/review.md#결정-필요)). 모든 경로는 `/v1` 아래에 있습니다.

| 영역 | 내용 | 설계 문서 |
|---|---|---|
| 인증 | 로그인·토큰 갱신·로그아웃·병원 전환, 내 정보와 권한 | [identity-access.md](docs/design/identity-access.md) |
| 환자 | 등록·조회·수정, 검색(이름·초성·차트번호·전화번호 뒷자리), 다음 차트번호, 주민등록번호 암호화와 사유를 남기는 원문 조회, 동의 기록과 이력 | [patients.md](docs/design/patients.md) |
| 내원 | 접수 검증, 진료 시작·대기로 되돌리기·수납으로 보내기, 수납 뒤 다시 열기, 취소 | [front-desk.md](docs/design/front-desk.md#내원-접수) |
| 진료 | 초안 저장·완료, 판(버전)과 정정·철회·고정·고정 풀기, 정정 제안과 반영·버림. 완료할 때 중복 진찰료·보험구분·첩약 시범사업 승인을 검사합니다 | [clinical.md](docs/design/clinical.md) |
| 치료실 | 시술 보드, 시술 더하기·지우기·순서 바꾸기, 시작·완료(한 건 또는 내원 전체), 서버가 판정하는 타이머 만료 | [clinical.md](docs/design/clinical.md#치료실) |
| 수납 | 견적·수납(내원이 수납완료가 됩니다)·취소·정정, 외부 승인 결제와 환불 | [front-desk.md](docs/design/front-desk.md#수납) |
| 시재 | 시재 개시·마감·다시 열기, 지출과 지출 분류 | [front-desk.md](docs/design/front-desk.md#시재와-지출) |

현행 클라이언트에서 옮긴 계산 규칙 중 위 엔드포인트가 아직 쓰지 않는 것은 규칙 함수와 테스트만 먼저 두었습니다. 진찰료·수가·추나·첩약 시범사업 청구 검사·예약 수용·참조데이터 버전·병원 설정 검증·원외탕전 사전 검사·CRM 야간 광고 제한 등입니다. 예약·청구·탕전·서식·CRM의 엔드포인트는 아직 없습니다. 남은 결정은 [`docs/design/review.md`](docs/design/review.md)에 있습니다.

API 문서는 [`docs/reference/openapi.json`](docs/reference/openapi.json)입니다. 설명은 한국어이고, 오류 응답마다 `code`와 뜻을 적었습니다.

## 시작하기

Node.js 22.13 이상(내장 `node:sqlite`를 씁니다)과 pnpm 12가 필요합니다. 데이터베이스 서버는 필요 없습니다.

```sh
pnpm install
pnpm dev        # http://localhost:3000/v1/health
```

`pnpm dev`는 로컬 개발 모드(`HEMR_DEV=1`)로 실행됩니다.

- 데이터는 SQLite 파일 `data/hemr.sqlite`에 저장하고, 시작할 때 마이그레이션을 적용합니다.
- 개발 병원 하나와 대표원장 계정(`owner` / `hemr-dev-password`)을 만듭니다. 이미 있으면 그대로 두므로, 비밀번호를 바꾸려면 DB 파일을 지우고 다시 시작합니다.
- 토큰 서명 키는 실행할 때마다 새로 만듭니다. 서버가 다시 시작하면(파일 저장으로 인한 재시작 포함) 받은 access token은 쓸 수 없고 다시 로그인하거나 갱신합니다.

```sh
TOKEN=$(curl -s localhost:3000/v1/auth/sessions -H 'content-type: application/json' \
  -d '{"loginId":"owner","password":"hemr-dev-password"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s localhost:3000/v1/patients -H "authorization: Bearer $TOKEN"
```

개발 계정은 소속 병원이 하나라 로그인 토큰이 바로 그 병원을 가리킵니다. 소속이 여럿이면 `POST /v1/auth/sessions:switch-tenant`로 병원을 고르기 전까지 병원 업무 API가 403 `TENANT_NOT_SELECTED`입니다. access token은 10분 동안 쓸 수 있습니다.

### 환경 변수

| 이름 | 뜻 | 개발 모드에서 없을 때 |
|---|---|---|
| `PORT` | 서버 포트. 기본값은 `3000`입니다 | |
| `DATABASE_FILE` | SQLite 파일 경로. 기본값은 `data/hemr.sqlite`이고, `:memory:`면 재시작할 때마다 비어 있습니다 | |
| `AUTH_SECRET` | 토큰 서명 키. 32자 이상입니다 | 실행마다 임의 키 |
| `PATIENT_DATA_KEY` | 주민등록번호 등을 암호화하는 키. base64로 32바이트 이상입니다 | 고정된 개발용 키 |
| `DEV_PASSWORD` | 개발 계정을 처음 만들 때의 비밀번호. 기본값은 `hemr-dev-password`입니다 | |

개발 모드가 아니면(`pnpm start`) `AUTH_SECRET`과 `PATIENT_DATA_KEY`가 없거나 형식이 틀릴 때 서버가 시작하지 않습니다.

### 명령

| 명령 | 하는 일 |
|---|---|
| `pnpm dev` | 개발 서버. 파일이 바뀌면 다시 시작합니다 |
| `pnpm build` / `pnpm start` | `dist/`로 빌드 / 빌드한 서버 실행 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm test` / `pnpm test:watch` | 테스트. 저장소 테스트는 메모리 구현과 인메모리 SQLite에 같은 케이스를 돌리고, 규칙 픽스처와 규칙 문서의 짝도 확인합니다 |
| `pnpm format` / `pnpm format:check` | Prettier로 정리 / 검사 |
| `pnpm openapi` | HTTP 계약에서 `docs/reference/openapi.json`을 다시 만듭니다. 테스트가 저장본과 비교합니다 |

## 구조

| 경로 | 내용 |
|---|---|
| `src/api.ts` | 모듈마다 있는 `*.api.ts`를 모은 HTTP 계약입니다. 엔드포인트마다 필요한 권한을 선언하고, 빠뜨리면 서버가 뜨지 않습니다 |
| `src/modules/` | 모듈러 모놀리스의 모듈입니다. 바운디드 컨텍스트 하나에 폴더 하나입니다 |
| `src/shared/` | 모듈이 함께 쓰는 것입니다. 접두사 ID, 문제 응답, 멱등성·`ETag`·페이지네이션, 트랜잭션과 마이그레이션, 이벤트 outbox와 릴레이, 진료일·달력, 금액, 개인정보 열람 기록 |
| `docs/design/` | 도메인 설계입니다. [README](docs/design/README.md)부터 읽습니다. 코드 규약은 [conventions.md](docs/design/conventions.md)입니다 |
| `docs/reference/` | 분석의 근거입니다. 기능 명세, 현행 엔드포인트 목록, 권한 코드, 화면 대응 |
| `docs/reference/rules/` | 현행 클라이언트 코드를 실행해 뽑은 업무 규칙입니다. [목록](docs/reference/rules/README.md) |
| `test/fixtures/rules/` | 규칙별 입력·출력 케이스입니다. 서버 테스트가 그대로 씁니다 |

## 기술

- TypeScript(strict)와 [Effect](https://effect.website) 4를 씁니다. HTTP 계약은 `effect/http-api`로 쓰고 OpenAPI 문서도 거기서 만듭니다.
- 저장소는 SQLite(`@effect/sql-sqlite-node`)입니다([결정 D9](docs/design/review.md#결정-필요)). 상태 변경과 이벤트를 한 트랜잭션에 쓰고(outbox), 프로세스 안의 릴레이가 이벤트를 발행합니다.
- 오류는 RFC 9457 Problem Details(`application/problem+json`)이고 `code`로 가립니다. 요청 검증은 모든 위반을 모아 400 `VALIDATION_FAILED`로 돌려줍니다.
- 돈이 오가는 커맨드(수납·정정·결제·환불·지출)는 다시 보내도 한 번만 처리하도록 `Idempotency-Key`를 받습니다. 환자·내원·진료를 바꾸는 요청은 남의 변경을 덮어쓰지 않도록 `If-Match`(낙관적 잠금)를 받습니다. 목록은 커서로 넘깁니다. 자세한 규칙은 [conventions.md](docs/design/conventions.md)에 있습니다.

## 근거에 대해

현행 동작은 클라이언트 코드를 정적 분석해서만 확인했습니다. 원본 서버는 호출하지 않았고, 픽스처의 환자·가격 값은 모두 만든 값입니다. 분석한 제품과 연동 업체의 이름은 적지 않고 일반 이름으로 바꿨습니다([이름 규칙](docs/reference/rules/README.md)). 문서의 `restored/...` 경로는 분석할 때 쓴 복원 트리의 위치이고, 그 트리는 이 저장소에 없습니다. 판단에 필요한 원본 코드는 각 규칙 문서에 발췌해 두었습니다.
