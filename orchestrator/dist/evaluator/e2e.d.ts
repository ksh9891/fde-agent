import type { EvalResult, Requirement } from "../types.js";
import type { Evaluator } from "./pipeline.js";
/**
 * Map a Playwright spec title to the severity of the matching eval-spec requirement.
 * Only requirements with `test_method === "e2e"` are considered.
 * If the requirement title is a substring of the spec title, it matches.
 * Default: "soft" (template / unknown tests).
 */
export declare function mapFailureSeverity(specTitle: string, requirements: Requirement[]): "hard" | "soft";
export declare class E2EEvaluator implements Evaluator {
    readonly name: "e2e";
    private requirements;
    constructor(requirements: Requirement[]);
    run(workspace: string): Promise<EvalResult>;
}
