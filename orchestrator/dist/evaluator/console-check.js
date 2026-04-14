import { execa } from "execa";
import { chromium } from "playwright";
// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------
export const FATAL_PATTERNS = [
    /TypeError/,
    /ReferenceError/,
    /SyntaxError/,
    /Hydration/i,
    /Uncaught/,
    /Unhandled/,
];
const WARNING_PATTERNS = [
    /\[Warning\]/i,
    /\[warn\]/i,
    /deprecated/i,
];
// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------
export function classifyConsoleError(message) {
    if (WARNING_PATTERNS.some((re) => re.test(message)))
        return null;
    if (FATAL_PATTERNS.some((re) => re.test(message)))
        return "hard";
    return "soft";
}
// ---------------------------------------------------------------------------
// Server readiness helper
// ---------------------------------------------------------------------------
async function waitForServer(url, timeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok || res.status < 500)
                return;
        }
        catch {
            // server not ready yet
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("env_issue: Server failed to start");
}
// ---------------------------------------------------------------------------
// ConsoleCheckEvaluator
// ---------------------------------------------------------------------------
export class ConsoleCheckEvaluator {
    name = "console";
    entityPages;
    constructor(entityPages) {
        this.entityPages = entityPages;
    }
    async run(workspace) {
        const appDir = `${workspace}/app`;
        const baseUrl = "http://localhost:3000";
        // Spawn production server (non-blocking)
        let serverProcess;
        try {
            serverProcess = execa("npm", ["run", "start"], {
                cwd: appDir,
                reject: false,
            });
            // Wait for server readiness
            await waitForServer(baseUrl);
            // Collect console errors from pages
            const collectedErrors = [];
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
                // Pages to visit: /dashboard + each entity page
                const pageSlugs = ["dashboard", ...this.entityPages];
                for (const slug of pageSlugs) {
                    // Login flow for each page visit
                    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
                    await page.fill('input[type="email"], input[name="email"]', "admin@example.com");
                    await page.fill('input[type="password"], input[name="password"]', "password");
                    await page.click('button[type="submit"]');
                    await page.waitForURL("**/dashboard**", { timeout: 10_000 });
                    // Navigate to target page
                    if (slug !== "dashboard") {
                        await page.goto(`${baseUrl}/${slug}`, { waitUntil: "networkidle" });
                    }
                    // Give the page a moment to settle and fire any async errors
                    await page.waitForTimeout(1_000);
                }
                await context.close();
            }
            finally {
                await browser.close();
            }
            // Classify collected errors
            const failures = [];
            let hasHard = false;
            for (let i = 0; i < collectedErrors.length; i++) {
                const { page: pageUrl, message } = collectedErrors[i];
                const severity = classifyConsoleError(message);
                // Skip warnings (null classification)
                if (severity === null)
                    continue;
                if (severity === "hard")
                    hasHard = true;
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
        }
        finally {
            // Always kill the server
            if (serverProcess) {
                serverProcess.kill();
            }
        }
    }
}
//# sourceMappingURL=console-check.js.map