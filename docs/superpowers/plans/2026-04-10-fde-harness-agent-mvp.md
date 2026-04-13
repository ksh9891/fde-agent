# FDE Harness Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FDE가 eval spec을 입력하면 preset 기반으로 일관된 품질의 관리자 웹 프로토타입을 생성하고, deterministic evaluation으로 검증하는 Claude Code Plugin을 만든다.

**Architecture:** TypeScript Orchestrator CLI가 메인 루프를 제어한다. Claude Code Headless를 Builder/Test Writer로 호출하고, Playwright 기반 Evaluator로 검증한다. 전체가 Claude Code Plugin으로 패키징된다.

**Tech Stack:** TypeScript, Node.js, Next.js, shadcn/ui, Playwright, Prisma, YAML (js-yaml)

---

## File Structure

```
fde-agent/
├── .claude-plugin/
│   └── plugin.json
│
├── skills/
│   └── run/
│       └── SKILL.md
│
├── agents/
│   ├── builder.md
│   └── test-writer.md
│
├── hooks/
│   └── hooks.json
│
├── global/
│   └── palettes/
│       ├── corporate-blue.json
│       ├── warm-neutral.json
│       └── dark-modern.json
│
├── presets/
│   └── admin-web/
│       ├── core/
│       │   ├── scaffold/          # Next.js + shadcn/ui 기본 프로젝트
│       │   ├── layouts/           # AdminLayout.tsx
│       │   ├── page-patterns/     # ListPage, DetailPage, FormPage, DashboardPage
│       │   ├── components/        # DataTable, FormBuilder, StatusBadge, StatCard
│       │   └── auth/              # LoginPage, AuthProvider, RoleGuard
│       ├── rules/
│       │   ├── CLAUDE.md
│       │   └── protected-files.json
│       └── test-pack/
│           └── scenarios/         # list.template.ts, detail.template.ts, form.template.ts
│
├── orchestrator/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # CLI 진입점 (--spec, --resume 파싱)
│       ├── types.ts               # EvalSpec, TaskContract, EvalResult 등 타입
│       ├── loop.ts                # 메인 루프 (최대 15회)
│       ├── eval-spec-parser.ts    # YAML 파싱 + 검증
│       ├── task-contract.ts       # TaskContract 생성
│       ├── provisioner.ts         # workspace 생성 + preset 복사 + palette 적용
│       ├── builder/
│       │   ├── interface.ts       # BuilderInterface 추상
│       │   └── claude-code.ts     # Claude Code headless 호출
│       ├── test-writer/
│       │   └── claude-code.ts     # Test Writer 세션 호출
│       ├── evaluator/
│       │   ├── pipeline.ts        # Evaluator 파이프라인 (순서 제어)
│       │   ├── build-check.ts     # npm run build
│       │   ├── unit-test.ts       # npm run test
│       │   ├── console-check.ts   # Playwright 콘솔 에러 수집
│       │   └── e2e.ts             # Playwright E2E 시나리오 실행
│       ├── classifier.ts          # 에러 분류 (repairable / env_issue / unknown)
│       ├── reporter.ts            # 리포트 생성 (summary.md, eval-results.json)
│       └── resume.ts              # --resume 처리 (iterations.json 로드)
│
└── workspace/                     # 실행 시 생성됨 (gitignore)
```

---

### Task 1: 프로젝트 초기화 + Plugin 구조

**Files:**
- Create: `fde-agent/.claude-plugin/plugin.json`
- Create: `fde-agent/skills/run/SKILL.md`
- Create: `fde-agent/orchestrator/package.json`
- Create: `fde-agent/orchestrator/tsconfig.json`
- Create: `fde-agent/.gitignore`

- [ ] **Step 1: 프로젝트 루트 디렉터리 생성**

```bash
mkdir -p fde-agent
cd fde-agent
git init
```

- [ ] **Step 2: .gitignore 생성**

```gitignore
node_modules/
dist/
workspace/
*.log
.env
```

- [ ] **Step 3: Plugin manifest 생성**

`.claude-plugin/plugin.json`:
```json
{
  "name": "fde-agent",
  "version": "0.1.0",
  "description": "FDE Harness Agent — preset 기반 프로토타입 생성 + eval-driven 품질 검증",
  "author": {
    "name": "FDE Team"
  }
}
```

- [ ] **Step 4: Skill 진입점 생성**

`skills/run/SKILL.md`:
```markdown
---
name: run
description: Eval spec을 받아 preset 기반 프로토타입을 생성하고 검증합니다. /fde-agent:run <eval-spec-path> [--resume <run-id>]
---

## 실행

사용자가 제공한 eval spec 파일 경로를 받아 Orchestrator를 실행합니다.

1. 인자에서 eval spec 경로와 옵션을 파싱합니다.
2. Bash로 Orchestrator를 실행합니다:

\`\`\`bash
node <plugin-path>/orchestrator/dist/index.js --spec <eval-spec-path> [--resume <run-id>]
\`\`\`

3. 실행 결과를 사용자에게 표시합니다.
4. 성공 시 workspace 경로와 리포트 요약을 보여줍니다.
5. escalation 시 사유와 재개 방법을 안내합니다.
```

- [ ] **Step 5: Orchestrator package.json 생성**

`orchestrator/package.json`:
```json
{
  "name": "fde-agent-orchestrator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "execa": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 6: tsconfig.json 생성**

`orchestrator/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 7: npm install + 빌드 확인**

```bash
cd orchestrator
npm install
npx tsc --noEmit
```

Expected: 성공 (소스 파일이 아직 없으므로 에러 없음)

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: initialize project structure with plugin manifest and orchestrator setup"
```

---

### Task 2: 타입 정의

**Files:**
- Create: `fde-agent/orchestrator/src/types.ts`
- Test: `fde-agent/orchestrator/src/__tests__/types.test.ts`

- [ ] **Step 1: 타입 테스트 작성**

`orchestrator/src/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  EvalSpecSchema,
  TaskContractSchema,
  EvalResultSchema,
  IterationStateSchema,
} from "../types.js";

describe("EvalSpecSchema", () => {
  it("should validate a minimal eval spec", () => {
    const spec = {
      project: "test-project",
      preset: "admin-web",
      palette: "corporate-blue",
      domain: {
        entities: [{ name: "고객", fields: ["이름", "연락처"] }],
        key_flows: ["고객 목록 조회"],
      },
      requirements: [
        {
          id: "FR-001",
          title: "고객 목록 조회",
          severity: "hard",
          test_method: "e2e",
          description: "고객 목록을 조회할 수 있다",
        },
      ],
      data_source: { type: "mock" },
      constraints: ["React + TypeScript + Next.js"],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("should reject eval spec without required fields", () => {
    const result = EvalSpecSchema.safeParse({ project: "test" });
    expect(result.success).toBe(false);
  });

  it("should validate eval spec with external_secrets", () => {
    const spec = {
      project: "test-project",
      preset: "admin-web",
      palette: "corporate-blue",
      domain: {
        entities: [{ name: "고객", fields: ["이름"] }],
        key_flows: ["조회"],
      },
      requirements: [
        {
          id: "NFR-001",
          title: "빌드 성공",
          severity: "hard",
          test_method: "build_check",
          description: "빌드가 성공해야 한다",
        },
      ],
      data_source: { type: "mock" },
      constraints: [],
      external_secrets: [
        { name: "API_KEY", description: "외부 API 키", required: true },
      ],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("should validate eval spec with db_direct data source", () => {
    const spec = {
      project: "test",
      preset: "admin-web",
      palette: "warm-neutral",
      domain: {
        entities: [{ name: "예약", fields: ["예약번호"] }],
        key_flows: ["예약 조회"],
      },
      requirements: [
        {
          id: "NFR-001",
          title: "빌드",
          severity: "hard",
          test_method: "build_check",
          description: "빌드 성공",
        },
      ],
      data_source: {
        type: "db_direct",
        db_direct_config: {
          db_type: "postgresql",
          connection_env: "DATABASE_URL",
          tables: ["reservations"],
          field_mapping: { reservations: { id: "예약번호" } },
          read_only: true,
        },
      },
      constraints: [],
    };
    const result = EvalSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });
});

describe("TaskContractSchema", () => {
  it("should validate a task contract", () => {
    const contract = {
      run_id: "run_001",
      preset: "admin-web",
      palette: "corporate-blue",
      iteration: 1,
      workspace: "/workspace/run_001",
      goal: "테스트 프로토타입",
      domain: {
        entities: [{ name: "고객", fields: ["이름"] }],
        key_flows: ["조회"],
      },
      failing_checks: [],
      repair_hints: [],
      protected_files: ["design-tokens.json"],
    };
    const result = TaskContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });
});

describe("EvalResultSchema", () => {
  it("should validate a passing result", () => {
    const result = {
      evaluator: "build",
      status: "pass",
      severity: "hard",
      failures: [],
    };
    expect(EvalResultSchema.safeParse(result).success).toBe(true);
  });

  it("should validate a failing result with evidence", () => {
    const result = {
      evaluator: "e2e",
      status: "fail",
      severity: "hard",
      failures: [
        {
          id: "FR-001",
          message: "신규 예약 등록 실패",
          evidence: ["screenshots/error.png"],
          repair_hint: "onSubmit 핸들러 확인",
        },
      ],
    };
    expect(EvalResultSchema.safeParse(result).success).toBe(true);
  });
});

describe("IterationStateSchema", () => {
  it("should validate iteration state with escalation", () => {
    const state = {
      run_id: "run_001",
      total_iterations: 3,
      max_iterations: 15,
      status: "escalated",
      escalation_reason: "env_issue: API_KEY not defined",
      resumable: true,
      history: [
        { iteration: 1, passed: ["NFR-001"], failed: ["FR-001"] },
        {
          iteration: 2,
          passed: [],
          failed: [],
          status: "escalated",
          reason: "env_issue",
        },
      ],
    };
    expect(IterationStateSchema.safeParse(state).success).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd orchestrator
npx vitest run src/__tests__/types.test.ts
```

Expected: FAIL — 모듈 없음

- [ ] **Step 3: 타입 구현**

`orchestrator/src/types.ts`:
```typescript
import { z } from "zod";

// --- Domain ---

const EntitySchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
});

const DomainSchema = z.object({
  entities: z.array(EntitySchema),
  key_flows: z.array(z.string()),
});

// --- Data Source ---

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

// --- Requirement ---

const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["hard", "soft"]),
  test_method: z.enum(["e2e", "build_check", "console_check", "unit_test"]),
  description: z.string(),
});

// --- External Secrets ---

const ExternalSecretSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
});

// --- Eval Spec ---

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

// --- Task Contract ---

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

// --- Eval Result ---

const EvalFailureSchema = z.object({
  id: z.string(),
  message: z.string(),
  evidence: z.array(z.string()),
  repair_hint: z.string().optional(),
});

export const EvalResultSchema = z.object({
  evaluator: z.enum(["build", "unit_test", "console", "e2e"]),
  status: z.enum(["pass", "fail"]),
  severity: z.enum(["hard", "soft"]),
  failures: z.array(EvalFailureSchema),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
export type EvalFailure = z.infer<typeof EvalFailureSchema>;

// --- Iteration State ---

const IterationHistoryEntrySchema = z.object({
  iteration: z.number(),
  passed: z.array(z.string()).optional(),
  failed: z.array(z.string()).optional(),
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
  history: z.array(IterationHistoryEntrySchema),
});

export type IterationState = z.infer<typeof IterationStateSchema>;

// --- Build Result ---

export interface BuildResult {
  success: boolean;
  output: string;
}

// --- Run Options ---

export interface RunOptions {
  specPath: string;
  resumeRunId?: string;
}

// --- Failure Classification ---

export type FailureClass = "repairable" | "env_issue" | "unknown";
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```bash
cd orchestrator
npx vitest run src/__tests__/types.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/types.ts orchestrator/src/__tests__/types.test.ts
git commit -m "feat: define core types with zod schemas — EvalSpec, TaskContract, EvalResult, IterationState"
```

---

### Task 3: Eval Spec 파서

**Files:**
- Create: `fde-agent/orchestrator/src/eval-spec-parser.ts`
- Test: `fde-agent/orchestrator/src/__tests__/eval-spec-parser.test.ts`
- Create: `fde-agent/orchestrator/src/__tests__/fixtures/sample-eval-spec.yaml`

- [ ] **Step 1: 테스트용 fixture 생성**

`orchestrator/src/__tests__/fixtures/sample-eval-spec.yaml`:
```yaml
project: resort-admin-prototype
preset: admin-web
palette: warm-neutral

domain:
  entities:
    - name: 객실
      fields: [객실번호, 타입, 층, 상태, 가격]
    - name: 예약
      fields: [예약번호, 고객명, 객실, 체크인, 체크아웃, 상태]

  key_flows:
    - 예약 목록 조회 및 필터링
    - 신규 예약 등록

requirements:
  - id: FR-001
    title: 신규 예약 등록
    severity: hard
    test_method: e2e
    description: 객실 선택 → 고객 정보 입력 → 저장까지 완료 가능

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check
    description: 빌드가 성공해야 한다

  - id: NFR-002
    title: 콘솔 에러 없음
    severity: hard
    test_method: console_check
    description: 치명적 콘솔 에러가 없어야 한다

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용

external_secrets:
  - name: GOOGLE_MAPS_API_KEY
    description: 지도 표시
    required: false
```

- [ ] **Step 2: 파서 테스트 작성**

`orchestrator/src/__tests__/eval-spec-parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseEvalSpec } from "../eval-spec-parser.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "fixtures", "sample-eval-spec.yaml");

describe("parseEvalSpec", () => {
  it("should parse a valid YAML eval spec file", async () => {
    const spec = await parseEvalSpec(fixturePath);
    expect(spec.project).toBe("resort-admin-prototype");
    expect(spec.preset).toBe("admin-web");
    expect(spec.palette).toBe("warm-neutral");
    expect(spec.domain.entities).toHaveLength(2);
    expect(spec.requirements).toHaveLength(3);
    expect(spec.data_source.type).toBe("mock");
  });

  it("should parse external_secrets", async () => {
    const spec = await parseEvalSpec(fixturePath);
    expect(spec.external_secrets).toHaveLength(1);
    expect(spec.external_secrets![0].name).toBe("GOOGLE_MAPS_API_KEY");
    expect(spec.external_secrets![0].required).toBe(false);
  });

  it("should throw on non-existent file", async () => {
    await expect(parseEvalSpec("/nonexistent.yaml")).rejects.toThrow();
  });

  it("should throw on invalid spec structure", async () => {
    const invalidPath = join(__dirname, "fixtures", "invalid-spec.yaml");
    // Create a minimal invalid file for this test
    const { writeFileSync } = await import("fs");
    writeFileSync(invalidPath, "project: test\n");
    await expect(parseEvalSpec(invalidPath)).rejects.toThrow();
    const { unlinkSync } = await import("fs");
    unlinkSync(invalidPath);
  });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/eval-spec-parser.test.ts
```

Expected: FAIL

- [ ] **Step 4: 파서 구현**

`orchestrator/src/eval-spec-parser.ts`:
```typescript
import { readFile } from "fs/promises";
import yaml from "js-yaml";
import { EvalSpecSchema, type EvalSpec } from "./types.js";

export async function parseEvalSpec(filePath: string): Promise<EvalSpec> {
  const content = await readFile(filePath, "utf-8");
  const raw = yaml.load(content);
  const result = EvalSpecSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid eval spec:\n${errors}`);
  }

  return result.data;
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/eval-spec-parser.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add orchestrator/src/eval-spec-parser.ts orchestrator/src/__tests__/eval-spec-parser.test.ts orchestrator/src/__tests__/fixtures/
git commit -m "feat: implement eval spec YAML parser with zod validation"
```

---

### Task 4: 에러 분류기 (Classifier)

**Files:**
- Create: `fde-agent/orchestrator/src/classifier.ts`
- Test: `fde-agent/orchestrator/src/__tests__/classifier.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/classifier.test.ts`:
```typescript
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/classifier.test.ts
```

Expected: FAIL

- [ ] **Step 3: 분류기 구현**

`orchestrator/src/classifier.ts`:
```typescript
import type { EvalFailure, FailureClass } from "./types.js";

const ENV_ISSUE_PATTERNS = [
  /not defined/i,
  /missing env/i,
  /API_KEY/i,
  /SECRET/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /authentication failed/i,
  /access denied/i,
];

const REPAIRABLE_PATTERNS = [
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Module not found/i,
  /Cannot find module/i,
  /test failed/i,
  /build error/i,
  /Expected.*but/i,
  /Cannot read properties/i,
  /is not a function/i,
];

export function classifyFailure(failure: EvalFailure): FailureClass {
  const msg = failure.message;

  for (const pattern of ENV_ISSUE_PATTERNS) {
    if (pattern.test(msg)) return "env_issue";
  }

  for (const pattern of REPAIRABLE_PATTERNS) {
    if (pattern.test(msg)) return "repairable";
  }

  return "unknown";
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/classifier.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/classifier.ts orchestrator/src/__tests__/classifier.test.ts
git commit -m "feat: implement failure classifier — env_issue / repairable / unknown"
```

---

### Task 5: Task Contract 빌더

**Files:**
- Create: `fde-agent/orchestrator/src/task-contract.ts`
- Test: `fde-agent/orchestrator/src/__tests__/task-contract.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/task-contract.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildTaskContract } from "../task-contract.js";
import type { EvalSpec, EvalResult } from "../types.js";

const sampleSpec: EvalSpec = {
  project: "test-project",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [{ name: "예약", fields: ["예약번호", "상태"] }],
    key_flows: ["예약 조회"],
  },
  requirements: [
    { id: "FR-001", title: "예약 조회", severity: "hard", test_method: "e2e", description: "예약 조회 가능" },
    { id: "NFR-001", title: "빌드", severity: "hard", test_method: "build_check", description: "빌드 성공" },
  ],
  data_source: { type: "mock" },
  constraints: ["React + TypeScript + Next.js"],
};

describe("buildTaskContract", () => {
  it("should build first iteration contract with no failures", () => {
    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/workspace/run_001",
      runId: "run_001",
      iteration: 1,
      failures: [],
    });

    expect(contract.run_id).toBe("run_001");
    expect(contract.preset).toBe("admin-web");
    expect(contract.palette).toBe("warm-neutral");
    expect(contract.iteration).toBe(1);
    expect(contract.failing_checks).toEqual([]);
    expect(contract.repair_hints).toEqual([]);
    expect(contract.goal).toBe("test-project");
  });

  it("should include failing checks and repair hints on subsequent iterations", () => {
    const failures: EvalResult[] = [
      {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [
          { id: "FR-001", message: "예약 저장 실패", evidence: [], repair_hint: "onSubmit 확인" },
        ],
      },
    ];

    const contract = buildTaskContract({
      evalSpec: sampleSpec,
      workspace: "/workspace/run_001",
      runId: "run_001",
      iteration: 3,
      failures,
    });

    expect(contract.iteration).toBe(3);
    expect(contract.failing_checks).toEqual(["E2E: 예약 저장 실패"]);
    expect(contract.repair_hints).toEqual(["onSubmit 확인"]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/task-contract.test.ts
```

Expected: FAIL

- [ ] **Step 3: Task Contract 빌더 구현**

`orchestrator/src/task-contract.ts`:
```typescript
import type { EvalSpec, EvalResult, TaskContract } from "./types.js";

interface BuildTaskContractInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  iteration: number;
  failures: EvalResult[];
}

export function buildTaskContract(input: BuildTaskContractInput): TaskContract {
  const { evalSpec, workspace, runId, iteration, failures } = input;

  const failingChecks: string[] = [];
  const repairHints: string[] = [];

  for (const result of failures) {
    for (const failure of result.failures) {
      const prefix = result.evaluator.toUpperCase();
      failingChecks.push(`${prefix}: ${failure.message}`);
      if (failure.repair_hint) {
        repairHints.push(failure.repair_hint);
      }
    }
  }

  return {
    run_id: runId,
    preset: evalSpec.preset,
    palette: evalSpec.palette,
    iteration,
    workspace,
    goal: evalSpec.project,
    domain: evalSpec.domain,
    failing_checks: failingChecks,
    repair_hints: repairHints,
    protected_files: ["design-tokens.json", "layout.tsx"],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/task-contract.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/task-contract.ts orchestrator/src/__tests__/task-contract.test.ts
git commit -m "feat: implement task contract builder — converts eval failures to repair instructions"
```

---

### Task 6: Builder Interface + Claude Code Builder

**Files:**
- Create: `fde-agent/orchestrator/src/builder/interface.ts`
- Create: `fde-agent/orchestrator/src/builder/claude-code.ts`
- Test: `fde-agent/orchestrator/src/__tests__/builder.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/builder.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { ClaudeCodeBuilder } from "../builder/claude-code.js";
import type { TaskContract } from "../types.js";

const sampleContract: TaskContract = {
  run_id: "run_001",
  preset: "admin-web",
  palette: "warm-neutral",
  iteration: 1,
  workspace: "/tmp/test-workspace",
  goal: "테스트",
  domain: {
    entities: [{ name: "고객", fields: ["이름"] }],
    key_flows: ["조회"],
  },
  failing_checks: [],
  repair_hints: [],
  protected_files: [],
};

describe("ClaudeCodeBuilder", () => {
  it("should construct the correct CLI command", () => {
    const builder = new ClaudeCodeBuilder({
      systemPromptPath: "/path/to/builder.md",
    });
    const command = builder.buildCommand(sampleContract);

    expect(command.executable).toBe("claude");
    expect(command.args).toContain("-p");
    expect(command.args).toContain("--output-format");
    expect(command.args).toContain("json");
    expect(command.cwd).toBe("/tmp/test-workspace");
  });

  it("should include system prompt path in arguments", () => {
    const builder = new ClaudeCodeBuilder({
      systemPromptPath: "/path/to/builder.md",
    });
    const command = builder.buildCommand(sampleContract);

    expect(command.args).toContain("--system-prompt");
    expect(command.args).toContain("/path/to/builder.md");
  });

  it("should serialize task contract as the prompt", () => {
    const builder = new ClaudeCodeBuilder({
      systemPromptPath: "/path/to/builder.md",
    });
    const command = builder.buildCommand(sampleContract);
    const promptArg = command.args[command.args.length - 1];

    expect(promptArg).toContain("run_001");
    expect(promptArg).toContain("admin-web");
    expect(promptArg).toContain("고객");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/builder.test.ts
```

Expected: FAIL

- [ ] **Step 3: Builder Interface 정의**

`orchestrator/src/builder/interface.ts`:
```typescript
import type { TaskContract, BuildResult } from "../types.js";

export interface BuilderInterface {
  execute(taskContract: TaskContract): Promise<BuildResult>;
}
```

- [ ] **Step 4: Claude Code Builder 구현**

`orchestrator/src/builder/claude-code.ts`:
```typescript
import { execa } from "execa";
import yaml from "js-yaml";
import type { TaskContract, BuildResult } from "../types.js";
import type { BuilderInterface } from "./interface.js";

interface ClaudeCodeBuilderOptions {
  systemPromptPath: string;
}

interface ClaudeCommand {
  executable: string;
  args: string[];
  cwd: string;
}

export class ClaudeCodeBuilder implements BuilderInterface {
  private systemPromptPath: string;

  constructor(options: ClaudeCodeBuilderOptions) {
    this.systemPromptPath = options.systemPromptPath;
  }

  buildCommand(taskContract: TaskContract): ClaudeCommand {
    const prompt = yaml.dump(taskContract, { lineWidth: -1 });

    return {
      executable: "claude",
      args: [
        "-p",
        "--output-format", "json",
        "--system-prompt", this.systemPromptPath,
        prompt,
      ],
      cwd: taskContract.workspace,
    };
  }

  async execute(taskContract: TaskContract): Promise<BuildResult> {
    const command = this.buildCommand(taskContract);

    try {
      const result = await execa(command.executable, command.args, {
        cwd: command.cwd,
        timeout: 600_000, // 10분
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: message,
      };
    }
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/builder.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add orchestrator/src/builder/
git add orchestrator/src/__tests__/builder.test.ts
git commit -m "feat: implement BuilderInterface and ClaudeCodeBuilder — headless CLI execution"
```

---

### Task 7: Evaluator 파이프라인

**Files:**
- Create: `fde-agent/orchestrator/src/evaluator/pipeline.ts`
- Create: `fde-agent/orchestrator/src/evaluator/build-check.ts`
- Create: `fde-agent/orchestrator/src/evaluator/unit-test.ts`
- Create: `fde-agent/orchestrator/src/evaluator/console-check.ts`
- Create: `fde-agent/orchestrator/src/evaluator/e2e.ts`
- Test: `fde-agent/orchestrator/src/__tests__/evaluator.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/evaluator.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { EvalPipeline } from "../evaluator/pipeline.js";
import type { EvalResult } from "../types.js";

describe("EvalPipeline", () => {
  it("should stop pipeline on first hard failure (build)", async () => {
    const buildCheck = {
      name: "build" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "build",
        status: "fail",
        severity: "hard",
        failures: [{ id: "NFR-001", message: "Build failed", evidence: ["build.log"] }],
      } satisfies EvalResult),
    };

    const unitTest = {
      name: "unit_test" as const,
      run: vi.fn(),
    };

    const pipeline = new EvalPipeline([buildCheck, unitTest]);
    const results = await pipeline.runAll("/workspace/test");

    expect(results.allHardConstraintsPassed).toBe(false);
    expect(results.results).toHaveLength(1);
    expect(unitTest.run).not.toHaveBeenCalled();
  });

  it("should continue pipeline when build passes", async () => {
    const buildCheck = {
      name: "build" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "build",
        status: "pass",
        severity: "hard",
        failures: [],
      } satisfies EvalResult),
    };

    const unitTest = {
      name: "unit_test" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "unit_test",
        status: "pass",
        severity: "hard",
        failures: [],
      } satisfies EvalResult),
    };

    const pipeline = new EvalPipeline([buildCheck, unitTest]);
    const results = await pipeline.runAll("/workspace/test");

    expect(results.allHardConstraintsPassed).toBe(true);
    expect(results.results).toHaveLength(2);
    expect(unitTest.run).toHaveBeenCalled();
  });

  it("should collect failures from multiple evaluators", async () => {
    const buildCheck = {
      name: "build" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "build", status: "pass", severity: "hard", failures: [],
      } satisfies EvalResult),
    };

    const unitTest = {
      name: "unit_test" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "unit_test", status: "pass", severity: "hard", failures: [],
      } satisfies EvalResult),
    };

    const consoleCheck = {
      name: "console" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "console", status: "pass", severity: "hard", failures: [],
      } satisfies EvalResult),
    };

    const e2e = {
      name: "e2e" as const,
      run: vi.fn().mockResolvedValue({
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [{ id: "FR-001", message: "Flow failed", evidence: [] }],
      } satisfies EvalResult),
    };

    const pipeline = new EvalPipeline([buildCheck, unitTest, consoleCheck, e2e]);
    const results = await pipeline.runAll("/workspace/test");

    expect(results.allHardConstraintsPassed).toBe(false);
    expect(results.results).toHaveLength(4);
    expect(results.failures).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/evaluator.test.ts
```

Expected: FAIL

- [ ] **Step 3: Evaluator 인터페이스 + 파이프라인 구현**

`orchestrator/src/evaluator/pipeline.ts`:
```typescript
import type { EvalResult } from "../types.js";

export interface Evaluator {
  name: "build" | "unit_test" | "console" | "e2e";
  run(workspace: string): Promise<EvalResult>;
}

export interface PipelineResult {
  allHardConstraintsPassed: boolean;
  results: EvalResult[];
  failures: EvalResult[];
}

// Evaluators that must pass before subsequent ones run
const BLOCKING_EVALUATORS = new Set(["build", "unit_test"]);

export class EvalPipeline {
  private evaluators: Evaluator[];

  constructor(evaluators: Evaluator[]) {
    this.evaluators = evaluators;
  }

  async runAll(workspace: string): Promise<PipelineResult> {
    const results: EvalResult[] = [];
    const failures: EvalResult[] = [];

    for (const evaluator of this.evaluators) {
      const result = await evaluator.run(workspace);
      results.push(result);

      if (result.status === "fail") {
        failures.push(result);

        if (BLOCKING_EVALUATORS.has(evaluator.name) && result.severity === "hard") {
          break;
        }
      }
    }

    const allHardConstraintsPassed = failures.every((f) => f.severity !== "hard");

    return { allHardConstraintsPassed, results, failures };
  }
}
```

- [ ] **Step 4: 빌드 체크 Evaluator 구현**

`orchestrator/src/evaluator/build-check.ts`:
```typescript
import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class BuildCheckEvaluator implements Evaluator {
  name = "build" as const;

  async run(workspace: string): Promise<EvalResult> {
    try {
      await execa("npm", ["run", "build"], { cwd: workspace, timeout: 120_000 });

      return {
        evaluator: "build",
        status: "pass",
        severity: "hard",
        failures: [],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        evaluator: "build",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "NFR-BUILD",
            message: `Build failed: ${message}`,
            evidence: [],
            repair_hint: message,
          },
        ],
      };
    }
  }
}
```

- [ ] **Step 5: 유닛 테스트 Evaluator 구현**

`orchestrator/src/evaluator/unit-test.ts`:
```typescript
import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class UnitTestEvaluator implements Evaluator {
  name = "unit_test" as const;

  async run(workspace: string): Promise<EvalResult> {
    try {
      await execa("npm", ["run", "test"], { cwd: workspace, timeout: 120_000 });

      return {
        evaluator: "unit_test",
        status: "pass",
        severity: "hard",
        failures: [],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        evaluator: "unit_test",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "NFR-UNIT-TEST",
            message: `Unit tests failed: ${message}`,
            evidence: [],
            repair_hint: message,
          },
        ],
      };
    }
  }
}
```

- [ ] **Step 6: 콘솔 에러 Evaluator 구현**

`orchestrator/src/evaluator/console-check.ts`:
```typescript
import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

const FATAL_PATTERNS = [
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /Uncaught/,
  /Unhandled/,
];

export class ConsoleCheckEvaluator implements Evaluator {
  name = "console" as const;

  async run(workspace: string): Promise<EvalResult> {
    try {
      // Run a Playwright script that navigates all pages and collects console errors
      const result = await execa(
        "npx",
        ["playwright", "test", "--project=console-check"],
        { cwd: workspace, timeout: 120_000, reject: false }
      );

      // Parse console errors from Playwright output
      const consoleErrors = this.parseConsoleErrors(result.stdout + result.stderr);

      if (consoleErrors.length === 0) {
        return {
          evaluator: "console",
          status: "pass",
          severity: "hard",
          failures: [],
        };
      }

      return {
        evaluator: "console",
        status: "fail",
        severity: "hard",
        failures: consoleErrors.map((err, i) => ({
          id: `CONSOLE-${i + 1}`,
          message: err,
          evidence: [],
          repair_hint: err,
        })),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        evaluator: "console",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "CONSOLE-ERROR",
            message: `Console check failed to run: ${message}`,
            evidence: [],
          },
        ],
      };
    }
  }

  private parseConsoleErrors(output: string): string[] {
    const lines = output.split("\n");
    return lines.filter((line) =>
      FATAL_PATTERNS.some((pattern) => pattern.test(line))
    );
  }
}
```

- [ ] **Step 7: E2E Evaluator 구현**

`orchestrator/src/evaluator/e2e.ts`:
```typescript
import { execa } from "execa";
import type { EvalResult } from "../types.js";
import type { Evaluator } from "./pipeline.js";

export class E2EEvaluator implements Evaluator {
  name = "e2e" as const;

  async run(workspace: string): Promise<EvalResult> {
    try {
      const result = await execa(
        "npx",
        ["playwright", "test", "--project=e2e", "--reporter=json"],
        { cwd: workspace, timeout: 300_000, reject: false }
      );

      const failures = this.parsePlaywrightResults(result.stdout);

      if (failures.length === 0) {
        return {
          evaluator: "e2e",
          status: "pass",
          severity: "hard",
          failures: [],
        };
      }

      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        evaluator: "e2e",
        status: "fail",
        severity: "hard",
        failures: [
          {
            id: "E2E-ERROR",
            message: `E2E tests failed to run: ${message}`,
            evidence: [],
          },
        ],
      };
    }
  }

  private parsePlaywrightResults(
    stdout: string
  ): { id: string; message: string; evidence: string[]; repair_hint?: string }[] {
    try {
      const report = JSON.parse(stdout);
      const failures: {
        id: string;
        message: string;
        evidence: string[];
        repair_hint?: string;
      }[] = [];

      for (const suite of report.suites ?? []) {
        for (const spec of suite.specs ?? []) {
          if (spec.ok === false) {
            const errorMessage = spec.tests?.[0]?.results?.[0]?.error?.message ?? "Unknown failure";
            failures.push({
              id: spec.title ?? "UNKNOWN",
              message: errorMessage,
              evidence: [],
              repair_hint: errorMessage,
            });
          }
        }
      }

      return failures;
    } catch {
      if (stdout.includes("fail")) {
        return [
          {
            id: "E2E-PARSE-ERROR",
            message: `E2E output could not be parsed: ${stdout.slice(0, 500)}`,
            evidence: [],
          },
        ];
      }
      return [];
    }
  }
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/evaluator.test.ts
```

Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add orchestrator/src/evaluator/
git add orchestrator/src/__tests__/evaluator.test.ts
git commit -m "feat: implement evaluator pipeline — build, unit test, console, e2e with early-exit on hard failure"
```

---

### Task 8: Reporter (리포트 생성)

**Files:**
- Create: `fde-agent/orchestrator/src/reporter.ts`
- Test: `fde-agent/orchestrator/src/__tests__/reporter.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/reporter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateSummary } from "../reporter.js";
import type { EvalResult, IterationState } from "../types.js";

describe("generateSummary", () => {
  it("should generate a success summary", () => {
    const state: IterationState = {
      run_id: "run_001",
      total_iterations: 3,
      max_iterations: 15,
      status: "completed",
      resumable: false,
      history: [
        { iteration: 1, passed: ["NFR-001"], failed: ["FR-001"] },
        { iteration: 2, passed: ["NFR-001"], failed: ["FR-001"] },
        { iteration: 3, passed: ["NFR-001", "FR-001"], failed: [] },
      ],
    };

    const finalResults: EvalResult[] = [
      { evaluator: "build", status: "pass", severity: "hard", failures: [] },
      { evaluator: "e2e", status: "pass", severity: "hard", failures: [] },
    ];

    const summary = generateSummary(state, finalResults, "resort-admin");
    expect(summary).toContain("통과");
    expect(summary).toContain("3회 반복");
    expect(summary).toContain("PASS");
  });

  it("should generate an escalation summary", () => {
    const state: IterationState = {
      run_id: "run_001",
      total_iterations: 5,
      max_iterations: 15,
      status: "escalated",
      escalation_reason: "env_issue: API_KEY not defined",
      resumable: true,
      history: [
        { iteration: 1, passed: ["NFR-001"], failed: ["FR-001"] },
        { iteration: 2, status: "escalated", reason: "env_issue" },
      ],
    };

    const summary = generateSummary(state, [], "resort-admin");
    expect(summary).toContain("Escalation");
    expect(summary).toContain("API_KEY");
    expect(summary).toContain("--resume");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/reporter.test.ts
```

Expected: FAIL

- [ ] **Step 3: Reporter 구현**

`orchestrator/src/reporter.ts`:
```typescript
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { EvalResult, IterationState } from "./types.js";

export function generateSummary(
  state: IterationState,
  finalResults: EvalResult[],
  projectName: string
): string {
  const lines: string[] = [];

  lines.push(`# ${projectName} — 검증 리포트`);
  lines.push("");

  if (state.status === "completed") {
    lines.push(`## 결과: 통과 (${state.total_iterations}회 반복)`);
    lines.push("");
    lines.push("| 항목 | 상태 | 비고 |");
    lines.push("|------|------|------|");

    for (const result of finalResults) {
      const status = result.status === "pass" ? "PASS" : "FAIL";
      lines.push(`| ${result.evaluator} | ${status} | |`);
    }
  } else if (state.status === "escalated") {
    lines.push(`## 결과: Escalation (${state.total_iterations}회 반복 후 중단)`);
    lines.push("");
    lines.push(`**사유:** ${state.escalation_reason ?? "알 수 없음"}`);
    lines.push("");
    lines.push("**재개 방법:**");
    lines.push("```bash");
    lines.push(`/fde-agent:run eval-spec.yaml --resume ${state.run_id}`);
    lines.push("```");
  }

  lines.push("");
  lines.push("## 반복 이력");

  for (const entry of state.history) {
    if (entry.status === "escalated") {
      lines.push(`- ${entry.iteration}회차: Escalation — ${entry.reason ?? ""}`);
    } else {
      const passed = entry.passed?.join(", ") ?? "";
      const failed = entry.failed?.join(", ") ?? "";
      lines.push(`- ${entry.iteration}회차: 통과=[${passed}] 실패=[${failed}]`);
    }
  }

  return lines.join("\n");
}

export async function writeReport(
  workspace: string,
  state: IterationState,
  finalResults: EvalResult[],
  projectName: string
): Promise<void> {
  const reportDir = join(workspace, "report");
  const metaDir = join(workspace, "meta");
  const evidenceDir = join(reportDir, "evidence");

  await mkdir(reportDir, { recursive: true });
  await mkdir(metaDir, { recursive: true });
  await mkdir(join(evidenceDir, "screenshots"), { recursive: true });
  await mkdir(join(evidenceDir, "videos"), { recursive: true });
  await mkdir(join(evidenceDir, "logs"), { recursive: true });

  const summary = generateSummary(state, finalResults, projectName);
  await writeFile(join(reportDir, "summary.md"), summary, "utf-8");
  await writeFile(
    join(reportDir, "eval-results.json"),
    JSON.stringify(finalResults, null, 2),
    "utf-8"
  );
  await writeFile(
    join(metaDir, "iterations.json"),
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/reporter.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/reporter.ts orchestrator/src/__tests__/reporter.test.ts
git commit -m "feat: implement reporter — summary.md, eval-results.json, iterations.json generation"
```

---

### Task 9: Resume 모듈

**Files:**
- Create: `fde-agent/orchestrator/src/resume.ts`
- Test: `fde-agent/orchestrator/src/__tests__/resume.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/resume.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadIterationState } from "../resume.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const testWorkspace = "/tmp/fde-agent-test-resume";

beforeEach(async () => {
  await mkdir(join(testWorkspace, "meta"), { recursive: true });
});

afterEach(async () => {
  await rm(testWorkspace, { recursive: true, force: true });
});

describe("loadIterationState", () => {
  it("should load existing iteration state", async () => {
    const state = {
      run_id: "run_001",
      total_iterations: 3,
      max_iterations: 15,
      status: "escalated",
      escalation_reason: "env_issue",
      resumable: true,
      history: [
        { iteration: 1, passed: ["NFR-001"], failed: ["FR-001"] },
      ],
    };
    await writeFile(
      join(testWorkspace, "meta", "iterations.json"),
      JSON.stringify(state),
      "utf-8"
    );

    const loaded = await loadIterationState(testWorkspace);
    expect(loaded.run_id).toBe("run_001");
    expect(loaded.total_iterations).toBe(3);
    expect(loaded.resumable).toBe(true);
  });

  it("should throw if iterations.json does not exist", async () => {
    await expect(loadIterationState("/tmp/nonexistent")).rejects.toThrow();
  });

  it("should throw if state is not resumable", async () => {
    const state = {
      run_id: "run_001",
      total_iterations: 15,
      max_iterations: 15,
      status: "completed",
      resumable: false,
      history: [],
    };
    await writeFile(
      join(testWorkspace, "meta", "iterations.json"),
      JSON.stringify(state),
      "utf-8"
    );

    await expect(loadIterationState(testWorkspace)).rejects.toThrow("not resumable");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/resume.test.ts
```

Expected: FAIL

- [ ] **Step 3: Resume 구현**

`orchestrator/src/resume.ts`:
```typescript
import { readFile } from "fs/promises";
import { join } from "path";
import { IterationStateSchema, type IterationState } from "./types.js";

export async function loadIterationState(workspace: string): Promise<IterationState> {
  const filePath = join(workspace, "meta", "iterations.json");
  const content = await readFile(filePath, "utf-8");
  const raw = JSON.parse(content);
  const state = IterationStateSchema.parse(raw);

  if (!state.resumable) {
    throw new Error(`Run ${state.run_id} is not resumable (status: ${state.status})`);
  }

  return state;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/resume.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/resume.ts orchestrator/src/__tests__/resume.test.ts
git commit -m "feat: implement resume module — load and validate iteration state for --resume"
```

---

### Task 10: Provisioner (Workspace 생성)

**Files:**
- Create: `fde-agent/orchestrator/src/provisioner.ts`
- Test: `fde-agent/orchestrator/src/__tests__/provisioner.test.ts`

- [ ] **Step 1: 테스트 작성**

`orchestrator/src/__tests__/provisioner.test.ts`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { Provisioner } from "../provisioner.js";
import { existsSync } from "fs";
import { readFile, rm } from "fs/promises";
import { join } from "path";

const testWorkspaceRoot = "/tmp/fde-agent-test-provision";
const testPresetDir = "/tmp/fde-agent-test-preset";

afterEach(async () => {
  await rm(testWorkspaceRoot, { recursive: true, force: true });
  await rm(testPresetDir, { recursive: true, force: true });
});

describe("Provisioner", () => {
  it("should create workspace directory with run_id", async () => {
    const provisioner = new Provisioner({
      workspaceRoot: testWorkspaceRoot,
      presetsDir: testPresetDir,
      palettesDir: "/tmp/palettes",
    });

    const workspace = await provisioner.create({
      runId: "run_001",
      preset: "admin-web",
      palette: "corporate-blue",
    });

    expect(existsSync(workspace)).toBe(true);
    expect(workspace).toContain("run_001");
  });

  it("should create meta directory in workspace", async () => {
    const provisioner = new Provisioner({
      workspaceRoot: testWorkspaceRoot,
      presetsDir: testPresetDir,
      palettesDir: "/tmp/palettes",
    });

    const workspace = await provisioner.create({
      runId: "run_002",
      preset: "admin-web",
      palette: "corporate-blue",
    });

    expect(existsSync(join(workspace, "meta"))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/provisioner.test.ts
```

Expected: FAIL

- [ ] **Step 3: Provisioner 구현**

`orchestrator/src/provisioner.ts`:
```typescript
import { mkdir, cp, readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

interface ProvisionerOptions {
  workspaceRoot: string;
  presetsDir: string;
  palettesDir: string;
}

interface ProvisionInput {
  runId: string;
  preset: string;
  palette: string;
}

export class Provisioner {
  private workspaceRoot: string;
  private presetsDir: string;
  private palettesDir: string;

  constructor(options: ProvisionerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.presetsDir = options.presetsDir;
    this.palettesDir = options.palettesDir;
  }

  async create(input: ProvisionInput): Promise<string> {
    const workspace = resolve(join(this.workspaceRoot, input.runId));

    // Create workspace
    await mkdir(workspace, { recursive: true });
    await mkdir(join(workspace, "meta"), { recursive: true });

    // Copy preset scaffold if exists
    const presetDir = join(this.presetsDir, input.preset, "core", "scaffold");
    if (existsSync(presetDir)) {
      await cp(presetDir, join(workspace, "app"), { recursive: true });
    } else {
      await mkdir(join(workspace, "app"), { recursive: true });
    }

    // Copy palette if exists
    const palettePath = join(this.palettesDir, `${input.palette}.json`);
    if (existsSync(palettePath)) {
      await cp(palettePath, join(workspace, "app", "design-tokens.json"));
    }

    // Copy preset rules (CLAUDE.md, protected-files.json) if exists
    const rulesDir = join(this.presetsDir, input.preset, "rules");
    if (existsSync(rulesDir)) {
      await cp(rulesDir, join(workspace, "app"), { recursive: true });
    }

    return workspace;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/provisioner.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add orchestrator/src/provisioner.ts orchestrator/src/__tests__/provisioner.test.ts
git commit -m "feat: implement provisioner — workspace creation with preset scaffold and palette copy"
```

---

### Task 11: 메인 루프 + CLI 진입점

**Files:**
- Create: `fde-agent/orchestrator/src/loop.ts`
- Create: `fde-agent/orchestrator/src/index.ts`
- Test: `fde-agent/orchestrator/src/__tests__/loop.test.ts`

- [ ] **Step 1: 메인 루프 테스트 작성**

`orchestrator/src/__tests__/loop.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { mainLoop } from "../loop.js";
import type { EvalSpec, EvalResult, BuildResult, IterationState } from "../types.js";
import type { BuilderInterface } from "../builder/interface.js";
import type { PipelineResult } from "../evaluator/pipeline.js";

const sampleSpec: EvalSpec = {
  project: "test",
  preset: "admin-web",
  palette: "warm-neutral",
  domain: {
    entities: [{ name: "고객", fields: ["이름"] }],
    key_flows: ["조회"],
  },
  requirements: [
    { id: "NFR-001", title: "빌드", severity: "hard", test_method: "build_check", description: "빌드 성공" },
  ],
  data_source: { type: "mock" },
  constraints: [],
};

describe("mainLoop", () => {
  it("should terminate when all hard constraints pass", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };

    const mockPipelineResult: PipelineResult = {
      allHardConstraintsPassed: true,
      results: [{ evaluator: "build", status: "pass", severity: "hard", failures: [] }],
      failures: [],
    };

    const mockEvalRunner = vi.fn().mockResolvedValue(mockPipelineResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/test",
      runId: "run_001",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 15,
      startIteration: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.total_iterations).toBe(1);
    expect(mockBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure up to max iterations", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };

    const failResult: PipelineResult = {
      allHardConstraintsPassed: false,
      results: [{ evaluator: "build", status: "fail", severity: "hard", failures: [{ id: "X", message: "fail", evidence: [] }] }],
      failures: [{ evaluator: "build", status: "fail", severity: "hard", failures: [{ id: "X", message: "fail", evidence: [] }] }],
    };

    const mockEvalRunner = vi.fn().mockResolvedValue(failResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/test",
      runId: "run_001",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 3,
      startIteration: 1,
    });

    expect(result.status).toBe("escalated");
    expect(result.total_iterations).toBe(3);
    expect(mockBuilder.execute).toHaveBeenCalledTimes(3);
  });

  it("should escalate immediately on env_issue", async () => {
    const mockBuilder: BuilderInterface = {
      execute: vi.fn().mockResolvedValue({ success: true, output: "" }),
    };

    const envFailResult: PipelineResult = {
      allHardConstraintsPassed: false,
      results: [{ evaluator: "console", status: "fail", severity: "hard", failures: [{ id: "X", message: "API_KEY is not defined", evidence: [] }] }],
      failures: [{ evaluator: "console", status: "fail", severity: "hard", failures: [{ id: "X", message: "API_KEY is not defined", evidence: [] }] }],
    };

    const mockEvalRunner = vi.fn().mockResolvedValue(envFailResult);

    const result = await mainLoop({
      evalSpec: sampleSpec,
      workspace: "/tmp/test",
      runId: "run_001",
      builder: mockBuilder,
      evalRunner: mockEvalRunner,
      maxIterations: 15,
      startIteration: 1,
    });

    expect(result.status).toBe("escalated");
    expect(result.escalation_reason).toContain("env_issue");
    expect(mockBuilder.execute).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx vitest run src/__tests__/loop.test.ts
```

Expected: FAIL

- [ ] **Step 3: 메인 루프 구현**

`orchestrator/src/loop.ts`:
```typescript
import type { EvalSpec, EvalResult, IterationState } from "./types.js";
import type { BuilderInterface } from "./builder/interface.js";
import type { PipelineResult } from "./evaluator/pipeline.js";
import { buildTaskContract } from "./task-contract.js";
import { classifyFailure } from "./classifier.js";

interface MainLoopInput {
  evalSpec: EvalSpec;
  workspace: string;
  runId: string;
  builder: BuilderInterface;
  evalRunner: (workspace: string) => Promise<PipelineResult>;
  maxIterations: number;
  startIteration: number;
}

export async function mainLoop(input: MainLoopInput): Promise<IterationState> {
  const {
    evalSpec,
    workspace,
    runId,
    builder,
    evalRunner,
    maxIterations,
    startIteration,
  } = input;

  const history: IterationState["history"] = [];
  let lastResults: EvalResult[] = [];
  let lastFailures: EvalResult[] = [];

  for (let i = startIteration; i <= maxIterations; i++) {
    // Build task contract
    const taskContract = buildTaskContract({
      evalSpec,
      workspace,
      runId,
      iteration: i,
      failures: lastFailures,
    });

    // Execute builder
    await builder.execute(taskContract);

    // Run evaluators
    const pipelineResult = await evalRunner(workspace);
    lastResults = pipelineResult.results;
    lastFailures = pipelineResult.failures;

    // Check for env_issue — escalate immediately
    const allFailureItems = pipelineResult.failures.flatMap((f) => f.failures);
    const hasEnvIssue = allFailureItems.some(
      (f) => classifyFailure(f) === "env_issue"
    );

    if (hasEnvIssue) {
      const envMessage = allFailureItems
        .filter((f) => classifyFailure(f) === "env_issue")
        .map((f) => f.message)
        .join("; ");

      history.push({ iteration: i, status: "escalated", reason: "env_issue" });

      return {
        run_id: runId,
        total_iterations: i,
        max_iterations: maxIterations,
        status: "escalated",
        escalation_reason: `env_issue: ${envMessage}`,
        resumable: true,
        history,
      };
    }

    // Record history
    const passed = pipelineResult.results
      .filter((r) => r.status === "pass")
      .map((r) => r.evaluator);
    const failed = pipelineResult.failures
      .flatMap((r) => r.failures)
      .map((f) => f.id);

    history.push({ iteration: i, passed, failed });

    // Check success
    if (pipelineResult.allHardConstraintsPassed) {
      return {
        run_id: runId,
        total_iterations: i,
        max_iterations: maxIterations,
        status: "completed",
        resumable: false,
        history,
      };
    }
  }

  // Max iterations exceeded
  return {
    run_id: runId,
    total_iterations: maxIterations,
    max_iterations: maxIterations,
    status: "escalated",
    escalation_reason: `Max iterations (${maxIterations}) exceeded`,
    resumable: true,
    history,
  };
}
```

- [ ] **Step 4: CLI 진입점 구현**

`orchestrator/src/index.ts`:
```typescript
import { parseArgs } from "util";
import { parseEvalSpec } from "./eval-spec-parser.js";
import { mainLoop } from "./loop.js";
import { Provisioner } from "./provisioner.js";
import { ClaudeCodeBuilder } from "./builder/claude-code.js";
import { EvalPipeline } from "./evaluator/pipeline.js";
import { BuildCheckEvaluator } from "./evaluator/build-check.js";
import { UnitTestEvaluator } from "./evaluator/unit-test.js";
import { ConsoleCheckEvaluator } from "./evaluator/console-check.js";
import { E2EEvaluator } from "./evaluator/e2e.js";
import { writeReport } from "./reporter.js";
import { loadIterationState } from "./resume.js";
import { resolve, dirname } from "path";

const MAX_ITERATIONS = 15;

async function main() {
  const { values } = parseArgs({
    options: {
      spec: { type: "string", short: "s" },
      resume: { type: "string", short: "r" },
    },
  });

  if (!values.spec) {
    console.error("Usage: fde-agent --spec <eval-spec.yaml> [--resume <run-id>]");
    process.exit(1);
  }

  const specPath = resolve(values.spec);
  const evalSpec = await parseEvalSpec(specPath);

  // Check external secrets
  if (evalSpec.external_secrets) {
    const missing = evalSpec.external_secrets
      .filter((s) => s.required && !process.env[s.name])
      .map((s) => `  - ${s.name}: ${s.description}`);

    if (missing.length > 0) {
      console.error("[FDE-AGENT] 다음 API 키가 필요합니다:");
      console.error(missing.join("\n"));
      console.error("환경변수로 설정 후 다시 실행해주세요.");
      process.exit(1);
    }
  }

  // Resolve plugin directory (two levels up from dist/index.js)
  const pluginDir = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

  const provisioner = new Provisioner({
    workspaceRoot: resolve("./workspace"),
    presetsDir: resolve(pluginDir, "presets"),
    palettesDir: resolve(pluginDir, "global", "palettes"),
  });

  const builder = new ClaudeCodeBuilder({
    systemPromptPath: resolve(pluginDir, "agents", "builder.md"),
  });

  const pipeline = new EvalPipeline([
    new BuildCheckEvaluator(),
    new UnitTestEvaluator(),
    new ConsoleCheckEvaluator(),
    new E2EEvaluator(),
  ]);

  let workspace: string;
  let startIteration = 1;
  const runId = values.resume ?? `run_${Date.now()}`;

  if (values.resume) {
    workspace = resolve("./workspace", values.resume);
    const prevState = await loadIterationState(workspace);
    startIteration = prevState.total_iterations + 1;
    console.log(`[FDE-AGENT] Resuming ${values.resume} from iteration ${startIteration}`);
  } else {
    workspace = await provisioner.create({
      runId,
      preset: evalSpec.preset,
      palette: evalSpec.palette,
    });
    console.log(`[FDE-AGENT] Workspace created: ${workspace}`);
  }

  console.log(`[FDE-AGENT] Starting eval loop (max ${MAX_ITERATIONS} iterations)`);

  const result = await mainLoop({
    evalSpec,
    workspace,
    runId,
    builder,
    evalRunner: (ws) => pipeline.runAll(ws),
    maxIterations: MAX_ITERATIONS,
    startIteration,
  });

  // Write report
  const finalResults = result.status === "completed"
    ? (await pipeline.runAll(workspace)).results
    : [];

  await writeReport(workspace, result, finalResults, evalSpec.project);

  if (result.status === "completed") {
    console.log(`[FDE-AGENT] 완료! ${result.total_iterations}회 반복 후 모든 검증 통과`);
    console.log(`[FDE-AGENT] 리포트: ${workspace}/report/summary.md`);
  } else {
    console.log(`[FDE-AGENT] Escalation: ${result.escalation_reason}`);
    console.log(`[FDE-AGENT] 재개: /fde-agent:run ${values.spec} --resume ${runId}`);
  }
}

main().catch((err) => {
  console.error("[FDE-AGENT] Fatal error:", err.message);
  process.exit(1);
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/__tests__/loop.test.ts
```

Expected: ALL PASS

- [ ] **Step 6: 빌드 확인**

```bash
cd orchestrator
npx tsc --noEmit
```

Expected: 컴파일 에러 없음

- [ ] **Step 7: Commit**

```bash
git add orchestrator/src/loop.ts orchestrator/src/index.ts orchestrator/src/__tests__/loop.test.ts
git commit -m "feat: implement main loop with env_issue escalation + CLI entry point"
```

---

### Task 12: 글로벌 팔레트 생성

**Files:**
- Create: `fde-agent/global/palettes/corporate-blue.json`
- Create: `fde-agent/global/palettes/warm-neutral.json`
- Create: `fde-agent/global/palettes/dark-modern.json`

- [ ] **Step 1: corporate-blue 팔레트 생성**

`global/palettes/corporate-blue.json`:
```json
{
  "name": "Corporate Blue",
  "description": "신뢰/전문 느낌 — 금융, 컨설팅, B2B",
  "colors": {
    "background": "#FFFFFF",
    "foreground": "#0F172A",
    "card": "#F8FAFC",
    "card-foreground": "#0F172A",
    "primary": "#1E40AF",
    "primary-foreground": "#FFFFFF",
    "secondary": "#E2E8F0",
    "secondary-foreground": "#334155",
    "muted": "#F1F5F9",
    "muted-foreground": "#64748B",
    "accent": "#DBEAFE",
    "accent-foreground": "#1E40AF",
    "destructive": "#DC2626",
    "destructive-foreground": "#FFFFFF",
    "border": "#CBD5E1",
    "input": "#CBD5E1",
    "ring": "#1E40AF",
    "sidebar": "#F8FAFC",
    "sidebar-foreground": "#334155",
    "sidebar-accent": "#1E40AF"
  },
  "radius": "0.5rem",
  "font": {
    "sans": "Inter, Pretendard, sans-serif"
  }
}
```

- [ ] **Step 2: warm-neutral 팔레트 생성**

`global/palettes/warm-neutral.json`:
```json
{
  "name": "Warm Neutral",
  "description": "부드러운 느낌 — 리조트, 호텔, 라이프스타일",
  "colors": {
    "background": "#FAFAF9",
    "foreground": "#1C1917",
    "card": "#FFFFFF",
    "card-foreground": "#1C1917",
    "primary": "#A16207",
    "primary-foreground": "#FFFFFF",
    "secondary": "#F5F5F4",
    "secondary-foreground": "#44403C",
    "muted": "#F5F5F4",
    "muted-foreground": "#78716C",
    "accent": "#FEF3C7",
    "accent-foreground": "#A16207",
    "destructive": "#DC2626",
    "destructive-foreground": "#FFFFFF",
    "border": "#D6D3D1",
    "input": "#D6D3D1",
    "ring": "#A16207",
    "sidebar": "#FAFAF9",
    "sidebar-foreground": "#44403C",
    "sidebar-accent": "#A16207"
  },
  "radius": "0.75rem",
  "font": {
    "sans": "Noto Sans KR, Pretendard, sans-serif"
  }
}
```

- [ ] **Step 3: dark-modern 팔레트 생성**

`global/palettes/dark-modern.json`:
```json
{
  "name": "Dark Modern",
  "description": "모던/테크 느낌 — IT, 스타트업, SaaS",
  "colors": {
    "background": "#09090B",
    "foreground": "#FAFAFA",
    "card": "#18181B",
    "card-foreground": "#FAFAFA",
    "primary": "#6366F1",
    "primary-foreground": "#FFFFFF",
    "secondary": "#27272A",
    "secondary-foreground": "#A1A1AA",
    "muted": "#27272A",
    "muted-foreground": "#71717A",
    "accent": "#312E81",
    "accent-foreground": "#C7D2FE",
    "destructive": "#EF4444",
    "destructive-foreground": "#FFFFFF",
    "border": "#3F3F46",
    "input": "#3F3F46",
    "ring": "#6366F1",
    "sidebar": "#18181B",
    "sidebar-foreground": "#A1A1AA",
    "sidebar-accent": "#6366F1"
  },
  "radius": "0.375rem",
  "font": {
    "sans": "Geist, Pretendard, sans-serif"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add global/
git commit -m "feat: add 3 global palettes — corporate-blue, warm-neutral, dark-modern"
```

---

### Task 13: Builder Agent 프롬프트 + Test Writer Agent 프롬프트

**Files:**
- Create: `fde-agent/agents/builder.md`
- Create: `fde-agent/agents/test-writer.md`

- [ ] **Step 1: Builder agent 프롬프트 작성**

`agents/builder.md`:
```markdown
# FDE Agent Builder

You are a Builder agent for the FDE Harness Agent system. You receive a task contract and generate or repair a web prototype.

## Rules

### Code Quality
- Use React + TypeScript + Next.js (App Router)
- Use shadcn/ui components only — do not install other UI libraries
- Follow the design tokens in design-tokens.json for all colors, fonts, and spacing
- Follow the layout patterns in the workspace — do not create new layout structures

### Testing
- Every domain logic function MUST have a corresponding unit test
- Every API route/handler MUST have a test
- Tests go in __tests__ directories adjacent to the source files
- Use vitest for unit tests
- npm run test must pass before you consider your work done

### Data Layer
- Use Prisma ORM only — never write raw SQL
- Never use deleteMany or updateMany — single-record operations only
- Always use findUnique before delete operations

### Protected Files
- Never modify files listed in protected_files
- Never modify design-tokens.json or layout.tsx

### Iteration Behavior
- If failing_checks is empty: this is the first iteration. Generate the full prototype.
- If failing_checks is present: focus on fixing the listed issues. Do not rewrite unrelated code.
- Read repair_hints carefully — they contain specific guidance on what to fix.

### What to Output
- Working code changes
- Updated or new tests
- A brief summary of what you changed (as the last message)
```

- [ ] **Step 2: Test Writer agent 프롬프트 작성**

`agents/test-writer.md`:
```markdown
# FDE Agent Test Writer

You are a Test Writer agent for the FDE Harness Agent system. You write E2E tests (Playwright) for a web prototype that you did NOT build.

## Your Role
- You receive a workspace with a built web application and an eval spec
- You write Playwright E2E test scenarios that verify the requirements in the eval spec
- You are INDEPENDENT from the Builder — you test what exists, not what was intended

## Rules

### Test Design
- Write Playwright tests in the e2e/ directory of the workspace
- Each requirement with test_method: e2e gets its own test file
- Test the actual user flow: navigate, click, fill forms, verify results
- Use realistic assertions — check for visible text, form submissions, navigation

### Test Patterns
- Use page-patterns templates from the preset as a starting point
- Adapt templates to the actual domain entities and flows in the eval spec
- If a page doesn't exist or a button doesn't work, the test should FAIL (that's the point)

### What NOT to Do
- Do not modify the application code
- Do not look at the Builder's test files — write your own independently
- Do not make tests that always pass — they must actually verify functionality

### Output
- Playwright test files in e2e/ directory
- A brief summary of which requirements each test covers
```

- [ ] **Step 3: Commit**

```bash
git add agents/
git commit -m "feat: add builder and test-writer agent system prompts"
```

---

### Task 14: Hooks 설정

**Files:**
- Create: `fde-agent/hooks/hooks.json`

- [ ] **Step 1: Hooks 설정 파일 생성**

`hooks/hooks.json`:
```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matcher": {
        "tool_name": "Edit"
      },
      "command": "bash -c 'if grep -rn \"deleteMany\\|updateMany\" --include=\"*.ts\" --include=\"*.tsx\" src/ 2>/dev/null; then echo \"ERROR: Bulk DB operations (deleteMany/updateMany) are not allowed. Use single-record operations.\" && exit 1; fi && if grep -rn \"\\$queryRaw\\|\\$executeRaw\\|sql\\`\" --include=\"*.ts\" --include=\"*.tsx\" src/ 2>/dev/null; then echo \"ERROR: Raw SQL detected. Use Prisma ORM only.\" && exit 1; fi'"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/
git commit -m "feat: add hooks — block raw SQL and bulk DB operations on file edit"
```

---

### Task 15: admin-web Preset Rules

**Files:**
- Create: `fde-agent/presets/admin-web/rules/CLAUDE.md`
- Create: `fde-agent/presets/admin-web/rules/protected-files.json`

- [ ] **Step 1: Builder CLAUDE.md 규칙 생성**

`presets/admin-web/rules/CLAUDE.md`:
```markdown
# Admin Web Preset — Builder Rules

## Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- shadcn/ui for all UI components
- Tailwind CSS for styling — use design tokens only, no arbitrary values
- Prisma ORM for data access — no raw SQL
- vitest for unit/component tests

## Layout
- Use the existing AdminLayout (sidebar + header)
- Sidebar: navigation menu with role-based visibility
- Header: page title + user info
- Do not create alternative layouts

## Page Patterns
Use these patterns for all pages:

### List Page
- DataTable component with sorting, filtering, search
- Pagination
- Row click navigates to detail

### Detail Page
- Card-based layout showing entity fields
- Action buttons (edit, status change, delete)
- Back navigation

### Form Page
- FormBuilder component with validation
- Required field indicators
- Error messages inline
- Submit saves and navigates to detail

### Dashboard Page
- StatCard components for key metrics
- Use grid layout (2-3 columns desktop, 1 column mobile)

## Data Layer
- Use Prisma ORM exclusively
- Never use deleteMany, updateMany — single-record operations only
- Always findUnique before delete
- All mutations must validate input with zod

## Testing
- Every domain logic function must have a unit test
- Every form must have validation tests
- npm run test must pass at all times

## Style
- Use design-tokens.json for all colors — never hardcode colors
- Korean language for all user-facing text
- Consistent spacing: use Tailwind spacing scale only
```

- [ ] **Step 2: Protected files 생성**

`presets/admin-web/rules/protected-files.json`:
```json
{
  "protected": [
    "design-tokens.json",
    "app/layout.tsx",
    "components/ui/**",
    "lib/auth/**",
    "prisma/schema.prisma"
  ],
  "description": "These files are part of the preset core and must not be modified by the Builder"
}
```

- [ ] **Step 3: Commit**

```bash
git add presets/
git commit -m "feat: add admin-web preset rules — CLAUDE.md and protected files"
```

---

### Task 16: 전체 빌드 + 통합 확인

**Files:**
- Modify: `fde-agent/orchestrator/package.json` (add build script verification)

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd orchestrator
npx vitest run
```

Expected: ALL TESTS PASS

- [ ] **Step 2: TypeScript 빌드**

```bash
npx tsc
```

Expected: dist/ 디렉터리에 JS 파일 생성, 에러 없음

- [ ] **Step 3: 빌드된 CLI 실행 확인 (help)**

```bash
node dist/index.js
```

Expected: Usage 메시지 출력

- [ ] **Step 4: 전체 커밋**

```bash
git add .
git commit -m "feat: verify full build — all tests pass, TypeScript compiles, CLI runs"
```

---

## Summary

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | 프로젝트 초기화 + Plugin 구조 | — |
| 2 | 타입 정의 (Zod schemas) | 1 |
| 3 | Eval Spec 파서 | 2 |
| 4 | 에러 분류기 | 2 |
| 5 | Task Contract 빌더 | 2 |
| 6 | Builder Interface + Claude Code Builder | 2 |
| 7 | Evaluator 파이프라인 (4개 evaluator) | 2 |
| 8 | Reporter (리포트 생성) | 2 |
| 9 | Resume 모듈 | 2 |
| 10 | Provisioner (Workspace 생성) | 2 |
| 11 | 메인 루프 + CLI 진입점 | 3,4,5,6,7,8,9,10 |
| 12 | 글로벌 팔레트 | 1 |
| 13 | Agent 프롬프트 (Builder + Test Writer) | 1 |
| 14 | Hooks 설정 | 1 |
| 15 | admin-web Preset Rules | 1 |
| 16 | 전체 빌드 + 통합 확인 | 전체 |

**Task 2~10은 독립적으로 병렬 진행 가능. Task 11은 모두 완료 후. Task 12~15도 독립적.**
