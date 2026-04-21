import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type { EvalResult, EvalFailure } from "../types.js";
import type { Evaluator } from "./pipeline.js";

/**
 * Check whether the given URL path resolves to a page file in the Next.js App Router.
 *
 * Next.js App Router supports route groups like `(admin)` or `(public)` that do not
 * appear in the URL. We therefore search for `page.tsx` (or `.ts`/`.jsx`/`.js`)
 * under any descendant that matches the path segments, allowing intermediate
 * directories whose name starts with `(` and ends with `)`.
 */
function findPageFile(appSrcDir: string, urlPath: string): string | null {
  // Normalize: "/" → "", "/dashboard" → "dashboard", "/foo/bar" → "foo/bar"
  const trimmed = urlPath.replace(/^\/+|\/+$/g, "");
  const segments = trimmed === "" ? [] : trimmed.split("/");

  return searchForPage(appSrcDir, segments);
}

function searchForPage(dir: string, segments: string[]): string | null {
  if (!existsSync(dir)) return null;

  if (segments.length === 0) {
    // We're at the target directory — look for page.tsx/ts/jsx/js
    for (const ext of ["tsx", "ts", "jsx", "js"]) {
      const pageFile = join(dir, `page.${ext}`);
      if (existsSync(pageFile)) return pageFile;
    }
    // Also try descending into route groups (directories matching `(name)`)
    return searchRouteGroups(dir, segments);
  }

  // Try direct match first
  const direct = join(dir, segments[0]);
  if (existsSync(direct)) {
    const result = searchForPage(direct, segments.slice(1));
    if (result) return result;
  }

  // Try descending through route groups
  return searchRouteGroups(dir, segments);
}

function searchRouteGroups(dir: string, segments: string[]): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.startsWith("(") && entry.endsWith(")")) {
      const nested = join(dir, entry);
      const result = searchForPage(nested, segments);
      if (result) return result;
    }
  }
  return null;
}

export class PageCheckEvaluator implements Evaluator {
  readonly name = "page_check" as const;

  private requiredPages: string[];

  constructor(requiredPages: string[]) {
    this.requiredPages = requiredPages;
  }

  async run(workspace: string): Promise<EvalResult> {
    const appDir = `${workspace}/app`;
    const appSrcDir = join(appDir, "src", "app");
    const failures: EvalFailure[] = [];

    if (!existsSync(appSrcDir)) {
      return {
        evaluator: "page_check",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "no_app_dir",
            message: "Next.js app directory does not exist",
            evidence: [`Expected: ${appSrcDir}`],
            repair_hint: "Create src/app/ directory with Next.js App Router pages",
          },
        ],
      };
    }

    for (const page of this.requiredPages) {
      const pageFile = findPageFile(appSrcDir, page);
      if (!pageFile) {
        const slug = page.replace(/^\/+|\/+$/g, "") || "root";
        failures.push({
          id: `missing_page_${slug}`,
          message: `Required page missing for path: ${page}`,
          evidence: [`Searched under: ${appSrcDir}`],
          repair_hint: `Create page.tsx for route "${page}" per the preset's CLAUDE.md (route group may apply, e.g. src/app/(group)${page}/page.tsx)`,
        });
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
