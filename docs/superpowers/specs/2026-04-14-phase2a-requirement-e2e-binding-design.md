# Phase 2A: requirement_id 기반 E2E 매칭 + Test Writer blocking

> 상태: Approved
> 작성일: 2026-04-14
> 관련: 피드백 #4 (E2E 매칭 취약), #5 (Test Writer non-blocking)

## 목적

E2E 테스트 실패의 severity를 requirement에 정확하게 연결하고, hard requirement의 테스트 생성 실패를 blocking으로 처리한다.

## 범위

| 포함 | 제외 |
|------|------|
| key_flow 테스트에 @requirement_id tag 규약 도입 | 템플릿 테스트의 requirement 매핑 (soft 유지) |
| E2E evaluator의 tag 기반 severity 매칭 | Eval Spec 스키마 변경 (Phase 2B) |
| Test Writer contract에 tag 규약 강제 | Page Check 강화 (Phase 2C) |
| Test Writer 실패 시 hard e2e requirement가 있으면 escalation | 도메인 확장성 (Phase 2B) |
| mainLoop에서 afterFirstBuild 에러 처리 | Requirements-to-Eval Compiler (Phase 2E) |
| Reporter flow coverage에 requirement_id 표시 | |

---

## 1. Tag 규약

### 형식

key_flow 테스트의 `test.describe` title에 `@{requirement_id}` tag를 포함한다:

```typescript
test.describe("신규 예약 등록 @FR-001", () => { ... });
```

여러 requirement를 커버하는 경우:

```typescript
test.describe("예약 상태 변경 @FR-002 @FR-003", () => { ... });
```

### 적용 범위

- **key_flow 테스트** (`e2e/flows/`): tag 필수
- **템플릿 테스트** (`e2e/{slug}-*.spec.ts`): tag 없음. 기존대로 soft.

---

## 2. E2E Evaluator 매칭 변경

### 변경 대상

- `orchestrator/src/evaluator/e2e.ts`

### mapFailureSeverity 수정

Tag 기반 매칭을 우선하고, tag가 없으면 기존 title substring 매칭으로 fallback:

```typescript
export function mapFailureSeverity(
  specTitle: string,
  requirements: Requirement[],
): "hard" | "soft" {
  // 1. Tag-based matching (@FR-001 등)
  const tagPattern = /@([A-Za-z]+-\d+)/g;
  const tags = [...specTitle.matchAll(tagPattern)].map(m => m[1]);

  if (tags.length > 0) {
    for (const tag of tags) {
      const req = requirements.find(r => r.id === tag);
      if (req?.severity === "hard") return "hard";
    }
    return "soft"; // tags found but none are hard
  }

  // 2. Fallback: title substring matching (legacy/template tests)
  const e2eReqs = requirements.filter(r => r.test_method === "e2e");
  for (const req of e2eReqs) {
    if (specTitle.includes(req.title)) return req.severity;
  }
  return "soft";
}
```

### collectAllSpecs 변경

기존 로직 변경 없음. `mapFailureSeverity`의 내부만 바뀌므로 collectAllSpecs는 그대로.

---

## 3. Test Writer contract 수정

### 변경 대상

- `orchestrator/src/test-generation-stage.ts`
- `agents/test-writer.md`

### TestGenerationStage guidelines 추가

```typescript
guidelines: [
  // 기존 항목 유지 +
  "Each test.describe MUST include @{requirement_id} tag(s) matching the eval spec requirements",
  "Example: test.describe('신규 예약 등록 @FR-001', () => { ... })",
  "If a flow covers multiple requirements, include all tags: @FR-001 @FR-002",
]
```

### TestGenerationContract에 requirements 전달

현재 `TestGenerationContract`에 requirements 정보가 없어서 Test Writer가 tag를 붙일 수 없다. requirements를 contract에 추가:

```typescript
interface TestGenerationContract {
  task: "generate_e2e_tests";
  key_flows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  requirements: Array<{ id: string; title: string; severity: string }>;
  output_dir: string;
  guidelines: string[];
}
```

`execute()` 호출 시 requirements도 전달하도록 `TestGenerationInput` 확장:

```typescript
interface TestGenerationInput {
  workspace: string;
  keyFlows: string[];
  entities: Array<{ name: string; fields: string[] }>;
  requirements: Array<{ id: string; title: string; severity: string }>;
}
```

### agents/test-writer.md 수정

Test Design 섹션에 추가:

```markdown
### Requirement Tagging (MANDATORY)
- Every test.describe title MUST include @{requirement_id} tag(s)
- The requirement_id comes from the eval spec requirements passed in the contract
- Example: test.describe('신규 예약 등록 @FR-001', () => { ... })
- If a flow covers multiple requirements: test.describe('예약 플로우 @FR-001 @FR-002', () => { ... })
- Tests WITHOUT requirement tags will be treated as soft (non-blocking)
```

---

## 4. Test Writer 실패 blocking

### 변경 대상

- `orchestrator/src/index.ts` (afterFirstBuild 콜백)
- `orchestrator/src/loop.ts` (afterFirstBuild 에러 처리)

### index.ts — afterFirstBuild 수정

```typescript
afterFirstBuild: async (ws) => {
  console.log("[FDE-AGENT] Running Test Writer Agent for key_flow E2E tests...");
  const result = await testGenerationStage.execute({
    workspace: `${ws}/app`,
    keyFlows: evalSpec.domain.key_flows,
    entities: evalSpec.domain.entities,
    requirements: evalSpec.requirements
      .filter(r => r.test_method === "e2e")
      .map(r => ({ id: r.id, title: r.title, severity: r.severity })),
  });

  if (result.success) {
    console.log("[FDE-AGENT] key_flow E2E tests generated");
    return;
  }

  const hasHardE2E = evalSpec.requirements.some(
    r => r.test_method === "e2e" && r.severity === "hard"
  );

  if (hasHardE2E) {
    throw new Error(
      "env_issue: Test Writer Agent failed — cannot verify hard e2e requirements: " +
      result.output.slice(0, 200)
    );
  }

  console.warn(
    "[FDE-AGENT] Test Writer Agent failed (non-blocking — no hard e2e requirements):",
    result.output.slice(0, 200)
  );
},
```

### loop.ts — afterFirstBuild try-catch

현재 mainLoop에서 `afterFirstBuild`는 에러 시 mainLoop 밖으로 전파된다. escalation으로 깔끔하게 처리하기 위해 try-catch 추가:

```typescript
// iteration === 1 && startIteration === 1 블록 안:
if (input.afterFirstBuild) {
  try {
    await input.afterFirstBuild(workspace);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    history.push({
      iteration,
      passed: passedEvaluators,
      failed: [],
      failure_details: [{
        id: "test_writer_failed",
        message,
        hint: "Fix test generation environment or re-run",
      }],
      status: "escalated",
      reason: "test_writer_failed",
    });
    return {
      run_id: runId,
      total_iterations: iteration,
      max_iterations: maxIterations,
      status: "escalated",
      escalation_reason: message,
      resumable: true,
      history,
    };
  }
}
```

---

## 5. Reporter flow coverage 보강

### 변경 대상

- `orchestrator/src/reporter.ts`

### flow coverage 테이블에 requirement_id 표시

현재:
```markdown
| Flow | 테스트 파일 | 결과 |
```

변경:
```markdown
| Flow | 테스트 파일 | Requirement | 결과 |
```

`buildCoverageFromSpecs`에서 flow spec의 title에서 `@{id}` tag를 추출하여 표시:

```typescript
// FlowCoverageEntry에 requirementIds 추가
interface FlowCoverageEntry {
  file: string;
  title: string;
  status: string;
  requirementIds: string[];
}
```

---

## 6. 테스트 변경

| 테스트 파일 | 변경 내용 |
|---|---|
| `__tests__/e2e-evaluator.test.ts` | tag 기반 매칭 테스트 추가 (tag만, tag+fallback, 다중 tag) |
| `__tests__/loop.test.ts` | afterFirstBuild throw 시 escalation 반환 테스트 |
| `__tests__/test-generation-stage.test.ts` | requirements가 contract에 포함되는지 검증 |
| `__tests__/reporter.enhanced.test.ts` | flow coverage에 requirementIds 표시 검증 |

---

## 7. 변경 파일 요약

| 파일 | 변경 유형 |
|---|---|
| `src/evaluator/e2e.ts` | mapFailureSeverity tag 매칭 추가 |
| `src/test-generation-stage.ts` | contract에 requirements 추가, guidelines에 tag 규약 |
| `agents/test-writer.md` | Requirement Tagging 규칙 추가 |
| `src/index.ts` | afterFirstBuild에 hard e2e 판단 + throw |
| `src/loop.ts` | afterFirstBuild try-catch → escalation |
| `src/reporter.ts` | FlowCoverageEntry에 requirementIds, 테이블 컬럼 추가 |
| `src/__tests__/e2e-evaluator.test.ts` | tag 매칭 테스트 |
| `src/__tests__/loop.test.ts` | afterFirstBuild escalation 테스트 |
| `src/__tests__/test-generation-stage.test.ts` | requirements contract 테스트 |
| `src/__tests__/reporter.enhanced.test.ts` | requirementIds 표시 테스트 |
