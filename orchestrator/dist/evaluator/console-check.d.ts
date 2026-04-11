import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare class ConsoleCheckEvaluator implements Evaluator {
    readonly name: "console";
    run(workspace: string): Promise<EvalResult>;
}
