import { describe, it, expect, afterEach } from "vitest";
import { rm, access, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { Provisioner } from "../provisioner.js";

const WORKSPACE_ROOT = "/tmp/fde-agent-test-provision";
const PRESETS_DIR = "/tmp/fde-agent-test-preset";
const PALETTES_DIR = "/tmp/fde-agent-test-palette";

afterEach(async () => {
  await rm(WORKSPACE_ROOT, { recursive: true, force: true });
  await rm(PRESETS_DIR, { recursive: true, force: true });
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

  // 주의: package.json을 scaffold에 두면 Provisioner가 npm install + playwright install을 트리거해
  // 테스트가 수 분 걸리고 네트워크 의존. 여기서는 빈 scaffold 디렉토리만 만들어 그 경로를 회피한다.

  it("should skip entity skeleton generation when preset.json sets skeleton_generation=none", async () => {
    const runId = "run_skeleton_none";
    const presetName = "noop-preset";
    const presetCoreDir = join(PRESETS_DIR, presetName, "core");
    const scaffoldDir = join(presetCoreDir, "scaffold");
    await mkdir(scaffoldDir, { recursive: true });
    await writeFile(
      join(presetCoreDir, "preset.json"),
      JSON.stringify({ skeleton_generation: "none" })
    );

    const workspace = await provisioner.create({
      runId,
      preset: presetName,
      palette: "warm-neutral",
      entities: [{ name: "객실", slug: "rooms", fields: ["code", "name"] }],
    });

    // Provisioner가 (admin) 경로를 만들면 안 됨
    const adminPath = join(workspace, "app", "src", "app", "(admin)", "rooms");
    await expect(access(adminPath)).rejects.toThrow();
  });

  it("should keep admin-web skeleton generation when preset.json sets skeleton_generation=admin-web", async () => {
    const runId = "run_skeleton_admin";
    const presetName = "fake-admin";
    const presetCoreDir = join(PRESETS_DIR, presetName, "core");
    const scaffoldDir = join(presetCoreDir, "scaffold");
    await mkdir(scaffoldDir, { recursive: true });
    await writeFile(
      join(presetCoreDir, "preset.json"),
      JSON.stringify({ skeleton_generation: "admin-web" })
    );

    const workspace = await provisioner.create({
      runId,
      preset: presetName,
      palette: "warm-neutral",
      entities: [{ name: "객실", slug: "rooms", fields: ["code"] }],
    });

    const listPage = join(workspace, "app", "src", "app", "(admin)", "rooms", "page.tsx");
    await expect(access(listPage)).resolves.toBeUndefined();
  });

  it("should copy templates without entity placeholders as single spec files", async () => {
    const runId = "run_flow_templates";
    const presetName = "flow-preset";
    const presetCoreDir = join(PRESETS_DIR, presetName, "core");
    const scaffoldDir = join(presetCoreDir, "scaffold");
    const testPackDir = join(PRESETS_DIR, presetName, "test-pack", "scenarios");
    await mkdir(scaffoldDir, { recursive: true });
    await mkdir(testPackDir, { recursive: true });
    // package.json 없음 (위 주의사항 참조)
    await writeFile(
      join(presetCoreDir, "preset.json"),
      JSON.stringify({ skeleton_generation: "none" })
    );
    // Flow template (no entity placeholder)
    await writeFile(
      join(testPackDir, "auth-gate.template.ts"),
      `import { test } from '@playwright/test';\ntest('auth gate', async ({ page }) => {\n  await page.goto('/my/reservations');\n});\n`
    );
    // Entity-placeholder template
    await writeFile(
      join(testPackDir, "catalog-list.template.ts"),
      `const ENTITY_NAME = '__ENTITY_NAME__';\nconst ENTITY_PATH = '__ENTITY_PATH__';\n`
    );

    const workspace = await provisioner.create({
      runId,
      preset: presetName,
      palette: "warm-neutral",
      entities: [{ name: "객실", slug: "rooms", fields: ["code"] }],
    });

    // Flow template copied as-is
    const authGate = join(workspace, "app", "e2e", "auth-gate.spec.ts");
    await expect(access(authGate)).resolves.toBeUndefined();

    // Entity template copied per-entity with placeholders substituted
    const roomsList = join(workspace, "app", "e2e", "rooms-catalog-list.spec.ts");
    await expect(access(roomsList)).resolves.toBeUndefined();
    const content = await readFile(roomsList, "utf-8");
    expect(content).toContain("'객실'");
    expect(content).toContain("'/rooms'");
  });
});
