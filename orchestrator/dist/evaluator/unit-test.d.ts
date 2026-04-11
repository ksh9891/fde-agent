import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare class UnitTestEvaluator implements Evaluator {
    readonly name: "unit_test";
    run(workspace: string): Promise<EvalResult>;
}
