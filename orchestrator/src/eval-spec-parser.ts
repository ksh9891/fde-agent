import { readFile } from "fs/promises";
import yaml from "js-yaml";
import { EvalSpecSchema, type EvalSpec } from "./types.js";

export async function parseEvalSpec(filePath: string): Promise<EvalSpec> {
  const content = await readFile(filePath, "utf-8");
  const raw = yaml.load(content);
  const result = EvalSpecSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid eval spec:\n${errors}`);
  }

  return result.data;
}
