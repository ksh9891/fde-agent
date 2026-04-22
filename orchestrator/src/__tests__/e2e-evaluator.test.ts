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

  it("falls back to acceptance_criteria phrase match when neither tag nor title matches", () => {
    const reqsWithAC = [
      {
        id: "BR-005",
        title: "회원가입 폼 검증",
        severity: "hard" as const,
        test_method: "e2e" as const,
        description: "",
        acceptance_criteria: [
          "비밀번호가 8자 미만이거나 영문+숫자 조합이 아니면 저장되지 않는다",
        ],
      },
    ];
    // Spec title lacks @BR-005 tag and doesn't contain requirement title, but
    // shares multiple 3+char phrases with the AC text ("비밀번호가", "미만", "저장되지", "않는다").
    expect(
      mapFailureSeverity(
        "비밀번호가 8자 미만이면 저장되지 않는다",
        reqsWithAC,
      ),
    ).toBe("hard");
  });

  it("prefers hard requirement on AC score tie", () => {
    const reqsWithAC = [
      {
        id: "SOFT-1",
        title: "soft req",
        severity: "soft" as const,
        test_method: "e2e" as const,
        description: "",
        acceptance_criteria: ["재고가 0인 객실은 예약이 거부된다"],
      },
      {
        id: "HARD-1",
        title: "hard req",
        severity: "hard" as const,
        test_method: "e2e" as const,
        description: "",
        acceptance_criteria: ["재고가 0인 객실은 예약이 거부된다"],
      },
    ];
    expect(
      mapFailureSeverity(
        "재고 0인 객실은 예약이 거부된다",
        reqsWithAC,
      ),
    ).toBe("hard");
  });

  it("does not match when AC shares fewer than two significant phrases", () => {
    const reqsWithAC = [
      {
        id: "X-1",
        title: "완전히 다른 제목",
        severity: "hard" as const,
        test_method: "e2e" as const,
        description: "",
        acceptance_criteria: ["객실 정보를 볼 수 있다"],
      },
    ];
    expect(mapFailureSeverity("로그아웃이 동작한다", reqsWithAC)).toBe("soft");
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

  // Builds a Playwright spec node matching the real reporter JSON shape,
  // where spec-level `status` is absent and the result lives under
  // spec.tests[].results[].status.
  const spec = (
    title: string,
    resultStatus: string,
    errMsg?: string,
  ) => ({
    title,
    ok: resultStatus === "passed",
    tests: [
      {
        results: [
          {
            status: resultStatus,
            errors: errMsg ? [{ message: errMsg }] : [],
          },
        ],
      },
    ],
  });

  it("counts all specs including passed, failed, and skipped", () => {
    const suites = [{
      specs: [
        spec("test 1", "passed"),
        spec("test 2", "failed", "oops"),
        spec("test 3", "skipped"),
      ],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].evidence).toEqual(["oops"]);
  });

  it("recurses into nested suites", () => {
    const suites = [{
      suites: [{
        specs: [
          spec("nested pass", "passed"),
          spec("nested fail", "timedOut", "timed out"),
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
      specs: [spec("신규 예약 등록 flow", "failed", "err")],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(failures[0].severity).toBe("hard");
  });

  it("counts every result across multiple projects for one spec", () => {
    const multiProjectSpec = {
      title: "multi-project spec",
      ok: false,
      tests: [
        { results: [{ status: "passed", errors: [] }] },
        { results: [{ status: "failed", errors: [{ message: "chromium failed" }] }] },
      ],
    };
    const suites = [{ specs: [multiProjectSpec] }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(stats.total).toBe(2);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it("skips specs whose tests array is empty (not reported)", () => {
    const suites = [{ specs: [{ title: "unreported", tests: [] }] }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(stats.total).toBe(0);
  });

  it("inherits severity from tags on a parent describe() block", () => {
    const suites = [{
      title: "flows/signup.spec.ts",
      suites: [{
        title: "회원가입 플로우 @FR-001",
        specs: [spec("비밀번호가 8자 미만이면 저장되지 않는다", "failed", "err")],
      }],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(failures[0].severity).toBe("hard");
  });

  it("keeps severity soft when no parent tag matches a hard requirement", () => {
    const suites = [{
      title: "flows/misc.spec.ts",
      suites: [{
        title: "기타 플로우 @UNKNOWN-999",
        specs: [spec("이름 없는 시나리오", "failed", "err")],
      }],
    }];
    const failures: EvalFailure[] = [];
    const stats = { total: 0, passed: 0, failed: 0 };
    collectAllSpecs(suites, failures, stats, requirements);
    expect(failures[0].severity).toBe("soft");
  });
});

describe("mapFailureSeverity title-array input", () => {
  it("accepts an array of titles and reads tags from any of them", () => {
    expect(
      mapFailureSeverity(
        ["회원가입 플로우 @FR-001", "비밀번호가 8자 미만"],
        requirements,
      ),
    ).toBe("hard");
  });

  it("returns soft when array contains no matching tags and no phrase overlap", () => {
    expect(
      mapFailureSeverity(["완전 관계없는 제목", "다른 관계없는 제목"], requirements),
    ).toBe("soft");
  });
});
