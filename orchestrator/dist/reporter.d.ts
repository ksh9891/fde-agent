import type { EvalResult, EvalSpec, IterationState } from "./types.js";
export declare function generateSummary(state: IterationState, finalResults: EvalResult[], evalSpec: EvalSpec): string;
export declare function writeReport(workspace: string, state: IterationState, finalResults: EvalResult[], evalSpec: EvalSpec): Promise<void>;
