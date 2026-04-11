import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class BuildCheckEvaluator implements Evaluator {
  readonly name = "build" as const;

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    try {
      await execa("npm", ["run", "build"], {
        cwd: appDir,
        reject: true,
      });

      return {
        evaluator: "build",
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

      const errorOutput = evidence.join("\n").slice(-2000); // Last 2000 chars
      return {
        evaluator: "build",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "build_failed",
            message: "npm run build exited with non-zero status",
            evidence,
            repair_hint: `Build failed. Error output:\n${errorOutput}`,
          },
        ],
      };
    }
  }
}
