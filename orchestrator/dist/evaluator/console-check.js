import { execa } from "execa";
const ERROR_PATTERNS = [
    /TypeError/,
    /ReferenceError/,
    /SyntaxError/,
    /Uncaught/,
    /Unhandled/,
];
function findConsoleErrors(output) {
    return output
        .split("\n")
        .filter((line) => ERROR_PATTERNS.some((re) => re.test(line)))
        .map((line) => line.trim())
        .filter(Boolean);
}
export class ConsoleCheckEvaluator {
    name = "console";
    async run(workspace) {
        const appDir = `${workspace}/app`;
        let output = "";
        try {
            const result = await execa("npx", ["playwright", "test", "--project=console-check"], { cwd: appDir, reject: false, all: true });
            output = result.all ?? result.stdout ?? "";
        }
        catch (error) {
            const err = error;
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
        const failures = errorLines.map((line, i) => ({
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
//# sourceMappingURL=console-check.js.map