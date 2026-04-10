import type { TaskContract, BuildResult } from "../types.js";

export interface BuilderInterface {
  execute(taskContract: TaskContract): Promise<BuildResult>;
}
