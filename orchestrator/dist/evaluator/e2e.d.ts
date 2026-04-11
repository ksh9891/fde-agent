import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare class E2EEvaluator implements Evaluator {
    readonly name: "e2e";
    run(workspace: string): Promise<EvalResult>;
}
