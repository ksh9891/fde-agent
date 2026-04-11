# Admin Web Preset — Builder Rules

## Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- shadcn/ui for all UI components
- Tailwind CSS for styling — use design tokens only, no arbitrary values
- Prisma ORM for data access — no raw SQL
- vitest for unit/component tests

## Layout
- Use the existing AdminLayout (sidebar + header)
- Sidebar: navigation menu with role-based visibility
- Header: page title + user info
- Do not create alternative layouts

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
- Use Prisma ORM exclusively
- Never use deleteMany, updateMany — single-record operations only
- Always findUnique before delete
- All mutations must validate input with zod

## Testing
- Every domain logic function must have a unit test
- Every form must have validation tests
- npm run test must pass at all times

## Style
- Use design-tokens.json for all colors — never hardcode colors
- Korean language for all user-facing text
- Consistent spacing: use Tailwind spacing scale only
