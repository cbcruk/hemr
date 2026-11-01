# 계정·인증·온보딩

아이디·비밀번호 로그인, 메디스트림(네이버) SSO 콜백, 계정 잠금 해제, 신규 가입(업스트림 차트 계정 신청 / 차트 라이트(수) / 메디원탕), 약관 열람, 로그아웃을 다룹니다.
로그인 상태는 localStorage `사용자로그인정보`(`userAuthData`) 하나로 판단하고, 만료된 토큰은 axios 응답 인터셉터가 `POST authClient /token/refresh`로 갱신합니다.
가입 단계에서는 로그인 토큰 대신 SSO에서 받은 **가입 신청 토큰**을 `accountApplicationClient`의 기본 `Authorization` 헤더로 씁니다.

## 공통: 인증 상태와 라우터 가드

| 항목 | 내용 |
|---|---|
| 로그인 판정 | `JSON.parse(localStorage.userAuthData).accessToken`이 있으면 로그인 상태 |
| 저장 내용 | 로그인 응답(`accessToken`, `refreshToken`, `sub` 등) + `GET emrClient /auth/me`의 `서비스연동`, `역할타입`, `chartLayout`(←`차트레이아웃`), `요양기관기호`, `멤버스허용권한코드`(←`권한목록`) |
| 마지막 로그인 타입 | localStorage `lastLoginType` (`bt.마지막로그인타입`): `upstream` / `soo` / `insurance` / `ondang` / `members` |
| 로그인 이벤트 | 세션을 저장한 쪽이 `window`에 `auth:login`을 보냄 → `App`이 소켓 재연결·쿼리 재조회 등 (추정) |

가드(`re-upstream/restored/router/guards.js`)에서 이 영역과 관계된 규칙:

- `meta.requiresAuth` 라우트에 토큰 없이 들어오면 `?redirect=<fullPath>`를 붙여 로그인으로 보냅니다. `lastLoginType === "soo"`면 `soo-login`, 아니면 `auth-login`인데, `soo-login`(`/login/soo`)은 `auth-login`으로 redirect만 하는 라우트입니다
- 로그인한 상태로 `auth-login`·`soo-login`·`auth-unlock`에 오면 계정 홈(`kL(서비스연동, …, { chartLayout })`)으로 보냅니다
- `/auth/callback`, `/onboarding`, `/sign-up/*`, `/terms/*`에는 meta가 없습니다. 로그인 여부와 상관없이 열립니다
- 이 영역에서 `meta.requiresAuth`가 붙은 라우트는 `/logout` 하나입니다

## 로그인 — `/login` (`auth-login`), `/login/soo` (`soo-login`)

- **목적:** 아이디·비밀번호로 로그인하거나 메디스트림 계정 SSO로 들어가는 진입 화면입니다
- **접근 조건:** 공개. 이미 로그인했으면 가드가 홈으로 보냅니다. `/login/soo`는 `/login`으로 redirect합니다
- **화면 구성:** 로고, "로그인" 카드(`BaseTextInput` 아이디 "영문, 숫자, 한글 가능" / 비밀번호 + 표시 토글 `BaseTextInputButtonModule`), 오류 문구, 잠금 해제 버튼(조건부), "로그인" 버튼, `ContentDivider` "대표 원장님이라면", "메디스트림 계정으로 시작하기"(네이버 녹색 버튼), "다른 네이버 계정으로 가입하기" 링크
- **동작:**
  - 브라우저 자동완성 감지: 마운트 후 100/500/1000ms에 `input:-webkit-autofill`을 확인합니다. 감지되면 값이 비어 보여도 버튼을 켜고, 제출 직전에 `input` 이벤트를 다시 보내 값을 동기화합니다
  - 제출 → 값이 비어 있으면 "아이디, 비밀번호를 입력해주세요." → `POST authClient /login` `{ 아이디, 비밀번호 }`
  - 성공 → `setupLoginSession(result, "upstream")`
    1. 로그인 결과를 `userAuthData`에 저장합니다
    2. `GET emrClient /auth/me`로 받은 값을 합쳐 다시 저장합니다
    3. `lastLoginType`을 기록합니다. `서비스연동`이 `["insurance"]` 하나뿐이면 `insurance`, 아니면 `upstream`입니다
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
  - "메디스트림 계정으로 시작하기" → 메디스트림 인증 서버 `/login?client_id=…&redirect_uri=<origin>/auth/callback&response_type=code`로 이동합니다(`navigation: "push"`)
  - "다른 네이버 계정으로 가입하기" → 메디스트림 `/logout`을 거쳐 같은 로그인 URL(`refer=logout`)로 이동합니다
- **데이터:** `POST /login` 응답 `results`(토큰 묶음), `GET /auth/me` → `me.서비스연동`, `me.역할타입`, `me.차트레이아웃`, `me.요양기관기호`, `me.권한목록`
- **상태 저장:** `userAuthData`, `lastLoginType`
- **근거:** `re-upstream/restored/views/LoginView.vue`, `re-upstream/restored/views/LoginView.vue.js`, setupLoginSession (part-231.js) (`re-upstream/restored/modules/index/part-231.js`), `re-upstream/restored/modules/medistreamAuthToken.js`, `re-upstream/restored/api/sso/requests.js`, `re-upstream/restored/modules/constants.js`

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
  - 오류 분류 (`re-upstream/restored/modules/AccountUnlockView/message.js`):

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
- **근거:** `re-upstream/restored/views/AccountUnlockView.vue`, `re-upstream/restored/components/account/AccountUnlockStepPhoneVerification.vue.js`, `re-upstream/restored/components/account/AccountUnlockIdentityVerificationModal.vue.js`, `re-upstream/restored/api/unlock/requests.js`

## SSO 콜백 — `/auth/callback` (`auth-callback`)

- **목적:** 메디스트림 OAuth `code`를 받아 기존 회원이면 로그인시키고, 신규면 가입 흐름으로 보냅니다
- **접근 조건:** 공개
- **화면 구성:** `AccountApplicationsLayout` 안의 `MedistreamAuth`(스피너만 표시). `onBeforeMount`에서 `?code`, `?refresh_token`을 읽어 `medistream-verified`를 emit합니다
- **동작:** `?state` 값에 따라 세 갈래로 나뉩니다. 모두 먼저 `POST authClient /sso/medistream/token` `{ code }`를 호출합니다
  - **기본(`state` 없음, 업스트림 차트):**
    - 결과가 있으면 기존 회원입니다. 세션을 저장하고 `lastLoginType=upstream`, `home`으로 갑니다
    - 오류 응답의 `data.sso_token`이 있으면 신규입니다
      1. `POST accountApplicationClient /account-application/token` `{ sso_token }` → `token`을 `accountApplicationClient` 기본 헤더와 `useAccountApplicationsAuthStore.accountApplicationsToken`에 넣습니다
      2. `GET /auth/check-ssoid`를 호출합니다. 403만 오류로 봅니다
      3. `auth-onboarding`으로 갑니다
    - 오류별 안내:

      | 응답 | 안내 | 다음 |
      |---|---|---|
      | 400 | "한의사로 인증된 메디스트림 계정이 필요합니다" | "메디스트림 바로가기"를 고르면 메디스트림 사이트, 아니면 로그인 |
      | 409 | "이미 업스트림 차트에 가입된 계정입니다." | 로그인 |
      | 403 | "회원가입에 실패했습니다." | 로그인 |
      | 500 | "가입 중 오류" | 로그인 |
      | 그 밖의 예외 | — | 메디스트림 로그아웃 → 로그인 |

  - **`state=soo` (차트 라이트):**
    - 기존 회원이면 `lastLoginType=soo`로 저장하고 `crm-nonbenefit-patients`(없으면 `home`)로 갑니다
    - 404/401이면 `sso_token`으로 가입 신청 토큰을 받아 `useSooSignUpStore.authToken`에 넣습니다
    - `GET /auth/check-ssoid`의 `available`이 false면 "이미 회원가입이 되어 있습니다."
      - "다른 계정으로 로그인"을 고르면 메디스트림 로그아웃을 거칩니다
      - 어느 쪽이든 마지막에는 `soo-login`으로 갑니다
    - `GET /integrations/onboarding/soo/profile`(404면 `null`) → `sooProfile`
    - 프로필이 없고 `실손여부`도 아니면 "차트 라이트를 사용하려면 수 멤버스에 가입해주세요." 창을 띄웁니다. 확인하면 수 멤버스 센터, 아니면 `soo-login`
    - `GET /integrations/soo`
      - `linked`면 `auth-login`
      - 아니면 `flowType`을 정해 `soo-sign-up-form?flowType=…`로 갑니다. 토큰 교환에서 404/401이 나온 경우 `signup`, 그 밖에는 `link`입니다
    - 오류: 409 "이미 수 서비스에 연동된 계정입니다.", 401 "인증이 만료되었습니다.", 403 "회원가입에 실패했습니다.", 그 밖 "수 서비스 연동 중 오류"
  - **`state=members`:**
    - 기존 회원이면 세션을 저장합니다
    - `GET accountApplicationClient /integrations/members`로 연동 상태를 확인합니다. 실패하면 확인 창을 띄우고 최대 2회 다시 시도합니다
    - 결과별 이동:
      - `unlinked`: `members-sign-up-form?flowType=link`
      - `exhausted`: 안내 창을 띄운 뒤 홈
      - 그 밖: 홈
    - 신규면 `useMembersSignUpStore.authToken`을 설정하고 `members-sign-up-form`으로 갑니다. 이후 화면은 MEMBERS 문서 범위입니다
- **데이터:**
  - `POST /sso/medistream/token` → 토큰 묶음, 또는 오류의 `response.data.data.sso_token`
  - `POST /account-application/token` → `token`
  - `GET /auth/check-ssoid` → `available`, `원탕금곡가입여부`
  - `GET /integrations/soo` → `linked`
- **상태 저장:** `accountApplicationsAuth`(메모리), `sooSignUp`·`membersSignUp`(sessionStorage persist), `userAuthData`, `lastLoginType`
- **근거:** `re-upstream/restored/components/account/AccountApplicationsAuth.vue.js`, `re-upstream/restored/components/medistream/MedistreamAuth.vue.js`, `re-upstream/restored/modules/AccountApplicationsAuth/INTEGRATIONS_MEMBERS_PATH.js`, `re-upstream/restored/stores/membersSignUp.js`, `re-upstream/restored/api/integrations/sooSignUp.js`

## 온보딩(계정 신청) — `/onboarding` (`auth-onboarding`)

- **목적:** 신규 사용자가 가입할 차트를 고르고, 업스트림 차트(청구용) 계정을 신청한 뒤 승인 상태를 확인합니다
- **접근 조건:** 라우트는 공개입니다. `AccountApplicationsAuthGuard`가 `accountApplicationsToken`이 없으면 내용을 숨기고 메디스트림 로그인으로 보냅니다. 이 스토어는 persist하지 않아 새로고침하면 SSO를 다시 거칩니다
- **화면 구성:** `AccountApplicationsLayout` 안에서 단계(`e`)에 따라 컴포넌트를 바꿉니다

  | 단계 | 컴포넌트 | 내용 |
  |---|---|---|
  | `Step계산중` | 스피너 | 신청 조회 중 |
  | `차트선택` | `AccountApplicationsStepSelectChart` | "가입할 차트를 선택해주세요." 차트 라이트 / 차트 라이트 실손 / 업스트림 차트 / 메디원탕, "로그인 페이지로 돌아가기" |
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
    - 차트 라이트 / 실손 → `sooSignUp.from = "auth-onboarding"`, `실손여부`를 false/true로 정하고 메디스트림 로그인(`state=soo`)으로 갑니다
    - 업스트림 차트 → `차트사용여부확인`
    - 메디원탕 → `ondang-sign-up`. `GET /auth/check-ssoid`가 `원탕금곡가입여부 && available`일 때만 켜집니다. 부제는 상태에 따라 "이미 가입된 계정입니다…" 또는 "공동이용계약을 먼저 완료해주세요"로 바뀝니다
  - 계정 신청 폼 (vee-validate + yup, `re-upstream/restored/views/OnboardingView.helpers.js`):

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
- **근거:** `re-upstream/restored/views/OnboardingView.vue`, `re-upstream/restored/views/OnboardingView.vue.js`, `re-upstream/restored/components/account/AccountApplicationsForm.vue.js`, `re-upstream/restored/components/account/AccountApplicationsFormTermsAgreement.vue.js`, `re-upstream/restored/components/account/AccountApplicationsFormHospitalInfo.vue.js`, `re-upstream/restored/components/account/AccountApplicationsRejected.vue.js`, `re-upstream/restored/components/account/AccountApplicationsStepSelectChart.vue.js`, `re-upstream/restored/modules/OnboardingView/prefetchAccountApplicationApplicationsQuery.js`, `re-upstream/restored/api/accountApplications/client.js`, `re-upstream/restored/api/account-applications/query-keys.js`

## 차트 라이트(수) 가입 — `/sign-up/soo` (`soo-sign-up`), `/sign-up/soo/form` (`soo-sign-up-form`)

- **목적:** 수 멤버스 회원이 차트 라이트(비급여 차트) 계정을 만들거나, 기존 업스트림 계정에 수 서비스를 연동합니다. 차트 라이트 실손은 실손 조회 계정을 만듭니다
- **접근 조건:** 공개
  - `/sign-up/soo`는 진입 즉시 `실손여부=false`로 정하고 메디스트림 로그인(`state=soo`)으로 보냅니다
  - 폼은 콜백이 넣어 둔 `sooSignUp.authToken`을 `accountApplicationClient` 헤더로 씁니다
- **화면 구성:**
  - `SooSignUpFormView`는 어댑터(`wu()`)를 붙인 공용 `ServiceSignUpFormView`입니다. 레이아웃은 `ServiceSignUpLayout`(단계 표시, 이전/다음)입니다
  - 단계 구성 (`flowType`은 `?flowType` > 스토어 > `signup`):

    | 경우 | 단계 |
    |---|---|
    | `link` | `3A` → `3B` |
    | 수 프로필 있음 | `confirm` → `3B` (→ 직원 계정이 있으면 `3C`) |
    | 프로필 없음 | `1` → `2` → `3A` → `3B` (→ `3C`) |

  - 단계별 내용:
    - `1` `ServiceSignUpStep1`: 대표 원장명, 휴대폰 번호
    - `2` `ServiceSignUpStep2`: 상호, 사업자등록번호, 요양기관 기호(8자리, "아직 없습니다" 체크), 주소(`SearchAddress`), 한의원 전화번호
    - `3A` `SooSignUpStep3A`: 제공 서비스 소개. 버튼 문구는 "업스트림 차트 계정 생성"이고, `link`면 "수 서비스 연동하기"입니다
    - `3B` `ServiceSignUpStep3B`: 아이디(한글·영문·숫자 2~15자), 비밀번호/확인, 약관("필수 약관 모두 동의", 전문 보기)
    - `3C` `ServiceSignUpStepStaff`: 수 멤버스 센터에서 쓰던 직원 계정 이관. 실손이 아니고 `signup`일 때만 나옵니다
    - `confirm` `ServiceSignUpStepConfirm`: 수 프로필 값(이름·휴대폰·상호·사업자번호·주소·전화)을 미리 채워 확인합니다. 수정 모달이 있습니다
  - 실손 가입이면서 수 프로필이 있으면 "수멤버스 계정 연동하기" 체크박스가 나옵니다
- **동작:**
  - 마운트: 수 프로필이 있으면 값을 채우고 `GET /integrations/onboarding/soo/employees` → `subUsers`로 직원 후보를 불러옵니다
  - 제출 전 `POST /auth/check-username-onboarding`. `available` false면 서버 `message`를 띄웁니다. `link`면 이 확인을 건너뜁니다
  - 제출:

    | 조건 | 호출 | 결과 |
    |---|---|---|
    | `link` | `POST accountClient /integrations/soo/link` `{ migration }` | "수 서비스 연동이 완료되었습니다." → `auth-login` |
    | 실손이고 연동 체크 안 함 | `POST /integrations/onboarding/insurance/signup` | `lastLoginType=insurance`. 착지는 `서비스연동`이 insurance 하나면 `insurance-inquiry`, 아니면 `crm-nonbenefit-patients` |
    | 그 밖 | `POST /integrations/onboarding/soo/signup` (`직원목록` 포함 가능) | `lastLoginType=soo`, `crm-nonbenefit-patients` |

    - 본문 공통(`Qd`): `{ 아이디, 비밀번호, 이름, 휴대폰번호, 병원명, 주소, 사업자등록번호, 약관동의목록, 요양기관기호? }`에 `지번주소`, `주소원본`, `한의원전화번호` 등을 붙입니다
    - 연동을 체크하면 `약관동의목록`에 `upstream-soo-chart-migration-agreement` 동의를 추가합니다
  - 응답의 `accessToken`/`refreshToken`/`sub`를 `userAuthData`에 저장합니다 → `/auth/me` `서비스연동`을 합칩니다 → `auth:login` → 스토어를 초기화하고 착지 화면으로 `replace`
  - 오류: 400 "입력 정보를 확인해 주세요.", 401 "인증이 만료되었습니다." → 로그인, 403 "회원가입에 실패했습니다.", 409 "이미 가입된 계정입니다.", 그 밖 `submitErrorTitle`
  - 첫 단계에서 "취소"를 누르면 `sooSignUp.from`, 없으면 `auth-login`으로 갑니다
- **데이터:** 약관 `GET /terms?type=signup&service=soo` → `terms[]`. 수 프로필 필드: `이름`, `휴대폰번호`, `병원명`, `한의원전화번호`, `사업자등록번호`, `주소`
- **상태 저장:** `useSooSignUpStore`(sessionStorage): `authToken`, `integrationStatus`, `sooProfile`, `flowType`, `from`, `실손여부`, `migration`, `completedData`
- **근거:** `re-upstream/restored/views/SooSignUpView.vue.js`, `re-upstream/restored/views/SooSignUpFormView.vue.js`, termsWithoutDetailPage.js (어댑터 `wu`) (`re-upstream/restored/modules/SooSignUpFormView/termsWithoutDetailPage.js`), `re-upstream/restored/views/ServiceSignUpFormView.vue`, `re-upstream/restored/views/ServiceSignUpFormView.vue.js`, `re-upstream/restored/views/ServiceSignUpFormView.helpers-3.js`, `re-upstream/restored/stores/sooSignUp.js`

## 메디원탕(원외탕전) 가입 — `/sign-up/ondang` (`ondang-sign-up`), `/sign-up/ondang/form` (`ondang-sign-up-form`)

- **목적:** 메디마켓 원외탕전 공동이용계약을 마친 한의원이 원외탕전용 계정을 만듭니다
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

  - `confirm` 단계에서 수 프로필이 있으면 "수멤버스 계정 연동하기" 체크박스를 보여 줍니다
- **동작:**
  - `GET /integrations/onboarding/wontang/profile`
    - 오류이거나 `원탕금곡가입여부`가 false면 "공동이용계약을 먼저 완료해 주세요."를 띄우고 `from`, 없으면 `auth-login`으로 갑니다
    - 성공하면 `대표자명`·`병원명`·`사업자등록번호`·`주소`·`휴대폰번호`로 사업자 정보를 채웁니다
  - 마운트 시 `GET /integrations/onboarding/soo/profile`로 수 프로필이 있는지 확인합니다. 실패하면 `null`입니다
  - 계정 검증:
    - 아이디 `^[가-힣a-zA-Z0-9]{2,15}$`, 중복 메시지 없음
    - 비밀번호: 공백 없음, 소문자 포함, 8자 이상, 추가 규칙 `Btn`(특수문자 등, 추정), 확인 값 일치
    - 약관: 필수 약관 전체 동의
  - "가입 완료":
    1. `POST /auth/check-username-onboarding`
    2. 가입 호출
       - 수 연동을 체크하고 수 프로필이 있으면 `POST /integrations/onboarding/soo/signup`. 약관에 마이그레이션 동의를 추가합니다
       - 아니면 `POST /integrations/onboarding/wontang/signup` `{ 아이디, 비밀번호, 약관동의목록, 직원목록? }`
    3. 토큰 저장 → `/auth/me` → `lastLoginType`(`soo` 또는 `ondang`) → `auth:login` → `crm-nonbenefit-patients`
  - 오류: 400 입력 확인, 409 "이미 가입된 계정입니다."(서버 `message` 우선), 그 밖 "회원가입 중 오류가 발생했습니다."
- **데이터:** 약관 `GET /terms?type=signup&service=wontang`. 가입 신청 토큰을 `accountApplicationClient` 기본 헤더로 씁니다
- **상태 저장:** `useOndangSignUpStore`(sessionStorage): `authToken`, `ondangProfile`, `flowType`, `from`, `원탕전용약관여부`, `completedData`. query key `["ondangSignUp", "checkSsoId" | "profile" | "terms"]`
- **근거:** `re-upstream/restored/views/OndangSignUpView.vue.js`, `re-upstream/restored/views/OndangSignUpFormView.vue`, `re-upstream/restored/views/OndangSignUpFormView.vue.js`, `re-upstream/restored/api/auth/queries.js`, `re-upstream/restored/stores/ondangSignUp.js`

## 가입 완료 — `/sign-up/soo/complete` (`soo-sign-up-complete`), `/sign-up/ondang/complete` (`ondang-sign-up-complete`)

- **목적:** 가입 결과(대표자·한의원·계정 정보)를 요약하고 다음 행동을 안내합니다
- **접근 조건:** 공개. 각 스토어의 `completedData`가 없으면 마운트 즉시 `auth-login`으로 `replace`합니다
- **화면 구성:**
  - 수: 대표자명, 휴대폰 번호, 상호, 사업자등록번호, 요양기관 기호(있을 때), 소재지, 한의원 전화번호, 아이디. 버튼 "차트 라이트 보기", "원외탕전 계약하러 가기"
  - 원탕: "원외탕전 가입을 완료했습니다." 사업자명, 대표자명, 사업자등록번호, 주소, 전화번호, 아이디. 버튼 "로그인하기", "원외탕전 계약하러 가기"
- **동작:**
  - "차트 라이트 보기" → 스토어 초기화 → 메디스트림 로그인(`state=soo`)
  - "로그인하기" → `auth-login`
  - "원외탕전 계약하러 가기" → 수 멤버스 센터를 새 탭으로 열고 `auth-login`으로 갑니다
- **데이터:** 없음 (스토어 `completedData`만)
- **상태 저장:** `sooSignUp.completedData`, `ondangSignUp.completedData`
- **근거:** `re-upstream/restored/views/SooSignUpCompleteView.vue`, `re-upstream/restored/views/OndangSignUpCompleteView.vue`

## 약관 보기 — `/terms/:documentNumber` (`terms-content`), `/terms/doctalk/:type` (`doctalk-terms`)

- **목적:** 가입·동의 화면에서 새 탭으로 여는 약관 전문 페이지입니다
- **접근 조건:** 공개
- **화면 구성:**
  - `TermsContentView`: 로딩 문구 "약관을 불러오는 중..." → `v-dompurify-html`로 본문 표시. 없으면 "약관 내용을 불러올 수 없습니다."
  - `DoctalkTermsView`: 로고, 고객센터 전화 안내, 제목, 스크롤 박스
- **동작:**
  - `terms-content`: `GET medistreamClient /marketing-agreement/terms/list?domain=…`를 두 번 호출합니다. 도메인은 EMR용과 MEMBERS용입니다. 응답 목록에서 `documentNumber`가 일치하는 항목의 `contents`를 보여 줍니다
  - `doctalk-terms`: 번들에 내장된 HTML을 `:type`으로 고릅니다
    - `service` "닥톡 예약중개 이용약관"
    - `privacy` "닥톡 개인정보취급방침"
    - `thirdParty` "개인정보 제3자 제공 동의서"
    - `DoctalkSignupModal`에서 엽니다
- **데이터:** `GET /marketing-agreement/terms/list` → `[{ documentNumber, contents, … }]`
- **상태 저장:** query key `["terms","list",<domain>]`, staleTime 30분
- **근거:** `re-upstream/restored/views/TermsContentView.vue.js`, `re-upstream/restored/api/terms/query-keys.js`, `re-upstream/restored/api/marketing-agreement/requests.js`, `re-upstream/restored/views/DoctalkTermsView.vue.js`

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
- **근거:** `re-upstream/restored/api/unified-terms/query-keys.js`, `re-upstream/restored/api/terms/requests.js`, `re-upstream/restored/components/unified/UnifiedTermsConsentScreen.vue`, `re-upstream/restored/views/CrmView.vue`

## 로그아웃 — `/logout` (`logout`)

- **목적:** 로컬 세션과 캐시를 모두 지우고 SSO 로그아웃을 거쳐 로그인 화면으로 돌아갑니다
- **접근 조건:** `requiresAuth`
- **화면 구성:** 빈 `div`
- **동작** (`onMounted`):
  1. Sentry 사용자 정보를 비웁니다 (`setUser({})`)
  2. `auth:logout`을 보냅니다 → `App`이 소켓을 끊고 멤버스 권한 캐시 등을 초기화하고 draft를 삭제합니다
  3. 돌아갈 경로를 정합니다: `lastLoginType`이 `soo`면 `/login/soo`, 아니면 `/login`
  4. localStorage `userAuthData`, 실손 선택 환자 ID, 실손 선택 환자를 삭제합니다
  5. `queryClient.clear()`
  6. Pinia 스토어를 리셋합니다: `aiAgent`, `claimWarning`, `deskDate`, `patient`, `treatment`, `window`, `toastNotification`, `medicalAids`, `socketClient`
  7. `clearAllDrafts()`로 IndexedDB의 진료기록 임시 저장분을 지웁니다
  8. `auth-api …/api/auth/sso/logout?redirect_uri=<origin><경로>`로 `location.replace`합니다
- **상태 저장:** `lastLoginType`은 남깁니다
- **근거:** `re-upstream/restored/views/LogoutView.vue.js`, `re-upstream/restored/stores/window.js`, `re-upstream/restored/modules/index/clearAllDrafts.js`, `re-upstream/restored/components/app/App.vue.js`

## 토큰 저장·갱신

| 항목 | 내용 |
|---|---|
| 요청 인터셉터 (`TRe`) | `userAuthData.accessToken`이 있으면 `Authorization: Bearer …`를 붙입니다 |
| 적용 클라이언트 (`Rf`) | `emrClient`, `accountClient`, `crmClient`, `thesooClient`, `medistreamClient`, `syncClient`, `insuranceClient`, `biClient`, `webClient` |
| 미적용 | `authClient`(`withCredentials: true`, timeout 10s), `accountApplicationClient`(가입 토큰을 `defaults.headers.common.Authorization`에 직접 넣음) |
| 갱신 조건 (`RRe`) | 응답이 401이고, `_retry`가 아니고, URL이 `/desk/appointments/order/soo/`를 포함하지 않을 때 |
| 동시성 | 갱신 중(`K2`)에 들어온 401은 대기열(`$Re`)에 넣었다가 새 토큰으로 재시도합니다. 탭 사이에서는 `navigator.locks` `upstream-emr:token-refresh`로 직렬화합니다. 락 안에서 저장된 `refreshToken`이 바뀌어 있으면 다른 탭이 이미 갱신한 것으로 보고 그 값을 씁니다 |
| 호출 | `POST authClient /token/refresh` `{ refreshToken, sub }` → `results`를 `userAuthData`에 병합 |
| 실패 판정 (`kRe`) | 상태 없음·408·429는 일시 실패 → `null`을 반환하고 세션을 유지합니다. 500 미만은 확정 실패입니다. 500 이상은 메시지에 `NotAuthorizedException`/`UserNotFoundException`이 있을 때만 확정 실패입니다 |
| 확정 실패 처리 | `userAuthData` 삭제 → `clearAllDrafts()` → `/login`이 아니면 `location.href = "/login"`. Sentry 태그 `token-refresh: failure / transient-failure` |
| 외부 채널 | `getAuthToken$({ withRefresh })`로 소켓 등도 같은 토큰을 씁니다 ([non-axios-channels.md](../non-axios-channels.md)) |
| 기타 | `insuranceClient`가 403 `INS_HOSPITAL_CONSENT_REQUIRED`를 받으면 전역 카운터(`URe`)를 올립니다. 병원 동의 모달 트리거로 보입니다 (추정) |

- **근거:** `re-upstream/restored/modules/index/getAuthToken.js`, `re-upstream/restored/lib/index/part-4.js`, `re-upstream/restored/lib/index/baseURL.js`, `re-upstream/restored/api/clients/webClient.js`, `re-upstream/restored/api/clients/authClient.js`

## 흐름

**A. 업스트림 차트(청구용) 신규 가입 → 승인 → 홈**
1. `/login`에서 "메디스트림 계정으로 시작하기"를 누르면 메디스트림 로그인을 거쳐 `/auth/callback?code=…`로 돌아옵니다
2. `POST /sso/medistream/token`이 실패하고 `sso_token`이 오면 신규입니다. `POST /account-application/token`으로 받은 가입 토큰을 메모리 스토어에 넣고 `/onboarding`으로 갑니다
3. `GET /account-application/applications`가 비어 있으면 차트 선택 → "업스트림 차트" → 사용 중인 차트 여부 → 4단계 폼 → `POST /account-application/applications`
4. `신청완료` 요약 화면이 나옵니다. 다시 들어오면 `승인대기`입니다. 반려되면 `반려` 화면에서 서류를 보완해 `PUT …/supplement`로 다시 냅니다
5. 승인 후(서버 처리) 다시 "메디스트림 계정으로 시작하기"를 누르면 `POST /sso/medistream/token`이 토큰을 돌려줍니다. 세션을 저장하고 `home`으로 갑니다. `home`은 `서비스연동`/`chartLayout`으로 `desk` 등을 고릅니다 (추정: 승인되면 SSO 토큰 교환이 성공하는 것으로 보임)

**B. 차트 라이트(수) 가입**
1. `/onboarding` 차트 선택에서 "차트 라이트"를 고르거나 `/sign-up/soo`로 들어오면 메디스트림 로그인(`state=soo`)을 거쳐 `/auth/callback`으로 돌아옵니다
2. 가입 토큰 발급 → `check-ssoid` → 수 프로필 → `GET /integrations/soo`
   - `linked`면 로그인으로 갑니다
   - 아니면 `/sign-up/soo/form?flowType=signup|link`로 갑니다
3. 폼 제출이 성공하면 바로 로그인 상태가 되어 `crm-nonbenefit-patients`로 갑니다. 실손 가입은 `insurance-inquiry`로 갈 수 있고, `link`는 로그인 화면으로 갑니다

**C. 메디원탕 가입**
1. `/onboarding` 차트 선택에서 "메디원탕"을 고릅니다. `원탕금곡가입여부 && available`일 때만 켜집니다
2. `/sign-up/ondang` → `/sign-up/ondang/form` → 계약 프로필 확인 → 5단계 → 원탕(또는 수) 가입 → `crm-nonbenefit-patients`

**D. 일반 로그인 / 세션 만료 / 로그아웃**
1. `/login` → `POST /login` → `GET /auth/me` → `?redirect` 또는 계정 홈
2. API가 401을 받으면 토큰을 갱신하고 재시도합니다. 확정 실패면 세션을 지우고 `/login`으로 갑니다
3. `/logout` → 로컬 정리 → SSO 로그아웃 → `/login` 또는 `/login/soo`

**E. 계정 잠금**
1. 로그인이 `AE_AUTH_ACCOUNT_LOCKED`로 실패하면 "휴대폰 본인인증으로 잠금 해제"를 누릅니다
2. `/login/unlock?id=…` → OTP 요청·확인 → 완료 → `/login`

## 미확인·추정

- `soo-sign-up-complete`·`ondang-sign-up-complete`로 이동하거나 `completedData`를 채우는 코드를 복원 트리에서 찾지 못했습니다. 지금은 두 가입 폼 모두 성공 시 바로 로그인시켜 다른 화면으로 보냅니다. 완료 화면은 직접 열면 로그인으로 돌아가는, 사실상 쓰이지 않는 라우트일 수 있습니다 (추정)
- `/login/soo`는 `/login`으로 redirect만 하므로, 가드와 로그아웃이 `soo-login`·`/login/soo`로 보내도 같은 로그인 화면이 열립니다. 화면에서 `?refer=logout`을 읽는 코드는 없습니다
- 응답 인터셉터 `RRe`는 `userAuthData`가 비어 있으면 아무것도 반환하지 않습니다(`return;`). 그 결과 로그인 정보가 없을 때 실패한 요청이 reject되지 않고 `undefined`로 resolve됩니다 (코드상 동작, 의도는 미확인)
- 온보딩은 신청 `상태`가 `rejected`가 아니면 모두 `승인대기`로 보여 줍니다. `approved`도 여기에 포함되며, `approved`를 구분하는 곳은 취소 처리뿐입니다
- `AccountApplicationsAuthGuard`가 의존하는 `accountApplicationsToken` 스토어는 persist하지 않습니다. 그래서 `/onboarding`을 새로고침하면 메디스트림 로그인을 다시 거칩니다 (코드상 동작)
- `MedistreamAuth`는 `?refresh_token`도 읽어 emit하지만 콜백 처리기는 `code`만 씁니다
- 수 가입 폼의 3A 화면이 수 연동 이전 계정과 어떻게 다른지, `migration` 플래그를 누가 켜는지는 확인하지 못했습니다
- `auth:login`/`auth:logout`을 받는 `App` 핸들러의 일부 함수(`$`, `T`, `yct`, `CHe`, `KHe`, `zmt`)는 이름이 복원되지 않아 정확한 역할을 모릅니다
- 승인 이후 첫 로그인에서 비밀번호 로그인과 SSO 중 어느 쪽을 주 경로로 쓰는지는 서버 정책에 달려 있습니다 (추정)
