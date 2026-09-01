# Supabase 구글 로그인·일정 저장 구현 계획

> 이 문서는 작업을 순서대로 진행하고 완료 여부를 체크하기 위한 실행 계획입니다. 구현할 때 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 절차를 사용합니다.

**목표:** 기존 비로그인 일정 기능과 브라우저 저장을 유지하면서, 선택적으로 구글 로그인하고 저장 일정을 여러 기기에서 동기화할 수 있게 합니다.

**구조:** 현재 일정 상태는 기존 `app/page.tsx`가 계속 관리합니다. Supabase 연결 파일, 작은 로그인 UI, 일정 저장 모듈만 추가하고 데이터 보안은 Supabase RLS가 담당합니다. 비로그인 사용자는 지금처럼 `localStorage`를 사용하며, 로그인 사용자는 같은 일정 데이터를 Supabase에도 저장·불러오기·삭제합니다.

**사용 기술:** Next.js/Vinext, React 19, TypeScript, `@supabase/supabase-js`, Supabase 구글 로그인(PKCE), Supabase Postgres/RLS, Node 테스트.

**기준 설계:** `docs/superpowers/specs/2026-09-01-origin-auth-transit-admin-design.md`

## 사용자가 알면 되는 핵심 요약

1. 지금 사용하던 비로그인 일정 기능은 그대로 유지합니다.
2. `Google로 로그인` 버튼을 추가합니다.
3. 로그인하면 저장 일정이 Supabase 계정에 저장되어 다른 PC나 휴대폰에서도 보입니다.
4. 처음 로그인할 때 기존 브라우저 일정을 계정에 옮길지 물어봅니다.
5. 사용자마다 자신의 일정만 볼 수 있도록 DB 보안 규칙을 적용합니다.
6. 두 개의 서로 다른 구글 계정으로 데이터가 섞이지 않는지 직접 검증합니다.
7. 이 단계에서는 출발지 즐겨찾기, 교통 안내, 관리자 화면을 아직 만들지 않습니다. 로그인과 일정 동기화가 정상 작동한 뒤 차례로 진행합니다.

### 이 단계에서 사용자가 해줄 일

- Supabase 프로젝트 생성
- Google Cloud에서 로그인용 OAuth 앱 생성
- 제가 안내하는 두 개의 공개 설정값을 로컬과 Vercel 환경변수에 등록
- 실제 구글 계정으로 로그인 시험

비밀키는 채팅이나 Git에 올리지 않고 각 서비스의 환경변수 설정 화면에만 저장합니다.

## 현재 진행 상태 — 2026-09-01

- [x] Supabase 브라우저 클라이언트와 안전한 환경변수 이름
- [x] profiles·saved_trips RLS 마이그레이션 파일
- [x] 구글 로그인 UI와 OAuth 복귀 화면
- [x] 계정별 일정 조회·저장·삭제 및 비로그인 로컬 저장 유지
- [x] 빌드, TypeScript, 테스트 5개, 320/375/768/1280px 로컬 확인
- [ ] Supabase 프로젝트 생성과 SQL 적용
- [ ] Google OAuth 설정
- [ ] Vercel 환경변수 등록
- [ ] 서로 다른 구글 계정 2개로 RLS 분리 확인
- [ ] main 병합·배포

## 전체 작업 원칙

- The existing guest itinerary creation, local persistence, map, drag, share, and responsive behavior must remain available without login.
- Request only Google basic profile and email scopes; do not request Drive, Calendar, or other Google permissions.
- Never expose `service_role`, Google client secret, or Kakao REST API key to browser code or Git.
- Use only Supabase publishable URL/key values in `NEXT_PUBLIC_*` browser variables.
- All personal rows must be protected by RLS with `auth.uid() = user_id`.
- Keep the existing CSS system; do not add Tailwind components, SCSS, or another UI library.
- Preserve 320px minimum usability and visible keyboard focus.
- This plan covers authentication and saved-trip sync only. Favorite origins, transit routing, and admin UI remain separate plans.
- Before Task 1, verify and commit the existing departure-transit fix separately so this work starts from a clean tree.

---

## 파일별 역할

- `lib/supabase/client.ts`: creates and memoizes the browser Supabase client using PKCE.
- `lib/saved-trip-repository.ts`: converts `SavedTrip` values to/from Supabase rows and performs list/upsert/delete operations.
- `lib/trip-sync.ts`: pure merge logic for local and remote trips.
- `components/organisms/AuthControl.tsx`: Google sign-in and sign-out control with loading/error states.
- `app/auth/callback/page.tsx`: exchanges the one-time OAuth code and returns to `/`.
- `app/page.tsx`: owns the session, loads remote trips after login, and routes explicit save/delete operations to Supabase while retaining local fallback.
- `app/globals.css`: scoped header/auth styles and responsive states.
- `supabase/migrations/202609010001_auth_and_saved_trips.sql`: profiles, saved trips, trigger, grants, and RLS policies.
- `tests/trip-sync.test.mjs`: regression tests for merge behavior.
- `.env.local.example`: safe variable names only.
- `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`: setup, decisions, verification, and remaining phases.

---

### 작업 1: Supabase 브라우저 연결과 안전한 설정

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.local.example`
- Create: `lib/supabase/client.ts`

**Interfaces:**
- Produces: `getSupabaseBrowserClient(): SupabaseClient | null`
- Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- [ ] **Step 1: Install the existing official browser dependency only**

Run:

```powershell
npm install @supabase/supabase-js
```

Expected: `package.json` and `package-lock.json` contain `@supabase/supabase-js`; no auth UI library is added.

- [ ] **Step 2: Add safe environment variable names**

Append to `.env.local.example` without real values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 3: Ensure every Node regression test runs**

Set the package test script to:

```json
"test": "npm run build && node --test tests/*.test.mjs"
```

- [ ] **Step 4: Create the memoized PKCE client**

Create `lib/supabase/client.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserClient = url && key
    ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } })
    : null;
  return browserClient;
}
```

- [ ] **Step 5: Verify missing configuration is non-fatal**

Run:

```powershell
npm run build
```

Expected: build exits `0` without Supabase variables; the guest planner remains renderable.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json .env.local.example lib/supabase/client.ts
git commit -m "feat: add Supabase browser client"
```

---

### 작업 2: 데이터베이스 구조와 사용자별 접근 보안

**Files:**
- Create: `supabase/migrations/202609010001_auth_and_saved_trips.sql`

**Interfaces:**
- Produces table: `public.profiles(id, email, display_name, role, is_blocked, created_at, updated_at)`
- Produces table: `public.saved_trips(id, user_id, name, city, start_time, end_time, preferences, plan, updated_at)`
- Produces trigger: `public.handle_new_user()` on `auth.users`

- [ ] **Step 1: Create the migration with the minimum schema**

Create `supabase/migrations/202609010001_auth_and_saved_trips.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_trips (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  city text not null,
  start_time text not null default '',
  end_time text not null default '',
  preferences jsonb not null default '[]'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index saved_trips_user_updated_idx
  on public.saved_trips(user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.saved_trips enable row level security;

revoke all on public.profiles from anon;
revoke all on public.saved_trips from anon;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_trips to authenticated;

create policy "users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "users update own display name"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users read own trips"
  on public.saved_trips for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own trips"
  on public.saved_trips for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own trips"
  on public.saved_trips for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own trips"
  on public.saved_trips for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Apply the migration in Supabase SQL Editor**

Open the selected Supabase project, paste the complete migration into SQL Editor, and run it once.

Expected: `profiles` and `saved_trips` exist with RLS enabled; no SQL error is reported.

- [ ] **Step 3: Verify grants and policies in Supabase**

Run in SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('profiles', 'saved_trips');

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'saved_trips')
order by tablename, policyname;
```

Expected: both rows have `rowsecurity = true`; one profile select policy, one profile update policy, and four saved-trip policies are listed.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/202609010001_auth_and_saved_trips.sql
git commit -m "feat: add protected Supabase trip schema"
```

---

### 작업 3: 구글 로그인 복귀 화면과 상단 로그인 버튼

**Files:**
- Create: `app/auth/callback/page.tsx`
- Create: `components/organisms/AuthControl.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `AuthControl` consumes `{ user: User | null; isLoading: boolean; onSignIn(): Promise<void>; onSignOut(): Promise<void> }`
- `app/page.tsx` owns `authUser`, `isAuthLoading`, and `authNotice`.

- [ ] **Step 1: Add a failing rendered-shell assertion**

In `tests/rendered-html.test.mjs`, add to the planner-shell test:

```js
assert.match(html, /Google로 로그인/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: FAIL because `Google로 로그인` is absent.

- [ ] **Step 3: Create the auth control**

Create `components/organisms/AuthControl.tsx` with a text button that:

- renders `로그인 확인 중…` while loading;
- renders `Google로 로그인` while signed out;
- renders the user's display name or email plus `로그아웃` while signed in;
- exposes failures through the parent `authNotice` status instead of `alert`.

Use this exact prop contract:

```ts
import type { User } from "@supabase/supabase-js";

export type AuthControlProps = {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
};
```

- [ ] **Step 4: Add session ownership to `app/page.tsx`**

Import `User` and `getSupabaseBrowserClient`, then add:

```ts
const [authUser, setAuthUser] = useState<User | null>(null);
const [isAuthLoading, setIsAuthLoading] = useState(true);
const [authNotice, setAuthNotice] = useState("");
```

Add one mount effect that gets the current session, subscribes to `onAuthStateChange`, and unsubscribes on cleanup. If Supabase configuration is missing, set loading false and keep the guest app available.

Add handlers with these calls:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});

await supabase.auth.signOut();
```

Render `AuthControl` inside `SiteHeader` and render `<span role="status" aria-live="polite">{authNotice}</span>` near it.

- [ ] **Step 5: Create the PKCE callback page**

Create a client page at `app/auth/callback/page.tsx`. On mount:

1. read `code` from `window.location.search`;
2. call `supabase.auth.exchangeCodeForSession(code)` once;
3. redirect to `/` with `window.location.replace("/")` on success;
4. show `로그인을 완료하지 못했어요. 홈으로 돌아가 다시 시도해주세요.` and a home link on failure.

Guard the effect with a ref so React development rendering cannot exchange the one-time code twice.

- [ ] **Step 6: Add scoped auth styles**

In `app/globals.css`, style `.auth-control`, `.auth-user`, and `.auth-notice` using existing `--green`, `--cream`, borders, and `:focus-visible`. Keep buttons at least 44px high and allow the header actions to wrap below 800px.

- [ ] **Step 7: Verify GREEN and keyboard behavior**

Run:

```powershell
npm test
```

Expected: all Node tests pass and build exits `0`.

In the browser with Supabase variables absent, verify `Google로 로그인` is disabled with a configuration notice and all guest planner controls still work.

- [ ] **Step 8: Commit**

```powershell
git add app/auth/callback/page.tsx components/organisms/AuthControl.tsx app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add optional Google login"
```

---

### 작업 4: 저장 일정 변환과 Supabase 저장 모듈

**Files:**
- Create: `lib/saved-trip-repository.ts`
- Create: `lib/trip-sync.ts`
- Create: `tests/trip-sync.test.mjs`

**Interfaces:**
- `mergeSavedTrips(local: SavedTrip[], remote: SavedTrip[]): SavedTrip[]`
- `listSavedTrips(userId: string): Promise<SavedTrip[]>`
- `upsertSavedTrip(userId: string, trip: SavedTrip): Promise<void>`
- `deleteSavedTrip(userId: string, tripId: string): Promise<void>`

- [ ] **Step 1: Write the failing merge tests**

Create `tests/trip-sync.test.mjs` with two tests:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { mergeSavedTrips } from "../lib/trip-sync.ts";

const trip = (id, name, updatedAt) => ({
  version: 2,
  id,
  name,
  city: "성수동",
  startTime: "10:00",
  endTime: "18:00",
  selected: ["카페"],
  plan: [],
  updatedAt,
});

test("동일한 일정 이름은 최신 항목 하나만 유지한다", () => {
  assert.deepEqual(
    mergeSavedTrips([trip("local", "성수 하루", 10)], [trip("remote", "성수 하루", 20)]).map(item => item.id),
    ["remote"],
  );
});

test("서로 다른 일정은 최신순 최대 12개로 합친다", () => {
  const local = Array.from({ length: 8 }, (_, i) => trip(`l${i}`, `로컬 ${i}`, i));
  const remote = Array.from({ length: 8 }, (_, i) => trip(`r${i}`, `원격 ${i}`, i + 20));
  const merged = mergeSavedTrips(local, remote);
  assert.equal(merged.length, 12);
  assert.equal(merged[0].id, "r7");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/trip-sync.test.mjs
```

Expected: FAIL because `lib/trip-sync.ts` does not exist.

- [ ] **Step 3: Implement the minimum merge**

Create `lib/trip-sync.ts`:

```ts
import type { SavedTrip } from "./trip-types";

export function mergeSavedTrips(local: SavedTrip[], remote: SavedTrip[]) {
  const newestByName = new Map<string, SavedTrip>();
  for (const trip of [...local, ...remote]) {
    const current = newestByName.get(trip.name);
    if (!current || trip.updatedAt > current.updatedAt) newestByName.set(trip.name, trip);
  }
  return [...newestByName.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/trip-sync.test.mjs
```

Expected: both tests pass.

- [ ] **Step 5: Implement the repository boundary**

Create `lib/saved-trip-repository.ts` using `getSupabaseBrowserClient()`. Convert fields exactly:

```ts
type SavedTripRow = {
  id: string;
  user_id: string;
  name: string;
  city: string;
  start_time: string;
  end_time: string;
  preferences: string[];
  plan: SavedTrip["plan"];
  updated_at: string;
};
```

Rules:

- `listSavedTrips` selects rows ordered by `updated_at desc`, limited to `12`, and converts ISO dates with `Date.parse`.
- `upsertSavedTrip` sends the authenticated `user_id` and `new Date(trip.updatedAt).toISOString()` using `upsert(..., { onConflict: "id" })`.
- `deleteSavedTrip` deletes only `.eq("id", tripId).eq("user_id", userId)`.
- Each function throws the Supabase error so the page can retain local data and show a retry message.
- If the client is missing, throw `new Error("SUPABASE_NOT_CONFIGURED")`.

- [ ] **Step 6: Run all tests and build**

Run:

```powershell
npm test
```

Expected: merge tests and existing tests pass; build exits `0`.

- [ ] **Step 7: Commit**

```powershell
git add lib/saved-trip-repository.ts lib/trip-sync.ts tests/trip-sync.test.mjs
git commit -m "feat: add synced trip repository"
```

---

### 작업 5: 기존 브라우저 저장을 유지하면서 계정 동기화 연결

**Files:**
- Modify: `app/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `mergeSavedTrips`, `listSavedTrips`, `upsertSavedTrip`, `deleteSavedTrip`
- Preserves: existing `savedTrips` React state and `haru-trip-plans` localStorage key

- [ ] **Step 1: Add a failing regression assertion for sync status**

Add to the rendered-shell test:

```js
assert.match(html, /로그인하면 저장 일정이 여러 기기에서 동기화돼요/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: FAIL because the sync copy is absent.

- [ ] **Step 3: Load remote trips only after authentication**

In `app/page.tsx`, add an effect keyed by `authUser?.id`:

- signed out: leave existing local trips untouched;
- signed in: call `listSavedTrips(authUser.id)`;
- merge remote and current local values with `mergeSavedTrips`;
- if local trips exist that are not in remote, ask once with `window.confirm("이 기기에 저장된 일정을 계정에 동기화할까요?")`;
- on confirmation, upsert the merged local items;
- on rejection, replace the visible list with remote items but do not delete localStorage;
- on failure, retain local items and set `authNotice` to `계정 일정을 불러오지 못해 이 기기의 일정을 보여드려요.`;
- ignore late responses after effect cleanup.

- [ ] **Step 4: Make explicit save and delete dual-write**

Change `handleSaveTrip` to `async`:

- update local React state first;
- when `authUser` exists, call `upsertSavedTrip(authUser.id, trip)`;
- on remote failure, keep the local save and show `이 기기에는 저장했지만 계정 동기화는 실패했어요.`.

Change `handleDeleteSavedTrip` to `async`:

- delete from local React state first;
- when `authUser` exists, call `deleteSavedTrip(authUser.id, selectedSavedTripId)`;
- on remote failure, restore the deleted trip locally and show `계정에서 삭제하지 못했어요. 다시 시도해주세요.`.

- [ ] **Step 5: Add clear guest/signed-in copy**

Near the saved-trip controls render:

```tsx
{!authUser && <span className="sync-hint">로그인하면 저장 일정이 여러 기기에서 동기화돼요</span>}
```

Use `aria-live="polite"` for sync failures. Do not block planner actions while remote data loads.

- [ ] **Step 6: Verify GREEN and local fallback**

Run:

```powershell
npm test
```

Expected: all tests pass and build exits `0`.

Manual browser checks:

1. Supabase variables absent: save, load, delete, refresh all work through localStorage.
2. Supabase variables present but network blocked: local save remains and a sync failure appears.
3. Signing out does not delete local or remote data.

- [ ] **Step 7: Commit**

```powershell
git add app/page.tsx tests/rendered-html.test.mjs
git commit -m "feat: sync saved trips for signed-in users"
```

---

### 작업 6: 구글 설정, 사용자 데이터 분리 검증과 기록

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Google authorized redirect URI: the Supabase callback URI shown by the project's Google provider settings.
- Supabase redirect allow list: `http://localhost:3000/auth/callback` and `https://haru-ashy-rho.vercel.app/auth/callback`.
- Vercel environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Configure Google OAuth without extra scopes**

In Google Cloud Console:

1. create a Web OAuth client for HARU;
2. add only the Supabase callback URI under authorized redirect URIs;
3. copy the Google client ID and secret into Supabase Auth → Providers → Google;
4. do not enable Drive or Calendar scopes.

- [ ] **Step 2: Configure exact application redirects**

In Supabase Auth URL configuration, add:

```text
http://localhost:3000/auth/callback
https://haru-ashy-rho.vercel.app/auth/callback
```

Set the production site URL to:

```text
https://haru-ashy-rho.vercel.app
```

- [ ] **Step 3: Add Vercel variables without printing values**

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Preview and Production. Do not add `service_role` in this phase.

- [ ] **Step 4: Verify two-user RLS isolation**

Use two different Google accounts in separate browser profiles:

1. Account A saves `A 전용 일정`.
2. Account B signs in and must not see `A 전용 일정`.
3. Account B saves `B 전용 일정`.
4. Account A returns and must see only `A 전용 일정`.
5. In Supabase Table Editor, confirm both rows have different `user_id` values.

Expected: neither browser can read, update, or delete the other user's row.

- [ ] **Step 5: Verify responsive and auth failure states**

Check widths `320`, `375`, `768`, and `1280`:

- header actions wrap without horizontal scroll;
- login and logout buttons remain at least 44px high;
- focus rings are visible;
- cancelled Google login returns to a usable guest planner;
- browser refresh restores the session;
- logout returns to guest mode without deleting saved remote data.

- [ ] **Step 6: Run final verification**

Run:

```powershell
npm test
npx tsc --noEmit
git diff --check
```

Expected: all commands exit `0` with zero failed tests and zero TypeScript errors.

- [ ] **Step 7: Update project records**

In `docs/PROJECT_CONTEXT.md`, record:

- Google login and Supabase saved-trip sync status;
- environment variable names without values;
- RLS verification result with two accounts;
- production callback URL;
- guest localStorage fallback behavior;
- favorite origins, transit route, and admin as remaining phases.

In `docs/ROADMAP.md`, mark only Google login and account saved-trip sync complete. Leave favorite origins, transit, and admin unchecked.

- [ ] **Step 8: Commit**

```powershell
git add docs/PROJECT_CONTEXT.md docs/ROADMAP.md
git commit -m "docs: record authenticated trip sync"
```

---

## 이번 계획의 완료 범위

This plan ends with working Google login and account-synced saved trips. It deliberately does not create favorite-origin tables, transit APIs, `service_role` admin routes, or `/admin`; those belong to the next independently testable plans.
