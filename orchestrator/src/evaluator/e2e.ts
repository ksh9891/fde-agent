import { execa } from "execa";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

interface PlaywrightTestResult {
  title: string;
  status?: string;
  error?: { message?: string };
}

interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightTestResult[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  errors?: Array<{ message?: string }>;
}

function collectFailedSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  index: { count: number },
): void {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.status === "failed" || spec.status === "timedOut") {
          index.count += 1;
          failures.push({
            id: `e2e_failure_${index.count}`,
            message: `E2E spec failed: ${spec.title}`,
            evidence: spec.error?.message ? [spec.error.message] : [],
            repair_hint: "Fix the failing E2E test scenario",
          });
        }
      }
    }
    if (suite.suites) {
      collectFailedSpecs(suite.suites, failures, index);
    }
  }
}

export class E2EEvaluator implements Evaluator {
  readonly name = "e2e" as const;

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    let rawOutput = "";

    try {
      const result = await execa(
        "npx",
        ["playwright", "test", "--project=e2e", "--reporter=json"],
        { cwd: appDir, reject: false, all: true },
      );
      rawOutput = result.stdout ?? result.all ?? "";
    } catch (error: unknown) {
      const err = error as { stdout?: string; all?: string; message?: string };
      rawOutput = err.stdout ?? err.all ?? err.message ?? "";
    }

    // Parse JSON report
    let report: PlaywrightReport = {};
    try {
      // Playwright may emit non-JSON lines before the JSON blob; find the first '{'
      const jsonStart = rawOutput.indexOf("{");
      if (jsonStart !== -1) {
        report = JSON.parse(rawOutput.slice(jsonStart)) as PlaywrightReport;
      }
    } catch {
      // If parsing fails treat it as a complete failure
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "soft",
        failures: [
          {
            id: "e2e_parse_error",
            message: "Failed to parse Playwright JSON report",
            evidence: rawOutput ? [rawOutput.slice(0, 500)] : [],
          },
        ],
      };
    }

    const failures: EvalFailure[] = [];
    const index = { count: 0 };

    if (report.suites) {
      collectFailedSpecs(report.suites, failures, index);
    }

    // Also surface top-level errors (e.g. config issues)
    if (report.errors) {
      for (const err of report.errors) {
        index.count += 1;
        failures.push({
          id: `e2e_error_${index.count}`,
          message: "Playwright encountered a global error",
          evidence: err.message ? [err.message] : [],
        });
      }
    }

    return {
      evaluator: "e2e",
      status: failures.length === 0 ? "pass" : "fail",
      severity: "soft",
      failures,
    };
  }
}
