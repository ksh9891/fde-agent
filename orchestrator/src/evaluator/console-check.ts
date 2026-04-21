import { execa, type ResultPromise } from "execa";
import { chromium } from "playwright";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

export const FATAL_PATTERNS: RegExp[] = [
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /Hydration/i,
  /Uncaught/,
  /Unhandled/,
];

const WARNING_PATTERNS: RegExp[] = [
  /\[Warning\]/i,
  /\[warn\]/i,
  /deprecated/i,
];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export function classifyConsoleError(message: string): "hard" | "soft" | null {
  if (WARNING_PATTERNS.some((re) => re.test(message))) return null;
  if (FATAL_PATTERNS.some((re) => re.test(message))) return "hard";
  return "soft";
}

// ---------------------------------------------------------------------------
// Login config (preset-driven)
// ---------------------------------------------------------------------------

export interface ConsoleLoginConfig {
  url: string;
  username_selector: string;
  password_selector: string;
  username_value: string;
  password_value: string;
  submit_selector: string;
  expected_url_pattern: string;
}

// ---------------------------------------------------------------------------
// Server readiness helper
// ---------------------------------------------------------------------------

async function waitForServer(
  url: string,
  timeoutMs: number = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("env_issue: Server failed to start");
}

// ---------------------------------------------------------------------------
// ConsoleCheckEvaluator
// ---------------------------------------------------------------------------

export class ConsoleCheckEvaluator implements Evaluator {
  readonly name = "console" as const;
  private pagePaths: string[];
  private loginConfig?: ConsoleLoginConfig;

  constructor(pagePaths: string[], loginConfig?: ConsoleLoginConfig) {
    this.pagePaths = pagePaths;
    this.loginConfig = loginConfig;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    const baseUrl = "http://localhost:3000";

    // Spawn production server (non-blocking)
    let serverProcess: ResultPromise | undefined;

    try {
      serverProcess = execa("npm", ["run", "start"], {
        cwd: appDir,
        reject: false,
      });

      // Wait for server readiness
      await waitForServer(baseUrl);

      // Collect console errors from pages
      const collectedErrors: Array<{ page: string; message: string }> = [];

      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Listen for console errors and page errors
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            collectedErrors.push({
              page: page.url(),
              message: msg.text(),
            });
          }
        });
        page.on("pageerror", (err) => {
          collectedErrors.push({
            page: page.url(),
            message: err.message,
          });
        });

        for (const path of this.pagePaths) {
          // Optional login flow (admin-web needs it; booking-web does not)
          if (this.loginConfig) {
            await page.goto(`${baseUrl}${this.loginConfig.url}`, {
              waitUntil: "networkidle",
            });
            await page.fill(
              this.loginConfig.username_selector,
              this.loginConfig.username_value,
            );
            await page.fill(
              this.loginConfig.password_selector,
              this.loginConfig.password_value,
            );
            await page.click(this.loginConfig.submit_selector);
            await page.waitForURL(this.loginConfig.expected_url_pattern, {
              timeout: 10_000,
            });
          }

          // Navigate to target page
          await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });

          // Give the page a moment to settle and fire any async errors
          await page.waitForTimeout(1_000);
        }

        await context.close();
      } finally {
        await browser.close();
      }

      // Classify collected errors
      const failures: EvalFailure[] = [];
      let hasHard = false;

      for (let i = 0; i < collectedErrors.length; i++) {
        const { page: pageUrl, message } = collectedErrors[i];
        const severity = classifyConsoleError(message);

        // Skip warnings (null classification)
        if (severity === null) continue;

        if (severity === "hard") hasHard = true;

        failures.push({
          id: `console_error_${i + 1}`,
          message: `Console error on ${pageUrl}`,
          severity,
          evidence: [message],
          repair_hint: severity === "hard"
            ? "Fix runtime error in browser console"
            : "Check browser console for non-critical errors",
        });
      }

      if (failures.length === 0) {
        return {
          evaluator: "console",
          status: "pass",
          severity: "soft",
          failures: [],
        };
      }

      return {
        evaluator: "console",
        status: "fail",
        severity: hasHard ? "hard" : "soft",
        failures,
      };
    } finally {
      // Always kill the server
      if (serverProcess) {
        serverProcess.kill();
      }
    }
  }
}
