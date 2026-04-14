import { execa } from "execa";
import yaml from "js-yaml";
export class TestGenerationStage {
    systemPromptPath;
    constructor({ systemPromptPath }) {
        this.systemPromptPath = systemPromptPath;
    }
    buildCommand(input) {
        const contract = {
            task: "generate_e2e_tests",
            key_flows: input.keyFlows,
            entities: input.entities,
            requirements: input.requirements,
            output_dir: "e2e/flows",
            guidelines: [
                "Write one Playwright test file per key_flow in the output_dir",
                "Each file should test the actual user flow: navigate, interact, verify",
                "Use existing template tests in e2e/ as reference for style and login pattern",
                "Test file name format: {flow-slug}.spec.ts",
                "All UI text is in Korean",
                "Do NOT modify any existing files",
                "Each test.describe MUST include @{requirement_id} tag(s) matching the eval spec requirements",
                "Example: test.describe('신규 예약 등록 @FR-001', () => { ... })",
                "If a flow covers multiple requirements, include all tags: @FR-001 @FR-002",
            ],
        };
        const contractYaml = yaml.dump(contract);
        return {
            executable: "claude",
            args: [
                "-p",
                "--output-format",
                "json",
                "--system-prompt",
                this.systemPromptPath,
                contractYaml,
            ],
            cwd: input.workspace,
        };
    }
    async execute(input) {
        const { executable, args, cwd } = this.buildCommand(input);
        try {
            const result = await execa(executable, args, {
                cwd,
                timeout: 10 * 60 * 1000,
            });
            return { success: true, output: result.stdout };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, output: message };
        }
    }
}
//# sourceMappingURL=test-generation-stage.js.map