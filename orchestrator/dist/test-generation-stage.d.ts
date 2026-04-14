import type { BuildResult } from "./types.js";
interface TestGenerationStageOptions {
    systemPromptPath: string;
}
interface RequirementInfo {
    id: string;
    title: string;
    severity: string;
    acceptance_criteria?: string[];
}
interface TestGenerationInput {
    workspace: string;
    keyFlows: string[];
    entities: Array<{
        name: string;
        slug: string;
        fields: string[];
    }>;
    requirements: RequirementInfo[];
}
export declare class TestGenerationStage {
    private readonly systemPromptPath;
    constructor({ systemPromptPath }: TestGenerationStageOptions);
    buildCommand(input: TestGenerationInput): {
        executable: string;
        args: string[];
        cwd: string;
    };
    execute(input: TestGenerationInput): Promise<BuildResult>;
}
export {};
