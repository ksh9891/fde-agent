# E2E Vacuous Pass 수정 + 평가 파이프라인 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E evaluator의 vacuous pass를 방지하고, pipeline blocking을 보강하며, reporter의 커버리지 섹션을 실제 Playwright 결과로 채운다.

**Architecture:** EvalResult에 optional `stats` 필드를 추가하여 E2E evaluator가 테스트 집계를 반환하도록 하고, E2E evaluator 내부에서 0건 실행을 hard fail로 처리한다. Pipeline의 BLOCKING_EVALUATORS에 page_check를 추가하고, reporter는 stats + playwright-report/results.json을 파싱해 커버리지를 매핑한다.

**Tech Stack:** TypeScript, Zod, Vitest, Playwright JSON report format

---

## File Structure

| 파일 | 변경 유형 | 책임 |
|---|---|---|
| `src/types.ts` | Modify (L129-134) | EvalResultSchema에 stats 추가 |
| `src/evaluator/e2e.ts` | Modify (전면) | collectAllSpecs, vacuous pass 방지, stats 반환 |
| `src/evaluator/pipeline.ts` | Modify (L14) | BLOCKING_EVALUATORS에 page_check 추가 |
| `src/reporter.ts` | Modify (L23-168) | stats 표시 + playwright report 파싱 + 커버리지 매핑 |
| `src/__tests__/types.test.ts` | Modify (L249-348) | stats 필드 검증 테스트 추가 |
| `src/__tests__/e2e-evaluator.test.ts` | Modify (전면) | vacuous pass, stats, collectAllSpecs 테스트 |
| `src/__tests__/evaluator.test.ts` | Modify (L78-91) | page_check blocking 테스트 수정 |
| `src/__tests__/reporter.enhanced.test.ts` | Modify (L47-102) | stats 포함 커버리지 테스트 |

---

### Task 1: EvalResult에 stats 필드 추가

**Files:**
- Modify: `src/types.ts:129-136`
- Test: `src/__tests__/types.test.ts`

- [ ] **Step 1: types.test.ts에 stats 관련 테스트 추가**

`src/__tests__/types.test.ts`의 `EvalResultSchema` describe 블록 끝(L348 전)에 추가:

```typescript
  it("validates EvalResult with optional stats field", () => {
    const result = {
      evaluator: "e2e" as const,
      status: "pass" as const,
      severity: "soft" as const,
      failures: [],
      stats: { total: 16, passed: 16, failed: 0 },
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stats?.total).toBe(16);
      expect(parsed.data.stats?.passed).toBe(16);
      expect(parsed.data.stats?.failed).toBe(0);
    }
  });

  it("validates EvalResult without stats (backward compatible)", () => {
    const result = {
      evaluator: "build" as const,
      status: "pass" as const,
      severity: "hard" as const,
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stats).toBeUndefined();
    }
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/types.test.ts`
Expected: 새로 추가한 stats 테스트 2개 중 첫 번째가 실패 (stats 필드가 스키마에 없으므로 unknown key)

- [ ] **Step 3: types.ts에 stats 필드 추가**

`src/types.ts`의 EvalResultSchema (L129-134)를 다음으로 교체:

```typescript
export const EvalResultSchema = z.object({
  evaluator: z.enum(["build", "unit_test", "console", "e2e", "page_check"]),
  status: z.enum(["pass", "fail"]),
  severity: z.enum(["hard", "soft"]),
  failures: z.array(EvalFailureSchema),
  stats: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
  }).optional(),
});
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/types.test.ts`
Expected: 모든 테스트 PASS (기존 28개 + 새로 2개 = 30개)

- [ ] **Step 5: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/types.ts orchestrator/src/__tests__/types.test.ts && git commit -m "feat: add optional stats field to EvalResultSchema"
```

---

### Task 2: E2E Evaluator — collectAllSpecs + vacuous pass 방지 + stats 반환

**Files:**
- Modify: `src/evaluator/e2e.ts` (전면 리팩토링)
- Test: `src/__tests__/e2e-evaluator.test.ts`

- [ ] **Step 1: e2e-evaluator.test.ts에 테스트 추가**

기존 파일 내용을 유지하면서 아래 테스트를 추가. 기존 파일 끝(L31 후)에 추가:

```typescript
import { describe, it, expect } from "vitest";
import { mapFailureSeverity, collectAllSpecs } from "../evaluator/e2e.js";
import type { EvalFailure } from "../types.js";

// ... 기존 requirements, mapFailureSeverity 테스트는 그대로 유지 ...

describe("collectAllSpecs", () => {
  const requirements = [
    { id: "FR-001", title: "신규 예약 등록", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  ];

  it("counts all specs including passed, failed, and skipped", () => {
    const suites = [{
      specs: [
        { title: "test 1", status: "passed" },
        { title: "test 2", status: "failed", error: { message: "oops" } },
        { title: "test 3", status: "skipped" },
      ],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);

    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(failures).toHaveLength(1);
  });

  it("recurses into nested suites", () => {
    const suites = [{
      suites: [{
        specs: [
          { title: "nested pass", status: "passed" },
          { title: "nested fail", status: "timedOut" },
        ],
      }],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);

    expect(stats.total).toBe(2);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it("maps severity from requirements for failed specs", () => {
    const suites = [{
      specs: [
        { title: "신규 예약 등록 flow", status: "failed", error: { message: "err" } },
      ],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);

    expect(failures[0].severity).toBe("hard");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/e2e-evaluator.test.ts`
Expected: `collectAllSpecs` import가 없으므로 실패

- [ ] **Step 3: e2e.ts 리팩토링**

`src/evaluator/e2e.ts` 전체를 다음으로 교체:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EvalResult, EvalFailure, Requirement } from "../types.js";
import type { Evaluator } from "./pipeline.js";

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

export interface SpecStats {
  total: number;
  passed: number;
  failed: number;
}

/**
 * Map a Playwright spec title to the severity of the matching eval-spec requirement.
 * Only requirements with `test_method === "e2e"` are considered.
 * If the requirement title is a substring of the spec title, it matches.
 * Default: "soft" (template / unknown tests).
 */
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
  return "soft";
}

/**
 * Recursively collect ALL specs from Playwright suites, counting total/passed/failed
 * and building failure entries for failed/timedOut specs.
 */
export function collectAllSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  stats: SpecStats,
  requirements: Requirement[],
): void {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        stats.total += 1;
        if (spec.status === "failed" || spec.status === "timedOut") {
          stats.failed += 1;
          const severity = mapFailureSeverity(spec.title, requirements);
          failures.push({
            id: `e2e_failure_${stats.failed}`,
            message: `E2E spec failed: ${spec.title}`,
            severity,
            evidence: spec.error?.message ? [spec.error.message] : [],
            repair_hint: "Fix the failing E2E test scenario",
          });
        } else if (spec.status === "passed" || spec.status === "expected") {
          stats.passed += 1;
        }
        // skipped etc. count toward total but not passed/failed
      }
    }
    if (suite.suites) {
      collectAllSpecs(suite.suites, failures, stats, requirements);
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
    let report: PlaywrightReport = {};

    const reportPath = join(appDir, "playwright-report", "results.json");

    try {
      await execa("npm", ["run", "test:e2e"], {
        cwd: appDir,
        reject: false,
        all: true,
        timeout: 120_000,
      });
    } catch {
      // Test runner may exit non-zero on failures; we parse the report regardless
    }

    // Try to read the report file first
    let parsed = false;
    try {
      const reportJson = await readFile(reportPath, "utf-8");
      report = JSON.parse(reportJson) as PlaywrightReport;
      parsed = true;
    } catch {
      // File not found or invalid — fall back to stdout parsing below
    }

    // Fall back: re-run with JSON reporter to stdout
    if (!parsed) {
      let rawOutput = "";
      try {
        const result = await execa(
          "npx",
          ["playwright", "test", "--project=e2e", "--reporter=json"],
          { cwd: appDir, reject: false, all: true, timeout: 120_000 },
        );
        rawOutput = result.stdout ?? result.all ?? "";
      } catch (error: unknown) {
        const err = error as {
          stdout?: string;
          all?: string;
          message?: string;
        };
        rawOutput = err.stdout ?? err.all ?? err.message ?? "";
      }

      try {
        const jsonStart = rawOutput.indexOf("{");
        if (jsonStart !== -1) {
          report = JSON.parse(rawOutput.slice(jsonStart)) as PlaywrightReport;
        }
      } catch {
        return {
          evaluator: "e2e",
          status: "fail",
          severity: "hard",
          failures: [
            {
              id: "e2e_parse_error",
              message: "Failed to parse Playwright JSON report",
              evidence: rawOutput ? [rawOutput.slice(0, 500)] : [],
            },
          ],
          stats: { total: 0, passed: 0, failed: 0 },
        };
      }
    }

    // Guard: no suites at all → test runner failed silently
    if (!report.suites || report.suites.length === 0) {
      // Still surface top-level errors if any
      const topErrors = (report.errors ?? [])
        .map((e) => e.message ?? "unknown error")
        .join("; ");
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [{
          id: "e2e_no_results",
          message: "Playwright test runner produced no results",
          evidence: topErrors ? [topErrors] : [],
          repair_hint: "Check playwright.config.ts and ensure e2e/ directory has test files",
        }],
        stats: { total: 0, passed: 0, failed: 0 },
      };
    }

    const failures: EvalFailure[] = [];
    const stats: SpecStats = { total: 0, passed: 0, failed: 0 };

    collectAllSpecs(report.suites, failures, stats, this.requirements);

    // Guard: suites exist but contained 0 specs
    if (stats.total === 0) {
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [{
          id: "e2e_no_tests",
          message: "No E2E tests were executed (0 specs found in report)",
          evidence: [],
          repair_hint: "Ensure e2e/ directory contains .spec.ts files and playwright.config.ts testDir is correct",
        }],
        stats: { total: 0, passed: 0, failed: 0 },
      };
    }

    // Surface top-level errors (e.g. config issues)
    if (report.errors) {
      for (const err of report.errors) {
        stats.failed += 1;
        failures.push({
          id: `e2e_error_${stats.failed}`,
          message: "Playwright encountered a global error",
          evidence: err.message ? [err.message] : [],
        });
      }
    }

    const hasHardFailure = failures.some((f) => f.severity === "hard");

    return {
      evaluator: "e2e",
      status: failures.length === 0 ? "pass" : "fail",
      severity: hasHardFailure ? "hard" : "soft",
      failures,
      stats,
    };
  }
}
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/e2e-evaluator.test.ts`
Expected: 기존 5개 + 새로 3개 = 8개 모두 PASS

- [ ] **Step 5: 전체 테스트 실행**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/evaluator/e2e.ts orchestrator/src/__tests__/e2e-evaluator.test.ts && git commit -m "feat: prevent E2E vacuous pass — require minimum test execution"
```

---

### Task 3: Pipeline — page_check를 BLOCKING_EVALUATORS에 추가

**Files:**
- Modify: `src/evaluator/pipeline.ts:14`
- Modify: `src/__tests__/evaluator.test.ts:78-91`

- [ ] **Step 1: evaluator.test.ts 기존 테스트 수정**

기존 L78-91의 "should not stop pipeline when page_check fails" 테스트를 반대 동작으로 변경:

```typescript
  it("should stop pipeline when page_check fails with hard severity", async () => {
    const build = makeEval("build", passResult("build"));
    const unitTest = makeEval("unit_test", passResult("unit_test"));
    const pageCheck = makeEval("page_check", failResult("page_check", "hard"));
    const consoleCheck = makeEval("console", passResult("console", "soft"));
    const e2e = makeEval("e2e", passResult("e2e", "soft"));

    const pipeline = new EvalPipeline([build, unitTest, pageCheck, consoleCheck, e2e]);
    const result = await pipeline.runAll("/tmp/workspace");

    expect(build.run).toHaveBeenCalledOnce();
    expect(unitTest.run).toHaveBeenCalledOnce();
    expect(pageCheck.run).toHaveBeenCalledOnce();
    expect(consoleCheck.run).not.toHaveBeenCalled();
    expect(e2e.run).not.toHaveBeenCalled();
    expect(result.allHardConstraintsPassed).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.failures).toHaveLength(1);
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/evaluator.test.ts`
Expected: 수정된 테스트 실패 (page_check가 아직 blocking이 아니므로 consoleCheck.run이 호출됨)

- [ ] **Step 3: pipeline.ts 수정**

`src/evaluator/pipeline.ts` L14를:

```typescript
const BLOCKING_EVALUATORS = new Set(["build", "unit_test"]);
```

다음으로 교체:

```typescript
const BLOCKING_EVALUATORS = new Set(["build", "unit_test", "page_check"]);
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/evaluator.test.ts`
Expected: 4개 모두 PASS

- [ ] **Step 5: 전체 테스트 실행**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/evaluator/pipeline.ts orchestrator/src/__tests__/evaluator.test.ts && git commit -m "feat: add page_check to BLOCKING_EVALUATORS in eval pipeline"
```

---

### Task 4: Reporter — stats 표시 + Playwright report 파싱 + 커버리지 매핑

**Files:**
- Modify: `src/reporter.ts:23-168`
- Modify: `src/__tests__/reporter.enhanced.test.ts`

- [ ] **Step 1: reporter.enhanced.test.ts에 테스트 추가**

기존 `finalResults` 변수 (L47-53)를 수정하여 e2e에 stats 포함:

```typescript
const finalResults: EvalResult[] = [
  { evaluator: "build", status: "pass", severity: "hard", failures: [] },
  { evaluator: "unit_test", status: "pass", severity: "hard", failures: [] },
  { evaluator: "page_check", status: "pass", severity: "hard", failures: [] },
  { evaluator: "console", status: "pass", severity: "soft", failures: [] },
  { evaluator: "e2e", status: "pass", severity: "soft", failures: [], stats: { total: 16, passed: 16, failed: 0 } },
];
```

기존 테스트 뒤에 추가:

```typescript
  it("shows stats in evaluation results table when available", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("16 total");
    expect(summary).toContain("16 passed");
    expect(summary).toContain("0 failed");
  });

  it("shows fail count column for evaluators without stats", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    // build evaluator should show numeric fail count, not stats
    expect(summary).toMatch(/\| build \| hard \| PASS \| 0 \|/);
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: "16 total" 미포함으로 실패

- [ ] **Step 3: reporter.ts의 평가 결과 테이블에 stats 표시**

`src/reporter.ts`의 평가 결과 요약 루프 (L73-77)를:

```typescript
    for (const r of finalResults) {
      const statusLabel = r.status === "pass" ? "PASS" : "FAIL";
      const failCount = r.failures.length;
      lines.push(`| ${r.evaluator} | ${r.severity} | ${statusLabel} | ${failCount} |`);
    }
```

다음으로 교체:

```typescript
    for (const r of finalResults) {
      const statusLabel = r.status === "pass" ? "PASS" : "FAIL";
      const detail = r.stats
        ? `${r.stats.total} total, ${r.stats.passed} passed, ${r.stats.failed} failed`
        : `${r.failures.length}`;
      lines.push(`| ${r.evaluator} | ${r.severity} | ${statusLabel} | ${detail} |`);
    }
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/reporter.ts orchestrator/src/__tests__/reporter.enhanced.test.ts && git commit -m "feat: show E2E stats in evaluation results table"
```

---

### Task 5: Reporter — Playwright report 파싱으로 커버리지 섹션 채우기

**Files:**
- Modify: `src/reporter.ts`
- Modify: `src/__tests__/reporter.enhanced.test.ts`

- [ ] **Step 1: reporter.enhanced.test.ts에 커버리지 매핑 테스트 추가**

파일 끝에 새 describe 블록 추가:

```typescript
describe("generateSummary with playwright report data", () => {
  // Simulate what parsePlaywrightReport would return
  const mockPlaywrightSpecs = [
    { file: "e2e/rooms-list.spec.ts", title: "객실 목록 조회", status: "passed" },
    { file: "e2e/rooms-detail.spec.ts", title: "객실 상세", status: "passed" },
    { file: "e2e/rooms-form.spec.ts", title: "객실 등록 폼", status: "failed" },
    { file: "e2e/reservations-list.spec.ts", title: "예약 목록 조회", status: "passed" },
    { file: "e2e/reservations-detail.spec.ts", title: "예약 상세", status: "passed" },
    { file: "e2e/reservations-form.spec.ts", title: "예약 등록 폼", status: "passed" },
    { file: "e2e/flows/reservation-create.spec.ts", title: "신규 예약 등록", status: "passed" },
    { file: "e2e/flows/reservation-list-filter.spec.ts", title: "예약 목록 조회", status: "failed" },
  ];

  it("maps template tests to entity coverage table", () => {
    const coverage = buildCoverageFromSpecs(mockPlaywrightSpecs, mockEvalSpec);
    expect(coverage.templateCoverage).toHaveLength(2);

    const rooms = coverage.templateCoverage.find((c) => c.entity === "객실");
    expect(rooms?.list).toBe("PASS");
    expect(rooms?.detail).toBe("PASS");
    expect(rooms?.form).toBe("FAIL");

    const reservations = coverage.templateCoverage.find((c) => c.entity === "예약");
    expect(reservations?.list).toBe("PASS");
    expect(reservations?.detail).toBe("PASS");
    expect(reservations?.form).toBe("PASS");
  });

  it("maps flow tests to key_flow coverage table", () => {
    const coverage = buildCoverageFromSpecs(mockPlaywrightSpecs, mockEvalSpec);
    expect(coverage.flowCoverage).toHaveLength(2);

    const create = coverage.flowCoverage.find((c) => c.file === "reservation-create.spec.ts");
    expect(create?.status).toBe("PASS");

    const filter = coverage.flowCoverage.find((c) => c.file === "reservation-list-filter.spec.ts");
    expect(filter?.status).toBe("FAIL");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: `buildCoverageFromSpecs` import가 없으므로 실패

- [ ] **Step 3: reporter.ts에 커버리지 파싱 함수 추가**

`src/reporter.ts` 상단 import 아래에 타입 정의와 함수 추가:

```typescript
// ---------------------------------------------------------------------------
// Playwright report coverage mapping
// ---------------------------------------------------------------------------

export interface PlaywrightSpecInfo {
  file: string;
  title: string;
  status: string;
}

interface TemplateCoverageEntry {
  entity: string;
  list: string;
  detail: string;
  form: string;
}

interface FlowCoverageEntry {
  file: string;
  title: string;
  status: string;
}

export interface CoverageData {
  templateCoverage: TemplateCoverageEntry[];
  flowCoverage: FlowCoverageEntry[];
}

/**
 * Entity slug map for Korean entity names.
 * Must stay in sync with orchestrator/src/index.ts entitySlugMap.
 */
const ENTITY_SLUG_MAP: Record<string, string> = {
  "예약": "reservations",
  "객실": "rooms",
  "고객": "customers",
  "상품": "products",
  "주문": "orders",
  "회원": "members",
  "문의": "inquiries",
  "게시글": "posts",
  "카테고리": "categories",
  "설정": "settings",
};

export function buildCoverageFromSpecs(
  specs: PlaywrightSpecInfo[],
  evalSpec: EvalSpec,
): CoverageData {
  // Template coverage: match file patterns like {slug}-list.spec.ts
  const templateCoverage: TemplateCoverageEntry[] = [];
  for (const entity of evalSpec.domain.entities) {
    const slug = ENTITY_SLUG_MAP[entity.name] ?? entity.name.toLowerCase();
    const entry: TemplateCoverageEntry = { entity: entity.name, list: "-", detail: "-", form: "-" };
    for (const spec of specs) {
      const fileName = spec.file.split("/").pop() ?? "";
      if (fileName === `${slug}-list.spec.ts`) {
        entry.list = spec.status === "passed" ? "PASS" : "FAIL";
      } else if (fileName === `${slug}-detail.spec.ts`) {
        entry.detail = spec.status === "passed" ? "PASS" : "FAIL";
      } else if (fileName === `${slug}-form.spec.ts`) {
        entry.form = spec.status === "passed" ? "PASS" : "FAIL";
      }
    }
    templateCoverage.push(entry);
  }

  // Flow coverage: files under e2e/flows/
  const flowCoverage: FlowCoverageEntry[] = [];
  for (const spec of specs) {
    if (spec.file.includes("e2e/flows/")) {
      const fileName = spec.file.split("/").pop() ?? "";
      flowCoverage.push({
        file: fileName,
        title: spec.title,
        status: spec.status === "passed" ? "PASS" : "FAIL",
      });
    }
  }

  return { templateCoverage, flowCoverage };
}
```

- [ ] **Step 4: 테스트의 import 수정**

`src/__tests__/reporter.enhanced.test.ts`의 import를:

```typescript
import { generateSummary, buildCoverageFromSpecs } from "../reporter.js";
```

로 변경.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/reporter.ts orchestrator/src/__tests__/reporter.enhanced.test.ts && git commit -m "feat: add buildCoverageFromSpecs for Playwright report parsing"
```

---

### Task 6: Reporter — generateSummary에서 커버리지 데이터 활용

**Files:**
- Modify: `src/reporter.ts` (generateSummary + writeReport)
- Modify: `src/__tests__/reporter.enhanced.test.ts`

- [ ] **Step 1: reporter.enhanced.test.ts에 통합 테스트 추가**

기존 "includes test coverage section" 테스트 (L83-88)를 다음으로 교체:

```typescript
  it("includes test coverage section with placeholder when no playwright data", () => {
    const summary = generateSummary(completedState, finalResults, mockEvalSpec);
    expect(summary).toContain("테스트 커버리지");
    expect(summary).toContain("객실");
    expect(summary).toContain("예약");
  });

  it("includes test coverage with actual data when playwrightSpecs provided", () => {
    const specs: PlaywrightSpecInfo[] = [
      { file: "e2e/rooms-list.spec.ts", title: "객실 list", status: "passed" },
      { file: "e2e/rooms-detail.spec.ts", title: "객실 detail", status: "passed" },
      { file: "e2e/rooms-form.spec.ts", title: "객실 form", status: "failed" },
      { file: "e2e/reservations-list.spec.ts", title: "예약 list", status: "passed" },
      { file: "e2e/flows/reservation-create.spec.ts", title: "신규 예약 등록", status: "passed" },
    ];
    const summary = generateSummary(completedState, finalResults, mockEvalSpec, specs);
    expect(summary).toContain("PASS");
    expect(summary).toContain("FAIL");
    expect(summary).toContain("reservation-create.spec.ts");
  });
```

import에 `PlaywrightSpecInfo` 추가:

```typescript
import { generateSummary, buildCoverageFromSpecs, type PlaywrightSpecInfo } from "../reporter.js";
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: generateSummary가 4번째 인자를 받지 않으므로 실패

- [ ] **Step 3: generateSummary에 playwrightSpecs 파라미터 추가 및 커버리지 렌더링**

`src/reporter.ts`의 generateSummary 시그니처를:

```typescript
export function generateSummary(
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
  playwrightSpecs?: PlaywrightSpecInfo[],
): string {
```

로 변경.

테스트 커버리지 섹션 (L133-158)을 다음으로 교체:

```typescript
  // ---- Test coverage ----
  lines.push("## 테스트 커버리지");
  lines.push("");

  if (playwrightSpecs && playwrightSpecs.length > 0) {
    const coverage = buildCoverageFromSpecs(playwrightSpecs, evalSpec);

    // Template-based coverage
    if (coverage.templateCoverage.length > 0) {
      lines.push("### 템플릿 기반");
      lines.push("");
      lines.push("| 엔티티 | list | detail | form | 결과 |");
      lines.push("|--------|------|--------|------|------|");
      for (const entry of coverage.templateCoverage) {
        const results = [entry.list, entry.detail, entry.form];
        const passCount = results.filter((r) => r === "PASS").length;
        const totalCount = results.filter((r) => r !== "-").length;
        lines.push(`| ${entry.entity} | ${entry.list} | ${entry.detail} | ${entry.form} | ${passCount}/${totalCount} |`);
      }
      lines.push("");
    }

    // key_flow coverage
    if (coverage.flowCoverage.length > 0) {
      lines.push("### key_flow");
      lines.push("");
      lines.push("| Flow | 테스트 파일 | 결과 |");
      lines.push("|------|------------|------|");
      for (const entry of coverage.flowCoverage) {
        lines.push(`| ${entry.title} | ${entry.file} | ${entry.status} |`);
      }
      lines.push("");
    }
  } else {
    // Fallback: placeholder when no playwright data
    if (evalSpec.domain.entities.length > 0) {
      lines.push("### 템플릿 기반");
      lines.push("");
      lines.push("| 엔티티 | list | detail | form |");
      lines.push("|--------|------|--------|------|");
      for (const entity of evalSpec.domain.entities) {
        lines.push(`| ${entity.name} | - | - | - |`);
      }
      lines.push("");
    }

    if (evalSpec.domain.key_flows.length > 0) {
      lines.push("### key_flow");
      lines.push("");
      lines.push("| Flow | 테스트 |");
      lines.push("|------|--------|");
      for (const flow of evalSpec.domain.key_flows) {
        lines.push(`| ${flow} | - |`);
      }
      lines.push("");
    }
  }
```

- [ ] **Step 4: writeReport에서 playwright report 파싱 후 generateSummary에 전달**

`src/reporter.ts`의 writeReport 함수에서, summary 생성 전에 playwright report 파싱 추가:

```typescript
export async function writeReport(
  workspace: string,
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
): Promise<void> {
  // Create directory structure
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

  // Try to parse Playwright report for coverage data
  let playwrightSpecs: PlaywrightSpecInfo[] | undefined;
  try {
    const { readFile } = await import("node:fs/promises");
    const reportPath = join(workspace, "app", "playwright-report", "results.json");
    const raw = await readFile(reportPath, "utf-8");
    const report = JSON.parse(raw) as { suites?: PlaywrightReportSuite[] };
    if (report.suites) {
      playwrightSpecs = [];
      collectPlaywrightSpecs(report.suites, playwrightSpecs);
    }
  } catch {
    // No playwright report available — coverage will show placeholders
  }

  // Write files
  const summary = generateSummary(state, finalResults, evalSpec, playwrightSpecs);

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

writeReport 위에 Playwright report suite 파싱 헬퍼 추가:

```typescript
// ---------------------------------------------------------------------------
// Playwright report parsing for writeReport
// ---------------------------------------------------------------------------

interface PlaywrightReportSuite {
  title?: string;
  file?: string;
  specs?: Array<{ title: string; ok: boolean; tests: Array<{ status: string }> }>;
  suites?: PlaywrightReportSuite[];
}

function collectPlaywrightSpecs(
  suites: PlaywrightReportSuite[],
  out: PlaywrightSpecInfo[],
  parentFile?: string,
): void {
  for (const suite of suites) {
    const file = suite.file ?? parentFile ?? "";
    if (suite.specs) {
      for (const spec of suite.specs) {
        // Determine status from tests array
        const allPassed = spec.tests.every((t) => t.status === "passed" || t.status === "expected");
        out.push({
          file,
          title: spec.title,
          status: allPassed ? "passed" : "failed",
        });
      }
    }
    if (suite.suites) {
      collectPlaywrightSpecs(suite.suites, out, file);
    }
  }
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 전체 테스트 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/reporter.ts orchestrator/src/__tests__/reporter.enhanced.test.ts && git commit -m "feat: integrate Playwright report coverage into summary report"
```

---

### Task 7: 최종 통합 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 빌드 + 테스트**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS (기존 81개 + 새로 추가분)

- [ ] **Step 2: 변경 파일 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent && git log --oneline -6`
Expected: Task 1~6의 커밋 6개가 순서대로 보임
