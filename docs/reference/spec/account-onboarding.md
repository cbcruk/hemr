# 계정·인증·온보딩

아이디·비밀번호 로그인, 통합 계정(네이버) SSO 콜백, 계정 잠금 해제, 신규 가입(현행 차트 계정 신청 / 차트 라이트 / 외부원탕), 약관 열람, 로그아웃을 다룹니다.
로그인 상태는 localStorage `사용자로그인정보`(`userAuthData`) 하나로 판단하고, 만료된 토큰은 axios 응답 인터셉터가 `POST authClient /token/refresh`로 갱신합니다.
가입 단계에서는 로그인 토큰 대신 SSO에서 받은 **가입 신청 토큰**을 `accountApplicationClient`의 기본 `Authorization` 헤더로 씁니다.

## 공통: 인증 상태와 라우터 가드

| 항목 | 내용 |
|---|---|
| 로그인 판정 | `JSON.parse(localStorage.userAuthData).accessToken`이 있으면 로그인 상태 |
| 저장 내용 | 로그인 응답(`accessToken`, `refreshToken`, `sub` 등) + `GET emrClient /auth/me`의 `서비스연동`, `역할타입`, `chartLayout`(←`차트레이아웃`), `요양기관기호`, `멤버스허용권한코드`(←`권한목록`) |
| 마지막 로그인 타입 | localStorage `lastLoginType` (`bt.마지막로그인타입`): `emr` / `lite` / `insurance` / `ondang` / `members` |
| 로그인 이벤트 | 세션을 저장한 쪽이 `window`에 `auth:login`을 보냄 → `App`이 소켓 재연결·쿼리 재조회 등 (추정) |

가드(`restored/router/guards.js`)에서 이 영역과 관계된 규칙:

- `meta.requiresAuth` 라우트에 토큰 없이 들어오면 `?redirect=<fullPath>`를 붙여 로그인으로 보냅니다. `lastLoginType === "lite"`면 `lite-login`, 아니면 `auth-login`인데, `lite-login`(`/login/lite`)은 `auth-login`으로 redirect만 하는 라우트입니다
- 로그인한 상태로 `auth-login`·`lite-login`·`auth-unlock`에 오면 계정 홈(`kL(서비스연동, …, { chartLayout })`)으로 보냅니다
- `/auth/callback`, `/onboarding`, `/sign-up/*`, `/terms/*`에는 meta가 없습니다. 로그인 여부와 상관없이 열립니다
- 이 영역에서 `meta.requiresAuth`가 붙은 라우트는 `/logout` 하나입니다

## 로그인 — `/login` (`auth-login`), `/login/lite` (`lite-login`)

- **목적:** 아이디·비밀번호로 로그인하거나 통합 계정 SSO로 들어가는 진입 화면입니다
- **접근 조건:** 공개. 이미 로그인했으면 가드가 홈으로 보냅니다. `/login/lite`는 `/login`으로 redirect합니다
- **화면 구성:** 로고, "로그인" 카드(`BaseTextInput` 아이디 "영문, 숫자, 한글 가능" / 비밀번호 + 표시 토글 `BaseTextInputButtonModule`), 오류 문구, 잠금 해제 버튼(조건부), "로그인" 버튼, `ContentDivider` "대표 원장님이라면", "통합 계정으로 시작하기"(네이버 녹색 버튼), "다른 네이버 계정으로 가입하기" 링크
- **동작:**
  - 브라우저 자동완성 감지: 마운트 후 100/500/1000ms에 `input:-webkit-autofill`을 확인합니다. 감지되면 값이 비어 보여도 버튼을 켜고, 제출 직전에 `input` 이벤트를 다시 보내 값을 동기화합니다
  - 제출 → 값이 비어 있으면 "아이디, 비밀번호를 입력해주세요." → `POST authClient /login` `{ 아이디, 비밀번호 }`
  - 성공 → `setupLoginSession(result, "emr")`
    1. 로그인 결과를 `userAuthData`에 저장합니다
    2. `GET emrClient /auth/me`로 받은 값을 합쳐 다시 저장합니다
    3. `lastLoginType`을 기록합니다. `서비스연동`이 `["insurance"]` 하나뿐이면 `insurance`, 아니면 `emr`입니다
    4. `auth:login`을 보내고 `deskDate` 스토어를 초기화합니다
  - 성공 후 이동:
    - `?redirect`가 동기화 사이트 출처이면: `POST authClient /sso/link-token` `{ refreshToken, sub }`로 받은 `linkToken`을 붙여 해당 사이트 `/auth/link?token=`으로 이동합니다. 실패하면 그 사이트 첫 화면으로 갑니다
    - `?redirect`가 `/`로 시작하면 그 경로로 갑니다
    - 그 밖에는 계정 홈으로 갑니다
  - 실패: 응답 `code`에 따라 표시합니다
    - `AE_AUTH_ACCOUNT_NOT_FOUND`: 아이디 칸에 "아이디가 존재하지 않습니다."
    - `AE_AUTH_PASSWORD_MISMATCH`: 비밀번호 칸에 "비밀번호가 일치하지 않습니다."
    - `AE_AUTH_ACCOUNT_LOCKED`: 5회 실패로 잠겼다는 안내와 "휴대폰 본인인증으로 잠금 해제" 버튼을 보여 줍니다. 버튼은 `auth-unlock`으로 이동하며, 입력한 아이디를 `?id=`로 넘깁니다
    - 그 밖: "로그인에 실패했습니다."
  - "통합 계정으로 시작하기" → 통합 계정 인증 서버 `/login?client_id=…&redirect_uri=<origin>/auth/callback&response_type=code`로 이동합니다(`navigation: "push"`)
  - "다른 네이버 계정으로 가입하기" → 통합 계정 `/logout`을 거쳐 같은 로그인 URL(`refer=logout`)로 이동합니다
- **데이터:** `POST /login` 응답 `results`(토큰 묶음), `GET /auth/me` → `me.서비스연동`, `me.역할타입`, `me.차트레이아웃`, `me.요양기관기호`, `me.권한목록`
- **상태 저장:** `userAuthData`, `lastLoginType`
- **근거:** `restored/views/LoginView.vue`, `restored/views/LoginView.vue.js`, setupLoginSession (part-231.js) (`restored/modules/index/part-231.js`), `restored/modules/partnerAuthToken.js`, `restored/api/sso/requests.js`, `restored/modules/constants.js`

## 계정 잠금 해제 — `/login/unlock` (`auth-unlock`)

- **목적:** 비밀번호를 5회 연속 틀려 잠긴 계정을, 명의자의 휴대폰 본인인증(KCB)으로 풉니다
- **접근 조건:** 공개. 로그인한 상태면 홈으로 보냅니다
- **화면 구성:**
  - 입력 단계: "계정 잠금 해제" 제목·설명, 아이디 입력(`?id`가 있으면 채운 채 잠금), "휴대폰 본인인증으로 잠금 해제" 버튼, 안내 "본인인증으로 해제할 수 없는 계정은 대표원장에게 잠금 해제를 요청해주세요.", "로그인으로 돌아가기"
  - 본인인증 모달 `AccountUnlockIdentityVerificationModal`
    1. 통신사 선택 + 약관 동의 (`CrmCommonStepSelectTelecom` 계열)
    2. `AccountUnlockStepPhoneVerification`: 이름, 생년월일 6자리 + 주민번호 뒷자리 첫 자리, 휴대폰 번호, 인증번호
  - 완료 단계: "잠금을 해제했습니다" / "비밀번호는 바뀌지 않았습니다. 다시 로그인해주세요." / "로그인하러 가기"
- **동작:**
  - 인증번호 요청 → `POST authClient /unlock/request-otp` `{ 아이디, 이름, 생년월일, 주민등록번호뒷자리첫자리, 통신사, 휴대폰번호, 재발송인증거래번호? }`
    - 응답 `인증거래번호`를 보관하고 180초 타이머를 시작합니다. 재발송 한도는 3회입니다
  - 확인 → `POST authClient /unlock/confirm-otp` `{ 아이디, 인증거래번호, 휴대폰번호, 인증번호 }` → 성공하면 완료 단계로 바뀝니다
  - 오류 분류 (`restored/modules/AccountUnlockView/message.js`):

    | 분류 | 조건 | 처리 |
    |---|---|---|
    | `계정없음` · `잠기지않음` · `해제불가` | 코드 `AE_AUTH_ACCOUNT_NOT_FOUND`이거나 해당 메시지 | 모달을 닫고 아이디 칸에 오류 표시 |
    | `재입력` | `reasonCode` `OTP_MISMATCH` | 인증번호 칸에 오류 |
    | `신원재확인` | `IDENTITY_MISMATCH` | 메시지 표시 |
    | `처음부터` | `OTP_ATTEMPT_EXCEEDED`, `INVALID_TX_SEQ`, `RESEND_LIMIT_EXCEEDED`, `RESEND_TIMEOUT`, `SMS_SEND_FAILED` | 인증 상태 초기화 |
    | `기타` | `UNKNOWN` 등 | 서버 `reason`이나 기본 문구 |

  - 진행 중에 닫으면 "본인인증을 취소하시겠습니까?" 확인 창을 띄웁니다. 인증번호를 이미 받았으면 만료 안내를 덧붙입니다
- **데이터:** 위 두 엔드포인트. 응답은 `data.results`
- **상태 저장:** 컴포넌트 로컬 상태만 씁니다
- **근거:** `restored/views/AccountUnlockView.vue`, `restored/components/account/AccountUnlockStepPhoneVerification.vue.js`, `restored/components/account/AccountUnlockIdentityVerificationModal.vue.js`, `restored/api/unlock/requests.js`

## SSO 콜백 — `/auth/callback` (`auth-callback`)

- **목적:** 통합 계정 OAuth `code`를 받아 기존 회원이면 로그인시키고, 신규면 가입 흐름으로 보냅니다
- **접근 조건:** 공개
- **화면 구성:** `AccountApplicationsLayout` 안의 `PartnerAuth`(스피너만 표시). `onBeforeMount`에서 `?code`, `?refresh_token`을 읽어 `partner-verified`를 emit합니다
- **동작:** `?state` 값에 따라 세 갈래로 나뉩니다. 모두 먼저 `POST authClient /sso/partner/token` `{ code }`를 호출합니다
  - **기본(`state` 없음, 현행 차트):**
    - 결과가 있으면 기존 회원입니다. 세션을 저장하고 `lastLoginType=emr`, `home`으로 갑니다
    - 오류 응답의 `data.sso_token`이 있으면 신규입니다
      1. `POST accountApplicationClient /account-application/token` `{ sso_token }` → `token`을 `accountApplicationClient` 기본 헤더와 `useAccountApplicationsAuthStore.accountApplicationsToken`에 넣습니다
      2. `GET /auth/check-ssoid`를 호출합니다. 403만 오류로 봅니다
      3. `auth-onboarding`으로 갑니다
    - 오류별 안내:

      | 응답 | 안내 | 다음 |
      |---|---|---|
      | 400 | "한의사로 인증된 통합 계정이 필요합니다" | "통합 계정 바로가기"를 고르면 통합 계정 사이트, 아니면 로그인 |
      | 409 | "이미 현행 차트에 가입된 계정입니다." | 로그인 |
      | 403 | "회원가입에 실패했습니다." | 로그인 |
      | 500 | "가입 중 오류" | 로그인 |
      | 그 밖의 예외 | — | 통합 계정 로그아웃 → 로그인 |

  - **`state=lite` (차트 라이트):**
    - 기존 회원이면 `lastLoginType=lite`로 저장하고 `crm-nonbenefit-patients`(없으면 `home`)로 갑니다
    - 404/401이면 `sso_token`으로 가입 신청 토큰을 받아 `useLiteSignUpStore.authToken`에 넣습니다
    - `GET /auth/check-ssoid`의 `available`이 false면 "이미 회원가입이 되어 있습니다."
      - "다른 계정으로 로그인"을 고르면 통합 계정 로그아웃을 거칩니다
      - 어느 쪽이든 마지막에는 `lite-login`으로 갑니다
    - `GET /integrations/onboarding/lite/profile`(404면 `null`) → `liteProfile`
    - 프로필이 없고 `실손여부`도 아니면 "차트 라이트를 사용하려면 라이트 멤버스에 가입해주세요." 창을 띄웁니다. 확인하면 라이트 멤버스 센터, 아니면 `lite-login`
    - `GET /integrations/lite`
      - `linked`면 `auth-login`
      - 아니면 `flowType`을 정해 `lite-sign-up-form?flowType=…`로 갑니다. 토큰 교환에서 404/401이 나온 경우 `signup`, 그 밖에는 `link`입니다
    - 오류: 409 "이미 라이트 서비스에 연동된 계정입니다.", 401 "인증이 만료되었습니다.", 403 "회원가입에 실패했습니다.", 그 밖 "라이트 서비스 연동 중 오류"
  - **`state=members`:**
    - 기존 회원이면 세션을 저장합니다
    - `GET accountApplicationClient /integrations/members`로 연동 상태를 확인합니다. 실패하면 확인 창을 띄우고 최대 2회 다시 시도합니다
    - 결과별 이동:
      - `unlinked`: `members-sign-up-form?flowType=link`
      - `exhausted`: 안내 창을 띄운 뒤 홈
      - 그 밖: 홈
    - 신규면 `useMembersSignUpStore.authToken`을 설정하고 `members-sign-up-form`으로 갑니다. 이후 화면은 MEMBERS 문서 범위입니다
- **데이터:**
  - `POST /sso/partner/token` → 토큰 묶음, 또는 오류의 `response.data.data.sso_token`
  - `POST /account-application/token` → `token`
  - `GET /auth/check-ssoid` → `available`, `원탕계약가입여부`
  - `GET /integrations/lite` → `linked`
- **상태 저장:** `accountApplicationsAuth`(메모리), `liteSignUp`·`membersSignUp`(sessionStorage persist), `userAuthData`, `lastLoginType`
- **근거:** `restored/components/account/AccountApplicationsAuth.vue.js`, `restored/components/partner/PartnerAuth.vue.js`, `restored/modules/AccountApplicationsAuth/INTEGRATIONS_MEMBERS_PATH.js`, `restored/stores/membersSignUp.js`, `restored/api/integrations/liteSignUp.js`

## 온보딩(계정 신청) — `/onboarding` (`auth-onboarding`)

- **목적:** 신규 사용자가 가입할 차트를 고르고, 현행 차트(청구용) 계정을 신청한 뒤 승인 상태를 확인합니다
- **접근 조건:** 라우트는 공개입니다. `AccountApplicationsAuthGuard`가 `accountApplicationsToken`이 없으면 내용을 숨기고 통합 계정 로그인으로 보냅니다. 이 스토어는 persist하지 않아 새로고침하면 SSO를 다시 거칩니다
- **화면 구성:** `AccountApplicationsLayout` 안에서 단계(`e`)에 따라 컴포넌트를 바꿉니다

  | 단계 | 컴포넌트 | 내용 |
  |---|---|---|
  | `Step계산중` | 스피너 | 신청 조회 중 |
  | `차트선택` | `AccountApplicationsStepSelectChart` | "가입할 차트를 선택해주세요." 차트 라이트 / 차트 라이트 실손 / 현행 차트 / 외부원탕, "로그인 페이지로 돌아가기" |
  | `차트사용여부확인` | `AccountApplicationsStepIsHasUsedChart` | "현재 사용 중인 차트가 있으신가요?" 예/아니오/이전 |
  | `계정신청폼` | `AccountApplicationsForm` | 4단계 폼 (`StepProgress`). 차트가 없으면 3단계 |
  | `신청완료` | `AccountApplicationsRequested` | 계정·대표자·한의원·차트 정보 요약, 섹션별 "수정", "신청 취소" |
  | `승인대기` | `AccountApplicationWaiting` | "계정 승인 대기 중입니다.", "회원가입 신청 취소", "로그인 페이지로 돌아가기" |
  | `반려` | `AccountApplicationsRejected` | "제출 서류 보완이 필요합니다." `보완요청사항`, 사업자등록증 재업로드, 추가 요청 사항, "다시 제출하기", "회원가입 신청 취소" |

- **동작:**
  - 진입하면 `GET accountApplicationClient /account-application/applications`를 호출합니다
    - 결과가 있으면 `상태 === "rejected"`일 때 `반려`, 그 밖에는 `승인대기`입니다
    - 결과가 없으면 `차트선택`입니다
    - `사용중인차트여부`로 차트 단계를 넣을지 정합니다
  - 차트 선택:
    - 차트 라이트 / 실손 → `liteSignUp.from = "auth-onboarding"`, `실손여부`를 false/true로 정하고 통합 계정 로그인(`state=lite`)으로 갑니다
    - 현행 차트 → `차트사용여부확인`
    - 외부원탕 → `ondang-sign-up`. `GET /auth/check-ssoid`가 `원탕계약가입여부 && available`일 때만 켜집니다. 부제는 상태에 따라 "이미 가입된 계정입니다…" 또는 "공동이용계약을 먼저 완료해주세요"로 바뀝니다
  - 계정 신청 폼 (vee-validate + yup, `restored/views/OnboardingView.helpers.js`):

    | 단계 | 필드 | 주요 검증 |
    |---|---|---|
    | 0 계정 (`accountInfo`) | `아이디`, `비밀번호`, `비밀번호확인`, 약관 동의 | 비밀번호 일치, 필수 약관 전체 동의 → `개인정보수집동의`. "다음"을 누르면 `POST /auth/check-username-onboarding` `{ 아이디 }` → `available` false면 "이미 사용 중인 아이디입니다." |
    | 1 대표자 (`doctorInfo`) | `대표자명`, `휴대폰번호`, `주민등록번호앞자리`/`뒷자리`, `면허번호`, `진료과목`, `근무형태`, `추나요법교육여부` | 휴대폰 11자리, 주민번호 6+7자리, 면허번호 5자리 |
    | 2 한의원 (`hospitalInfo`) | `병원명`, `사업자등록번호`, `사업자등록증사본`, `요양기관기호` / `요양기관기호없음` | 요양기관기호 8자리(없음 체크 시 면제). 사업자등록증은 pdf·jpg·png·doc, 최대 20MB |
    | 3 차트 (`usedChart`) | `차트종류[]`, `추가요청사항` | 사용 중인 차트가 있을 때만, 1개 이상 |

    - 약관 목록: `GET /terms?type=signup` → `terms[]`(`documentNumber`, `name`, `required`). 항목마다 "(필수)/(선택)"을 붙이고, 화살표를 누르면 새 탭에 `terms-content`를 엽니다
    - 파일 업로드:
      1. `POST /account-application/images` `{ 이미지명, 이미지사이즈 }` → `signedUrl`, `이미지경로`
      2. `fetch(signedUrl, { method: "PUT" })`로 파일을 직접 올립니다
      3. `이미지경로`를 `사업자등록증사본`에 넣습니다
    - 마지막 단계 "승인 요청":
      - 신규면 `POST /account-application/applications`, 기존 신청을 수정하면 `PUT /account-application/applications`
      - 본문: `{ 계정정보{아이디,비밀번호}, 사업자정보{…, 주민등록번호(앞+뒤), 요양기관기호("" if 없음)}, 차트정보?, 약관동의목록[{약관문서번호, 동의여부}] }`
      - 403이면 "회원가입에 실패했습니다. 고객센터…"를 띄웁니다
      - 성공하면 `신청완료`로 바뀝니다
  - `신청완료`의 "수정" → 해당 폼 단계(1/2/3)로 돌아가 `PUT`으로 다시 제출합니다
  - 신청 취소 (`승인대기`·`신청완료`·`반려` 공통):
    1. 신청을 다시 조회해 `상태 === "approved"`면 "계정 승인이 완료되어 취소할 수 없습니다."를 띄우고 로그인으로 갑니다
    2. 아니면 "계정 신청을 취소하시겠습니까?" 확인 창을 띄웁니다
    3. 확인하면 `PUT /account-application/applications/cancel` → 토큰을 비우고 "계정 신청을 취소했습니다." → `auth-login`
  - 반려 보완 → 같은 업로드 절차 후 `PUT /account-application/applications/supplement` `{ 사업자정보{사업자등록증사본}, 차트정보?{추가요청사항} }` → "서류를 다시 제출했습니다."
  - `신청완료` 요약의 사업자등록증 첨부: `GET /account-application/business-license` → `사업자등록증사본파일명`, `signedUrl` (추정: `useAccountApplicationBusinessLicenseQuery` 사용)
- **데이터:** `GET /account-application/applications` → `results`(`상태`: `rejected`/`approved`/그 밖, `사용중인차트여부`, `보완요청사항`, `병원명`, `사업자등록번호`, `요양기관기호`, `차트종류` …)
- **상태 저장:**
  - query key `["accountApplications","application" | "businessLicense" | "terms"]`. 신청 계열 뮤테이션이 성공하면 `application`·`businessLicense`를 무효화합니다
  - `accountApplicationsAuth.accountApplicationsToken`
- **근거:** `restored/views/OnboardingView.vue`, `restored/views/OnboardingView.vue.js`, `restored/components/account/AccountApplicationsForm.vue.js`, `restored/components/account/AccountApplicationsFormTermsAgreement.vue.js`, `restored/components/account/AccountApplicationsFormHospitalInfo.vue.js`, `restored/components/account/AccountApplicationsRejected.vue.js`, `restored/components/account/AccountApplicationsStepSelectChart.vue.js`, `restored/modules/OnboardingView/prefetchAccountApplicationApplicationsQuery.js`, `restored/api/accountApplications/client.js`, `restored/api/account-applications/query-keys.js`

## 차트 라이트 가입 — `/sign-up/lite` (`lite-sign-up`), `/sign-up/lite/form` (`lite-sign-up-form`)

- **목적:** 라이트 멤버스 회원이 차트 라이트(비급여 차트) 계정을 만들거나, 기존 현행 계정에 라이트 서비스를 연동합니다. 차트 라이트 실손은 실손 조회 계정을 만듭니다
- **접근 조건:** 공개
  - `/sign-up/lite`는 진입 즉시 `실손여부=false`로 정하고 통합 계정 로그인(`state=lite`)으로 보냅니다
  - 폼은 콜백이 넣어 둔 `liteSignUp.authToken`을 `accountApplicationClient` 헤더로 씁니다
- **화면 구성:**
  - `LiteSignUpFormView`는 어댑터(`wu()`)를 붙인 공용 `ServiceSignUpFormView`입니다. 레이아웃은 `ServiceSignUpLayout`(단계 표시, 이전/다음)입니다
  - 단계 구성 (`flowType`은 `?flowType` > 스토어 > `signup`):

    | 경우 | 단계 |
    |---|---|
    | `link` | `3A` → `3B` |
    | 라이트 프로필 있음 | `confirm` → `3B` (→ 직원 계정이 있으면 `3C`) |
    | 프로필 없음 | `1` → `2` → `3A` → `3B` (→ `3C`) |

  - 단계별 내용:
    - `1` `ServiceSignUpStep1`: 대표 원장명, 휴대폰 번호
    - `2` `ServiceSignUpStep2`: 상호, 사업자등록번호, 요양기관 기호(8자리, "아직 없습니다" 체크), 주소(`SearchAddress`), 한의원 전화번호
    - `3A` `LiteSignUpStep3A`: 제공 서비스 소개. 버튼 문구는 "현행 차트 계정 생성"이고, `link`면 "라이트 서비스 연동하기"입니다
    - `3B` `ServiceSignUpStep3B`: 아이디(한글·영문·숫자 2~15자), 비밀번호/확인, 약관("필수 약관 모두 동의", 전문 보기)
    - `3C` `ServiceSignUpStepStaff`: 라이트 멤버스 센터에서 쓰던 직원 계정 이관. 실손이 아니고 `signup`일 때만 나옵니다
    - `confirm` `ServiceSignUpStepConfirm`: 라이트 프로필 값(이름·휴대폰·상호·사업자번호·주소·전화)을 미리 채워 확인합니다. 수정 모달이 있습니다
  - 실손 가입이면서 라이트 프로필이 있으면 "라이트 멤버스 계정 연동하기" 체크박스가 나옵니다
- **동작:**
  - 마운트: 라이트 프로필이 있으면 값을 채우고 `GET /integrations/onboarding/lite/employees` → `subUsers`로 직원 후보를 불러옵니다
  - 제출 전 `POST /auth/check-username-onboarding`. `available` false면 서버 `message`를 띄웁니다. `link`면 이 확인을 건너뜁니다
  - 제출:

    | 조건 | 호출 | 결과 |
    |---|---|---|
    | `link` | `POST accountClient /integrations/lite/link` `{ migration }` | "라이트 서비스 연동이 완료되었습니다." → `auth-login` |
    | 실손이고 연동 체크 안 함 | `POST /integrations/onboarding/insurance/signup` | `lastLoginType=insurance`. 착지는 `서비스연동`이 insurance 하나면 `insurance-inquiry`, 아니면 `crm-nonbenefit-patients` |
    | 그 밖 | `POST /integrations/onboarding/lite/signup` (`직원목록` 포함 가능) | `lastLoginType=lite`, `crm-nonbenefit-patients` |

    - 본문 공통(`Qd`): `{ 아이디, 비밀번호, 이름, 휴대폰번호, 병원명, 주소, 사업자등록번호, 약관동의목록, 요양기관기호? }`에 `지번주소`, `주소원본`, `한의원전화번호` 등을 붙입니다
    - 연동을 체크하면 `약관동의목록`에 `emr-lite-chart-migration-agreement` 동의를 추가합니다
  - 응답의 `accessToken`/`refreshToken`/`sub`를 `userAuthData`에 저장합니다 → `/auth/me` `서비스연동`을 합칩니다 → `auth:login` → 스토어를 초기화하고 착지 화면으로 `replace`
  - 오류: 400 "입력 정보를 확인해 주세요.", 401 "인증이 만료되었습니다." → 로그인, 403 "회원가입에 실패했습니다.", 409 "이미 가입된 계정입니다.", 그 밖 `submitErrorTitle`
  - 첫 단계에서 "취소"를 누르면 `liteSignUp.from`, 없으면 `auth-login`으로 갑니다
- **데이터:** 약관 `GET /terms?type=signup&service=lite` → `terms[]`. 라이트 프로필 필드: `이름`, `휴대폰번호`, `병원명`, `한의원전화번호`, `사업자등록번호`, `주소`
- **상태 저장:** `useLiteSignUpStore`(sessionStorage): `authToken`, `integrationStatus`, `liteProfile`, `flowType`, `from`, `실손여부`, `migration`, `completedData`
- **근거:** `restored/views/LiteSignUpView.vue.js`, `restored/views/LiteSignUpFormView.vue.js`, termsWithoutDetailPage.js (어댑터 `wu`) (`restored/modules/LiteSignUpFormView/termsWithoutDetailPage.js`), `restored/views/ServiceSignUpFormView.vue`, `restored/views/ServiceSignUpFormView.vue.js`, `restored/views/ServiceSignUpFormView.helpers-3.js`, `restored/stores/liteSignUp.js`

## 외부원탕(원외탕전) 가입 — `/sign-up/ondang` (`ondang-sign-up`), `/sign-up/ondang/form` (`ondang-sign-up-form`)

- **목적:** 외부 원외탕전 마켓 원외탕전 공동이용계약을 마친 한의원이 원외탕전용 계정을 만듭니다
- **접근 조건:** 공개
  - `/sign-up/ondang`은 `원탕전용약관여부=true`로 정하고, `accountApplicationsToken`을 `ondangSignUp.authToken`에 복사한 뒤 폼으로 `replace`합니다
  - 계약 정보가 없으면 폼이 내보냅니다(아래)
- **화면 구성:** `ServiceSignUpLayout` + 5단계

  | 단계 | 컴포넌트 | 제목 |
  |---|---|---|
  | `account` | `OndangSignUpStepAccount` | "원외탕전에서 사용할 계정을 생성해 주세요." |
  | `terms` | `OndangSignUpStepTerms` | "약관에 동의해 주세요." |
  | `business` | `OndangSignUpStepBusiness` | "계약된 사업자 정보를 확인해 주세요." |
  | `staff` | `OndangSignUpStepStaff` | "직원 계정을 추가해 주세요." (0명이면 "건너뛰기") |
  | `confirm` | `OndangSignUpStepConfirm` | "아래 정보가 맞는지 확인해 주세요." |

  - `confirm` 단계에서 라이트 프로필이 있으면 "라이트 멤버스 계정 연동하기" 체크박스를 보여 줍니다
- **동작:**
  - `GET /integrations/onboarding/wontang/profile`
    - 오류이거나 `원탕계약가입여부`가 false면 "공동이용계약을 먼저 완료해 주세요."를 띄우고 `from`, 없으면 `auth-login`으로 갑니다
    - 성공하면 `대표자명`·`병원명`·`사업자등록번호`·`주소`·`휴대폰번호`로 사업자 정보를 채웁니다
  - 마운트 시 `GET /integrations/onboarding/lite/profile`로 라이트 프로필이 있는지 확인합니다. 실패하면 `null`입니다
  - 계정 검증:
    - 아이디 `^[가-힣a-zA-Z0-9]{2,15}$`, 중복 메시지 없음
    - 비밀번호: 공백 없음, 소문자 포함, 8자 이상, 추가 규칙 `Btn`(특수문자 등, 추정), 확인 값 일치
    - 약관: 필수 약관 전체 동의
  - "가입 완료":
    1. `POST /auth/check-username-onboarding`
    2. 가입 호출
       - 라이트 연동을 체크하고 라이트 프로필이 있으면 `POST /integrations/onboarding/lite/signup`. 약관에 마이그레이션 동의를 추가합니다
       - 아니면 `POST /integrations/onboarding/wontang/signup` `{ 아이디, 비밀번호, 약관동의목록, 직원목록? }`
    3. 토큰 저장 → `/auth/me` → `lastLoginType`(`lite` 또는 `ondang`) → `auth:login` → `crm-nonbenefit-patients`
  - 오류: 400 입력 확인, 409 "이미 가입된 계정입니다."(서버 `message` 우선), 그 밖 "회원가입 중 오류가 발생했습니다."
- **데이터:** 약관 `GET /terms?type=signup&service=wontang`. 가입 신청 토큰을 `accountApplicationClient` 기본 헤더로 씁니다
- **상태 저장:** `useOndangSignUpStore`(sessionStorage): `authToken`, `ondangProfile`, `flowType`, `from`, `원탕전용약관여부`, `completedData`. query key `["ondangSignUp", "checkSsoId" | "profile" | "terms"]`
- **근거:** `restored/views/OndangSignUpView.vue.js`, `restored/views/OndangSignUpFormView.vue`, `restored/views/OndangSignUpFormView.vue.js`, `restored/api/auth/queries.js`, `restored/stores/ondangSignUp.js`

## 가입 완료 — `/sign-up/lite/complete` (`lite-sign-up-complete`), `/sign-up/ondang/complete` (`ondang-sign-up-complete`)

- **목적:** 가입 결과(대표자·한의원·계정 정보)를 요약하고 다음 행동을 안내합니다
- **접근 조건:** 공개. 각 스토어의 `completedData`가 없으면 마운트 즉시 `auth-login`으로 `replace`합니다
- **화면 구성:**
  - 라이트: 대표자명, 휴대폰 번호, 상호, 사업자등록번호, 요양기관 기호(있을 때), 소재지, 한의원 전화번호, 아이디. 버튼 "차트 라이트 보기", "원외탕전 계약하러 가기"
  - 원탕: "원외탕전 가입을 완료했습니다." 사업자명, 대표자명, 사업자등록번호, 주소, 전화번호, 아이디. 버튼 "로그인하기", "원외탕전 계약하러 가기"
- **동작:**
  - "차트 라이트 보기" → 스토어 초기화 → 통합 계정 로그인(`state=lite`)
  - "로그인하기" → `auth-login`
  - "원외탕전 계약하러 가기" → 라이트 멤버스 센터를 새 탭으로 열고 `auth-login`으로 갑니다
- **데이터:** 없음 (스토어 `completedData`만)
- **상태 저장:** `liteSignUp.completedData`, `ondangSignUp.completedData`
- **근거:** `restored/views/LiteSignUpCompleteView.vue`, `restored/views/OndangSignUpCompleteView.vue`

## 약관 보기 — `/terms/:documentNumber` (`terms-content`), `/terms/booking/:type` (`booking-terms`)

- **목적:** 가입·동의 화면에서 새 탭으로 여는 약관 전문 페이지입니다
- **접근 조건:** 공개
- **화면 구성:**
  - `TermsContentView`: 로딩 문구 "약관을 불러오는 중..." → `v-dompurify-html`로 본문 표시. 없으면 "약관 내용을 불러올 수 없습니다."
  - `BookingTermsView`: 로고, 고객센터 전화 안내, 제목, 스크롤 박스
- **동작:**
  - `terms-content`: `GET ssoClient /marketing-agreement/terms/list?domain=…`를 두 번 호출합니다. 도메인은 EMR용과 MEMBERS용입니다. 응답 목록에서 `documentNumber`가 일치하는 항목의 `contents`를 보여 줍니다
  - `booking-terms`: 번들에 내장된 HTML을 `:type`으로 고릅니다
    - `service` "예약 중개 서비스 이용약관"
    - `privacy` "예약 중개 서비스 개인정보취급방침"
    - `thirdParty` "개인정보 제3자 제공 동의서"
    - `BookingSignupModal`에서 엽니다
- **데이터:** `GET /marketing-agreement/terms/list` → `[{ documentNumber, contents, … }]`
- **상태 저장:** query key `["terms","list",<domain>]`, staleTime 30분
- **근거:** `restored/views/TermsContentView.vue.js`, `restored/api/terms/query-keys.js`, `restored/api/marketing-agreement/requests.js`, `restored/views/BookingTermsView.vue.js`

## 통합 약관 동의 게이트 (로그인 후)

- **목적:** 개정된 필수 약관에 병원(대표원장)이 동의하지 않았으면 고객관리 기능을 막습니다
- **사용처:** `CrmView`, `CrmPatientMessageSendSidePanel`, `TreatmentView` 일부. 라우트가 아니라 화면 안의 게이트입니다
- **판정** (`ie`):

  | 상태 | 조건 |
  |---|---|
  | `loading` | 조회 중 |
  | `error` | 조회 실패 |
  | `passed` | `hasDirector`가 false이거나, 대상 약관 중 다시 동의할 필수 약관이 없음 |
  | `consent` | 다시 동의할 필수 약관이 있고 `canAgree` |
  | `waiting` | 다시 동의할 필수 약관이 있지만 `canAgree`가 아님 |

  - 대상 약관은 하드코딩된 3종입니다: 제3자 제공 동의, 개인정보 처리방침, 서비스 이용약관
  - 다시 동의해야 하는 약관: 게시일(`currentPublishedDate`)이 서울 기준 오늘 이전이고, 미동의이거나 `agreedRevision < currentRevision`인 것
- **화면:**
  - `UnifiedTermsConsentScreen`: "서비스 이용약관 동의", "동의하고 시작하기"
  - `UnifiedTermsWaitingScreen`: "대표원장의 약관 동의가 필요합니다", "새로고침"
- **데이터:**
  - `GET accountClient /terms/hospital-agreements?type=signup` (staleTime 0)
  - `GET /terms/documents?type=signup` → `documents`
  - `POST /terms/agreements` `{ 약관동의목록[{약관문서번호, 동의여부: true}] }` → 판정 쿼리 무효화
- **근거:** `restored/api/unified-terms/query-keys.js`, `restored/api/terms/requests.js`, `restored/components/unified/UnifiedTermsConsentScreen.vue`, `restored/views/CrmView.vue`

## 로그아웃 — `/logout` (`logout`)

- **목적:** 로컬 세션과 캐시를 모두 지우고 SSO 로그아웃을 거쳐 로그인 화면으로 돌아갑니다
- **접근 조건:** `requiresAuth`
- **화면 구성:** 빈 `div`
- **동작** (`onMounted`):
  1. Sentry 사용자 정보를 비웁니다 (`setUser({})`)
  2. `auth:logout`을 보냅니다 → `App`이 소켓을 끊고 멤버스 권한 캐시 등을 초기화하고 draft를 삭제합니다
  3. 돌아갈 경로를 정합니다: `lastLoginType`이 `lite`면 `/login/lite`, 아니면 `/login`
  4. localStorage `userAuthData`, 실손 선택 환자 ID, 실손 선택 환자를 삭제합니다
  5. `queryClient.clear()`
  6. Pinia 스토어를 리셋합니다: `aiAgent`, `claimWarning`, `deskDate`, `patient`, `treatment`, `window`, `toastNotification`, `medicalAids`, `socketClient`
  7. `clearAllDrafts()`로 IndexedDB의 진료기록 임시 저장분을 지웁니다
  8. `auth-api …/api/auth/sso/logout?redirect_uri=<origin><경로>`로 `location.replace`합니다
- **상태 저장:** `lastLoginType`은 남깁니다
- **근거:** `restored/views/LogoutView.vue.js`, `restored/stores/window.js`, `restored/modules/index/clearAllDrafts.js`, `restored/components/app/App.vue.js`

## 토큰 저장·갱신

| 항목 | 내용 |
|---|---|
| 요청 인터셉터 (`TRe`) | `userAuthData.accessToken`이 있으면 `Authorization: Bearer …`를 붙입니다 |
| 적용 클라이언트 (`Rf`) | `emrClient`, `accountClient`, `crmClient`, `liteClient`, `ssoClient`, `syncClient`, `insuranceClient`, `biClient`, `webClient` |
| 미적용 | `authClient`(`withCredentials: true`, timeout 10s), `accountApplicationClient`(가입 토큰을 `defaults.headers.common.Authorization`에 직접 넣음) |
| 갱신 조건 (`RRe`) | 응답이 401이고, `_retry`가 아니고, URL이 `/desk/appointments/order/lite/`를 포함하지 않을 때 |
| 동시성 | 갱신 중(`K2`)에 들어온 401은 대기열(`$Re`)에 넣었다가 새 토큰으로 재시도합니다. 탭 사이에서는 `navigator.locks` `emr:token-refresh`로 직렬화합니다. 락 안에서 저장된 `refreshToken`이 바뀌어 있으면 다른 탭이 이미 갱신한 것으로 보고 그 값을 씁니다 |
| 호출 | `POST authClient /token/refresh` `{ refreshToken, sub }` → `results`를 `userAuthData`에 병합 |
| 실패 판정 (`kRe`) | 상태 없음·408·429는 일시 실패 → `null`을 반환하고 세션을 유지합니다. 500 미만은 확정 실패입니다. 500 이상은 메시지에 `NotAuthorizedException`/`UserNotFoundException`이 있을 때만 확정 실패입니다 |
| 확정 실패 처리 | `userAuthData` 삭제 → `clearAllDrafts()` → `/login`이 아니면 `location.href = "/login"`. Sentry 태그 `token-refresh: failure / transient-failure` |
| 외부 채널 | `getAuthToken$({ withRefresh })`로 소켓 등도 같은 토큰을 씁니다 ([non-axios-channels.md](../non-axios-channels.md)) |
| 기타 | `insuranceClient`가 403 `INS_HOSPITAL_CONSENT_REQUIRED`를 받으면 전역 카운터(`URe`)를 올립니다. 병원 동의 모달 트리거로 보입니다 (추정) |

- **근거:** `restored/modules/index/getAuthToken.js`, `restored/lib/index/part-4.js`, `restored/lib/index/baseURL.js`, `restored/api/clients/webClient.js`, `restored/api/clients/authClient.js`

## 흐름

**A. 현행 차트(청구용) 신규 가입 → 승인 → 홈**
1. `/login`에서 "통합 계정으로 시작하기"를 누르면 통합 계정 로그인을 거쳐 `/auth/callback?code=…`로 돌아옵니다
2. `POST /sso/partner/token`이 실패하고 `sso_token`이 오면 신규입니다. `POST /account-application/token`으로 받은 가입 토큰을 메모리 스토어에 넣고 `/onboarding`으로 갑니다
3. `GET /account-application/applications`가 비어 있으면 차트 선택 → "현행 차트" → 사용 중인 차트 여부 → 4단계 폼 → `POST /account-application/applications`
4. `신청완료` 요약 화면이 나옵니다. 다시 들어오면 `승인대기`입니다. 반려되면 `반려` 화면에서 서류를 보완해 `PUT …/supplement`로 다시 냅니다
5. 승인 후(서버 처리) 다시 "통합 계정으로 시작하기"를 누르면 `POST /sso/partner/token`이 토큰을 돌려줍니다. 세션을 저장하고 `home`으로 갑니다. `home`은 `서비스연동`/`chartLayout`으로 `desk` 등을 고릅니다 (추정: 승인되면 SSO 토큰 교환이 성공하는 것으로 보임)

**B. 차트 라이트 가입**
1. `/onboarding` 차트 선택에서 "차트 라이트"를 고르거나 `/sign-up/lite`로 들어오면 통합 계정 로그인(`state=lite`)을 거쳐 `/auth/callback`으로 돌아옵니다
2. 가입 토큰 발급 → `check-ssoid` → 라이트 프로필 → `GET /integrations/lite`
   - `linked`면 로그인으로 갑니다
   - 아니면 `/sign-up/lite/form?flowType=signup|link`로 갑니다
3. 폼 제출이 성공하면 바로 로그인 상태가 되어 `crm-nonbenefit-patients`로 갑니다. 실손 가입은 `insurance-inquiry`로 갈 수 있고, `link`는 로그인 화면으로 갑니다

**C. 외부원탕 가입**
1. `/onboarding` 차트 선택에서 "외부원탕"을 고릅니다. `원탕계약가입여부 && available`일 때만 켜집니다
2. `/sign-up/ondang` → `/sign-up/ondang/form` → 계약 프로필 확인 → 5단계 → 원탕(또는 라이트) 가입 → `crm-nonbenefit-patients`

**D. 일반 로그인 / 세션 만료 / 로그아웃**
1. `/login` → `POST /login` → `GET /auth/me` → `?redirect` 또는 계정 홈
2. API가 401을 받으면 토큰을 갱신하고 재시도합니다. 확정 실패면 세션을 지우고 `/login`으로 갑니다
3. `/logout` → 로컬 정리 → SSO 로그아웃 → `/login` 또는 `/login/lite`

**E. 계정 잠금**
1. 로그인이 `AE_AUTH_ACCOUNT_LOCKED`로 실패하면 "휴대폰 본인인증으로 잠금 해제"를 누릅니다
2. `/login/unlock?id=…` → OTP 요청·확인 → 완료 → `/login`

## 레거시 차트 대비

이 절은 레거시 차트 매뉴얼을 근거로 하며, 현행 코드에서 확인한 내용이 아닙니다.

### 현행 스펙에 없는 업무

- **관리자가 잠긴 계정 풀어 주기:** 관리자 권한이 없는 한의사나 직원 계정이 잠기면, 관리자 권한이 있는 한의사가 그 사용자에게 임시비밀번호를 지정합니다. 사용자는 임시비밀번호로 로그인한 뒤 규칙에 맞는 새 비밀번호로 바꿉니다. 현행 잠금 해제 화면에는 "대표원장에게 잠금 해제를 요청해주세요."라는 문구만 있고, 관리자가 해제하는 경로는 이 문서 범위에 없습니다 (레거시 차트 매뉴얼 「레거시 차트 사용자의 임시비밀번호 지정하기」, 레거시 차트 매뉴얼 「비밀번호 잘못 입력 - 원장실프로그램 사용자」, 레거시 차트 매뉴얼 「비밀번호 잘못 입력 - 접수실프로그램 사용자」)
- **임시비밀번호 첫 로그인 때 변경 강제:** 진료한의사·접수실 사용자를 새로 만들 때도 임시비밀번호(예: `1`)로 만들고, 첫 로그인에서 규칙에 맞는 비밀번호로 바꾸게 합니다. 백엔드에는 "임시 비밀번호 상태" 플래그와 변경 전 기능 차단이 필요해 보입니다 (추정) (레거시 차트 매뉴얼 「진료한의사 추가 및 퇴사 관리」, 레거시 차트 매뉴얼 「접수실프로그램 사용자 추가 및 퇴사 관리」, 레거시 차트 매뉴얼 「레거시 차트 환경설정 저장」)
- **유일한 관리자가 잠긴 경우:** 본인이 풀 수 없으면 기관이 개발사 홈페이지에서 작업동의서를 내고, 개발사가 비밀번호를 초기화합니다. 백엔드에는 운영자(백오피스)용 초기화 절차와 그 근거 서류·처리 기록이 필요합니다 (레거시 차트 매뉴얼 「개인정보보호 비밀번호 잠김」)
- **유휴 자동 로그아웃과 수동 화면 잠금:** 일정 시간(기본 60분) 쓰지 않으면 자동으로 로그아웃하고 다시 로그인하게 합니다. 자리를 비울 때 쓰는 "프로그램 잠금" 단축 기능도 따로 있습니다. 개인정보 자율점검 항목(3.2.9 / 3.3.6)에 대응하는 기능입니다 (레거시 차트 매뉴얼 「개인정보보호 자동 로그아웃」)
- **공용 PC에서 사용자 전환:** 프로그램을 끄지 않고 "다른 사용자로 로그인"으로 현재 사용자를 바꿀 수 있고, 마지막 사용자 이름을 기억해 다음 로그인에 미리 채웁니다. 진료실·접수실 PC를 여러 사람이 함께 쓰는 환경을 전제로 합니다 (레거시 차트 매뉴얼 「진료 한의사 관리(추가, 암호변경, 메모)」, 레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」)
- **기관 단위 개인정보 보호 설정:** 관리자가 "접수실 로그인 사용", "비밀번호 규칙 적용", 잠금 허용 횟수, 자동 로그아웃을 기관 환경설정에서 켜고 끕니다. 재설계 백엔드에서 정책을 기관별 값으로 둘지, 법정 최소치로 고정할지 정해야 합니다 (레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」, 레거시 차트 매뉴얼 「개인정보보호 비밀번호 잠김」)
- **진료의 계정에 붙는 신고·자격 정보:** 진료한의사를 등록할 때 계정 정보와 함께 아래 값을 받습니다. 현행 온보딩은 대표자에 대해서만 `면허번호`·`근무형태`·`추나요법교육여부`를 받습니다

  | 필드 | 의미 |
  |---|---|
  | 이름 | 실명 |
  | 한의사 면허번호 | 청구·처방 표기용 |
  | 주민등록번호 앞자리 | 본인 식별 |
  | 관리자 | 경영관리(사용자·설정 관리 포함) 전체 사용. 끄면 경영관리 메뉴가 숨겨집니다 |
  | 퇴사 | 퇴사 처리(계정 삭제가 아닌 상태값) |
  | 추나급여 | 추나요법 급여 사전교육을 이수하고 심평원에 인력 신고를 마친 경우에만 켭니다 |
  | 근무형태 | 상근(무표시) / 대진의 / 비상근(격일제) / 비상근(시간제) / 기타. 차등제 산정에 쓰입니다(아래 업무 규칙) |
  | 권한 제한 | 기능별 제한 체크 |
  | 연동 솔루션 노출 | 외부 접수 앱에 이름을 보여줄지 |

  (레거시 차트 매뉴얼 「진료한의사 추가 및 퇴사 관리」, 레거시 차트 매뉴얼 「추나요법 급여 사전 교육 신고」, 레거시 차트 매뉴얼 「대진의 심평원에 신고 및 레거시 차트에 추가 방법 안내」)
- **진료의별 전자서명 가입:** 전자의무기록 전자서명은 대표 한의사가 인증기관에 직접 신청하고, 부원장·대진의 등 추가 한의사는 개발사를 통해 따로 신청합니다. 서명 수단이 기관이 아니라 진료의 계정마다 붙는다는 뜻입니다 (레거시 차트 매뉴얼 「전자서명서비스 가입」)
- **개원 준비 체크리스트(온보딩 때 받아야 할 기관 정보):** 매뉴얼은 차트를 쓰기 전에 아래 신고·가입을 마치라고 안내합니다. 재설계 온보딩에서 단계별 완료 여부와 해당 값을 기관 정보로 받아 두면, 청구 단계의 오류를 미리 막을 수 있습니다 (추정)

  | 항목 | 결과로 생기는 값 / 백엔드가 받을 것 |
  |---|---|
  | 요양기관 개설신고(시설·인력·장비, 보건의료자원통합신고포털) | 요양기관기호 부여 |
  | 사업자등록(개설 후 20일 이내) | 사업자등록번호, 기관 기본정보 |
  | 기관 공동인증서 발급(관할 건보공단 신청 → 인증기관 발급) | 인증서 파일·만료일 |
  | 심평원 요양기관업무포털 가입·인증서 등록·전산청구 신청 | 전산청구 공급업체·소프트웨어명이 해당 차트로 등록돼 있어야 함 |
  | 건보공단 요양기관 정보마당 가입·인증서 등록 | 자격조회용 |
  | 건강보험 EDI 기본 수신처 | 소재지에 맞는 심평원 본부(서울·부산제주·대구경북·광주전남·대전충청·경기남부·울산경남·경기북부강원·전북·인천) |
  | 산재 청구기관코드(근로복지공단 토탈서비스) | 산재지정번호. 추나 시행 기관은 이수증 제출 |
  | 추나요법 급여 사전교육 이수 신고(심평원, 산재는 근로복지공단) | 진료의별 추나급여 여부 |
  | 대진의·인력 현황 신고(보건의료자원통합신고포털) | 진료의별 근무형태 |
  | 원외공동탕전(해당 시: 보건소 개설신고 변경 + 포털 신고) | 공동이용 탕전실 정보 |

  치료재료 구입목록표, 자동차보험 물리요법 장비·약침액 신고처럼 개원 체크리스트에 들어 있지만 청구 영역에 가까운 항목은 여기서 다루지 않습니다 (레거시 차트 매뉴얼 「개원 준비과정 안내」, 레거시 차트 매뉴얼 「요양기관 개설신고(시설·인력·장비 등 신고)」, 레거시 차트 매뉴얼 「사업자등록 신청」, 레거시 차트 매뉴얼 「공동인증서 신청/발급/복사」, 레거시 차트 매뉴얼 「심평원의 요양기관 업무포털에 회원가입」, 레거시 차트 매뉴얼 「건보공단의 요양기관 정보마당에 회원가입」, 레거시 차트 매뉴얼 「레거시 차트 환경설정 저장」, 레거시 차트 매뉴얼 「고용산재보험 토탈서비스에서 청구기관코드 확인」, 레거시 차트 매뉴얼 「원외공동탕전 신청」)
- **공동인증서 만료 관리:** 만료가 지나면 갱신할 수 없고 새로 발급해야 하며, 재발급하면 심평원·공단 포털에 인증서 등록을 다시 해야 합니다. 백엔드는 만료일을 보관해 갱신 기간에 미리 알려 주는 것이 좋겠습니다 (추정) (레거시 차트 매뉴얼 「공동인증서 갱신 및 복사하기」, 레거시 차트 매뉴얼 「공동인증서 만료시 비대면 발급 방법」)
- **양도·양수(원장 교체) 온보딩:** 차트를 쓰던 한의원을 넘겨받으면 기관 정보를 고치고, 전 원장을 퇴사 처리하고, 새 원장을 관리자로 추가하고, 직원 입·퇴사를 정리합니다. 자동차보험 적용 중인 환자는 양도일 기준으로 적용 종료일을 넣고, 기존 환자의 개인정보 수집·이용 동의 서명을 초기화해 다시 받습니다. 현행 온보딩은 신규 가입만 다루고, 같은 요양기관의 대표자 교체 흐름은 없습니다 (레거시 차트 매뉴얼 「레거시 차트를 사용 중인 한의원을 양수한 경우」, 레거시 차트 매뉴얼 「영업의 양도 등에 따른 개인정보 이전 통지 방법」)
- **개인정보 보호 관리 도구:** 관리자 메뉴에 아래 기능이 있습니다. 자율점검 때 증빙으로 씁니다
  - 환자 주민번호 암호화 상태 확인과 일괄 암호화
  - 고유식별정보 보유 건수(내국인·외국인) 집계
  - 보존기간이 지난 자료 분석 후 일괄 삭제, 삭제 로그 조회
  - 진료의·접수실 사용자 정보 변경 로그(권한 부여·변경·말소 이력)와 접속기록 조회

  현행 `계정 이력` 화면(settings.md)은 샘플 데이터만 그리는 미완성 상태입니다 (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」, 레거시 차트 매뉴얼 「개인정보의 파기방법 - 진료기록의 보존기간과 관리」, 레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」)

### 업무 규칙

- **비밀번호 규칙:** 영문·숫자 조합 10자 이상, 같은 문자나 연속 문자를 4번 이상 쓰지 않음, 같은 비밀번호를 6개월 넘게 쓰지 않음. "6개월"은 재사용 금지 기간인지 변경 주기인지 문구만으로는 분명하지 않습니다 (추정: 6개월마다 변경 요구) (레거시 차트 매뉴얼 「레거시 차트 사용자의 임시비밀번호 지정하기」, 레거시 차트 매뉴얼 「비밀번호 변경하기 - 원장실프로그램 사용자」)
- **잠금:** 허용 횟수는 기관 설정이며 5회를 권장합니다. 0으로 두면 잠금 기능을 끕니다. 틀릴 때마다 경고를 보여 줍니다 (레거시 차트 매뉴얼 「개인정보보호 비밀번호 잠김」)
- **자동 로그아웃:** 로그인 후 60분 넘게 쓰지 않으면 로그아웃합니다 (레거시 차트 매뉴얼 「개인정보보호 자동 로그아웃」)
- **저장 암호화:** 고유식별정보·비밀번호는 안전한 알고리즘으로 암호화해 저장합니다(매뉴얼은 자사 방식을 "AES512"로 적음). 개인정보보호법 제29조(안전조치)와 관련됩니다 (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」, 레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」)
- **계정 공유 금지:** 개인정보취급자마다 계정을 따로 발급하고, 원장실·접수실 프로그램을 쓰는 사람은 모두 등록해야 합니다 (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」, 레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」)
- **기록 보관 기간(2026년 자율점검 가이드 기준):**
  - 접근 권한 부여·변경·말소 내역: 최소 3년
  - 접속기록(식별자, 접속 일시, 접속지, 처리한 정보주체, 수행 업무): 2년 이상
  - 업무가 바뀌거나 퇴사하면 지체 없이 권한을 변경·말소합니다

  (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」)
- **외부 접속:** 기관 밖에서 정보통신망으로 접속할 때는 인증서·보안토큰·일회용 비밀번호 같은 추가 인증 수단을 써야 합니다(자율점검 3.3.3). 클라우드 EMR은 사실상 모든 접속이 여기에 해당할 수 있습니다 (추정) (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」)
- **고유식별정보 보유량 집계:** 주민번호 뒷자리 첫 숫자가 1~4이면 내국인, 5~8이면 외국인으로 세고, 같은 사람은 한 번만 셉니다 (레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」)
- **진료기록 보존기간(의료법 시행규칙 제15조):**

  | 기록 | 보존기간 |
  |---|---|
  | 환자명부 | 5년 |
  | 진료기록부 | 10년 |
  | 처방전 | 2년 |
  | 수술기록 | 10년 |
  | 검사소견기록 | 5년 |
  | 방사선사진 및 소견서 | 5년 |
  | 간호기록부 | 5년 |
  | 조산기록부 | 5년 |
  | 진단서 등의 부본 | 3년 |

  - 보존기간 안의 기록은 환자가 삭제·파기를 요구해도 지울 수 없습니다. 그 밖의 개인정보는 요구가 있으면 지체 없이 조사해 응해야 합니다
  - 레거시 차트의 파기 기능은 "보존기간 경과분 전체"를 분석해 지우는 방식이고, 특정 기간만 골라 지우지는 못합니다. 지우기 전에 백업하라고 안내하며, 삭제 후에는 복구할 수 없습니다
  - 파기 관리대장은 기관이 직접 작성합니다

  (레거시 차트 매뉴얼 「개인정보의 파기방법 - 진료기록의 보존기간과 관리」, 레거시 차트 매뉴얼 「의료기관의 개인정보보호 가이드라인」)
- **전자의무기록 시설·장비 기준(의료법 시행규칙 제16조, 보건복지부고시 제2021-2호, 매뉴얼 기준):** 전자서명 생성·검증, 서명 후 변경 여부를 확인하는 이력관리, 주기적 백업, 네트워크·시스템 보안, 저장소 물리 접근 통제를 갖춰야 합니다. 전자의무기록을 추가 기재·수정하면 접속 기록을 따로 보관해야 합니다. 기관 밖에 저장장비를 두면(클라우드 포함, 추정) 실시간 상태 점검, 예비 장비, CCTV 등 감시 장비, 재해예방시설이 추가로 필요합니다 (레거시 차트 매뉴얼 「전자의무기록의 관리·보존에 필요한 시설과 장비에 관한 기준」)
- **동의 없이 수집할 수 있는 정보:** 성명·주민번호·주소와 증상·진단·치료 내용은 의료법상 기재 의무 사항이라 동의가 필요 없습니다. 연락처도 진료 목적이면 동의 없이 수집할 수 있지만, 홍보에 쓰려면 동의가 필요합니다. 만 14세 미만은 법정대리인 동의를 받습니다. 가입·약관 동의 항목을 설계할 때 참고할 기준입니다 (레거시 차트 매뉴얼 「의료기관의 개인정보보호 가이드라인」)
- **근무형태별 차등제 산정인력:**

  | 근무형태 | 기준 | 산정 |
  |---|---|---|
  | 상근 | 주 5일·주 40시간 이상, 3개월 이상 고용계약 | 1인 |
  | 비상근 | 주 3일·주 20시간 이상 | 0.5인 |
  | 대진 | 휴가자 대신 근무 | 1인 |
  | 기타 | 주 3일·주 20시간 미만, 후 입사기관 근무 | 제외 |

  - 레거시 차트는 비상근을 "격일제(주 3일 종일)"와 "시간제(주 5일 오전 또는 오후)"로 나눕니다. 시간제는 근무일수에 0.5를 곱합니다(예: 26일 오전 근무 → 13일)
  - 매뉴얼 한 곳은 "주 3일 종일·주 20시간 이상 비상근"을 1인으로 적어 다른 항목(0.5인)과 다릅니다. 0.5인 쪽이 최신 안내로 보입니다 (추정)
  - 계산 자체는 청구(차등수가) 영역이고, 계정 쪽은 진료의별 근무형태와 그 변경 이력을 보관하면 됩니다

  (레거시 차트 매뉴얼 「(기준) - 의료인력 현황신고」, 레거시 차트 매뉴얼 「진료한의사 추가 및 퇴사 관리」, 레거시 차트 매뉴얼 「진료 한의사 관리(추가, 암호변경, 메모)」)
- **대진의 등록 순서:** 보건의료자원통합신고포털에 먼저 신고하고, 그다음 차트에 대진의로 등록합니다. 퇴사하면 퇴사 처리합니다 (레거시 차트 매뉴얼 「대진의 심평원에 신고 및 레거시 차트에 추가 방법 안내」)
- **공동인증서 갱신 기간:** 만료 30일 전부터 만료일까지만 갱신할 수 있습니다. 만료 후에는 새로 발급받아야 합니다. 보건복지분야 인증서 비대면 발급은 개인사업자 2026-02-01, 법인사업자 2026-07-01부터 열렸습니다 (레거시 차트 매뉴얼 「공동인증서 갱신 및 복사하기」, 레거시 차트 매뉴얼 「공동인증서 만료시 비대면 발급 방법」)
- **양도 시 개인정보 이전 통지:** 이전하기 전에 양도자가 정보주체에게 알립니다. 알릴 내용은 이전 사실, 양수자의 이름(법인명)·주소·전화번호, 이전을 원하지 않을 때의 방법·절차입니다. 방법은 서면·전자우편·팩스·전화·문자 등이고, 과실 없이 개별 통지를 못 하면 홈페이지(없으면 사업장)에 30일 이상 게시합니다. 양수자도 받은 뒤 지체 없이 통지하고, 넘겨받은 정보는 원래 목적으로만 씁니다 (레거시 차트 매뉴얼 「영업의 양도 등에 따른 개인정보 이전 통지 방법」)

### 현행과 다른 점

- **잠금 해제 주체:** 레거시 차트는 일반 사용자를 관리자가 임시비밀번호로 풀고, 대표·관리자는 본인인증 후 직접 풉니다. 현행은 명의자 본인이 휴대폰 본인인증(KCB)으로 풀고, 그게 안 되면 대표원장에게 요청하라고만 안내합니다 (레거시 차트 매뉴얼 「비밀번호 잘못 입력 - 대표 한의사 또는 관리자」, 레거시 차트 매뉴얼 「레거시 차트 사용자의 임시비밀번호 지정하기」)
- **잠금 해제 후 비밀번호:** 레거시 차트는 대표·관리자가 본인인증을 마치면 새 비밀번호를 입력해 재설정합니다. 현행은 잠금만 풀고 "비밀번호는 바뀌지 않았습니다"라고 안내합니다 (레거시 차트 매뉴얼 「비밀번호 잘못 입력 - 대표 한의사 또는 관리자」)
- **잠금 횟수:** 레거시 차트는 기관이 정하고(0이면 끔) 5회를 권장합니다. 현행은 5회 실패 문구가 화면에 고정돼 있습니다 (레거시 차트 매뉴얼 「개인정보보호 비밀번호 잠김」)
- **비밀번호 강도:** 레거시 차트는 영숫자 10자 이상과 반복·연속 문자 제한을 둡니다. 현행 원외탕전 가입 폼은 8자 이상·소문자 포함·공백 없음이고, 현행 계정 신청 폼은 확인 값 일치만 검사합니다 (레거시 차트 매뉴얼 「레거시 차트 사용자의 임시비밀번호 지정하기」)
- **세션 종료 기준:** 레거시 차트는 사용하지 않은 시간(60분)을 기준으로 로그아웃합니다. 현행은 토큰을 계속 갱신하고, 병원 정보 설정에 "로그인 유지 시간" 필드가 있습니다(settings.md). 그것이 유휴 시간 기준인지는 이 문서 범위에서 확인하지 못했습니다 (레거시 차트 매뉴얼 「개인정보보호 자동 로그아웃」)
- **계정 모델:** 레거시 차트는 설치형이라 기관이 곧 하나의 데이터베이스입니다. 원장실·접수실 프로그램마다 등록된 사용자 이름을 골라 로그인하고, 대표 계정을 따로 가입·승인받는 절차가 없습니다. 현행은 아이디 기반 전역 계정에 통합 계정 SSO와 운영자 승인(가입 신청 → 승인 대기 → 반려·보완)을 거칩니다 (레거시 차트 매뉴얼 「개인정보보호법 적용 로그인 기능 안내」, 레거시 차트 매뉴얼 「진료 한의사 관리(추가, 암호변경, 메모)」)
- **퇴사 처리:** 레거시 차트는 계정을 지우지 않고 "퇴사" 표시만 합니다. 현행 설정 화면에는 비활성화와 복구할 수 없는 삭제가 함께 있습니다. 진료기록 작성자 표시와 권한 이력 3년 보관을 생각하면, 기록이 있는 진료의 계정은 삭제보다 비활성화가 맞아 보입니다 (추정) (레거시 차트 매뉴얼 「진료한의사 추가 및 퇴사 관리」, 레거시 차트 매뉴얼 「개인정보보호 자율점검 신청 안내」)
- **요양기관기호 없는 가입:** 레거시 차트 매뉴얼은 개설신고로 요양기관기호를 받은 뒤 차트 설정을 하는 순서입니다. 현행 온보딩은 `요양기관기호없음`으로 가입을 허용합니다. 기호 없이 가입한 계정이 나중에 기호를 입력하는 경로는 settings.md에서 `ro`(읽기 전용)로 되어 있어 따로 확인이 필요합니다 (추정) (레거시 차트 매뉴얼 「요양기관 개설신고(시설·인력·장비 등 신고)」)
- **기존 차트 자료 이관:** 레거시 차트는 다른 차트에서 넘어올 때 환자 인적사항만 엑셀로 받아 변환합니다(유상). 현행 온보딩은 사용 중인 `차트종류`와 `추가요청사항`만 받고, 이관 범위는 정하지 않습니다 (레거시 차트 매뉴얼 「레거시 차트 데모 절차」)
- **원외탕전 가입 조건:** 레거시 차트는 원외공동탕전을 기관이 보건소에 변경신고하고 포털에 신고하는 절차로 안내합니다. 현행은 외부원탕 공동이용계약 여부(`원탕계약가입여부`)로 가입 화면을 열지 정합니다. 개설신고 변경 여부는 확인하지 않습니다 (레거시 차트 매뉴얼 「원외공동탕전 신청」)

## 미확인·추정

- `lite-sign-up-complete`·`ondang-sign-up-complete`로 이동하거나 `completedData`를 채우는 코드를 복원 트리에서 찾지 못했습니다. 지금은 두 가입 폼 모두 성공 시 바로 로그인시켜 다른 화면으로 보냅니다. 완료 화면은 직접 열면 로그인으로 돌아가는, 사실상 쓰이지 않는 라우트일 수 있습니다 (추정)
- `/login/lite`는 `/login`으로 redirect만 하므로, 가드와 로그아웃이 `lite-login`·`/login/lite`로 보내도 같은 로그인 화면이 열립니다. 화면에서 `?refer=logout`을 읽는 코드는 없습니다
- 응답 인터셉터 `RRe`는 `userAuthData`가 비어 있으면 아무것도 반환하지 않습니다(`return;`). 그 결과 로그인 정보가 없을 때 실패한 요청이 reject되지 않고 `undefined`로 resolve됩니다 (코드상 동작, 의도는 미확인)
- 온보딩은 신청 `상태`가 `rejected`가 아니면 모두 `승인대기`로 보여 줍니다. `approved`도 여기에 포함되며, `approved`를 구분하는 곳은 취소 처리뿐입니다
- `AccountApplicationsAuthGuard`가 의존하는 `accountApplicationsToken` 스토어는 persist하지 않습니다. 그래서 `/onboarding`을 새로고침하면 통합 계정 로그인을 다시 거칩니다 (코드상 동작)
- `PartnerAuth`는 `?refresh_token`도 읽어 emit하지만 콜백 처리기는 `code`만 씁니다
- 라이트 가입 폼의 3A 화면이 라이트 연동 이전 계정과 어떻게 다른지, `migration` 플래그를 누가 켜는지는 확인하지 못했습니다
- `auth:login`/`auth:logout`을 받는 `App` 핸들러의 일부 함수(`$`, `T`, `yct`, `CHe`, `KHe`, `zmt`)는 이름이 복원되지 않아 정확한 역할을 모릅니다
- 승인 이후 첫 로그인에서 비밀번호 로그인과 SSO 중 어느 쪽을 주 경로로 쓰는지는 서버 정책에 달려 있습니다 (추정)
