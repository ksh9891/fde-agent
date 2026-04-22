import type { EvalSpec, EvalResult, TaskContract } from "./types.js";

interface BuildTaskContractInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  iteration: number;
  failures: EvalResult[];
}

const EVIDENCE_SNIPPET_MAX = 400;

// Playwright and compiler errors carry ANSI color codes that waste context
// and hurt Builder readability. Strip them before snippetting.
function sanitizeEvidence(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/\[[0-9;]*m/g, "");
  const firstLines = stripped.split("\n").slice(0, 6).join(" | ");
  return firstLines.length > EVIDENCE_SNIPPET_MAX
    ? firstLines.slice(0, EVIDENCE_SNIPPET_MAX) + "…"
    : firstLines;
}

export function buildTaskContract(input: BuildTaskContractInput): TaskContract {
  const { evalSpec, workspace, runId, iteration, failures } = input;

  // Each failing_check carries message + first evidence snippet so the Builder
  // can see *why* a spec failed, not just that one did. Without this the loop
  // burns iterations on the same failure because the repair prompt is blind.
  const failing_checks: string[] = failures.flatMap((result) =>
    result.failures.map((failure) => {
      const head = `${result.evaluator}: ${failure.message}`;
      const firstEvidence = failure.evidence?.[0];
      if (!firstEvidence) return head;
      return `${head}\n    evidence: ${sanitizeEvidence(firstEvidence)}`;
    }),
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
