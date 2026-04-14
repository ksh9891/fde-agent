# Phase 2B: Entity slug + acceptance_criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entity에 `slug` required 필드를 추가해 하드코딩 맵 3곳을 제거하고, Requirement에 optional `acceptance_criteria` 배열을 추가해 E2E 테스트 생성의 구체성을 높인다.

**Architecture:** EntitySchema에 slug를 추가하고 모든 소비 코드(index.ts, provisioner.ts, reporter.ts)에서 하드코딩 맵 대신 entity.slug를 사용한다. RequirementSchema에 acceptance_criteria optional 배열을 추가하고 Test Writer contract에 전달한다. 스키마 변경이 파급되므로 모든 테스트 파일의 entity fixture에 slug를 추가해야 한다.

**Tech Stack:** TypeScript, Zod, Vitest

---

## File Structure

| 파일 | 변경 유형 | 책임 |
|---|---|---|
| `src/types.ts` | Modify (L7-9, L17-22) | EntitySchema에 slug, RequirementSchema에 acceptance_criteria |
| `src/index.ts` | Modify (L81-132) | entitySlugMap 제거, entity.slug 사용 |
| `src/provisioner.ts` | Modify (L11-22, L80, L87, L95-98, L111, L475-521, L588-607) | EntityDef에 slug, slugMap 파라미터 제거 |
| `src/reporter.ts` | Modify (L48-59, L68) | ENTITY_SLUG_MAP 제거, entity.slug 사용 |
| `src/test-generation-stage.ts` | Modify (L6-12, L15-18) | RequirementInfo에 acceptance_criteria |
| `agents/test-writer.md` | Modify | acceptance_criteria 활용 규칙 추가 |
| `examples/resort-admin-spec.yaml` | Modify | slug + acceptance_criteria 추가 |
| `src/__tests__/types.test.ts` | Modify | entity에 slug, requirement에 acceptance_criteria 테스트 |
| `src/__tests__/loop.test.ts` | Modify | sampleSpec entity에 slug 추가 |
| `src/__tests__/builder.test.ts` | Modify | entity에 slug 추가 |
| `src/__tests__/task-contract.test.ts` | Modify | entity에 slug 추가 |
| `src/__tests__/test-generation-stage.test.ts` | Modify | entity에 slug, acceptance_criteria 테스트 |
| `src/__tests__/reporter.enhanced.test.ts` | Modify | entity에 slug, ENTITY_SLUG_MAP 관련 변경 |
| `src/__tests__/e2e-evaluator.test.ts` | No change | entity 사용 안 함 |
| `src/__tests__/provisioner.test.ts` | Modify | entity에 slug 추가 |

---

### Task 1: EntitySchema에 slug 추가 + RequirementSchema에 acceptance_criteria 추가

**Files:**
- Modify: `src/types.ts:7-9, 17-22`
- Test: `src/__tests__/types.test.ts`

- [ ] **Step 1: types.test.ts에 slug + acceptance_criteria 테스트 추가**

파일 내 `minimalDomain` (L13-16)에 slug를 추가:

```typescript
const minimalDomain = {
  entities: [{ name: "User", slug: "users", fields: ["id", "email"] }],
  key_flows: ["login", "signup"],
};
```

`EvalSpecSchema` describe 블록 끝에 추가:

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/types.test.ts`
Expected: "rejects spec with entity missing slug" 테스트 실패 (slug가 아직 required가 아님), minimalDomain에 slug가 있어도 스키마가 unknown key를 무시하므로 다른 테스트는 통과할 수 있음

- [ ] **Step 3: types.ts 수정**

`src/types.ts` L7-9:

```typescript
const EntitySchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
});
```

를 다음으로 교체:

```typescript
const EntitySchema = z.object({
  name: z.string(),
  slug: z.string(),
  fields: z.array(z.string()),
});
```

L17-22:

```typescript
export const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["hard", "soft"]),
  test_method: z.enum(["e2e", "build_check", "console_check", "unit_test"]),
  description: z.string(),
});
```

를 다음으로 교체:

```typescript
export const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["hard", "soft"]),
  test_method: z.enum(["e2e", "build_check", "console_check", "unit_test"]),
  description: z.string(),
  acceptance_criteria: z.array(z.string()).optional(),
});
```

- [ ] **Step 4: 테스트 실행 — 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/types.test.ts`
Expected: 새 테스트 3개 PASS. 하지만 기존 테스트 중 entity에 slug가 없는 것들이 실패할 수 있음.

**기존 테스트 중 slug 누락으로 실패하는 것들을 모두 수정한다:**

`src/__tests__/types.test.ts`에서 entity fixture가 등장하는 모든 곳에 slug를 추가해야 한다. 위의 `minimalDomain`은 이미 수정했으므로, 나머지 파일 내에서 `{ name: ..., fields: ... }` 형태의 entity가 있으면 slug를 추가.

- [ ] **Step 5: 전체 types 테스트 통과 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/types.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/types.ts orchestrator/src/__tests__/types.test.ts && git commit -m "feat: add slug to EntitySchema, acceptance_criteria to RequirementSchema"
```

---

### Task 2: 모든 테스트 파일의 entity fixture에 slug 추가

이 Task는 스키마 변경 파급으로 깨진 테스트를 수정합니다. types.test.ts는 Task 1에서 수정했으므로 나머지만.

**Files:**
- Modify: `src/__tests__/loop.test.ts:12`
- Modify: `src/__tests__/builder.test.ts:12`
- Modify: `src/__tests__/task-contract.test.ts:10`
- Modify: `src/__tests__/test-generation-stage.test.ts:13, 35, 52, 72`
- Modify: `src/__tests__/reporter.enhanced.test.ts:10-12`
- Modify: `src/__tests__/provisioner.test.ts` (entity fixture가 있다면)

- [ ] **Step 1: loop.test.ts 수정**

L12: `entities: [{ name: "고객", fields: ["이름"] }],`
→ `entities: [{ name: "고객", slug: "customers", fields: ["이름"] }],`

- [ ] **Step 2: builder.test.ts 수정**

L12: `domain: { entities: [{ name: "고객", fields: ["이름"] }], key_flows: ["조회"] },`
→ `domain: { entities: [{ name: "고객", slug: "customers", fields: ["이름"] }], key_flows: ["조회"] },`

- [ ] **Step 3: task-contract.test.ts 수정**

L10: `entities: [{ name: "예약", fields: ["예약번호", "상태"] }],`
→ `entities: [{ name: "예약", slug: "reservations", fields: ["예약번호", "상태"] }],`

- [ ] **Step 4: test-generation-stage.test.ts 수정**

L13: `entities: [{ name: "예약", fields: ["예약번호", "고객명"] }],`
→ `entities: [{ name: "예약", slug: "reservations", fields: ["예약번호", "고객명"] }],`

L35: `entities: [{ name: "예약", fields: ["예약번호"] }],`
→ `entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],`

L52: `entities: [{ name: "예약", fields: ["예약번호"] }],`
→ `entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],`

L72: `entities: [{ name: "예약", fields: ["예약번호"] }],`
→ `entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],`

- [ ] **Step 5: reporter.enhanced.test.ts 수정**

L11-12:
```typescript
      { name: "객실", fields: ["객실번호", "타입"] },
      { name: "예약", fields: ["예약번호", "고객명"] },
```
→
```typescript
      { name: "객실", slug: "rooms", fields: ["객실번호", "타입"] },
      { name: "예약", slug: "reservations", fields: ["예약번호", "고객명"] },
```

- [ ] **Step 6: provisioner.test.ts 확인 및 수정**

entity fixture가 있으면 slug 추가. 없으면 스킵.

- [ ] **Step 7: 전체 테스트 실행**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run`
Expected: 스키마 변경 관련 테스트 실패만 남아있어야 함 (index.ts, provisioner.ts 등 실제 코드 변경은 아직 안 했으므로 빌드는 실패할 수 있음). 하지만 테스트 파일들은 모두 통과해야 함.

- [ ] **Step 8: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/__tests__/loop.test.ts orchestrator/src/__tests__/builder.test.ts orchestrator/src/__tests__/task-contract.test.ts orchestrator/src/__tests__/test-generation-stage.test.ts orchestrator/src/__tests__/reporter.enhanced.test.ts orchestrator/src/__tests__/provisioner.test.ts && git commit -m "test: add slug to all entity fixtures for EntitySchema change"
```

---

### Task 3: index.ts — entitySlugMap 제거 + entity.slug 사용

**Files:**
- Modify: `src/index.ts:81-132`

- [ ] **Step 1: entitySlugMap 제거 및 entity.slug 사용**

L81-92 (entitySlugMap 상수)를 완전 삭제.

L94-98:
```typescript
  const requiredPages = ["dashboard"];
  for (const entity of evalSpec.domain.entities) {
    const slug = entitySlugMap[entity.name] ?? entity.name.toLowerCase();
    requiredPages.push(slug);
  }
```
→
```typescript
  const requiredPages = ["dashboard"];
  for (const entity of evalSpec.domain.entities) {
    requiredPages.push(entity.slug);
  }
```

L127-133 (provisioner.create 호출):
```typescript
    workspace = await provisioner.create({
      runId,
      preset: evalSpec.preset,
      palette: evalSpec.palette,
      entities: evalSpec.domain.entities,
      entitySlugMap: entitySlugMap,
    });
```
→
```typescript
    workspace = await provisioner.create({
      runId,
      preset: evalSpec.preset,
      palette: evalSpec.palette,
      entities: evalSpec.domain.entities,
    });
```

L155-158 (afterFirstBuild 내 testGenerationStage.execute 호출) — `entities` 전달은 이미 `evalSpec.domain.entities`를 보내고 있으므로 slug가 자동으로 포함됨. 변경 불필요.

L156-158 (requirements map)에 acceptance_criteria도 포함하도록 변경:
```typescript
        requirements: evalSpec.requirements
          .filter((r) => r.test_method === "e2e")
          .map((r) => ({ id: r.id, title: r.title, severity: r.severity })),
```
→
```typescript
        requirements: evalSpec.requirements
          .filter((r) => r.test_method === "e2e")
          .map((r) => ({ id: r.id, title: r.title, severity: r.severity, acceptance_criteria: r.acceptance_criteria })),
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build`
Expected: provisioner.ts의 EntityDef와 ProvisionInput도 변경 필요하므로 빌드 실패할 수 있음. Task 4에서 해결.

- [ ] **Step 3: 커밋 (빌드 실패해도 논리적 단위로 커밋)**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/index.ts && git commit -m "refactor: remove entitySlugMap hardcoding, use entity.slug directly"
```

---

### Task 4: provisioner.ts — entitySlugMap 제거 + entity.slug 사용

**Files:**
- Modify: `src/provisioner.ts:11-22, 80, 87, 95-111, 475-521, 588-607`

- [ ] **Step 1: EntityDef에 slug 추가, ProvisionInput에서 entitySlugMap 제거**

L11-22:
```typescript
interface EntityDef {
  name: string;
  fields: string[];
}

interface ProvisionInput {
  runId: string;
  preset: string;
  palette: string;
  entities?: EntityDef[];
  entitySlugMap?: Record<string, string>;
}
```
→
```typescript
interface EntityDef {
  name: string;
  slug: string;
  fields: string[];
}

interface ProvisionInput {
  runId: string;
  preset: string;
  palette: string;
  entities?: EntityDef[];
}
```

- [ ] **Step 2: create 메서드에서 entitySlugMap 참조 제거**

L80: `await this.generateEntitySkeletons(appDir, input.entities, input.entitySlugMap ?? {});`
→ `await this.generateEntitySkeletons(appDir, input.entities);`

L87: `await this.generateTemplateE2ETests(appDir, input.entities, input.entitySlugMap ?? {}, testPackDir);`
→ `await this.generateTemplateE2ETests(appDir, input.entities, testPackDir);`

- [ ] **Step 3: generateEntitySkeletons 시그니처 변경**

L95-98:
```typescript
  private async generateEntitySkeletons(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>
  ): Promise<void> {
```
→
```typescript
  private async generateEntitySkeletons(
    appDir: string,
    entities: EntityDef[],
  ): Promise<void> {
```

L111: `const slug = slugMap[entity.name] ?? entity.name.toLowerCase();`
→ `const slug = entity.slug;`

- [ ] **Step 4: generateSeedRoute 시그니처 변경**

L475-478:
```typescript
  private async generateSeedRoute(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>
  ): Promise<void> {
```
→
```typescript
  private async generateSeedRoute(
    appDir: string,
    entities: EntityDef[],
  ): Promise<void> {
```

L485: `const slug = slugMap[e.name] ?? e.name.toLowerCase();`
→ `const slug = e.slug;`

L492: `const slug = slugMap[e.name] ?? e.name.toLowerCase();`
→ `const slug = e.slug;`

- [ ] **Step 5: updateAdminLayout 시그니처 변경**

L511-514:
```typescript
  private async updateAdminLayout(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>
  ): Promise<void> {
```
→
```typescript
  private async updateAdminLayout(
    appDir: string,
    entities: EntityDef[],
  ): Promise<void> {
```

L521: `const slug = slugMap[e.name] ?? e.name.toLowerCase();`
→ `const slug = e.slug;`

- [ ] **Step 6: generateTemplateE2ETests 시그니처 변경**

L589-593:
```typescript
  private async generateTemplateE2ETests(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>,
    testPackDir: string
  ): Promise<void> {
```
→
```typescript
  private async generateTemplateE2ETests(
    appDir: string,
    entities: EntityDef[],
    testPackDir: string,
  ): Promise<void> {
```

L607: `const slug = slugMap[entity.name] ?? entity.name.toLowerCase();`
→ `const slug = entity.slug;`

- [ ] **Step 7: generateEntitySkeletons 내부의 generateSeedRoute, updateAdminLayout 호출에서 slugMap 제거**

이 호출들은 generateEntitySkeletons 내부에 있음. slugMap을 전달하지 않도록 변경. 코드를 grep해서 찾아 수정:

`await this.generateSeedRoute(appDir, entities, slugMap);`
→ `await this.generateSeedRoute(appDir, entities);`

`await this.updateAdminLayout(appDir, entities, slugMap);`
→ `await this.updateAdminLayout(appDir, entities);`

- [ ] **Step 8: 빌드 + 테스트**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 모든 테스트 PASS

- [ ] **Step 9: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/provisioner.ts && git commit -m "refactor: remove slugMap from Provisioner, use entity.slug directly"
```

---

### Task 5: reporter.ts — ENTITY_SLUG_MAP 제거

**Files:**
- Modify: `src/reporter.ts:48-68`

- [ ] **Step 1: ENTITY_SLUG_MAP 상수 제거**

L48-59 (ENTITY_SLUG_MAP 상수)를 완전 삭제.

- [ ] **Step 2: buildCoverageFromSpecs에서 entity.slug 사용**

L68: `const slug = ENTITY_SLUG_MAP[entity.name] ?? entity.name.toLowerCase();`
→ `const slug = entity.slug;`

`EvalSpec`의 entity에 slug가 있으므로 이 한 줄만 바꾸면 됨.

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/reporter.ts && git commit -m "refactor: remove ENTITY_SLUG_MAP from reporter, use entity.slug"
```

---

### Task 6: TestGenerationStage — acceptance_criteria 전달 + test-writer.md 업데이트

**Files:**
- Modify: `src/test-generation-stage.ts:6-18`
- Modify: `agents/test-writer.md`
- Test: `src/__tests__/test-generation-stage.test.ts`

- [ ] **Step 1: test-generation-stage.test.ts에 acceptance_criteria 테스트 추가**

기존 테스트 끝에 추가:

```typescript
  it("should include acceptance_criteria in the contract when provided", () => {
    const stage = new TestGenerationStage({
      systemPromptPath: "/plugin/agents/test-writer.md",
    });

    const command = stage.buildCommand({
      workspace: "/workspace/app",
      keyFlows: ["신규 예약 등록"],
      entities: [{ name: "예약", slug: "reservations", fields: ["예약번호"] }],
      requirements: [
        {
          id: "FR-001",
          title: "신규 예약 등록",
          severity: "hard",
          acceptance_criteria: ["폼에서 입력 가능", "저장 후 목록에 표시"],
        },
      ],
    });

    const contractArg = command.args[command.args.length - 1];
    expect(contractArg).toContain("폼에서 입력 가능");
    expect(contractArg).toContain("저장 후 목록에 표시");
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npx vitest run src/__tests__/test-generation-stage.test.ts`
Expected: RequirementInfo에 acceptance_criteria가 없으므로 TypeScript 에러 또는 contract에 미포함

- [ ] **Step 3: test-generation-stage.ts 수정**

L6-12 (RequirementInfo):
```typescript
interface RequirementInfo {
  id: string;
  title: string;
  severity: string;
}
```
→
```typescript
interface RequirementInfo {
  id: string;
  title: string;
  severity: string;
  acceptance_criteria?: string[];
}
```

TestGenerationInput의 entities 타입도 slug를 포함하도록 (L15-18):
```typescript
interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  requirements: RequirementInfo[];
}
```
→
```typescript
interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; slug: string; fields: string[] }>;
  requirements: RequirementInfo[];
}
```

TestGenerationContract의 entities도 동일하게 slug 포함으로 변경.

- [ ] **Step 4: test-writer.md에 acceptance_criteria 규칙 추가**

`agents/test-writer.md`의 `### Requirement Tagging` 섹션 뒤에 추가:

```markdown
### Using Acceptance Criteria
- If a requirement has acceptance_criteria, each criterion should map to at least one test assertion
- Write test steps that directly verify each criterion
- If no acceptance_criteria provided, use the description to infer test scenarios
```

- [ ] **Step 5: 테스트 실행 + 빌드**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add orchestrator/src/test-generation-stage.ts orchestrator/src/__tests__/test-generation-stage.test.ts agents/test-writer.md && git commit -m "feat: add acceptance_criteria to TestGenerationStage contract + test-writer rules"
```

---

### Task 7: eval spec 예제 업데이트

**Files:**
- Modify: `examples/resort-admin-spec.yaml`

- [ ] **Step 1: slug + acceptance_criteria 추가**

`examples/resort-admin-spec.yaml` 전체를 다음으로 교체:

```yaml
project: resort-admin-prototype
preset: admin-web
palette: warm-neutral

domain:
  entities:
    - name: 객실
      slug: rooms
      fields: [객실번호, 타입, 층, 상태, 가격]
    - name: 예약
      slug: reservations
      fields: [예약번호, 고객명, 객실, 체크인, 체크아웃, 상태]
    - name: 고객
      slug: customers
      fields: [고객번호, 이름, 연락처, 등급]

  key_flows:
    - 예약 목록 조회 및 필터링
    - 예약 상세 보기
    - 신규 예약 등록
    - 예약 상태 변경 (확정/취소)
    - 고객 목록 조회
    - 대시보드 (오늘 체크인/체크아웃 현황)

requirements:
  - id: FR-001
    title: 신규 예약 등록
    severity: hard
    test_method: e2e
    description: 객실 선택 → 고객 정보 입력 → 저장까지 완료 가능
    acceptance_criteria:
      - "예약 등록 폼에서 객실, 체크인/체크아웃, 고객명을 입력할 수 있다"
      - "저장 후 예약 목록에 새 항목이 추가된다"
      - "필수 필드 미입력 시 에러 메시지가 표시된다"

  - id: FR-002
    title: 예약 목록 조회
    severity: hard
    test_method: e2e
    description: 예약 목록을 테이블로 조회하고 검색할 수 있다
    acceptance_criteria:
      - "예약 목록 페이지에 테이블이 표시된다"
      - "검색창에 입력하면 테이블이 필터링된다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check
    description: npm run build가 성공해야 한다

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
  - 한국어 UI
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/kimsanghyun/develop/AI/fde-agent && git add examples/resort-admin-spec.yaml && git commit -m "docs: add slug and acceptance_criteria to resort-admin eval spec example"
```

---

### Task 8: 최종 통합 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 빌드 + 테스트**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent/orchestrator && npm run build && npm run test`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 2: 변경 커밋 확인**

Run: `cd /Users/kimsanghyun/develop/AI/fde-agent && git log --oneline -7`
Expected: Task 1~7의 커밋이 순서대로 보임
