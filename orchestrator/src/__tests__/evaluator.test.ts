import { describe, it, expect, vi } from "vitest";
import { EvalPipeline } from "../evaluator/pipeline.js";
import type { Evaluator } from "../evaluator/pipeline.js";
import type { EvalResult } from "../types.js";

function makeEval(
  name: Evaluator["name"],
  result: EvalResult,
): Evaluator {
  return { name, run: vi.fn().mockResolvedValue(result) };
}

const passResult = (evaluator: EvalResult["evaluator"], severity: EvalResult["severity"] = "hard"): EvalResult => ({
  evaluator,
  status: "pass",
  severity,
  failures: [],
});

const failResult = (evaluator: EvalResult["evaluator"], severity: EvalResult["severity"] = "hard"): EvalResult => ({
  evaluator,
  status: "fail",
  severity,
  failures: [{ id: "f1", message: "failed", evidence: [] }],
});

describe("EvalPipeline", () => {
  it("should stop pipeline on first hard failure from blocking evaluator (build)", async () => {
    const build = makeEval("build", failResult("build", "hard"));
    const unitTest = makeEval("unit_test", passResult("unit_test"));
    const consoleCheck = makeEval("console", passResult("console", "soft"));
    const e2e = makeEval("e2e", passResult("e2e", "soft"));

    const pipeline = new EvalPipeline([build, unitTest, consoleCheck, e2e]);
    const result = await pipeline.runAll("/tmp/workspace");

    expect(build.run).toHaveBeenCalledOnce();
    expect(unitTest.run).not.toHaveBeenCalled();
    expect(result.allHardConstraintsPassed).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
  });

  it("should continue pipeline when build passes — all evaluators called", async () => {
    const build = makeEval("build", passResult("build"));
    const unitTest = makeEval("unit_test", passResult("unit_test"));
    const consoleCheck = makeEval("console", passResult("console", "soft"));
    const e2e = makeEval("e2e", passResult("e2e", "soft"));

    const pipeline = new EvalPipeline([build, unitTest, consoleCheck, e2e]);
    const result = await pipeline.runAll("/tmp/workspace");

    expect(build.run).toHaveBeenCalledOnce();
    expect(unitTest.run).toHaveBeenCalledOnce();
    expect(consoleCheck.run).toHaveBeenCalledOnce();
    expect(e2e.run).toHaveBeenCalledOnce();
    expect(result.allHardConstraintsPassed).toBe(true);
    expect(result.results).toHaveLength(4);
    expect(result.failures).toHaveLength(0);
  });

  it("should collect failures from multiple evaluators — e2e fails → allHardConstraintsPassed reflects severity", async () => {
    const build = makeEval("build", passResult("build"));
    const unitTest = makeEval("unit_test", passResult("unit_test"));
    const consoleCheck = makeEval("console", passResult("console", "soft"));
    const e2e = makeEval("e2e", failResult("e2e", "soft"));

    const pipeline = new EvalPipeline([build, unitTest, consoleCheck, e2e]);
    const result = await pipeline.runAll("/tmp/workspace");

    expect(result.results).toHaveLength(4);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].evaluator).toBe("e2e");
    // e2e is soft failure — hard constraints still pass
    expect(result.allHardConstraintsPassed).toBe(true);
  });
});
