import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class UnitTestEvaluator implements Evaluator {
  readonly name = "unit_test" as const;

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    try {
      await execa("npm", ["run", "test"], {
        cwd: appDir,
        reject: true,
      });

      return {
        evaluator: "unit_test",
        status: "pass",
        severity: "hard",
        failures: [],
      };
    } catch (error: unknown) {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      const evidence: string[] = [];

      if (err.stderr) evidence.push(err.stderr);
      if (err.stdout) evidence.push(err.stdout);
      if (evidence.length === 0 && err.message) evidence.push(err.message);

      const errorOutput = evidence.join("\n").slice(-2000);
      return {
        evaluator: "unit_test",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "unit_test_failed",
            message: "npm run test exited with non-zero status",
            evidence,
            repair_hint: `Unit tests failed. Error output:\n${errorOutput}`,
          },
        ],
      };
    }
  }
}
