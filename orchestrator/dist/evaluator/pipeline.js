const BLOCKING_EVALUATORS = new Set(["build", "unit_test"]);
export class EvalPipeline {
    evaluators;
    constructor(evaluators) {
        this.evaluators = evaluators;
    }
    async runAll(workspace) {
        const results = [];
        const failures = [];
        for (const evaluator of this.evaluators) {
            const result = await evaluator.run(workspace);
            results.push(result);
            if (result.status === "fail") {
                failures.push(result);
                // Stop pipeline if a blocking evaluator fails with hard severity
                if (BLOCKING_EVALUATORS.has(evaluator.name) && result.severity === "hard") {
                    break;
                }
            }
        }
        const allHardConstraintsPassed = failures.every((f) => f.severity !== "hard");
        return { allHardConstraintsPassed, results, failures };
    }
}
//# sourceMappingURL=pipeline.js.map