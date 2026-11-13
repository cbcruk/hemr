# hemr

한의원 EMR 백엔드 API 서버입니다. 개요·명령·구조는 [README.md](README.md)에 있습니다.

## 읽을 문서

- **업무 규칙·상태 전이·오류 코드를 바꿀 때:** 그 도메인의 설계 문서(`docs/design/<도메인>.md`). 목록은 [docs/design/README.md](docs/design/README.md)
- **커맨드·애그리거트·이벤트·뷰·정책을 더하거나 트랜잭션 경계를 바꿀 때:** [domain-model.md](docs/design/domain-model.md)의 일관성 규칙과 묶은 경계
- **경로·필드·오류·멱등성·동시성, 코드의 용어(한글 식별자)를 정할 때:** [conventions.md](docs/design/conventions.md)
- **규칙 계산 모듈을 고칠 때:** 짝인 규칙 문서(`docs/reference/rules/<규칙>.md`)와 픽스처(`test/fixtures/rules/`)
- **이미 내린 결정과 되돌릴 조건:** [review.md](docs/design/review.md#결정-필요)의 결정 표

## 규약

- 커맨드의 판정은 애그리거트 파일(`*.aggregate.ts`)의 순수 함수 `decide…`가 하고, 다음 상태와 이벤트를 돌려줍니다. 서비스는 읽기 → 권한 → 판정 → 저장(상태와 이벤트를 한 트랜잭션)만 합니다. 판정 함수의 테스트는 저장소 없이 given/when/then으로 씁니다(`*.aggregate.test.ts`)
- 문서, 테스트 설명(`describe`·`it`), 이슈, PR, 리뷰는 한국어입니다. 식별자, HTTP 필드, 오류 코드, 이벤트 타입, 커밋 메시지는 영어입니다
- 동작을 바꾸면 같은 PR에서 그 도메인 문서를 고칩니다. HTTP 계약(`*.api.ts`)을 바꾸면 `pnpm openapi`로 `docs/reference/openapi.json`을 다시 만듭니다
- 작업은 접두사 붙은 브랜치(`feat/`, `fix/`, `refactor/`, `docs/`, `ci/`)에서 하고 `main`으로 PR을 엽니다. PR 본문은 바뀐 것, 하지 않은 것, 확인한 것이고 이슈가 있으면 `Closes #N`을 적습니다

## PR 리뷰

리뷰는 연결된 이슈가 요구한 것과 위 문서들을 기준으로 봅니다. 지적마다 **막음** 또는 **후속**을 붙입니다.

- **막음:** 버그, 데이터·돈 기록이 어긋날 수 있는 동시성 문제, 도메인 문서·conventions.md·domain-model.md와 어긋나는 코드, 동작을 바꾸고 도메인 문서나 `openapi.json`을 고치지 않은 것, 이슈가 요구했는데 빠진 것
- **후속:** 그 밖의 개선. 이 PR에서 고치지 않고 이슈로 남겨도 되는 것
