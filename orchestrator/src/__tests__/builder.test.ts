import { describe, it, expect } from "vitest";
import { ClaudeCodeBuilder } from "../builder/claude-code.js";
import type { TaskContract } from "../types.js";

const sampleContract: TaskContract = {
  run_id: "run_001",
  preset: "admin-web",
  palette: "warm-neutral",
  iteration: 1,
  workspace: "/tmp/test-workspace",
  goal: "테스트",
  domain: { entities: [{ name: "고객", slug: "customers", fields: ["이름"] }], key_flows: ["조회"] },
  failing_checks: [],
  repair_hints: [],
  protected_files: [],
};

describe("ClaudeCodeBuilder.buildCommand", () => {
  const builder = new ClaudeCodeBuilder({
    systemPromptPath: "/path/to/system-prompt.md",
  });

  it("should construct correct CLI command with executable and core flags", () => {
    const { executable, args } = builder.buildCommand(sampleContract);
    expect(executable).toBe("claude");
    expect(args).toContain("-p");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  it("should include system prompt path in arguments", () => {
    const { args } = builder.buildCommand(sampleContract);
    expect(args).toContain("--system-prompt");
    const idx = args.indexOf("--system-prompt");
    expect(args[idx + 1]).toBe("/path/to/system-prompt.md");
  });

  it("should serialize task contract as the last argument containing run_id, preset, and entity names", () => {
    const { args } = builder.buildCommand(sampleContract);
    const lastArg = args[args.length - 1];
    expect(lastArg).toContain("run_001");
    expect(lastArg).toContain("admin-web");
    expect(lastArg).toContain("고객");
  });

  it("should set cwd to taskContract.workspace", () => {
    const { cwd } = builder.buildCommand(sampleContract);
    expect(cwd).toBe("/tmp/test-workspace");
  });
});
