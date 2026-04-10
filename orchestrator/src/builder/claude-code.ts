import { execa } from "execa";
import yaml from "js-yaml";
import type { TaskContract, BuildResult } from "../types.js";
import type { BuilderInterface } from "./interface.js";

interface ClaudeCodeBuilderOptions {
  systemPromptPath: string;
}

export class ClaudeCodeBuilder implements BuilderInterface {
  private readonly systemPromptPath: string;

  constructor({ systemPromptPath }: ClaudeCodeBuilderOptions) {
    this.systemPromptPath = systemPromptPath;
  }

  buildCommand(taskContract: TaskContract): {
    executable: string;
    args: string[];
    cwd: string;
  } {
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

  async execute(taskContract: TaskContract): Promise<BuildResult> {
    const { executable, args, cwd } = this.buildCommand(taskContract);

    try {
      const result = await execa(executable, args, {
        cwd,
        timeout: 10 * 60 * 1000, // 10 minutes
      });

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: message,
      };
    }
  }
}
