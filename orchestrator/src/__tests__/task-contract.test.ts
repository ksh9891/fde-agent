import { describe, it, expect } from "vitest";
import { buildTaskContract } from "../task-contract.js";
import type { EvalSpec, EvalResult } from "../types.js";

const sampleSpec: EvalSpec = {
  project: "test-project",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [{ name: "예약", fields: ["예약번호", "상태"] }],
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

    // failing_checks format: "EVALUATOR_NAME: message"
    expect(contract.failing_checks).toContain("build: TypeScript compilation failed");
    expect(contract.failing_checks).toContain("build: Missing dependency");
    expect(contract.failing_checks).toContain("e2e: Button not found");
    expect(contract.failing_checks).toHaveLength(3);

    // repair_hints extracted from failures (only those with repair_hint defined)
    expect(contract.repair_hints).toContain("Fix TypeScript types in app.tsx");
    expect(contract.repair_hints).toContain("Run npm install");
    expect(contract.repair_hints).toHaveLength(2);
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
