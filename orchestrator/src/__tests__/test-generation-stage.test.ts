import { describe, it, expect } from "vitest";
import { TestGenerationStage } from "../test-generation-stage.js";

describe("TestGenerationStage", () => {
  it("should build command with test-writer system prompt and key_flows", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 목록 조회", "신규 예약 등록"],
      entities: [{ name: "예약", slug: "reservations", fields: ["예약번호", "고객명"] }],
      requirements: [],
    });

    expect(command.executable).toBe("claude");
    expect(command.args).toContain("-p");
    expect(command.args).toContain("--system-prompt");
    expect(command.args).toContain("/plugin/agents/test-writer.md");
    expect(command.cwd).toBe("/workspace/app");
    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("예약 목록 조회");
    expect(contractArg).toContain("신규 예약 등록");
  });

  it("should include entity info in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 등록"],
      entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],
      requirements: [],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("예약");
    expect(contractArg).toContain("예약번호");
  });

  it("should include requirements in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["신규 예약 등록"],
      entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],
      requirements: [
        { id: "FR-001", title: "신규 예약 등록", severity: "hard" },
      ],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("FR-001");
    expect(contractArg).toContain("신규 예약 등록");
    expect(contractArg).toContain("hard");
  });

  it("should include tag guideline in the contract", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["예약 등록"],
      entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],
      requirements: [],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("@{requirement_id}");
  });
});
