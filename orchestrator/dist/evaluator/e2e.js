import { execa } from "execa";
function collectFailedSpecs(suites, failures, index) {
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
export class E2EEvaluator {
    name = "e2e";
    async run(workspace) {
        const appDir = `${workspace}/app`;
        let rawOutput = "";
        try {
            const result = await execa("npx", ["playwright", "test", "--project=e2e", "--reporter=json"], { cwd: appDir, reject: false, all: true });
            rawOutput = result.stdout ?? result.all ?? "";
        }
        catch (error) {
            const err = error;
            rawOutput = err.stdout ?? err.all ?? err.message ?? "";
        }
        // Parse JSON report
        let report = {};
        try {
            // Playwright may emit non-JSON lines before the JSON blob; find the first '{'
            const jsonStart = rawOutput.indexOf("{");
            if (jsonStart !== -1) {
                report = JSON.parse(rawOutput.slice(jsonStart));
            }
        }
        catch {
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
        const failures = [];
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
//# sourceMappingURL=e2e.js.map