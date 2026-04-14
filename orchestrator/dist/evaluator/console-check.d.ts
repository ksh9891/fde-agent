import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";
export declare const FATAL_PATTERNS: RegExp[];
export declare function classifyConsoleError(message: string): "hard" | "soft" | null;
export declare class ConsoleCheckEvaluator implements Evaluator {
    readonly name: "console";
    private entityPages;
    constructor(entityPages: string[]);
    run(workspace: string): Promise<EvalResult>;
}
