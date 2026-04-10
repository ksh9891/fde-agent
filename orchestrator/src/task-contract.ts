import type { EvalSpec, EvalResult, TaskContract } from "./types.js";

interface BuildTaskContractInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  iteration: number;
  failures: EvalResult[];
}

export function buildTaskContract(input: BuildTaskContractInput): TaskContract {
  const { evalSpec, workspace, runId, iteration, failures } = input;

  const failing_checks: string[] = failures.flatMap((result) =>
    result.failures.map((failure) => `${result.evaluator}: ${failure.message}`)
  );

  const repair_hints: string[] = failures.flatMap((result) =>
    result.failures
      .filter((failure) => failure.repair_hint !== undefined)
      .map((failure) => failure.repair_hint as string)
  );

  return {
    run_id: runId,
    preset: evalSpec.preset,
    palette: evalSpec.palette,
    iteration,
    workspace,
    goal: evalSpec.project,
    domain: evalSpec.domain,
    failing_checks,
    repair_hints,
    protected_files: ["design-tokens.json", "layout.tsx"],
  };
}
