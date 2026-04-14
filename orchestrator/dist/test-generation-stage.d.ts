import type { BuildResult } from "./types.js";
interface TestGenerationStageOptions {
    systemPromptPath: string;
}
interface TestGenerationInput {
    workspace: string;
    keyFlows: string[];
    entities: Array<{
        name: string;
        fields: string[];
    }>;
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
