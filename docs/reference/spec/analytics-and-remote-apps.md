# 경영지표·재무·원격 앱

경영지표(`/analytics/*`), 재무(`/finance/*`), MEMBERS(`/members/*`), 자료·공지 포털(`/portal`, `/library`), 챌린지(`/challenge`)는 화면 본문을 대부분 **Module Federation 원격 앱**에 맡깁니다. 호스트는 권한 검사, 원격 로드·재시도, 토큰 동기화, 스타일 주입, 라우트 ↔ 원격 상태 동기화만 합니다.
원격 앱 자체 코드는 이 번들에 **없습니다**. 아래 내용은 호스트 쪽 계약(넘기는 값, 기대하는 export 형태)만 다룹니다.

## 원격 앱 연동 구조

### 런타임

- federation 런타임은 `re-upstream/restored/vendor/_virtual___federation__/_virtual___federation__-0.js`에 있습니다. 재노출은 `re-upstream/restored/_chunks/_virtual___federation__-GOYwUxr7.js`가 합니다. 이름 규칙을 보면 Vite federation 플러그인 산출물로 보입니다 (추정)
- 원격 4개를 모두 `format: "esm"`, `from: "vite"`로 등록합니다
- `y(remote, "./Module")`의 동작:
  1. 처음 쓰일 때 remoteEntry를 `import()`합니다
  2. 공유 스코프로 `init`을 부릅니다
  3. `get(module)` 팩토리를 실행해 모듈을 돌려줍니다
- `b`/`h`는 ESM default를 풀거나 감싸는 헬퍼입니다
- **공유 모듈** (호스트가 제공):

  | 패키지 | 버전 | 청크 |
  |---|---|---|
  | `vue` | 3.5.35 | __federation_shared_vue (`re-upstream/restored/_chunks/__federation_shared_vue-C2ahgQls.js`) (Vue 런타임 export 전체 재노출) |
  | `react` | 19.1.0 | __federation_shared_react (`re-upstream/restored/_chunks/__federation_shared_react-CzYBVFPb.js`) |
  | `react-dom` | 19.1.0 | __federation_shared_react-dom (`re-upstream/restored/_chunks/__federation_shared_react-dom-BdiQ3A5x.js`) |

  - `globalThis.__federation_shared__`가 있으면 그 값과 합칩니다

### 원격 목록

| remote 이름 | remoteEntry 호스트 | 노출 모듈 (호스트가 요청하는 것) | 사용하는 라우트 |
|---|---|---|---|
| `upstream-bi-frontend` | `bi.upstream.co.kr` | `./RevenueTableContainer`, `./AppointmentTableContainer`, `./PatientTableContainer`, `./IncomingPathTableContainer`, `./DoctorTableContainer`, `./SooDashboardContainer`, `./SooRisingContainer`, `./RevenueContainer` | `/analytics/revenue`·`appointment`·`patient`·`incoming-path`·`doctor`·`soo-dashboard`, `/challenge`(과제 제출·리더보드 탭), `/members/funnel` 안 유입경로 임베드 (추정, 아래 MEMBERS 참고) |
| `upstream-finance-frontend` | `finance-prd.upstream.co.kr` | `./financeMount` | `/finance/*`, 설정 지출수집(`SettingExpenseCollectionView`, `initialPath: "/expense-collection"`) |
| `upstream-emr-portal` | `portal.upstream.co.kr` (URL을 함수로 만들어 매번 `?t=Date.now()`를 붙임) | `./sooPortalMount` | `/portal`, `/library`, `/challenge`(교육자료 탭) |
| `medistream-members` | `members.medistream.co.kr/assets` | `./mount` | `/members/*` |

- `./RevenueContainer`는 두 `BiContainer`의 맵에 들어 있습니다. 하지만 이를 `component-module`로 넘기는 화면은 호스트에 없습니다
- 라우트의 `component-module` 문자열(예: `upstream-emr-portal/SooPortalContainer`)과 실제로 로드하는 모듈이 다른 경우가 있습니다. 포털이 그렇습니다 (아래 참고)

### 마운트 방식 (원격별 계약)

| 컨테이너 | 원격 export 형태 | 호스트가 하는 일 |
|---|---|---|
| BiContainer (`re-upstream/restored/components/bi/BiContainer.vue.js`) / BiContainer-2 (`re-upstream/restored/components/bi/BiContainer-2.vue.js`) | **React 컴포넌트** (함수) | 호스트가 번들한 `react-dom`의 `createRoot(div)`로 루트를 만들고 `createElement(Component, props)`를 렌더합니다. props가 바뀌면 같은 루트에 다시 `render` |
| FinanceContainer (`re-upstream/restored/components/finance/FinanceContainer.vue.js`) | `mount(el, { token, initialPath })` → `{ update, unmount }` (`default.mount` 또는 `mount`) | 토큰이 바뀌면 `update`, `initialPath`가 바뀌면 다시 마운트 |
| PortalContainer (`re-upstream/restored/components/portal/PortalContainer.vue.js`) | `mount(el, props)` → `{ update, unmount }` | 라우트 쿼리나 슬롯이 바뀌면 `update(props)` |
| MembersView (`re-upstream/restored/views/MembersView.vue.js`) | `default(el, options)` → `{ navigate, unmount }` | 라우트 `pathMatch`가 바뀌면 `navigate(path)` |

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
| 모듈 맵 | Patient/Appointment/RevenueTable/Revenue/**SooDashboard/SooRising** | Patient/Appointment/RevenueTable/Revenue/**IncomingPathTable/DoctorTable** |
| 사용처 | `SooDashboardView`, `ChallengeView` | `RevenueTableView`, `AppointmentTableView`, `PatientTableView`, `IncomingPathTableView`, `DoctorTableView` |

- `overrideToken`을 넘기는 호스트 코드는 없습니다

### 인증 토큰 동기화

useModuleFederationTokenSync (`re-upstream/restored/modules/useModuleFederationTokenSync/part-1.js`) `L(onChange)`를 씁니다.

- **토큰 출처:** localStorage `userAuthData`(`bt.사용자로그인정보`)의 JSON입니다. 원격에는 `accessToken`만 넘깁니다
- **유효성:** `accessToken`이 있어야 합니다. `exp`(초 단위)가 있으면 현재 시각보다 뒤여야 합니다
- **변경 감지:**
  - `patchLocalStorageNotifier`가 `localStorage.setItem`·`removeItem`을 감쌉니다. 같은 탭 안의 변경은 `ls:change` CustomEvent로 알립니다. 감싸기는 참조 카운트로 관리합니다 (`re-upstream/restored/modules/useModuleFederationTokenSync/patchLocalStorageNotifier.js`)
  - 그 밖에 `storage` 이벤트, `focus`, `visibilitychange`를 받습니다
  - BI·포털은 1초 간격 폴링도 합니다. 재무는 폴링하지 않습니다
- **토큰이 무효일 때:**
  1. sessionStorage `remoteEntryReloadCount`를 1 올리고 `location.reload()` 합니다
  2. 3회째면 키를 지우고 `/login`으로 보냅니다
  - 성공했을 때 이 카운터를 지우는 코드는 보이지 않습니다
- MEMBERS만 다른 방식을 씁니다. 토큰을 값이 아닌 `getAccessToken({ forceRefresh })` 콜백으로 넘깁니다

### 재시도와 캐시 무효화

**BI** (`Qs`, `re-upstream/restored/vendor/react/useBiStyles-2.js`) / **포털** (`Se`, `re-upstream/restored/lib/PortalContainer/getBaseUrl.js`):
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

**재무** (`re-upstream/restored/components/finance/FinanceContainer.helpers.js` `z`):
- 재시도(`loadFinanceMount(true)`)에서는 federation 런타임을 거치지 않습니다
  - `remoteEntry.js?t=…`를 직접 `import`합니다
  - `init({})`(빈 공유 스코프)으로 초기화하고 `./financeMount`를 받습니다
- base URL이 `localhost`/`127.0.0.1`이면 react-router HMR preamble을 먼저 주입합니다. 개발용입니다
- 오류 문구: "재무 화면을 불러올 수 없습니다"

### 스타일 주입

`re-upstream/restored/composables/useRemoteStyles.js` `T({ styleAttribute, getBaseUrl, hrefPolicy })`를 씁니다.

- `<link rel=stylesheet>`를 `<head>`에 넣습니다. 참조 카운트로 관리합니다
- 기본 정책은 `${base}/style.css` 한 개입니다
- `ensure(true)`를 부르면 기존 링크를 지우고 `?t=` 캐시 버스터를 붙여 다시 넣습니다
- 링크 로드에 실패하면 500ms, 1000ms 백오프로 최대 2번 재시도합니다
- `cleanup`은 카운트가 0이 되면 다음 tick에 자기 속성이 붙은 링크와 자기 href 링크를 제거합니다

| 원격 | 속성 | 정책 |
|---|---|---|
| BI | `data-bi-styles` | 기본 (`style.css`) |
| 포털 | `data-portal-styles` | 기본 |
| MEMBERS | `data-members-styles` | 원격이 스스로 넣은 `${base}/…` 링크를 정리할 때 `rememberHrefs`로 기억해 뒀다가 다음 `ensure`에서 다시 넣습니다 (`re-upstream/restored/api/MembersView/client.js`) |
| 재무 | — | 호스트가 스타일을 주입하지 않습니다 |

- KeepAlive 비활성화(`onDeactivated`) 때 스타일을 정리하고, 재활성화 때 다시 넣습니다 (BI·포털·MEMBERS)

## 경영지표 — `/analytics`, `/analytics/revenue`, `/analytics/appointment`, `/analytics/patient`, `/analytics/soo-dashboard`, `/analytics/incoming-path`, `/analytics/doctor`

- **목적:** 매출·예약·환자·수 대시보드·유입경로·진료의별 현황 BI 화면입니다. 사이드바 메뉴 id 70 "경영지표 관리"에 있습니다
- **접근 조건:**
  - **권한:** AnalyticsView (`re-upstream/restored/views/AnalyticsView.vue.js`)가 권한 로드(`DB()`)를 기다립니다. 그다음 `route.matched` 중 `permissionRequired`가 있는 모든 라우트의 `permissionCode`를 `canAccess$`로 확인합니다
    - `/analytics`와 하위 5개는 `경영지표`(`bi`)를 요구합니다
    - 실패하면 `AccessDeniedNotice` "접근 권한이 없습니다. / 대표원장에게 권한을 요청해 주세요."를 보여줍니다
  - **`/analytics/soo-dashboard`:** 자기 `permissionCode`는 없지만 부모 `analytics`가 매칭되므로 `bi`도 필요합니다. 라우터 가드는 `meta.requiredRoleType` `01`(대표원장)이 아니면 홈으로 보냅니다
  - **사이드바 노출** (`re-upstream/restored/lib/index/part-41.js` `R6`):
    - revenue·appointment·patient·incoming-path·doctor는 풀 차트(`a0`)일 때만 보입니다
    - soo-dashboard는 `soo` 연동이거나 원탕 계약만 있는 계정(`kHe`)일 때 보이고, 역할 `01`도 필요합니다
    - 메뉴 id 70은 보험 단독 또는 `members` 계정에서 숨겨집니다
  - 자세한 규칙: [access-control.md](../access-control.md)
- **화면 구성 / 원격 모듈:**
  - `AnalyticsView`는 `<RouterView>`를 `KeepAlive max=3`으로 감쌉니다
  - 각 하위 뷰는 `BiContainer`에 `component-module`만 넘기는 얇은 래퍼입니다

  | 경로 | 뷰 | `component-module` | 컨테이너 |
  |---|---|---|---|
  | `revenue` | `RevenueTableView` | `upstream-bi-frontend/RevenueTableContainer` | BiContainer-2 |
  | `appointment` | `AppointmentTableView` | `upstream-bi-frontend/AppointmentTableContainer` | BiContainer-2 |
  | `patient` | `PatientTableView` | `upstream-bi-frontend/PatientTableContainer` | BiContainer-2 |
  | `incoming-path` | `IncomingPathTableView` | `upstream-bi-frontend/IncomingPathTableContainer` | BiContainer-2 |
  | `doctor` | `DoctorTableView` | `upstream-bi-frontend/DoctorTableContainer` | BiContainer-2 |
  | `soo-dashboard` | `SooDashboardView` | `upstream-bi-frontend/SooDashboardContainer` | BiContainer |

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
  - `re-upstream/restored/router/routes.js`, `re-upstream/restored/views/AnalyticsView.vue`, `re-upstream/restored/components/bi/BiContainer.vue`, `re-upstream/restored/components/bi/BiContainer-2.vue`
  - `re-upstream/restored/views/IncomingPathTableView.vue.js`, `re-upstream/restored/views/SooDashboardView.vue.js`
  - `re-upstream/restored/modules/index/Group.js` (메뉴), `re-upstream/restored/router/guards.js`

## 재무 — `/finance`, `/finance/daily-briefing`, `/finance/expenses`, `/finance/pnl`, `/finance/budget`, `/finance/cashflow`

- **목적:** 일간 브리핑·지출내역·손익분석·예산·현금흐름 화면입니다. 메뉴 id 72 "재무"에 있습니다
- **접근 조건:**
  - `/finance`는 `finance-daily-briefing`으로 redirect합니다
  - FinanceView (`re-upstream/restored/views/FinanceView.vue.js`)가 권한 로드를 기다린 뒤 경로별 요구 권한(`Frn`, `re-upstream/restored/modules/index/part-60.js`)을 `vct`로 검사합니다. 코드 중 하나라도 허용되면 통과입니다:

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
  - 원격 `upstream-finance-frontend/./financeMount`가 그 경로로 자체 라우팅합니다 (추정. react-router HMR 흔적이 있음)
  - `FinanceView`는 KeepAlive를 쓰지 않습니다
- **호스트가 넘기는 값:**
  - `mount(el, { token, initialPath })` 후 `update({ token, initialPath })`
  - 루트 div는 `overflow-y-auto`입니다
- **데이터:** 호스트 쪽 재무 엔드포인트는 없습니다
- **근거:** `re-upstream/restored/views/FinanceView.vue`, `re-upstream/restored/components/finance/FinanceContainer.vue`, `re-upstream/restored/components/finance/FinanceContainer.helpers.js`, `re-upstream/restored/views/DailyBriefingView.vue.js`, `re-upstream/restored/views/SettingExpenseCollectionView.vue.js`, `re-upstream/restored/lib/index/part-61.js`

## MEMBERS — `/members/:pathMatch(.*)*`

- **목적:** MEMBERS 지표관리입니다. 매출·환자 수·예약·유입경로·비급여·기간별 데이터·지표 입력·회고를 다룹니다. 메뉴 id 76의 하위 메뉴는 `/members/revenue`, `patient-count`, `appointment-count`, `funnel`, `nonbene-pay-repay`, `reports`, `review`, 그리고 `/analytics/soo-dashboard`입니다
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
      | 선택한 항목의 `groupNm`이 `CLIENT`가 아님 | `unsupported` ("관리자(ADMIN) 계정은 아직 업스트림 임베드를 지원하지 않습니다.") |
      | 항목 없음, 또는 404(본문 `message`가 `Route `로 시작하는 경우 제외) | `unlinked` |
      | 그 밖의 오류 | `error` |

    - 결과는 모듈 변수에 캐시합니다. "다시 시도"를 누르면 캐시를 비웁니다
  - **`unlinked` 화면:** "멤버스 연동이 필요합니다"
    - 역할 `01`이면 "멤버스 연동하기" 버튼으로 `members-onboarding`에 갑니다
    - 아니면 대표원장에게 요청하라는 안내만 보여줍니다
  - **`/members/review*`:** `retrospective` · `metricForm` · `happyCall` 중 하나라도 있어야 합니다. 없으면 `/`로 보냅니다
    - 마운트된 뒤 이 경로에서는 `MembersRetroTermsGate`(약관 게이트)를 겹쳐 보여줍니다
- **화면 구성 / 원격 모듈:**
  - 원격 `medistream-members/./mount`를 씁니다
  - 마운트 전에 `Brn()`으로 권한 로드를 기다립니다
  - `pathMatch`가 바뀌면 `navigate(path)`를 부릅니다
- **호스트가 넘기는 값:** `default(el, { initialPath, upstream, onRequireLogin })`
  - `initialPath`: `/` + `pathMatch` 조각
  - `upstream.getAccessToken({ forceRefresh })`:
    - `forceRefresh`면 `getAuthToken$({ withRefresh: true })`
    - 아니면 localStorage의 `accessToken`
    - 둘 다 없으면 `null`
  - `upstream.memberId`, `upstream.groupNm`(`CLIENT`): 연동 조회 결과
  - `upstream.apiBaseUrl`: EMR API base URL 상수
  - `upstream.planTier`: `members` 연동이면서 풀 차트(`vnn`)이면 `"full"`, 아니면 `"lite"`
  - `upstream.permissions`: 불리언 맵
    - `retrospective`: 역할이 `01`인지
    - 나머지는 `jA(노드)`: `metricForm`(지표관리양식), `metricFormCreate`, `metricFormWrite`, `happyCall`(초진환자해피콜), `funnelChart`, `keywordTrend`, `nonbenefitChart`, `nonbenefitCategory`, `nonbenefitItemWrite`, `nonbenefitItemDelete`, `periodData`
  - `upstream.renderBiView(el, { view, extraTabs, onNavigate })`:
    - `view === "incoming-path"`이고 `funnelChart`가 있을 때만 동작합니다. 호스트가 `IncomingPathTableView`(→ BI `IncomingPathTableContainer`)를 원격이 준 `el`에 `Teleport`합니다
    - 돌려주는 값: `{ unmount, extraTabsRendered }`
    - 그 밖의 경우 `null`을 돌려줍니다
  - `onRequireLogin`: `/login`으로 이동합니다
- **데이터:** 호스트에서는 `/integrations/members/subscribers` 하나만 부릅니다. 지표 데이터는 원격이 `apiBaseUrl`과 토큰으로 직접 요청할 것으로 보입니다 (추정)
- **근거:** `re-upstream/restored/views/MembersView.vue.js`, `re-upstream/restored/api/MembersView/client.js`, `re-upstream/restored/lib/index/part-41.js`, `re-upstream/restored/lib/index/part-72.js`, `re-upstream/restored/router/guards.js`, `re-upstream/restored/components/members/MembersRetroTermsGate.vue`

## 자료·공지 포털 — `/portal`, `/library`

- **목적:** 게시판형 자료·공지입니다. 문서 제목은 "자료·공지"입니다 (`re-upstream/restored/modules/index/part-229.js`)
- **접근 조건:**
  - 둘 다 `requiresAuth`만 요구하고 권한 코드는 없습니다
  - **`/portal`:** 전역 레이아웃을 쓰고 모바일을 지원합니다(`supportsMobile`). 모바일 GNB 링크가 있습니다
  - **`/library`:** 전역 레이아웃 없는 독립 창입니다. 사이드바 "자료·공지" 링크가 `target="_blank"`로 엽니다
  - 노출 플래그 `iue`는 항상 `true`입니다
- **화면 구성 / 원격 모듈:**
  - 두 화면 모두 `PortalContainer`에 `component-module="upstream-emr-portal/SooPortalContainer"`를 넘깁니다
  - 하지만 컨테이너는 이 prop을 쓰지 않고 항상 `./sooPortalMount`를 로드합니다
  - **`SooView`:** `owner-route-name="portal"`만 넘깁니다
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
    - `onTrack(name, params)`: `gtag` 이벤트 전송 (`re-upstream/restored/lib/PortalContainer/getBaseUrl.js` `Pe`)
      - 이벤트 이름은 `portal_[a-z0-9_]{1,33}`만 받습니다
      - 파라미터는 키 형식이 맞는 원시값만, 최대 25개, 문자열은 100자로 자릅니다
  - 쿼리 동기화는 현재 라우트 이름이 `ownerRouteName`일 때만 합니다
  - **`embedded` 모드** (챌린지 교육자료):
    - `pageId`는 32자리 hex만 받습니다
    - board/post는 쿼리 대신 내부 ref에 둡니다
- **데이터:** 호스트 쪽 포털 엔드포인트는 없습니다. 사이드바 배너용 `portalClient`(`getV1Banners`)는 이 화면과 별개입니다
- **근거:** `re-upstream/restored/views/SooView.vue.js`, `re-upstream/restored/views/LibraryWindowView.vue.js`, `re-upstream/restored/components/portal/PortalContainer.vue`, `re-upstream/restored/components/portal/PortalContainer.vue.js`, `re-upstream/restored/components/sidebar/SidebarNav.vue.js`

## 챌린지 — `/challenge`

- **목적:** 수련(surachal) 코호트 참여자용 화면입니다. 탭은 교육자료 · 과제 제출 · 리더보드이고, 메뉴 id 95 "챌린지"에 있습니다
- **접근 조건:**
  - 라우터 가드가 `HQt`(토큰별 캐시)로 다음을 부릅니다:
    1. `GET /api/surachal/cohort`
    2. `GET /api/surachal/me?cohort_no=`
  - `access.menu === true`일 때만 들어갈 수 있고, 아니면 홈으로 보냅니다. 404이면 접근 없음으로 캐시합니다 (`re-upstream/restored/lib/index/part-261.js`)
  - 탭 노출은 `access.educationLinks` / `dashboard` / `leaderboard`가 `true`인지로 정합니다 (`Ce`)
- **화면 구성 / 원격 모듈:**
  - 현재 탭은 쿼리 `tab`(`materials` | `taskSubmission` | `leaderboard`)입니다
  - **교육자료** → `SooRisingMaterialsPane`
    - 안에서 `PortalContainer`를 embedded로 씁니다: `owner-route-name="challenge"`, 고정 `default-page-id`, 루트 id `challenge-materials-portal-root`
    - 호스트 코드로 과제 진행·제출 드로어(`SooRisingTaskSubmitDrawer`)를 둡니다
  - **과제 제출·리더보드** → `BiContainer`
    - `upstream-bi-frontend/SooRisingContainer`, 루트 id `soo-rising-bi-root`
- **호스트가 넘기는 값:**
  - BI에는 `remoteProps: { tab: "taskSubmission" | "leaderboard" }`와 `token`을 넘깁니다
  - 포털에는 위 포털 props를 넘기되 `hideNav: true`입니다
  - 교육자료로 바꿀 때만 쿼리 `pageId`를 유지합니다
- **데이터** (호스트, biClient):
  - `GET /api/surachal/cohort`, `/me`, `/progress`
  - `GET`·`POST /api/surachal/submissions`
  - 출처: [endpoints.md](../../endpoints.md)
- **근거:** `re-upstream/restored/views/ChallengeView.vue.js`, `re-upstream/restored/components/soo/SooRisingMaterialsPane.vue.js`, `re-upstream/restored/modules/ChallengeView/UniqueKey.js`, `re-upstream/restored/modules/index/useApiSurachalCohortQuery.js`, `re-upstream/restored/router/guards.js`

## 자리표시·개발용 — `/message`, `/help`, `/preview`

- **목적:**
  - `/message`, `/help`: 문구 한 줄("문자 발송", "도움말 페이지")만 렌더하는 자리표시 컴포넌트입니다
  - `/preview` (`component-preview`): `ComponentPreview`가 Base* 컴포넌트(버튼·입력·모달·탭·사이드패널·`CrmKakaoBrandMessageEditor` 등)의 예시를 늘어놓는 개발용 카탈로그입니다
- **접근 조건:** 셋 다 `requiresAuth`만 요구하고 권한 코드는 없습니다. `/preview`는 전역 레이아웃을 씁니다
- **화면 구성 / 원격 모듈:** 원격 앱은 없습니다
- **호스트가 넘기는 값:** 없음
- **데이터:** API 호출은 보이지 않습니다
- **근거:** `re-upstream/restored/modules/MessageView.js`, `re-upstream/restored/modules/HelpView.js`, `re-upstream/restored/components/component/ComponentPreview.vue.js`

## 미확인·추정

- 원격 4개(BI·재무·포털·MEMBERS)의 내부 화면, 데이터 호출, 권한 처리는 이 번들에 없어 확인할 수 없습니다. `IncomingPathTableContainer`가 `onOpenPatientDetail` 등에 넘기는 인자 형태도 모릅니다
- 호스트 쪽 이름 규칙(`__federation_shared_*`, `_virtual___federation__`)으로 보아 원격이 Vite federation으로 빌드됐다고 추정합니다. BI·포털의 캐시 무효화 코드에는 webpack 캐시를 지우는 분기도 함께 있습니다
- `BiContainer`의 fallback 경로는 remoteEntry를 다시 로드한 뒤 같은 모듈 맵을 다시 읽습니다. 맵 값은 모듈 최상위 `await`에서 이미 정해진 것이라, 재시도로 다른 모듈을 얻지는 못할 것으로 보입니다 (추정)
- 재무 재시도는 빈 공유 스코프 `init({})`를 씁니다. 이 경우 원격이 호스트의 vue/react 대신 자기 사본을 쓸 수 있습니다 (추정)
- `SooDashboardView`는 `bi` 권한과 역할 `01`을 모두 요구합니다. 사이드바는 `soo`/원탕 조건과 역할만 봅니다. 그래서 `bi`가 없는 대표원장에게는 메뉴가 보이지만 화면에서는 접근 거부가 나올 수 있습니다 (추정)
- `/message`, `/help`로 가는 링크는 확인하지 못했습니다. 실제 기능 화면(문자 발송은 `/crm/message` 등)과는 별개의 잔존 라우트로 보입니다 (추정)
- `remoteEntryReloadCount`는 3회 초과 때만 지워집니다. 세션 중에 토큰 만료로 인한 새로고침이 여러 번 쌓이면 이른 시점에 `/login`으로 보낼 수 있습니다 (추정)
