import { describe, it, expect, afterEach } from "vitest";
import { writeFile, unlink } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseEvalSpec } from "../eval-spec-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PATH = join(__dirname, "fixtures", "sample-eval-spec.yaml");

describe("parseEvalSpec", () => {
  it("parses a valid YAML eval spec file and returns the correct data", async () => {
    const spec = await parseEvalSpec(FIXTURE_PATH);

    expect(spec.project).toBe("resort-admin-prototype");
    expect(spec.preset).toBe("admin-web");
    expect(spec.palette).toBe("warm-neutral");
    expect(spec.domain.entities).toHaveLength(2);
    expect(spec.requirements).toHaveLength(3);
    expect(spec.data_source.type).toBe("mock");
  });

  it("parses external_secrets correctly", async () => {
    const spec = await parseEvalSpec(FIXTURE_PATH);

    expect(spec.external_secrets).toBeDefined();
    expect(spec.external_secrets).toHaveLength(1);
    expect(spec.external_secrets![0].name).toBe("GOOGLE_MAPS_API_KEY");
    expect(spec.external_secrets![0].description).toBe("지도 표시");
    expect(spec.external_secrets![0].required).toBe(false);
  });

  it("throws when the file does not exist", async () => {
    await expect(
      parseEvalSpec("/nonexistent/path/to/spec.yaml")
    ).rejects.toThrow();
  });

  describe("throws on invalid spec structure", () => {
    const TEMP_PATH = join(__dirname, "fixtures", "_temp-invalid-spec.yaml");

    afterEach(async () => {
      try {
        await unlink(TEMP_PATH);
      } catch {
        // ignore if already deleted
      }
    });

    it("rejects a spec that is missing required fields", async () => {
      await writeFile(TEMP_PATH, "project: test\n", "utf-8");

      await expect(parseEvalSpec(TEMP_PATH)).rejects.toThrow(
        "Invalid eval spec:"
      );
    });
  });
});
