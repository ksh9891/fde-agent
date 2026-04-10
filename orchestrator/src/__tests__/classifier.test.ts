import { describe, it, expect } from "vitest";
import { classifyFailure } from "../classifier.js";
import type { EvalFailure } from "../types.js";

function makeFailure(message: string): EvalFailure {
  return { id: "TEST-001", message, evidence: [] };
}

describe("classifyFailure", () => {
  it('should classify missing env var as "env_issue"', () => {
    expect(classifyFailure(makeFailure("GOOGLE_MAPS_API_KEY is not defined"))).toBe("env_issue");
  });

  it('should classify missing API_KEY as "env_issue"', () => {
    expect(classifyFailure(makeFailure("Error: missing env variable API_KEY"))).toBe("env_issue");
  });

  it('should classify connection refused as "env_issue"', () => {
    expect(classifyFailure(makeFailure("connect ECONNREFUSED 127.0.0.1:5432"))).toBe("env_issue");
  });

  it('should classify TypeError as "repairable"', () => {
    expect(classifyFailure(makeFailure("TypeError: Cannot read properties of undefined"))).toBe("repairable");
  });

  it('should classify build error as "repairable"', () => {
    expect(classifyFailure(makeFailure("Module not found: Error: Can't resolve './Button'"))).toBe("repairable");
  });

  it('should classify test failure as "repairable"', () => {
    expect(classifyFailure(makeFailure("test failed: expected 3 but got 0"))).toBe("repairable");
  });

  it('should classify unknown errors as "unknown"', () => {
    expect(classifyFailure(makeFailure("something completely unexpected"))).toBe("unknown");
  });
});
