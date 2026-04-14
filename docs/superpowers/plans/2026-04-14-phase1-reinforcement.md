# Phase 1 보강 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E 평가 파이프라인(Playwright + 하이브리드 테스트 생성 + ConsoleCheck/E2E 평가기)을 완성하고 FDE 기술 리포트를 강화한다.

**Architecture:** Playwright를 scaffold에 추가하고, 템플릿 기반 deterministic E2E 생성은 Provisioner에서, key_flow E2E 생성은 별도 TestGenerationStage에서 수행. ConsoleCheck는 프로그래밍 방식으로 서버를 spawn하여 콘솔 에러를 수집하며 치명적 에러는 hard로 승격. E2E severity는 eval spec requirement를 따름. Reporter는 전체 검증 이력과 커버리지를 포함하는 기술 리포트를 생성.

**Tech Stack:** TypeScript, Playwright, vitest, execa, js-yaml

**Spec:** `docs/superpowers/specs/2026-04-14-phase1-reinforcement-design.md`

---

## 파일 구조

### 생성할 파일

| 파일 | 역할 |
|------|------|
| `presets/admin-web/core/scaffold/playwright.config.ts` | Playwright 설정 (baseURL, headless, JSON reporter, webServer) |
| `presets/admin-web/core/scaffold/e2e/.gitkeep` | E2E 테스트 디렉토리 placeholder |
| `orchestrator/src/test-generation-stage.ts` | Test Writer Agent 호출 스테이지 (Provisioner와 분리) |
| `orchestrator/src/__tests__/console-check.test.ts` | ConsoleCheck 단위 테스트 |
| `orchestrator/src/__tests__/e2e-evaluator.test.ts` | E2E evaluator 단위 테스트 |
| `orchestrator/src/__tests__/test-generation-stage.test.ts` | TestGenerationStage 단위 테스트 |
| `orchestrator/src/__tests__/reporter.enhanced.test.ts` | 강화된 reporter 단위 테스트 |

### 수정할 파일

| 파일 | 변경 내용 |
|------|-----------|
| `presets/admin-web/core/scaffold/package.json` | `@playwright/test` devDep + `test:e2e` 스크립트 |
| `orchestrator/src/types.ts` | evaluator enum에 `"page_check"` 추가, `EvalFailure`에 `severity` 추가, `HistoryEntry.failures` 구조화 |
| `orchestrator/src/evaluator/pipeline.ts` | `Evaluator.name` 타입에 `"page_check"` 추가 |
| `orchestrator/src/evaluator/page-check.ts` | `name`을 `"page_check"`으로 변경 |
| `orchestrator/src/evaluator/console-check.ts` | 서버 spawn 방식으로 재작성 + severity 승격 |
| `orchestrator/src/evaluator/e2e.ts` | `npm run test:e2e` 실행 + requirement severity 매핑 |
| `orchestrator/src/loop.ts` | `afterFirstBuild` 콜백 추가, history에 structured failures 저장 |
| `orchestrator/src/index.ts` | 새 평가기 등록, TestGenerationStage 통합, Playwright 설치 |
| `orchestrator/src/provisioner.ts` | 템플릿 E2E 생성 + Playwright 브라우저 캐시 설치 |
| `orchestrator/src/reporter.ts` | FDE 기술 리포트 전면 강화 |
| `orchestrator/src/__tests__/types.test.ts` | 새 enum 값/필드 테스트 |
| `orchestrator/src/__tests__/evaluator.test.ts` | page_check 이름 반영 |

---

## Task 1: Playwright scaffold 셋업

**Files:**
- Create: `presets/admin-web/core/scaffold/playwright.config.ts`
- Create: `presets/admin-web/core/scaffold/e2e/.gitkeep`
- Modify: `presets/admin-web/core/scaffold/package.json`

- [ ] **Step 1: playwright.config.ts 생성**

```typescript
// presets/admin-web/core/scaffold/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  reporter: [
    ["json", { outputFile: "playwright-report/results.json" }],
    ["list"],
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
```

- [ ] **Step 2: e2e/.gitkeep 생성**

빈 파일 생성: `presets/admin-web/core/scaffold/e2e/.gitkeep`

- [ ] **Step 3: package.json에 Playwright 추가**

`presets/admin-web/core/scaffold/package.json`의 `devDependencies`에 추가:
```json
"@playwright/test": "^1.50.0"
```

`scripts`에 추가:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 4: scaffold 빌드 확인**

```bash
cd presets/admin-web/core/scaffold && npm install && npm run build
```

Expected: 빌드 성공 (Playwright는 devDep이므로 빌드에 영향 없음)

- [ ] **Step 5: 커밋**

```bash
git add presets/admin-web/core/scaffold/playwright.config.ts \
       presets/admin-web/core/scaffold/e2e/.gitkeep \
       presets/admin-web/core/scaffold/package.json
git commit -m "feat: add Playwright config and e2e infrastructure to scaffold"
```

---

## Task 2: 스키마 확장 — page_check enum, EvalFailure severity, HistoryEntry 구조화

**Files:**
- Modify: `orchestrator/src/types.ts`
- Modify: `orchestrator/src/__tests__/types.test.ts`

- [ ] **Step 1: types.test.ts에 실패 테스트 추가**

`orchestrator/src/__tests__/types.test.ts`의 `EvalResultSchema` describe 블록 끝에 추가:

```typescript
  it("validates EvalResult with page_check evaluator", () => {
    const result = {
      evaluator: "page_check" as const,
      status: "pass" as const,
      severity: "hard" as const,
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates EvalFailure with optional severity field", () => {
    const result = {
      evaluator: "e2e" as const,
      status: "fail" as const,
      severity: "hard" as const,
      failures: [
        {
          id: "e2e_flow_1",
          message: "신규 예약 등록 실패",
          severity: "hard",
          evidence: ["timeout waiting for form"],
          repair_hint: "Check reservation form submit handler",
        },
      ],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
```

`IterationStateSchema` describe 블록 끝에 추가:

```typescript
  it("validates IterationState with structured failure history", () => {
    const state = {
      run_id: "run-structured",
      total_iterations: 2,
      max_iterations: 15,
      status: "running" as const,
      resumable: true,
      history: [
        {
          iteration: 1,
          passed: ["build"],
          failed: ["e2e_flow_1"],
          failure_details: [
            { id: "e2e_flow_1", message: "신규 예약 등록 실패", hint: "Fix form handler" },
          ],
          status: "running",
        },
      ],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/types.test.ts
```

Expected: `page_check` evaluator 테스트 FAIL (`page_check`가 enum에 없으므로), `severity` 필드 테스트 FAIL, `failure_details` 테스트 FAIL

- [ ] **Step 3: types.ts 스키마 수정**

`orchestrator/src/types.ts`에서 세 군데 수정:

1. `EvalResultSchema`의 evaluator enum에 `"page_check"` 추가 (line 127):

```typescript
export const EvalResultSchema = z.object({
  evaluator: z.enum(["build", "unit_test", "console", "e2e", "page_check"]),
  status: z.enum(["pass", "fail"]),
  severity: z.enum(["hard", "soft"]),
  failures: z.array(EvalFailureSchema),
});
```

2. `EvalFailureSchema`에 optional `severity` 추가 (line 117):

```typescript
export const EvalFailureSchema = z.object({
  id: z.string(),
  message: z.string(),
  severity: z.enum(["hard", "soft"]).optional(),
  evidence: z.array(z.string()),
  repair_hint: z.string().optional(),
});
```

3. `HistoryEntrySchema`에 `failure_details` 추가 (line 139):

```typescript
const FailureDetailSchema = z.object({
  id: z.string(),
  message: z.string(),
  hint: z.string().optional(),
});

const HistoryEntrySchema = z.object({
  iteration: z.number(),
  passed: z.array(z.string()).optional(),
  failed: z.array(z.string()).optional(),
  failure_details: z.array(FailureDetailSchema).optional(),
  status: z.string().optional(),
  reason: z.string().optional(),
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/types.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add orchestrator/src/types.ts orchestrator/src/__tests__/types.test.ts
git commit -m "feat: add page_check evaluator, EvalFailure severity, structured history"
```

---

## Task 3: PageCheckEvaluator 이름 변경 (e2e → page_check)

**Files:**
- Modify: `orchestrator/src/evaluator/pipeline.ts`
- Modify: `orchestrator/src/evaluator/page-check.ts`
- Modify: `orchestrator/src/__tests__/evaluator.test.ts`

- [ ] **Step 1: evaluator.test.ts 수정 — page_check 이름 사용**

`orchestrator/src/__tests__/evaluator.test.ts`에서 PageCheck 관련 테스트를 추가한다. 기존 e2e 테스트는 유지하되, 새로운 테스트 추가:

```typescript
  it("should not stop pipeline when page_check fails — not a blocking evaluator", async () => {
    const build = makeEval("build", passResult("build"));
    const unitTest = makeEval("unit_test", passResult("unit_test"));
    const pageCheck = makeEval("page_check", failResult("page_check", "hard"));
    const consoleCheck = makeEval("console", passResult("console", "soft"));

    const pipeline = new EvalPipeline([build, unitTest, pageCheck, consoleCheck]);
    const result = await pipeline.runAll("/tmp/workspace");

    // page_check is NOT in BLOCKING_EVALUATORS, so pipeline continues
    expect(consoleCheck.run).toHaveBeenCalledOnce();
    expect(result.failures).toHaveLength(1);
    expect(result.allHardConstraintsPassed).toBe(false);
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/evaluator.test.ts
```

Expected: `page_check` 테스트 FAIL (Evaluator.name 타입에 없으므로 타입 에러)

- [ ] **Step 3: pipeline.ts의 Evaluator.name 타입 확장**

`orchestrator/src/evaluator/pipeline.ts` line 4:

```typescript
export interface Evaluator {
  name: "build" | "unit_test" | "console" | "e2e" | "page_check";
  run(workspace: string): Promise<EvalResult>;
}
```

- [ ] **Step 4: page-check.ts의 name 변경**

`orchestrator/src/evaluator/page-check.ts` line 8:

```typescript
  readonly name = "page_check" as const;
```

모든 `evaluator: "e2e"` 반환값도 `evaluator: "page_check"`으로 변경 (line 26, 64, 72):

```typescript
// line 26 — no_admin_dir failure
evaluator: "page_check",

// line 64 — pass
evaluator: "page_check",

// line 72 — fail
evaluator: "page_check",
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run test
```

Expected: ALL PASS (56 + 새 테스트)

- [ ] **Step 6: 커밋**

```bash
git add orchestrator/src/evaluator/pipeline.ts \
       orchestrator/src/evaluator/page-check.ts \
       orchestrator/src/__tests__/evaluator.test.ts
git commit -m "refactor: rename PageCheckEvaluator from e2e to page_check"
```

---

## Task 4: Provisioner 확장 — Playwright 설치 + 템플릿 E2E 생성

**Files:**
- Modify: `orchestrator/src/provisioner.ts`
- Modify: `orchestrator/src/__tests__/provisioner.test.ts` (있다면)

- [ ] **Step 1: provisioner.ts에 Playwright 브라우저 설치 함수 추가**

`orchestrator/src/provisioner.ts` 파일 상단 import 근처에 추가:

```typescript
import { readFile } from "node:fs/promises";
```

`create()` 메서드의 `npm install` 후에 Playwright 브라우저 설치 로직 추가:

```typescript
  private async installPlaywrightBrowser(appDir: string): Promise<void> {
    // Check if Chromium is already installed by running a quick check
    try {
      await execa("npx", ["playwright", "install", "--dry-run", "chromium"], {
        cwd: appDir,
        timeout: 10_000,
      });
    } catch {
      // dry-run not supported or browser missing — install it
    }

    try {
      console.log("[Provisioner] Installing Playwright Chromium...");
      await execa("npx", ["playwright", "install", "chromium"], {
        cwd: appDir,
        timeout: 120_000, // 2 minutes for download
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`env_issue: Playwright browser install failed — ${msg}`);
    }
  }
```

`create()` 메서드에서 `npm install` 다음에 호출 추가:

```typescript
    // After npm install
    await this.installPlaywrightBrowser(appDir);
```

- [ ] **Step 2: 템플릿 기반 E2E 테스트 생성 함수 추가**

`orchestrator/src/provisioner.ts`에 추가:

```typescript
  private async generateTemplateE2ETests(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>,
    testPackDir: string,
  ): Promise<void> {
    const e2eDir = join(appDir, "e2e");
    await mkdir(e2eDir, { recursive: true });

    // Dashboard test — no per-entity substitution needed
    const dashboardTemplate = await readFile(
      join(testPackDir, "scenarios", "dashboard.template.ts"),
      "utf-8",
    );
    await writeFile(join(e2eDir, "dashboard.spec.ts"), dashboardTemplate, "utf-8");

    for (const entity of entities) {
      const slug = slugMap[entity.name] ?? entity.name.toLowerCase();
      const entityPath = `/${slug}`;
      const searchField = entity.fields[0] ?? entity.name;

      // List view
      const listTemplate = await readFile(
        join(testPackDir, "scenarios", "list-view.template.ts"),
        "utf-8",
      );
      const listTest = listTemplate
        .replace(/'__ENTITY_NAME__'/g, `'${entity.name}'`)
        .replace(/'__ENTITY_PATH__'/g, `'${entityPath}'`)
        .replace(/'__SEARCH_FIELD__'/g, `'${searchField}'`);
      await writeFile(join(e2eDir, `${slug}-list.spec.ts`), listTest, "utf-8");

      // Detail view
      const detailTemplate = await readFile(
        join(testPackDir, "scenarios", "detail-view.template.ts"),
        "utf-8",
      );
      const detailTest = detailTemplate
        .replace(/'__ENTITY_NAME__'/g, `'${entity.name}'`)
        .replace(/'__DETAIL_PATH__'/g, `'${entityPath}/1'`);
      await writeFile(join(e2eDir, `${slug}-detail.spec.ts`), detailTest, "utf-8");

      // Form submit
      const formTemplate = await readFile(
        join(testPackDir, "scenarios", "form-submit.template.ts"),
        "utf-8",
      );
      const requiredFields = entity.fields.slice(0, 3).map((f) => ({
        label: f,
        value: `테스트_${f}`,
      }));
      const formTest = formTemplate
        .replace(/'__ENTITY_NAME__'/g, `'${entity.name}'`)
        .replace(/'__FORM_PATH__'/g, `'${entityPath}/new'`)
        .replace(
          /const REQUIRED_FIELDS:.*?\[\n\s*\/\/ Test Writer fills these in\n\s*\]/s,
          `const REQUIRED_FIELDS: { label: string; value: string }[] = ${JSON.stringify(requiredFields, null, 2)}`,
        );
      await writeFile(join(e2eDir, `${slug}-form.spec.ts`), formTest, "utf-8");
    }
  }
```

- [ ] **Step 3: create()에서 generateTemplateE2ETests 호출**

`create()` 메서드의 entity skeleton 생성 후에 추가:

```typescript
    // Generate template-based E2E tests
    if (input.entities && input.entities.length > 0) {
      const testPackDir = join(this.presetsDir, input.preset, "test-pack");
      await this.generateTemplateE2ETests(
        appDir,
        input.entities,
        input.entitySlugMap ?? {},
        testPackDir,
      );
    }
```

- [ ] **Step 4: orchestrator 빌드 + 테스트**

```bash
cd orchestrator && npm run build && npm run test
```

Expected: 빌드 성공, 기존 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add orchestrator/src/provisioner.ts
git commit -m "feat: add Playwright install and template E2E generation to provisioner"
```

---

## Task 5: ConsoleCheckEvaluator 재작성

**Files:**
- Modify: `orchestrator/src/evaluator/console-check.ts`
- Create: `orchestrator/src/__tests__/console-check.test.ts`

- [ ] **Step 1: console-check.test.ts 작성**

```typescript
// orchestrator/src/__tests__/console-check.test.ts
import { describe, it, expect } from "vitest";
import {
  classifyConsoleError,
  FATAL_PATTERNS,
} from "../evaluator/console-check.js";

describe("classifyConsoleError", () => {
  it("classifies TypeError as hard", () => {
    expect(classifyConsoleError("Uncaught TypeError: Cannot read properties of undefined"))
      .toBe("hard");
  });

  it("classifies ReferenceError as hard", () => {
    expect(classifyConsoleError("ReferenceError: foo is not defined"))
      .toBe("hard");
  });

  it("classifies hydration error as hard", () => {
    expect(classifyConsoleError("Hydration failed because the initial UI does not match"))
      .toBe("hard");
  });

  it("classifies uncaught exception as hard", () => {
    expect(classifyConsoleError("Uncaught (in promise) Error: network failure"))
      .toBe("hard");
  });

  it("classifies generic console error as soft", () => {
    expect(classifyConsoleError("Failed to load resource: net::ERR_FAILED"))
      .toBe("soft");
  });

  it("classifies warning as null (ignored)", () => {
    expect(classifyConsoleError("[Warning] Some deprecation notice"))
      .toBeNull();
  });
});

describe("FATAL_PATTERNS", () => {
  it("should include all required patterns", () => {
    const patternStrings = FATAL_PATTERNS.map(p => p.source);
    expect(patternStrings).toContain("TypeError");
    expect(patternStrings).toContain("ReferenceError");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/console-check.test.ts
```

Expected: FAIL (classifyConsoleError가 아직 export되지 않음)

- [ ] **Step 3: console-check.ts 재작성**

`orchestrator/src/evaluator/console-check.ts` 전체 교체:

```typescript
import { execa, type ExecaChildProcess } from "execa";
import { chromium, type Browser, type Page } from "playwright";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

// Fatal console errors → hard severity
export const FATAL_PATTERNS = [
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /Hydration/i,
  /Uncaught/,
  /Unhandled/,
];

const WARNING_PATTERNS = [/\[Warning\]/i, /\[warn\]/i, /deprecated/i];

export function classifyConsoleError(
  message: string,
): "hard" | "soft" | null {
  // Ignore warnings
  if (WARNING_PATTERNS.some((re) => re.test(message))) return null;
  // Fatal errors → hard
  if (FATAL_PATTERNS.some((re) => re.test(message))) return "hard";
  // Other errors → soft
  return "soft";
}

interface ConsoleError {
  page: string;
  message: string;
  severity: "hard" | "soft";
}

export class ConsoleCheckEvaluator implements Evaluator {
  readonly name = "console" as const;
  private entityPages: string[];

  constructor(entityPages: string[]) {
    this.entityPages = entityPages;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    const baseURL = "http://localhost:3000";

    // 1. Start production server (build already passed via BuildCheckEvaluator)
    let serverProcess: ExecaChildProcess | undefined;
    try {
      serverProcess = execa("npm", ["run", "start"], {
        cwd: appDir,
        reject: false,
      });

      // 2. Wait for server ready
      await this.waitForServer(baseURL, 30_000);

      // 3. Visit pages and collect console errors
      const errors = await this.collectConsoleErrors(baseURL);

      // 4. Build result
      if (errors.length === 0) {
        return {
          evaluator: "console",
          status: "pass",
          severity: "soft",
          failures: [],
        };
      }

      const hasHard = errors.some((e) => e.severity === "hard");
      const failures: EvalFailure[] = errors.map((e, i) => ({
        id: `console_error_${i + 1}`,
        message: `Console error on ${e.page}: ${e.message}`,
        severity: e.severity,
        evidence: [e.message],
        repair_hint: `Fix console error on page ${e.page}`,
      }));

      return {
        evaluator: "console",
        status: "fail",
        severity: hasHard ? "hard" : "soft",
        failures,
      };
    } finally {
      // 5. Kill server
      if (serverProcess) {
        serverProcess.kill("SIGTERM");
      }
    }
  }

  private async waitForServer(
    url: string,
    timeoutMs: number,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return; // server is up
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(
      "env_issue: Server failed to start within timeout",
    );
  }

  private async collectConsoleErrors(
    baseURL: string,
  ): Promise<ConsoleError[]> {
    const errors: ConsoleError[] = [];
    let browser: Browser | undefined;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();

      // Pages to visit: /dashboard + each entity page
      const pagePaths = ["/dashboard", ...this.entityPages.map((p) => `/${p}`)];

      for (const pagePath of pagePaths) {
        const page: Page = await context.newPage();
        const pageErrors: string[] = [];

        page.on("console", (msg) => {
          if (msg.type() === "error") {
            pageErrors.push(msg.text());
          }
        });

        page.on("pageerror", (err) => {
          pageErrors.push(err.message);
        });

        try {
          // Login first
          await page.goto(`${baseURL}/login`);
          await page.fill('input[type="email"]', "admin@example.com");
          await page.fill('input[type="password"]', "password");
          await page.click('button[type="submit"]');
          await page.waitForURL("**/dashboard", { timeout: 10_000 });

          // Navigate to target page
          await page.goto(`${baseURL}${pagePath}`);
          await page.waitForTimeout(2000); // Wait for JS execution
        } catch {
          // Navigation failure is not a console error
        }

        for (const msg of pageErrors) {
          const severity = classifyConsoleError(msg);
          if (severity !== null) {
            errors.push({ page: pagePath, message: msg, severity });
          }
        }

        await page.close();
      }
    } finally {
      if (browser) await browser.close();
    }

    return errors;
  }
}
```

- [ ] **Step 4: orchestrator package.json에 playwright 추가**

ConsoleCheckEvaluator가 `playwright`를 import하므로 orchestrator에도 dependency 추가:

```bash
cd orchestrator && npm install playwright
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run build && npm run test -- src/__tests__/console-check.test.ts
```

Expected: classifyConsoleError 테스트 ALL PASS

- [ ] **Step 6: 전체 테스트 확인**

```bash
cd orchestrator && npm run test
```

Expected: ALL PASS

- [ ] **Step 7: 커밋**

```bash
git add orchestrator/src/evaluator/console-check.ts \
       orchestrator/src/__tests__/console-check.test.ts \
       orchestrator/package.json orchestrator/package-lock.json
git commit -m "feat: rewrite ConsoleCheckEvaluator with server spawn and severity escalation"
```

---

## Task 6: E2EEvaluator — requirement severity 매핑

**Files:**
- Modify: `orchestrator/src/evaluator/e2e.ts`
- Create: `orchestrator/src/__tests__/e2e-evaluator.test.ts`

- [ ] **Step 1: e2e-evaluator.test.ts 작성**

```typescript
// orchestrator/src/__tests__/e2e-evaluator.test.ts
import { describe, it, expect } from "vitest";
import { mapFailureSeverity } from "../evaluator/e2e.js";

const requirements = [
  { id: "FR-001", title: "신규 예약 등록", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  { id: "FR-002", title: "예약 목록 조회", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  { id: "NFR-003", title: "대시보드 표시", severity: "soft" as const, test_method: "e2e" as const, description: "" },
];

describe("mapFailureSeverity", () => {
  it("returns hard when spec title matches a hard requirement", () => {
    expect(mapFailureSeverity("신규 예약 등록", requirements)).toBe("hard");
  });

  it("returns soft when spec title matches a soft requirement", () => {
    expect(mapFailureSeverity("대시보드 표시", requirements)).toBe("soft");
  });

  it("returns soft for template tests (no matching requirement)", () => {
    expect(mapFailureSeverity("객실 목록 조회 > 검색 기능 동작", requirements)).toBe("soft");
  });

  it("returns soft for flow tests in e2e/flows/ path", () => {
    expect(mapFailureSeverity("unknown test title", requirements)).toBe("soft");
  });

  it("matches partial title (requirement title is substring of spec title)", () => {
    expect(mapFailureSeverity("예약 목록 조회 > 페이지네이션 동작", requirements)).toBe("hard");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/e2e-evaluator.test.ts
```

Expected: FAIL (`mapFailureSeverity` not exported)

- [ ] **Step 3: e2e.ts 수정 — requirement severity 매핑**

`orchestrator/src/evaluator/e2e.ts` 전체 교체:

```typescript
import { execa } from "execa";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

interface Requirement {
  id: string;
  title: string;
  severity: "hard" | "soft";
  test_method: string;
  description: string;
}

interface PlaywrightTestResult {
  title: string;
  status?: string;
  error?: { message?: string };
}

interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightTestResult[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  errors?: Array<{ message?: string }>;
}

export function mapFailureSeverity(
  specTitle: string,
  requirements: Requirement[],
): "hard" | "soft" {
  const e2eReqs = requirements.filter((r) => r.test_method === "e2e");
  for (const req of e2eReqs) {
    if (specTitle.includes(req.title)) {
      return req.severity;
    }
  }
  // Template tests and unmatched flows default to soft
  return "soft";
}

function collectFailedSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  index: { count: number },
  requirements: Requirement[],
): void {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.status === "failed" || spec.status === "timedOut") {
          index.count += 1;
          const fullTitle = suite.title
            ? `${suite.title} > ${spec.title}`
            : spec.title;
          const severity = mapFailureSeverity(fullTitle, requirements);
          failures.push({
            id: `e2e_failure_${index.count}`,
            message: `E2E spec failed: ${spec.title}`,
            severity,
            evidence: spec.error?.message ? [spec.error.message] : [],
            repair_hint: `Fix the failing E2E test: ${spec.title}`,
          });
        }
      }
    }
    if (suite.suites) {
      collectFailedSpecs(suite.suites, failures, index, requirements);
    }
  }
}

export class E2EEvaluator implements Evaluator {
  readonly name = "e2e" as const;
  private requirements: Requirement[];

  constructor(requirements: Requirement[]) {
    this.requirements = requirements;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    let rawOutput = "";

    try {
      const result = await execa("npm", ["run", "test:e2e"], {
        cwd: appDir,
        reject: false,
        all: true,
        timeout: 120_000, // 2 minutes
      });
      rawOutput = result.stdout ?? result.all ?? "";
    } catch (error: unknown) {
      const err = error as { stdout?: string; all?: string; message?: string };
      rawOutput = err.stdout ?? err.all ?? err.message ?? "";
    }

    // Parse JSON report file instead of stdout
    let report: PlaywrightReport = {};
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const reportPath = join(appDir, "playwright-report", "results.json");
      const reportContent = await readFile(reportPath, "utf-8");
      report = JSON.parse(reportContent) as PlaywrightReport;
    } catch {
      // Fallback: try parsing from stdout
      try {
        const jsonStart = rawOutput.indexOf("{");
        if (jsonStart !== -1) {
          report = JSON.parse(rawOutput.slice(jsonStart)) as PlaywrightReport;
        }
      } catch {
        return {
          evaluator: "e2e",
          status: "fail",
          severity: "soft",
          failures: [
            {
              id: "e2e_parse_error",
              message: "Failed to parse Playwright JSON report",
              evidence: rawOutput ? [rawOutput.slice(0, 500)] : [],
            },
          ],
        };
      }
    }

    const failures: EvalFailure[] = [];
    const index = { count: 0 };

    if (report.suites) {
      collectFailedSpecs(report.suites, failures, index, this.requirements);
    }

    if (report.errors) {
      for (const err of report.errors) {
        index.count += 1;
        failures.push({
          id: `e2e_error_${index.count}`,
          message: "Playwright encountered a global error",
          evidence: err.message ? [err.message] : [],
        });
      }
    }

    // Overall severity: hard if ANY failure is hard
    const hasHardFailure = failures.some((f) => f.severity === "hard");

    return {
      evaluator: "e2e",
      status: failures.length === 0 ? "pass" : "fail",
      severity: hasHardFailure ? "hard" : "soft",
      failures,
    };
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run build && npm run test -- src/__tests__/e2e-evaluator.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: 전체 테스트 확인**

```bash
cd orchestrator && npm run test
```

Expected: ALL PASS

- [ ] **Step 6: 커밋**

```bash
git add orchestrator/src/evaluator/e2e.ts \
       orchestrator/src/__tests__/e2e-evaluator.test.ts
git commit -m "feat: E2EEvaluator maps failure severity from eval spec requirements"
```

---

## Task 7: TestGenerationStage 구현

**Files:**
- Create: `orchestrator/src/test-generation-stage.ts`
- Create: `orchestrator/src/__tests__/test-generation-stage.test.ts`

- [ ] **Step 1: test-generation-stage.test.ts 작성**

```typescript
// orchestrator/src/__tests__/test-generation-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { TestGenerationStage } from "../test-generation-stage.js";

describe("TestGenerationStage", () => {
  it("should build command with test-writer system prompt and key_flows", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 목록 조회", "신규 예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호", "고객명"] }],
    });

    expect(command.executable).toBe("claude");
    expect(command.args).toContain("-p");
    expect(command.args).toContain("--system-prompt");
    expect(command.args).toContain("/plugin/agents/test-writer.md");
    expect(command.cwd).toBe("/workspace/app");
    // Contract YAML should contain key_flows
    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("예약 목록 조회");
    expect(contractArg).toContain("신규 예약 등록");
  });

  it("should include entity info in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호"] }],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("예약");
    expect(contractArg).toContain("예약번호");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/test-generation-stage.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: test-generation-stage.ts 구현**

```typescript
// orchestrator/src/test-generation-stage.ts
import { execa } from "execa";
import yaml from "js-yaml";
import type { BuildResult } from "./types.js";

interface TestGenerationStageOptions {
  systemPromptPath: string;
}

interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; fields: string[] }>;
}

interface TestGenerationContract {
  task: "generate_e2e_tests";
  key_flows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  output_dir: string;
  guidelines: string[];
}

export class TestGenerationStage {
  private readonly systemPromptPath: string;

  constructor({ systemPromptPath }: TestGenerationStageOptions) {
    this.systemPromptPath = systemPromptPath;
  }

  buildCommand(input: TestGenerationInput): {
    executable: string;
    args: string[];
    cwd: string;
  } {
    const contract: TestGenerationContract = {
      task: "generate_e2e_tests",
      key_flows: input.keyFlows,
      entities: input.entities,
      output_dir: "e2e/flows",
      guidelines: [
        "Write one Playwright test file per key_flow in the output_dir",
        "Each file should test the actual user flow: navigate, interact, verify",
        "Use existing template tests in e2e/ as reference for style and login pattern",
        "Test file name format: {flow-slug}.spec.ts",
        "All UI text is in Korean",
        "Do NOT modify any existing files",
      ],
    };

    const contractYaml = yaml.dump(contract);
    const args = [
      "-p",
      "--output-format",
      "json",
      "--system-prompt",
      this.systemPromptPath,
      contractYaml,
    ];

    return {
      executable: "claude",
      args,
      cwd: input.workspace,
    };
  }

  async execute(input: TestGenerationInput): Promise<BuildResult> {
    const { executable, args, cwd } = this.buildCommand(input);

    try {
      const result = await execa(executable, args, {
        cwd,
        timeout: 10 * 60 * 1000, // 10 minutes
      });

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: message,
      };
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run build && npm run test -- src/__tests__/test-generation-stage.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add orchestrator/src/test-generation-stage.ts \
       orchestrator/src/__tests__/test-generation-stage.test.ts
git commit -m "feat: add TestGenerationStage for key_flow E2E test generation"
```

---

## Task 8: mainLoop에 afterFirstBuild 콜백 + structured history

**Files:**
- Modify: `orchestrator/src/loop.ts`
- Modify: `orchestrator/src/__tests__/loop.test.ts`

- [ ] **Step 1: loop.test.ts에 afterFirstBuild 테스트 추가**

기존 loop.test.ts를 읽고, 다음 테스트를 describe 블록 끝에 추가:

```typescript
  it("should call afterFirstBuild callback after first builder execution", async () => {
    const afterFirstBuild = vi.fn().mockResolvedValue(undefined);
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };
    const mockEvalRunner = vi.fn().mockResolvedValue({
      allHardConstraintsPassed: true,
      results: [],
      failures: [],
    } satisfies PipelineResult);

    await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/ws",
      runId: "run-cb-1",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 5,
      startIteration: 1,
      afterFirstBuild,
    });

    expect(afterFirstBuild).toHaveBeenCalledOnce();
    expect(afterFirstBuild).toHaveBeenCalledWith("/tmp/ws");
  });

  it("should not call afterFirstBuild on resumed runs (startIteration > 1)", async () => {
    const afterFirstBuild = vi.fn().mockResolvedValue(undefined);
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };
    const mockEvalRunner = vi.fn().mockResolvedValue({
      allHardConstraintsPassed: true,
      results: [],
      failures: [],
    } satisfies PipelineResult);

    await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/ws",
      runId: "run-cb-2",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 5,
      startIteration: 3,
      afterFirstBuild,
    });

    expect(afterFirstBuild).not.toHaveBeenCalled();
  });
```

참고: `sampleSpec`은 loop.test.ts에 이미 정의되어 있음 (line 7-26). `BuilderInterface`와 `PipelineResult` import도 이미 존재함.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/loop.test.ts
```

Expected: FAIL (afterFirstBuild 파라미터가 MainLoopInput에 없음)

- [ ] **Step 3: loop.ts 수정**

`orchestrator/src/loop.ts`의 `MainLoopInput` interface에 추가:

```typescript
interface MainLoopInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  builder: BuilderInterface;
  evalRunner: (workspace: string) => Promise<PipelineResult>;
  maxIterations: number;
  startIteration: number;
  afterFirstBuild?: (workspace: string) => Promise<void>;
}
```

`mainLoop` 함수 안, builder.execute() 호출 후에 콜백 실행 로직 추가. for 루프 내부에서 iteration === startIteration && startIteration === 1 일 때 호출:

```typescript
    // 2. Execute builder
    await builder.execute(taskContract);

    // 2.5. After first build (fresh run only), run post-build hooks
    if (iteration === 1 && startIteration === 1 && input.afterFirstBuild) {
      await input.afterFirstBuild(workspace);
    }
```

또한 history entry에 `failure_details` 추가. 기존 3곳의 `history.push()`에 failure_details 추가:

escalated (env_issue) history entry (line ~58):
```typescript
      history.push({
        iteration,
        passed: passedEvaluators,
        failed: failedIds,
        failure_details: allFailures.map((f) => ({
          id: f.id,
          message: f.message,
          hint: f.repair_hint,
        })),
        status: "escalated",
        reason: "env_issue",
      });
```

completed history entry (line ~78):
```typescript
      history.push({
        iteration,
        passed: passedEvaluators,
        failed: failedIds,
        failure_details: [],
        status: "completed",
      });
```

running history entry (line ~95):
```typescript
      history.push({
        iteration,
        passed: passedEvaluators,
        failed: failedIds,
        failure_details: allFailures.map((f) => ({
          id: f.id,
          message: f.message,
          hint: f.repair_hint,
        })),
        status: "running",
      });
```

참고: `allFailures`를 참조하려면, 현재 `allFailures`가 env_issue 검사 블록 안에서만 선언됨. 이를 env_issue 블록 밖으로 이동:

```typescript
    // Collect all individual failures (for history + classification)
    const allFailures = pipelineResult.failures.flatMap((r) => r.failures);

    // 4. Check for env_issue → escalate immediately
    const hasEnvIssue = allFailures.some(
      (failure) => classifyFailure(failure) === "env_issue"
    );
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run build && npm run test
```

Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add orchestrator/src/loop.ts orchestrator/src/__tests__/loop.test.ts
git commit -m "feat: add afterFirstBuild callback and structured failure history to mainLoop"
```

---

## Task 9: Pipeline 연결 + index.ts 통합

**Files:**
- Modify: `orchestrator/src/index.ts`

- [ ] **Step 1: index.ts에 새 모듈 import 추가**

```typescript
import { ConsoleCheckEvaluator } from "./evaluator/console-check.js";
import { E2EEvaluator } from "./evaluator/e2e.js";
import { TestGenerationStage } from "./test-generation-stage.js";
```

- [ ] **Step 2: pipeline 구성 변경**

기존 pipeline 생성 코드 (line 94-98) 교체:

```typescript
  const pipeline = new EvalPipeline([
    new BuildCheckEvaluator(),
    new UnitTestEvaluator(),
    new PageCheckEvaluator(requiredPages),
    new ConsoleCheckEvaluator(requiredPages.filter((p) => p !== "dashboard")),
    new E2EEvaluator(evalSpec.requirements),
  ]);
```

- [ ] **Step 3: TestGenerationStage 인스턴스 생성**

builder 생성 이후에 추가:

```typescript
  const testWriterPromptPath = resolve(pluginDir, "agents", "test-writer.md");
  const testGenerationStage = new TestGenerationStage({
    systemPromptPath: testWriterPromptPath,
  });
```

- [ ] **Step 4: mainLoop 호출에 afterFirstBuild 추가**

기존 mainLoop 호출 (line 132-140) 교체:

```typescript
  const finalState = await mainLoop({
    evalSpec,
    workspace,
    runId,
    builder,
    evalRunner,
    maxIterations: MAX_ITERATIONS,
    startIteration,
    afterFirstBuild: async (ws) => {
      console.log("[FDE-AGENT] Running Test Writer Agent for key_flow E2E tests...");
      const result = await testGenerationStage.execute({
        workspace: `${ws}/app`,
        keyFlows: evalSpec.domain.key_flows,
        entities: evalSpec.domain.entities,
      });
      if (result.success) {
        console.log("[FDE-AGENT] key_flow E2E tests generated");
      } else {
        console.warn("[FDE-AGENT] Test Writer Agent failed (non-blocking):", result.output.slice(0, 200));
      }
    },
  });
```

- [ ] **Step 5: writeReport에 evalSpec 전달 (다음 Task에서 사용)**

기존 writeReport 호출 (line 146) 교체:

```typescript
  await writeReport(workspace, finalState, finalResults, evalSpec);
```

참고: reporter.ts의 시그니처를 Task 10에서 변경하므로, 이 단계에서는 빌드가 깨질 수 있다. Task 9와 Task 10은 순서대로 진행.

- [ ] **Step 6: 빌드 확인 (Task 10 전에는 실패 가능)**

```bash
cd orchestrator && npm run build
```

Expected: `writeReport` 시그니처 변경 전이므로 타입 에러 가능. Task 10에서 해결.

- [ ] **Step 7: 커밋 (Task 10과 함께)**

Task 10 완료 후 함께 커밋한다.

---

## Task 10: Reporter 강화

**Files:**
- Modify: `orchestrator/src/reporter.ts`
- Create: `orchestrator/src/__tests__/reporter.enhanced.test.ts`

- [ ] **Step 1: reporter.enhanced.test.ts 작성**

```typescript
// orchestrator/src/__tests__/reporter.enhanced.test.ts
import { describe, it, expect } from "vitest";
import { generateSummary } from "../reporter.js";
import type { EvalResult, IterationState, EvalSpec } from "../types.js";

const mockEvalSpec = {
  project: "resort-admin-prototype",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [
      { name: "객실", fields: ["객실번호", "타입"] },
      { name: "예약", fields: ["예약번호", "고객명"] },
    ],
    key_flows: ["예약 목록 조회", "신규 예약 등록"],
  },
  requirements: [
    { id: "FR-001", title: "신규 예약 등록", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  ],
  data_source: { type: "mock" as const },
  constraints: [],
} satisfies EvalSpec;

const completedState: IterationState = {
  run_id: "run-123",
  total_iterations: 3,
  max_iterations: 15,
  status: "completed",
  resumable: false,
  history: [
    {
      iteration: 1,
      passed: ["build"],
      failed: ["e2e_flow_1"],
      failure_details: [
        { id: "e2e_flow_1", message: "E2E spec failed: 신규 예약 등록", hint: "Fix form handler" },
      ],
      status: "running",
    },
    {
      iteration: 2,
      passed: ["build", "unit_test"],
      failed: ["console_error_1"],
      failure_details: [
        { id: "console_error_1", message: "TypeError on /reservations", hint: "Check component" },
      ],
      status: "running",
    },
    {
      iteration: 3,
      passed: ["build", "unit_test", "page_check", "console", "e2e"],
      failed: [],
      failure_details: [],
      status: "completed",
    },
  ],
};

const finalResults: EvalResult[] = [
  { evaluator: "build", status: "pass", severity: "hard", failures: [] },
  { evaluator: "unit_test", status: "pass", severity: "hard", failures: [] },
  { evaluator: "page_check", status: "pass", severity: "hard", failures: [] },
  { evaluator: "console", status: "pass", severity: "soft", failures: [] },
  { evaluator: "e2e", status: "pass", severity: "soft", failures: [] },
];

describe("generateSummary (enhanced)", () => {
  it("includes project metadata header", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("# 프로토타입 검증 리포트");
    expect(summary).toContain("resort-admin-prototype");
    expect(summary).toContain("admin-web");
    expect(summary).toContain("warm-neutral");
    expect(summary).toContain("run-123");
  });

  it("includes evaluation results table with all evaluators", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("build");
    expect(summary).toContain("unit_test");
    expect(summary).toContain("page_check");
    expect(summary).toContain("console");
    expect(summary).toContain("e2e");
    expect(summary).toContain("PASS");
  });

  it("includes iteration history with failure details", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("Iteration 1");
    expect(summary).toContain("신규 예약 등록");
    expect(summary).toContain("Fix form handler");
    expect(summary).toContain("Iteration 3");
  });

  it("includes test coverage section", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("테스트 커버리지");
    expect(summary).toContain("객실");
    expect(summary).toContain("예약");
  });

  it("escalated state includes escalation reason", () => {
    const escalatedState: IterationState = {
      ...completedState,
      status: "escalated",
      escalation_reason: "env_issue: Missing DATABASE_URL",
      resumable: true,
    };
    const summary = generateSummary(escalatedState, [], mockEvalSpec);
    expect(summary).toContain("Escalation");
    expect(summary).toContain("Missing DATABASE_URL");
    expect(summary).toContain("--resume");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd orchestrator && npm run test -- src/__tests__/reporter.enhanced.test.ts
```

Expected: FAIL (generateSummary 시그니처가 아직 string, string이지 EvalSpec이 아님)

- [ ] **Step 3: reporter.ts 전체 재작성**

```typescript
// orchestrator/src/reporter.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EvalResult, EvalSpec, IterationState } from "./types.js";

// ---------------------------------------------------------------------------
// generateSummary — pure function, no I/O
// ---------------------------------------------------------------------------

export function generateSummary(
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
): string {
  const lines: string[] = [];

  // Header
  lines.push("# 프로토타입 검증 리포트");
  lines.push("");

  // Overview
  lines.push("## 개요");
  lines.push("");
  lines.push(`| 항목 | 값 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 프로젝트 | ${evalSpec.project} |`);
  lines.push(`| 프리셋 | ${evalSpec.preset} |`);
  lines.push(`| 팔레트 | ${evalSpec.palette} |`);
  lines.push(`| Run ID | ${state.run_id} |`);
  lines.push(`| 최종 상태 | ${formatStatus(state.status)} |`);
  lines.push(`| 총 반복 횟수 | ${state.total_iterations} / ${state.max_iterations} |`);
  lines.push(`| 실행 시각 | ${new Date().toISOString()} |`);
  lines.push("");

  if (state.status === "escalated" && state.escalation_reason) {
    lines.push("### Escalation 사유");
    lines.push("");
    lines.push(`> ${state.escalation_reason}`);
    lines.push("");
    lines.push("### 재개 방법");
    lines.push("");
    lines.push("환경 문제를 해결한 후 다음 명령어로 재개하세요:");
    lines.push("");
    lines.push("```sh");
    lines.push(`fde-agent run --resume ${state.run_id}`);
    lines.push("```");
    lines.push("");
  }

  // Evaluation results table
  if (finalResults.length > 0) {
    lines.push("## 평가 결과 요약");
    lines.push("");
    lines.push("| Evaluator | Severity | Status | 실패 항목 수 |");
    lines.push("|-----------|----------|--------|-------------|");
    for (const r of finalResults) {
      const statusLabel = r.status === "pass" ? "PASS" : "FAIL";
      lines.push(
        `| ${r.evaluator} | ${r.severity} | ${statusLabel} | ${r.failures.length} |`,
      );
    }
    lines.push("");
  }

  // Iteration history
  if (state.history.length > 0) {
    lines.push("## 반복 이력");
    lines.push("");
    for (const entry of state.history) {
      lines.push(`### Iteration ${entry.iteration}`);
      lines.push("");
      const passed = entry.passed?.join(", ") ?? "-";
      lines.push(`- **통과:** ${passed}`);

      if (entry.failure_details && entry.failure_details.length > 0) {
        lines.push("- **실패 항목:**");
        for (const detail of entry.failure_details) {
          const hint = detail.hint ? ` → ${detail.hint}` : "";
          lines.push(`  - \`${detail.id}\`: ${detail.message}${hint}`);
        }
      } else if (entry.failed && entry.failed.length > 0) {
        lines.push(`- **실패:** ${entry.failed.join(", ")}`);
      } else {
        lines.push("- **실패:** 없음");
      }

      if (entry.reason) {
        lines.push(`- **사유:** ${entry.reason}`);
      }
      lines.push("");
    }
  }

  // Remaining failures (only if not completed)
  if (state.status !== "completed" && finalResults.length > 0) {
    const failingResults = finalResults.filter((r) => r.status === "fail");
    if (failingResults.length > 0) {
      lines.push("## 실패 상세 (최종 잔여)");
      lines.push("");
      for (const r of failingResults) {
        lines.push(`### ${r.evaluator}`);
        lines.push("");
        for (const f of r.failures) {
          lines.push(`- **${f.id}**: ${f.message}`);
          if (f.evidence.length > 0) {
            lines.push(`  - Evidence: ${f.evidence[0].slice(0, 200)}`);
          }
          if (f.repair_hint) {
            lines.push(`  - Hint: ${f.repair_hint}`);
          }
        }
        lines.push("");
      }
    }
  }

  // Test coverage
  lines.push("## 테스트 커버리지");
  lines.push("");
  lines.push("### 템플릿 기반");
  lines.push("");
  lines.push("| 엔티티 | list | detail | form |");
  lines.push("|--------|------|--------|------|");
  for (const entity of evalSpec.domain.entities) {
    lines.push(`| ${entity.name} | ✓ | ✓ | ✓ |`);
  }
  lines.push("");

  if (evalSpec.domain.key_flows.length > 0) {
    lines.push("### key_flow");
    lines.push("");
    lines.push("| Flow | 테스트 |");
    lines.push("|------|--------|");
    for (const flow of evalSpec.domain.key_flows) {
      lines.push(`| ${flow} | ✓ |`);
    }
    lines.push("");
  }

  // Environment
  lines.push("## 실행 환경");
  lines.push("");
  lines.push(`- **Node:** ${process.version}`);
  lines.push(`- **Preset:** ${evalSpec.preset}`);
  lines.push(`- **Palette:** ${evalSpec.palette}`);
  lines.push("");

  return lines.join("\n");
}

function formatStatus(status: string): string {
  switch (status) {
    case "completed":
      return "통과 ✅";
    case "escalated":
      return "에스컬레이션 ⚠️";
    case "running":
      return "실행 중";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// writeReport — async, writes files to workspace
// ---------------------------------------------------------------------------

export async function writeReport(
  workspace: string,
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
): Promise<void> {
  const reportDir = join(workspace, "report");
  const metaDir = join(workspace, "meta");
  const evidenceScreenshotsDir = join(reportDir, "evidence", "screenshots");
  const evidenceVideosDir = join(reportDir, "evidence", "videos");
  const evidenceLogsDir = join(reportDir, "evidence", "logs");

  await Promise.all([
    mkdir(reportDir, { recursive: true }),
    mkdir(metaDir, { recursive: true }),
    mkdir(evidenceScreenshotsDir, { recursive: true }),
    mkdir(evidenceVideosDir, { recursive: true }),
    mkdir(evidenceLogsDir, { recursive: true }),
  ]);

  const summary = generateSummary(state, finalResults, evalSpec);

  await Promise.all([
    writeFile(join(reportDir, "summary.md"), summary, "utf-8"),
    writeFile(
      join(reportDir, "eval-results.json"),
      JSON.stringify(finalResults, null, 2),
      "utf-8",
    ),
    writeFile(
      join(metaDir, "iterations.json"),
      JSON.stringify(state, null, 2),
      "utf-8",
    ),
  ]);
}
```

- [ ] **Step 4: 기존 reporter.test.ts 업데이트**

`orchestrator/src/__tests__/reporter.test.ts` 전체 교체:

```typescript
import { describe, it, expect } from "vitest";
import { generateSummary } from "../reporter.js";
import type { EvalResult, EvalSpec, IterationState } from "../types.js";

const mockEvalSpec: EvalSpec = {
  project: "test-project",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: { entities: [], key_flows: [] },
  requirements: [],
  data_source: { type: "mock" },
  constraints: [],
};

const makeCompletedState = (): IterationState => ({
  run_id: "run_001",
  total_iterations: 3,
  max_iterations: 5,
  status: "completed",
  resumable: false,
  history: [
    { iteration: 1, passed: ["build"], failed: ["e2e"] },
    { iteration: 2, passed: ["build", "e2e"], failed: [] },
    { iteration: 3, passed: ["build", "unit_test", "e2e"], failed: [] },
  ],
});

const makeEscalatedState = (): IterationState => ({
  run_id: "run_002",
  total_iterations: 2,
  max_iterations: 5,
  status: "escalated",
  escalation_reason: "Missing API_KEY environment variable — cannot reach external service",
  resumable: true,
  history: [
    { iteration: 1, failed: ["build"], status: "env_issue", reason: "API_KEY not set" },
    { iteration: 2, failed: ["build"], status: "env_issue", reason: "API_KEY not set" },
  ],
});

const makeFinalResults = (): EvalResult[] => [
  { evaluator: "build", status: "pass", severity: "hard", failures: [] },
  { evaluator: "unit_test", status: "pass", severity: "hard", failures: [] },
  { evaluator: "e2e", status: "pass", severity: "soft", failures: [] },
];

describe("generateSummary", () => {
  it("completed state: output should contain 통과, PASS", () => {
    const state = makeCompletedState();
    const results = makeFinalResults();
    const summary = generateSummary(state, results, mockEvalSpec);

    expect(summary).toContain("통과");
    expect(summary).toContain("PASS");
    expect(summary).toContain("test-project");
  });

  it("escalated state: output should contain Escalation, API_KEY, --resume", () => {
    const state = makeEscalatedState();
    const summary = generateSummary(state, [], mockEvalSpec);

    expect(summary).toContain("Escalation");
    expect(summary).toContain("API_KEY");
    expect(summary).toContain("--resume");
  });
});
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
cd orchestrator && npm run build && npm run test
```

Expected: ALL PASS (기존 + 새 테스트)

- [ ] **Step 6: Task 9와 함께 커밋**

```bash
git add orchestrator/src/reporter.ts \
       orchestrator/src/__tests__/reporter.test.ts \
       orchestrator/src/__tests__/reporter.enhanced.test.ts \
       orchestrator/src/index.ts
git commit -m "feat: wire ConsoleCheck/E2E evaluators, TestGenerationStage, and enhanced reporter"
```

---

## Task 11: 전체 빌드 + 테스트 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: orchestrator 빌드 + 전체 테스트**

```bash
cd orchestrator && npm run build && npm run test
```

Expected: 빌드 성공, ALL PASS

- [ ] **Step 2: scaffold 빌드**

```bash
cd presets/admin-web/core/scaffold && npm install && npm run build
```

Expected: 빌드 성공

- [ ] **Step 3: 커밋 (필요 시 수정 사항 반영)**

빌드/테스트 실패 시 수정 후 커밋:

```bash
git add -A && git commit -m "fix: resolve build/test issues from Phase 1 integration"
```

---

## Task 12: 통합 스모크 테스트

**Files:** 없음 (실행 검증)

- [ ] **Step 1: resort-admin-spec으로 dry-run 확인**

orchestrator가 올바르게 빌드되었는지 확인하기 위해 eval spec 파싱 + provisioner 단계만 테스트:

```bash
cd orchestrator && node dist/index.js --spec ../examples/resort-admin-spec.yaml 2>&1 | head -20
```

Expected: `[FDE-AGENT] Parsing eval spec:`, `[FDE-AGENT] Project: resort-admin-prototype`, `[FDE-AGENT] Required pages: dashboard, rooms, reservations, customers` 로그 출력 후 provisioner 실행 시작

주의: 전체 실행은 Builder(Claude Code headless)가 필요하므로, 빌드+파싱+provisioner 단계까지만 확인해도 충분함.

- [ ] **Step 2: 최종 커밋**

```bash
git add -A && git commit -m "chore: Phase 1 reinforcement complete — E2E pipeline + enhanced reporter"
```
