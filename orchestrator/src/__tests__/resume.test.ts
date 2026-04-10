import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { loadIterationState } from "../resume.js";

// ---------------------------------------------------------------------------
// Test workspace
// ---------------------------------------------------------------------------

const TEST_WORKSPACE = "/tmp/fde-agent-test-resume";
const META_DIR = join(TEST_WORKSPACE, "meta");
const ITERATIONS_FILE = join(META_DIR, "iterations.json");

const validResumableState = {
  run_id: "run-test-001",
  total_iterations: 3,
  max_iterations: 10,
  status: "running" as const,
  resumable: true,
  history: [
    { iteration: 1, passed: ["REQ-001"], failed: ["REQ-002"], status: "partial" },
  ],
};

const validNonResumableState = {
  run_id: "run-test-002",
  total_iterations: 10,
  max_iterations: 10,
  status: "completed" as const,
  resumable: false,
  history: [
    { iteration: 10, passed: ["REQ-001", "REQ-002"], failed: [], status: "done" },
  ],
};

beforeEach(async () => {
  await mkdir(META_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_WORKSPACE, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadIterationState
// ---------------------------------------------------------------------------

describe("loadIterationState", () => {
  it("loads existing iteration state from {workspace}/meta/iterations.json", async () => {
    await writeFile(ITERATIONS_FILE, JSON.stringify(validResumableState), "utf-8");

    const state = await loadIterationState(TEST_WORKSPACE);

    expect(state.run_id).toBe("run-test-001");
    expect(state.total_iterations).toBe(3);
    expect(state.resumable).toBe(true);
  });

  it("throws if iterations.json does not exist", async () => {
    // META_DIR exists but no iterations.json inside it
    await expect(loadIterationState(TEST_WORKSPACE)).rejects.toThrow();
  });

  it("throws with 'not resumable' message if state.resumable is false", async () => {
    await writeFile(ITERATIONS_FILE, JSON.stringify(validNonResumableState), "utf-8");

    await expect(loadIterationState(TEST_WORKSPACE)).rejects.toThrow("not resumable");
  });
});
