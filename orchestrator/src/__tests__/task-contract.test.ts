import { describe, it, expect } from "vitest";
import { buildTaskContract } from "../task-contract.js";
import type { EvalSpec, EvalResult } from "../types.js";

const sampleSpec: EvalSpec = {
  project: "test-project",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [{ name: "예약", slug: "reservations", fields: ["예약번호", "상태"] }],
    key_flows: ["예약 조회"],
  },
  requirements: [
    { id: "FR-001", title: "예약 조회", severity: "hard", test_method: "e2e", description: "예약 조회 가능" },
    { id: "NFR-001", title: "빌드", severity: "hard", test_method: "build_check", description: "빌드 성공" },
  ],
  data_source: { type: "mock" },
  constraints: ["React + TypeScript + Next.js"],
};

describe("buildTaskContract", () => {
  it("builds first iteration contract with no failures", () => {
    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/workspace/test-project",
      runId: "run-abc-123",
      iteration: 1,
      failures: [],
    });

    expect(contract.run_id).toBe("run-abc-123");
    expect(contract.preset).toBe("admin-web");
    expect(contract.palette).toBe("warm-neutral");
    expect(contract.iteration).toBe(1);
    expect(contract.workspace).toBe("/workspace/test-project");
    expect(contract.goal).toBe("test-project");
    expect(contract.failing_checks).toEqual([]);
    expect(contract.repair_hints).toEqual([]);
    expect(contract.protected_files).toEqual(["design-tokens.json", "layout.tsx"]);
  });

  it("builds contract with failures mapping to failing_checks and repair_hints", () => {
    const failures: EvalResult[] = [
      {
        evaluator: "build",
        status: "fail",
        severity: "hard",
        failures: [
          { id: "build-001", message: "TypeScript compilation failed", evidence: ["src/app.tsx:10: error"], repair_hint: "Fix TypeScript types in app.tsx" },
          { id: "build-002", message: "Missing dependency", evidence: ["Cannot find module 'react'"], repair_hint: "Run npm install" },
        ],
      },
      {
        evaluator: "e2e",
        status: "fail",
        severity: "soft",
        failures: [
          { id: "e2e-001", message: "Button not found", evidence: ["Selector #submit not found"], repair_hint: undefined },
        ],
      },
    ];

    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/workspace/test-project",
      runId: "run-xyz-456",
      iteration: 2,
      failures,
    });

    expect(contract.run_id).toBe("run-xyz-456");
    expect(contract.iteration).toBe(2);

    // failing_checks format: "EVALUATOR_NAME: message\n    evidence: ..."
    expect(contract.failing_checks.some((c) => c.startsWith("build: TypeScript compilation failed"))).toBe(true);
    expect(contract.failing_checks.some((c) => c.startsWith("build: Missing dependency"))).toBe(true);
    expect(contract.failing_checks.some((c) => c.startsWith("e2e: Button not found"))).toBe(true);
    expect(contract.failing_checks).toHaveLength(3);

    // repair_hints extracted from failures (only those with repair_hint defined)
    expect(contract.repair_hints).toContain("Fix TypeScript types in app.tsx");
    expect(contract.repair_hints).toContain("Run npm install");
    expect(contract.repair_hints).toHaveLength(2);

    // failing_checks must also carry the first evidence snippet so the Builder
    // knows *why* the spec failed, not just that one did.
    const evidenceCheck = contract.failing_checks.find((c) => c.includes("Button not found"));
    expect(evidenceCheck).toMatch(/evidence:.*#submit/);
  });

  it("truncates long evidence and strips ANSI color codes", () => {
    const longEvidence = "[31mError[0m: " + "x".repeat(1000);
    const failures: EvalResult[] = [
      {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [
          { id: "e2e-001", message: "timeout", evidence: [longEvidence] },
        ],
      },
    ];
    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/w",
      runId: "r",
      iteration: 1,
      failures,
    });
    const check = contract.failing_checks[0];
    // ANSI stripped: no ESC chars
    expect(check).not.toMatch(/\[/);
    // Truncated: must not carry the full 1000-char payload
    expect(check.length).toBeLessThan(600);
    expect(check).toContain("…");
  });

  it("includes domain from evalSpec in the contract", () => {
    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/workspace/test-project",
      runId: "run-abc-123",
      iteration: 1,
      failures: [],
    });

    expect(contract.domain).toEqual(sampleSpec.domain);
  });
});
