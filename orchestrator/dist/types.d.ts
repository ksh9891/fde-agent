import { z } from "zod";
export declare const RequirementSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    severity: z.ZodEnum<["hard", "soft"]>;
    test_method: z.ZodEnum<["e2e", "build_check", "console_check", "unit_test"]>;
    description: z.ZodString;
    acceptance_criteria: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    description: string;
    severity: "hard" | "soft";
    test_method: "e2e" | "build_check" | "console_check" | "unit_test";
    acceptance_criteria?: string[] | undefined;
}, {
    id: string;
    title: string;
    description: string;
    severity: "hard" | "soft";
    test_method: "e2e" | "build_check" | "console_check" | "unit_test";
    acceptance_criteria?: string[] | undefined;
}>;
export type Requirement = z.infer<typeof RequirementSchema>;
export declare const EvalSpecSchema: z.ZodObject<{
    project: z.ZodString;
    preset: z.ZodString;
    palette: z.ZodString;
    domain: z.ZodObject<{
        entities: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            slug: z.ZodString;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            slug: string;
            fields: string[];
        }, {
            name: string;
            slug: string;
            fields: string[];
        }>, "many">;
        key_flows: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    }, {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    }>;
    requirements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        severity: z.ZodEnum<["hard", "soft"]>;
        test_method: z.ZodEnum<["e2e", "build_check", "console_check", "unit_test"]>;
        description: z.ZodString;
        acceptance_criteria: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        description: string;
        severity: "hard" | "soft";
        test_method: "e2e" | "build_check" | "console_check" | "unit_test";
        acceptance_criteria?: string[] | undefined;
    }, {
        id: string;
        title: string;
        description: string;
        severity: "hard" | "soft";
        test_method: "e2e" | "build_check" | "console_check" | "unit_test";
        acceptance_criteria?: string[] | undefined;
    }>, "many">;
    data_source: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"mock">;
    }, "strip", z.ZodTypeAny, {
        type: "mock";
    }, {
        type: "mock";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"api">;
        api_config: z.ZodObject<{
            base_url: z.ZodString;
            auth: z.ZodOptional<z.ZodString>;
            endpoints: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        }, {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "api";
        api_config: {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        };
    }, {
        type: "api";
        api_config: {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        };
    }>, z.ZodObject<{
        type: z.ZodLiteral<"db_direct">;
        db_direct_config: z.ZodObject<{
            db_type: z.ZodString;
            connection_env: z.ZodString;
            tables: z.ZodArray<z.ZodString, "many">;
            field_mapping: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
            read_only: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only: boolean;
        }, {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "db_direct";
        db_direct_config: {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only: boolean;
        };
    }, {
        type: "db_direct";
        db_direct_config: {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only?: boolean | undefined;
        };
    }>, z.ZodObject<{
        type: z.ZodLiteral<"db_snapshot">;
        db_snapshot_config: z.ZodObject<{
            source_type: z.ZodString;
            snapshot_path: z.ZodString;
            anonymize: z.ZodDefault<z.ZodBoolean>;
            tables: z.ZodArray<z.ZodString, "many">;
            field_mapping: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize: boolean;
        }, {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "db_snapshot";
        db_snapshot_config: {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize: boolean;
        };
    }, {
        type: "db_snapshot";
        db_snapshot_config: {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize?: boolean | undefined;
        };
    }>]>;
    constraints: z.ZodArray<z.ZodString, "many">;
    external_secrets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        required: boolean;
        description: string;
    }, {
        name: string;
        description: string;
        required?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    project: string;
    preset: string;
    palette: string;
    domain: {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    };
    requirements: {
        id: string;
        title: string;
        description: string;
        severity: "hard" | "soft";
        test_method: "e2e" | "build_check" | "console_check" | "unit_test";
        acceptance_criteria?: string[] | undefined;
    }[];
    data_source: {
        type: "mock";
    } | {
        type: "api";
        api_config: {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        };
    } | {
        type: "db_direct";
        db_direct_config: {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only: boolean;
        };
    } | {
        type: "db_snapshot";
        db_snapshot_config: {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize: boolean;
        };
    };
    constraints: string[];
    external_secrets?: {
        name: string;
        required: boolean;
        description: string;
    }[] | undefined;
}, {
    project: string;
    preset: string;
    palette: string;
    domain: {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    };
    requirements: {
        id: string;
        title: string;
        description: string;
        severity: "hard" | "soft";
        test_method: "e2e" | "build_check" | "console_check" | "unit_test";
        acceptance_criteria?: string[] | undefined;
    }[];
    data_source: {
        type: "mock";
    } | {
        type: "api";
        api_config: {
            base_url: string;
            endpoints: string[];
            auth?: string | undefined;
        };
    } | {
        type: "db_direct";
        db_direct_config: {
            db_type: string;
            connection_env: string;
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            read_only?: boolean | undefined;
        };
    } | {
        type: "db_snapshot";
        db_snapshot_config: {
            tables: string[];
            field_mapping: Record<string, Record<string, string>>;
            source_type: string;
            snapshot_path: string;
            anonymize?: boolean | undefined;
        };
    };
    constraints: string[];
    external_secrets?: {
        name: string;
        description: string;
        required?: boolean | undefined;
    }[] | undefined;
}>;
export type EvalSpec = z.infer<typeof EvalSpecSchema>;
export declare const TaskContractSchema: z.ZodObject<{
    run_id: z.ZodString;
    preset: z.ZodString;
    palette: z.ZodString;
    iteration: z.ZodNumber;
    workspace: z.ZodString;
    goal: z.ZodString;
    domain: z.ZodObject<{
        entities: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            slug: z.ZodString;
            fields: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            slug: string;
            fields: string[];
        }, {
            name: string;
            slug: string;
            fields: string[];
        }>, "many">;
        key_flows: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    }, {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    }>;
    failing_checks: z.ZodArray<z.ZodString, "many">;
    repair_hints: z.ZodArray<z.ZodString, "many">;
    protected_files: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    preset: string;
    palette: string;
    domain: {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    };
    run_id: string;
    iteration: number;
    workspace: string;
    goal: string;
    failing_checks: string[];
    repair_hints: string[];
    protected_files: string[];
}, {
    preset: string;
    palette: string;
    domain: {
        entities: {
            name: string;
            slug: string;
            fields: string[];
        }[];
        key_flows: string[];
    };
    run_id: string;
    iteration: number;
    workspace: string;
    goal: string;
    failing_checks: string[];
    repair_hints: string[];
    protected_files: string[];
}>;
export type TaskContract = z.infer<typeof TaskContractSchema>;
export declare const EvalFailureSchema: z.ZodObject<{
    id: z.ZodString;
    message: z.ZodString;
    severity: z.ZodOptional<z.ZodEnum<["hard", "soft"]>>;
    evidence: z.ZodArray<z.ZodString, "many">;
    repair_hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    evidence: string[];
    severity?: "hard" | "soft" | undefined;
    repair_hint?: string | undefined;
}, {
    message: string;
    id: string;
    evidence: string[];
    severity?: "hard" | "soft" | undefined;
    repair_hint?: string | undefined;
}>;
export type EvalFailure = z.infer<typeof EvalFailureSchema>;
export declare const EvalResultSchema: z.ZodObject<{
    evaluator: z.ZodEnum<["build", "unit_test", "console", "e2e", "page_check"]>;
    status: z.ZodEnum<["pass", "fail"]>;
    severity: z.ZodEnum<["hard", "soft"]>;
    failures: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        message: z.ZodString;
        severity: z.ZodOptional<z.ZodEnum<["hard", "soft"]>>;
        evidence: z.ZodArray<z.ZodString, "many">;
        repair_hint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        id: string;
        evidence: string[];
        severity?: "hard" | "soft" | undefined;
        repair_hint?: string | undefined;
    }, {
        message: string;
        id: string;
        evidence: string[];
        severity?: "hard" | "soft" | undefined;
        repair_hint?: string | undefined;
    }>, "many">;
    stats: z.ZodOptional<z.ZodObject<{
        total: z.ZodNumber;
        passed: z.ZodNumber;
        failed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        failed: number;
        passed: number;
    }, {
        total: number;
        failed: number;
        passed: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "fail" | "pass";
    severity: "hard" | "soft";
    evaluator: "e2e" | "unit_test" | "build" | "console" | "page_check";
    failures: {
        message: string;
        id: string;
        evidence: string[];
        severity?: "hard" | "soft" | undefined;
        repair_hint?: string | undefined;
    }[];
    stats?: {
        total: number;
        failed: number;
        passed: number;
    } | undefined;
}, {
    status: "fail" | "pass";
    severity: "hard" | "soft";
    evaluator: "e2e" | "unit_test" | "build" | "console" | "page_check";
    failures: {
        message: string;
        id: string;
        evidence: string[];
        severity?: "hard" | "soft" | undefined;
        repair_hint?: string | undefined;
    }[];
    stats?: {
        total: number;
        failed: number;
        passed: number;
    } | undefined;
}>;
export type EvalResult = z.infer<typeof EvalResultSchema>;
export declare const IterationStateSchema: z.ZodObject<{
    run_id: z.ZodString;
    total_iterations: z.ZodNumber;
    max_iterations: z.ZodNumber;
    status: z.ZodEnum<["running", "completed", "escalated"]>;
    escalation_reason: z.ZodOptional<z.ZodString>;
    resumable: z.ZodBoolean;
    history: z.ZodArray<z.ZodObject<{
        iteration: z.ZodNumber;
        passed: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        failed: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        failure_details: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            message: z.ZodString;
            hint: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            id: string;
            hint?: string | undefined;
        }, {
            message: string;
            id: string;
            hint?: string | undefined;
        }>, "many">>;
        status: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        iteration: number;
        reason?: string | undefined;
        failed?: string[] | undefined;
        status?: string | undefined;
        passed?: string[] | undefined;
        failure_details?: {
            message: string;
            id: string;
            hint?: string | undefined;
        }[] | undefined;
    }, {
        iteration: number;
        reason?: string | undefined;
        failed?: string[] | undefined;
        status?: string | undefined;
        passed?: string[] | undefined;
        failure_details?: {
            message: string;
            id: string;
            hint?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    history: {
        iteration: number;
        reason?: string | undefined;
        failed?: string[] | undefined;
        status?: string | undefined;
        passed?: string[] | undefined;
        failure_details?: {
            message: string;
            id: string;
            hint?: string | undefined;
        }[] | undefined;
    }[];
    status: "completed" | "running" | "escalated";
    run_id: string;
    total_iterations: number;
    max_iterations: number;
    resumable: boolean;
    escalation_reason?: string | undefined;
}, {
    history: {
        iteration: number;
        reason?: string | undefined;
        failed?: string[] | undefined;
        status?: string | undefined;
        passed?: string[] | undefined;
        failure_details?: {
            message: string;
            id: string;
            hint?: string | undefined;
        }[] | undefined;
    }[];
    status: "completed" | "running" | "escalated";
    run_id: string;
    total_iterations: number;
    max_iterations: number;
    resumable: boolean;
    escalation_reason?: string | undefined;
}>;
export type IterationState = z.infer<typeof IterationStateSchema>;
export interface BuildResult {
    success: boolean;
    output: string;
}
export interface RunOptions {
    specPath: string;
    resumeRunId?: string;
}
export type FailureClass = "repairable" | "env_issue" | "unknown";
