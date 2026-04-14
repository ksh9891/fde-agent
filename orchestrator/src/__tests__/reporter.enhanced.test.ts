import { describe, it, expect } from "vitest";
import { generateSummary, buildCoverageFromSpecs, type PlaywrightSpecInfo } from "../reporter.js";
import type { EvalResult, IterationState } from "../types.js";

const mockEvalSpec = {
  project: "resort-admin-prototype",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [
      { name: "객실", slug: "rooms", fields: ["객실번호", "타입"] },
      { name: "예약", slug: "reservations", fields: ["예약번호", "고객명"] },
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
  { evaluator: "e2e", status: "pass", severity: "soft", failures: [], stats: { total: 16, passed: 16, failed: 0 } },
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

  it("includes requirement ids in flow coverage table when playwrightSpecs have tags", () => {
    const specs: PlaywrightSpecInfo[] = [
      { file: "e2e/flows/reservation-create.spec.ts", title: "신규 예약 등록 @FR-001", status: "passed" },
    ];
    const summary = generateSummary(completedState, finalResults, mockEvalSpec, specs);
    expect(summary).toContain("FR-001");
    expect(summary).toContain("Requirement");
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
});

describe("buildCoverageFromSpecs", () => {
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
});
