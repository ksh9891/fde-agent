# Booking Web Preset — Builder Rules

## Tech Stack
- Next.js 16 (App Router, React 19)
- TypeScript (strict mode)
- shadcn/ui for all UI components
- Tailwind CSS with design-tokens only (no arbitrary colors)
- JSON file-based data store (`src/lib/data-store.ts`) for persistence
- zod for input validation at API boundaries
- Playwright for E2E, Vitest for unit/component tests

## Route Structure — **FIXED, do not change**
This preset uses TWO route groups. You MUST keep this split.

```
src/app/(public)/                    # public, no auth
    page.tsx                         # landing
    {entity-slug}/page.tsx           # catalog list
    {entity-slug}/[id]/page.tsx      # catalog detail
    login/page.tsx                   # login (with redirect query support)
    signup/page.tsx                  # signup
src/app/(member)/                    # login-required (wrapped by AuthGate)
    book/[itemId]/page.tsx           # booking form
    my/reservations/page.tsx         # member's own reservations
src/app/api/
    auth/signup/route.ts
    auth/login/route.ts
    reservations/route.ts            # POST (create) + GET (filter by memberId)
    {entity}/route.ts                # generic CRUD for catalog entities
    {entity}/[id]/route.ts
```

### URL contract (DO NOT change)
| Role | URL |
|---|---|
| Landing | `/` |
| Catalog list | `/{slug}` |
| Catalog detail | `/{slug}/[id]` |
| Signup | `/signup` |
| Login | `/login` |
| Booking form | `/book/{item-id}` |
| My reservations | `/my/reservations` |

## Layout
- Public pages: wrap children in `PublicLayout` via `(public)/layout.tsx`. Already provided.
- Member pages: wrap children in `AuthGate` + `MemberLayout` via `(member)/layout.tsx`. Already provided.
- Do NOT create alternative layouts. Do NOT add sidebars. Do NOT move auth logic into individual pages.

## Auth
- Session is held client-side via `AuthProvider` (see `src/lib/auth.tsx`). localStorage persistence.
- Login: POST `/api/auth/login` with `{ username, password }`. 200 returns safe user (no password). 401 → show "아이디 또는 비밀번호가 올바르지 않습니다".
- Signup: POST `/api/auth/signup`. 201 returns new member. 409 `USERNAME_TAKEN` → show "이미 사용 중인 아이디입니다". 400 → show generic message.
- After signup or login, navigate to `searchParams.redirect` if present, else `/my/reservations`.
- Logout: `useAuth().logout()` clears localStorage and state.

## Auth Gate
- `(member)/layout.tsx` wraps children with `<AuthGate>`. When `isAuthenticated === false`, AuthGate redirects to `/login?redirect={current URL}`.
- Do NOT add `useEffect(() => router.push("/login"))` in individual member pages — AuthGate already does it.

## Data Layer
- `createDataStore<T>("entityName")` returns `{ getAll, getById, create, update, remove, seed }`. Reuse this; do not invent a different persistence mechanism.
- Each catalog entity gets `/api/{entity}/route.ts` (GET all, POST create) and `/api/{entity}/[id]/route.ts` (GET, PATCH, DELETE). Clone from admin-web style if missing.
- Reservations API (`/api/reservations`) already exists. Extend the POST handler in-place to enforce requirements (stock decrement, member-type access). Do not bypass; do not duplicate it.

## Member Types
- Member records carry a `memberType` string field. The preset does NOT encode which types exist — your eval spec's requirements define that.
- Typical pattern: "분양회원번호 있음 → memberType=owner; 없음 → memberType=general" (already implemented in `/api/auth/signup`).
- If a requirement adds more types, extend signup's discriminator inline.

## Catalog Entities
- For each catalog entity in the eval spec, create:
  - `(public)/{slug}/page.tsx` — list using `CatalogGrid`/`CatalogCard`
  - `(public)/{slug}/[id]/page.tsx` — detail with "예약하기" CTA linking to `/book/{id}`
- Use `fetchAll("{slug}")` and `fetchById("{slug}", id)` from `src/lib/api-client.ts`.
- Seed data: add `{slug}Seed` in `src/lib/seed-data.ts` and register in `/api/seed/route.ts`. The seed route is called on first visit.

## Booking Template
- The scaffold's `(member)/book/[itemId]/page.tsx` fetches from `"example"` — **replace with your actual catalog entity slug** (e.g., `"rooms"`).
- Extend the POST `/api/reservations` handler to implement the requirements in your eval spec — stock check, member-type access check, stock decrement on success. The handler already has a `TODO(builder)` comment pointing to the spot.

## Landing Page
- `(public)/page.tsx` ships with a generic hero. Add one or two CTAs linking to your main catalog list (e.g., `/rooms`). Keep it short.

## Style
- Korean UI for all user-facing text.
- Use Tailwind spacing scale only. No arbitrary values.
- Colors come from design-tokens.json — never hardcode hex.

## Testing
- `npm run test` (vitest) must pass at all times.
- `npm run test:e2e` runs Playwright. E2E specs live in `e2e/`; Test Writer adds flow tests in `e2e/flows/`.
- Do NOT modify files under `e2e/` that were auto-generated from templates.

## Forbidden
- Replacing `(public)` / `(member)` split with a single route group.
- Adding sidebar-style navigation.
- Storing passwords in plain text anywhere other than the JSON mock store (it's mock — that's acceptable here).
- Checking auth via `useEffect` in individual pages (use AuthGate).
- Changing URL contract paths listed above.
