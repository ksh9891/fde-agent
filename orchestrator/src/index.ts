import { parseArgs } from "util";
import { randomUUID } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseEvalSpec } from "./eval-spec-parser.js";
import { Provisioner } from "./provisioner.js";
import { ClaudeCodeBuilder } from "./builder/claude-code.js";
import { EvalPipeline } from "./evaluator/pipeline.js";
import { BuildCheckEvaluator } from "./evaluator/build-check.js";
import { UnitTestEvaluator } from "./evaluator/unit-test.js";
import { ConsoleCheckEvaluator } from "./evaluator/console-check.js";
import { E2EEvaluator } from "./evaluator/e2e.js";
import { loadIterationState } from "./resume.js";
import { mainLoop } from "./loop.js";
import { writeReport } from "./reporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pluginDir = resolve(__dirname, "..", "..");

const MAX_ITERATIONS = 15;

async function main() {
  const { values } = parseArgs({
    options: {
      spec: { type: "string", short: "s" },
      resume: { type: "string", short: "r" },
    },
  });

  if (!values.spec) {
    console.error("Usage: fde-agent --spec <eval-spec.yaml> [--resume <run-id>]");
    process.exit(1);
  }

  // Parse eval spec
  const specPath = resolve(values.spec);
  console.log(`[FDE-AGENT] Parsing eval spec: ${specPath}`);
  const evalSpec = await parseEvalSpec(specPath);
  console.log(`[FDE-AGENT] Project: ${evalSpec.project}, Preset: ${evalSpec.preset}`);

  // Check external secrets
  if (evalSpec.external_secrets && evalSpec.external_secrets.length > 0) {
    const missingSecrets: string[] = [];
    for (const secret of evalSpec.external_secrets) {
      if (secret.required && !process.env[secret.name]) {
        missingSecrets.push(secret.name);
      }
    }
    if (missingSecrets.length > 0) {
      console.error(
        `[FDE-AGENT] Missing required environment variables: ${missingSecrets.join(", ")}`
      );
      process.exit(1);
    }
  }

  // Setup provisioner, builder, pipeline
  const workspaceRoot = resolve(pluginDir, "workspaces");
  const presetsDir = resolve(pluginDir, "presets");
  const palettesDir = resolve(pluginDir, "global", "palettes");

  const provisioner = new Provisioner({
    workspaceRoot,
    presetsDir,
    palettesDir,
  });

  const systemPromptPath = resolve(pluginDir, "agents", "builder.md");

  const builder = new ClaudeCodeBuilder({ systemPromptPath });

  const pipeline = new EvalPipeline([
    new BuildCheckEvaluator(),
    new UnitTestEvaluator(),
    new ConsoleCheckEvaluator(),
    new E2EEvaluator(),
  ]);

  // Handle resume vs fresh start
  let runId: string;
  let workspace: string;
  let startIteration: number;

  if (values.resume) {
    runId = values.resume;
    workspace = resolve(workspaceRoot, runId);
    console.log(`[FDE-AGENT] Resuming run: ${runId}`);

    const previousState = await loadIterationState(workspace);
    startIteration = previousState.total_iterations + 1;
    console.log(`[FDE-AGENT] Resuming from iteration ${startIteration}`);
  } else {
    runId = randomUUID();
    console.log(`[FDE-AGENT] Starting new run: ${runId}`);

    workspace = await provisioner.create({
      runId,
      preset: evalSpec.preset,
      palette: evalSpec.palette,
    });
    startIteration = 1;
  }

  console.log(`[FDE-AGENT] Workspace: ${workspace}`);

  // Run main loop
  const evalRunner = (ws: string) => pipeline.runAll(ws);

  const finalState = await mainLoop({
    evalSpec,
    workspace,
    runId,
    builder,
    evalRunner,
    maxIterations: MAX_ITERATIONS,
    startIteration,
  });

  // Write report — run evaluators one more time to get final results for the report
  const finalResults = finalState.status === "completed"
    ? (await pipeline.runAll(workspace)).results
    : [];
  await writeReport(workspace, finalState, finalResults, evalSpec.project);

  // Log results
  console.log(`[FDE-AGENT] Run complete`);
  console.log(`[FDE-AGENT] Status: ${finalState.status}`);
  console.log(`[FDE-AGENT] Total iterations: ${finalState.total_iterations}`);
  if (finalState.escalation_reason) {
    console.log(`[FDE-AGENT] Escalation reason: ${finalState.escalation_reason}`);
  }
  console.log(`[FDE-AGENT] Report written to: ${workspace}/report/summary.md`);

  if (finalState.status === "escalated") {
    console.log(`[FDE-AGENT] To resume: fde-agent --resume ${runId}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FDE-AGENT] Fatal error:", err.message);
  process.exit(1);
});
