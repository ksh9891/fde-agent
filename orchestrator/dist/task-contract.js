export function buildTaskContract(input) {
    const { evalSpec, workspace, runId, iteration, failures } = input;
    const failing_checks = failures.flatMap((result) => result.failures.map((failure) => `${result.evaluator}: ${failure.message}`));
    const repair_hints = failures.flatMap((result) => result.failures
        .filter((failure) => failure.repair_hint !== undefined)
        .map((failure) => failure.repair_hint));
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
//# sourceMappingURL=task-contract.js.map