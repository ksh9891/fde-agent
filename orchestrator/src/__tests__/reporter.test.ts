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

  it("loop completed but final re-run has hard failure: header should not say 통과 ✅", () => {
    const state = makeCompletedState();
    const resultsWithHardFail: EvalResult[] = [
      { evaluator: "build", status: "pass", severity: "hard", failures: [] },
      {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [
          { id: "e2e_failure_1", message: "timeout", evidence: [], severity: "hard" },
        ],
        stats: { total: 10, passed: 9, failed: 1 },
      },
    ];
    const summary = generateSummary(state, resultsWithHardFail, mockEvalSpec);
    // Header row derived status must flag hard failure, not claim pass.
    expect(summary).toMatch(/최종 상태 \|[^|]*재실행 실패/);
    expect(summary).not.toMatch(/최종 상태 \| 통과 ✅ \|/);
  });

  it("loop completed with only soft failures: header should indicate soft warning", () => {
    const state = makeCompletedState();
    const resultsWithSoftFail: EvalResult[] = [
      { evaluator: "build", status: "pass", severity: "hard", failures: [] },
      {
        evaluator: "console",
        status: "fail",
        severity: "soft",
        failures: [
          { id: "c1", message: "x", evidence: [], severity: "soft" },
        ],
      },
    ];
    const summary = generateSummary(state, resultsWithSoftFail, mockEvalSpec);
    expect(summary).toContain("soft 경고");
  });
});
