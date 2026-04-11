import { readFile } from "fs/promises";
import yaml from "js-yaml";
import { EvalSpecSchema } from "./types.js";
export async function parseEvalSpec(filePath) {
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
//# sourceMappingURL=eval-spec-parser.js.map