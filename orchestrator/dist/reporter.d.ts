import type { EvalResult, EvalSpec, IterationState } from "./types.js";
export interface PlaywrightSpecInfo {
    file: string;
    title: string;
    status: string;
}
interface TemplateCoverageEntry {
    entity: string;
    list: string;
    detail: string;
    form: string;
}
interface FlowCoverageEntry {
    file: string;
    title: string;
    status: string;
    requirementIds: string[];
}
export interface CoverageData {
    templateCoverage: TemplateCoverageEntry[];
    flowCoverage: FlowCoverageEntry[];
}
export declare function buildCoverageFromSpecs(specs: PlaywrightSpecInfo[], evalSpec: EvalSpec): CoverageData;
export declare function generateSummary(state: IterationState, finalResults: EvalResult[], evalSpec: EvalSpec, playwrightSpecs?: PlaywrightSpecInfo[]): string;
export declare function writeReport(workspace: string, state: IterationState, finalResults: EvalResult[], evalSpec: EvalSpec): Promise<void>;
export {};
