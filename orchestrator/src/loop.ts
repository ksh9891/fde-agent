import type { EvalSpec, EvalResult, IterationState } from "./types.js";
import type { BuilderInterface } from "./builder/interface.js";
import type { PipelineResult } from "./evaluator/pipeline.js";
import { buildTaskContract } from "./task-contract.js";
import { classifyFailure } from "./classifier.js";

interface MainLoopInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  builder: BuilderInterface;
  evalRunner: (workspace: string) => Promise<PipelineResult>;
  maxIterations: number;
  startIteration: number;
}

export async function mainLoop(input: MainLoopInput): Promise<IterationState> {
  const { evalSpec, workspace, runId, builder, evalRunner, maxIterations, startIteration } = input;

  const history: IterationState["history"] = [];
  let previousFailures: EvalResult[] = [];

  for (let iteration = startIteration; iteration <= maxIterations; iteration++) {
    // 1. Build task contract from evalSpec + previous failures
    const taskContract = buildTaskContract({
      evalSpec,
      workspace,
      runId,
      iteration,
      failures: previousFailures,
    });

    // 2. Execute builder
    await builder.execute(taskContract);

    // 3. Run evaluators
    const pipelineResult = await evalRunner(workspace);

    // Collect failure ids for history
    const failedIds = pipelineResult.failures.flatMap((r) =>
      r.failures.map((f) => f.id)
    );
    const passedEvaluators = pipelineResult.results
      .filter((r) => r.status === "pass")
      .map((r) => r.evaluator);

    // 4. Check for env_issue → escalate immediately
    const allFailures = pipelineResult.failures.flatMap((r) => r.failures);
    const hasEnvIssue = allFailures.some(
      (failure) => classifyFailure(failure) === "env_issue"
    );

    if (hasEnvIssue) {
      const envFailure = allFailures.find(
        (failure) => classifyFailure(failure) === "env_issue"
      );
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
