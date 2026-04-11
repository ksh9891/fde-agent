import type { TaskContract, BuildResult } from "../types.js";
import type { BuilderInterface } from "./interface.js";
interface ClaudeCodeBuilderOptions {
    systemPromptPath: string;
}
export declare class ClaudeCodeBuilder implements BuilderInterface {
    private readonly systemPromptPath;
    constructor({ systemPromptPath }: ClaudeCodeBuilderOptions);
    buildCommand(taskContract: TaskContract): {
        executable: string;
        args: string[];
        cwd: string;
    };
    execute(taskContract: TaskContract): Promise<BuildResult>;
}
export {};
