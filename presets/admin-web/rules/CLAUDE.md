# Admin Web Preset — Builder Rules

## Tech Stack
- Next.js 16 (App Router)
- TypeScript (strict mode)
- shadcn/ui for all UI components
- Tailwind CSS for styling — use design tokens only, no arbitrary values
- JSON file-based data store (`src/lib/data-store.ts`) for data access
- vitest for unit/component tests
- Playwright for E2E tests

## Layout
- Use the existing AdminLayout (sidebar + header)
- Sidebar: navigation menu with role-based visibility
- Header: page title + user info
- Do not create alternative layouts

## Directory Structure
```
src/app/(admin)/{entity-slug}/page.tsx          # list
src/app/(admin)/{entity-slug}/[id]/page.tsx      # detail
src/app/(admin)/{entity-slug}/new/page.tsx       # create form
src/app/(admin)/{entity-slug}/[id]/edit/page.tsx  # edit form
src/app/(admin)/dashboard/page.tsx               # dashboard
src/app/(admin)/layout.tsx                       # admin layout (protected)
src/lib/types.ts                                 # entity interfaces
src/lib/seed-data.ts                             # sample data
e2e/                                             # template E2E tests (do not modify)
e2e/flows/                                       # generated E2E tests
```

## Page Patterns
Use these patterns for all pages:

### List Page
- DataTable component with sorting, filtering, search
- Pagination
- Row click navigates to detail

### Detail Page
- Card-based layout showing entity fields
- Action buttons (edit, status change, delete)
- Back navigation

### Form Page
- FormBuilder component with validation
- Required field indicators
- Error messages inline
- Submit saves and navigates to detail

### Dashboard Page
- StatCard components for key metrics
- Use grid layout (2-3 columns desktop, 1 column mobile)

## Data Layer
- Use the JSON file-based data store (`src/lib/data-store.ts`) — getAll, getById, create, update, remove
- API routes at `/api/[entity]` and `/api/[entity]/[id]` handle CRUD
- Single-record operations only — no bulk delete/update
- All mutations must validate input with zod

## Testing
- Every domain logic function must have a unit test
- Every form must have validation tests
- `npm run test` (vitest) must pass at all times
- `npm run test:e2e` (Playwright) — E2E tests are in `e2e/` directory
- Do NOT modify existing E2E test files generated from templates

## Style
- Use design-tokens.json for all colors — never hardcode colors
- Korean language for all user-facing text
- Consistent spacing: use Tailwind spacing scale only

## Auth
- Dummy login: `admin@example.com` / `password`
- Auth wrapper redirects unauthenticated users to `/login`
- E2E tests use these credentials — do not change the auth flow

## Seed Data
- `src/lib/seed-data.ts` contains sample records for all entities
- POST `/api/seed` initializes data store with seed data
- Use realistic Korean data (names, phone numbers, dates)
