import { describe, it, expect } from "vitest";
import { generateSummary } from "../reporter.js";
import type { EvalResult, IterationState } from "../types.js";

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
  it("completed state: output should contain 통과, 3회 반복, PASS", () => {
    const state = makeCompletedState();
    const results = makeFinalResults();
    const summary = generateSummary(state, results, "test-project");

    expect(summary).toContain("통과");
    expect(summary).toContain("3회 반복");
    expect(summary).toContain("PASS");
  });

  it("escalated state: output should contain Escalation, API_KEY, --resume", () => {
    const state = makeEscalatedState();
    const summary = generateSummary(state, [], "test-project");

    expect(summary).toContain("Escalation");
    expect(summary).toContain("API_KEY");
    expect(summary).toContain("--resume");
  });
});
