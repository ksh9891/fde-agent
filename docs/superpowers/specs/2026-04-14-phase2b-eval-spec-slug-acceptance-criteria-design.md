# Phase 2B: Entity slug 필드 추가 + acceptance_criteria 강화

> 상태: Approved
> 작성일: 2026-04-14
> 관련: 피드백 #1 (Eval Spec 얕음), #6 (도메인 확장성 낮음)

## 목적

Entity에 `slug` required 필드를 추가하여 한글→영문 하드코딩 맵을 제거하고, Requirement에 optional `acceptance_criteria` 배열을 추가하여 E2E 테스트 생성의 구체성을 높인다.

## 범위

| 포함 | 제외 |
|------|------|
| EntitySchema에 slug required 필드 추가 | field 이름 변환 (toFieldKey) 하드코딩 — 별도 Phase |
| 하드코딩 entitySlugMap / ENTITY_SLUG_MAP 3곳 제거 | 샘플 데이터 하드코딩 (getRealisticSampleData) — 별도 Phase |
| RequirementSchema에 acceptance_criteria optional 추가 | selector/precondition 같은 구조화된 필드 — 과도함 |
| Test Writer contract에 acceptance_criteria 전달 | Requirements-to-Eval Compiler (Phase 2E) |
| eval spec 예제 업데이트 | 새로운 preset |

---

## 1. Entity slug 필드

### 변경 대상

- `orchestrator/src/types.ts` — EntitySchema

### EntitySchema 변경

```typescript
const EntitySchema = z.object({
  name: z.string(),
  slug: z.string(),
  fields: z.array(z.string()),
});
```

`slug`는 required. URL 경로용 영문 식별자 (예: `rooms`, `reservations`, `customers`).

### 하드코딩 제거 — index.ts

현재 (L81-92):
```typescript
const entitySlugMap: Record<string, string> = {
  "예약": "reservations",
  "객실": "rooms",
  // ...
};
```

변경: 완전 제거. entity.slug 직접 사용:

```typescript
const requiredPages = ["dashboard"];
for (const entity of evalSpec.domain.entities) {
  requiredPages.push(entity.slug);
}
```

Provisioner 호출에서 `entitySlugMap` 파라미터도 제거.

### 하드코딩 제거 — provisioner.ts

`ProvisionInput`에서 `entitySlugMap?: Record<string, string>` 제거.

내부 메서드에서 `slugMap[entity.name]` 대신 `entity.slug` 사용:

```typescript
// 변경 전
const slug = slugMap[entity.name] ?? entity.name.toLowerCase();
// 변경 후
const slug = entity.slug;
```

영향받는 메서드: `generateEntitySkeletons`, `generateTemplateE2ETests`, `generateSeedRoute`, `updateAdminLayout`.

`EntityDef` 인터페이스에 slug 추가:

```typescript
interface EntityDef {
  name: string;
  slug: string;
  fields: string[];
}
```

### 하드코딩 제거 — reporter.ts

`ENTITY_SLUG_MAP` 상수 제거. `buildCoverageFromSpecs`에서 `entity.slug` 사용:

```typescript
// 변경 전
const slug = ENTITY_SLUG_MAP[entity.name] ?? entity.name.toLowerCase();
// 변경 후  
const slug = entity.slug;
```

`buildCoverageFromSpecs`는 `EvalSpec`을 받으므로 `entity.slug`에 접근 가능.

---

## 2. Requirement acceptance_criteria

### 변경 대상

- `orchestrator/src/types.ts` — RequirementSchema

### RequirementSchema 변경

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

optional — 기존 eval spec은 수정 없이 동작.

### Test Writer contract 전달

`test-generation-stage.ts`의 `RequirementInfo`에 추가:

```typescript
interface RequirementInfo {
  id: string;
  title: string;
  severity: string;
  acceptance_criteria?: string[];
}
```

index.ts에서 map할 때 포함:

```typescript
requirements: evalSpec.requirements
  .filter((r) => r.test_method === "e2e")
  .map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    acceptance_criteria: r.acceptance_criteria,
  })),
```

### agents/test-writer.md 업데이트

```markdown
### Using Acceptance Criteria
- If a requirement has acceptance_criteria, each criterion should map to at least one test assertion
- Write test steps that directly verify each criterion
- If no acceptance_criteria provided, use the description to infer test scenarios
```

---

## 3. Eval Spec 예제 업데이트

### 변경 대상

- `examples/resort-admin-spec.yaml`

### 변경 내용

```yaml
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
```

---

## 4. 테스트 변경

| 테스트 파일 | 변경 내용 |
|---|---|
| `__tests__/types.test.ts` | EntitySchema slug 필드, RequirementSchema acceptance_criteria 필드 검증 |
| `__tests__/eval-spec-parser.test.ts` | 파서가 slug + acceptance_criteria를 파싱하는지 검증 |
| `__tests__/provisioner.test.ts` | entitySlugMap 제거 반영 |
| `__tests__/reporter.enhanced.test.ts` | ENTITY_SLUG_MAP 제거 반영, mockEvalSpec에 slug 추가 |
| `__tests__/test-generation-stage.test.ts` | RequirementInfo에 acceptance_criteria 포함 검증 |
| `__tests__/loop.test.ts` | sampleSpec entity에 slug 추가 |
| `__tests__/builder.test.ts` | entity에 slug 추가 (만약 사용한다면) |
| `__tests__/task-contract.test.ts` | domain entity에 slug 추가 |

---

## 5. 변경 파일 요약

| 파일 | 변경 유형 |
|---|---|
| `src/types.ts` | EntitySchema slug 추가, RequirementSchema acceptance_criteria 추가 |
| `src/index.ts` | entitySlugMap 제거, entity.slug 사용, acceptance_criteria 전달 |
| `src/provisioner.ts` | entitySlugMap 파라미터 제거, entity.slug 사용 |
| `src/reporter.ts` | ENTITY_SLUG_MAP 제거, entity.slug 사용 |
| `src/test-generation-stage.ts` | RequirementInfo에 acceptance_criteria 추가 |
| `agents/test-writer.md` | acceptance_criteria 활용 규칙 추가 |
| `examples/resort-admin-spec.yaml` | slug + acceptance_criteria 추가 |
| `src/__tests__/*.ts` | 스키마 변경 반영 (entity에 slug 추가 등) |
