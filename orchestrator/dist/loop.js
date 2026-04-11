import { buildTaskContract } from "./task-contract.js";
import { classifyFailure } from "./classifier.js";
export async function mainLoop(input) {
    const { evalSpec, workspace, runId, builder, evalRunner, maxIterations, startIteration } = input;
    const history = [];
    let previousFailures = [];
    for (let iteration = startIteration; iteration <= maxIterations; iteration++) {
        // 1. Build task contract from evalSpec + previous failures
        // Builder works inside workspace/app (the actual Next.js project)
        const taskContract = buildTaskContract({
            evalSpec,
            workspace: `${workspace}/app`,
            runId,
            iteration,
            failures: previousFailures,
        });
        // 2. Execute builder
        await builder.execute(taskContract);
        // 3. Run evaluators
        const pipelineResult = await evalRunner(workspace);
        // Collect failure ids for history
        const failedIds = pipelineResult.failures.flatMap((r) => r.failures.map((f) => f.id));
        const passedEvaluators = pipelineResult.results
            .filter((r) => r.status === "pass")
            .map((r) => r.evaluator);
        // 4. Check for env_issue → escalate immediately
        const allFailures = pipelineResult.failures.flatMap((r) => r.failures);
        const hasEnvIssue = allFailures.some((failure) => classifyFailure(failure) === "env_issue");
        if (hasEnvIssue) {
            const envFailure = allFailures.find((failure) => classifyFailure(failure) === "env_issue");
            history.push({
                iteration,
                passed: passedEvaluators,
                failed: failedIds,
                status: "escalated",
                reason: "env_issue",
            });
            return {
                run_id: runId,
                total_iterations: iteration,
                max_iterations: maxIterations,
                status: "escalated",
                escalation_reason: `env_issue: ${envFailure?.message ?? "Environment issue detected"}`,
                resumable: true,
                history,
            };
        }
        // 5. Check allHardConstraintsPassed → return completed
        if (pipelineResult.allHardConstraintsPassed) {
            history.push({
                iteration,
                passed: passedEvaluators,
                failed: failedIds,
                status: "completed",
            });
            return {
                run_id: runId,
                total_iterations: iteration,
                max_iterations: maxIterations,
                status: "completed",
                resumable: false,
                history,
            };
        }
        // 6. Otherwise continue loop — record history and update failures
        history.push({
            iteration,
            passed: passedEvaluators,
            failed: failedIds,
            status: "running",
        });
        previousFailures = pipelineResult.failures;
    }
    // After max iterations → escalate
    return {
        run_id: runId,
        total_iterations: maxIterations,
        max_iterations: maxIterations,
        status: "escalated",
        escalation_reason: "Max iterations exceeded",
        resumable: true,
        history,
    };
}
//# sourceMappingURL=loop.js.map