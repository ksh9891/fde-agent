import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare class PageCheckEvaluator implements Evaluator {
    readonly name: "e2e";
    private requiredPages;
    constructor(requiredPages: string[]);
    run(workspace: string): Promise<EvalResult>;
}
