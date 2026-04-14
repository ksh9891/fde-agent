# Phase 2A: requirement_id 기반 E2E 매칭 + Test Writer blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E 테스트 실패 severity를 `@requirement_id` tag로 정확하게 매칭하고, hard e2e requirement의 테스트 생성 실패를 escalation으로 처리한다.

**Architecture:** key_flow 테스트의 `test.describe` title에 `@FR-001` 형태의 tag를 포함시키고, E2E evaluator가 tag를 우선 파싱하여 severity를 결정한다. tag가 없으면 기존 title substring 매칭으로 fallback. Test Writer 실패 시 hard e2e requirement가 있으면 mainLoop에서 escalation을 반환한다.

**Tech Stack:** TypeScript, Zod, Vitest, Playwright test annotations

---

## File Structure

| 파일 | 변경 유형 | 책임 |
|---|---|---|
| `src/evaluator/e2e.ts` | Modify (L30-41) | mapFailureSeverity에 tag 기반 매칭 추가 |
| `src/test-generation-stage.ts` | Modify (전면) | contract에 requirements 추가, guidelines에 tag 규약 |
| `agents/test-writer.md` | Modify | Requirement Tagging 규칙 추가 |
| `src/index.ts` | Modify (L150-161) | afterFirstBuild에 hard e2e 판단 + throw |
| `src/loop.ts` | Modify (L39-41) | afterFirstBuild try-catch → escalation |
| `src/reporter.ts` | Modify (L37-41, L82-90) | FlowCoverageEntry에 requirementIds 추가 |
| `src/__tests__/e2e-evaluator.test.ts` | Modify | tag 매칭 테스트 추가 |
| `src/__tests__/loop.test.ts` | Modify | afterFirstBuild escalation 테스트 |
| `src/__tests__/test-generation-stage.test.ts` | Modify | requirements contract 테스트 |
| `src/__tests__/reporter.enhanced.test.ts` | Modify | requirementIds 표시 테스트 |

---

### Task 1: E2E Evaluator — tag 기반 mapFailureSeverity

**Files:**
- Modify: `src/evaluator/e2e.ts:30-41`
- Test: `src/__tests__/e2e-evaluator.test.ts`

- [ ] **Step 1: e2e-evaluator.test.ts에 tag 매칭 테스트 추가**

기존 `mapFailureSeverity` describe 블록 끝(L31 전)에 추가:

```typescript
  it("returns hard when spec title contains @tag matching hard requirement", () => {
    expect(mapFailureSeverity("신규 예약 등록 @FR-001", requirements)).toBe("hard");
  });

  it("returns soft when spec title contains @tag matching soft requirement", () => {
    expect(mapFailureSeverity("대시보드 표시 @NFR-003", requirements)).toBe("soft");
  });

  it("returns soft when @tag is present but matches no requirement", () => {
    expect(mapFailureSeverity("어떤 테스트 @UNKNOWN-999", requirements)).toBe("soft");
  });

  it("returns hard when any @tag matches hard requirement (multiple tags)", () => {
    expect(mapFailureSeverity("복합 플로우 @NFR-003 @FR-001", requirements)).toBe("hard");
  });

  it("prefers tag matching over title substring matching", () => {
    // Title contains "대시보드 표시" (soft) but tag is @FR-001 (hard)
    expect(mapFailureSeverity("대시보드 표시 @FR-001", requirements)).toBe("hard");
  });

  it("falls back to title matching when no @tag present", () => {
    // No change in behavior for legacy tests
    expect(mapFailureSeverity("신규 예약 등록", requirements)).toBe("hard");
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/e2e-evaluator.test.ts`
Expected: "@tag matching" 테스트들 실패 (현재 mapFailureSeverity는 tag를 모름)

- [ ] **Step 3: mapFailureSeverity 수정**

`src/evaluator/e2e.ts`의 L30-41을 다음으로 교체:

```typescript
export function mapFailureSeverity(
  specTitle: string,
  requirements: Requirement[],
): "hard" | "soft" {
  // 1. Tag-based matching (@FR-001 등)
  const tagPattern = /@([A-Za-z]+-\d+)/g;
  const tags = [...specTitle.matchAll(tagPattern)].map((m) => m[1]);

  if (tags.length > 0) {
    for (const tag of tags) {
      const req = requirements.find((r) => r.id === tag);
      if (req?.severity === "hard") return "hard";
    }
    return "soft"; // tags found but none are hard
  }

  // 2. Fallback: title substring matching (legacy/template tests)
  const e2eReqs = requirements.filter((r) => r.test_method === "e2e");
  for (const req of e2eReqs) {
    if (specTitle.includes(req.title)) {
      return req.severity;
    }
  }
  return "soft";
}
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/e2e-evaluator.test.ts`
Expected: 기존 8개 + 새로 6개 = 14개 모두 PASS

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/evaluator/e2e.ts orchestrator/src/__tests__/e2e-evaluator.test.ts && git commit -m "feat: add @requirement_id tag-based severity matching in E2E evaluator"
```

---

### Task 2: TestGenerationStage — contract에 requirements 추가 + tag 규약

**Files:**
- Modify: `src/test-generation-stage.ts` (전면)
- Test: `src/__tests__/test-generation-stage.test.ts`

- [ ] **Step 1: test-generation-stage.test.ts에 requirements 테스트 추가**

기존 테스트 뒤(L41 후)에 추가:

```typescript
  it("should include requirements in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["신규 예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호"] }],
      requirements: [
        { id: "FR-001", title: "신규 예약 등록", severity: "hard" },
      ],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("FR-001");
    expect(contractArg).toContain("신규 예약 등록");
    expect(contractArg).toContain("hard");
  });

  it("should include tag guideline in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호"] }],
      requirements: [],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("@{requirement_id}");
  });
```

기존 2개 테스트도 `requirements` 파라미터를 추가해야 함. L10-14의 `buildCommand` 호출을:

```typescript
    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 목록 조회", "신규 예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호", "고객명"] }],
      requirements: [],
    });
```

로 변경. L31-35도 동일:

```typescript
    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 등록"],
      entities: [{ name: "예약", fields: ["예약번호"] }],
      requirements: [],
    });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/test-generation-stage.test.ts`
Expected: `requirements` 파라미터가 없으므로 TypeScript 에러 또는 테스트 실패

- [ ] **Step 3: test-generation-stage.ts 수정**

`src/test-generation-stage.ts` 전체를 다음으로 교체:

```typescript
import { execa } from "execa";
import yaml from "js-yaml";
import type { BuildResult } from "./types.js";

interface TestGenerationStageOptions {
  systemPromptPath: string;
}

interface RequirementInfo {
  id: string;
  title: string;
  severity: string;
}

interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  requirements: RequirementInfo[];
}

interface TestGenerationContract {
  task: "generate_e2e_tests";
  key_flows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  requirements: RequirementInfo[];
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
      requirements: input.requirements,
      output_dir: "e2e/flows",
      guidelines: [
        "Write one Playwright test file per key_flow in the output_dir",
        "Each file should test the actual user flow: navigate, interact, verify",
        "Use existing template tests in e2e/ as reference for style and login pattern",
        "Test file name format: {flow-slug}.spec.ts",
        "All UI text is in Korean",
        "Do NOT modify any existing files",
        "Each test.describe MUST include @{requirement_id} tag(s) matching the eval spec requirements",
        "Example: test.describe('신규 예약 등록 @FR-001', () => { ... })",
        "If a flow covers multiple requirements, include all tags: @FR-001 @FR-002",
      ],
    };

    const contractYaml = yaml.dump(contract);
    return {
      executable: "claude",
      args: [
        "-p",
        "--output-format",
        "json",
        "--system-prompt",
        this.systemPromptPath,
        contractYaml,
      ],
      cwd: input.workspace,
    };
  }

  async execute(input: TestGenerationInput): Promise<BuildResult> {
    const { executable, args, cwd } = this.buildCommand(input);
    try {
      const result = await execa(executable, args, {
        cwd,
        timeout: 10 * 60 * 1000,
      });
      return { success: true, output: result.stdout };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: message };
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/test-generation-stage.test.ts`
Expected: 기존 2개 + 새로 2개 = 4개 모두 PASS

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/test-generation-stage.ts orchestrator/src/__tests__/test-generation-stage.test.ts && git commit -m "feat: add requirements and tag guideline to TestGenerationStage contract"
```

---

### Task 3: test-writer.md에 Requirement Tagging 규칙 추가

**Files:**
- Modify: `agents/test-writer.md`

- [ ] **Step 1: test-writer.md 수정**

`agents/test-writer.md`의 `### Test Design` 섹션 뒤(L22 후)에 새 섹션 추가:

```markdown
### Requirement Tagging (MANDATORY)
- Every test.describe title MUST include @{requirement_id} tag(s) from the contract
- The requirement_id comes from the requirements array in the task contract
- Example: test.describe('신규 예약 등록 @FR-001', () => { ... })
- If a flow covers multiple requirements: test.describe('예약 플로우 @FR-001 @FR-002', () => { ... })
- Tests WITHOUT requirement tags will be treated as soft (non-blocking) by the evaluator
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add agents/test-writer.md && git commit -m "docs: add requirement tagging rules to test-writer agent prompt"
```

---

### Task 4: index.ts — afterFirstBuild에 hard e2e 판단 + throw

**Files:**
- Modify: `src/index.ts:150-161`

- [ ] **Step 1: index.ts afterFirstBuild 수정**

`src/index.ts`의 afterFirstBuild 콜백(L150-162)을 다음으로 교체:

```typescript
    afterFirstBuild: async (ws) => {
      console.log("[FDE-AGENT] Running Test Writer Agent for key_flow E2E tests...");
      const result = await testGenerationStage.execute({
        workspace: `${ws}/app`,
        keyFlows: evalSpec.domain.key_flows,
        entities: evalSpec.domain.entities,
        requirements: evalSpec.requirements
          .filter((r) => r.test_method === "e2e")
          .map((r) => ({ id: r.id, title: r.title, severity: r.severity })),
      });

      if (result.success) {
        console.log("[FDE-AGENT] key_flow E2E tests generated");
        return;
      }

      const hasHardE2E = evalSpec.requirements.some(
        (r) => r.test_method === "e2e" && r.severity === "hard"
      );

      if (hasHardE2E) {
        throw new Error(
          "env_issue: Test Writer Agent failed — cannot verify hard e2e requirements: " +
          result.output.slice(0, 200)
        );
      }

      console.warn(
        "[FDE-AGENT] Test Writer Agent failed (non-blocking — no hard e2e requirements):",
        result.output.slice(0, 200)
      );
    },
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/index.ts && git commit -m "feat: make Test Writer failure blocking when hard e2e requirements exist"
```

---

### Task 5: loop.ts — afterFirstBuild try-catch → escalation

**Files:**
- Modify: `src/loop.ts:39-41`
- Test: `src/__tests__/loop.test.ts`

- [ ] **Step 1: loop.test.ts에 afterFirstBuild escalation 테스트 추가**

기존 파일 끝(L213 전)에 추가:

```typescript
  it("escalates when afterFirstBuild throws", async () => {
    const afterFirstBuild = vi.fn().mockRejectedValue(
      new Error("env_issue: Test Writer Agent failed — cannot verify hard e2e requirements")
    );
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };
    const mockEvalRunner = vi.fn().mockResolvedValue({
      allHardConstraintsPassed: true,
      results: [
        { evaluator: "build", status: "pass", severity: "hard", failures: [] },
      ],
      failures: [],
    } satisfies PipelineResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/ws",
      runId: "run-tw-fail",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 5,
      startIteration: 1,
      afterFirstBuild,
    });

    expect(result.status).toBe("escalated");
    expect(result.escalation_reason).toContain("Test Writer Agent failed");
    expect(result.resumable).toBe(true);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].status).toBe("escalated");
    // evalRunner should still have been called (builder ran, then afterFirstBuild failed)
    expect(mockBuilder.execute).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/loop.test.ts`
Expected: 새 테스트 실패 (현재 afterFirstBuild throw는 mainLoop 밖으로 전파되어 unhandled error)

- [ ] **Step 3: loop.ts 수정**

`src/loop.ts`의 L39-41 (afterFirstBuild 호출 부분):

```typescript
    // After first build (fresh run only), run post-build hooks
    if (iteration === 1 && startIteration === 1 && input.afterFirstBuild) {
      await input.afterFirstBuild(workspace);
    }
```

을 다음으로 교체:

```typescript
    // After first build (fresh run only), run post-build hooks
    if (iteration === 1 && startIteration === 1 && input.afterFirstBuild) {
      try {
        await input.afterFirstBuild(workspace);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        history.push({
          iteration,
          passed: passedEvaluators,
          failed: [],
          failure_details: [{
            id: "test_writer_failed",
            message,
            hint: "Fix test generation environment or re-run",
          }],
          status: "escalated",
          reason: "test_writer_failed",
        });
        return {
          run_id: runId,
          total_iterations: iteration,
          max_iterations: maxIterations,
          status: "escalated",
          escalation_reason: message,
          resumable: true,
          history,
        };
      }
    }
```

**Note:** `passedEvaluators`는 이 시점에서 아직 비어 있음 (evalRunner가 아직 안 돌았음). 하지만 builder는 실행됐으므로 history에 iteration을 기록하는 것이 맞음. `passedEvaluators`를 비어있는 상태로 두되, 빈 배열이면 loop 초반에 선언된 것을 그대로 사용.

실제로 `passedEvaluators`는 loop 시작 시점엔 없고 evalRunner 결과 이후에 계산됨. afterFirstBuild는 evalRunner 전에 실행되므로, 빈 배열을 넣어야 함:

```typescript
        history.push({
          iteration,
          passed: [],
          failed: [],
          failure_details: [{
            id: "test_writer_failed",
            message,
            hint: "Fix test generation environment or re-run",
          }],
          status: "escalated",
          reason: "test_writer_failed",
        });
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/loop.test.ts`
Expected: 기존 5개 + 새로 1개 = 6개 모두 PASS

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/loop.ts orchestrator/src/__tests__/loop.test.ts && git commit -m "feat: handle afterFirstBuild failure as escalation in mainLoop"
```

---

### Task 6: Reporter — flow coverage에 requirementIds 추가

**Files:**
- Modify: `src/reporter.ts:37-41, 82-90`
- Test: `src/__tests__/reporter.enhanced.test.ts`

- [ ] **Step 1: reporter.enhanced.test.ts에 requirementIds 테스트 추가**

기존 `buildCoverageFromSpecs` describe 블록의 `mockPlaywrightSpecs`(L132-141)를 tag가 포함된 title로 수정:

```typescript
  const mockPlaywrightSpecs: PlaywrightSpecInfo[] = [
    { file: "e2e/rooms-list.spec.ts", title: "객실 목록 조회", status: "passed" },
    { file: "e2e/rooms-detail.spec.ts", title: "객실 상세", status: "passed" },
    { file: "e2e/rooms-form.spec.ts", title: "객실 등록 폼", status: "failed" },
    { file: "e2e/reservations-list.spec.ts", title: "예약 목록 조회", status: "passed" },
    { file: "e2e/reservations-detail.spec.ts", title: "예약 상세", status: "passed" },
    { file: "e2e/reservations-form.spec.ts", title: "예약 등록 폼", status: "passed" },
    { file: "e2e/flows/reservation-create.spec.ts", title: "신규 예약 등록 @FR-001", status: "passed" },
    { file: "e2e/flows/reservation-list-filter.spec.ts", title: "예약 목록 조회 @FR-002", status: "failed" },
  ];
```

기존 flow coverage 테스트(L156-163)를 다음으로 교체:

```typescript
  it("maps flow tests to key_flow coverage table with requirementIds", () => {
    const coverage = buildCoverageFromSpecs(mockPlaywrightSpecs, mockEvalSpec);
    expect(coverage.flowCoverage).toHaveLength(2);

    const create = coverage.flowCoverage.find((c) => c.file === "reservation-create.spec.ts");
    expect(create?.status).toBe("PASS");
    expect(create?.requirementIds).toEqual(["FR-001"]);

    const filter = coverage.flowCoverage.find((c) => c.file === "reservation-list-filter.spec.ts");
    expect(filter?.status).toBe("FAIL");
    expect(filter?.requirementIds).toEqual(["FR-002"]);
  });
```

`generateSummary` describe에 flow coverage 렌더링 테스트 추가(L102 전):

```typescript
  it("includes requirement ids in flow coverage table when playwrightSpecs have tags", () => {
    const specs: PlaywrightSpecInfo[] = [
      { file: "e2e/flows/reservation-create.spec.ts", title: "신규 예약 등록 @FR-001", status: "passed" },
    ];
    const summary = generateSummary(completedState, finalResults, mockEvalSpec, specs);
    expect(summary).toContain("FR-001");
    expect(summary).toContain("Requirement");
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: `requirementIds` 프로퍼티 없으므로 실패

- [ ] **Step 3: reporter.ts의 FlowCoverageEntry에 requirementIds 추가**

`src/reporter.ts`의 `FlowCoverageEntry` (L37-41)를:

```typescript
interface FlowCoverageEntry {
  file: string;
  title: string;
  status: string;
  requirementIds: string[];
}
```

`buildCoverageFromSpecs`의 flow coverage 부분(L82-90)을:

```typescript
  const flowCoverage: FlowCoverageEntry[] = [];
  for (const spec of specs) {
    if (spec.file.includes("e2e/flows/")) {
      const fileName = spec.file.split("/").pop() ?? "";
      const tagPattern = /@([A-Za-z]+-\d+)/g;
      const requirementIds = [...spec.title.matchAll(tagPattern)].map((m) => m[1]);
      flowCoverage.push({
        file: fileName,
        title: spec.title.replace(/@[A-Za-z]+-\d+/g, "").trim(),
        status: spec.status === "passed" ? "PASS" : "FAIL",
        requirementIds,
      });
    }
  }
```

flow coverage 렌더링 부분 (generateSummary 안의 `### key_flow` 섹션)을:

```typescript
    if (coverage.flowCoverage.length > 0) {
      lines.push("### key_flow");
      lines.push("");
      lines.push("| Flow | 테스트 파일 | Requirement | 결과 |");
      lines.push("|------|------------|-------------|------|");
      for (const entry of coverage.flowCoverage) {
        const reqIds = entry.requirementIds.length > 0 ? entry.requirementIds.join(", ") : "-";
        lines.push(`| ${entry.title} | ${entry.file} | ${reqIds} | ${entry.status} |`);
      }
      lines.push("");
    }
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/reporter.enhanced.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/reporter.ts orchestrator/src/__tests__/reporter.enhanced.test.ts && git commit -m "feat: add requirementIds to flow coverage table in reporter"
```

---

### Task 7: 최종 통합 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 빌드 + 테스트**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS (91개 + 새 추가분)

- [ ] **Step 2: 변경 커밋 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent && git log --oneline -6`
Expected: Task 1~6의 커밋 6개가 순서대로 보임
