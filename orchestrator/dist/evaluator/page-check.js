import { existsSync } from "fs";
import { join } from "path";
export class PageCheckEvaluator {
    name = "e2e"; // Uses e2e slot since it replaces Playwright E2E for MVP
    requiredPages;
    constructor(requiredPages) {
        this.requiredPages = requiredPages;
    }
    async run(workspace) {
        const appDir = `${workspace}/app`;
        const adminDir = join(appDir, "src", "app", "(admin)");
        const failures = [];
        // Check that admin directory exists
        if (!existsSync(adminDir)) {
            return {
                evaluator: "e2e",
                status: "fail",
                severity: "hard",
                failures: [
                    {
                        id: "no_admin_dir",
                        message: "Admin directory (admin) does not exist",
                        evidence: [`Expected: ${adminDir}`],
                        repair_hint: "Create pages under src/app/(admin)/ for each entity in the domain",
                    },
                ],
            };
        }
        // Check each required page directory exists
        for (const page of this.requiredPages) {
            const pagePath = join(adminDir, page);
            if (!existsSync(pagePath)) {
                failures.push({
                    id: `missing_page_${page}`,
                    message: `Required page directory missing: ${page}`,
                    evidence: [`Expected directory: ${pagePath}`],
                    repair_hint: `Create the page at src/app/(admin)/${page}/page.tsx based on the domain entity`,
                });
            }
            else {
                // Check page.tsx exists inside the directory
                const pageFile = join(pagePath, "page.tsx");
                if (!existsSync(pageFile)) {
                    failures.push({
                        id: `missing_page_file_${page}`,
                        message: `Page file missing: ${page}/page.tsx`,
                        evidence: [`Expected file: ${pageFile}`],
                        repair_hint: `Create page.tsx in src/app/(admin)/${page}/`,
                    });
                }
            }
        }
        if (failures.length === 0) {
            return {
                evaluator: "e2e",
                status: "pass",
                severity: "hard",
                failures: [],
            };
        }
        return {
            evaluator: "e2e",
            status: "fail",
            severity: "hard",
            failures,
        };
    }
}
//# sourceMappingURL=page-check.js.map