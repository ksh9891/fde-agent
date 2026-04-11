import { execa } from "execa";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

const ERROR_PATTERNS = [
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /Uncaught/,
  /Unhandled/,
];

function findConsoleErrors(output: string): string[] {
  return output
    .split("\n")
    .filter((line) => ERROR_PATTERNS.some((re) => re.test(line)))
    .map((line) => line.trim())
    .filter(Boolean);
}

export class ConsoleCheckEvaluator implements Evaluator {
  readonly name = "console" as const;

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    let output = "";

    try {
      const result = await execa(
        "npx",
        ["playwright", "test", "--project=console-check"],
        { cwd: appDir, reject: false, all: true },
      );
      output = result.all ?? result.stdout ?? "";
    } catch (error: unknown) {
      const err = error as { all?: string; stdout?: string; message?: string };
      output = err.all ?? err.stdout ?? err.message ?? "";
    }

    const errorLines = findConsoleErrors(output);

    if (errorLines.length === 0) {
      return {
        evaluator: "console",
        status: "pass",
        severity: "soft",
        failures: [],
      };
    }

    const failures: EvalFailure[] = errorLines.map((line, i) => ({
      id: `console_error_${i + 1}`,
      message: "Console error detected in browser",
      evidence: [line],
      repair_hint: "Check browser console for runtime errors",
    }));

    return {
      evaluator: "console",
      status: "fail",
      severity: "soft",
      failures,
    };
  }
}
