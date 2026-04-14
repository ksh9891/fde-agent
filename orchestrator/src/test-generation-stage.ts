import { execa } from "execa";
import yaml from "js-yaml";
import type { BuildResult } from "./types.js";

interface TestGenerationStageOptions {
  systemPromptPath: string;
}

interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; fields: string[] }>;
}

interface TestGenerationContract {
  task: "generate_e2e_tests";
  key_flows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  output_dir: string;
  guidelines: string[];
}

export class TestGenerationStage {
  private readonly systemPromptPath: string;

  constructor({ systemPromptPath }: TestGenerationStageOptions) {
    this.systemPromptPath = systemPromptPath;
  }

  buildCommand(input: TestGenerationInput): {
    executable: string;
    args: string[];
    cwd: string;
  } {
    const contract: TestGenerationContract = {
      task: "generate_e2e_tests",
      key_flows: input.keyFlows,
      entities: input.entities,
      output_dir: "e2e/flows",
      guidelines: [
        "Write one Playwright test file per key_flow in the output_dir",
        "Each file should test the actual user flow: navigate, interact, verify",
        "Use existing template tests in e2e/ as reference for style and login pattern",
        "Test file name format: {flow-slug}.spec.ts",
        "All UI text is in Korean",
        "Do NOT modify any existing files",
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

  async execute(input: TestGenerationInput): Promise<BuildResult> {
    const { executable, args, cwd } = this.buildCommand(input);
    try {
      const result = await execa(executable, args, {
        cwd,
        timeout: 10 * 60 * 1000,
      });
      return { success: true, output: result.stdout };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, output: message };
    }
  }
}
