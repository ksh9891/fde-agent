import { existsSync } from "fs";
import { join } from "path";
import { readdir } from "fs/promises";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class PageCheckEvaluator implements Evaluator {
  readonly name = "page_check" as const;

  private requiredPages: string[];

  constructor(requiredPages: string[]) {
    this.requiredPages = requiredPages;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    const adminDir = join(appDir, "src", "app", "(admin)");
    const failures: EvalFailure[] = [];

    // Check that admin directory exists
    if (!existsSync(adminDir)) {
      return {
        evaluator: "page_check",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "no_admin_dir",
            message: "Admin directory (admin) does not exist",
            evidence: [`Expected: ${adminDir}`],
            repair_hint:
              "Create pages under src/app/(admin)/ for each entity in the domain",
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
      } else {
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
        evaluator: "page_check",
        status: "pass",
        severity: "hard",
        failures: [],
      };
    }

    return {
      evaluator: "page_check",
      status: "fail",
      severity: "hard",
      failures,
    };
  }
}
