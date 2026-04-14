import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
/**
 * Map a Playwright spec title to the severity of the matching eval-spec requirement.
 * Only requirements with `test_method === "e2e"` are considered.
 * If the requirement title is a substring of the spec title, it matches.
 * Default: "soft" (template / unknown tests).
 */
export function mapFailureSeverity(specTitle, requirements) {
    const e2eReqs = requirements.filter((r) => r.test_method === "e2e");
    for (const req of e2eReqs) {
        if (specTitle.includes(req.title)) {
            return req.severity;
        }
    }
    return "soft";
}
function collectFailedSpecs(suites, failures, index, requirements) {
    for (const suite of suites) {
        if (suite.specs) {
            for (const spec of suite.specs) {
                if (spec.status === "failed" || spec.status === "timedOut") {
                    index.count += 1;
                    const severity = mapFailureSeverity(spec.title, requirements);
                    failures.push({
                        id: `e2e_failure_${index.count}`,
                        message: `E2E spec failed: ${spec.title}`,
                        severity,
                        evidence: spec.error?.message ? [spec.error.message] : [],
                        repair_hint: "Fix the failing E2E test scenario",
                    });
                }
            }
        }
        if (suite.suites) {
            collectFailedSpecs(suite.suites, failures, index, requirements);
        }
    }
}
export class E2EEvaluator {
    name = "e2e";
    requirements;
    constructor(requirements) {
        this.requirements = requirements;
    }
    async run(workspace) {
        const appDir = `${workspace}/app`;
        let report = {};
        // Try reading from file first, fall back to stdout parsing
        const reportPath = join(appDir, "playwright-report", "results.json");
        try {
            // Run e2e tests via npm script (120s timeout)
            await execa("npm", ["run", "test:e2e"], {
                cwd: appDir,
                reject: false,
                all: true,
                timeout: 120_000,
            });
        }
        catch {
            // Test runner may exit non-zero on failures; we parse the report regardless
        }
        // Try to read the report file first
        let parsed = false;
        try {
            const reportJson = await readFile(reportPath, "utf-8");
            report = JSON.parse(reportJson);
            parsed = true;
        }
        catch {
            // File not found or invalid — fall back to stdout parsing below
        }
        // Fall back: re-run with JSON reporter to stdout
        if (!parsed) {
            let rawOutput = "";
            try {
                const result = await execa("npx", ["playwright", "test", "--project=e2e", "--reporter=json"], { cwd: appDir, reject: false, all: true, timeout: 120_000 });
                rawOutput = result.stdout ?? result.all ?? "";
            }
            catch (error) {
                const err = error;
                rawOutput = err.stdout ?? err.all ?? err.message ?? "";
            }
            try {
                const jsonStart = rawOutput.indexOf("{");
                if (jsonStart !== -1) {
                    report = JSON.parse(rawOutput.slice(jsonStart));
                }
            }
            catch {
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
        }
        const failures = [];
        const index = { count: 0 };
        if (report.suites) {
            collectFailedSpecs(report.suites, failures, index, this.requirements);
        }
        // Surface top-level errors (e.g. config issues)
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
        // Overall severity: "hard" if ANY failure has severity "hard", else "soft"
        const hasHardFailure = failures.some((f) => f.severity === "hard");
        return {
            evaluator: "e2e",
            status: failures.length === 0 ? "pass" : "fail",
            severity: hasHardFailure ? "hard" : "soft",
            failures,
        };
    }
}
//# sourceMappingURL=e2e.js.map