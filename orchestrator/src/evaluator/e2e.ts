import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EvalResult, EvalFailure, Requirement } from "../types.js";
import type { Evaluator } from "./pipeline.js";

interface PlaywrightResult {
  status?: string;
  errors?: Array<{ message?: string }>;
  error?: { message?: string };
}

interface PlaywrightTest {
  results?: PlaywrightResult[];
  status?: string;
}

interface PlaywrightSpec {
  title: string;
  ok?: boolean;
  tests?: PlaywrightTest[];
}

interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightSpec[];
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

// Extract contiguous runs of 3+ Korean/alphanumeric chars as matching phrases.
// Used to approximate requirement-to-spec matching when Test Writer fails to
// emit the @{requirement_id} tag — a safety net, not a replacement for tags.
function extractPhrases(text: string): string[] {
  return text.match(/[가-힣0-9A-Za-z]{3,}/g) ?? [];
}

function phraseMatchScore(specTitle: string, candidate: string): number {
  const phrases = Array.from(new Set(extractPhrases(candidate)));
  let score = 0;
  for (const phrase of phrases) {
    if (specTitle.includes(phrase)) score += 1;
  }
  return score;
}

const AC_MATCH_THRESHOLD = 2;

export function mapFailureSeverity(
  specTitle: string | string[],
  requirements: Requirement[],
): "hard" | "soft" {
  // Playwright nests describe() blocks as parent suites; tags like `@BR-001`
  // often live on a parent describe, not the leaf spec title. Accept an array
  // so callers can pass the full title stack and we search tags across all of
  // them.
  const titles = Array.isArray(specTitle) ? specTitle : [specTitle];
  const combined = titles.join(" ");

  // 1. Tag-based matching (@FR-001 등) — scan every title in the stack
  const tagPattern = /@([A-Za-z]+-\d+)/g;
  const tags = titles.flatMap((t) =>
    [...t.matchAll(tagPattern)].map((m) => m[1]),
  );

  if (tags.length > 0) {
    for (const tag of tags) {
      const req = requirements.find((r) => r.id === tag);
      if (req?.severity === "hard") return "hard";
    }
    return "soft"; // tags found but none are hard
  }

  const e2eReqs = requirements.filter((r) => r.test_method === "e2e");

  // 2. Fallback: title substring matching across the title stack
  for (const req of e2eReqs) {
    if (titles.some((t) => t.includes(req.title))) {
      return req.severity;
    }
  }

  // 3. Safety-net: acceptance_criteria phrase overlap. Picks the requirement
  //    with the highest phrase score; ties resolve to `hard` severity. Used
  //    when Test Writer failed to attach an @{id} tag but the spec text still
  //    clearly describes a declared requirement.
  const scored = e2eReqs
    .map((req) => {
      const candidates = [req.title, ...(req.acceptance_criteria ?? [])];
      const best = Math.max(
        0,
        ...candidates.map((c) => phraseMatchScore(combined, c)),
      );
      return { req, score: best };
    })
    .filter((x) => x.score >= AC_MATCH_THRESHOLD)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aHard = a.req.severity === "hard" ? 1 : 0;
      const bHard = b.req.severity === "hard" ? 1 : 0;
      return bHard - aHard;
    });

  if (scored.length > 0) return scored[0].req.severity;

  return "soft";
}

export function collectAllSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  stats: SpecStats,
  requirements: Requirement[],
  parentTitles: string[] = [],
): void {
  for (const suite of suites) {
    const suiteTitles = suite.title
      ? [...parentTitles, suite.title]
      : parentTitles;
    if (suite.specs) {
      for (const spec of suite.specs) {
        // Iterate every test result across projects; this mirrors Playwright's
        // actual JSON shape where spec-level status is not populated.
        const results: PlaywrightResult[] = (spec.tests ?? []).flatMap(
          (t) => t.results ?? [],
        );

        if (results.length === 0) {
          continue;
        }

        for (const result of results) {
          stats.total += 1;
          const status = result.status;
          if (status === "failed" || status === "timedOut" || status === "interrupted") {
            stats.failed += 1;
            const errMsg =
              result.errors?.[0]?.message ?? result.error?.message;
            // Pass full title stack so tags on parent describe() blocks
            // (e.g. `describe("회원가입 플로우 @BR-001 @BR-005")`) are seen.
            const severity = mapFailureSeverity(
              [...suiteTitles, spec.title],
              requirements,
            );
            failures.push({
              id: `e2e_failure_${stats.failed}`,
              message: `E2E spec failed: ${spec.title}`,
              severity,
              evidence: errMsg ? [errMsg] : [],
              repair_hint: "Fix the failing E2E test scenario",
            });
          } else if (status === "passed") {
            stats.passed += 1;
          }
          // skipped → neither passed nor failed
        }
      }
    }
    if (suite.suites) {
      collectAllSpecs(suite.suites, failures, stats, requirements, suiteTitles);
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
