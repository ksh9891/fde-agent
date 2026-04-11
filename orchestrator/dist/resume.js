import { readFile } from "fs/promises";
import { join } from "path";
import { IterationStateSchema } from "./types.js";
export async function loadIterationState(workspace) {
    const filePath = join(workspace, "meta", "iterations.json");
    const content = await readFile(filePath, "utf-8");
    const raw = JSON.parse(content);
    const state = IterationStateSchema.parse(raw);
    if (!state.resumable) {
        throw new Error(`Run ${state.run_id} is not resumable (status: ${state.status})`);
    }
    return state;
}
//# sourceMappingURL=resume.js.map