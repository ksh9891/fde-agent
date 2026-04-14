import { describe, it, expect } from "vitest";
import { generateSummary } from "../reporter.js";
import type { EvalResult, IterationState } from "../types.js";

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
};

const completedState: IterationState = {
  run_id: "run-123",
  total_iterations: 3,
  max_iterations: 15,
  status: "completed",
  resumable: false,
  history: [
    {
      iteration: 1, passed: ["build"], failed: ["e2e_flow_1"],
      failure_details: [{ id: "e2e_flow_1", message: "E2E spec failed: 신규 예약 등록", hint: "Fix form handler" }],
      status: "running",
    },
    {
      iteration: 2, passed: ["build", "unit_test"], failed: ["console_error_1"],
      failure_details: [{ id: "console_error_1", message: "TypeError on /reservations", hint: "Check component" }],
      status: "running",
    },
    {
      iteration: 3, passed: ["build", "unit_test", "page_check", "console", "e2e"], failed: [],
      failure_details: [], status: "completed",
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
