import { describe, it, expect } from "vitest";
import { mapFailureSeverity, collectAllSpecs } from "../evaluator/e2e.js";
import type { EvalFailure } from "../types.js";

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

  it("returns hard when spec title contains @tag matching hard requirement", () => {
    expect(mapFailureSeverity("신규 예약 등록 @FR-001", requirements)).toBe("hard");
  });

  it("returns soft when spec title contains @tag matching soft requirement", () => {
    expect(mapFailureSeverity("대시보드 표시 @NFR-003", requirements)).toBe("soft");
  });

  it("returns soft when @tag is present but matches no requirement", () => {
    expect(mapFailureSeverity("어떤 테스트 @UNKNOWN-999", requirements)).toBe("soft");
  });

  it("returns hard when any @tag matches hard requirement (multiple tags)", () => {
    expect(mapFailureSeverity("복합 플로우 @NFR-003 @FR-001", requirements)).toBe("hard");
  });

  it("prefers tag matching over title substring matching", () => {
    expect(mapFailureSeverity("대시보드 표시 @FR-001", requirements)).toBe("hard");
  });

  it("falls back to title matching when no @tag present", () => {
    expect(mapFailureSeverity("신규 예약 등록", requirements)).toBe("hard");
  });
});

describe("collectAllSpecs", () => {
  const requirements = [
    { id: "FR-001", title: "신규 예약 등록", severity: "hard" as const, test_method: "e2e" as const, description: "" },
  ];

  it("counts all specs including passed, failed, and skipped", () => {
    const suites = [{
      specs: [
        { title: "test 1", status: "passed" },
        { title: "test 2", status: "failed", error: { message: "oops" } },
        { title: "test 3", status: "skipped" },
      ],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(failures).toHaveLength(1);
  });

  it("recurses into nested suites", () => {
    const suites = [{
      suites: [{
        specs: [
          { title: "nested pass", status: "passed" },
          { title: "nested fail", status: "timedOut" },
        ],
      }],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(stats.total).toBe(2);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it("maps severity from requirements for failed specs", () => {
    const suites = [{
      specs: [
        { title: "신규 예약 등록 flow", status: "failed", error: { message: "err" } },
      ],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(failures[0].severity).toBe("hard");
  });
});
