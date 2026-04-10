import { mkdir, cp } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

interface ProvisionerOptions {
  workspaceRoot: string;
  presetsDir: string;
  palettesDir: string;
}

interface ProvisionInput {
  runId: string;
  preset: string;
  palette: string;
}

export class Provisioner {
  private workspaceRoot: string;
  private presetsDir: string;
  private palettesDir: string;

  constructor(options: ProvisionerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.presetsDir = options.presetsDir;
    this.palettesDir = options.palettesDir;
  }

  async create(input: ProvisionInput): Promise<string> {
    const workspace = resolve(join(this.workspaceRoot, input.runId));

    // Create workspace + meta
    await mkdir(workspace, { recursive: true });
    await mkdir(join(workspace, "meta"), { recursive: true });

    // Copy preset scaffold if exists
    const presetDir = join(this.presetsDir, input.preset, "core", "scaffold");
    if (existsSync(presetDir)) {
      await cp(presetDir, join(workspace, "app"), { recursive: true });
    } else {
      await mkdir(join(workspace, "app"), { recursive: true });
    }

    // Copy palette if exists
    const palettePath = join(this.palettesDir, `${input.palette}.json`);
    if (existsSync(palettePath)) {
      await cp(palettePath, join(workspace, "app", "design-tokens.json"));
    }

    // Copy preset rules if exists
    const rulesDir = join(this.presetsDir, input.preset, "rules");
    if (existsSync(rulesDir)) {
      await cp(rulesDir, join(workspace, "app"), { recursive: true });
    }

    return workspace;
  }
}
