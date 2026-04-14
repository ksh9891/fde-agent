import type { EvalResult, EvalFailure, Requirement } from "../types.js";
import type { Evaluator } from "./pipeline.js";
interface PlaywrightTestResult {
    title: string;
    status?: string;
    error?: {
        message?: string;
    };
}
interface PlaywrightSuite {
    title?: string;
    specs?: PlaywrightTestResult[];
    suites?: PlaywrightSuite[];
}
export interface SpecStats {
    total: number;
    passed: number;
    failed: number;
}
export declare function mapFailureSeverity(specTitle: string, requirements: Requirement[]): "hard" | "soft";
export declare function collectAllSpecs(suites: PlaywrightSuite[], failures: EvalFailure[], stats: SpecStats, requirements: Requirement[]): void;
export declare class E2EEvaluator implements Evaluator {
    readonly name: "e2e";
    private requirements;
    constructor(requirements: Requirement[]);
    run(workspace: string): Promise<EvalResult>;
}
export {};
