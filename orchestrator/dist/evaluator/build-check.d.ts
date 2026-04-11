import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare class BuildCheckEvaluator implements Evaluator {
    readonly name: "build";
    run(workspace: string): Promise<EvalResult>;
}
