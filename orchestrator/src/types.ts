import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const EntitySchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
});

const DomainSchema = z.object({
  entities: z.array(EntitySchema),
  key_flows: z.array(z.string()),
});

const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["hard", "soft"]),
  test_method: z.enum(["e2e", "build_check", "console_check", "unit_test"]),
  description: z.string(),
});

const ExternalSecretSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// DataSource discriminated union
// ---------------------------------------------------------------------------

const MockDataSourceSchema = z.object({
  type: z.literal("mock"),
});

const ApiDataSourceSchema = z.object({
  type: z.literal("api"),
  api_config: z.object({
    base_url: z.string(),
    auth: z.string().optional(),
    endpoints: z.array(z.string()),
  }),
});

const DbDirectDataSourceSchema = z.object({
  type: z.literal("db_direct"),
  db_direct_config: z.object({
    db_type: z.string(),
    connection_env: z.string(),
    tables: z.array(z.string()),
    field_mapping: z.record(z.record(z.string())),
    read_only: z.boolean().default(true),
  }),
});

const DbSnapshotDataSourceSchema = z.object({
  type: z.literal("db_snapshot"),
  db_snapshot_config: z.object({
    source_type: z.string(),
    snapshot_path: z.string(),
    anonymize: z.boolean().default(true),
    tables: z.array(z.string()),
    field_mapping: z.record(z.record(z.string())),
  }),
});

const DataSourceSchema = z.discriminatedUnion("type", [
  MockDataSourceSchema,
  ApiDataSourceSchema,
  DbDirectDataSourceSchema,
  DbSnapshotDataSourceSchema,
]);

// ---------------------------------------------------------------------------
// EvalSpec
// ---------------------------------------------------------------------------

export const EvalSpecSchema = z.object({
  project: z.string(),
  preset: z.string(),
  palette: z.string(),
  domain: DomainSchema,
  requirements: z.array(RequirementSchema),
  data_source: DataSourceSchema,
  constraints: z.array(z.string()),
  external_secrets: z.array(ExternalSecretSchema).optional(),
});

export type EvalSpec = z.infer<typeof EvalSpecSchema>;

// ---------------------------------------------------------------------------
// TaskContract
// ---------------------------------------------------------------------------

export const TaskContractSchema = z.object({
  run_id: z.string(),
  preset: z.string(),
  palette: z.string(),
  iteration: z.number(),
  workspace: z.string(),
  goal: z.string(),
  domain: DomainSchema,
  failing_checks: z.array(z.string()),
  repair_hints: z.array(z.string()),
  protected_files: z.array(z.string()),
});

export type TaskContract = z.infer<typeof TaskContractSchema>;

// ---------------------------------------------------------------------------
// EvalResult
// ---------------------------------------------------------------------------

export const EvalFailureSchema = z.object({
  id: z.string(),
  message: z.string(),
  severity: z.enum(["hard", "soft"]).optional(),
  evidence: z.array(z.string()),
  repair_hint: z.string().optional(),
});

export type EvalFailure = z.infer<typeof EvalFailureSchema>;

export const EvalResultSchema = z.object({
  evaluator: z.enum(["build", "unit_test", "console", "e2e", "page_check"]),
  status: z.enum(["pass", "fail"]),
  severity: z.enum(["hard", "soft"]),
  failures: z.array(EvalFailureSchema),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

// ---------------------------------------------------------------------------
// IterationState
// ---------------------------------------------------------------------------

const FailureDetailSchema = z.object({
  id: z.string(),
  message: z.string(),
  hint: z.string().optional(),
});

const HistoryEntrySchema = z.object({
  iteration: z.number(),
  passed: z.array(z.string()).optional(),
  failed: z.array(z.string()).optional(),
  failure_details: z.array(FailureDetailSchema).optional(),
  status: z.string().optional(),
  reason: z.string().optional(),
});

export const IterationStateSchema = z.object({
  run_id: z.string(),
  total_iterations: z.number(),
  max_iterations: z.number(),
  status: z.enum(["running", "completed", "escalated"]),
  escalation_reason: z.string().optional(),
  resumable: z.boolean(),
  history: z.array(HistoryEntrySchema),
});

export type IterationState = z.infer<typeof IterationStateSchema>;

// ---------------------------------------------------------------------------
// BuildResult — plain interface (no Zod schema needed)
// ---------------------------------------------------------------------------

export interface BuildResult {
  success: boolean;
  output: string;
}

// ---------------------------------------------------------------------------
// RunOptions — plain interface
// ---------------------------------------------------------------------------

export interface RunOptions {
  specPath: string;
  resumeRunId?: string;
}

// ---------------------------------------------------------------------------
// FailureClass — type alias
// ---------------------------------------------------------------------------

export type FailureClass = "repairable" | "env_issue" | "unknown";
