import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
// ---------------------------------------------------------------------------
// generateSummary — pure function, no I/O
// ---------------------------------------------------------------------------
export function generateSummary(state, finalResults, projectName) {
    const lines = [];
    if (state.status === "completed") {
        lines.push(`## 결과: 통과 (${state.total_iterations}회 반복)`);
        lines.push("");
        lines.push(`**프로젝트:** ${projectName}`);
        lines.push(`**Run ID:** ${state.run_id}`);
        lines.push("");
        // Results table
        if (finalResults.length > 0) {
            lines.push("### 평가 결과");
            lines.push("");
            lines.push("| Evaluator | Status | Severity |");
            lines.push("|-----------|--------|----------|");
            for (const r of finalResults) {
                const statusLabel = r.status === "pass" ? "PASS" : "FAIL";
                lines.push(`| ${r.evaluator} | ${statusLabel} | ${r.severity} |`);
            }
            lines.push("");
        }
        // History
        if (state.history.length > 0) {
            lines.push("### 반복 이력");
            lines.push("");
            for (const entry of state.history) {
                const passed = entry.passed?.join(", ") ?? "-";
                const failed = entry.failed?.join(", ") ?? "-";
                lines.push(`- **반복 ${entry.iteration}**: 통과=${passed}, 실패=${failed}`);
            }
            lines.push("");
        }
    }
    else if (state.status === "escalated") {
        lines.push("## 결과: Escalation");
        lines.push("");
        lines.push(`**프로젝트:** ${projectName}`);
        lines.push(`**Run ID:** ${state.run_id}`);
        lines.push("");
        if (state.escalation_reason) {
            lines.push("### Escalation 사유");
            lines.push("");
            lines.push(state.escalation_reason);
            lines.push("");
        }
        // Resume command
        lines.push("### 재개 방법");
        lines.push("");
        lines.push(`환경 문제를 해결한 후 다음 명령어로 재개하세요:`);
        lines.push("");
        lines.push("```sh");
        lines.push(`fde-agent run --resume ${state.run_id}`);
        lines.push("```");
        lines.push("");
        // History
        if (state.history.length > 0) {
            lines.push("### 반복 이력");
            lines.push("");
            for (const entry of state.history) {
                const failed = entry.failed?.join(", ") ?? "-";
                const reason = entry.reason ? ` (${entry.reason})` : "";
                lines.push(`- **반복 ${entry.iteration}**: 실패=${failed}${reason}`);
            }
            lines.push("");
        }
    }
    else {
        lines.push("## 결과: 실행 중");
        lines.push("");
        lines.push(`**Run ID:** ${state.run_id}`);
        lines.push("");
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// writeReport — async, writes files to workspace
// ---------------------------------------------------------------------------
export async function writeReport(workspace, state, finalResults, projectName) {
    // Create directory structure
    const reportDir = join(workspace, "report");
    const metaDir = join(workspace, "meta");
    const evidenceScreenshotsDir = join(reportDir, "evidence", "screenshots");
    const evidenceVideosDir = join(reportDir, "evidence", "videos");
    const evidenceLogsDir = join(reportDir, "evidence", "logs");
    await Promise.all([
        mkdir(reportDir, { recursive: true }),
        mkdir(metaDir, { recursive: true }),
        mkdir(evidenceScreenshotsDir, { recursive: true }),
        mkdir(evidenceVideosDir, { recursive: true }),
        mkdir(evidenceLogsDir, { recursive: true }),
    ]);
    // Write files
    const summary = generateSummary(state, finalResults, projectName);
    await Promise.all([
        writeFile(join(reportDir, "summary.md"), summary, "utf-8"),
        writeFile(join(reportDir, "eval-results.json"), JSON.stringify(finalResults, null, 2), "utf-8"),
        writeFile(join(metaDir, "iterations.json"), JSON.stringify(state, null, 2), "utf-8"),
    ]);
}
//# sourceMappingURL=reporter.js.map