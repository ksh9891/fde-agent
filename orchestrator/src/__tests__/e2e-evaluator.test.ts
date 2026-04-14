import { describe, it, expect } from "vitest";
import { mapFailureSeverity } from "../evaluator/e2e.js";

const requirements = [
  { id: "FR-001", title: "신규 예약 등록", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  { id: "FR-002", title: "예약 목록 조회", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  { id: "NFR-003", title: "대시보드 표시", severity: "soft" as const, test_method: "e2e" as const, description: "" },
];

describe("mapFailureSeverity", () => {
  it("returns hard when spec title matches a hard requirement", () => {
    expect(mapFailureSeverity("신규 예약 등록", requirements)).toBe("hard");
  });

  it("returns soft when spec title matches a soft requirement", () => {
    expect(mapFailureSeverity("대시보드 표시", requirements)).toBe("soft");
  });

  it("returns soft for template tests (no matching requirement)", () => {
    expect(mapFailureSeverity("객실 목록 조회 > 검색 기능 동작", requirements)).toBe("soft");
  });

  it("returns soft for unknown test titles", () => {
    expect(mapFailureSeverity("unknown test title", requirements)).toBe("soft");
  });

  it("matches partial title (requirement title is substring of spec title)", () => {
    expect(mapFailureSeverity("예약 목록 조회 > 페이지네이션 동작", requirements)).toBe("hard");
  });
});
