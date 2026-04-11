import { execa } from "execa";
import yaml from "js-yaml";
export class ClaudeCodeBuilder {
    systemPromptPath;
    constructor({ systemPromptPath }) {
        this.systemPromptPath = systemPromptPath;
    }
    buildCommand(taskContract) {
        const contractYaml = yaml.dump(taskContract);
        const args = [
            "-p",
            "--output-format",
            "json",
            "--system-prompt",
            this.systemPromptPath,
            contractYaml,
        ];
        return {
            executable: "claude",
            args,
            cwd: taskContract.workspace,
        };
    }
    async execute(taskContract) {
        const { executable, args, cwd } = this.buildCommand(taskContract);
        try {
            const result = await execa(executable, args, {
                cwd,
                timeout: 20 * 60 * 1000, // 20 minutes
            });
            return {
                success: true,
                output: result.stdout,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                output: message,
            };
        }
    }
}
//# sourceMappingURL=claude-code.js.map