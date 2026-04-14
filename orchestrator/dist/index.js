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
import { PageCheckEvaluator } from "./evaluator/page-check.js";
import { ConsoleCheckEvaluator } from "./evaluator/console-check.js";
import { E2EEvaluator } from "./evaluator/e2e.js";
import { TestGenerationStage } from "./test-generation-stage.js";
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
        const missingSecrets = [];
        for (const secret of evalSpec.external_secrets) {
            if (secret.required && !process.env[secret.name]) {
                missingSecrets.push(secret.name);
            }
        }
        if (missingSecrets.length > 0) {
            console.error(`[FDE-AGENT] Missing required environment variables: ${missingSecrets.join(", ")}`);
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
    const testWriterPromptPath = resolve(pluginDir, "agents", "test-writer.md");
    const testGenerationStage = new TestGenerationStage({
        systemPromptPath: testWriterPromptPath,
    });
    // Derive required pages from domain entities
    const requiredPages = ["dashboard"];
    for (const entity of evalSpec.domain.entities) {
        requiredPages.push(entity.slug);
    }
    console.log(`[FDE-AGENT] Required pages: ${requiredPages.join(", ")}`);
    const pipeline = new EvalPipeline([
        new BuildCheckEvaluator(),
        new UnitTestEvaluator(),
        new PageCheckEvaluator(requiredPages),
        new ConsoleCheckEvaluator(requiredPages.filter((p) => p !== "dashboard")),
        new E2EEvaluator(evalSpec.requirements),
    ]);
    // Handle resume vs fresh start
    let runId;
    let workspace;
    let startIteration;
    if (values.resume) {
        runId = values.resume;
        workspace = resolve(workspaceRoot, runId);
        console.log(`[FDE-AGENT] Resuming run: ${runId}`);
        const previousState = await loadIterationState(workspace);
        startIteration = previousState.total_iterations + 1;
        console.log(`[FDE-AGENT] Resuming from iteration ${startIteration}`);
    }
    else {
        runId = randomUUID();
        console.log(`[FDE-AGENT] Starting new run: ${runId}`);
        workspace = await provisioner.create({
            runId,
            preset: evalSpec.preset,
            palette: evalSpec.palette,
            entities: evalSpec.domain.entities,
        });
        startIteration = 1;
    }
    console.log(`[FDE-AGENT] Workspace: ${workspace}`);
    // Run main loop
    const evalRunner = (ws) => pipeline.runAll(ws);
    const finalState = await mainLoop({
        evalSpec,
        workspace,
        runId,
        builder,
        evalRunner,
        maxIterations: MAX_ITERATIONS,
        startIteration,
        afterFirstBuild: async (ws) => {
            console.log("[FDE-AGENT] Running Test Writer Agent for key_flow E2E tests...");
            const result = await testGenerationStage.execute({
                workspace: `${ws}/app`,
                keyFlows: evalSpec.domain.key_flows,
                entities: evalSpec.domain.entities,
                requirements: evalSpec.requirements
                    .filter((r) => r.test_method === "e2e")
                    .map((r) => ({ id: r.id, title: r.title, severity: r.severity, acceptance_criteria: r.acceptance_criteria })),
            });
            if (result.success) {
                console.log("[FDE-AGENT] key_flow E2E tests generated");
                return;
            }
            const hasHardE2E = evalSpec.requirements.some((r) => r.test_method === "e2e" && r.severity === "hard");
            if (hasHardE2E) {
                throw new Error("env_issue: Test Writer Agent failed — cannot verify hard e2e requirements: " +
                    result.output.slice(0, 200));
            }
            console.warn("[FDE-AGENT] Test Writer Agent failed (non-blocking — no hard e2e requirements):", result.output.slice(0, 200));
        },
    });
    // Write report — run evaluators one more time to get final results for the report
    const finalResults = finalState.status === "completed"
        ? (await pipeline.runAll(workspace)).results
        : [];
    await writeReport(workspace, finalState, finalResults, evalSpec);
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
//# sourceMappingURL=index.js.map