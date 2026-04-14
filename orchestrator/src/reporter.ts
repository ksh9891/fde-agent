import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EvalResult, EvalSpec, IterationState } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  switch (status) {
    case "completed":
      return "통과 ✅";
    case "escalated":
      return "에스컬레이션 ⚠️";
    default:
      return "실행 중";
  }
}

// ---------------------------------------------------------------------------
// Playwright report coverage mapping
// ---------------------------------------------------------------------------

export interface PlaywrightSpecInfo {
  file: string;
  title: string;
  status: string;
}

interface TemplateCoverageEntry {
  entity: string;
  list: string;
  detail: string;
  form: string;
}

interface FlowCoverageEntry {
  file: string;
  title: string;
  status: string;
}

export interface CoverageData {
  templateCoverage: TemplateCoverageEntry[];
  flowCoverage: FlowCoverageEntry[];
}

const ENTITY_SLUG_MAP: Record<string, string> = {
  "예약": "reservations",
  "객실": "rooms",
  "고객": "customers",
  "상품": "products",
  "주문": "orders",
  "회원": "members",
  "문의": "inquiries",
  "게시글": "posts",
  "카테고리": "categories",
  "설정": "settings",
};

export function buildCoverageFromSpecs(
  specs: PlaywrightSpecInfo[],
  evalSpec: EvalSpec,
): CoverageData {
  const templateCoverage: TemplateCoverageEntry[] = [];
  for (const entity of evalSpec.domain.entities) {
    const slug = ENTITY_SLUG_MAP[entity.name] ?? entity.name.toLowerCase();
    const entry: TemplateCoverageEntry = { entity: entity.name, list: "-", detail: "-", form: "-" };
    for (const spec of specs) {
      const fileName = spec.file.split("/").pop() ?? "";
      if (fileName === `${slug}-list.spec.ts`) {
        entry.list = spec.status === "passed" ? "PASS" : "FAIL";
      } else if (fileName === `${slug}-detail.spec.ts`) {
        entry.detail = spec.status === "passed" ? "PASS" : "FAIL";
      } else if (fileName === `${slug}-form.spec.ts`) {
        entry.form = spec.status === "passed" ? "PASS" : "FAIL";
      }
    }
    templateCoverage.push(entry);
  }

  const flowCoverage: FlowCoverageEntry[] = [];
  for (const spec of specs) {
    if (spec.file.includes("e2e/flows/")) {
      const fileName = spec.file.split("/").pop() ?? "";
      flowCoverage.push({
        file: fileName,
        title: spec.title,
        status: spec.status === "passed" ? "PASS" : "FAIL",
      });
    }
  }

  return { templateCoverage, flowCoverage };
}

// ---------------------------------------------------------------------------
// generateSummary — pure function, no I/O
// ---------------------------------------------------------------------------

export function generateSummary(
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
  playwrightSpecs?: PlaywrightSpecInfo[],
): string {
  const lines: string[] = [];

  // ---- Header ----
  lines.push("# 프로토타입 검증 리포트");
  lines.push("");

  // ---- Overview table ----
  lines.push("## 개요");
  lines.push("");
  lines.push("| 항목 | 값 |");
  lines.push("|------|-----|");
  lines.push(`| 프로젝트 | ${evalSpec.project} |`);
  lines.push(`| 프리셋 | ${evalSpec.preset} |`);
  lines.push(`| 팔레트 | ${evalSpec.palette} |`);
  lines.push(`| Run ID | ${state.run_id} |`);
  lines.push(`| 최종 상태 | ${formatStatus(state.status)} |`);
  lines.push(`| 총 반복 횟수 | ${state.total_iterations} |`);
  lines.push(`| 실행 시각 | ${new Date().toISOString()} |`);
  lines.push("");

  // ---- Escalation block ----
  if (state.status === "escalated") {
    lines.push("### Escalation 사유");
    lines.push("");
    if (state.escalation_reason) {
      lines.push(state.escalation_reason);
      lines.push("");
    }
    lines.push("### 재개 방법");
    lines.push("");
    lines.push("환경 문제를 해결한 후 다음 명령어로 재개하세요:");
    lines.push("");
    lines.push("```sh");
    lines.push(`fde-agent run --resume ${state.run_id}`);
    lines.push("```");
    lines.push("");
  }

  // ---- Evaluation results table ----
  if (finalResults.length > 0) {
    lines.push("## 평가 결과 요약");
    lines.push("");
    lines.push("| Evaluator | Severity | Status | 실패 항목 수 |");
    lines.push("|-----------|----------|--------|-------------|");
    for (const r of finalResults) {
      const statusLabel = r.status === "pass" ? "PASS" : "FAIL";
      const detail = r.stats
        ? `${r.stats.total} total, ${r.stats.passed} passed, ${r.stats.failed} failed`
        : `${r.failures.length}`;
      lines.push(`| ${r.evaluator} | ${r.severity} | ${statusLabel} | ${detail} |`);
    }
    lines.push("");
  }

  // ---- Iteration history ----
  if (state.history.length > 0) {
    lines.push("## 반복 이력");
    lines.push("");
    for (const entry of state.history) {
      lines.push(`### Iteration ${entry.iteration}`);
      lines.push("");

      const passed = entry.passed?.join(", ") ?? "-";
      lines.push(`- **통과:** ${passed}`);

      const failed = entry.failed?.join(", ") ?? "-";
      lines.push(`- **실패:** ${failed}`);

      if (entry.failure_details && entry.failure_details.length > 0) {
        for (const detail of entry.failure_details) {
          lines.push(`  - \`${detail.id}\`: ${detail.message}`);
          if (detail.hint) {
            lines.push(`    - Hint: ${detail.hint}`);
          }
        }
      }

      if (entry.reason) {
        lines.push(`- **사유:** ${entry.reason}`);
      }

      lines.push("");
    }
  }

  // ---- Remaining failures (only if not completed) ----
  if (state.status !== "completed" && finalResults.length > 0) {
    const remainingFailures = finalResults.filter((r) => r.status === "fail");
    if (remainingFailures.length > 0) {
      lines.push("## 실패 상세 (최종 잔여)");
      lines.push("");
      for (const r of remainingFailures) {
        lines.push(`### ${r.evaluator} (${r.severity})`);
        lines.push("");
        for (const f of r.failures) {
          lines.push(`- \`${f.id}\`: ${f.message}`);
          if (f.repair_hint) {
            lines.push(`  - Hint: ${f.repair_hint}`);
          }
        }
        lines.push("");
      }
    }
  }

  // ---- Test coverage ----
  lines.push("## 테스트 커버리지");
  lines.push("");

  if (playwrightSpecs && playwrightSpecs.length > 0) {
    const coverage = buildCoverageFromSpecs(playwrightSpecs, evalSpec);

    if (coverage.templateCoverage.length > 0) {
      lines.push("### 템플릿 기반");
      lines.push("");
      lines.push("| 엔티티 | list | detail | form | 결과 |");
      lines.push("|--------|------|--------|------|------|");
      for (const entry of coverage.templateCoverage) {
        const results = [entry.list, entry.detail, entry.form];
        const passCount = results.filter((r) => r === "PASS").length;
        const totalCount = results.filter((r) => r !== "-").length;
        lines.push(`| ${entry.entity} | ${entry.list} | ${entry.detail} | ${entry.form} | ${passCount}/${totalCount} |`);
      }
      lines.push("");
    }

    if (coverage.flowCoverage.length > 0) {
      lines.push("### key_flow");
      lines.push("");
      lines.push("| Flow | 테스트 파일 | 결과 |");
      lines.push("|------|------------|------|");
      for (const entry of coverage.flowCoverage) {
        lines.push(`| ${entry.title} | ${entry.file} | ${entry.status} |`);
      }
      lines.push("");
    }
  } else {
    if (evalSpec.domain.entities.length > 0) {
      lines.push("### 템플릿 기반");
      lines.push("");
      lines.push("| 엔티티 | list | detail | form |");
      lines.push("|--------|------|--------|------|");
      for (const entity of evalSpec.domain.entities) {
        lines.push(`| ${entity.name} | - | - | - |`);
      }
      lines.push("");
    }

    if (evalSpec.domain.key_flows.length > 0) {
      lines.push("### key_flow");
      lines.push("");
      lines.push("| Flow | 테스트 |");
      lines.push("|------|--------|");
      for (const flow of evalSpec.domain.key_flows) {
        lines.push(`| ${flow} | - |`);
      }
      lines.push("");
    }
  }

  // ---- Execution environment ----
  lines.push("## 실행 환경");
  lines.push("");
  lines.push(`- **Node:** ${process.version}`);
  lines.push(`- **Preset:** ${evalSpec.preset}`);
  lines.push(`- **Palette:** ${evalSpec.palette}`);
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Playwright report parsing for writeReport
// ---------------------------------------------------------------------------

interface PlaywrightReportSuite {
  title?: string;
  file?: string;
  specs?: Array<{ title: string; ok: boolean; tests: Array<{ status: string }> }>;
  suites?: PlaywrightReportSuite[];
}

function collectPlaywrightSpecs(
  suites: PlaywrightReportSuite[],
  out: PlaywrightSpecInfo[],
  parentFile?: string,
): void {
  for (const suite of suites) {
    const file = suite.file ?? parentFile ?? "";
    if (suite.specs) {
      for (const spec of suite.specs) {
        const allPassed = spec.tests.every((t) => t.status === "passed" || t.status === "expected");
        out.push({
          file,
          title: spec.title,
          status: allPassed ? "passed" : "failed",
        });
      }
    }
    if (suite.suites) {
      collectPlaywrightSpecs(suite.suites, out, file);
    }
  }
}

// ---------------------------------------------------------------------------
// writeReport — async, writes files to workspace
// ---------------------------------------------------------------------------

export async function writeReport(
  workspace: string,
  state: IterationState,
  finalResults: EvalResult[],
  evalSpec: EvalSpec,
): Promise<void> {
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

  // Try to parse Playwright report for coverage data
  let playwrightSpecs: PlaywrightSpecInfo[] | undefined;
  try {
    const reportPath = join(workspace, "app", "playwright-report", "results.json");
    const raw = await readFile(reportPath, "utf-8");
    const report = JSON.parse(raw) as { suites?: PlaywrightReportSuite[] };
    if (report.suites) {
      playwrightSpecs = [];
      collectPlaywrightSpecs(report.suites, playwrightSpecs);
    }
  } catch {
    // No playwright report available — coverage will show placeholders
  }

  // Write files
  const summary = generateSummary(state, finalResults, evalSpec, playwrightSpecs);

  await Promise.all([
    writeFile(join(reportDir, "summary.md"), summary, "utf-8"),
    writeFile(
      join(reportDir, "eval-results.json"),
      JSON.stringify(finalResults, null, 2),
      "utf-8",
    ),
    writeFile(
      join(metaDir, "iterations.json"),
      JSON.stringify(state, null, 2),
      "utf-8",
    ),
  ]);
}
