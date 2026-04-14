import { describe, it, expect } from "vitest";
import {
  EvalSpecSchema,
  TaskContractSchema,
  EvalResultSchema,
  IterationStateSchema,
} from "../types.js";

// ---------------------------------------------------------------------------
// Helpers — minimal valid shapes reused across tests
// ---------------------------------------------------------------------------

const minimalDomain = {
  entities: [{ name: "User", slug: "users", fields: ["id", "email"] }],
  key_flows: ["login", "signup"],
};

const minimalRequirements = [
  {
    id: "REQ-001",
    title: "Page loads",
    severity: "hard" as const,
    test_method: "build_check" as const,
    description: "The app must build without errors.",
  },
];

const minimalEvalSpec = {
  project: "my-app",
  preset: "nextjs",
  palette: "default",
  domain: minimalDomain,
  requirements: minimalRequirements,
  data_source: { type: "mock" as const },
  constraints: ["No external APIs"],
};

// ---------------------------------------------------------------------------
// EvalSpecSchema
// ---------------------------------------------------------------------------

describe("EvalSpecSchema", () => {
  it("validates a minimal valid spec (mock data source)", () => {
    const result = EvalSpecSchema.safeParse(minimalEvalSpec);
    expect(result.success).toBe(true);
  });

  it("rejects spec with missing required top-level field (project)", () => {
    const { project: _omitted, ...rest } = minimalEvalSpec;
    const result = EvalSpecSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects spec with missing domain", () => {
    const { domain: _omitted, ...rest } = minimalEvalSpec;
    const result = EvalSpecSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects spec with missing requirements", () => {
    const { requirements: _omitted, ...rest } = minimalEvalSpec;
    const result = EvalSpecSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects spec with invalid severity", () => {
    const spec = {
      ...minimalEvalSpec,
      requirements: [
        { ...minimalRequirements[0], severity: "critical" },
      ],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("rejects spec with invalid test_method", () => {
    const spec = {
      ...minimalEvalSpec,
      requirements: [
        { ...minimalRequirements[0], test_method: "manual" },
      ],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("validates spec with optional external_secrets", () => {
    const spec = {
      ...minimalEvalSpec,
      external_secrets: [
        { name: "STRIPE_KEY", description: "Stripe secret key" },
        { name: "DB_PASS", description: "Database password", required: false },
      ],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (result.success) {
      // required defaults to true when omitted
      expect(result.data.external_secrets?.[0].required).toBe(true);
      expect(result.data.external_secrets?.[1].required).toBe(false);
    }
  });

  it("validates spec with db_direct data source", () => {
    const spec = {
      ...minimalEvalSpec,
      data_source: {
        type: "db_direct" as const,
        db_direct_config: {
          db_type: "postgres",
          connection_env: "DATABASE_URL",
          tables: ["users", "orders"],
          field_mapping: { users: { user_id: "id" } },
          read_only: true,
        },
      },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("validates spec with db_direct data source and read_only defaulting to true", () => {
    const spec = {
      ...minimalEvalSpec,
      data_source: {
        type: "db_direct" as const,
        db_direct_config: {
          db_type: "mysql",
          connection_env: "DB_URL",
          tables: ["products"],
          field_mapping: {},
          // read_only omitted — should default to true
        },
      },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (result.success) {
      const ds = result.data.data_source as { type: "db_direct"; db_direct_config: { read_only: boolean } };
      expect(ds.db_direct_config.read_only).toBe(true);
    }
  });

  it("validates spec with api data source", () => {
    const spec = {
      ...minimalEvalSpec,
      data_source: {
        type: "api" as const,
        api_config: {
          base_url: "https://api.example.com",
          auth: "Bearer token123",
          endpoints: ["/users", "/products"],
        },
      },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("validates spec with db_snapshot data source", () => {
    const spec = {
      ...minimalEvalSpec,
      data_source: {
        type: "db_snapshot" as const,
        db_snapshot_config: {
          source_type: "postgres",
          snapshot_path: "/snapshots/db.sql",
          anonymize: true,
          tables: ["users"],
          field_mapping: {},
        },
      },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("rejects spec with unknown data_source type", () => {
    const spec = {
      ...minimalEvalSpec,
      data_source: { type: "ftp" },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("rejects spec with entity missing slug", () => {
    const spec = {
      ...minimalEvalSpec,
      domain: {
        ...minimalDomain,
        entities: [{ name: "User", fields: ["id"] }],
      },
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it("validates requirement with optional acceptance_criteria", () => {
    const spec = {
      ...minimalEvalSpec,
      requirements: [
        {
          ...minimalRequirements[0],
          acceptance_criteria: ["Page loads within 2s", "Shows user list"],
        },
      ],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("validates requirement without acceptance_criteria (backward compatible)", () => {
    const result = EvalSpecSchema.safeParse(minimalEvalSpec);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TaskContractSchema
// ---------------------------------------------------------------------------

describe("TaskContractSchema", () => {
  it("validates a valid TaskContract", () => {
    const contract = {
      run_id: "run-abc-123",
      preset: "nextjs",
      palette: "default",
      iteration: 1,
      workspace: "/tmp/workspace/run-abc-123",
      goal: "Build a user management dashboard",
      domain: minimalDomain,
      failing_checks: ["REQ-002"],
      repair_hints: ["Check the API endpoint URL"],
      protected_files: ["src/lib/auth.ts"],
    };
    const result = TaskContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it("rejects TaskContract with missing run_id", () => {
    const contract = {
      preset: "nextjs",
      palette: "default",
      iteration: 1,
      workspace: "/tmp/workspace",
      goal: "Build something",
      domain: minimalDomain,
      failing_checks: [],
      repair_hints: [],
      protected_files: [],
    };
    const result = TaskContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
  });

  it("rejects TaskContract with non-integer iteration", () => {
    const contract = {
      run_id: "run-abc",
      preset: "nextjs",
      palette: "default",
      iteration: "one", // should be number
      workspace: "/tmp/workspace",
      goal: "Build something",
      domain: minimalDomain,
      failing_checks: [],
      repair_hints: [],
      protected_files: [],
    };
    const result = TaskContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EvalResultSchema
// ---------------------------------------------------------------------------

describe("EvalResultSchema", () => {
  it("validates a passing EvalResult", () => {
    const result = {
      evaluator: "build" as const,
      status: "pass" as const,
      severity: "hard" as const,
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates a failing EvalResult with evidence", () => {
    const result = {
      evaluator: "e2e" as const,
      status: "fail" as const,
      severity: "soft" as const,
      failures: [
        {
          id: "REQ-003",
          message: "Login button not found",
          evidence: ["screenshot.png", "page-source.html"],
          repair_hint: "Check the button selector in login.test.ts",
        },
      ],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates failing EvalResult with failure without repair_hint (optional)", () => {
    const result = {
      evaluator: "unit_test" as const,
      status: "fail" as const,
      severity: "hard" as const,
      failures: [
        {
          id: "REQ-005",
          message: "Test suite crashed",
          evidence: ["stderr.log"],
          // repair_hint omitted
        },
      ],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("rejects EvalResult with invalid evaluator", () => {
    const result = {
      evaluator: "lint",
      status: "pass",
      severity: "hard",
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it("rejects EvalResult with invalid status", () => {
    const result = {
      evaluator: "build",
      status: "pending",
      severity: "hard",
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it("validates page_check as a valid evaluator", () => {
    const result = {
      evaluator: "page_check" as const,
      status: "pass" as const,
      severity: "hard" as const,
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates EvalFailure with severity field", () => {
    const result = {
      evaluator: "build" as const,
      status: "fail" as const,
      severity: "hard" as const,
      failures: [
        {
          id: "REQ-010",
          message: "Build failed",
          severity: "hard" as const,
          evidence: ["error.log"],
          repair_hint: "Fix the build",
        },
      ],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates EvalResult with optional stats field", () => {
    const result = {
      evaluator: "e2e" as const,
      status: "pass" as const,
      severity: "soft" as const,
      failures: [],
      stats: { total: 16, passed: 16, failed: 0 },
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stats?.total).toBe(16);
      expect(parsed.data.stats?.passed).toBe(16);
      expect(parsed.data.stats?.failed).toBe(0);
    }
  });

  it("validates EvalResult without stats (backward compatible)", () => {
    const result = {
      evaluator: "build" as const,
      status: "pass" as const,
      severity: "hard" as const,
      failures: [],
    };
    const parsed = EvalResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stats).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// IterationStateSchema
// ---------------------------------------------------------------------------

describe("IterationStateSchema", () => {
  it("validates a running IterationState", () => {
    const state = {
      run_id: "run-xyz",
      total_iterations: 3,
      max_iterations: 10,
      status: "running" as const,
      resumable: true,
      history: [
        { iteration: 1, passed: ["REQ-001"], failed: ["REQ-002"], status: "partial" },
        { iteration: 2, passed: ["REQ-001", "REQ-002"], failed: [], status: "partial" },
      ],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("validates a completed IterationState", () => {
    const state = {
      run_id: "run-xyz",
      total_iterations: 5,
      max_iterations: 10,
      status: "completed" as const,
      resumable: false,
      history: [
        { iteration: 5, passed: ["REQ-001", "REQ-002", "REQ-003"], failed: [], status: "done" },
      ],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("validates an escalated IterationState with escalation_reason", () => {
    const state = {
      run_id: "run-escalated",
      total_iterations: 10,
      max_iterations: 10,
      status: "escalated" as const,
      escalation_reason: "Max iterations reached with unresolved hard failures",
      resumable: true,
      history: [
        { iteration: 10, failed: ["REQ-002"], reason: "Persistent login failure" },
      ],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.escalation_reason).toBe("Max iterations reached with unresolved hard failures");
    }
  });

  it("rejects IterationState with invalid status", () => {
    const state = {
      run_id: "run-xyz",
      total_iterations: 1,
      max_iterations: 10,
      status: "paused",
      resumable: false,
      history: [],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });

  it("rejects IterationState missing required fields", () => {
    const state = {
      run_id: "run-xyz",
      // total_iterations omitted
      max_iterations: 10,
      status: "running",
      resumable: true,
      history: [],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });

  it("validates structured failure_details in history", () => {
    const state = {
      run_id: "run-details",
      total_iterations: 2,
      max_iterations: 10,
      status: "running" as const,
      resumable: true,
      history: [
        {
          iteration: 1,
          passed: ["REQ-001"],
          failed: ["REQ-002"],
          failure_details: [
            { id: "REQ-002", message: "Page missing", hint: "Create the page" },
          ],
          status: "partial",
        },
        {
          iteration: 2,
          passed: ["REQ-001"],
          failed: ["REQ-003"],
          failure_details: [
            { id: "REQ-003", message: "Build error" },
          ],
          status: "partial",
        },
      ],
    };
    const result = IterationStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
});
