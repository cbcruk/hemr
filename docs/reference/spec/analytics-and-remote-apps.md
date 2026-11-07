# 경영지표·재무·원격 앱

경영지표(`/analytics/*`), 재무(`/finance/*`), MEMBERS(`/members/*`), 자료·공지 포털(`/portal`, `/library`), 챌린지(`/challenge`)는 화면 본문을 대부분 **Module Federation 원격 앱**에 맡깁니다. 호스트는 권한 검사, 원격 로드·재시도, 토큰 동기화, 스타일 주입, 라우트 ↔ 원격 상태 동기화만 합니다.
원격 앱 자체 코드는 이 번들에 **없습니다**. 아래 내용은 호스트 쪽 계약(넘기는 값, 기대하는 export 형태)만 다룹니다.

## 원격 앱 연동 구조

### 런타임

- federation 런타임은 `restored/vendor/_virtual___federation__/_virtual___federation__-0.js`에 있습니다. 재노출은 `restored/_chunks/_virtual___federation__.js`가 합니다. 이름 규칙을 보면 Vite federation 플러그인 산출물로 보입니다 (추정)
- 원격 4개를 모두 `format: "esm"`, `from: "vite"`로 등록합니다
- `y(remote, "./Module")`의 동작:
  1. 처음 쓰일 때 remoteEntry를 `import()`합니다
  2. 공유 스코프로 `init`을 부릅니다
  3. `get(module)` 팩토리를 실행해 모듈을 돌려줍니다
- `b`/`h`는 ESM default를 풀거나 감싸는 헬퍼입니다
- **공유 모듈** (호스트가 제공):

  | 패키지 | 버전 | 청크 |
  |---|---|---|
  | `vue` | 3.5.35 | __federation_shared_vue (`restored/_chunks/__federation_shared_vue.js`) (Vue 런타임 export 전체 재노출) |
  | `react` | 19.1.0 | __federation_shared_react (`restored/_chunks/__federation_shared_react.js`) |
  | `react-dom` | 19.1.0 | __federation_shared_react-dom (`restored/_chunks/__federation_shared_react-dom.js`) |

  - `globalThis.__federation_shared__`가 있으면 그 값과 합칩니다

### 원격 목록

| remote 이름 | remoteEntry 호스트 | 노출 모듈 (호스트가 요청하는 것) | 사용하는 라우트 |
|---|---|---|---|
| `emr-bi-frontend` | `bi.example.com` | `./RevenueTableContainer`, `./AppointmentTableContainer`, `./PatientTableContainer`, `./IncomingPathTableContainer`, `./DoctorTableContainer`, `./LiteDashboardContainer`, `./LiteRisingContainer`, `./RevenueContainer` | `/analytics/revenue`·`appointment`·`patient`·`incoming-path`·`doctor`·`lite-dashboard`, `/challenge`(과제 제출·리더보드 탭), `/members/funnel` 안 유입경로 임베드 (추정, 아래 MEMBERS 참고) |
| `emr-finance-frontend` | `finance-prd.example.com` | `./financeMount` | `/finance/*`, 설정 지출수집(`SettingExpenseCollectionView`, `initialPath: "/expense-collection"`) |
| `emr-portal` | `portal.example.com` (URL을 함수로 만들어 매번 `?t=Date.now()`를 붙임) | `./litePortalMount` | `/portal`, `/library`, `/challenge`(교육자료 탭) |
| `members-app` | `members.example.com/assets` | `./mount` | `/members/*` |

- `./RevenueContainer`는 두 `BiContainer`의 맵에 들어 있습니다. 하지만 이를 `component-module`로 넘기는 화면은 호스트에 없습니다
- 라우트의 `component-module` 문자열(예: `emr-portal/LitePortalContainer`)과 실제로 로드하는 모듈이 다른 경우가 있습니다. 포털이 그렇습니다 (아래 참고)

### 마운트 방식 (원격별 계약)

| 컨테이너 | 원격 export 형태 | 호스트가 하는 일 |
|---|---|---|
| BiContainer (`restored/components/bi/BiContainer.vue.js`) / BiContainer-2 (`restored/components/bi/BiContainer-2.vue.js`) | **React 컴포넌트** (함수) | 호스트가 번들한 `react-dom`의 `createRoot(div)`로 루트를 만들고 `createElement(Component, props)`를 렌더합니다. props가 바뀌면 같은 루트에 다시 `render` |
| FinanceContainer (`restored/components/finance/FinanceContainer.vue.js`) | `mount(el, { token, initialPath })` → `{ update, unmount }` (`default.mount` 또는 `mount`) | 토큰이 바뀌면 `update`, `initialPath`가 바뀌면 다시 마운트 |
| PortalContainer (`restored/components/portal/PortalContainer.vue.js`) | `mount(el, props)` → `{ update, unmount }` | 라우트 쿼리나 슬롯이 바뀌면 `update(props)` |
| MembersView (`restored/views/MembersView.vue.js`) | `default(el, options)` → `{ navigate, unmount }` | 라우트 `pathMatch`가 바뀌면 `navigate(path)` |

**BI 모듈 로드 시점:**
- `BiContainer` 두 파일은 모듈 최상위에서 `await y(...)`로 노출 모듈 6개를 미리 받습니다
- 그래서 컨테이너 청크를 import하는 순간 BI remoteEntry와 모듈 전부를 불러옵니다
- 실패하면 해당 라우트 컴포넌트의 lazy import 자체가 실패할 것으로 보입니다 (추정)

**`BiContainer` 두 변형 비교:**

| | `BiContainer.vue.js` | `BiContainer-2.vue.js` |
|---|---|---|
| props | `componentModule`, `rootElementId`(기본 `bi-root`), `overrideToken`, `remoteProps` | `componentModule`, `rootElementId`, `componentProps` |
| 렌더 props | `{ ...remoteProps, token }` (토큰이 우선) | `{ token, ...componentProps }` |
| props 변경 반영 | `remoteProps`를 deep watch해 다시 렌더 | watch 없음 (마운트 시점 값만) |
| 모듈 맵 | Patient/Appointment/RevenueTable/Revenue/**LiteDashboard/LiteRising** | Patient/Appointment/RevenueTable/Revenue/**IncomingPathTable/DoctorTable** |
| 사용처 | `LiteDashboardView`, `ChallengeView` | `RevenueTableView`, `AppointmentTableView`, `PatientTableView`, `IncomingPathTableView`, `DoctorTableView` |

- `overrideToken`을 넘기는 호스트 코드는 없습니다

### 인증 토큰 동기화

useModuleFederationTokenSync (`restored/modules/useModuleFederationTokenSync/part-1.js`) `L(onChange)`를 씁니다.

- **토큰 출처:** localStorage `userAuthData`(`bt.사용자로그인정보`)의 JSON입니다. 원격에는 `accessToken`만 넘깁니다
- **유효성:** `accessToken`이 있어야 합니다. `exp`(초 단위)가 있으면 현재 시각보다 뒤여야 합니다
- **변경 감지:**
  - `patchLocalStorageNotifier`가 `localStorage.setItem`·`removeItem`을 감쌉니다. 같은 탭 안의 변경은 `ls:change` CustomEvent로 알립니다. 감싸기는 참조 카운트로 관리합니다 (`restored/modules/useModuleFederationTokenSync/patchLocalStorageNotifier.js`)
  - 그 밖에 `storage` 이벤트, `focus`, `visibilitychange`를 받습니다
  - BI·포털은 1초 간격 폴링도 합니다. 재무는 폴링하지 않습니다
- **토큰이 무효일 때:**
  1. sessionStorage `remoteEntryReloadCount`를 1 올리고 `location.reload()` 합니다
  2. 3회째면 키를 지우고 `/login`으로 보냅니다
  - 성공했을 때 이 카운터를 지우는 코드는 보이지 않습니다
- MEMBERS만 다른 방식을 씁니다. 토큰을 값이 아닌 `getAccessToken({ forceRefresh })` 콜백으로 넘깁니다

### 재시도와 캐시 무효화

**BI** (`Qs`, `restored/vendor/react/useBiStyles-2.js`) / **포털** (`Se`, `restored/lib/PortalContainer/getBaseUrl.js`):
- `ensureRemoteEntryLoaded`: `<script type="module" src=remoteEntry?t=…>`를 넣습니다. 전역 federation 객체가 생길 때까지 100ms 간격으로 최대 50번 확인합니다
- `invalidateModuleFederationCache`가 지우는 것:
  - `__webpack_require__.cache`
  - `__federation__.moduleCache`·`sharedCache`
  - `window[remote]`
  - remoteEntry `<script>`
  - Cache Storage 항목
  - 지운 뒤 다시 로드합니다
- 오류 화면 문구: "데이터를 불러올 수 없습니다", 버튼 "다시 시도"

**포털 전용:** 모듈 로드에 실패하면 sessionStorage `portalModuleReloaded`를 세우고 한 번만 새로고침합니다. 그래도 실패하면 오류 화면을 보여줍니다.

**재무** (`restored/components/finance/FinanceContainer.helpers.js` `z`):
- 재시도(`loadFinanceMount(true)`)에서는 federation 런타임을 거치지 않습니다
  - `remoteEntry.js?t=…`를 직접 `import`합니다
  - `init({})`(빈 공유 스코프)으로 초기화하고 `./financeMount`를 받습니다
- base URL이 `localhost`/`127.0.0.1`이면 react-router HMR preamble을 먼저 주입합니다. 개발용입니다
- 오류 문구: "재무 화면을 불러올 수 없습니다"

### 스타일 주입

`restored/composables/useRemoteStyles.js` `T({ styleAttribute, getBaseUrl, hrefPolicy })`를 씁니다.

- `<link rel=stylesheet>`를 `<head>`에 넣습니다. 참조 카운트로 관리합니다
- 기본 정책은 `${base}/style.css` 한 개입니다
- `ensure(true)`를 부르면 기존 링크를 지우고 `?t=` 캐시 버스터를 붙여 다시 넣습니다
- 링크 로드에 실패하면 500ms, 1000ms 백오프로 최대 2번 재시도합니다
- `cleanup`은 카운트가 0이 되면 다음 tick에 자기 속성이 붙은 링크와 자기 href 링크를 제거합니다

| 원격 | 속성 | 정책 |
|---|---|---|
| BI | `data-bi-styles` | 기본 (`style.css`) |
| 포털 | `data-portal-styles` | 기본 |
| MEMBERS | `data-members-styles` | 원격이 스스로 넣은 `${base}/…` 링크를 정리할 때 `rememberHrefs`로 기억해 뒀다가 다음 `ensure`에서 다시 넣습니다 (`restored/api/MembersView/client.js`) |
| 재무 | — | 호스트가 스타일을 주입하지 않습니다 |

- KeepAlive 비활성화(`onDeactivated`) 때 스타일을 정리하고, 재활성화 때 다시 넣습니다 (BI·포털·MEMBERS)

## 경영지표 — `/analytics`, `/analytics/revenue`, `/analytics/appointment`, `/analytics/patient`, `/analytics/lite-dashboard`, `/analytics/incoming-path`, `/analytics/doctor`

- **목적:** 매출·예약·환자·라이트 대시보드·유입경로·진료의별 현황 BI 화면입니다. 사이드바 메뉴 id 70 "경영지표 관리"에 있습니다
- **접근 조건:**
  - **권한:** AnalyticsView (`restored/views/AnalyticsView.vue.js`)가 권한 로드(`DB()`)를 기다립니다. 그다음 `route.matched` 중 `permissionRequired`가 있는 모든 라우트의 `permissionCode`를 `canAccess$`로 확인합니다
    - `/analytics`와 하위 5개는 `경영지표`(`bi`)를 요구합니다
    - 실패하면 `AccessDeniedNotice` "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."를 보여줍니다
  - **`/analytics/lite-dashboard`:** 자기 `permissionCode`는 없지만 부모 `analytics`가 매칭되므로 `bi`도 필요합니다. 라우터 가드는 `meta.requiredRoleType` `01`(대표원장)이 아니면 홈으로 보냅니다
  - **사이드바 노출** (`restored/lib/index/part-41.js` `R6`):
    - revenue·appointment·patient·incoming-path·doctor는 풀 차트(`a0`)일 때만 보입니다
    - lite-dashboard는 `lite` 연동이거나 원탕 계약만 있는 계정(`kHe`)일 때 보이고, 역할 `01`도 필요합니다
    - 메뉴 id 70은 보험 단독 또는 `members` 계정에서 숨겨집니다
  - 자세한 규칙: [access-control.md](../access-control.md)
- **화면 구성 / 원격 모듈:**
  - `AnalyticsView`는 `<RouterView>`를 `KeepAlive max=3`으로 감쌉니다
  - 각 하위 뷰는 `BiContainer`에 `component-module`만 넘기는 얇은 래퍼입니다

  | 경로 | 뷰 | `component-module` | 컨테이너 |
  |---|---|---|---|
  | `revenue` | `RevenueTableView` | `emr-bi-frontend/RevenueTableContainer` | BiContainer-2 |
  | `appointment` | `AppointmentTableView` | `emr-bi-frontend/AppointmentTableContainer` | BiContainer-2 |
  | `patient` | `PatientTableView` | `emr-bi-frontend/PatientTableContainer` | BiContainer-2 |
  | `incoming-path` | `IncomingPathTableView` | `emr-bi-frontend/IncomingPathTableContainer` | BiContainer-2 |
  | `doctor` | `DoctorTableView` | `emr-bi-frontend/DoctorTableContainer` | BiContainer-2 |
  | `lite-dashboard` | `LiteDashboardView` | `emr-bi-frontend/LiteDashboardContainer` | BiContainer |

  - `/analytics` 자체에는 redirect가 없습니다. 하위 경로 없이 들어오면 빈 `RouterView`가 됩니다 (추정)
- **호스트가 넘기는 값:**
  - 모든 화면: `token`(accessToken)
  - `IncomingPathTableView`는 `componentProps`를 더 넘깁니다:
    - `onOpenPatientDetail(arg)` → 호스트 환자 상세 사이드패널(`openSidePanel환자상세`)
    - `onOpenMessageSend(arg)` → 문자 발송 사이드패널(`openSidePanel문자발송`)
    - `extraTabs`, `onExtraTabSelect`: 뷰가 prop으로 받았을 때만 넘깁니다 (MEMBERS 임베드 경로)
    - `arg`의 형태는 원격이 정합니다 (미확인)
- **데이터:**
  - BI 데이터 호출은 원격 안에 있어 이 번들에서는 보이지 않습니다
  - `/analytics/incoming-path`만 호스트 쪽 코드가 있습니다. `SidePanelDeskActionsPatientInfoDetail`(`additional.actionButtons: true`)과 `SidePanelDeskActionsMessageSend`를 함께 렌더합니다
  - [architecture.md](../architecture.md)에서 이 라우트의 엔드포인트 수가 많게 잡히는 것은 이 두 사이드패널(환자 상세·접수·문자 발송 등)의 의존성 때문입니다. 유입경로 데이터 자체는 원격 쪽입니다
- **근거:**
  - `restored/router/routes.js`, `restored/views/AnalyticsView.vue`, `restored/components/bi/BiContainer.vue`, `restored/components/bi/BiContainer-2.vue`
  - `restored/views/IncomingPathTableView.vue.js`, `restored/views/LiteDashboardView.vue.js`
  - `restored/modules/index/Group.js` (메뉴), `restored/router/guards.js`

## 재무 — `/finance`, `/finance/daily-briefing`, `/finance/expenses`, `/finance/pnl`, `/finance/budget`, `/finance/cashflow`

- **목적:** 일간 브리핑·지출내역·손익분석·예산·현금흐름 화면입니다. 메뉴 id 72 "재무"에 있습니다
- **접근 조건:**
  - `/finance`는 `finance-daily-briefing`으로 redirect합니다
  - FinanceView (`restored/views/FinanceView.vue.js`)가 권한 로드를 기다린 뒤 경로별 요구 권한(`Frn`, `restored/modules/index/part-60.js`)을 `vct`로 검사합니다. 코드 중 하나라도 허용되면 통과입니다:

    | 경로 | 요구 코드 (`access`) |
    |---|---|
    | `daily-briefing` | `finance_sales` · `finance_expense` · `finance_pnl` 중 하나 |
    | `expenses` | `finance_expense` |
    | `pnl` | `finance_pnl` |
    | `budget` | `finance_budget` |
    | `cashflow` | `finance_cashflow` |

  - `Frn`에 없는 경로(예: 끝에 `/`가 붙은 경로)는 거부됩니다 (추정)
  - 사이드바에서는 부모 메뉴가 `permissionCode: finance`, 하위 메뉴가 `requiredPermission`(위와 같은 `nc` 항목)으로 걸러집니다
  - 지출수집(`nc.지출내역수집`, `finance_expense_collect`, `write`)은 설정 화면에서 씁니다
  - `*_write`·`*_delete`·`finance_approval*` 등 나머지 재무 코드는 호스트가 검사하지 않습니다 ([permissions.md](../permissions.md)). 원격이나 서버가 처리할 것으로 보입니다 (추정)
- **화면 구성 / 원격 모듈:**
  - 각 하위 뷰(`DailyBriefingView` 등)는 `FinanceContainer`에 `initial-path`(`/daily-briefing`, `/expenses`, `/pnl`, `/budget`, `/cashflow`)만 넘깁니다
  - 원격 `emr-finance-frontend/./financeMount`가 그 경로로 자체 라우팅합니다 (추정. react-router HMR 흔적이 있음)
  - `FinanceView`는 KeepAlive를 쓰지 않습니다
- **호스트가 넘기는 값:**
  - `mount(el, { token, initialPath })` 후 `update({ token, initialPath })`
  - 루트 div는 `overflow-y-auto`입니다
- **데이터:** 호스트 쪽 재무 엔드포인트는 없습니다
- **근거:** `restored/views/FinanceView.vue`, `restored/components/finance/FinanceContainer.vue`, `restored/components/finance/FinanceContainer.helpers.js`, `restored/views/DailyBriefingView.vue.js`, `restored/views/SettingExpenseCollectionView.vue.js`, `restored/lib/index/part-61.js`

## MEMBERS — `/members/:pathMatch(.*)*`

- **목적:** MEMBERS 지표관리입니다. 매출·환자 수·예약·유입경로·비급여·기간별 데이터·지표 입력·회고를 다룹니다. 메뉴 id 76의 하위 메뉴는 `/members/revenue`, `patient-count`, `appointment-count`, `funnel`, `nonbene-pay-repay`, `reports`, `review`, 그리고 `/analytics/lite-dashboard`입니다
- **접근 조건:**
  - **라우터 가드:**
    - 서비스 연동에 `members`가 없으면 홈으로 보냅니다
    - `/members`로 바로 들어오면 MEMBERS 권한 트리에서 허용된 첫 하위 경로(`hut`)로 보냅니다
    - 경로별 권한 노드 검사(`put`)를 통과해야 합니다
    - 상세 트리(`Af`, `VA`, `jA`): [access-control.md](../access-control.md)
  - **사이드바:** 메뉴 id 76은 `members` 연동일 때만 보입니다
  - **화면 진입 시 연동 확인** (`Ee`): `GET` accountClient(auth-api) `/integrations/members/subscribers`를 부릅니다
    - 구독자 선택 순서:
      1. 로그인 정보의 `sub`가 같은 항목
      2. 없고 역할이 `01`·`02`가 아니면, 역할 `01`이면서 `groupNm === "CLIENT"`인 항목
    - 결과별 상태:

      | 조건 | 상태 |
      |---|---|
      | 선택한 항목의 `groupNm`이 `CLIENT`가 아님 | `unsupported` ("관리자(ADMIN) 계정은 아직 현행 임베드를 지원하지 않습니다.") |
      | 항목 없음, 또는 404(본문 `message`가 `Route `로 시작하는 경우 제외) | `unlinked` |
      | 그 밖의 오류 | `error` |

    - 결과는 모듈 변수에 캐시합니다. "다시 시도"를 누르면 캐시를 비웁니다
  - **`unlinked` 화면:** "멤버스 연동이 필요합니다"
    - 역할 `01`이면 "멤버스 연동하기" 버튼으로 `members-onboarding`에 갑니다
    - 아니면 대표원장에게 요청하라는 안내만 보여줍니다
  - **`/members/review*`:** `retrospective` · `metricForm` · `happyCall` 중 하나라도 있어야 합니다. 없으면 `/`로 보냅니다
    - 마운트된 뒤 이 경로에서는 `MembersRetroTermsGate`(약관 게이트)를 겹쳐 보여줍니다
- **화면 구성 / 원격 모듈:**
  - 원격 `members-app/./mount`를 씁니다
  - 마운트 전에 `Brn()`으로 권한 로드를 기다립니다
  - `pathMatch`가 바뀌면 `navigate(path)`를 부릅니다
- **호스트가 넘기는 값:** `default(el, { initialPath, emr, onRequireLogin })`
  - `initialPath`: `/` + `pathMatch` 조각
  - `emr.getAccessToken({ forceRefresh })`:
    - `forceRefresh`면 `getAuthToken$({ withRefresh: true })`
    - 아니면 localStorage의 `accessToken`
    - 둘 다 없으면 `null`
  - `emr.memberId`, `emr.groupNm`(`CLIENT`): 연동 조회 결과
  - `emr.apiBaseUrl`: EMR API base URL 상수
  - `emr.planTier`: `members` 연동이면서 풀 차트(`vnn`)이면 `"full"`, 아니면 `"lite"`
  - `emr.permissions`: 불리언 맵
    - `retrospective`: 역할이 `01`인지
    - 나머지는 `jA(노드)`: `metricForm`(지표관리양식), `metricFormCreate`, `metricFormWrite`, `happyCall`(초진환자해피콜), `funnelChart`, `keywordTrend`, `nonbenefitChart`, `nonbenefitCategory`, `nonbenefitItemWrite`, `nonbenefitItemDelete`, `periodData`
  - `emr.renderBiView(el, { view, extraTabs, onNavigate })`:
    - `view === "incoming-path"`이고 `funnelChart`가 있을 때만 동작합니다. 호스트가 `IncomingPathTableView`(→ BI `IncomingPathTableContainer`)를 원격이 준 `el`에 `Teleport`합니다
    - 돌려주는 값: `{ unmount, extraTabsRendered }`
    - 그 밖의 경우 `null`을 돌려줍니다
  - `onRequireLogin`: `/login`으로 이동합니다
- **데이터:** 호스트에서는 `/integrations/members/subscribers` 하나만 부릅니다. 지표 데이터는 원격이 `apiBaseUrl`과 토큰으로 직접 요청할 것으로 보입니다 (추정)
- **근거:** `restored/views/MembersView.vue.js`, `restored/api/MembersView/client.js`, `restored/lib/index/part-41.js`, `restored/lib/index/part-72.js`, `restored/router/guards.js`, `restored/components/members/MembersRetroTermsGate.vue`

## 자료·공지 포털 — `/portal`, `/library`

- **목적:** 게시판형 자료·공지입니다. 문서 제목은 "자료·공지"입니다 (`restored/modules/index/part-229.js`)
- **접근 조건:**
  - 둘 다 `requiresAuth`만 요구하고 권한 코드는 없습니다
  - **`/portal`:** 전역 레이아웃을 쓰고 모바일을 지원합니다(`supportsMobile`). 모바일 GNB 링크가 있습니다
  - **`/library`:** 전역 레이아웃 없는 독립 창입니다. 사이드바 "자료·공지" 링크가 `target="_blank"`로 엽니다
  - 노출 플래그 `iue`는 항상 `true`입니다
- **화면 구성 / 원격 모듈:**
  - 두 화면 모두 `PortalContainer`에 `component-module="emr-portal/LitePortalContainer"`를 넘깁니다
  - 하지만 컨테이너는 이 prop을 쓰지 않고 항상 `./litePortalMount`를 로드합니다
  - **`LiteView`:** `owner-route-name="portal"`만 넘깁니다
  - **`LibraryWindowView`:**
    - 자체 헤더를 그립니다: 로고, 가운데 `menuSlot` div, 오른쪽 `searchSlot` div, 로그아웃 전용 `AvatarLabelGroup`
    - 두 div의 DOM 요소를 `menu-slot`/`search-slot`으로 넘기고, 원격이 거기에 메뉴와 검색을 그립니다 (추정)
    - `owner-route-name`은 `library-window`입니다
- **호스트가 넘기는 값:** `mount(el, props)` / `update(props)`
  - `token`
  - `pageId`, `queryParams`(현재 쿼리 중 문자열 값), `boardId`, `postId`, `search: { query, spaceKey }`(쿼리 `q`, `searchBoard`)
  - `hideNav`(= `embedded`), `menuSlot`, `searchSlot`
  - **원격 → 호스트 콜백:**
    - `onPageChange(pageId)`: `pageId`를 세우고 board/post/검색 쿼리를 지운 뒤 `replace`
    - `onPostChange({ boardId, postId, history })`: 새 글을 열 때나 `history === "push"`이거나 검색 중이면 `push`, 아니면 `replace`
    - `onSearchChange({ query, spaceKey })`: 검색 쿼리 갱신
    - `onNavigate(to)`: `router.push`
    - `onTrack(name, params)`: `gtag` 이벤트 전송 (`restored/lib/PortalContainer/getBaseUrl.js` `Pe`)
      - 이벤트 이름은 `portal_[a-z0-9_]{1,33}`만 받습니다
      - 파라미터는 키 형식이 맞는 원시값만, 최대 25개, 문자열은 100자로 자릅니다
  - 쿼리 동기화는 현재 라우트 이름이 `ownerRouteName`일 때만 합니다
  - **`embedded` 모드** (챌린지 교육자료):
    - `pageId`는 32자리 hex만 받습니다
    - board/post는 쿼리 대신 내부 ref에 둡니다
- **데이터:** 호스트 쪽 포털 엔드포인트는 없습니다. 사이드바 배너용 `portalClient`(`getV1Banners`)는 이 화면과 별개입니다
- **근거:** `restored/views/LiteView.vue.js`, `restored/views/LibraryWindowView.vue.js`, `restored/components/portal/PortalContainer.vue`, `restored/components/portal/PortalContainer.vue.js`, `restored/components/sidebar/SidebarNav.vue.js`

## 챌린지 — `/challenge`

- **목적:** 수련(surachal) 코호트 참여자용 화면입니다. 탭은 교육자료 · 과제 제출 · 리더보드이고, 메뉴 id 95 "챌린지"에 있습니다
- **접근 조건:**
  - 라우터 가드가 `HQt`(토큰별 캐시)로 다음을 부릅니다:
    1. `GET /api/surachal/cohort`
    2. `GET /api/surachal/me?cohort_no=`
  - `access.menu === true`일 때만 들어갈 수 있고, 아니면 홈으로 보냅니다. 404이면 접근 없음으로 캐시합니다 (`restored/lib/index/part-261.js`)
  - 탭 노출은 `access.educationLinks` / `dashboard` / `leaderboard`가 `true`인지로 정합니다 (`Ce`)
- **화면 구성 / 원격 모듈:**
  - 현재 탭은 쿼리 `tab`(`materials` | `taskSubmission` | `leaderboard`)입니다
  - **교육자료** → `LiteRisingMaterialsPane`
    - 안에서 `PortalContainer`를 embedded로 씁니다: `owner-route-name="challenge"`, 고정 `default-page-id`, 루트 id `challenge-materials-portal-root`
    - 호스트 코드로 과제 진행·제출 드로어(`LiteRisingTaskSubmitDrawer`)를 둡니다
  - **과제 제출·리더보드** → `BiContainer`
    - `emr-bi-frontend/LiteRisingContainer`, 루트 id `lite-rising-bi-root`
- **호스트가 넘기는 값:**
  - BI에는 `remoteProps: { tab: "taskSubmission" | "leaderboard" }`와 `token`을 넘깁니다
  - 포털에는 위 포털 props를 넘기되 `hideNav: true`입니다
  - 교육자료로 바꿀 때만 쿼리 `pageId`를 유지합니다
- **데이터** (호스트, biClient):
  - `GET /api/surachal/cohort`, `/me`, `/progress`
  - `GET`·`POST /api/surachal/submissions`
  - 출처: [endpoints.md](../../endpoints.md)
- **근거:** `restored/views/ChallengeView.vue.js`, `restored/components/lite/LiteRisingMaterialsPane.vue.js`, `restored/modules/ChallengeView/UniqueKey.js`, `restored/modules/index/useApiSurachalCohortQuery.js`, `restored/router/guards.js`

## 자리표시·개발용 — `/message`, `/help`, `/preview`

- **목적:**
  - `/message`, `/help`: 문구 한 줄("문자 발송", "도움말 페이지")만 렌더하는 자리표시 컴포넌트입니다
  - `/preview` (`component-preview`): `ComponentPreview`가 Base* 컴포넌트(버튼·입력·모달·탭·사이드패널·`CrmKakaoBrandMessageEditor` 등)의 예시를 늘어놓는 개발용 카탈로그입니다
- **접근 조건:** 셋 다 `requiresAuth`만 요구하고 권한 코드는 없습니다. `/preview`는 전역 레이아웃을 씁니다
- **화면 구성 / 원격 모듈:** 원격 앱은 없습니다
- **호스트가 넘기는 값:** 없음
- **데이터:** API 호출은 보이지 않습니다
- **근거:** `restored/modules/MessageView.js`, `restored/modules/HelpView.js`, `restored/components/component/ComponentPreview.vue.js`

## 레거시 차트 대비

이 절은 레거시 차트 매뉴얼을 근거로 정리했으며, 현행 코드에서 확인한 내용이 아닙니다. 현행 BI·재무 원격 앱은 내부 코드가 번들에 없어서, 아래 통계가 현행에 이미 있는지는 판단하지 못했습니다. 그래서 "현행 스펙에 없는 업무"는 호스트 스펙에 드러나지 않는다는 뜻입니다.

### 현행 스펙에 없는 업무

레거시 차트는 통계를 원장실 프로그램 "경영관리 → 결산 및 통계 분석" 한 화면에 모읍니다. 대부분 기간(일·월·연·임의 기간)을 정해 "통계작성"하고, 표·그래프로 보고 엑셀로 복사하거나 출력합니다.

- **결산 (세무용):** 보험·의료급여·자보·산재 등 모든 진료기록을 합쳐 집계합니다 (레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)

  | 통계 | 기간 단위 | 집계 내용 |
  |---|---|---|
  | 일일결산 | 결산일자 | 그날의 전 보험종별 진료비·수납. 등록된 휴대폰 번호로 요약을 LMS로 보낼 수 있습니다 (수신 번호는 "통계환경설정"에서 관리) |
  | 진료내용 보고 | 기간 | 진료일자별 보험진료·일반(비급여)진료 내역과 진료메모. 진료기록 출력 보관용 |
  | 주간결산 | 기간(주) | 일일결산과 같은 항목의 주간 합계 |
  | 월말결산 | 결산월 | 월 합계 |
  | 연말결산 | 결산년도 | 연 합계. 세무 신고용 연간 수납 내역 (아래 업무 규칙) |
  | 기간결산 | 임의 기간 | 임의 기간 합계 |
  | 세무관련 세부 통계 | 기간 | 기간결산보다 항목을 잘게 나눈 세무용 내역. 출력할 항목을 골라 엑셀로 냅니다. "현금영수증 합계 → 현금영수증 본인" 항목이 있습니다 |
  | 과세진료 통계/목록 | 기간·월·연 | 과세 진료기록 통계, 과세진료 목록, 과세수납 목록, 월별 결산표 |
  | 진료비계산서 목록 / 정산계산서 목록 | 발행일자 기간 | 발행한 계산서 목록 |

- **한의원 경영패턴 분석:** 금월·전월·지정월(일 단위), 최근 3개월 같은 구간을 고르면 진료비 발생, 진료비 수납, 환자 수, 과세 진료비 수납을 기간별로 비교하고 증감률을 보여줍니다 (레거시 차트 매뉴얼 「한의원 경영패턴 분석 통계」)
- **건강보험 통계:** (레거시 차트 매뉴얼 「건강보험 통계」)
  - **보험 진료비 통계 (월 / 연결산):** 결산월이나 결산연도의 건강보험·의료급여 진료비
  - **보험 투약 통계:** 기간 내 보험약 투약 횟수와 금액, 투약 환자 명단
  - **보험 치료재료 통계:** 기간 내 일회용 부항컵·탄력붕대 등의 사용 통계와 명단
  - **보험 상병명 통계:** 월별이나 기간별로 상병마다 진료 환자 수, 비율(%), 남녀 수, 내원 횟수, 연령대
  - **보험 치료/시술 통계:** 진료월의 치료·시술 항목별 전체 통계. 65세 이상과 미만을 나눈 통계를 따로 냅니다
  - **상병명별 내원일수 통계:** 진료월의 보험 환자별 내원일수, 상병 정보, 진료비 정보. 내원일수 분포 분석을 함께 봅니다
  - **초진/재진/재초진 통계:** 기간·월·연별로 진찰료 구분(초진·재진·재초진) 건수를 셉니다. "통계추가작성"으로 여러 기간을 쌓아 비교하고, 요일별 초진·재진 환자 그래프와 환자 목록을 봅니다. 판정 기준은 아래 업무 규칙에 있습니다
  - **보험 이탈자 통계:** 기간·월·연별 보험 이탈자 수. 여러 기간을 비교합니다
- **비급여(일반진료) 통계:** (레거시 차트 매뉴얼 「비급여 관련 통계」, 레거시 차트 매뉴얼 「우리 한의원의 시즌별 주력환자군을 알아보기」)
  - **일반진료 목록:** 기간 내 비급여 기록의 환자명·진료일·항목·진단명·시술/처방명, 처방·시술 현황 그래프. "등록일" 옵션을 켜면 기간 안에 신환 등록한 환자의 기록만 뽑습니다
  - **일반진료 분석:** 기간·월·연별로 비급여 항목마다 신규 환자 수, 재진 환자 수, 횟수, 횟수 비율(%). 컬럼별 정렬을 지원합니다
  - **진료항목별 분석 (라인 그래프):** 일·월·연별로 진료항목의 횟수, 횟수 비율, 진료비, 진료비 비율
  - **약재 사용량 통계:** 기간 내 약재별 사용량
  - **시즌별 주력 환자군:** 별도 화면이 아니라, 비급여 진료항목을 클리닉 카테고리(목감기·코감기·근골격·비만 등)로 나눠 기록해 두고 위 통계로 계절별 환자 수·점유율(횟수·진료비)과 전년 같은 시즌 대비 증감을 보는 활용법입니다. 그 환자군에게 다음 시즌 안내 문자를 보내는 데 씁니다
- **자동차보험·산재보험 통계:** (레거시 차트 매뉴얼 「자동차보험, 산재보험 통계」, 레거시 차트 매뉴얼 「진료의별 통계」)
  - **자동차보험 통계:** 연·월별 자보 환자 진료비
  - **자보 상병명 통계:** 월·기간별 자보 상병 횟수, 연령대
  - **자보 치료/시술 통계:** 진료월별 자보 치료·시술
  - **자보진료 목록:** 기간 내 자보 환자의 진단명·시술/처방명. "환자등록일포함" 옵션으로 기간 내 신환만 뽑습니다
  - **자동차보험 회사별 통계:** 통계년도의 보험사별 합계. 세무 신고 때 씁니다
  - **산재보험 통계:** 진료년도의 산재 환자 진료비
- **내원환자 통계:** (레거시 차트 매뉴얼 「내원환자 관련 통계」)
  - **내원일수/진료비 분석:** 기간 내 환자별 내원일수, 총진료비, 본인부담, 청구금액. 내원일수 1~2일 환자에게 전화로 사유를 묻는 데 씁니다. "기간 중 신규 환자만" 옵션이 있습니다
    - 나이·성별 분석: 나이 구간별 환자 수·비율, 내원일수·비율. 자주 쓰는 나이 구간을 사용자 설정으로 저장합니다
  - **요일/내원시각 분석:** 요일별, 1시간대별, 30분대별, 요일×1시간대, 요일×30분대로 환자 수 비율과 진료비 비율
  - **유입경로 분석:** 기간·월·연별 유입경로마다 환자 수, 비율, 본인부담금. 환자 관리정보의 유입경로 값으로 집계하고, "기간 중 처음 내원한 환자만" 옵션이 있습니다
  - **내원패턴 분석:** 등록일, VIP, 주치의, 유입경로, 직업, URL, 진행중치료, 예정된치료 같은 관리정보 항목을 골라 기간 내 분포를 봅니다
  - **상담관리 현황:** 상담일자 기간의 상담 구분, 유입경로, 진료 구분, 상담 결과, 상담자별 건수
  - **내원환자 주소 통계:** 지역별 환자 수. 도로명 주소는 지원하지 않습니다
  - **신규/재진 환자 진료비 통계:** 신환 등록일 기준으로 신규·재진 환자의 진료비를 나눕니다. 여러 기간을 비교합니다
  - **진행중 치료 진료비 통계:** 연 단위로, 관리정보 "진행중 치료" 값별 월별 진료비·비율·환자 수·비율
  - **진행/예정 치료 환자수 통계:** "예정된 치료"에 적힌 항목이 실제 진행 치료로 이어진 환자 수
  - **재내원 통계:** 기간·월·연별 재내원 현황과 재내원하지 않은 환자 목록
- **진료의별 통계:** 진료의별 월말·연말 통계(진료비·환자 수·내원 수 그래프), 자보 진료의별 월말 통계, 진료의별 시간대별 환자 수(진료기록 시각 기준)를 냅니다. 금액은 발생액 기준입니다 (아래 업무 규칙) (레거시 차트 매뉴얼 「진료의별 통계」)
- **물품판매 통계:** 의료기관 매출과 분리된 과세 물품(숍인숍) 판매를 따로 집계합니다 (레거시 차트 매뉴얼 「물품판매 통계」, 레거시 차트 매뉴얼 「판매관리에서 과세상품 관리」)
  - 물품 일일결산: 환자별 과세 판매액, 비과세 판매액, 판매 할인
  - 물품 월말결산: 일자별 판매 고객 수, 과세·비과세 판매액, 할인
  - 물품 연말결산: 월별 같은 항목
  - 기간별 고객 목록
  - 기간별 판매 현황: 물품별 입고·망실·서비스·반품·판매·현재 재고
- **소개자 통계:** 환자 관리정보에 소개자와 관계를 적으면, 기간 내 소개 관계를 트리(소개자 → 피소개자, 하위 단계 펼침)와 랭킹(소개 횟수 등 컬럼 기준 정렬)으로 봅니다. 결과 목록에서 골라 VIP 등급을 일괄로 바꾸거나 문자를 보내거나 엑셀로 냅니다. 환자 한 명 기준으로 가족·소개자 진료비 요약도 봅니다 (레거시 차트 매뉴얼 「소개자 기록 및 통계」)
- **금전출납부 통계:** 금일·전일·금월·전월·임의 기간의 계정과목별 수입·지출 합계를 출력하거나 엑셀로 냅니다. 기록 방식은 [settings.md](settings.md)의 같은 절에 있습니다 (레거시 차트 매뉴얼 「금전출납부 기록 및 통계」)
- **보험약·치료재료 투약/사용 통계:** 기간 내 보험약별 총 투약량과 총 약가, 치료재료별 총 사용량과 총 금액을 냅니다. 재고 관리 화면에 붙어 있습니다 (레거시 차트 매뉴얼 「보험처방, 치료재료 매입/재고 관리」)
- **한방물리요법 시술 현황:** 오늘·어제·금월·전월·임의 기간의 한방물리요법 총 횟수(진료의별)와 평균 횟수(한의사 근무일 1일당, Man-day)를 봅니다. EDI 청구 전에 인정 한도(1인당 1일 평균 30명)를 넘는지 확인하는 용도입니다. 경영 통계에서는 다른 치료 대비 점유율, 진료 환자 수, 내원 횟수를 봅니다 (레거시 차트 매뉴얼 「한방물리요법 관리」, 레거시 차트 매뉴얼 「우리 한의원의 물리요법 산정횟수와 월평균 시술현황」)
- **주간요약:** 환자 한 명의 진료기록을 심평원 주 단위로 묶어 내원 횟수와 시술 내역 합계를 보여줍니다. 건보는 초진일, 자보는 수상일을 1일차로 놓고 경과일수를 표시합니다. 진료기록 때 산정 기준을 넘는지 확인하는 데 씁니다 (레거시 차트 매뉴얼 「주간요약 기능」)
- **세무신고 자료 준비:** 연말에 다음 자료를 모읍니다. 차트 밖 자료는 각 기관 포털에서 받습니다 (레거시 차트 매뉴얼 「(세무신고) 레거시 차트에서 연말결산(연간수납내역) 출력」, 레거시 차트 매뉴얼 「(세무신고) 건보 연간지급내역 및 산재 진료비지급 출력」, 레거시 차트 매뉴얼 「(세무신고) 자동차보험 회사별로 '원천징수 영수증' 발급」)

  | 자료 | 출처 | 비고 |
  |---|---|---|
  | 연말결산(연간 수납 내역) | 차트 | PDF 저장 가능. 비급여 통계도 필요하면 함께 냄 |
  | 자동차보험 회사별 통계 | 차트 | 원천징수 영수증은 각 보험사·보상 담당자에게 따로 요청. 차트 기능 없음 |
  | 산재보험 통계 | 차트 | 산재 청구가 있는 기관만 |
  | 과세진료 통계 | 차트 | 과세 진료가 있는 기관만 |
  | 세무관련 세부 통계 | 차트 | 항목별 참고 내역 |
  | 의료비 연말정산 제출 총액 | 차트(연말소득공제자료제출) | 제출 때와 같은 기준(수납 내역 / 진료 발생 내역)으로 취합 |
  | 요양급여·의료급여 연간지급내역 통보서 | 건보공단 요양기관정보마당 | 12월 청구분처럼 통보서에 빠진 지급분은 지급내역에서 기간 조회해 따로 출력. 필요하면 노인장기요양 연간지급내역, 비급여보고 행정비용지원금 연간지급내역도 |
  | 진료비지급현황(총괄, 세금자료 포함) | 근로복지공단 고용산재보험 토탈서비스 | 산재 청구가 있는 기관만 |

### 업무 규칙

- **현금영수증과 현금 수납:** 결산의 현금영수증 금액은 현금 수납액 안에 포함된 금액입니다. 순수 현금 = 현금 수납 − 현금영수증입니다. 예: 현금 수납 11,800원 중 현금영수증 10,000원이면 순수 현금은 1,800원입니다 (레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)
- **연간 본인부담 수입:** 연말결산의 본인부담금 수입은 카드 수납, 카드 회수(미수 카드 회수로 추정), 현금영수증 금액으로 나눠 봅니다. 현금영수증 금액은 차트에서 승인한 것과 단말기 승인분을 차트에 수기로 기록한 것을 합친 값입니다 (레거시 차트 매뉴얼 「(세무신고) 레거시 차트에서 연말결산(연간수납내역) 출력」)
- **현금영수증의 세무 해석:** (레거시 차트 매뉴얼 「현금영수증 발행분에 대한 해석 - 세무관련 통계」, 레거시 차트 매뉴얼 「현금영수증 승인 관련 내용 정리 요약」)
  - 세무 신고는 보험 본인부담금과 비보험 본인부담금으로 나누고, 각각 카드 금액 + 현금(현금영수증)으로 구성됩니다
  - 국세청은 현금영수증 수납을 보통 카드 수납에 합치고, 카드 수납은 비보험(첩약)으로 추정합니다. 그래서 보험 본인부담금을 현금영수증으로 받은 금액이 비보험 카드 매출에 중복 계산될 수 있습니다
  - 세무관련 세부 통계의 "현금영수증 본인" 금액이 이 보험 본인부담 현금영수증분입니다. 카드 매출에서 뺄지는 세무사와 정합니다
  - 카드 단말기에서 직접 승인한 현금영수증은 차트 통계에 잡히지 않습니다. 차트에서 승인하거나 승인 정보를 수기로 기록해야 통계에 쌓입니다
  - 따라서 통계는 보험/비보험 구분과 수납 수단(현금·카드·현금영수증)을 모두 축으로 가져야 합니다 (추정)
- **진료의별 금액은 발생액 기준:** 진료의별 통계는 수납액이 아니라 진료기록의 발생액(진료비)을 진료의별로 합산합니다. 같은 날 같은 환자를 여러 진료의가 기록할 수 있고, 수납의 할인·절사·미수·부분수납과 나중에 고친 수납을 진료의별로 나눌 수 없기 때문입니다 (레거시 차트 매뉴얼 「진료의별 통계」)
- **초진·재진·재초진 판정:** 통계 화면의 설명이며 매뉴얼 기준입니다 (레거시 차트 매뉴얼 「건강보험 통계」)
  - 초진: 해당 상병으로 처음 진찰한 경우
  - 재진: 같은 상병으로 계속 진찰하는 경우. 치료 종결 후 30일 이내에 오면 재진이고, 종결 여부가 불분명하면 90일 이내까지 재진입니다
  - 재초진(초진 산정): 같은 상병이 종결(90일 경과) 뒤 재발해 온 경우, 또는 종결 30일 뒤 대분류가 다른 상병으로 온 경우
- **이탈자 판정:** 설정 기간 동안 N회 이상 내원한 환자 중, 그 기간의 마지막 진료 이후 오늘까지 진료기록이 없는 환자를 이탈자로 보고 수와 비율을 냅니다. 보험과 비급여를 구분하지 않고 진료기록 유무만 봅니다. 그래서 보험 초재진 통계와 숫자가 다르고, N을 바꾸면 이탈률도 달라집니다 (레거시 차트 매뉴얼 「OKCRM - 이탈자 검색」)
- **신규 환자 기준:** "기간 중 신규 환자만", "등록일", "환자등록일포함" 같은 옵션과 신규/재진 진료비 통계는 모두 환자 등록(신환 등록)일이 기간 안에 있는지로 신규를 정합니다. 진찰료의 초진 구분과는 다른 기준입니다 (레거시 차트 매뉴얼 「내원환자 관련 통계」, 레거시 차트 매뉴얼 「비급여 관련 통계」)
- **관리정보 기반 통계:** 유입경로·진행중치료·예정된치료·내원패턴 통계는 환자 관리정보에 적힌 현재 값으로 집계합니다. 지정 항목 값을 일괄로 바꾸면 과거 통계도 바뀝니다 (추정) (레거시 차트 매뉴얼 「내원환자 관련 통계」, 레거시 차트 매뉴얼 「관리정보에서의 지정 항목 관리」)
- **한방물리요법 평균:** 월(주)평균 1일 실시 인원 = 기간 내 한방물리요법 청구건수 ÷ 기간 내 한의사 근무일수입니다. 자보·산재 환자는 세지 않고, 의료급여 환자는 셉니다. 인정 한도는 상근 1인당 30명, 0.5인 근무자 15명입니다 (매뉴얼 기준) (레거시 차트 매뉴얼 「우리 한의원의 물리요법 산정횟수와 월평균 시술현황」)
- **주간요약의 주 단위:** 심평원이 1주일로 세는 기준일수와 같게 묶습니다. 1일차는 건보가 초진일, 자보가 수상일입니다 (레거시 차트 매뉴얼 「주간요약 기능」)
- **건보 연간지급내역은 지급일 기준:** 공단 연간지급내역 통보서는 진료월이 아니라 지급일자 기준입니다. 차트의 연말결산(진료·수납 기준)과 기간이 어긋날 수 있습니다. 휴·폐업 기관은 대표자 개인 인증서로 폐업기관 로그인해 조회합니다 (레거시 차트 매뉴얼 「(세무신고) 건보 연간지급내역 및 산재 진료비지급 출력」)
- **양도·양수 개설:** 양수로 새로 개설한 기관은 통계 기간을 개설일자에 맞춰 잘라야 합니다 (레거시 차트 매뉴얼 「(세무신고) 레거시 차트에서 연말결산(연간수납내역) 출력」)
- **주소 통계:** 지번 주소로만 집계하고 도로명 주소는 지원하지 않습니다 (레거시 차트 매뉴얼 「내원환자 관련 통계」)

### 현행과 다른 점

- **통계 접근 권한:** 레거시 차트는 진료한의사 계정의 `관리자` 플래그가 없으면 경영관리(통계) 메뉴 자체가 숨겨집니다. "진료의 바로변경"으로 바꾼 진료의에게도 통계를 가립니다. 현행은 `경영지표`(`bi`)·재무 세부 권한 코드와 역할로 화면마다 검사합니다 (레거시 차트 매뉴얼 「진료 한의사 관리」, 레거시 차트 매뉴얼 「진료의 바로변경」)
- **통계 생성 방식:** 레거시 차트는 사용자가 기간을 고르고 "통계작성"을 누를 때 계산합니다. "통계추가작성"으로 여러 기간 결과를 한 화면에 쌓아 비교합니다. 결과는 엑셀 복사·클립보드·출력·PDF로 냅니다. 현행 BI·재무 원격 앱의 계산 시점과 비교 방식은 알 수 없습니다 (레거시 차트 매뉴얼 「건강보험 통계」, 레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)
- **보험종별 축:** 레거시 차트 통계는 건보(의료급여 포함)·비급여·자보·산재·과세·물품판매를 따로 화면으로 나누고, 결산만 전부 합칩니다. 현행 BI 메뉴는 매출·예약·환자·유입경로·진료의 축으로 나뉩니다. 보험종별 분리 통계가 원격 안에 있는지는 확인하지 못했습니다 (레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)
- **일일 브리핑:** 레거시 차트는 일일결산 요약을 등록 번호로 LMS 발송합니다. 현행은 재무 원격 앱의 `daily-briefing` 화면으로 봅니다 (추정 대응) (레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)
- **세무 연계:** 레거시 차트는 세무 세부 통계를 세무회계 업체에 정기 리포트로 넘기는 연계(OKTax)를 둡니다. 현행 재무 원격 앱의 손익·지출 화면이 비슷한 목적일 수 있습니다 (추정) (레거시 차트 매뉴얼 「결산 통계(일일, 월말, 연말 등)」)
- **유입경로 데이터 출처:** 레거시 차트 유입경로 통계는 환자 관리정보의 유입경로 항목 하나만 봅니다. 현행 `/analytics/incoming-path`와 MEMBERS `funnel`은 원격이 계산하며, 데이터 출처(내원 경로 설정 값인지 다른 신호인지)는 알 수 없습니다 (레거시 차트 매뉴얼 「내원환자 관련 통계」)

## 미확인·추정

- 원격 4개(BI·재무·포털·MEMBERS)의 내부 화면, 데이터 호출, 권한 처리는 이 번들에 없어 확인할 수 없습니다. `IncomingPathTableContainer`가 `onOpenPatientDetail` 등에 넘기는 인자 형태도 모릅니다
- 호스트 쪽 이름 규칙(`__federation_shared_*`, `_virtual___federation__`)으로 보아 원격이 Vite federation으로 빌드됐다고 추정합니다. BI·포털의 캐시 무효화 코드에는 webpack 캐시를 지우는 분기도 함께 있습니다
- `BiContainer`의 fallback 경로는 remoteEntry를 다시 로드한 뒤 같은 모듈 맵을 다시 읽습니다. 맵 값은 모듈 최상위 `await`에서 이미 정해진 것이라, 재시도로 다른 모듈을 얻지는 못할 것으로 보입니다 (추정)
- 재무 재시도는 빈 공유 스코프 `init({})`를 씁니다. 이 경우 원격이 호스트의 vue/react 대신 자기 사본을 쓸 수 있습니다 (추정)
- `LiteDashboardView`는 `bi` 권한과 역할 `01`을 모두 요구합니다. 사이드바는 `lite`/원탕 조건과 역할만 봅니다. 그래서 `bi`가 없는 대표원장에게는 메뉴가 보이지만 화면에서는 접근 거부가 나올 수 있습니다 (추정)
- `/message`, `/help`로 가는 링크는 확인하지 못했습니다. 실제 기능 화면(문자 발송은 `/crm/message` 등)과는 별개의 잔존 라우트로 보입니다 (추정)
- `remoteEntryReloadCount`는 3회 초과 때만 지워집니다. 세션 중에 토큰 만료로 인한 새로고침이 여러 번 쌓이면 이른 시점에 `/login`으로 보낼 수 있습니다 (추정)
