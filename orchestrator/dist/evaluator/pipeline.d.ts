import type { EvalResult } from "../types.js";
export interface Evaluator {
    name: "build" | "unit_test" | "console" | "e2e";
    run(workspace: string): Promise<EvalResult>;
}
export interface PipelineResult {
    allHardConstraintsPassed: boolean;
    results: EvalResult[];
    failures: EvalResult[];
}
export declare class EvalPipeline {
    private evaluators;
    constructor(evaluators: Evaluator[]);
    runAll(workspace: string): Promise<PipelineResult>;
}
