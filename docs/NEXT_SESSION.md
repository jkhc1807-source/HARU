# 다음 작업 이어가기

마지막 갱신: 2026-09-23

새 세션을 열면 이 문서부터 읽는다. `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`가 그 다음이다.

## 새 세션 시작 문구

> `AGENTS.md`와 `docs/NEXT_SESSION.md`를 읽고 하루여행 작업을 이어서 해줘.

## 지금 상태 한 줄

먹·애시드 디자인 개편, UX 전수 점검, 로그인 화면 점검에 이어 사파리·접근성·관리자 화면·성능까지 확인해 `main` 에 배포했다. 로그인 시 일정이 사라지던 데이터 손실을 고쳤고, 폰트 로딩을 바꿔 LCP 를 3.61초에서 2.35초로 내렸다. 남은 일은 실기기 아이폰 확인뿐이고, 그건 사람이 해야 한다.

## 환경

| 항목 | 값 |
| --- | --- |
| 운영 주소 | https://haru-ashy-rho.vercel.app (Vercel, `main` 자동 배포) |
| 예전 Sites 주소 | https://haru-trip-planner.njhina48.chatgpt.site (**옛 버전에서 멈춤**, 아래 참고) |
| Git 원격 | `github` = https://github.com/jkhc1807-source/HARU (**이걸 쓴다**) |
| 못 쓰는 원격 | `origin` = chatgpt-team.site (인증 불가) |
| Supabase 프로젝트 ref | `boanglpsvhcqjephlsjr` |
| 관리자 계정 | `profiles.role = 'admin'` 인 계정 1개 지정 완료 |

### 환경변수

`.env.local` (로컬 전용, Git에 올리지 않는다)

```
KAKAO_JAVASCRIPT_KEY=
NEXT_PUBLIC_SUPABASE_URL=https://boanglpsvhcqjephlsjr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Vercel Production 에는 위 3개에 더해 `SUPABASE_SERVICE_ROLE_KEY` 가 Secret 타입으로 등록되어 있다. 이 값은 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 2026-09-11 배포 번들을 검사해 클라이언트로 새어 나가지 않음을 확인했다.

### 외부 설정 (이미 완료)

- 카카오 디벨로퍼스 Web 플랫폼: `http://localhost:3000`, 운영 주소 2개 등록
- Supabase 마이그레이션 2건 적용: `202609110001_favorite_origins.sql` → `202609110002_admin_audit_logs.sql`
- Supabase Google OAuth 활성, 운영 복귀 주소 등록

## 새 PC에서 처음 시작할 때

클론만으로는 동작하지 않는다. `.env.local` 은 키가 들어 있어 Git에 올리지 않으므로 새 PC에서 직접 만들어야 한다.

1. 클론

   ```bash
   git clone https://github.com/jkhc1807-source/HARU.git
   cd HARU
   npm install
   ```

2. 프로젝트 루트에 `.env.local` 파일을 만들고 아래 3줄을 채운다.

   ```
   KAKAO_JAVASCRIPT_KEY=
   NEXT_PUBLIC_SUPABASE_URL=https://boanglpsvhcqjephlsjr.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   - `KAKAO_JAVASCRIPT_KEY`: 카카오 디벨로퍼스 → 내 애플리케이션 → 앱 키 → JavaScript 키
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase → Settings → API Keys → Publishable key (`sb_publishable_...`)

   기존 PC의 `.env.local` 을 그대로 복사해도 된다. 메신저나 이메일로 보내지 않는다.

   `SUPABASE_SERVICE_ROLE_KEY` 는 로컬에 넣지 않는다. Vercel Production 에만 등록되어 있으면 되고, 로컬 `/admin` 은 그 키가 없으면 `관리자 기능이 아직 설정되지 않았어요` 를 보여준다. 그게 정상이다.

3. `npm run dev` 후 http://localhost:3000 접속. 지도에 `카카오맵이 연결됐어요` 가 뜨면 준비 끝이다.

   `카카오 도메인 등록을 확인해주세요` 가 뜨면 포트가 3000이 아니거나 카카오 콘솔에 도메인이 빠진 것이다. 카카오 콘솔 설정은 앱 단위라 PC를 바꿔도 그대로 유효하다.

4. 로컬에서 구글 로그인까지 시험하려면 Supabase → Authentication → URL Configuration → Redirect URLs 에 `http://localhost:3000/**` 가 있어야 한다. `Site URL` 은 운영 주소 그대로 두고 건드리지 않는다.


## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:3000 (카카오 도메인이 3000에만 등록되어 있으므로 포트 고정 필요)
```

3000이 이미 점유되어 있으면 vinext가 조용히 3001, 3002로 옮겨 가고 그러면 지도가 뜨지 않는다. 포트를 잡고 있는 프로세스를 정리한 뒤 다시 띄운다.

### 검증

```bash
npx tsc --noEmit                     # 타입
npm test                             # vinext build + 테스트 19개
npx next build                       # Vercel 배포 경로. 배포 전 반드시 이걸로 확인한다
```

`npm run build`(vinext)와 `npx next build`(Next.js)는 서로 다른 경로다. Sites는 전자, Vercel은 후자를 쓴다.

`npx eslint .` 는 **이번 작업 이전부터** 24건 실패하고 있었고 지금은 28건이다. 늘어난 4건은 기존 코드에 이미 있던 `react-hooks/set-state-in-effect`와 같은 계열이다. 빌드·테스트와 무관하다.

## 2026-09-11에 한 일

| 기능 | 핵심 파일 |
| --- | --- |
| 실제 출발지 분리 (검색·내 위치·즐겨찾기) | `app/page.tsx`, `lib/origin-storage.ts`, `lib/favorite-origin-repository.ts` |
| 일정 이미지 저장 (Canvas 직접 렌더링) | `lib/trip-image.ts` |
| 관리자 통계·계정 차단 | `app/admin/page.tsx`, `app/api/admin/**`, `lib/admin-access.ts`, `lib/supabase/admin-server.ts` |
| 순서 이동 후 포커스·안내 | `app/page.tsx` `handleMoveSpot` |

설계 근거는 `docs/superpowers/specs/2026-09-01-origin-auth-transit-admin-design.md`, 작업 계획은 `docs/superpowers/plans/2026-09-11-origin-image-admin-a11y.md` 에 있다.

### 설계 판단 기록

- **공유 링크에 출발지를 넣지 않는다.** 집·회사 주소가 링크로 새어 나가지 않게 하기 위해서다. 저장 일정에는 포함된다.
- **관리자 API는 주소와 일정 본문을 조회하지 않는다.** 개수만 센다.
- **이미지 저장은 800px 이하에서만 공유 시트를 쓴다.** 데스크톱 Chrome도 `navigator.canShare({files})`에 true를 돌려주기 때문에 화면 폭으로 갈라야 저장 버튼이 저장으로 동작한다.
- **로그아웃·계정 전환 시 이 기기의 즐겨찾기를 비운다.** 한 컴퓨터를 여러 사람이 쓸 때 앞사람의 집 주소가 뒷사람 계정으로 올라가는 것을 막는다. 저장 일정도 같은 방식이다. 계정에 이미 동기화된 즐겨찾기는 다시 로그인하면 돌아온다.
- **`tsconfig.json`에 `allowImportingTsExtensions: true`** 를 켰다. `lib/trip-sync.ts`가 `origin-storage`를 값으로 import 하는데 Node ESM 로더가 확장자 없는 경로를 풀지 못해 테스트가 깨졌기 때문이다. `isOrigin`을 복제하는 대신 확장자를 명시했다.

## 남은 일

### 검증 (사람이 직접 해야 함)

- [ ] **먹·애시드 개편 실기기 확인** — 형광 라임이 실제 화면에서 너무 강하지 않은지, 하드 섀도가 잘리지 않는지.
- [ ] **서로 다른 구글 계정 2개로 데이터 분리 확인** — 계정이 2개 있으므로 바로 가능하다. 시크릿 창을 쓰고, 로그인 직후 뜨는 `이 기기에 저장된 일정을 계정에 동기화할까요?`에 **취소**를 눌러야 결과가 오염되지 않는다.
- [ ] **로그아웃 시 즐겨찾기 정리 동작 확인** — A로 로그인해 즐겨찾기를 만들고 로그아웃한 뒤, 같은 창에서 B로 로그인했을 때 A의 즐겨찾기가 넘어가지 않아야 한다. 코드와 테스트로만 확인했고 실제 로그인 경로는 미확인이다.
- [ ] **실기기 터치와 가상 키보드** — 에뮬레이터로 대체 불가.

로그인이 필요한 검증은 자동화 브라우저로 할 수 없다. 구글이 원격 제어되는 브라우저의 OAuth를 차단하기 때문이다(`로그인할 수 없음`). 우회하지 않는다. 사람이 직접 하고 결과를 알려주는 방식으로 진행한다.

### 정리

- [ ] **Sites 주소 처리 결정** — `haru-trip-planner.njhina48.chatgpt.site`는 코덱스 내부 Git(`origin`)으로 배포되는데 그 원격에 접근할 수 없어 옛 버전에 멈춰 있다. 계속 쓸 주소인지 정하고, 쓸 거면 배포 방법을 찾는다. 안 쓰면 문서에서 정리한다.
- [x] **ROADMAP 과거 항목 정리** — Phase 3의 `여러 일정 저장`, `공유 링크 생성`, `모바일 공유 시트`가 코드상 구현되어 있음을 확인하고 체크 표시했다 (`lib/saved-trip-repository.ts`, `app/page.tsx`의 `#trip=` 공유 링크와 이미지 공유 시트). 실기기 동작 재확인은 아니고 코드 존재 확인이다.

### 다음에 만들 만한 것

- **대중교통 경로 조회** (설계문서 3단계). 지금은 출발지 주변 지하철·버스 *이름*만 보여준다. 실제 소요시간·요금·환승은 카카오 REST 대중교통 API가 필요하고, **키 발급과 무료 쿼터 확인이 선행되어야 한다.** 토이 프로젝트 원칙상 유료 전환은 사용자 동의 없이 하지 않는다.
- 관리자 추천 지역·공지 콘텐츠 관리 (설계문서 4단계 나머지)
- 영업시간·휴무일 반영

## 알아두면 좋은 함정

- `app/page.tsx`는 1400줄이 넘는다. 수정 전에 관련 상태와 effect를 먼저 읽는다.
- 파일 줄바꿈이 **CRLF**다. 문자열 치환 스크립트를 쓸 때 `\n`으로 매칭하면 실패한다.
- 출발지가 설정되면 `transitBySpot`이 `origin` 키로 채워지고, 없으면 첫 장소의 `spot.id` 키로 채워진다. 표시 위치도 각각 출발지 영역과 일정 카드로 다르다.
- 관리자 API의 공통 인증 헬퍼 `requireAdminUser`는 `app/api/admin/stats/route.ts`에 있고 다른 두 라우트가 거기서 import 한다. Next.js 16과 vinext 모두 이 형태를 허용하는 것을 빌드로 확인했다.
- `public/map-config.json`은 빌드 때 생성되며 Git에 올리지 않는다. 카카오 키가 들어간다.
- 로컬 `.env.local`의 `KAKAO_JAVASCRIPT_KEY`가 비면 `npm run dev`와 `npm run build`가 즉시 실패한다. 키 없이 빌드만 확인할 때는 `KAKAO_JAVASCRIPT_KEY=<20자 이상 아무 문자열> npm run build`처럼 환경변수로 넘긴다. 단 이 경우 지도는 렌더링되지 않으므로 지도 확인은 운영 배포본으로 한다.
- Vercel은 `pnpm-lock.yaml`로 `frozen-lockfile` 설치를 한다. `npm i`로 의존성을 추가하면 pnpm 락파일이 갱신되지 않아 배포가 설치 단계에서 실패한다. UI 감사 도구(`scripts/audit-run.mjs`)가 쓰는 playwright를 의존성에 넣지 않고 필요할 때만 설치하는 이유다(`npm i -D playwright && npx playwright install chromium`).
- `.stop-card` 에는 `transform` 이 걸려 있어 그 자체가 스태킹 컨텍스트다. 카드 안쪽 요소에 `z-index` 를 줘도 카드 밖 형제(`.between-stops` 등)를 이기지 못한다. 카드를 올려야 한다.
- 알림(`notice`)은 지도 옆 `.map-status` 와 화면 위 토스트 두 곳에 나온다. 토스트는 최초 1건(지도 연결 안내)을 건너뛰고, `updatePlan` 을 거친 변경에는 되돌리기 버튼을 단다.
- `updatePlan` 은 안에서 `setIsPlanAutoGenerated(false)` 를 부른다. 시간 변경 자동 재조정처럼 자동 생성 상태를 유지해야 하는 경로에서는 쓰면 안 된다.
- `npm run dev` 를 여러 번 띄우면 종료 후에도 프로세스가 남아 3000 번대 포트를 점유한다. dev 가 갑자기 500 을 내면 좀비 서버부터 의심한다.
- mount effect 가 localStorage 를 읽어 state 에 넣는 **같은 커밋**에서, 그 state 를 저장하는 effect 는 아직 낡은 값을 본다. "읽기를 마쳤다" 표시를 `useRef` 로 두면 이 낡은 값이 저장돼 버린다. 반드시 `useState` 로 둬서 값이 채워진 다음 렌더에서만 저장하게 한다. 2026-09-22 데이터 손실의 원인이다.
- 알림 채널이 셋이다. `notice`(토스트 + 지도 옆 `.map-status`), `authNotice`(헤더 팝오버, 닫는 방법 없음), `originNotice`(출발지 영역). 실패 문구를 어디에 띄울지 정할 때 이미 떠 있는 성공 토스트와 모순되지 않는지 본다.
- `notice` 의 초기값은 빈 문자열이 아니라 `"샘플 일정으로 체험 중이에요"` 다. "첫 알림은 건너뛴다" 식의 장치는 이 초기값을 먼저 소비하므로, 특정 알림에 토스트를 띄우지 않으려면 `toastSilentRef` 를 쓴다.
- 로그인 상태를 검사할 때는 실제 구글 로그인을 자동화하지 말고 Supabase 응답을 가로챈다. 세션을 `sb-<프로젝트 ref>-auth-token` 으로 localStorage 에 심고 `**/rest/v1/**` 을 `page.route` 로 가로채면 된다. 개발 서버는 StrictMode 로 effect 가 두 번 돌아 결과가 달라지니 최종 확인은 운영 배포본으로 한다.
- 전송량을 잴 때 `content-length` 헤더는 압축 응답에 없어 0 으로 잡힌다. `performance.getEntriesByType("resource")` 의 `encodedBodySize` 로 재야 한다. URL 로 종류를 나눌 때도 조심한다 — `cdn.jsdelivr.net` 은 정규식 `/\.js/` 에 걸려 폰트가 JS 로 집계된다.
- playwright 는 `package.json` 에 없지만 `node_modules` 에 남아 있어, 스크립트에서 절대경로(`file:///…/node_modules/playwright/index.js`)로 import 하면 쓸 수 있다. 사파리 확인용 WebKit 은 `npx playwright install webkit` 으로 따로 받는다.
- 폰트는 `app/globals.css` 맨 위에서 9종을 직접 선언한다(`font-display:swap`). 원격 `SUIT.css` 를 `@import` 하던 방식으로 되돌리면 느린 회선에서 글자가 3초간 안 보이는 상태가 그대로 돌아온다.
