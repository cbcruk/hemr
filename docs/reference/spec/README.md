# Upstream EMR 웹 클라이언트 스펙

Upstream EMR(`https://upstream.co.kr`) 프로덕션 번들에서 복원한 코드(`restored/`)를 읽고 정리한 기능 스펙입니다. 한의원용 EMR로, 원무·진료·예약·탕전·청구·CRM·설정을 하나의 Vue 앱이 제공하고, 경영지표·재무·포털은 원격 앱으로 붙습니다.

- **근거:** 모든 내용은 정적 분석 결과입니다. API를 실제로 호출해 확인하지 않았습니다. 각 문서의 **근거** 링크가 복원 코드를 가리킵니다
- **확실성:** 코드에서 직접 확인한 동작만 적었고, 추정은 "(추정)"으로 표시했습니다. 이름 끝의 `$`는 복원 과정에서 추정한 식별자입니다 ([restored/README.md](../../restored/README.md))
- **기준 번들:** 메인 엔트리 `index-CBEIvlV0.js` (Vue 3.5.35)

## 문서

| 문서 | 범위 | 주요 라우트 |
|---|---|---|
| [account-onboarding.md](account-onboarding.md) | 로그인·잠금 해제·가입(수/원탕)·온보딩·약관·로그아웃 | `/login`, `/sign-up/*`, `/onboarding`, `/terms/*` |
| [desk.md](desk.md) | 원무: 접수·대기·수납·환자 등록·서류 | `/desk` |
| [treatment.md](treatment.md) | 진료기록·처방·치료실·태블릿·캔버스 | `/treatment`, `/treatment-rooms`, `/tablet/*`, `/canvas` |
| [appointment.md](appointment.md) | 예약 플래너·예약 설정·진료 스케줄·휴일 | `/appointment-planner`, `/setting/appointment`, `/setting/schedule` |
| [ocs.md](ocs.md) | 탕전관리·탕전 처방·메디원탕 주문 | `/ocs`, `/ocs/prescription/*`, `/ocs-v2-herb-order-*` |
| [crm.md](crm.md) | 비급여 환자·연락목록·메시지·전송이력·수신거부·상담 스크립트 | `/crm/*`, CRM 설정 |
| [claim.md](claim.md) | 심평원 청구·추나첩약 제출·의료급여·방문·연말정산·보험 조회·전자서명 | `/claim/*`, `/insurance-inquiry`, `/electronic-signature` |
| [settings.md](settings.md) | 기본·병원·진료·처방수가·상용구·계정권한·태블릿·결제·MCP·비대면 정산 | `/setting/*`, `/remote-settlement` |
| [analytics-and-remote-apps.md](analytics-and-remote-apps.md) | 경영지표·재무·MEMBERS·포털·라이브러리·챌린지, 원격 앱 연동 | `/analytics/*`, `/finance/*`, `/members/*`, `/portal` |

같이 보면 좋은 문서:

- **[access-control.md](../access-control.md):** 접근 제어 5층 구조 (빌드 환경·인증·서비스 연동·역할·행위 권한)
- **[permissions.md](../permissions.md):** 권한 코드 65개의 사용처
- **[architecture.md](../architecture.md):** 라우트 → 화면 → 컴포넌트 → 훅 → API 지도
- **[component-api.md](../component-api.md):** 컴포넌트별 API
- **[endpoint-screens.md](../endpoint-screens.md):** 엔드포인트별 사용처
- **[endpoints.md](../../endpoints.md):** 엔드포인트 전체 목록
- **[non-axios-channels.md](../non-axios-channels.md):** fetch·소켓·로컬 알림 중재 채널

## 제품 구성

계정마다 로그인 정보의 `서비스연동` 배열로 제품 구성이 정해집니다. 자세한 규칙은 [access-control.md](../access-control.md#3-서비스-연동)에 있습니다.

| 서비스 | 의미 | 기본 홈 |
|---|---|---|
| `emr` | EMR (원무·진료·청구) | `/desk` |
| `soo` | 수 (비급여 환자 관리·CRM 중심, 라이트 차트) | `/crm/nonbenefit-patients` |
| `insurance` | 보험 조회 | `/insurance-inquiry` |
| `crm` | CRM | — |
| `members` | MEMBERS 지표관리 | `/members` |

차트 레이아웃 `full` / `light`가 EMR 전용 화면(경영지표, 진료 설정 등)을 여닫습니다.

## 백엔드

모든 HTTP 호출은 axios 인스턴스 14개로 나갑니다 ([api/clients/index.js](../../restored/api/clients/index.js) 외).

| 클라이언트 | 서버 | 용도 |
|---|---|---|
| `emrClient` | `emr-api.upstream.co.kr` | EMR 본 API (환자·접수·진료·처방·청구·설정 등, 대부분의 호출) |
| `crmClient` | `crm-api.upstream.co.kr` | CRM·메시지 |
| `authClient` | `auth-api.upstream.co.kr/api/auth` | 로그인·토큰 갱신 |
| `accountClient`, `accountApplicationClient` | `auth-api.upstream.co.kr/api` | 계정·가입 신청·사용자 |
| `insuranceClient` | `insurance-api.upstream.co.kr` | 보험 조회 |
| `syncClient` | `sync-api.upstream.co.kr/v1` | 동기화 |
| `staticClient` | `static.upstream.co.kr/upstream-emr/master` | 상병(KCD)·수가·약재 등 기준 데이터 JSON |
| `biClient`, `portalClient` | `public-api.upstream.co.kr/{bi,portal}` | 경영지표·포털 |
| `thesooClient` | `public-api.thesoo.co` | 수(thesoo) 연동 |
| `medistreamClient` | `public-api.medistream.co.kr` | 메디스트림 연동 |
| `jusoClient` | `business.juso.go.kr` | 도로명 주소 검색 |
| `webClient` | 동일 출처 | 웹 자체 경로 |

- **인증:** 로그인 정보와 토큰은 localStorage `사용자로그인정보`에 저장됩니다. 일부 클라이언트의 인터셉터가 만료 시 `POST /token/refresh`를 호출합니다
- **서버 상태:** TanStack Vue Query가 관리합니다. 기본 옵션은 `retry: false`, `gcTime: 300000`, `refetchOnWindowFocus: false` ([main.js](../../restored/main.js))
- **기준 데이터:** 상병·수가·약재 JSON은 날짜 기준 버전(예: KCD 2025-07-22 / 2026-01-01)을 골라 `staticClient`로 받고, 오래 캐시합니다

## 실시간 동기화

`useSocketClientStore`([stores/socketClient.js](../../restored/stores/socketClient.js))가 `https://socket.upstream.co.kr`에 연결합니다. 메시지의 `type`으로 구독자를 나눕니다.

| type | 반응 |
|---|---|
| `ACTION_WAITING`, `ACTION_RECEIPT` | 접수·수납·시재 쿼리 무효화 |
| `ACTION_TREATMENT`, `ACTION_RECORD` | 진료·치료실·진료기록 쿼리 무효화 |
| `ACTION_APPOINTMENT`, `ACTION_APPOINTMENT_PLANNER` | 예약 쿼리 무효화 |
| `ACTION_PATIENT_PHOTO`, `ACTION_MEMO` | 환자 사진·메모 쿼리 무효화 |
| `RECORD_LLM_COMPLETED`, `RECORD_LLM_FAILED` | AI 에이전트 대화(`AiAgentMessages`)에서 진료기록 생성 완료·실패 반영 |
| `SOO_MIGRATION_COMPLETE` | `App`에서 수 마이그레이션 오버레이 종료 처리 (추정) |

`ACTION_*` 처리는 [modules/index/part-239.js](../../restored/modules/index/part-239.js)에 모여 있습니다. 다른 PC·탭에서 바뀐 내용은 이 이벤트로 쿼리를 다시 불러와 반영합니다. 같은 PC에서 여러 탭이 동시에 알림음을 울리지 않도록, 로컬 알림 중재 서버(`127.0.0.1:4782x`)로 조정합니다 ([non-axios-channels.md](../non-axios-channels.md)).

## 앱 셸

[App.vue](../../restored/components/app/App.vue)가 모든 화면을 감쌉니다.

- **레이아웃:** 라우트 `meta.usesGlobalLayout`이 있으면 `LayoutView`(헤더 `HeaderLayout` + 사이드바 `SidebarLayout`)로 감쌉니다
  - 화면은 `KeepAlive :max="3"`으로 최근 3개까지 유지합니다. `CanvasView`, `ElectronicSignatureView`, `OndangGateView`는 제외합니다
- **세션 감지:** 다른 창에서 다른 계정으로 로그인하거나 로그아웃하면, 전체 화면 경고와 함께 새로고침을 요구합니다
  - 경고 문구: "저장하지 않은 처방·메모는 유실될 수 있습니다"
- **전역 요소:**
  - AI 에이전트 트리거(`AiAgentTrigger`): 수 연동 + 차트 사용자일 때
  - 문진 링크 발송 모달(`GlobalIntakeLinkSendModal`)
  - 근무형태 입력 요구 모달(`AccountWorkTypeRequiredModal`)
  - 수 마이그레이션 오버레이(`SooMigrationOverlay`)
  - 온보딩 가이드 패널
  - 비밀번호 재설정 안내
  - 단축키 힌트 오버레이(`v-shortcut-hint` 디렉티브)
- **모바일:** 라우트 `meta.supportsMobile`이 있는 화면만 모바일을 지원합니다 (`/portal`, `/members/*` 등)
- **개인정보 접근 기록:** 라우트 `meta.personalInfoKoPageName`(예: "원무", "진료", "치료실", "플래너")이 화면별 개인정보 열람 표기에 쓰입니다 (추정)

## 기술 스택

- **프레임워크:** Vue 3.5 `<script setup>`, vue-router, Pinia, TanStack Vue Query
- **UI·편집:** radix-vue, ag-grid, tiptap(에디터), Konva(캔버스), vue-tippy, OverlayScrollbars, vuedraggable
- **폼·유틸:** vee-validate + yup, date-fns, lodash, SheetJS(엑셀), FileSaver, pdf.js worker
- **통신:** axios, socket.io-client
- **원격 앱:** Module Federation (`@originjs/vite-plugin-federation`)
  - `vue`/`react`/`react-dom`을 공유합니다
  - 원격은 `upstream-bi-frontend`, `upstream-finance-frontend`, `upstream-emr-portal`, `medistream-members` 4개입니다 ([analytics-and-remote-apps.md](analytics-and-remote-apps.md))
- **오류 수집:** Sentry
- **배포 형태:** Electron 셸 연동 흔적이 있습니다 (`window.electronAPI`)

## 용어

| 용어 | 뜻 |
|---|---|
| 원무 | 접수·수납 등 데스크 업무 |
| 접수 / 대기 | 내원 환자를 진료 대기열에 올리는 것 |
| 수납 | 진료비 결제 처리. 본인부담금과 비급여를 포함 |
| 진료기록 | 차트. 상병(KCD) + 기록 본문 + 처방 |
| 첩약 / 추나 / 약침 | 한의 처치 항목. 첩약·추나는 건강보험 시범·급여 항목이 있습니다 |
| 탕전 | 한약을 달이는 조제. 탕전실(원외)에 주문을 보냅니다 |
| 원탕 / 메디원탕 | 원외 탕전 서비스 연동 |
| 청구 | 심평원(HIRA) 요양급여비용 청구 |
| 의료급여 | 의료급여 수급자 진료 승인 |
| 자보 / 산재 | 자동차보험 / 산업재해 진료 |
| 요양기관기호 | 의료기관 식별 번호 |
| 수 (soo, thesoo) | 비급여·CRM 중심 라이트 서비스 |
| MEMBERS | 경영지표 서비스 (원격 앱) |

## 코드에서 확인된 주의점

각 문서의 **미확인·추정** 절에서, 동작에 영향이 있는 것만 모았습니다.

| 영역 | 내용 | 문서 |
|---|---|---|
| 접근 제어 | EMR 전용 가드 목록에는 `claim-year-settlement`가 있지만 실제 라우트 이름은 `year-settlement`입니다. 그래서 연말정산은 EMR이 아닌 계정에서도 리다이렉트되지 않습니다 | [claim.md](claim.md) |
| 접근 제어 | `crm-nonbenefit-patients`에는 `meta`가 없어 화면 권한 검사를 건너뜁니다 (부모 `/crm`의 `고객관리` 권한만 봅니다) | [crm.md](crm.md) |
| 접근 제어 | 사이드바는 설정 하위 메뉴를 권한으로 거르지 않습니다. 메뉴는 보이고, 눌렀을 때 `SettingView`가 막습니다 | [settings.md](settings.md) |
| 접근 제어 | `/analytics/soo-dashboard`는 화면에서 `bi` 권한과 역할 `01`을 함께 요구하지만, 사이드바는 `bi`를 보지 않습니다 (추정) | [analytics-and-remote-apps.md](analytics-and-remote-apps.md) |
| 접근 제어 | `/treatment/repeat-results`, `/canvas`에는 `requiresAuth`가 없습니다 | [treatment.md](treatment.md) |
| 미완성 | `/setting/account-history`는 하드코딩된 샘플 행만 보여 주는 목업입니다 | [settings.md](settings.md) |
| 미완성 | `/sign-up/*/complete`로 이동하는 코드가 없습니다 | [account-onboarding.md](account-onboarding.md) |
| 미완성 | 청구필요 탭의 다중 선택 전송은 `console.info`만 남깁니다 (추정) | [claim.md](claim.md) |
| 원무 | `수납완료` 컬럼은 `대기`에서 드래그한 카드를 받지만 처리하는 분기가 없습니다. 예약 카드는 더 늦은 시간대로만 옮겨집니다 | [desk.md](desk.md) |
| 인증 | 로그인 정보가 비어 있으면 응답 인터셉터가 아무것도 돌려주지 않아, 실패한 요청이 `undefined`로 끝납니다 | [account-onboarding.md](account-onboarding.md) |
| 청구 | 심평원 사전점검·전송·심사결과 수신은 데스크톱 앱(`window.electronAPI.hiraDdmdProxy`)으로만 동작합니다 | [claim.md](claim.md) |
