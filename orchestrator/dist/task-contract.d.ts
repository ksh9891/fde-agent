import type { EvalSpec, EvalResult, TaskContract } from "./types.js";
interface BuildTaskContractInput {
    evalSpec: EvalSpec;
    workspace: string;
    runId: string;
    iteration: number;
    failures: EvalResult[];
}
export declare function buildTaskContract(input: BuildTaskContractInput): TaskContract;
export {};
