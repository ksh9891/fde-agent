import type { EvalSpec, IterationState } from "./types.js";
import type { BuilderInterface } from "./builder/interface.js";
import type { PipelineResult } from "./evaluator/pipeline.js";
interface MainLoopInput {
    evalSpec: EvalSpec;
    workspace: string;
    runId: string;
    builder: BuilderInterface;
    evalRunner: (workspace: string) => Promise<PipelineResult>;
    maxIterations: number;
    startIteration: number;
}
export declare function mainLoop(input: MainLoopInput): Promise<IterationState>;
export {};
