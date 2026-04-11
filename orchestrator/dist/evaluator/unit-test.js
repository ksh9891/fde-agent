import { execa } from "execa";
export class UnitTestEvaluator {
    name = "unit_test";
    async run(workspace) {
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
        }
        catch (error) {
            const err = error;
            const evidence = [];
            if (err.stderr)
                evidence.push(err.stderr);
            if (err.stdout)
                evidence.push(err.stdout);
            if (evidence.length === 0 && err.message)
                evidence.push(err.message);
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
//# sourceMappingURL=unit-test.js.map