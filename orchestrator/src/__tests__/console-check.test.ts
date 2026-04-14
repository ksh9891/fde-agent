import { describe, it, expect } from "vitest";
import { classifyConsoleError, FATAL_PATTERNS } from "../evaluator/console-check.js";

describe("classifyConsoleError", () => {
  it("classifies TypeError as hard", () => {
    expect(classifyConsoleError("Uncaught TypeError: Cannot read properties of undefined")).toBe("hard");
  });

  it("classifies ReferenceError as hard", () => {
    expect(classifyConsoleError("ReferenceError: foo is not defined")).toBe("hard");
  });

  it("classifies hydration error as hard", () => {
    expect(classifyConsoleError("Hydration failed because the initial UI does not match")).toBe("hard");
  });

  it("classifies uncaught exception as hard", () => {
    expect(classifyConsoleError("Uncaught (in promise) Error: network failure")).toBe("hard");
  });

  it("classifies generic console error as soft", () => {
    expect(classifyConsoleError("Failed to load resource: net::ERR_FAILED")).toBe("soft");
  });

  it("classifies warning as null (ignored)", () => {
    expect(classifyConsoleError("[Warning] Some deprecation notice")).toBeNull();
  });
});

describe("FATAL_PATTERNS", () => {
  it("should include all required patterns", () => {
    const patternStrings = FATAL_PATTERNS.map(p => p.source);
    expect(patternStrings).toContain("TypeError");
    expect(patternStrings).toContain("ReferenceError");
  });
});
