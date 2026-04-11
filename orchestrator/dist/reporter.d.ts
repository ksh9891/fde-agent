import type { EvalResult, IterationState } from "./types.js";
export declare function generateSummary(state: IterationState, finalResults: EvalResult[], projectName: string): string;
export declare function writeReport(workspace: string, state: IterationState, finalResults: EvalResult[], projectName: string): Promise<void>;
