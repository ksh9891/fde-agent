# booking-web Preset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FDE Harness Agent에 `booking-web` preset을 추가해 B2C 예약형 사이트(리조트·호텔·스파·병원예약)의 eval spec을 end-to-end로 통과시킨다.

**Architecture:** Next.js 16 + React 19 + shadcn/ui. `(public)` + `(member)` 2개 route group. localStorage 기반 mock 세션. JSON 파일 데이터 스토어 재사용. Provisioner에 preset-aware 분기 추가(`core/preset.json`). test-pack 8종 템플릿.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5, Tailwind 4, shadcn/ui, react-hook-form, zod, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-21-booking-web-preset-design.md`

---

## Phase 1 — Provisioner 일반화

Provisioner에 `preset.json` 지원과 E2E 템플릿 디렉토리 스캔을 도입해 booking-web과 admin-web을 모두 같은 로직으로 처리하게 만든다. admin-web의 하위 호환을 반드시 유지한다.

### Task 1: Provisioner에 `preset.json` 로딩 + skeleton_generation 분기

**Files:**
- Create: `presets/admin-web/core/preset.json`
- Modify: `orchestrator/src/provisioner.ts`
- Test: `orchestrator/src/__tests__/provisioner.test.ts`

- [ ] **Step 1: Write the failing test**

`orchestrator/src/__tests__/provisioner.test.ts` 파일 하단에 추가:

```typescript
import { mkdir, writeFile } from "fs/promises";

// 주의: package.json을 scaffold에 두면 Provisioner가 npm install + playwright install을 트리거해
// 테스트가 수 분 걸리고 네트워크 의존. 여기서는 빈 scaffold 디렉토리만 만들어 그 경로를 회피한다.

it("should skip entity skeleton generation when preset.json sets skeleton_generation=none", async () => {
  const runId = "run_skeleton_none";
  const presetName = "noop-preset";
  const presetCoreDir = join(PRESETS_DIR, presetName, "core");
  const scaffoldDir = join(presetCoreDir, "scaffold");
  await mkdir(scaffoldDir, { recursive: true });
  await writeFile(
    join(presetCoreDir, "preset.json"),
    JSON.stringify({ skeleton_generation: "none" })
  );

  const workspace = await provisioner.create({
    runId,
    preset: presetName,
    palette: "warm-neutral",
    entities: [{ name: "객실", slug: "rooms", fields: ["code", "name"] }],
  });

  // Provisioner가 (admin) 경로를 만들면 안 됨
  const adminPath = join(workspace, "app", "src", "app", "(admin)", "rooms");
  await expect(access(adminPath)).rejects.toThrow();
});

it("should keep admin-web skeleton generation when preset.json sets skeleton_generation=admin-web", async () => {
  const runId = "run_skeleton_admin";
  const presetName = "fake-admin";
  const presetCoreDir = join(PRESETS_DIR, presetName, "core");
  const scaffoldDir = join(presetCoreDir, "scaffold");
  await mkdir(scaffoldDir, { recursive: true });
  await writeFile(
    join(presetCoreDir, "preset.json"),
    JSON.stringify({ skeleton_generation: "admin-web" })
  );

  const workspace = await provisioner.create({
    runId,
    preset: presetName,
    palette: "warm-neutral",
    entities: [{ name: "객실", slug: "rooms", fields: ["code"] }],
  });

  const listPage = join(workspace, "app", "src", "app", "(admin)", "rooms", "page.tsx");
  await expect(access(listPage)).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd orchestrator && npm test -- provisioner`
Expected: 새로 추가한 두 테스트가 실패 (preset.json 파싱 로직과 분기 없음). 기존 테스트는 통과.

- [ ] **Step 3: Implement preset.json loading**

`orchestrator/src/provisioner.ts`에서 `generateEntitySkeletons` 호출부 직전에 preset.json을 읽고 분기한다. 파일 상단 imports는 이미 `readFile`이 있다.

`create()` 메서드 안에서 `// Generate skeleton pages for each entity` 주석 블록을 다음으로 교체:

```typescript
// Read preset.json to determine skeleton generation strategy (default: admin-web for back-compat)
const presetJsonPath = join(this.presetsDir, input.preset, "core", "preset.json");
let skeletonStrategy: "admin-web" | "none" = "admin-web";
if (existsSync(presetJsonPath)) {
  try {
    const raw = await readFile(presetJsonPath, "utf-8");
    const cfg = JSON.parse(raw) as { skeleton_generation?: "admin-web" | "none" };
    if (cfg.skeleton_generation === "none") {
      skeletonStrategy = "none";
    }
  } catch {
    // fall back to admin-web
  }
}

// Generate skeleton pages for each entity
if (skeletonStrategy === "admin-web" && input.entities && input.entities.length > 0) {
  console.log("[FDE-AGENT] Generating entity page skeletons (admin-web)...");
  await this.generateEntitySkeletons(appDir, input.entities);
  console.log("[FDE-AGENT] Entity skeletons generated");
}

// Generate template E2E tests (preset-agnostic scan)
if (input.entities && input.entities.length > 0) {
  const testPackDir = join(this.presetsDir, input.preset, "test-pack", "scenarios");
  if (existsSync(testPackDir)) {
    console.log("[FDE-AGENT] Generating template E2E tests...");
    await this.generateTemplateE2ETests(appDir, input.entities, testPackDir);
    console.log("[FDE-AGENT] Template E2E tests generated");
  }
}
```

참고: 기존 코드는 skeleton 생성과 E2E 템플릿 복사가 `if (input.entities && input.entities.length > 0)` 하나의 블록 안에 있었다. 이를 두 개의 독립 블록으로 분리했다. E2E 템플릿 복사는 이 태스크에서 동작이 동일하다(다음 태스크에서 일반화).

- [ ] **Step 4: Add admin-web preset.json (back-compat anchor)**

`presets/admin-web/core/preset.json` 생성:

```json
{
  "skeleton_generation": "admin-web"
}
```

- [ ] **Step 5: Run tests to verify passes**

Run: `cd orchestrator && npm test -- provisioner`
Expected: 모든 provisioner 테스트 PASS.

전체 orchestrator 테스트도 확인:

Run: `cd orchestrator && npm test`
Expected: 모든 테스트 PASS (회귀 없음).

- [ ] **Step 6: Commit**

```bash
git add orchestrator/src/provisioner.ts orchestrator/src/__tests__/provisioner.test.ts presets/admin-web/core/preset.json
git commit -m "feat(provisioner): add preset.json skeleton_generation flag"
```

---

### Task 2: E2E 템플릿 생성 로직을 디렉토리 스캔 방식으로 일반화

**Files:**
- Modify: `orchestrator/src/provisioner.ts` (replace `generateTemplateE2ETests`)
- Test: `orchestrator/src/__tests__/provisioner.test.ts`

`generateTemplateE2ETests`가 `list-view`/`detail-view`/`form-submit`/`dashboard` 파일명을 하드코딩한다. 디렉토리 스캔 + 플레이스홀더 유무 자동 판별로 바꾼다.

- [ ] **Step 1: Write the failing test**

`provisioner.test.ts`에 추가:

```typescript
import { readFile } from "fs/promises";

it("should copy templates without entity placeholders as single spec files", async () => {
  const runId = "run_flow_templates";
  const presetName = "flow-preset";
  const presetCoreDir = join(PRESETS_DIR, presetName, "core");
  const scaffoldDir = join(presetCoreDir, "scaffold");
  const testPackDir = join(PRESETS_DIR, presetName, "test-pack", "scenarios");
  await mkdir(scaffoldDir, { recursive: true });
  await mkdir(testPackDir, { recursive: true });
  // package.json 없음 (위 주의사항 참조)
  await writeFile(
    join(presetCoreDir, "preset.json"),
    JSON.stringify({ skeleton_generation: "none" })
  );
  // Flow template (no entity placeholder)
  await writeFile(
    join(testPackDir, "auth-gate.template.ts"),
    `import { test } from '@playwright/test';\ntest('auth gate', async ({ page }) => {\n  await page.goto('/my/reservations');\n});\n`
  );
  // Entity-placeholder template
  await writeFile(
    join(testPackDir, "catalog-list.template.ts"),
    `const ENTITY_NAME = '__ENTITY_NAME__';\nconst ENTITY_PATH = '__ENTITY_PATH__';\n`
  );

  const workspace = await provisioner.create({
    runId,
    preset: presetName,
    palette: "warm-neutral",
    entities: [{ name: "객실", slug: "rooms", fields: ["code"] }],
  });

  // Flow template copied as-is
  const authGate = join(workspace, "app", "e2e", "auth-gate.spec.ts");
  await expect(access(authGate)).resolves.toBeUndefined();

  // Entity template copied per-entity with placeholders substituted
  const roomsList = join(workspace, "app", "e2e", "rooms-catalog-list.spec.ts");
  await expect(access(roomsList)).resolves.toBeUndefined();
  const content = await readFile(roomsList, "utf-8");
  expect(content).toContain("'객실'");
  expect(content).toContain("'/rooms'");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd orchestrator && npm test -- provisioner`
Expected: 새 테스트 FAIL — 하드코딩된 파일명만 처리하기 때문.

- [ ] **Step 3: Rewrite `generateTemplateE2ETests`**

`provisioner.ts`에서 기존 `generateTemplateE2ETests` 메서드를 통째로 다음으로 교체:

```typescript
private async generateTemplateE2ETests(
  appDir: string,
  entities: EntityDef[],
  testPackDir: string
): Promise<void> {
  const { readdir } = await import("fs/promises");
  const e2eDir = join(appDir, "e2e");
  await mkdir(e2eDir, { recursive: true });

  const files = await readdir(testPackDir);
  const templates = files.filter((f) => f.endsWith(".template.ts"));

  for (const file of templates) {
    const baseName = file.replace(/\.template\.ts$/, "");
    const content = await readFile(join(testPackDir, file), "utf-8");
    const hasEntityPlaceholders =
      content.includes("__ENTITY_NAME__") ||
      content.includes("__ENTITY_PATH__") ||
      content.includes("__DETAIL_PATH__") ||
      content.includes("__FORM_PATH__") ||
      content.includes("__SEARCH_FIELD__");

    if (!hasEntityPlaceholders) {
      // Flow template — copy as single spec file
      await writeFile(join(e2eDir, `${baseName}.spec.ts`), content);
      continue;
    }

    // Entity template — generate per-entity copies.
    // 플레이스홀더는 single/double quote 모두 허용해서 admin-web(single)과 booking-web(either)에 호환.
    for (const entity of entities) {
      const slug = entity.slug;
      let out = content;
      out = out.replace(/['"]__ENTITY_NAME__['"]/g, `'${entity.name}'`);
      out = out.replace(/['"]__ENTITY_PATH__['"]/g, `'/${slug}'`);
      out = out.replace(/['"]__DETAIL_PATH__['"]/g, `'/${slug}/1'`);
      out = out.replace(/['"]__FORM_PATH__['"]/g, `'/${slug}/new'`);
      out = out.replace(
        /['"]__SEARCH_FIELD__['"]/g,
        `'${entity.fields[0] ?? ""}'`
      );
      // REQUIRED_FIELDS injection (admin-web form-submit template compatibility)
      if (content.includes("// Test Writer fills these in")) {
        const fieldsToUse = entity.fields.slice(0, 3);
        const fieldEntries = fieldsToUse
          .map((f) => `  { label: "${f}", value: "테스트 ${f}" },`)
          .join("\n");
        out = out.replace(
          /const REQUIRED_FIELDS: \{ label: string; value: string \}\[\] = \[\n\s*\/\/ Test Writer fills these in\n\];/,
          `const REQUIRED_FIELDS: { label: string; value: string }[] = [\n${fieldEntries}\n];`
        );
      }
      await writeFile(join(e2eDir, `${slug}-${baseName}.spec.ts`), out);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify passes**

Run: `cd orchestrator && npm test -- provisioner`
Expected: 모두 PASS.

admin-web 기존 플로우가 깨지지 않았는지 확인 — 기존 admin-web 템플릿들은 여전히 per-entity spec 파일로 복사된다(파일명이 `{slug}-list-view.spec.ts`로 바뀐다). 이는 기존 admin-web 네이밍(`{slug}-list.spec.ts`)과 다르다.

**네이밍 호환 처리**: 기존 admin-web의 파일명 네이밍을 유지하려면 매핑이 필요하나, 실제로 evaluator는 `e2e/*.spec.ts`를 모두 돌리므로 파일명 자체는 기능에 영향이 없다. 테스트도 `expect(access(...))`로 파일 존재 여부만 확인한다. admin-web 관련 기존 provisioner 테스트가 특정 파일명을 기대하는지 확인:

Run: `cd orchestrator && npm test`
Expected: 전체 PASS.

만약 기존 테스트가 깨지면 해당 테스트의 기대 파일명을 새 네이밍(`{slug}-list-view.spec.ts` 등)으로 갱신한다.

**Follow-up during review**: the code-quality reviewer discovered that `reporter.ts:buildCoverageFromSpecs` hardcodes the old suffixes (`-list`, `-detail`, `-form`). Rather than update reporter + its tests, we rename admin-web templates back to `list/detail/form.template.ts` so the generated filenames stay `{slug}-list.spec.ts` etc. No reporter change needed. This is done as a separate follow-up commit after Task 2.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/provisioner.ts orchestrator/src/__tests__/provisioner.test.ts
git commit -m "refactor(provisioner): scan test-pack directory for E2E templates"
```

---

## Phase 2 — booking-web scaffold 초기화

admin-web scaffold를 fork한 뒤 booking-web 전용으로 변형한다. 각 변형 단위마다 빌드를 확인해 회귀를 조기에 잡는다.

### Task 3: scaffold fork + preset.json 추가

**Files:**
- Create: `presets/booking-web/core/scaffold/` (admin-web에서 복사)
- Create: `presets/booking-web/core/preset.json`
- Delete: `presets/booking-web/core/scaffold/node_modules/` (복사하지 않음)

- [ ] **Step 1: Fork scaffold**

```bash
mkdir -p presets/booking-web/core
cp -R presets/admin-web/core/scaffold presets/booking-web/core/scaffold
rm -rf presets/booking-web/core/scaffold/node_modules presets/booking-web/core/scaffold/.next presets/booking-web/core/scaffold/data
```

- [ ] **Step 2: Create preset.json**

`presets/booking-web/core/preset.json`:

```json
{
  "skeleton_generation": "none"
}
```

- [ ] **Step 3: Smoke build**

```bash
cd presets/booking-web/core/scaffold
npm install
npm run build
```

Expected: admin-web과 동일하게 성공.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/
git commit -m "feat(booking-web): fork admin-web scaffold + skeleton_generation=none"
```

---

### Task 4: app metadata와 globals 정리

**Files:**
- Modify: `presets/booking-web/core/scaffold/src/app/layout.tsx`
- Modify: `presets/booking-web/core/scaffold/package.json` (name만)

- [ ] **Step 1: Update package.json name**

`presets/booking-web/core/scaffold/package.json`:

```diff
-  "name": "scaffold",
+  "name": "booking-web-scaffold",
```

- [ ] **Step 2: Update root layout metadata**

`presets/booking-web/core/scaffold/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProviderWrapper } from "./auth-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "예약 서비스",
  description: "온라인 예약 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/package.json presets/booking-web/core/scaffold/src/app/layout.tsx
git commit -m "chore(booking-web): update scaffold metadata"
```

---

## Phase 3 — 인증 재구성 (localStorage + signup + 멀티유저)

booking-web은 signup과 멀티유저가 필요하다. `AuthProvider`를 localStorage 영속화 + 서버 API 호출 기반으로 확장한다. 서버 API는 클라이언트에서 호출 가능한 형태로 `data-store`를 감싸 멤버 레코드를 관리한다.

### Task 5: `/api/auth/signup` POST 엔드포인트

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/api/auth/signup/route.ts`
- Create: `presets/booking-web/core/scaffold/src/lib/member-store.ts`

- [ ] **Step 1: Create member-store helper**

`presets/booking-web/core/scaffold/src/lib/member-store.ts`:

```typescript
import { createDataStore } from "./data-store";

export interface Member {
  id: string;
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  ownerNumber?: string;
  memberType: string; // "owner" | "general" 등 — preset은 값을 강제하지 않음. Builder가 requirement에 따라 결정.
  [key: string]: unknown;
}

export const memberStore = createDataStore<Member>("members");

export function findMemberByUsername(username: string): Member | undefined {
  return memberStore.getAll().find((m) => m.username === username);
}
```

- [ ] **Step 2: Create signup route**

`presets/booking-web/core/scaffold/src/app/api/auth/signup/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memberStore, findMemberByUsername, type Member } from "@/lib/member-store";

const signupSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  ownerNumber: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { username, password, name, phone, email, ownerNumber } = parsed.data;

  if (findMemberByUsername(username)) {
    return NextResponse.json(
      { error: "USERNAME_TAKEN" },
      { status: 409 }
    );
  }

  const memberType = ownerNumber && ownerNumber.length > 0 ? "owner" : "general";

  const created = memberStore.create({
    username,
    password,
    name,
    phone,
    email: email || undefined,
    ownerNumber: ownerNumber || undefined,
    memberType,
  } as Omit<Member, "id">);

  // never return password
  const { password: _pw, ...safe } = created;
  return NextResponse.json(safe, { status: 201 });
}
```

참고: 비밀번호 규칙(8자, 영문+숫자)·연락처 형식 같은 세부 검증은 eval spec의 requirement가 지시할 때 Builder가 추가한다. 여기서는 기본 zod 스키마만 제공한다.

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/lib/member-store.ts presets/booking-web/core/scaffold/src/app/api/auth/signup/
git commit -m "feat(booking-web): add /api/auth/signup + member-store"
```

---

### Task 6: `/api/auth/login` POST 엔드포인트

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/api/auth/login/route.ts`

- [ ] **Step 1: Create login route**

`presets/booking-web/core/scaffold/src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findMemberByUsername } from "@/lib/member-store";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const member = findMemberByUsername(username);
  if (!member || member.password !== password) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const { password: _pw, ...safe } = member;
  return NextResponse.json(safe);
}
```

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/api/auth/login/
git commit -m "feat(booking-web): add /api/auth/login"
```

---

### Task 7: `AuthProvider` 확장 (localStorage + signup)

**Files:**
- Modify: `presets/booking-web/core/scaffold/src/lib/auth.tsx`

- [ ] **Step 1: Replace auth.tsx**

`presets/booking-web/core/scaffold/src/lib/auth.tsx` 전체를 교체:

```typescript
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

const STORAGE_KEY = "booking-web-auth";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email?: string;
  ownerNumber?: string;
  memberType: string;
  [key: string]: unknown;
}

export interface SignupInput {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  ownerNumber?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signup: (input: SignupInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore corrupted storage
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((value: AuthUser | null) => {
    setUser(value);
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false as const, error: body.error ?? "LOGIN_FAILED" };
      }
      const member = (await res.json()) as AuthUser;
      persist(member);
      return { ok: true as const };
    },
    [persist]
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false as const, error: body.error ?? "SIGNUP_FAILED" };
      }
      const member = (await res.json()) as AuthUser;
      persist(member);
      return { ok: true as const };
    },
    [persist]
  );

  const logout = useCallback(() => persist(null), [persist]);

  return (
    <AuthContext
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/lib/auth.tsx
git commit -m "feat(booking-web): localStorage-backed auth with signup"
```

---

## Phase 4 — Shell 교체: (public) + (member)

admin-web의 `(admin)` 그룹·`AdminLayout`·sidebar 구조를 걷어내고, 공개/보호 두 그룹을 만든다. 보호 그룹은 `auth-gate`가 리디렉션을 담당.

### Task 8: 공개 레이아웃 컴포넌트 `PublicLayout`

**Files:**
- Create: `presets/booking-web/core/scaffold/src/components/layout/public-layout.tsx`

- [ ] **Step 1: Create PublicLayout**

`presets/booking-web/core/scaffold/src/components/layout/public-layout.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface PublicLayoutProps {
  children: ReactNode;
  brand?: string;
  catalogPath?: string;
  catalogLabel?: string;
}

export function PublicLayout({
  children,
  brand = "예약 서비스",
  catalogPath,
  catalogLabel,
}: PublicLayoutProps) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold">
            {brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {catalogPath && (
              <Link href={catalogPath} className="text-muted-foreground hover:text-foreground">
                {catalogLabel ?? "카탈로그"}
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <Link href="/my/reservations" className="text-muted-foreground hover:text-foreground">
                  내 예약
                </Link>
                <span className="text-muted-foreground">{user?.name}</span>
                <Button size="sm" variant="outline" onClick={logout}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  로그인
                </Link>
                <Link href="/signup">
                  <Button size="sm">회원가입</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand}
        </div>
      </footer>
    </div>
  );
}
```

참고: `catalogPath`/`catalogLabel`은 Builder가 eval spec에 따라 `/rooms`/`"객실"` 같은 값으로 전달하도록 rules에 명시한다.

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/components/layout/public-layout.tsx
git commit -m "feat(booking-web): add PublicLayout"
```

---

### Task 9: AuthGate 컴포넌트

**Files:**
- Create: `presets/booking-web/core/scaffold/src/components/shared/auth-gate.tsx`

- [ ] **Step 1: Create AuthGate**

`presets/booking-web/core/scaffold/src/components/shared/auth-gate.tsx`:

```tsx
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const query = searchParams?.toString();
      const current = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(current)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router, searchParams]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/components/shared/auth-gate.tsx
git commit -m "feat(booking-web): add AuthGate redirect component"
```

---

### Task 10: (public) 라우트 그룹 레이아웃

**Files:**
- Delete: `presets/booking-web/core/scaffold/src/app/(admin)/` (전체 디렉토리)
- Delete: `presets/booking-web/core/scaffold/src/components/layout/admin-layout.tsx`
- Delete: `presets/booking-web/core/scaffold/src/app/page.tsx` (기존 landing)
- Create: `presets/booking-web/core/scaffold/src/app/(public)/layout.tsx`

- [ ] **Step 1: Delete admin artifacts**

```bash
rm -rf presets/booking-web/core/scaffold/src/app/\(admin\)
rm presets/booking-web/core/scaffold/src/components/layout/admin-layout.tsx
rm presets/booking-web/core/scaffold/src/app/page.tsx
```

- [ ] **Step 2: Create (public) layout**

`presets/booking-web/core/scaffold/src/app/(public)/layout.tsx`:

```tsx
import { ReactNode } from "react";
import { PublicLayout } from "@/components/layout/public-layout";

export default function PublicGroupLayout({ children }: { children: ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
```

- [ ] **Step 3: Move login page into (public)**

```bash
mkdir -p presets/booking-web/core/scaffold/src/app/\(public\)/login
git mv presets/booking-web/core/scaffold/src/app/login/page.tsx presets/booking-web/core/scaffold/src/app/\(public\)/login/page.tsx
rmdir presets/booking-web/core/scaffold/src/app/login
```

- [ ] **Step 4: Build verification (expect failures, fix imports)**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: 타입/경로 오류가 나올 수 있음. 오류를 보고 관련 import만 수정한다. `/dashboard`로 이동하던 기존 login 페이지의 router.push는 다음 태스크에서 다룬다 — 이 단계에서는 일단 `"/"`로 임시 변경해 빌드가 통과하게 한다.

`src/app/(public)/login/page.tsx` 상단에서 `router.push("/dashboard")` → `router.push("/")` (다음 태스크에서 redirect 처리로 교체).

빌드 PASS까지 반복.

- [ ] **Step 5: Commit**

```bash
git add presets/booking-web/core/scaffold/src/
git commit -m "refactor(booking-web): replace (admin) group with (public), drop AdminLayout"
```

---

### Task 11: (member) 라우트 그룹 레이아웃 + MemberLayout

**Files:**
- Create: `presets/booking-web/core/scaffold/src/components/layout/member-layout.tsx`
- Create: `presets/booking-web/core/scaffold/src/app/(member)/layout.tsx`

- [ ] **Step 1: Create MemberLayout**

`presets/booking-web/core/scaffold/src/components/layout/member-layout.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface MemberLayoutProps {
  children: ReactNode;
  brand?: string;
  catalogPath?: string;
  catalogLabel?: string;
}

export function MemberLayout({
  children,
  brand = "예약 서비스",
  catalogPath,
  catalogLabel,
}: MemberLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold">
            {brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {catalogPath && (
              <Link href={catalogPath} className="text-muted-foreground hover:text-foreground">
                {catalogLabel ?? "카탈로그"}
              </Link>
            )}
            <Link href="/my/reservations" className="text-muted-foreground hover:text-foreground">
              내 예약
            </Link>
            <span className="text-muted-foreground">{user?.name}</span>
            <Button size="sm" variant="outline" onClick={logout}>
              로그아웃
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create (member) group layout**

`presets/booking-web/core/scaffold/src/app/(member)/layout.tsx`:

```tsx
import { ReactNode } from "react";
import { MemberLayout } from "@/components/layout/member-layout";
import { AuthGate } from "@/components/shared/auth-gate";

export default function MemberGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <MemberLayout>{children}</MemberLayout>
    </AuthGate>
  );
}
```

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS. (member) 그룹에 아직 페이지가 없어 경고가 나올 수 있으나 빌드는 성공해야 한다.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/components/layout/member-layout.tsx presets/booking-web/core/scaffold/src/app/\(member\)/layout.tsx
git commit -m "feat(booking-web): add (member) group with AuthGate"
```

---

## Phase 5 — 페이지 템플릿

Builder가 eval spec 기반으로 entity 페이지를 직접 만들지만, 공통 페이지(랜딩, 로그인, 가입, 예약 진행, 내 예약)와 `example` 카탈로그 템플릿은 scaffold가 제공한다.

### Task 12: 랜딩 페이지

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/(public)/page.tsx`

- [ ] **Step 1: Create landing**

`presets/booking-web/core/scaffold/src/app/(public)/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          편안한 시간을 예약하세요
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          로그인 후 원하시는 상품을 선택해 바로 예약하실 수 있습니다.
        </p>
        <div className="flex gap-3">
          <Link href="/signup">
            <Button size="lg">회원가입</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              로그인
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

참고: 실제 카탈로그 엔티티(예: `/rooms`)로 가는 CTA는 Builder가 rules에 따라 추가한다. scaffold는 hero+CTA 기본 뼈대만 제공.

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/\(public\)/page.tsx
git commit -m "feat(booking-web): add landing page"
```

---

### Task 13: 로그인 페이지 (redirect 지원 + username 기반)

**Files:**
- Modify: `presets/booking-web/core/scaffold/src/app/(public)/login/page.tsx`

- [ ] **Step 1: Rewrite login page**

`presets/booking-web/core/scaffold/src/app/(public)/login/page.tsx` 전체를 교체:

```tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") ?? "/my/reservations";
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    if (result.ok) {
      router.push(redirect);
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>아이디와 비밀번호를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              아직 회원이 아니신가요?{" "}
              <Link href="/signup" className="underline">
                회원가입
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/\(public\)/login/page.tsx
git commit -m "feat(booking-web): login with redirect support"
```

---

### Task 14: 회원가입 페이지

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/(public)/signup/page.tsx`

- [ ] **Step 1: Create signup page**

`presets/booking-web/core/scaffold/src/app/(public)/signup/page.tsx`:

```tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") ?? "/my/reservations";
  const { signup } = useAuth();
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    email: "",
    ownerNumber: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signup({
      username: form.username,
      password: form.password,
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      ownerNumber: form.ownerNumber || undefined,
    });
    if (result.ok) {
      router.push(redirect);
    } else if (result.error === "USERNAME_TAKEN") {
      setError("이미 사용 중인 아이디입니다.");
    } else {
      setError("회원가입에 실패했습니다. 입력값을 확인해주세요.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">회원가입</CardTitle>
          <CardDescription>
            분양회원번호가 있으시면 함께 입력해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="username" label="아이디" value={form.username} onChange={update("username")} required />
            <Field id="password" label="비밀번호" type="password" value={form.password} onChange={update("password")} required />
            <Field id="name" label="이름" value={form.name} onChange={update("name")} required />
            <Field id="phone" label="연락처" value={form.phone} onChange={update("phone")} required />
            <Field id="email" label="이메일 (선택)" type="email" value={form.email} onChange={update("email")} />
            <Field id="ownerNumber" label="분양회원번호 (선택)" value={form.ownerNumber} onChange={update("ownerNumber")} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "가입 중..." : "회원가입"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="underline">
                로그인
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} required={required} />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
```

참고: 비밀번호 8자·영문+숫자 같은 강제 규칙은 requirement에 따라 Builder가 zod 스키마를 덧붙인다. scaffold는 기본 폼만 제공한다.

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/\(public\)/signup/page.tsx
git commit -m "feat(booking-web): signup page"
```

---

### Task 15: CatalogCard · CatalogGrid 공통 컴포넌트

**Files:**
- Create: `presets/booking-web/core/scaffold/src/components/shared/catalog-card.tsx`
- Create: `presets/booking-web/core/scaffold/src/components/shared/catalog-grid.tsx`

- [ ] **Step 1: Create CatalogCard**

`presets/booking-web/core/scaffold/src/components/shared/catalog-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CatalogCardItem {
  id: string;
  title: string;
  subtitle?: string;
  priceLabel?: string;
  badgeLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  href: string;
}

export function CatalogCard({ item }: { item: CatalogCardItem }) {
  const content = (
    <Card className={item.disabled ? "opacity-60" : "hover:shadow-md transition-shadow"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{item.title}</CardTitle>
          {item.badgeLabel && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {item.badgeLabel}
            </span>
          )}
        </div>
        {item.subtitle && (
          <p className="text-sm text-muted-foreground">{item.subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {item.priceLabel && <span className="font-semibold">{item.priceLabel}</span>}
        {item.disabled && item.disabledReason && (
          <span className="text-xs text-destructive">{item.disabledReason}</span>
        )}
      </CardContent>
    </Card>
  );
  if (item.disabled) return content;
  return <Link href={item.href}>{content}</Link>;
}
```

- [ ] **Step 2: Create CatalogGrid**

`presets/booking-web/core/scaffold/src/components/shared/catalog-grid.tsx`:

```tsx
import { CatalogCard, CatalogCardItem } from "./catalog-card";

export function CatalogGrid({ items }: { items: CatalogCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        표시할 항목이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <CatalogCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/components/shared/catalog-card.tsx presets/booking-web/core/scaffold/src/components/shared/catalog-grid.tsx
git commit -m "feat(booking-web): catalog card and grid components"
```

---

### Task 16: example 카탈로그 목록/상세 템플릿 (Builder의 레퍼런스)

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/(public)/example/page.tsx`
- Create: `presets/booking-web/core/scaffold/src/app/(public)/example/[id]/page.tsx`

Builder가 eval spec의 entity slug로 똑같은 구조를 복제할 수 있도록 모범 예시를 남긴다.

- [ ] **Step 1: Create example list page**

`presets/booking-web/core/scaffold/src/app/(public)/example/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CatalogGrid } from "@/components/shared/catalog-grid";
import type { CatalogCardItem } from "@/components/shared/catalog-card";
import { fetchAll } from "@/lib/api-client";

interface ExampleItem {
  id: string;
  name: string;
  price?: string;
  status?: string;
  [key: string]: unknown;
}

export default function ExampleListPage() {
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll<ExampleItem>("example").then((d) => {
      setItems(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  const cards: CatalogCardItem[] = items.map((it) => ({
    id: it.id,
    title: it.name,
    subtitle: it.status,
    priceLabel: it.price,
    href: `/example/${it.id}`,
  }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold">예시 목록</h2>
      <CatalogGrid items={cards} />
    </section>
  );
}
```

- [ ] **Step 2: Create example detail page**

`presets/booking-web/core/scaffold/src/app/(public)/example/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchById } from "@/lib/api-client";

interface ExampleItem {
  id: string;
  name: string;
  description?: string;
  price?: string;
  [key: string]: unknown;
}

export default function ExampleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<ExampleItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchById<ExampleItem>("example", id).then((d) => {
      setItem(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!item) return <div className="p-8 text-center">항목을 찾을 수 없습니다.</div>;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{item.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.description && <p className="text-muted-foreground">{item.description}</p>}
          {item.price && <p className="text-xl font-semibold">{item.price}</p>}
          <Link href={`/book/${item.id}`}>
            <Button size="lg">예약하기</Button>
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/\(public\)/example/
git commit -m "feat(booking-web): example catalog list+detail templates"
```

---

### Task 17: 예약 진행 템플릿 (member)

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/(member)/book/[itemId]/page.tsx`
- Create: `presets/booking-web/core/scaffold/src/app/api/reservations/route.ts`

- [ ] **Step 1: Create reservation API route**

`presets/booking-web/core/scaffold/src/app/api/reservations/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDataStore } from "@/lib/data-store";
import { memberStore } from "@/lib/member-store";

export interface Reservation {
  id: string;
  memberId: string;
  itemId: string;
  guestName: string;
  reservedAt: string;
  status: string;
  [key: string]: unknown;
}

const reservationStore = createDataStore<Reservation>("reservations");

const schema = z.object({
  memberId: z.string().min(1),
  itemId: z.string().min(1),
  guestName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const { memberId, itemId, guestName } = parsed.data;

  const member = memberStore.getById(memberId);
  if (!member) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // TODO(builder): eval spec requirement에 따라 여기에서
  //   1) 카탈로그 항목 재고 확인(0이면 거부)
  //   2) 회원유형 접근권 확인(allowed_types 미포함이면 거부)
  //   3) 성공 시 item.stock -= 1 업데이트
  //   규칙은 eval spec의 BR-xxx 기반으로 Builder가 구현한다.

  const reservation = reservationStore.create({
    memberId,
    itemId,
    guestName,
    reservedAt: new Date().toISOString(),
    status: "확정",
  } as Omit<Reservation, "id">);

  return NextResponse.json(reservation, { status: 201 });
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const all = reservationStore.getAll();
  const filtered = memberId ? all.filter((r) => r.memberId === memberId) : all;
  return NextResponse.json(filtered);
}
```

- [ ] **Step 2: Create booking form template**

`presets/booking-web/core/scaffold/src/app/(member)/book/[itemId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchById } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CatalogItem {
  id: string;
  name: string;
  price?: string;
  [key: string]: unknown;
}

export default function BookingFormPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const itemId = params.itemId as string;
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Builder: eval spec의 카탈로그 엔티티 slug로 교체.
    // 아래 "example"은 scaffold 예시 — 리조트 eval spec의 경우 "rooms"로 바꾼다.
    fetchById<CatalogItem>("example", itemId).then(setItem);
  }, [itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: user.id, itemId, guestName }),
    });
    if (res.ok) {
      router.push("/my/reservations");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "예약에 실패했습니다.");
    }
    setSubmitting(false);
  };

  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>예약 진행</CardTitle>
        </CardHeader>
        <CardContent>
          {item && (
            <div className="mb-4 space-y-1">
              <p className="text-sm text-muted-foreground">상품</p>
              <p className="font-medium">{item.name}</p>
              {item.price && <p className="text-sm">{item.price}</p>}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="guestName">투숙자 이름</Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "예약 중..." : "예약하기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/api/reservations/ presets/booking-web/core/scaffold/src/app/\(member\)/book/
git commit -m "feat(booking-web): booking form template and /api/reservations"
```

---

### Task 18: 내 예약 페이지

**Files:**
- Create: `presets/booking-web/core/scaffold/src/app/(member)/my/reservations/page.tsx`

- [ ] **Step 1: Create my/reservations**

`presets/booking-web/core/scaffold/src/app/(member)/my/reservations/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Reservation {
  id: string;
  memberId: string;
  itemId: string;
  guestName: string;
  reservedAt: string;
  status: string;
}

export default function MyReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/reservations?memberId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((list: Reservation[]) => {
        setReservations(list);
        setLoading(false);
      });
  }, [user]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <h2 className="text-2xl font-bold">내 예약</h2>
      {loading ? (
        <p className="text-muted-foreground">로딩 중...</p>
      ) : reservations.length === 0 ? (
        <p className="text-muted-foreground">예약 내역이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">예약번호 {r.id}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">상품 ID</p>
                  <p>{r.itemId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">투숙자</p>
                  <p>{r.guestName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">예약일</p>
                  <p>{new Date(r.reservedAt).toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">상태</p>
                  <p>{r.status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add presets/booking-web/core/scaffold/src/app/\(member\)/my/
git commit -m "feat(booking-web): my/reservations page"
```

---

### Task 19: 불필요한 admin-web 컴포넌트 정리

**Files:**
- Delete: `presets/booking-web/core/scaffold/src/components/shared/data-table.tsx`
- Delete: `presets/booking-web/core/scaffold/src/components/shared/stat-card.tsx`
- Delete: `presets/booking-web/core/scaffold/src/components/shared/role-guard.tsx`
- Keep: `form-builder.tsx`, `status-badge.tsx` (재사용)

- [ ] **Step 1: Remove admin-specific shared components**

```bash
rm presets/booking-web/core/scaffold/src/components/shared/data-table.tsx
rm presets/booking-web/core/scaffold/src/components/shared/stat-card.tsx
rm presets/booking-web/core/scaffold/src/components/shared/role-guard.tsx
```

- [ ] **Step 2: Remove Sheet component if unused**

`rg "from \"@/components/ui/sheet\"" presets/booking-web/core/scaffold/src/` 로 import 확인. 결과가 없으면:

```bash
rm presets/booking-web/core/scaffold/src/components/ui/sheet.tsx
```

있으면 그대로 둔다.

- [ ] **Step 3: Build verification**

```bash
cd presets/booking-web/core/scaffold && npm run build
```

Expected: PASS. 누군가 이 컴포넌트를 참조하고 있었다면 여기서 import 오류가 난다. 오류 나는 파일에서 import를 제거한다.

- [ ] **Step 4: Commit**

```bash
git add presets/booking-web/core/scaffold/src/components/
git commit -m "chore(booking-web): remove admin-only shared components"
```

---

## Phase 6 — rules 와 protected-files

### Task 20: `rules/CLAUDE.md` 작성

**Files:**
- Create: `presets/booking-web/rules/CLAUDE.md`

- [ ] **Step 1: Create rules**

`presets/booking-web/rules/CLAUDE.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/rules/CLAUDE.md
git commit -m "feat(booking-web): rules/CLAUDE.md for Builder"
```

---

### Task 21: `protected-files.json` 작성

**Files:**
- Create: `presets/booking-web/rules/protected-files.json`

- [ ] **Step 1: Create protected list**

`presets/booking-web/rules/protected-files.json`:

```json
{
  "protected": [
    "design-tokens.json",
    "app/layout.tsx",
    "src/app/(public)/layout.tsx",
    "src/app/(member)/layout.tsx",
    "src/components/layout/public-layout.tsx",
    "src/components/layout/member-layout.tsx",
    "src/components/shared/auth-gate.tsx",
    "src/components/ui/**",
    "src/lib/auth.tsx",
    "src/lib/data-store.ts",
    "src/lib/member-store.ts",
    "src/app/api/auth/signup/route.ts",
    "src/app/api/auth/login/route.ts"
  ],
  "description": "booking-web preset 핵심 인프라. Builder가 수정하지 않는다. /api/reservations/route.ts는 의도적으로 protected가 아니다 — requirement에 맞춰 Builder가 확장해야 하기 때문."
}
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/rules/protected-files.json
git commit -m "feat(booking-web): protected-files list"
```

---

## Phase 7 — test-pack 템플릿 8종

모든 템플릿은 Playwright 기반. 페이지 타입 템플릿은 `__ENTITY_NAME__` / `__ENTITY_PATH__` 등 admin-web 규약의 플레이스홀더를 사용한다(provisioner가 자동 치환). 체인 템플릿은 플레이스홀더 없이 고정 경로를 사용한다.

### Task 22: `landing.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/landing.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Landing E2E Test Template
 * 랜딩 페이지 접근성 + 메인 CTA 존재 확인.
 * 체인이 아닌 단일 페이지 템플릿이므로 플레이스홀더 없음.
 */
import { test, expect } from "@playwright/test";

test.describe("랜딩 페이지", () => {
  test("랜딩 페이지 접근 가능", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("회원가입·로그인 CTA 노출", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /회원가입/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /로그인/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/landing.template.ts
git commit -m "test(booking-web): landing template"
```

---

### Task 23: `catalog-list.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/catalog-list.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Catalog List E2E Test Template
 * Provisioner가 __ENTITY_NAME__, __ENTITY_PATH__ 플레이스홀더를 entity별로 치환한다.
 * 예: ENTITY_NAME='객실', ENTITY_PATH='/rooms'
 */
import { test, expect } from "@playwright/test";

const ENTITY_NAME = '__ENTITY_NAME__';
const ENTITY_PATH = '__ENTITY_PATH__';

test.describe(`${ENTITY_NAME} 카탈로그 목록`, () => {
  test("카탈로그 목록 페이지 접근 가능 (비로그인)", async ({ page }) => {
    await page.goto(ENTITY_PATH);
    await expect(page).toHaveURL(ENTITY_PATH);
    // 카탈로그 카드 그리드가 있어야 함 (비어 있더라도 컨테이너는 존재)
    await expect(page.locator("h2")).toBeVisible();
  });

  test("카드 클릭 시 상세로 이동", async ({ page }) => {
    await page.goto(ENTITY_PATH);
    const firstCard = page.locator("a").filter({ has: page.locator("h3, .card-title, [class*='CardTitle']") }).first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page).not.toHaveURL(ENTITY_PATH);
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/catalog-list.template.ts
git commit -m "test(booking-web): catalog-list template"
```

---

### Task 24: `catalog-detail.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/catalog-detail.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Catalog Detail E2E Test Template
 * __ENTITY_NAME__ / __DETAIL_PATH__ 치환됨 (예: '/rooms/1').
 */
import { test, expect } from "@playwright/test";

const ENTITY_NAME = '__ENTITY_NAME__';
const DETAIL_PATH = '__DETAIL_PATH__';

test.describe(`${ENTITY_NAME} 상세`, () => {
  test("상세 페이지 접근 가능 (비로그인)", async ({ page }) => {
    await page.goto(DETAIL_PATH);
    await expect(page).toHaveURL(DETAIL_PATH);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("예약하기 CTA가 보인다", async ({ page }) => {
    await page.goto(DETAIL_PATH);
    const cta = page.getByRole("link", { name: /예약/ });
    // 상품에 따라 예약 불가일 수 있으므로 버튼/링크 중 하나 존재를 기대
    const hasLink = await cta.first().isVisible().catch(() => false);
    const hasBtn = await page.getByRole("button", { name: /예약/ }).first().isVisible().catch(() => false);
    expect(hasLink || hasBtn).toBeTruthy();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/catalog-detail.template.ts
git commit -m "test(booking-web): catalog-detail template"
```

---

### Task 25: `auth-form.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/auth-form.template.ts`

- [ ] **Step 1: Create template**

체인이 아닌 단일 페이지 템플릿이지만 로그인/가입 두 경로를 한 파일에서 검증한다. 플레이스홀더 없음.

```typescript
/**
 * Auth Form E2E Test Template
 * 로그인·회원가입 폼 접근성과 필수 필드 확인.
 */
import { test, expect } from "@playwright/test";

test.describe("로그인 폼", () => {
  test("로그인 페이지 접근 가능", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/아이디/)).toBeVisible();
    await expect(page.getByLabel(/비밀번호/)).toBeVisible();
  });

  test("빈 폼 제출 시 페이지 유지", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /로그인/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("회원가입 폼", () => {
  test("회원가입 페이지 접근 가능", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByLabel(/아이디/)).toBeVisible();
    await expect(page.getByLabel(/비밀번호/)).toBeVisible();
    await expect(page.getByLabel(/이름/)).toBeVisible();
    await expect(page.getByLabel(/연락처/)).toBeVisible();
  });

  test("필수 항목 누락 시 저장 불가", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: /회원가입/ }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/auth-form.template.ts
git commit -m "test(booking-web): auth-form template"
```

---

### Task 26: `booking-form.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/booking-form.template.ts`

- [ ] **Step 1: Create template**

로그인 후 예약 폼 접근 가능성만 확인. 도메인 특정 성공 플로우는 test-writer가 key_flows로 조립.

```typescript
/**
 * Booking Form E2E Test Template
 * 로그인 후 예약 폼 접근 가능성·투숙자 필드 존재·빈 폼 제출 거부.
 * 플레이스홀더 없음 — 로그인 계정은 Test Writer가 key_flows를 보고 signup chain으로 생성하거나 seed 계정을 사용한다.
 */
import { test, expect } from "@playwright/test";

const TEST_USERNAME = "bookuser";
const TEST_PASSWORD = "bookpass1";

async function ensureLogin(page: import("@playwright/test").Page) {
  // 가입 시도 — 이미 존재하면 로그인으로 폴백
  await page.goto("/signup");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByLabel(/이름/).fill("테스트");
  await page.getByLabel(/연락처/).fill("010-0000-0000");
  await page.getByRole("button", { name: /회원가입/ }).click();
  // 성공이든 실패든 로그인으로 이동해 세션 확보
  await page.goto("/login");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /로그인/ }).click();
  await page.waitForURL(/\/(my\/reservations|.*)/);
}

test.describe("예약 폼", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLogin(page);
  });

  test("예약 폼 페이지에 투숙자 입력이 있다", async ({ page }) => {
    // 주의: 테스트용 itemId=1 가정. seed 데이터가 1번 id를 보장해야 한다.
    await page.goto("/book/1");
    await expect(page.getByLabel(/투숙자/)).toBeVisible();
    await expect(page.getByRole("button", { name: /예약하기/ })).toBeVisible();
  });

  test("빈 폼 제출 시 페이지 유지", async ({ page }) => {
    await page.goto("/book/1");
    await page.getByRole("button", { name: /예약하기/ }).click();
    await expect(page).toHaveURL(/\/book\/1/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/booking-form.template.ts
git commit -m "test(booking-web): booking-form template"
```

---

### Task 27: `member-list.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/member-list.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Member List E2E Test Template — /my/reservations
 * 로그인 후 본인 예약 목록 페이지 접근 가능 확인.
 */
import { test, expect } from "@playwright/test";

const TEST_USERNAME = "listuser";
const TEST_PASSWORD = "listpass1";

async function ensureLogin(page: import("@playwright/test").Page) {
  await page.goto("/signup");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByLabel(/이름/).fill("테스트");
  await page.getByLabel(/연락처/).fill("010-0000-0000");
  await page.getByRole("button", { name: /회원가입/ }).click();
  await page.goto("/login");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /로그인/ }).click();
  await page.waitForURL(/.*/);
}

test.describe("내 예약 목록", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLogin(page);
  });

  test("내 예약 페이지 접근 가능", async ({ page }) => {
    await page.goto("/my/reservations");
    await expect(page).toHaveURL(/\/my\/reservations/);
    await expect(page.locator("h2")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/member-list.template.ts
git commit -m "test(booking-web): member-list template"
```

---

### Task 28: `auth-gate.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/auth-gate.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Auth Gate E2E Test Template
 * 비로그인 상태로 보호 URL 접근 시 /login?redirect=... 으로 이동하는지 확인.
 * 플레이스홀더 없음 — 모든 booking-web 프로토타입이 공통으로 갖는 규칙.
 */
import { test, expect } from "@playwright/test";

test.describe("인증 게이트", () => {
  test.beforeEach(async ({ context }) => {
    // localStorage 비우기
    await context.clearCookies();
  });

  test("비로그인 상태로 /book/1 접근 시 로그인으로 이동", async ({ page }) => {
    await page.goto("/book/1");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test("비로그인 상태로 /my/reservations 접근 시 로그인으로 이동", async ({ page }) => {
    await page.goto("/my/reservations");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});
```

참고: localStorage를 강제로 비우는 것은 context clearCookies로는 불충분할 수 있다. Playwright의 `storageState: undefined` 옵션을 테스트 파일 상단에 두면 깔끔하나, 여기선 템플릿 단순성 위해 URL 검증만 수행.

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/auth-gate.template.ts
git commit -m "test(booking-web): auth-gate template"
```

---

### Task 29: `signup-login-chain.template.ts`

**Files:**
- Create: `presets/booking-web/test-pack/scenarios/signup-login-chain.template.ts`

- [ ] **Step 1: Create template**

```typescript
/**
 * Signup → Login Chain E2E Test Template
 * 가입 → 로그인 성공 → 보호 영역 접근까지의 스모크 체인.
 * 플레이스홀더 없음.
 */
import { test, expect } from "@playwright/test";

test.describe("가입 후 로그인 체인", () => {
  test("신규 가입 후 로그인하면 내 예약 페이지로 이동", async ({ page }) => {
    const unique = Date.now().toString();
    const username = `user${unique}`;
    const password = `pw${unique}`;

    await page.goto("/signup");
    await page.getByLabel(/아이디/).fill(username);
    await page.getByLabel(/비밀번호/).fill(password);
    await page.getByLabel(/이름/).fill("홍길동");
    await page.getByLabel(/연락처/).fill("010-1234-5678");
    await page.getByRole("button", { name: /회원가입/ }).click();

    // 가입 성공 시 자동 로그인되어 /my/reservations로 이동
    await page.waitForURL(/\/my\/reservations/);
    await expect(page.locator("h2")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add presets/booking-web/test-pack/scenarios/signup-login-chain.template.ts
git commit -m "test(booking-web): signup-login-chain template"
```

---

## Phase 8 — 리조트 예약 eval spec

### Task 30: `examples/resort-booking-spec.yaml`

**Files:**
- Create: `examples/resort-booking-spec.yaml`

- [ ] **Step 1: Create eval spec**

`examples/resort-booking-spec.yaml`:

```yaml
project: resort-booking-prototype
preset: booking-web
palette: warm-neutral

domain:
  entities:
    - name: 회원
      slug: members
      fields: [아이디, 비밀번호, 이름, 연락처, 이메일, 분양회원번호, 회원유형]
    - name: 객실
      slug: rooms
      fields: [객실코드, 객실명, 재고, 회원유형별금액, 예약가능회원유형]
    - name: 예약
      slug: reservations
      fields: [예약번호, 회원, 객실, 투숙자, 예약일자, 회원유형, 상태]

  key_flows:
    - 회원가입 (분양회원번호 유무로 자동 분류)
    - 로그인 / 로그아웃
    - 객실 목록 및 상세 조회 (비로그인 가능)
    - 예약 진행 (회원유형·재고 검증)
    - 내 예약 확인

requirements:
  - id: BR-001
    title: 분양회원번호 유무로 회원유형 자동 분류
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "분양회원번호를 입력하고 가입한 회원은 분양회원으로 분류된다"
      - "분양회원번호 없이 가입한 회원은 일반회원으로 분류된다"

  - id: BR-002
    title: 회원유형별 객실 예약 가능성 제어
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "객실의 예약가능회원유형에 포함되지 않는 회원은 예약 불가 처리된다"
      - "객실 상세에서 회원유형별 금액이 확인 가능하다"

  - id: BR-003
    title: 예약 성공 시 재고 1 차감, 재고 0이면 예약 거부
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "재고가 1 이상인 객실은 예약 성공 후 재고가 1 감소한다"
      - "재고가 0인 객실은 예약이 거부되고 안내 메시지가 표시된다"

  - id: BR-004
    title: 예약/내예약 페이지 접근은 로그인 필수
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "비로그인 상태로 /book/... 접근 시 /login?redirect=... 으로 이동한다"
      - "비로그인 상태로 /my/reservations 접근 시 /login 으로 이동한다"

  - id: BR-005
    title: 회원가입 폼 검증
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "비밀번호가 8자 미만이거나 영문+숫자 조합이 아니면 저장되지 않는다"
      - "필수 항목(아이디, 비밀번호, 이름, 연락처) 누락 시 저장되지 않는다"
      - "이메일 입력 시 이메일 형식이 검증된다"
      - "아이디 중복 시 저장이 거부되고 안내 메시지가 표시된다"

  - id: BR-006
    title: 예약 단위는 1박 1실
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "한 번의 예약은 하나의 객실, 1박으로만 가능하다"
      - "예약 폼에서 투숙자 정보를 입력할 수 있다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
  - 한국어 UI
```

- [ ] **Step 2: Commit**

```bash
git add examples/resort-booking-spec.yaml
git commit -m "feat(examples): resort-booking eval spec"
```

---

## Phase 9 — 스모크 실행 + 반복

### Task 31: 첫 스모크 실행

**Files:**
- (none — 이 태스크는 실행 및 관찰)

- [ ] **Step 1: Build orchestrator**

```bash
cd orchestrator && npm run build && cd -
```

Expected: PASS.

- [ ] **Step 2: Run harness against resort spec**

```bash
/fde-agent:run examples/resort-booking-spec.yaml
```

또는 orchestrator CLI 직접 호출(스킬 없이):

```bash
cd orchestrator
node dist/index.js --spec ../examples/resort-booking-spec.yaml
```

Expected: 실행 완료. 15회 반복 안쪽에서 evaluator pass 보고서가 나오거나, 혹은 실패로 종료.

- [ ] **Step 3: Inspect report**

`workspaces/<run-id>/report/summary.md`를 읽어 pass/fail 상세 확인. 특히:
- build_check pass 여부
- console_check 에러 개수
- page_check 렌더링 성공 URL 목록
- unit_test pass 여부
- e2e pass 비율 및 실패한 테스트

- [ ] **Step 4: Categorize failures**

실패가 나오면 원인별로 분류:
- **스캐폴드 버그** (Builder가 바른 요구를 반영해도 실패): scaffold 수정 필요
- **rules 누락** (Builder가 규약을 따르지 못해 실패): rules/CLAUDE.md 보강 필요
- **템플릿 부정확** (E2E 템플릿의 셀렉터/URL이 scaffold와 불일치): 템플릿 수정 필요
- **eval spec 결함** (요구사항이 모호·누락): eval spec 보강 필요

각 범주마다 작은 수정 후 재실행. 이 Task는 "첫 스모크 완료"까지가 범위.

- [ ] **Step 5: Document findings**

`docs/superpowers/specs/2026-04-21-booking-web-preset-design.md`에 "스모크 결과" 섹션을 추가하여 남은 이슈와 해결 방식을 기록.

- [ ] **Step 6: Commit findings**

```bash
git add docs/superpowers/specs/2026-04-21-booking-web-preset-design.md
git commit -m "docs(booking-web): smoke run findings (round 1)"
```

---

### Task 32: 반복 수정 (필요 시)

스모크 결과에 따라 위 분류별로 fix → 재실행 반복. 각 fix는 독립 커밋으로.

- [ ] **Step 1: Pick highest-severity failing evaluator**

우선순위: build_check > unit_test > page_check > e2e > console_check (blocking 3종 우선).

- [ ] **Step 2: Identify root cause**

실패 로그를 보고 원인 파일을 특정. Builder 산출물(`workspaces/<run-id>/app/...`)을 읽어 문제 패턴을 파악.

- [ ] **Step 3: Apply fix**

preset scaffold / rules / test-pack 중 해당 영역만 수정.

- [ ] **Step 4: Re-run**

```bash
/fde-agent:run examples/resort-booking-spec.yaml
```

- [ ] **Step 5: Commit fix**

```bash
git add <relevant files>
git commit -m "fix(booking-web): <short description of fix>"
```

- [ ] **Step 6: Repeat until report passes**

evaluator 5종 모두 pass할 때까지 Step 1-5 반복. 수정이 3라운드 이상 같은 영역을 맴돌면 rules/CLAUDE.md의 규약이 약하다는 신호 — 규약을 강화한다.

---

## Phase 10 — 문서화

### Task 33: README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update preset table and palette mapping**

README.md의 "Preset" 섹션:

```diff
 | Preset | 설명 | 포함 패턴 |
 |--------|------|----------|
 | `admin-web` | 관리자 페이지 | 목록/상세/폼/대시보드, 사이드바+헤더 레이아웃, 로그인(mock) |
+| `booking-web` | B2C 예약 사이트 | 랜딩/카탈로그 목록·상세/회원가입·로그인/예약·내 예약, (public)+(member) 2-그룹 shell |
```

팔레트 섹션에 booking-web 적합성 한 줄 추가:

```diff
 | `warm-neutral` | 부드러운 | 리조트, 호텔, 라이프스타일 |
```
→ 그대로 유지. `booking-web` + `warm-neutral`이 리조트 예약 예시의 기본 조합임을 Usage 섹션에 작성 예시로 포함.

- [ ] **Step 2: Update roadmap**

```diff
-| Phase 4 | corporate-site, ecommerce-web preset 추가 | 예정 |
+| Phase 4 | booking-web preset 추가 (리조트·호텔·병원예약) | 완료 |
+| Phase 4+ | corporate-site, ecommerce-web preset 추가 | 예정 |
```

- [ ] **Step 3: Add usage example**

Usage 섹션의 Eval Spec 예시 하단에 booking-web 예시 한 줄 추가:

```diff
 /fde-agent:run examples/resort-admin-spec.yaml
+# 또는 B2C 예약형 사이트 예시:
+/fde-agent:run examples/resort-booking-spec.yaml
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README update with booking-web preset"
```

---

## Self-Review Checklist (계획 작성 후 확인)

- [x] **Spec 커버리지**: 모든 스펙 섹션(§2~§14)에 대응하는 태스크가 있는가?
  - §2 설계 원칙 → 구현 전반의 가드레일로 반영
  - §3 디렉터리 → Task 3, 10, 11, 15~18
  - §4 shell/라우팅 → Task 8~11
  - §5 페이지 패턴 → Task 12, 13, 14, 16, 17, 18
  - §6 data/auth → Task 5, 6, 7, 17
  - §7 test-pack 8종 → Task 22~29
  - §8 rules → Task 20, 21
  - §9 orchestrator(provisioner) → Task 1, 2
  - §10 eval spec → Task 30
  - §11 작업 스코프 순서 → Phase 1~10 구성
  - §12 YAGNI → 포함하지 않음 (암묵)
  - §13 리스크 → Task 31~32에서 반복 수정으로 대응
  - §14 성공 기준 → Task 31 완료 조건
- [x] **플레이스홀더 없음**: "TBD"/"추후 구현" 없이 모든 코드 블록에 실제 구현 포함
- [x] **타입 일관성**: `Member`, `AuthUser`, `Reservation`, `CatalogCardItem` 등 타입명이 Task 전반에서 동일하게 사용됨
- [x] **커밋 단위**: 각 Task 말미에 단일 커밋, 독립적으로 revert 가능

## 실행 체크리스트 요약 (빠른 참조)

1. Phase 1 (orchestrator): Task 1~2 — provisioner 일반화
2. Phase 2 (scaffold fork): Task 3~4
3. Phase 3 (auth): Task 5~7
4. Phase 4 (shell): Task 8~11
5. Phase 5 (pages/components): Task 12~19
6. Phase 6 (rules): Task 20~21
7. Phase 7 (test-pack): Task 22~29
8. Phase 8 (eval spec): Task 30
9. Phase 9 (smoke): Task 31~32
10. Phase 10 (docs): Task 33
