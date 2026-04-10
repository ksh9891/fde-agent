import { describe, it, expect, afterEach } from "vitest";
import { rm, access } from "fs/promises";
import { join } from "path";
import { Provisioner } from "../provisioner.js";

const WORKSPACE_ROOT = "/tmp/fde-agent-test-provision";
const PRESETS_DIR = "/tmp/fde-agent-test-preset";
const PALETTES_DIR = "/tmp/fde-agent-test-palette";

afterEach(async () => {
  await rm(WORKSPACE_ROOT, { recursive: true, force: true });
});

describe("Provisioner.create", () => {
  const provisioner = new Provisioner({
    workspaceRoot: WORKSPACE_ROOT,
    presetsDir: PRESETS_DIR,
    palettesDir: PALETTES_DIR,
  });

  it("should create workspace directory with run_id and return its path", async () => {
    const runId = "run_abc123";
    const workspace = await provisioner.create({
      runId,
      preset: "admin-web",
      palette: "warm-neutral",
    });

    expect(workspace).toContain(runId);

    // Verify the directory actually exists
    await expect(access(workspace)).resolves.toBeUndefined();
  });

  it("should create meta directory inside the workspace", async () => {
    const runId = "run_def456";
    const workspace = await provisioner.create({
      runId,
      preset: "admin-web",
      palette: "warm-neutral",
    });

    const metaDir = join(workspace, "meta");
    await expect(access(metaDir)).resolves.toBeUndefined();
  });
});
