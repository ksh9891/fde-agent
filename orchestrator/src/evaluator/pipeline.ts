import type { EvalResult } from "../types.js";

export interface Evaluator {
  name: "build" | "unit_test" | "console" | "e2e";
  run(workspace: string): Promise<EvalResult>;
}

export interface PipelineResult {
  allHardConstraintsPassed: boolean;
  results: EvalResult[];
  failures: EvalResult[];
}

const BLOCKING_EVALUATORS = new Set(["build", "unit_test"]);

export class EvalPipeline {
  private evaluators: Evaluator[];

  constructor(evaluators: Evaluator[]) {
    this.evaluators = evaluators;
  }

  async runAll(workspace: string): Promise<PipelineResult> {
    const results: EvalResult[] = [];
    const failures: EvalResult[] = [];

    for (const evaluator of this.evaluators) {
      const result = await evaluator.run(workspace);
      results.push(result);

      if (result.status === "fail") {
        failures.push(result);
        // Stop pipeline if a blocking evaluator fails with hard severity
        if (BLOCKING_EVALUATORS.has(evaluator.name) && result.severity === "hard") {
          break;
        }
      }
    }

    const allHardConstraintsPassed = failures.every((f) => f.severity !== "hard");
    return { allHardConstraintsPassed, results, failures };
  }
}
