# 출발지·일정 이미지·관리자·접근성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 출발지와 즐겨찾기 동기화, 일정 이미지 저장, 관리자 통계·차단 화면을 추가하고 일정 순서 이동의 접근성 결함을 고친다.

**Architecture:** 순수 로직은 `lib/`의 의존성 없는 모듈로 분리해 `node --test`로 검증하고, 화면 연결만 `app/page.tsx`에 둔다. 관리자 권한은 브라우저가 아니라 `app/api/admin/**/route.ts` 서버 라우트에서 Supabase service_role 클라이언트로 검사한다. 새 npm 의존성은 추가하지 않는다.

**Tech Stack:** Next.js 16 (App Router) / vinext 0.0.50 / React 19 / Supabase JS 2 / 카카오맵 JavaScript SDK / 순수 CSS (`app/globals.css`)

**Spec:** `docs/superpowers/specs/2026-09-01-origin-auth-transit-admin-design.md`

## Global Constraints

- 새 npm 의존성을 추가하지 않는다. 일정 이미지는 브라우저 내장 Canvas 2D API로 직접 그린다.
- 스타일은 `app/globals.css` 끝에 `/* 섹션명 */` 주석과 함께 추가한다. 기존 토큰 `--ink:#213e35` `--green:#285747` `--lime:#c8db97` `--cream:#f6f7f2` `--line:#dce3db`를 재사용한다. Tailwind·SCSS를 새로 도입하지 않는다.
- `!important`를 기본 해결책으로 쓰지 않는다.
- 모든 UI 문구는 한국어다.
- 320px 이상에서 가로 넘침이 없어야 한다.
- 비로그인 사용자는 일정 생성, 출발지 검색, 내 위치, 이미지 저장을 계속 쓸 수 있어야 한다. 로그인은 동기화에만 필요하다.
- `SUPABASE_SERVICE_ROLE_KEY`와 카카오 REST 키는 서버 환경변수에만 둔다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 관리자는 사용자의 집·회사 주소와 일정 본문을 볼 수 없다.
- 검증 명령은 `npm test`(= `npm run build` + `node --test tests/*.test.mjs`)와 `npx tsc --noEmit`이다.
- 로컬에 Supabase 환경변수와 카카오 도메인 등록이 없으면 로그인·동기화·지도 검색 경로는 브라우저에서 끝까지 재현할 수 없다. 해당 경로는 순수 로직 테스트로 검증하고, 미검증 항목을 작업 보고에 명시한다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/trip-types.ts` (수정) | `Origin`, `FavoriteOrigin` 타입 추가, `TripSettings`/`SavedTrip`에 `origin` 필드 추가 |
| `lib/origin-storage.ts` (신규) | 출발지·즐겨찾기의 localStorage 파싱·검증·병합 (순수) |
| `lib/favorite-origin-repository.ts` (신규) | Supabase `favorite_origins` 조회·저장·삭제 |
| `lib/transit.ts` (수정) | 일정 첫 장소가 아니라 전달받은 출발지 기준으로 조회 |
| `lib/trip-image.ts` (신규) | 일정 이미지의 그리기 명령 목록 생성(순수) + Canvas 렌더러 |
| `lib/admin-access.ts` (신규) | 관리자 접근 허용 판정(순수) |
| `lib/supabase/admin-server.ts` (신규) | service_role 서버 전용 Supabase 클라이언트 |
| `app/api/admin/stats/route.ts` (신규) | 개인정보 제외 집계 통계 |
| `app/api/admin/users/route.ts` (신규) | 계정 목록(주소·일정 본문 제외) |
| `app/api/admin/users/block/route.ts` (신규) | 계정 차단·해제 + 감사 기록 |
| `app/admin/page.tsx` (신규) | 관리자 화면 |
| `app/page.tsx` (수정) | 출발지 상태·UI, 이미지 저장, 순서 이동 접근성 |
| `app/globals.css` (수정) | 출발지 영역, 관리자 화면 스타일 |
| `supabase/migrations/202609110001_favorite_origins.sql` (신규) | `favorite_origins`, `saved_trips.origin`, 차단 계정 차단 정책 |
| `supabase/migrations/202609110002_admin_audit_logs.sql` (신규) | `admin_audit_logs` |
| `tests/origin-storage.test.mjs` (신규) | 출발지 저장·병합 검증 |
| `tests/trip-image.test.mjs` (신규) | 이미지 레이아웃 검증 |
| `tests/admin-access.test.mjs` (신규) | 관리자 권한 판정 검증 |
| `tests/transit.test.mjs` (수정) | 출발지 기준 조회로 갱신 |

---

## Task 1: 일정 순서 이동 접근성 보완

일정 카드 `⋯` 메뉴의 `위로 이동`/`아래로 이동`은 이미 동작한다(`app/page.tsx:1178-1179`). 문제는 이동 후 눌렀던 버튼이 사라지면서 포커스가 `<body>`로 날아가고, 변경 사실이 스크린리더에 안내되지 않는다는 점이다.

**Files:**
- Modify: `app/page.tsx:921-929` (`handleMoveSpot`)
- Modify: `app/page.tsx:1162` (`<article className="stop ...">`에 `id` 부여)
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Produces: `handleMoveSpot(index: number, direction: -1 | 1): void` — 시그니처는 그대로. 이동 후 새 위치 카드의 `⋯` summary로 포커스를 옮기고 `setNotice`로 위치를 안내한다.

- [ ] **Step 1: 카드에 안정적인 id 부여**

`app/page.tsx:1162`의 `<article>` 여는 태그에 `id`를 추가한다. 기존 속성은 그대로 둔다.

```tsx
<article id={`stop-${spot.id}`} className={`stop tone-${toneForSpot(spot)} ${i === schedule.length - 1 ? "last" : ""}`} data-stop-index={i}
```

- [ ] **Step 2: 이동 후 포커스 복귀와 위치 안내 추가**

`app/page.tsx:921-929`의 `handleMoveSpot`을 아래로 교체한다.

```tsx
  function handleMoveSpot(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= plan.length) return;
    const nextPlan = [...plan];
    const [movingSpot] = nextPlan.splice(index, 1);
    nextPlan.splice(nextIndex, 0, movingSpot);
    updatePlan(nextPlan, `${movingSpot.name} 순서 변경`);
    setNotice(`${movingSpot.name}을 ${nextIndex + 1}번째로 옮겼어요`);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`#stop-${CSS.escape(movingSpot.id)} .stop-actions > summary`)?.focus();
    });
  }
```

- [ ] **Step 3: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 8개 통과

- [ ] **Step 4: 브라우저 확인**

`npm run dev` 실행 후 `http://localhost:3000`에서 Tab 키만으로 첫 일정 카드의 `⋯`에 도달 → Enter → `아래로 이동` → 포커스가 옮겨진 카드의 `⋯`에 남아 있는지 확인한다.

- [ ] **Step 5: ROADMAP 갱신**

`docs/ROADMAP.md`의 `## Phase 2 — 일정 편집` 아래 `- [ ] 키보드·메뉴 방식의 순서 이동`을 다음으로 바꾼다.

```markdown
- [x] 키보드·메뉴 방식의 순서 이동 (이동 후 포커스 복귀와 위치 안내 포함)
```

- [ ] **Step 6: 커밋**

```bash
git add app/page.tsx docs/ROADMAP.md
git commit -m "fix: keep focus and announce position after moving a stop"
```

---

## Task 2: 출발지 타입과 저장 로직

**Files:**
- Modify: `lib/trip-types.ts`
- Create: `lib/origin-storage.ts`
- Create: `tests/origin-storage.test.mjs`

**Interfaces:**
- Produces:
  - `type Origin = { placeName: string; address: string; x: number; y: number }`
  - `type FavoriteOrigin = Origin & { id: string; label: string; updatedAt: number }`
  - `TripSettings`에 `origin: Origin | null` 추가, `SavedTrip`은 `TripSettings`를 확장하므로 자동 포함
  - `readStoredOrigin(value: string | null): Origin | null`
  - `readStoredFavoriteOrigins(value: string | null): FavoriteOrigin[]`
  - `mergeFavoriteOrigins(local: FavoriteOrigin[], remote: FavoriteOrigin[]): FavoriteOrigin[]` — 같은 `label`은 `updatedAt`이 큰 쪽만 남기고 최신순 최대 12개
  - `isOrigin(value: unknown): value is Origin`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/origin-storage.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const origin = { placeName: "서울역", address: "서울 중구 한강대로 405", x: 126.9707, y: 37.5547 };

test("저장된 출발지는 좌표가 유효할 때만 복원한다", async () => {
  const { readStoredOrigin } = await import("../lib/origin-storage.ts");

  assert.deepEqual(readStoredOrigin(JSON.stringify(origin)), origin);
  assert.equal(readStoredOrigin(null), null);
  assert.equal(readStoredOrigin("{"), null);
  assert.equal(readStoredOrigin(JSON.stringify({ ...origin, x: "126.97" })), null);
  assert.equal(readStoredOrigin(JSON.stringify({ ...origin, placeName: 1 })), null);
});

test("즐겨찾기는 형식이 맞는 항목만 남긴다", async () => {
  const { readStoredFavoriteOrigins } = await import("../lib/origin-storage.ts");
  const valid = { ...origin, id: "a", label: "집", updatedAt: 10 };

  assert.deepEqual(readStoredFavoriteOrigins(JSON.stringify([valid, { id: "b" }, null])), [valid]);
  assert.deepEqual(readStoredFavoriteOrigins("{}"), []);
  assert.deepEqual(readStoredFavoriteOrigins(null), []);
});

test("같은 이름의 즐겨찾기는 최신 항목만 최신순으로 남긴다", async () => {
  const { mergeFavoriteOrigins } = await import("../lib/origin-storage.ts");
  const local = [{ ...origin, id: "a", label: "집", updatedAt: 10 }];
  const remote = [
    { ...origin, id: "b", label: "집", updatedAt: 20 },
    { ...origin, id: "c", label: "회사", updatedAt: 15 },
  ];

  assert.deepEqual(mergeFavoriteOrigins(local, remote).map(item => [item.label, item.updatedAt]), [
    ["집", 20],
    ["회사", 15],
  ]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/origin-storage.test.mjs`
Expected: FAIL — `Cannot find module '../lib/origin-storage.ts'`

- [ ] **Step 3: 타입 추가**

`lib/trip-types.ts`에 다음 두 줄을 `Spot` 정의 아래에 추가한다.

```ts
export type Origin = { placeName: string; address: string; x: number; y: number };
export type FavoriteOrigin = Origin & { id: string; label: string; updatedAt: number };
```

같은 파일의 `TripSettings`를 다음으로 교체한다.

```ts
export type TripSettings = { version: 2; city: string; startTime: string; endTime: string; selected: string[]; plan: Spot[]; origin: Origin | null };
```

- [ ] **Step 4: 구현**

Create `lib/origin-storage.ts`:

```ts
import type { FavoriteOrigin, Origin } from "./trip-types";

export function isOrigin(value: unknown): value is Origin {
  if (!value || typeof value !== "object") return false;
  const origin = value as Partial<Origin>;
  return typeof origin.placeName === "string" && typeof origin.address === "string"
    && Number.isFinite(origin.x) && Number.isFinite(origin.y);
}

function isFavoriteOrigin(value: unknown): value is FavoriteOrigin {
  if (!isOrigin(value)) return false;
  const favorite = value as Partial<FavoriteOrigin>;
  return typeof favorite.id === "string" && typeof favorite.label === "string" && Number.isFinite(favorite.updatedAt);
}

export function readStoredOrigin(value: string | null): Origin | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isOrigin(parsed)) return null;
    return { placeName: parsed.placeName, address: parsed.address, x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function readStoredFavoriteOrigins(value: string | null): FavoriteOrigin[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isFavoriteOrigin) : [];
  } catch {
    return [];
  }
}

export function mergeFavoriteOrigins(local: FavoriteOrigin[], remote: FavoriteOrigin[]) {
  const newestByLabel = new Map<string, FavoriteOrigin>();
  for (const favorite of [...local, ...remote]) {
    const current = newestByLabel.get(favorite.label);
    if (!current || favorite.updatedAt > current.updatedAt) newestByLabel.set(favorite.label, favorite);
  }
  return [...newestByLabel.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
}
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/origin-storage.test.mjs`
Expected: PASS 3개

- [ ] **Step 6: 기존 호출부 타입 오류 해소**

`TripSettings`에 `origin`이 추가되어 `app/page.tsx:393`의 `satisfies TripSettings`가 깨진다. 해당 줄을 다음으로 바꾼다. `origin` 상태는 Task 4에서 도입하므로 지금은 `null`을 넣는다.

```tsx
    localStorage.setItem("haru-trip-plan", JSON.stringify({ version: 2, city, startTime, endTime, selected, plan, origin: null } satisfies TripSettings));
```

`app/page.tsx:673`의 `const trip: SavedTrip = { ... }`에도 `origin: null,`을 추가한다.

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 11개 통과

- [ ] **Step 7: 커밋**

```bash
git add lib/trip-types.ts lib/origin-storage.ts tests/origin-storage.test.mjs app/page.tsx
git commit -m "feat: add origin and favorite origin storage"
```

---

## Task 3: 출발지 Supabase 스키마와 저장소

**Files:**
- Create: `supabase/migrations/202609110001_favorite_origins.sql`
- Create: `lib/favorite-origin-repository.ts`

**Interfaces:**
- Consumes: `FavoriteOrigin` (Task 2), `getSupabaseBrowserClient()` (`lib/supabase/client.ts`)
- Produces:
  - `listFavoriteOrigins(userId: string): Promise<FavoriteOrigin[]>`
  - `upsertFavoriteOrigin(userId: string, favorite: FavoriteOrigin): Promise<void>`
  - `deleteFavoriteOrigin(userId: string, favoriteId: string): Promise<void>`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/202609110001_favorite_origins.sql`:

```sql
create table public.favorite_origins (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  place_name text not null,
  address text not null default '',
  x double precision not null,
  y double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, label)
);

create index favorite_origins_user_updated_idx
  on public.favorite_origins(user_id, updated_at desc);

alter table public.saved_trips add column origin jsonb;

alter table public.favorite_origins enable row level security;

revoke all on public.favorite_origins from anon;
grant select, insert, update, delete on public.favorite_origins to authenticated;

create policy "users read own favorite origins"
  on public.favorite_origins for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own favorite origins"
  on public.favorite_origins for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own favorite origins"
  on public.favorite_origins for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own favorite origins"
  on public.favorite_origins for delete to authenticated
  using (user_id = auth.uid());
```

- [ ] **Step 2: 저장소 구현**

Create `lib/favorite-origin-repository.ts`:

```ts
import type { FavoriteOrigin } from "./trip-types";
import { getSupabaseBrowserClient } from "./supabase/client";

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
  return client;
}

function favoriteFromRow(row: unknown): FavoriteOrigin[] {
  if (!row || typeof row !== "object") return [];
  const value = row as Record<string, unknown>;
  const updatedAt = typeof value.updated_at === "string" ? Date.parse(value.updated_at) : NaN;
  if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.place_name !== "string"
    || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(updatedAt)) return [];
  return [{
    id: value.id,
    label: value.label,
    placeName: value.place_name,
    address: typeof value.address === "string" ? value.address : "",
    x: value.x as number,
    y: value.y as number,
    updatedAt,
  }];
}

export async function listFavoriteOrigins(userId: string) {
  const { data, error } = await requireClient()
    .from("favorite_origins")
    .select("id,label,place_name,address,x,y,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []).flatMap(favoriteFromRow);
}

export async function upsertFavoriteOrigin(userId: string, favorite: FavoriteOrigin) {
  const { error } = await requireClient().from("favorite_origins").upsert({
    id: favorite.id,
    user_id: userId,
    label: favorite.label,
    place_name: favorite.placeName,
    address: favorite.address,
    x: favorite.x,
    y: favorite.y,
    updated_at: new Date(favorite.updatedAt).toISOString(),
  }, { onConflict: "user_id,label" });
  if (error) throw error;
}

export async function deleteFavoriteOrigin(userId: string, favoriteId: string) {
  const { error } = await requireClient().from("favorite_origins").delete().eq("id", favoriteId).eq("user_id", userId);
  if (error) throw error;
}
```

- [ ] **Step 3: 타입 검사**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 11개 통과

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/202609110001_favorite_origins.sql lib/favorite-origin-repository.ts
git commit -m "feat: add favorite origins schema and repository"
```

---

## Task 4: 출발지 화면과 즐겨찾기 동기화

계획 카드 맨 위에 `어디서 출발하나요?` 블록을 만들고, 여행 지역(`city`)과 출발지(`origin`)를 서로 다른 상태로 분리한다.

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/transit.ts`
- Modify: `tests/transit.test.mjs`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `readStoredOrigin`, `readStoredFavoriteOrigins`, `mergeFavoriteOrigins` (Task 2), `listFavoriteOrigins`, `upsertFavoriteOrigin`, `deleteFavoriteOrigin` (Task 3)
- Produces: `lib/transit.ts`의 `findDepartureTransit(departure: TransitPoint | null, searchNearby: SearchNearby): Promise<Record<string, TransitInfo>>`, `type TransitPoint = { id: string; x: number; y: number }`

- [ ] **Step 1: transit 테스트를 출발지 기준으로 갱신**

`tests/transit.test.mjs` 전체를 다음으로 교체한다.

```js
import assert from "node:assert/strict";
import test from "node:test";

test("교통편은 전달받은 출발지만 조회한다", async () => {
  const { findDepartureTransit } = await import("../lib/transit.ts");
  const calls = [];
  const departure = { id: "origin", x: 127, y: 37.5 };

  const result = await findDepartureTransit(departure, async (spot, query, categoryCode) => {
    calls.push([spot.id, query, categoryCode]);
    return [{ place_name: categoryCode === "SW8" ? "가까운역" : "가까운정류장" }];
  });

  assert.deepEqual(calls, [
    ["origin", "", "SW8"],
    ["origin", "버스정류장", undefined],
  ]);
  assert.deepEqual(result, { origin: { subway: "가까운역", bus: "가까운정류장" } });
});

test("출발지가 없으면 아무것도 조회하지 않는다", async () => {
  const { findDepartureTransit } = await import("../lib/transit.ts");
  const calls = [];

  const result = await findDepartureTransit(null, async spot => {
    calls.push(spot.id);
    return [];
  });

  assert.deepEqual(calls, []);
  assert.deepEqual(result, {});
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/transit.test.mjs`
Expected: FAIL — 현재 구현이 배열을 받으므로 `plan[0]`이 `undefined`가 되어 `{}`를 돌려준다

- [ ] **Step 3: transit 구현 교체**

`lib/transit.ts` 전체를 다음으로 교체한다.

```ts
import type { TransitInfo } from "./trip-types";

export type TransitPoint = { id: string; x: number; y: number };
type NearbyPlace = { place_name?: string };
type SearchNearby = (point: TransitPoint, query: string, categoryCode?: string) => Promise<NearbyPlace[]>;

export async function findDepartureTransit(departure: TransitPoint | null, searchNearby: SearchNearby): Promise<Record<string, TransitInfo>> {
  if (!departure) return {};
  const [subways, buses] = await Promise.all([
    searchNearby(departure, "", "SW8"),
    searchNearby(departure, "버스정류장"),
  ]);
  return { [departure.id]: { subway: subways[0]?.place_name, bus: buses[0]?.place_name } };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/transit.test.mjs`
Expected: PASS 2개

- [ ] **Step 5: 출발지 상태 추가**

`app/page.tsx`의 import 블록에 다음 두 줄을 추가한다.

```tsx
import { mergeFavoriteOrigins, readStoredFavoriteOrigins, readStoredOrigin } from "@/lib/origin-storage";
import { deleteFavoriteOrigin, listFavoriteOrigins, upsertFavoriteOrigin } from "@/lib/favorite-origin-repository";
```

`import type { SavedTrip, ScheduleItem, Spot, TransitInfo, TripSettings, UndoState }` 줄에 `FavoriteOrigin`, `Origin`을 추가한다.

`const [city, setCity] = useState("성수동");` 바로 아래에 상태를 추가한다.

```tsx
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState<Origin[]>([]);
  const [isOriginSearching, setIsOriginSearching] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [originNotice, setOriginNotice] = useState("");
  const [favoriteOrigins, setFavoriteOrigins] = useState<FavoriteOrigin[]>([]);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
```

`const regionRequestRef = useRef(0);` 아래에 추가한다.

```tsx
  const originRequestRef = useRef(0);
  const favoriteOriginsSyncedUserRef = useRef("");
```

- [ ] **Step 6: 출발지 복원과 저장**

`app/page.tsx`의 첫 `useEffect`(`localStorage.getItem("haru-trip-plan")`을 읽는 곳) 안, `setSavedTrips(...)` 줄 바로 아래에 두 줄을 추가한다.

```tsx
    setOrigin(readStoredOrigin(localStorage.getItem("haru-origin")));
    setFavoriteOrigins(readStoredFavoriteOrigins(localStorage.getItem("haru-favorite-origins")));
```

같은 effect의 `if (sharedTrip) { ... } else if (storedTrip) { ... }`에서 `storedTrip` 분기 안에 다음을 추가한다. `readStoredTrip`은 `origin`을 돌려주지 않으므로 위의 `haru-origin` 복원으로 충분하다. 추가 작업은 없다.

`localStorage.setItem("haru-trip-plan", ...)`이 있는 effect(현재 `app/page.tsx:393`)를 다음으로 바꾸고 의존성 배열에 `origin`을 추가한다.

```tsx
    localStorage.setItem("haru-trip-plan", JSON.stringify({ version: 2, city, startTime, endTime, selected, plan, origin } satisfies TripSettings));
```

```tsx
  }, [city, startTime, endTime, selected, plan, origin, mapReady]);
```

출발지 자체를 저장하는 effect를 그 아래에 새로 추가한다.

```tsx
  useEffect(() => {
    if (origin) localStorage.setItem("haru-origin", JSON.stringify(origin));
    else localStorage.removeItem("haru-origin");
  }, [origin]);

  useEffect(() => {
    localStorage.setItem("haru-favorite-origins", JSON.stringify(favoriteOrigins));
  }, [favoriteOrigins]);
```

- [ ] **Step 7: 출발지 검색 effect 추가**

`app/page.tsx`의 지역 자동완성 effect들 아래에 출발지 검색 effect를 추가한다.

```tsx
  useEffect(() => {
    const keyword = originQuery.trim();
    if (!mapReady || keyword.length < 2 || !showOriginSuggestions) {
      originRequestRef.current += 1;
      setOriginSuggestions([]);
      setIsOriginSearching(false);
      return;
    }
    const requestId = ++originRequestRef.current;
    setIsOriginSearching(true);
    const timer = window.setTimeout(() => {
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(keyword, (data: any[], status: string) => {
        if (requestId !== originRequestRef.current) return;
        setIsOriginSearching(false);
        if (status !== window.kakao.maps.services.Status.OK) {
          setOriginSuggestions([]);
          return;
        }
        setOriginSuggestions(data.slice(0, 5).map((place: any): Origin => ({
          placeName: place.place_name,
          address: place.road_address_name || place.address_name || "",
          x: Number(place.x),
          y: Number(place.y),
        })));
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [originQuery, mapReady, showOriginSuggestions]);
```

- [ ] **Step 8: 즐겨찾기 계정 동기화 effect 추가**

저장 일정 동기화 effect 아래에 추가한다. 로컬 데이터 계정 이전 확인은 저장 일정 흐름에서 이미 한 번 물으므로 즐겨찾기는 자동 병합한다.

```tsx
  useEffect(() => {
    if (!authUser) {
      favoriteOriginsSyncedUserRef.current = "";
      return;
    }
    if (favoriteOriginsSyncedUserRef.current === authUser.id) return;
    favoriteOriginsSyncedUserRef.current = authUser.id;
    let cancelled = false;
    const localFavorites = readStoredFavoriteOrigins(localStorage.getItem("haru-favorite-origins"));
    listFavoriteOrigins(authUser.id).then(async remoteFavorites => {
      if (cancelled) return;
      const merged = mergeFavoriteOrigins(localFavorites, remoteFavorites);
      setFavoriteOrigins(merged);
      const remoteById = new Map(remoteFavorites.map(item => [item.id, item.updatedAt]));
      await Promise.all(merged
        .filter(item => remoteById.get(item.id) !== item.updatedAt)
        .map(item => upsertFavoriteOrigin(authUser.id, item)));
    }).catch(() => {
      if (!cancelled) {
        favoriteOriginsSyncedUserRef.current = "";
        setOriginNotice("즐겨찾기를 계정과 동기화하지 못했어요");
      }
    });
    return () => { cancelled = true; };
  }, [authUser]);
```

- [ ] **Step 9: 교통편 effect를 출발지 기준으로 변경**

`findDepartureTransit(plan, searchNearby)`를 호출하는 effect(현재 `app/page.tsx:426-444`)를 다음으로 교체한다.

```tsx
  useEffect(() => {
    const departure = origin
      ? { id: "origin", x: origin.x, y: origin.y }
      : plan[0] ? { id: plan[0].id, x: plan[0].x, y: plan[0].y } : null;
    if (!mapReady || !window.kakao?.maps?.services || !departure) {
      setTransitBySpot({});
      return;
    }
    let cancelled = false;
    const searchNearby = (point: { x: number; y: number }, query: string, categoryCode?: string) => new Promise<any[]>((resolve) => {
      const ps = new window.kakao.maps.services.Places();
      const location = new window.kakao.maps.LatLng(point.y, point.x);
      const options = { location, radius: 1200, sort: window.kakao.maps.services.SortBy.DISTANCE };
      const callback = (data: any[], status: string) => resolve(status === window.kakao.maps.services.Status.OK ? data : []);
      if (categoryCode) ps.categorySearch(categoryCode, callback, options);
      else ps.keywordSearch(query, callback, options);
    });
    findDepartureTransit(departure, searchNearby).then(transit => {
      if (!cancelled) setTransitBySpot(transit);
    });
    return () => { cancelled = true; };
  }, [mapReady, planSpotIds, origin]);
```

- [ ] **Step 10: 출발지 핸들러 추가**

`handleShowCurrentLocation` 아래에 다음 핸들러들을 추가한다.

```tsx
  function handleSelectOrigin(nextOrigin: Origin) {
    setOrigin(nextOrigin);
    setOriginQuery(nextOrigin.placeName);
    setShowOriginSuggestions(false);
    setOriginNotice(`출발지를 ${nextOrigin.placeName}으로 정했어요`);
  }

  function handleClearOrigin() {
    setOrigin(null);
    setOriginQuery("");
    setOriginNotice("출발지를 지웠어요");
  }

  function handleUseCurrentLocationAsOrigin() {
    if (!mapReady || !window.kakao?.maps?.services) {
      setOriginNotice("카카오맵 연결이 끝난 뒤 다시 눌러주세요");
      return;
    }
    if (!navigator.geolocation) {
      setOriginNotice("이 브라우저에서는 위치 기능을 사용할 수 없어요");
      return;
    }
    setIsLocating(true);
    setOriginNotice("현재 위치를 찾고 있어요…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const { latitude, longitude } = coords;
      const isInsideKorea = latitude >= 32 && latitude <= 40 && longitude >= 123 && longitude <= 133;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isInsideKorea) {
        setIsLocating(false);
        setOriginNotice("브라우저 위치가 한국 밖으로 잡혀 출발지로 쓰지 않았어요. 기기의 위치 설정을 확인해주세요");
        return;
      }
      new window.kakao.maps.services.Geocoder().coord2Address(longitude, latitude, (result: any[], status: string) => {
        setIsLocating(false);
        const address = status === window.kakao.maps.services.Status.OK
          ? result[0]?.road_address?.address_name || result[0]?.address?.address_name || ""
          : "";
        handleSelectOrigin({ placeName: "내 위치", address, x: longitude, y: latitude });
      });
    }, (error) => {
      setIsLocating(false);
      if (error.code === error.PERMISSION_DENIED) setOriginNotice("위치 권한을 허용하거나, 주소·역 이름으로 출발지를 검색해주세요");
      else if (error.code === error.TIMEOUT) setOriginNotice("위치 확인 시간이 초과됐어요. 다시 시도해주세요");
      else setOriginNotice("현재 위치를 확인하지 못했어요. 주소·역 이름으로 검색해주세요");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  async function handleSaveFavoriteOrigin() {
    if (!origin) {
      setOriginNotice("먼저 출발지를 정해주세요");
      return;
    }
    const label = window.prompt("즐겨찾기 이름을 정해주세요", origin.placeName === "내 위치" ? "집" : origin.placeName)?.trim();
    if (!label) return;
    const existing = favoriteOrigins.find(item => item.label === label);
    const favorite: FavoriteOrigin = {
      ...origin,
      id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label.slice(0, 40),
      updatedAt: Date.now(),
    };
    setFavoriteOrigins(current => [favorite, ...current.filter(item => item.label !== favorite.label)].slice(0, 12));
    setOriginNotice(`'${favorite.label}' 즐겨찾기를 저장했어요`);
    if (!authUser) return;
    setIsSavingFavorite(true);
    try {
      await upsertFavoriteOrigin(authUser.id, favorite);
    } catch {
      setOriginNotice("이 기기에는 저장했지만 계정 동기화는 실패했어요");
    } finally {
      setIsSavingFavorite(false);
    }
  }

  async function handleDeleteFavoriteOrigin(favorite: FavoriteOrigin) {
    const previous = favoriteOrigins;
    setFavoriteOrigins(current => current.filter(item => item.id !== favorite.id));
    setOriginNotice(`'${favorite.label}' 즐겨찾기를 지웠어요`);
    if (!authUser) return;
    try {
      await deleteFavoriteOrigin(authUser.id, favorite.id);
    } catch {
      setFavoriteOrigins(previous);
      setOriginNotice("계정에서 즐겨찾기를 지우지 못했어요. 다시 시도해주세요");
    }
  }
```

- [ ] **Step 11: 저장·불러오기·공유에 출발지 반영**

`handleSaveTrip`의 `const trip: SavedTrip = { ... }`에서 Task 2에서 넣은 `origin: null,`을 `origin,`으로 바꾼다.

`handleLoadTrip`의 `setCity(trip.city);` 아래에 다음을 추가한다.

```tsx
    setOrigin(trip.origin ?? null);
    setOriginQuery(trip.origin?.placeName ?? "");
```

`handleShareTrip`의 `const payload = { city, startTime, endTime, selected, plan };`는 그대로 둔다. 공유 링크에 집 주소가 실리지 않도록 출발지는 공유하지 않는다.

`lib/saved-trip-repository.ts`의 `SavedTripRow`에 `origin: SavedTrip["origin"];`를 추가하고, `select(...)` 문자열에 `,origin`을 붙이고, `upsertSavedTrip`의 `row`에 `origin: trip.origin,`을 추가한다. `lib/trip-sync.ts`의 `savedTripsFromRows` 반환 객체에 다음을 추가한다.

```ts
      origin: isOrigin(value.origin) ? value.origin : null,
```

`lib/trip-sync.ts` 상단에 `import { isOrigin } from "./origin-storage";`를 추가한다.

`lib/trip-storage.ts`의 `readStoredTrips` `.map(...)` 반환 객체에도 다음을 추가한다.

```ts
        origin: isOrigin(trip.origin) ? trip.origin : null,
```

`lib/trip-storage.ts` 상단에 `import { isOrigin } from "./origin-storage";`를 추가하고, 같은 파일의 `readStoredTrips` 내 타입 단언 부분에서 `Partial<SavedTrip>`은 그대로 둔다.

- [ ] **Step 12: 계획 카드에 출발지 블록 추가**

`app/page.tsx`의 `<div className="planner-card">` 바로 다음 줄, 즉 `<div className="location-heading">` 앞에 다음을 삽입한다.

```tsx
          <label htmlFor="origin-input">어디서 출발하나요?</label>
          <div className="origin-block">
            <div className="origin-row">
              <div className="origin-field">
                <input
                  id="origin-input"
                  value={originQuery}
                  onChange={event => { setOriginQuery(event.target.value); setShowOriginSuggestions(true); }}
                  onFocus={() => setShowOriginSuggestions(true)}
                  onBlur={() => window.setTimeout(() => setShowOriginSuggestions(false), 120)}
                  aria-expanded={showOriginSuggestions && (isOriginSearching || originSuggestions.length > 0)}
                  aria-controls="origin-suggestions"
                  aria-autocomplete="list"
                  role="combobox"
                  autoComplete="off"
                  placeholder="주소, 건물, 지하철역 검색"
                />
                {showOriginSuggestions && (isOriginSearching || originSuggestions.length > 0) && <div className="region-suggestions" id="origin-suggestions" role="listbox">
                  {isOriginSearching && <span>출발지를 찾고 있어요…</span>}
                  {!isOriginSearching && originSuggestions.map(suggestion => <button
                    type="button"
                    role="option"
                    aria-selected={origin?.placeName === suggestion.placeName && origin?.x === suggestion.x}
                    key={`${suggestion.placeName}-${suggestion.x}-${suggestion.y}`}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => handleSelectOrigin(suggestion)}
                  ><b>{suggestion.placeName}</b><small>{suggestion.address}</small></button>)}
                </div>}
              </div>
              <button type="button" className="origin-locate" disabled={isLocating} onClick={handleUseCurrentLocationAsOrigin}>{isLocating ? "찾는 중…" : "내 위치"}</button>
            </div>
            <div className="origin-favorites">
              {favoriteOrigins.map(favorite => <span className="origin-favorite" key={favorite.id}>
                <button type="button" onClick={() => handleSelectOrigin(favorite)}>{favorite.label}</button>
                <button type="button" className="origin-favorite-remove" aria-label={`${favorite.label} 즐겨찾기 삭제`} onClick={() => handleDeleteFavoriteOrigin(favorite)}>×</button>
              </span>)}
              <button type="button" className="origin-favorite-add" disabled={!origin || isSavingFavorite} onClick={handleSaveFavoriteOrigin}>+ 현재 출발지 저장</button>
              {origin && <button type="button" className="origin-clear" onClick={handleClearOrigin}>출발지 지우기</button>}
            </div>
            <p className="origin-feedback" role="status" aria-live="polite">
              {originNotice || (origin ? `${origin.placeName}에서 출발해요` : "출발지를 정하면 가까운 교통편을 알려드려요")}
              {!authUser && favoriteOrigins.length > 0 && " · 로그인하면 즐겨찾기를 다른 기기와 함께 쓸 수 있어요"}
            </p>
          </div>
```

기존 `<div className="location-heading"><label>어디로 갈까요?</label>`의 문구를 `<label>어디에서 하루를 보낼까요?</label>`로 바꾼다.

- [ ] **Step 13: 스타일 추가**

`app/globals.css` 맨 끝에 다음을 추가한다.

```css
/* 2026-09-11: 실제 출발지 선택과 즐겨찾기 */
.origin-block{margin-bottom:22px}
.origin-row{display:flex;align-items:stretch;gap:8px;border:1px solid var(--line)}
.origin-field{position:relative;flex:1;min-width:0}
.origin-field>input{width:100%;min-height:48px;padding:13px 15px;border:0;font-weight:800;outline:none}
.origin-field>input:focus-visible{box-shadow:inset 0 0 0 2px rgba(122,158,33,.3)}
.origin-locate{flex-shrink:0;min-width:84px;min-height:48px;padding:0 14px;border:0;border-left:1px solid var(--line);background:#f4f5f0;color:var(--green);font-size:12px;font-weight:800}
.origin-locate:hover:enabled{background:#edf9c7}
.origin-locate:disabled{cursor:wait;opacity:.65}
.origin-suggestions button b,#origin-suggestions button b{display:block;font-size:12px}
#origin-suggestions button small{display:block;margin-top:2px;color:#87958f;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#origin-suggestions button{height:auto;padding:9px 11px}
.origin-favorites{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.origin-favorite{display:inline-flex;align-items:center;border:1px solid #d4dec1;border-radius:999px;background:#f3f6ed;overflow:hidden}
.origin-favorite>button:first-child{min-height:34px;padding:0 6px 0 13px;border:0;background:none;color:#45610b;font-size:11px;font-weight:800}
.origin-favorite-remove{min-width:28px;min-height:34px;padding:0 9px 0 3px;border:0;background:none;color:#8a9691;font-size:14px;line-height:1}
.origin-favorite-remove:hover{color:#b34d36}
.origin-favorite-add,.origin-clear{min-height:34px;padding:0 13px;border:1px dashed #cfd8d2;border-radius:999px;background:#fff;color:#607168;font-size:11px;font-weight:800}
.origin-favorite-add:disabled{cursor:not-allowed;opacity:.55}
.origin-favorite-add:hover:enabled,.origin-clear:hover{border-style:solid;border-color:#b2cf51;color:#45610b}
.origin-feedback{min-height:18px;margin:8px 0 0;color:#607168;font-size:11px;line-height:1.5}
@media(max-width:800px){.origin-row{flex-direction:column}.origin-locate{width:100%;min-height:44px;border-left:0;border-top:1px solid var(--line)}}
```

- [ ] **Step 14: 검증**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 12개 통과

- [ ] **Step 15: 브라우저 확인**

`npm run dev` 후 320px·375px·1440px에서 출발지 블록의 가로 넘침, 즐겨찾기 줄바꿈, `내 위치` 버튼 크기를 확인한다. 카카오 도메인 미등록 환경에서는 검색이 동작하지 않으므로 레이아웃과 빈 상태 문구만 확인하고, 실제 검색 미검증 사실을 보고에 남긴다.

- [ ] **Step 16: 커밋**

```bash
git add app/page.tsx app/globals.css lib/transit.ts lib/trip-storage.ts lib/trip-sync.ts lib/saved-trip-repository.ts tests/transit.test.mjs
git commit -m "feat: separate real origin from trip region with favorites"
```

---

## Task 5: 일정 이미지 저장

**Files:**
- Create: `lib/trip-image.ts`
- Create: `tests/trip-image.test.mjs`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Spot` (`lib/trip-types.ts`), `ScheduleItem`
- Produces:
  - `type DrawOp = { type: "rect"; x: number; y: number; w: number; h: number; fill: string } | { type: "text"; x: number; y: number; text: string; font: string; fill: string; align?: "left" | "right" } | { type: "circle"; x: number; y: number; r: number; fill: string }`
  - `type TripImageInput = { city: string; startTime: string; endTime: string; totalMinutes: number; walkMinutes: number; stops: { order: number; name: string; category: string; start: string; end: string }[] }`
  - `buildTripImageLayout(input: TripImageInput): { width: number; height: number; ops: DrawOp[] }`
  - `renderTripImage(canvas: HTMLCanvasElement, layout: { width: number; height: number; ops: DrawOp[] }): void`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/trip-image.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const input = {
  city: "성수동",
  startTime: "09:30",
  endTime: "14:30",
  totalMinutes: 303,
  walkMinutes: 33,
  stops: [
    { order: 1, name: "서울숲", category: "산책", start: "09:30", end: "10:40" },
    { order: 2, name: "대림창고", category: "카페", start: "11:03", end: "12:03" },
  ],
};

function textsOf(layout) {
  return layout.ops.filter(op => op.type === "text").map(op => op.text);
}

test("이미지 레이아웃에 지역, 시간 요약, 모든 장소가 들어간다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const layout = buildTripImageLayout(input);
  const texts = textsOf(layout);

  assert.ok(texts.some(text => text.includes("성수동")));
  assert.ok(texts.some(text => text.includes("5시간 3분")));
  assert.ok(texts.some(text => text.includes("도보 33분")));
  assert.ok(texts.includes("서울숲"));
  assert.ok(texts.includes("대림창고"));
  assert.ok(texts.some(text => text.includes("09:30")));
});

test("장소가 늘어나면 이미지 높이도 늘어난다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const short = buildTripImageLayout({ ...input, stops: input.stops.slice(0, 1) });
  const long = buildTripImageLayout(input);

  assert.ok(long.height > short.height);
  assert.equal(long.width, short.width);
});

test("장소가 없어도 안내 문구를 담은 레이아웃을 만든다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const layout = buildTripImageLayout({ ...input, stops: [], totalMinutes: 0, walkMinutes: 0 });

  assert.ok(layout.height > 0);
  assert.ok(textsOf(layout).some(text => text.includes("아직 담은 장소가 없어요")));
});

test("긴 장소 이름은 잘려서 카드 밖으로 넘치지 않는다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const longName = "아주아주기다란장소이름".repeat(6);
  const layout = buildTripImageLayout({ ...input, stops: [{ order: 1, name: longName, category: "카페", start: "09:30", end: "10:30" }] });
  const drawnName = textsOf(layout).find(text => text.startsWith("아주아주"));

  assert.ok(drawnName.length < longName.length);
  assert.ok(drawnName.endsWith("…"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/trip-image.test.mjs`
Expected: FAIL — `Cannot find module '../lib/trip-image.ts'`

- [ ] **Step 3: 구현**

Create `lib/trip-image.ts`:

```ts
export type DrawOp =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { type: "text"; x: number; y: number; text: string; font: string; fill: string; align?: "left" | "right" }
  | { type: "circle"; x: number; y: number; r: number; fill: string };

export type TripImageStop = { order: number; name: string; category: string; start: string; end: string };
export type TripImageInput = {
  city: string;
  startTime: string;
  endTime: string;
  totalMinutes: number;
  walkMinutes: number;
  stops: TripImageStop[];
};

export type TripImageLayout = { width: number; height: number; ops: DrawOp[] };

const WIDTH = 900;
const PADDING = 56;
const HEADER_HEIGHT = 210;
const ROW_HEIGHT = 96;
const FOOTER_HEIGHT = 92;
const INK = "#213e35";
const GREEN = "#285747";
const LIME = "#c8db97";
const CREAM = "#f6f7f2";
const MUTED = "#7d948b";

function clip(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export function buildTripImageLayout(input: TripImageInput): TripImageLayout {
  const bodyHeight = input.stops.length ? input.stops.length * ROW_HEIGHT : ROW_HEIGHT;
  const height = HEADER_HEIGHT + bodyHeight + FOOTER_HEIGHT;
  const ops: DrawOp[] = [
    { type: "rect", x: 0, y: 0, w: WIDTH, h: height, fill: CREAM },
    { type: "rect", x: 0, y: 0, w: WIDTH, h: HEADER_HEIGHT, fill: GREEN },
    { type: "text", x: PADDING, y: 74, text: "HARU / A DAY WELL SPENT", font: "700 18px sans-serif", fill: LIME },
    { type: "text", x: PADDING, y: 132, text: clip(`${input.city}에서의 하루`, 22), font: "700 46px sans-serif", fill: "#ffffff" },
    { type: "text", x: PADDING, y: 176, text: `${input.startTime}–${input.endTime} · ${formatDuration(input.totalMinutes)} · 도보 ${input.walkMinutes}분`, font: "500 20px sans-serif", fill: "#cbd7d2" },
  ];

  if (!input.stops.length) {
    ops.push({ type: "text", x: PADDING, y: HEADER_HEIGHT + 56, text: "아직 담은 장소가 없어요", font: "700 24px sans-serif", fill: MUTED });
  }

  input.stops.forEach((stop, index) => {
    const top = HEADER_HEIGHT + index * ROW_HEIGHT;
    ops.push({ type: "rect", x: PADDING, y: top + 20, w: WIDTH - PADDING * 2, h: ROW_HEIGHT - 12, fill: "#ffffff" });
    ops.push({ type: "circle", x: PADDING + 42, y: top + 62, r: 22, fill: GREEN });
    ops.push({ type: "text", x: PADDING + 42, y: top + 70, text: String(stop.order), font: "800 20px sans-serif", fill: "#ffffff", align: "right" });
    ops.push({ type: "text", x: PADDING + 84, y: top + 58, text: clip(stop.name, 20), font: "700 26px sans-serif", fill: INK });
    ops.push({ type: "text", x: PADDING + 84, y: top + 88, text: `${stop.category} · ${stop.start}–${stop.end}`, font: "500 17px sans-serif", fill: MUTED });
  });

  const footerTop = HEADER_HEIGHT + bodyHeight;
  ops.push({ type: "text", x: PADDING, y: footerTop + 52, text: "하루여행 · 가볍게 떠나는 하루를 위해", font: "600 18px sans-serif", fill: MUTED });
  ops.push({ type: "text", x: WIDTH - PADDING, y: footerTop + 52, text: "이동시간은 직선거리 기준 추정치예요", font: "500 15px sans-serif", fill: MUTED, align: "right" });

  return { width: WIDTH, height, ops };
}

export function renderTripImage(canvas: HTMLCanvasElement, layout: TripImageLayout) {
  const scale = 2;
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.scale(scale, scale);
  for (const op of layout.ops) {
    context.fillStyle = op.fill;
    if (op.type === "rect") {
      context.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.type === "circle") {
      context.beginPath();
      context.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      context.fill();
    } else {
      context.font = op.font;
      context.textAlign = op.align === "right" ? "right" : "left";
      context.fillText(op.text, op.x, op.y);
    }
  }
}
```

주의: 번호 원 안의 숫자는 `align: "right"`로 원 중심에 맞춘다. `textAlign: "center"`를 쓰지 않는 이유는 `DrawOp`의 정렬 값을 두 가지로 제한해 테스트를 단순하게 유지하기 위해서다. 실제 출력에서 숫자가 원 밖으로 나가면 `x`를 `PADDING + 50`으로 조정한다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/trip-image.test.mjs`
Expected: PASS 4개

- [ ] **Step 5: 화면 연결**

`app/page.tsx` import 블록에 추가한다.

```tsx
import { buildTripImageLayout, renderTripImage } from "@/lib/trip-image";
```

`handleShareTrip` 아래에 핸들러를 추가한다.

```tsx
  async function handleSaveTripImage() {
    if (!plan.length) {
      setNotice("이미지로 저장할 장소가 아직 없어요");
      return;
    }
    const layout = buildTripImageLayout({
      city: city.trim() || "하루",
      startTime: startTime || schedule[0]?.start || "09:30",
      endTime: endTime || plannedEndTime,
      totalMinutes: total,
      walkMinutes: totalTravel,
      stops: schedule.map((item, index) => ({ order: index + 1, name: item.spot.name, category: item.spot.category, start: item.start, end: item.end })),
    });
    const canvas = document.createElement("canvas");
    try {
      renderTripImage(canvas, layout);
    } catch {
      setNotice("이 브라우저에서는 이미지를 만들 수 없어요");
      return;
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setNotice("이미지를 만들지 못했어요. 다시 시도해주세요");
      return;
    }
    const fileName = `haru-${(city.trim() || "trip").replace(/\s+/g, "-")}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "하루여행 일정" });
        setNotice("일정 이미지를 공유했어요");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("일정 이미지를 저장했어요");
  }
```

`더보기` 메뉴(`app/page.tsx:1091` 부근)의 `<button type="button" onClick={handleShareTrip}>공유</button>` 바로 아래에 추가한다.

```tsx
                <button type="button" onClick={handleSaveTripImage}>이미지 저장</button>
```

- [ ] **Step 6: 검증**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 16개 통과

- [ ] **Step 7: 브라우저 확인**

`npm run dev` 후 `더보기 → 이미지 저장`을 눌러 PNG가 내려받아지는지, 이미지 안의 장소 이름·시간이 화면 일정과 같은지 확인한다.

- [ ] **Step 8: ROADMAP 갱신**

`docs/ROADMAP.md`의 `## Phase 3 — 저장과 공유` 아래 `- [ ] 일정 이미지 저장`을 `- [x] 일정 이미지 저장 (Canvas 직접 렌더링, 모바일 공유 시트 지원)`으로 바꾼다.

- [ ] **Step 9: 커밋**

```bash
git add lib/trip-image.ts tests/trip-image.test.mjs app/page.tsx docs/ROADMAP.md
git commit -m "feat: save the itinerary as a shareable image"
```

---

## Task 6: 관리자 권한 판정과 서버 클라이언트

**Files:**
- Create: `lib/admin-access.ts`
- Create: `tests/admin-access.test.mjs`
- Create: `lib/supabase/admin-server.ts`
- Create: `supabase/migrations/202609110002_admin_audit_logs.sql`
- Modify: `.env.local.example`

**Interfaces:**
- Produces:
  - `type AdminProfile = { role: string; is_blocked: boolean } | null`
  - `decideAdminAccess(profile: AdminProfile): { allowed: boolean; status: 200 | 401 | 403; reason: string }`
  - `readBearerToken(header: string | null): string | null`
  - `getSupabaseAdminClient(): SupabaseClient` — service_role 클라이언트. 환경변수가 없으면 `SUPABASE_ADMIN_NOT_CONFIGURED`를 던진다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/admin-access.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

test("Bearer 토큰만 읽어들인다", async () => {
  const { readBearerToken } = await import("../lib/admin-access.ts");

  assert.equal(readBearerToken("Bearer abc.def"), "abc.def");
  assert.equal(readBearerToken("bearer abc.def"), "abc.def");
  assert.equal(readBearerToken("Basic abc"), null);
  assert.equal(readBearerToken("Bearer "), null);
  assert.equal(readBearerToken(null), null);
});

test("관리자만 허용하고 차단 계정은 거부한다", async () => {
  const { decideAdminAccess } = await import("../lib/admin-access.ts");

  assert.deepEqual(decideAdminAccess({ role: "admin", is_blocked: false }), { allowed: true, status: 200, reason: "" });
  assert.equal(decideAdminAccess({ role: "user", is_blocked: false }).status, 403);
  assert.equal(decideAdminAccess({ role: "admin", is_blocked: true }).status, 403);
  assert.equal(decideAdminAccess(null).status, 401);
});

test("거부 사유에 내부 정보를 노출하지 않는다", async () => {
  const { decideAdminAccess } = await import("../lib/admin-access.ts");

  for (const profile of [null, { role: "user", is_blocked: false }, { role: "admin", is_blocked: true }]) {
    const { reason } = decideAdminAccess(profile);
    assert.ok(reason.length > 0);
    assert.ok(!/role|is_blocked|supabase|service/i.test(reason));
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/admin-access.test.mjs`
Expected: FAIL — `Cannot find module '../lib/admin-access.ts'`

- [ ] **Step 3: 구현**

Create `lib/admin-access.ts`:

```ts
export type AdminProfile = { role: string; is_blocked: boolean } | null;

export function readBearerToken(header: string | null) {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function decideAdminAccess(profile: AdminProfile) {
  if (!profile) return { allowed: false, status: 401 as const, reason: "로그인이 필요해요" };
  if (profile.is_blocked || profile.role !== "admin") {
    return { allowed: false, status: 403 as const, reason: "관리자만 볼 수 있는 화면이에요" };
  }
  return { allowed: true, status: 200 as const, reason: "" };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/admin-access.test.mjs`
Expected: PASS 3개

- [ ] **Step 5: 서버 클라이언트 작성**

Create `lib/supabase/admin-server.ts`:

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}
```

`server-only` 패키지가 설치되어 있지 않으면 `import "server-only";` 줄을 삭제하고 파일 첫 줄에 다음 주석을 남긴다. 새 의존성을 추가하지 않는다는 전역 제약을 지키기 위함이다.

```ts
// 서버 전용: service_role 키를 사용하므로 클라이언트 컴포넌트에서 import 하지 않는다.
```

확인 방법: `node -e "require.resolve('server-only')"` 가 성공하면 그대로 두고, 실패하면 주석 방식으로 바꾼다.

- [ ] **Step 6: 감사 기록 마이그레이션**

Create `supabase/migrations/202609110002_admin_audit_logs.sql`:

```sql
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('block_user', 'unblock_user')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all on public.admin_audit_logs from anon, authenticated;

create policy "block signed-in reads of saved trips"
  on public.saved_trips as restrictive for all to authenticated
  using (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked))
  with check (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked));

create policy "block signed-in reads of favorite origins"
  on public.favorite_origins as restrictive for all to authenticated
  using (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked))
  with check (not exists (select 1 from public.profiles where id = auth.uid() and is_blocked));
```

`admin_audit_logs`에는 정책을 만들지 않는다. service_role 클라이언트는 RLS를 우회하므로 서버에서만 읽고 쓴다.

- [ ] **Step 7: 환경변수 예시 갱신**

`.env.local.example` 맨 끝에 추가한다.

```
# 서버 전용. Supabase Project Settings > API > service_role. 절대 브라우저에 노출하지 않는다.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 8: 검증과 커밋**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 테스트 19개 통과

```bash
git add lib/admin-access.ts lib/supabase/admin-server.ts tests/admin-access.test.mjs supabase/migrations/202609110002_admin_audit_logs.sql .env.local.example
git commit -m "feat: add admin access checks and audit log schema"
```

---

## Task 7: 관리자 서버 API

**Files:**
- Create: `app/api/admin/stats/route.ts`
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/block/route.ts`

**Interfaces:**
- Consumes: `readBearerToken`, `decideAdminAccess` (Task 6), `getSupabaseAdminClient()` (Task 6)
- Produces:
  - `GET /api/admin/stats` → `{ userCount: number; newUsersThisWeek: number; tripCount: number; favoriteCount: number; blockedCount: number }`
  - `GET /api/admin/users` → `{ users: { id: string; email: string; displayName: string; role: string; isBlocked: boolean; createdAt: string; tripCount: number }[] }`
  - `POST /api/admin/users/block` body `{ userId: string; isBlocked: boolean }` → `{ ok: true }`

- [ ] **Step 1: 공통 인증 헬퍼를 stats 라우트에 작성**

Create `app/api/admin/stats/route.ts`:

```ts
import { decideAdminAccess, readBearerToken } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-server";

export async function requireAdminUser(request: Request) {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return { error: Response.json({ message: "로그인이 필요해요" }, { status: 401 }) };
  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { error: Response.json({ message: "관리자 기능이 아직 설정되지 않았어요" }, { status: 503 }) };
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: Response.json({ message: "로그인이 필요해요" }, { status: 401 }) };
  const { data: profile } = await admin.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  const decision = decideAdminAccess(profile ?? null);
  if (!decision.allowed) return { error: Response.json({ message: decision.reason }, { status: decision.status }) };
  return { admin, userId: data.user.id };
}

export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [users, newUsers, trips, favorites, blocked] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("saved_trips").select("id", { count: "exact", head: true }),
    admin.from("favorite_origins").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", true),
  ]);
  return Response.json({
    userCount: users.count ?? 0,
    newUsersThisWeek: newUsers.count ?? 0,
    tripCount: trips.count ?? 0,
    favoriteCount: favorites.count ?? 0,
    blockedCount: blocked.count ?? 0,
  });
}
```

- [ ] **Step 2: 계정 목록 라우트**

Create `app/api/admin/users/route.ts`:

```ts
import { requireAdminUser } from "../stats/route";

export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,email,display_name,role,is_blocked,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ message: "계정 목록을 불러오지 못했어요" }, { status: 500 });

  const { data: trips } = await admin.from("saved_trips").select("user_id");
  const tripCountByUser = new Map<string, number>();
  for (const row of trips ?? []) {
    const userId = (row as { user_id: string }).user_id;
    tripCountByUser.set(userId, (tripCountByUser.get(userId) ?? 0) + 1);
  }

  return Response.json({
    users: (profiles ?? []).map(profile => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      isBlocked: profile.is_blocked,
      createdAt: profile.created_at,
      tripCount: tripCountByUser.get(profile.id) ?? 0,
    })),
  });
}
```

일정 본문(`plan`)과 즐겨찾기 주소는 조회하지 않는다. 개수만 센다.

- [ ] **Step 3: 차단·해제 라우트**

Create `app/api/admin/users/block/route.ts`:

```ts
import { requireAdminUser } from "../../stats/route";

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }
  const payload = body as { userId?: unknown; isBlocked?: unknown };
  if (typeof payload.userId !== "string" || typeof payload.isBlocked !== "boolean") {
    return Response.json({ message: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }
  if (payload.userId === userId) {
    return Response.json({ message: "자기 계정은 차단할 수 없어요" }, { status: 400 });
  }

  const { error } = await admin.from("profiles")
    .update({ is_blocked: payload.isBlocked, updated_at: new Date().toISOString() })
    .eq("id", payload.userId);
  if (error) return Response.json({ message: "계정 상태를 바꾸지 못했어요" }, { status: 500 });

  await admin.from("admin_audit_logs").insert({
    admin_user_id: userId,
    action: payload.isBlocked ? "block_user" : "unblock_user",
    target_user_id: payload.userId,
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: 검증**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 빌드가 `/api/admin/stats`, `/api/admin/users`, `/api/admin/users/block` 라우트를 인식, 테스트 19개 통과

- [ ] **Step 5: 커밋**

```bash
git add app/api
git commit -m "feat: add admin stats and account block API"
```

---

## Task 8: 관리자 화면

**Files:**
- Create: `app/admin/page.tsx`
- Modify: `app/globals.css`
- Modify: `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`

**Interfaces:**
- Consumes: `GET /api/admin/stats`, `GET /api/admin/users`, `POST /api/admin/users/block` (Task 7), `getSupabaseBrowserClient()`

- [ ] **Step 1: 화면 구현**

Create `app/admin/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stats = { userCount: number; newUsersThisWeek: number; tripCount: number; favoriteCount: number; blockedCount: number };
type AdminUser = { id: string; email: string; displayName: string; role: string; isBlocked: boolean; createdAt: string; tripCount: number };

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState("");

  const authorizedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase 설정이 필요해요");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Google로 먼저 로그인해주세요");
    const response = await fetch(path, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "요청을 처리하지 못했어요");
    return payload;
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsPayload, usersPayload] = await Promise.all([
        authorizedFetch("/api/admin/stats"),
        authorizedFetch("/api/admin/users"),
      ]);
      setStats(statsPayload);
      setUsers(usersPayload.users);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "요청을 처리하지 못했어요");
    } finally {
      setIsLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => { void load(); }, [load]);

  async function handleToggleBlock(user: AdminUser) {
    const nextBlocked = !user.isBlocked;
    if (!window.confirm(`${user.email} 계정을 ${nextBlocked ? "차단" : "차단 해제"}할까요?`)) return;
    setPendingUserId(user.id);
    try {
      await authorizedFetch("/api/admin/users/block", { method: "POST", body: JSON.stringify({ userId: user.id, isBlocked: nextBlocked }) });
      setUsers(current => current.map(item => item.id === user.id ? { ...item, isBlocked: nextBlocked } : item));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "계정 상태를 바꾸지 못했어요");
    } finally {
      setPendingUserId("");
    }
  }

  return <main className="admin-page">
    <h1>하루여행 관리자</h1>
    <p className="admin-note">가입자 통계와 계정 상태만 볼 수 있어요. 사용자의 출발지 주소와 일정 내용은 표시하지 않아요.</p>
    {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
    {isLoading && <p role="status">불러오는 중이에요…</p>}

    {stats && <ul className="admin-stats">
      <li><b>{stats.userCount}</b><span>전체 가입자</span></li>
      <li><b>{stats.newUsersThisWeek}</b><span>최근 7일 가입</span></li>
      <li><b>{stats.tripCount}</b><span>저장된 일정</span></li>
      <li><b>{stats.favoriteCount}</b><span>즐겨찾기 출발지</span></li>
      <li><b>{stats.blockedCount}</b><span>차단된 계정</span></li>
    </ul>}

    {users.length > 0 && <div className="admin-table-wrap">
      <table className="admin-table">
        <caption>가입 계정 목록 (최근 100개)</caption>
        <thead>
          <tr><th scope="col">이메일</th><th scope="col">이름</th><th scope="col">권한</th><th scope="col">일정 수</th><th scope="col">가입일</th><th scope="col">상태</th></tr>
        </thead>
        <tbody>
          {users.map(user => <tr key={user.id} className={user.isBlocked ? "blocked" : ""}>
            <td>{user.email}</td>
            <td>{user.displayName || "—"}</td>
            <td>{user.role === "admin" ? "관리자" : "일반"}</td>
            <td>{user.tripCount}</td>
            <td>{new Date(user.createdAt).toLocaleDateString("ko-KR")}</td>
            <td>
              <button type="button" disabled={pendingUserId === user.id} onClick={() => handleToggleBlock(user)}>
                {pendingUserId === user.id ? "처리 중…" : user.isBlocked ? "차단 해제" : "차단"}
              </button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>}

    <p className="admin-back"><a href="/">하루여행으로 돌아가기</a></p>
  </main>;
}
```

- [ ] **Step 2: 스타일 추가**

`app/globals.css` 맨 끝에 추가한다.

```css
/* 2026-09-11: 관리자 화면 */
.admin-page{max-width:1080px;margin:0 auto;padding:56px clamp(20px,5vw,48px)}
.admin-page h1{font-size:clamp(28px,4vw,38px);letter-spacing:-1.4px;margin:0}
.admin-note{margin:10px 0 26px;color:#607168;font-size:12px;line-height:1.6}
.admin-error{margin:0 0 18px;padding:12px 14px;border:1px solid #e0a893;border-radius:4px;background:#fff6f3;color:#b34d36;font-size:12px}
.admin-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 30px;padding:0;list-style:none}
.admin-stats li{padding:18px 16px;border:1px solid var(--line);border-radius:6px;background:#fff}
.admin-stats b{display:block;font-size:30px;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.admin-stats span{display:block;margin-top:5px;color:#7d948b;font-size:11px;font-weight:700}
.admin-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:#fff}
.admin-table{width:100%;min-width:680px;border-collapse:collapse;font-size:12px}
.admin-table caption{padding:14px 16px;color:#7d948b;font-size:11px;font-weight:800;text-align:left}
.admin-table th,.admin-table td{padding:12px 16px;border-top:1px solid var(--line);text-align:left;white-space:nowrap}
.admin-table th{color:#7d948b;font-size:10px;letter-spacing:1px}
.admin-table tr.blocked td{background:#fff6f3;color:#8a6152}
.admin-table td button{min-height:34px;padding:0 13px;border:1px solid #cfd8d2;border-radius:999px;background:#fff;color:var(--green);font-size:11px;font-weight:800}
.admin-table td button:hover:enabled{border-color:#b2cf51;color:#45610b}
.admin-table td button:disabled{cursor:wait;opacity:.6}
.admin-back{margin-top:26px;font-size:12px}
.admin-back a{color:var(--green);font-weight:800;text-underline-offset:3px}
@media(max-width:800px){.admin-page{padding:38px 20px}.admin-stats b{font-size:25px}}
```

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 빌드가 `/admin` 라우트를 인식, 테스트 19개 통과

- [ ] **Step 4: 브라우저 확인**

`npm run dev` 후 `http://localhost:3000/admin`에서 비로그인 상태의 안내 문구를 확인한다. Supabase 환경변수가 없으면 "Supabase 설정이 필요해요"가 뜨는 것이 정상이다. 375px에서 표가 가로 스크롤되고 페이지 본문은 가로 넘침이 없는지 확인한다.

- [ ] **Step 5: 문서 갱신**

`docs/ROADMAP.md`의 `## Phase 5 — 계정과 동기화`에서 다음 두 줄을 갱신한다.

```markdown
- [x] 출발지 즐겨찾기 동기화
- [x] 관리자 화면과 서버 권한 검사 (통계·계정 차단·감사 기록)
```

`docs/PROJECT_CONTEXT.md` 맨 위에 다음 섹션을 추가한다.

```markdown
## 최신 작업 — 2026-09-11 출발지·이미지·관리자

- 여행 지역과 별개로 실제 출발지를 고른다. 주소·건물·역 검색, 내 위치, 즐겨찾기 세 가지 방법을 제공하며 즐겨찾기는 로그인 시 `favorite_origins` 테이블과 동기화한다.
- 가까운 지하철·버스 조회 기준을 일정 첫 장소에서 선택한 출발지로 바꿨다.
- 공유 링크에는 출발지를 넣지 않는다. 집·회사 주소가 링크로 새어 나가지 않게 하기 위해서다.
- `더보기 → 이미지 저장`으로 일정을 PNG로 내려받는다. 새 라이브러리 없이 Canvas 2D로 직접 그리며, 모바일에서는 공유 시트를 먼저 시도한다.
- `/admin`에서 가입자·일정·즐겨찾기 집계와 계정 차단·해제를 제공한다. 권한 검사는 `app/api/admin/**`의 서버 라우트가 service_role 키로 수행하고, 차단·해제는 `admin_audit_logs`에 남는다. 관리자 화면은 주소와 일정 본문을 조회하지 않는다.
- 일정 순서 이동 후 포커스가 옮겨진 카드에 남고 새 위치를 안내한다.
- 배포 전 필요한 설정: Supabase에 마이그레이션 2건 적용, Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 등록, 본인 계정의 `profiles.role`을 `admin`으로 1회 지정.
```

- [ ] **Step 6: 커밋**

```bash
git add app/admin app/globals.css docs/ROADMAP.md docs/PROJECT_CONTEXT.md
git commit -m "feat: add admin dashboard with account blocking"
```

---

## Task 9: 전체 회귀 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 검증**

Run: `npx tsc --noEmit && npm test && npx eslint . --ignore-pattern dist --ignore-pattern .next`
Expected: 타입 오류 없음, 테스트 19개 통과, lint 오류 없음

- [ ] **Step 2: 반응형 확인**

`npm run dev` 후 320px, 375px, 768px, 1440px에서 `/`와 `/admin`의 가로 넘침, 버튼 잘림, 긴 장소명 줄바꿈을 확인한다.

- [ ] **Step 3: 미검증 항목 보고**

다음은 로컬에서 재현할 수 없으므로 사용자에게 명시적으로 보고한다.

- 카카오 도메인 미등록으로 출발지 검색, 지역 검색, 일정 생성의 실제 카카오 응답
- Supabase 환경변수 부재로 Google 로그인, 즐겨찾기·일정 동기화, 관리자 API 응답
- 실기기 터치와 가상 키보드
- 서로 다른 구글 계정 2개의 데이터 분리

- [ ] **Step 4: 최종 커밋과 푸시 제안**

```bash
git status --short
```

푸시는 사용자 승인 후에만 실행한다.

---

## 자체 점검

**설계 문서 대비 반영 범위**

| 설계 문서 항목 | 반영 |
| --- | --- |
| 실제 출발지 / 여행 지역 / 첫 장소 분리 | Task 4 |
| 출발지 세 가지 선택 방법 | Task 4 (검색·내 위치·즐겨찾기) |
| favorite_origins 데이터 모델과 RLS | Task 3 |
| saved_trips.origin | Task 3, Task 4 |
| 위치 권한 거부·검색 실패 안내 | Task 4 Step 10 |
| admin_audit_logs | Task 6 |
| 관리자 서버 권한 검사 | Task 6, Task 7 |
| 개인정보 제외 집계 통계 | Task 7 |
| 계정 차단·해제 + 감사 기록 | Task 7, Task 8 |
| 차단 계정의 서버 데이터 접근 거부 | Task 6 Step 6 (restrictive RLS) |
| 관리자에게 주소·일정 본문 미노출 | Task 7 Step 2 |

**의도적으로 이번 범위에서 뺀 것** (설계 문서 3단계와 4단계 일부)

- 카카오 REST 대중교통 경로 조회와 요약 카드: 카카오 REST 키와 쿼터 확인이 먼저 필요하다. 현재는 출발지 주변 지하철·버스 이름만 보여준다.
- 추천 지역·공지 콘텐츠 관리: 사용자가 이번 범위에서 제외했다.
- 헤더의 `/admin` 링크: 관리자 여부를 알려면 로그인 시 프로필을 한 번 더 조회해야 한다. 주소창으로 접근하며, 필요해지면 추가한다.
