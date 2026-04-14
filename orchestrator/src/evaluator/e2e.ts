import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EvalResult, EvalFailure, Requirement } from "../types.js";
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

export interface SpecStats {
  total: number;
  passed: number;
  failed: number;
}

export function mapFailureSeverity(
  specTitle: string,
  requirements: Requirement[],
): "hard" | "soft" {
  // 1. Tag-based matching (@FR-001 등)
  const tagPattern = /@([A-Za-z]+-\d+)/g;
  const tags = [...specTitle.matchAll(tagPattern)].map((m) => m[1]);

  if (tags.length > 0) {
    for (const tag of tags) {
      const req = requirements.find((r) => r.id === tag);
      if (req?.severity === "hard") return "hard";
    }
    return "soft"; // tags found but none are hard
  }

  // 2. Fallback: title substring matching (legacy/template tests)
  const e2eReqs = requirements.filter((r) => r.test_method === "e2e");
  for (const req of e2eReqs) {
    if (specTitle.includes(req.title)) {
      return req.severity;
    }
  }
  return "soft";
}

export function collectAllSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  stats: SpecStats,
  requirements: Requirement[],
): void {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        stats.total += 1;
        if (spec.status === "failed" || spec.status === "timedOut") {
          stats.failed += 1;
          const severity = mapFailureSeverity(spec.title, requirements);
          failures.push({
            id: `e2e_failure_${stats.failed}`,
            message: `E2E spec failed: ${spec.title}`,
            severity,
            evidence: spec.error?.message ? [spec.error.message] : [],
            repair_hint: "Fix the failing E2E test scenario",
          });
        } else if (spec.status === "passed" || spec.status === "expected") {
          stats.passed += 1;
        }
      }
    }
    if (suite.suites) {
      collectAllSpecs(suite.suites, failures, stats, requirements);
    }
  }
}

export class E2EEvaluator implements Evaluator {
  readonly name = "e2e" as const;
  private requirements: Requirement[];

  constructor(requirements: Requirement[]) {
    this.requirements = requirements;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    let report: PlaywrightReport = {};
    const reportPath = join(appDir, "playwright-report", "results.json");

    try {
      await execa("npm", ["run", "test:e2e"], {
        cwd: appDir,
        reject: false,
        all: true,
        timeout: 120_000,
      });
    } catch {
      // Test runner may exit non-zero on failures; we parse the report regardless
    }

    let parsed = false;
    try {
      const reportJson = await readFile(reportPath, "utf-8");
      report = JSON.parse(reportJson) as PlaywrightReport;
      parsed = true;
    } catch {
      // File not found or invalid
    }

    if (!parsed) {
      let rawOutput = "";
      try {
        const result = await execa(
          "npx",
          ["playwright", "test", "--project=e2e", "--reporter=json"],
          { cwd: appDir, reject: false, all: true, timeout: 120_000 },
        );
        rawOutput = result.stdout ?? result.all ?? "";
      } catch (error: unknown) {
        const err = error as { stdout?: string; all?: string; message?: string };
        rawOutput = err.stdout ?? err.all ?? err.message ?? "";
      }

      try {
        const jsonStart = rawOutput.indexOf("{");
        if (jsonStart !== -1) {
          report = JSON.parse(rawOutput.slice(jsonStart)) as PlaywrightReport;
        }
      } catch {
        return {
          evaluator: "e2e",
          status: "fail",
          severity: "hard",
          failures: [{
            id: "e2e_parse_error",
            message: "Failed to parse Playwright JSON report",
            evidence: rawOutput ? [rawOutput.slice(0, 500)] : [],
          }],
          stats: { total: 0, passed: 0, failed: 0 },
        };
      }
    }

    // Guard: no suites → test runner failed silently
    if (!report.suites || report.suites.length === 0) {
      const topErrors = (report.errors ?? [])
        .map((e) => e.message ?? "unknown error")
        .join("; ");
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [{
          id: "e2e_no_results",
          message: "Playwright test runner produced no results",
          evidence: topErrors ? [topErrors] : [],
          repair_hint: "Check playwright.config.ts and ensure e2e/ directory has test files",
        }],
        stats: { total: 0, passed: 0, failed: 0 },
      };
    }

    const failures: EvalFailure[] = [];
    const stats: SpecStats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(report.suites, failures, stats, this.requirements);

    // Guard: suites exist but 0 specs
    if (stats.total === 0) {
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [{
          id: "e2e_no_tests",
          message: "No E2E tests were executed (0 specs found in report)",
          evidence: [],
          repair_hint: "Ensure e2e/ directory contains .spec.ts files and playwright.config.ts testDir is correct",
        }],
        stats: { total: 0, passed: 0, failed: 0 },
      };
    }

    if (report.errors) {
      for (const err of report.errors) {
        stats.failed += 1;
        failures.push({
          id: `e2e_error_${stats.failed}`,
          message: "Playwright encountered a global error",
          evidence: err.message ? [err.message] : [],
        });
      }
    }

    const hasHardFailure = failures.some((f) => f.severity === "hard");

    return {
      evaluator: "e2e",
      status: failures.length === 0 ? "pass" : "fail",
      severity: hasHardFailure ? "hard" : "soft",
      failures,
      stats,
    };
  }
}
