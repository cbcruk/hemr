# 접근 제어 구조

화면과 기능이 누구에게 보이는지 정하는 규칙을 `restored/` 코드에서 읽어 정리한 문서입니다. 권한 코드별 사용처와 라우트별 meta 표는 생성 문서인 [permissions.md](permissions.md)에 있습니다.

> 파일 경로는 현재 복원 결과 기준입니다. `part-N` 이름은 `pnpm restore`를 다시 돌리면 바뀔 수 있으니, 함수 이름이나 문자열로 찾으면 됩니다.

접근은 다섯 층으로 걸러집니다. 위에서부터 순서대로 적용됩니다.

| 층 | 무엇으로 | 어디서 검사 |
|---|---|---|
| 1. 빌드 환경 | 빌드 시 고정된 환경 이름 (`production`) | 라우트 등록 시점 |
| 2. 인증 | 로그인 토큰 | 라우터 가드 |
| 3. 서비스 연동 | 계정의 `서비스연동` 목록과 차트 레이아웃 | 라우터 가드, 사이드바 메뉴 |
| 4. 역할 | `역할타입` (대표원장, 실장, …) | 라우터 가드, 사이드바 메뉴, MEMBERS 권한 |
| 5. 행위 권한 | 서버가 내려주는 권한 트리 (`권한코드` × `행위코드`) | 화면 컨테이너, 사이드바, 개별 버튼 |

라우터 가드는 `re-upstream/restored/router/guards.js`의 `beforeEach` 하나입니다. **가드는 5층(행위 권한)을 검사하지 않습니다.** `meta.permissionCode`는 화면 컨테이너가 직접 확인합니다.

## 1. 빌드 환경

- `yx("production")`처럼 환경 이름이 빌드 때 문자열로 박혀 있습니다 (`re-upstream/restored/api/soo-subscription/query-keys.js`)
  - `Yu()` = dev, `Un()` = prd, `QO()` = stg
  - 이 번들에서는 `Un()`만 참입니다
- `Yu()`로 감싼 라우트는 dev 빌드에만 등록되고, 이 번들에서는 등록되지 않습니다
  - `/crm/routines`, `/crm/routines/new`, `/crm/routines/:routineId`, `/crm/reminder`
- `Yu() || Un()`인 MCP 설정(`/setting/mcp-tokens`, `/setting/mcp-pending-contacts`)은 prd에도 등록됩니다
  - 다만 `requiresDemoAccountInPrd`가 붙어 있어, prd에서는 하드코딩된 데모 요양기관기호 계정만 들어갈 수 있습니다. 다른 계정은 `not-found`로 이동합니다

## 2. 인증

- 로그인 정보는 localStorage `사용자로그인정보`에 있습니다. `accessToken`이 있으면 로그인 상태로 봅니다
- `meta.requiresAuth`가 있는 라우트에 토큰 없이 들어가면 로그인 화면으로 보냅니다
  - 원래 가려던 경로는 `?redirect=`에 담습니다
  - 마지막 로그인 타입(`마지막로그인타입`)이 `soo`면 `soo-login`, 아니면 `auth-login`으로 갑니다
- 로그인한 상태로 로그인 화면에 오면 계정의 홈으로 보냅니다 (아래 홈 결정 참고)

## 3. 서비스 연동

로그인 응답의 `서비스연동` 배열이 제품 구성을 정합니다. `re-upstream/restored/components/app/App.vue`가 로그인 정보를 읽어 `XH(서비스연동, 원탕계약정보, { chartLayout, 요양기관기호 })`로 전역 상태에 넣습니다 (`re-upstream/restored/modules/index/part-39.js`).

| 값 | 의미 | 플래그 (`re-upstream/restored/lib/index/enabled.js`) |
|---|---|---|
| `emr` | EMR (데스크·진료·청구) | `nue` |
| `soo` | 수 (비급여·CRM 계열) | `enabled$` |
| `insurance` | 보험 조회 | `rue` |
| `crm` | CRM | `THe` |
| `members` | MEMBERS 지표관리 | `_h` |

**차트 레이아웃** `full` / `light` (`OL`):
- 우선순위는 localStorage `수ProV2차트레이아웃override` > 서버 `chartLayout` > 기본값 `full`입니다
- `a0`(풀 차트 여부)가 EMR 전용 화면을 여는 주 조건입니다. MEMBERS 계정이고 지정값이 없으면 `emr` 연동 여부로 정합니다

**홈 결정** (`kL`, `re-upstream/restored/lib/index/part-38.js`):
- `chartLayout`이 있으면 `light`는 `crm-nonbenefit-patients`, `full`은 `desk`
- 없으면 연동 목록으로 정합니다: `emr` → `desk`, `soo` → `crm-nonbenefit-patients`, `insurance` → `insurance-inquiry`, `members` → `members`, 그 밖은 `desk`

**가드 규칙:**
- 홈이 `desk`가 아닌 계정(EMR이 아닌 구성)이 EMR 전용 라우트에 들어가면 계정의 홈으로 보냅니다
  - 대상: `home`, `desk`, `treatment-rooms`, `tablet-treatment-rooms`, `ocs`, `claim-hira`, `claim-hira-submit-items`, `claim-medical-aids`, `claim-year-settlement`, `electronic-signature`
- `members` 라우트는 `members` 연동이 있어야 열립니다
- `setting-telemedicine`, `remote-settlement`는 localStorage `비대면진료등록여부`가 참이어야 열립니다
- `challenge`는 수련(surachal) 코호트 API(`/api/surachal/cohort`, `/me`)가 접근을 허용해야 열립니다

**사이드바 메뉴 규칙** (`re-upstream/restored/lib/index/part-41.js`의 `R6`·`VHe`, 적용은 `re-upstream/restored/modules/index/part-74.js`):
| 대상 | 보이는 조건 |
|---|---|
| `/analytics/revenue`·`appointment`·`patient`·`incoming-path`·`doctor`, `/setting/treatment` | 풀 차트 (`a0`) |
| `/remote-settlement`, `/setting/telemedicine` | `soo` + 비대면진료 등록 |
| `/crm/soo-scheduler` | lite trigger 기능 활성 + (`soo` 또는 원탕 계약만 있는 계정) |
| `/analytics/soo-dashboard` | `soo` 또는 원탕 계약만 있는 계정 (`kHe`: 원탕 계약 있음 + `soo`·`emr`·`insurance` 없음) |
| `/members/*` | `members` |
| 메뉴 id 10·30·50·80·90 | 풀 차트 |
| 메뉴 id 75 | `insurance` |
| 메뉴 id 70 | 보험 단독이거나 `members` 계정이면 숨김 |
| 메뉴 id 76 | `members` |

**요양기관 단위 규칙:**
- 탕전 처방(`/ocs/prescription/list`·`create`)과 탕전관리(`/ocs`)는 서로 배타적입니다
  - 하드코딩된 요양기관기호 4개 목록(`epe`, `re-upstream/restored/lib/index/part-63.js`)에 든 기관은 탕전 처방 화면으로 가고, 나머지는 `/ocs`로 갑니다
- 태블릿 설정, 서류 관리 설정은 `emr` + 풀 차트일 때만 열립니다 (`Sct`)

## 4. 역할

`역할타입` 코드는 `re-upstream/restored/modules/index/requiredRoleType.js`의 `Qfe`에 정의돼 있습니다.

| 코드 | 역할 |
|---|---|
| `01`, `02` | 대표원장 |
| `03` | 부원장 |
| `04` | 실장 |
| `05` | 데스크 |
| `06` | 치료실 |

- 라우트 `meta.requiredRoleType`이 있으면 역할이 같아야 합니다. 다르면 홈으로 보냅니다
  - 현재 `01`이 요구되는 라우트: `/remote-settlement`, `/analytics/soo-dashboard`, MCP 설정 2개
- 사이드바 메뉴 항목도 `requiredRoleType`으로 걸러집니다
- **MEMBERS 권한 트리** (`re-upstream/restored/modules/index/part-65.js`의 `Af`):
  - `루트`(`members`) 아래에 `매출`(`members_sales`), `환자수`, `예약`, `유입경로`, `비급여`, `기간별데이터` 등 노드가 있습니다
  - `/members/revenue` 같은 하위 경로마다 필요한 노드가 정해져 있습니다 (`VA`, `re-upstream/restored/modules/index/part-72.js`)
  - `jA`는 노드에서 부모 쪽으로 올라가며 모든 노드의 권한을 확인합니다
  - `초진환자해피콜`은 권한 대신 역할 `01`로만 판단합니다
  - `/members`로 바로 들어가면 허용된 첫 하위 메뉴로 보냅니다

## 5. 행위 권한

**데이터** (`re-upstream/restored/modules/index/part-59.js`):
- 서버가 `{ 권한코드, 행위코드, 허용여부, 적용된권한규칙코드, children }` 트리를 내려줍니다
- `fct`가 이를 `권한코드 → { …, 부모권한코드 }` 맵으로 펼쳐 저장하고, 로드 완료 플래그를 켭니다

**검사:**
- `O1(행위)(권한코드)` 형태의 함수가 검사합니다. 항목이 있어야 하고, 행위코드가 같아야 하고, 자신이 허용돼야 하고, 부모가 있으면 부모도 허용돼야 합니다
- 결과는 코드별로 캐시됩니다. 권한이 아직 로드되지 않았으면 경고를 남기고 `false`를 돌려줍니다
- 행위별 함수 (`re-upstream/restored/lib/index/canAccess.js`): `canAccess$`, `canCreate$`, `canUpdate$`, `canDelete$`, `canWrite$`
- `Brn(timeout = 5000)`은 권한 로드가 끝날 때까지 기다립니다

**권한 코드:**
- 대부분 PermissionCode (`re-upstream/restored/modules/index/requiredRoleType.js`) enum(65개)에 있습니다. 예: `chart_create`, `waiting_update`, `finance_budget`
- `record_digital_signature`, `copayment_digital_signature`, `digital_signature`는 enum 밖에서 문자열로 직접 검사합니다

**적용 위치:**
- **화면 컨테이너:** `CrmView`, `OcsView`, `FinanceView`, `ClaimView` 등
  - 공용 composable `l0e`(`re-upstream/restored/lib/index/part-196.js`)가 `{ isPermissionPending, hasPageAccess }`를 돌려줍니다
  - 현재 경로와 정확히 일치하는 라우트의 `meta.permissionCode`를, `meta.permissionRequired`가 있을 때만 `canAccess$`로 확인합니다
  - `SettingView`, `AnalyticsView`는 같은 규칙을 직접 구현합니다. `SettingView`에는 태블릿·서류관리·지출수집 예외가 있습니다
  - 실패하면 `AccessDeniedNotice` / `RouteAccessDenied`를 보여줍니다
  - `permissionRequired` 없이 `permissionCode`만 있으면 막히지 않는 구조입니다. 현재 번들에는 그런 라우트가 없습니다. 생기면 [permissions.md](permissions.md) 라우트 표에 "(검사 안 함)"으로 표시됩니다
- **사이드바:** 메뉴 항목의 `permissionCode` / `requiredPermission`으로 거릅니다
- **개별 기능:** 예약·접수·수납·환자 생성/수정/삭제 버튼과 컨텍스트 메뉴가 `canCreate$` / `canUpdate$` / `canDelete$`로 막힙니다
  - 가장 많이 쓰이는 코드: `waiting_create` 13곳, `appointment_create` 12곳, `waiting_update` 11곳

**정적으로 참조가 없는 코드:** `receipt_update`, `receipt_delete`, 재무 작성·삭제·결재 계열 등 14개입니다. 재무 쪽은 federation 원격 재무 앱 안에서 검사할 가능성이 큽니다. 목록은 `pnpm permissions` 출력과 [permissions.md](permissions.md)에 있습니다.

## 확인된 빈틈

- **이름 불일치:** EMR 전용 가드 목록(`WQt`)의 `claim-year-settlement`는 실제 라우트 이름 `year-settlement`와 다릅니다. 연말정산은 EMR 전용 리다이렉트를 받지 않습니다
- **권한 검사 누락:** `crm-nonbenefit-patients`에는 `meta`가 없습니다. `l0e`는 현재 경로와 정확히 일치하는 라우트만 보므로, 이 화면은 행위 권한 검사를 받지 않습니다
- **사이드바 필터 없음:** 사이드바는 설정 하위 메뉴를 권한으로 거르지 않습니다. 메뉴에 붙은 코드도 enum과 다릅니다 (`normal_settings` vs `normal_setting`)
- **인증 없는 라우트:** `/treatment/repeat-results`, `/canvas`에는 `requiresAuth`가 없습니다
