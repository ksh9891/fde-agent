import { describe, it, expect, vi } from "vitest";
import { mainLoop } from "../loop.js";
import type { EvalSpec } from "../types.js";
import type { BuilderInterface } from "../builder/interface.js";
import type { PipelineResult } from "../evaluator/pipeline.js";

const sampleSpec: EvalSpec = {
  project: "test",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [{ name: "고객", fields: ["이름"] }],
    key_flows: ["조회"],
  },
  requirements: [
    {
      id: "NFR-001",
      title: "빌드",
      severity: "hard",
      test_method: "build_check",
      description: "빌드 성공",
    },
  ],
  data_source: { type: "mock" },
  constraints: [],
};

describe("mainLoop", () => {
  it("terminates on success", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "Build OK" }),
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
      workspace: "/tmp/test-workspace",
      runId: "run-001",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 3,
      startIteration: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.total_iterations).toBe(1);
    expect(mockBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it("retries up to max and escalates", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: false, output: "Build failed" }),
    };

    const mockEvalRunner = vi.fn().mockResolvedValue({
      allHardConstraintsPassed: false,
      results: [
        {
          evaluator: "build",
          status: "fail",
          severity: "hard",
          failures: [
            {
              id: "build-001",
              message: "TypeError: Cannot read properties of undefined",
              evidence: [],
              repair_hint: "Check the import",
            },
          ],
        },
      ],
      failures: [
        {
          evaluator: "build",
          status: "fail",
          severity: "hard",
          failures: [
            {
              id: "build-001",
              message: "TypeError: Cannot read properties of undefined",
              evidence: [],
              repair_hint: "Check the import",
            },
          ],
        },
      ],
    } satisfies PipelineResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/test-workspace",
      runId: "run-002",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 3,
      startIteration: 1,
    });

    expect(result.status).toBe("escalated");
    expect(result.total_iterations).toBe(3);
    expect(mockBuilder.execute).toHaveBeenCalledTimes(3);
  });

  it("escalates immediately on env_issue", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: false, output: "Env error" }),
    };

    const mockEvalRunner = vi.fn().mockResolvedValue({
      allHardConstraintsPassed: false,
      results: [
        {
          evaluator: "build",
          status: "fail",
          severity: "hard",
          failures: [
            {
              id: "env-001",
              message: "API_KEY is not defined",
              evidence: [],
            },
          ],
        },
      ],
      failures: [
        {
          evaluator: "build",
          status: "fail",
          severity: "hard",
          failures: [
            {
              id: "env-001",
              message: "API_KEY is not defined",
              evidence: [],
            },
          ],
        },
      ],
    } satisfies PipelineResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/test-workspace",
      runId: "run-003",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 3,
      startIteration: 1,
    });

    expect(result.status).toBe("escalated");
    expect(result.escalation_reason).toContain("env_issue");
    expect(mockBuilder.execute).toHaveBeenCalledTimes(1);
  });

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
    expect(mockBuilder.execute).toHaveBeenCalledOnce();
  });
});
