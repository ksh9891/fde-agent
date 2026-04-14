# E2E Vacuous Pass 수정 + 평가 파이프라인 강화

> 상태: Approved
> 작성일: 2026-04-14
> 관련: `docs/superpowers/specs/2026-04-14-phase1-reinforcement-design.md`

## 목적

E2E evaluator가 테스트 0개 실행을 pass로 판정하는 vacuous pass 문제를 수정하고, reporter의 테스트 커버리지 섹션을 실제 데이터로 채우며, pipeline의 blocking 로직을 보강한다.

## 범위

| 포함 | 제외 |
|------|------|
| E2E evaluator vacuous pass 방지 | 새로운 evaluator 추가 |
| EvalResult에 stats 메타데이터 추가 | ConsoleCheck evaluator의 stats (이번 범위 외) |
| Reporter 커버리지 섹션 데이터 매핑 | HTML/PDF 변환 |
| Pipeline BLOCKING_EVALUATORS 보강 | 새로운 preset |

---

## 1. EvalResult 메타데이터 확장

### 변경 대상

- `orchestrator/src/types.ts`

### 변경 내용

EvalResultSchema에 optional `stats` 필드 추가:

```typescript
export const EvalResultSchema = z.object({
  evaluator: z.enum(["build", "unit_test", "console", "e2e", "page_check"]),
  status: z.enum(["pass", "fail"]),
  severity: z.enum(["hard", "soft"]),
  failures: z.array(EvalFailureSchema),
  stats: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
  }).optional(),
});
```

`stats`는 optional이므로 기존 evaluator(build, unit_test, page_check)는 수정 불필요. E2E evaluator만 채운다.

---

## 2. E2E Evaluator 강화

### 변경 대상

- `orchestrator/src/evaluator/e2e.ts`

### 2-1. 전체 spec 집계 함수

기존 `collectFailedSpecs`를 확장하여 모든 spec의 status를 집계한다:

```typescript
interface SpecStats {
  total: number;
  passed: number;
  failed: number;
}

function collectAllSpecs(
  suites: PlaywrightSuite[],
  failures: EvalFailure[],
  stats: SpecStats,
  requirements: Requirement[],
): void {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        stats.total += 1;
        if (spec.status === "failed" || spec.status === "timedOut") {
          stats.failed += 1;
          const severity = mapFailureSeverity(spec.title, requirements);
          failures.push({
            id: `e2e_failure_${stats.failed}`,
            message: `E2E spec failed: ${spec.title}`,
            severity,
            evidence: spec.error?.message ? [spec.error.message] : [],
            repair_hint: "Fix the failing E2E test scenario",
          });
        } else if (spec.status === "passed" || spec.status === "expected") {
          stats.passed += 1;
        }
        // skipped 등은 total에 포함되지만 passed/failed에는 미포함
      }
    }
    if (suite.suites) {
      collectAllSpecs(suite.suites, failures, stats, requirements);
    }
  }
}
```

### 2-2. Vacuous pass 방지

`run()` 메서드에서 report 파싱 후:

1. **report에 `suites`가 없거나 빈 배열** → fail 반환 ("Playwright test runner produced no results")
2. **total === 0** → fail 반환 ("No E2E tests were executed")
3. **정상적으로 테스트가 실행된 경우** → 기존 로직 (failures 기반 pass/fail)

```typescript
// report.suites가 없거나 빈 배열
if (!report.suites || report.suites.length === 0) {
  return {
    evaluator: "e2e",
    status: "fail",
    severity: "hard",
    failures: [{
      id: "e2e_no_results",
      message: "Playwright test runner produced no results",
      evidence: [],
      repair_hint: "Check playwright.config.ts and ensure e2e/ directory has test files",
    }],
    stats: { total: 0, passed: 0, failed: 0 },
  };
}

// 집계 후 total === 0
if (stats.total === 0) {
  return {
    evaluator: "e2e",
    status: "fail",
    severity: "hard",
    failures: [{
      id: "e2e_no_tests",
      message: "No E2E tests were executed (0 specs found in report)",
      evidence: [],
      repair_hint: "Ensure e2e/ directory contains .spec.ts files and playwright.config.ts testDir is correct",
    }],
    stats: { total: 0, passed: 0, failed: 0 },
  };
}
```

### 2-3. stats 반환

정상 실행 시 stats를 EvalResult에 포함:

```typescript
return {
  evaluator: "e2e",
  status: failures.length === 0 ? "pass" : "fail",
  severity: hasHardFailure ? "hard" : "soft",
  failures,
  stats: { total: stats.total, passed: stats.passed, failed: stats.failed },
};
```

---

## 3. Pipeline BLOCKING_EVALUATORS 보강

### 변경 대상

- `orchestrator/src/evaluator/pipeline.ts`

### 변경 내용

```typescript
const BLOCKING_EVALUATORS = new Set(["build", "unit_test", "page_check"]);
```

**이유:** PageCheck가 hard fail이면 페이지 자체가 없으므로 ConsoleCheck(브라우저 순회)과 E2E(Playwright 시나리오) 실행이 무의미하다. PageCheck의 기본 severity가 이미 "hard"이므로 blocking 조건과 일치한다.

---

## 4. Reporter 커버리지 매핑

### 변경 대상

- `orchestrator/src/reporter.ts`

### 4-1. 평가 결과 요약 테이블 보강

E2E evaluator의 stats가 있으면 "실패 항목 수" 대신 상세 표시:

```markdown
| e2e | soft | PASS | 16 total, 16 passed, 0 failed |
```

### 4-2. 테스트 커버리지 섹션 — Playwright report 파싱

`writeReport()` 내에서 workspace의 `playwright-report/results.json`을 직접 파싱:

**매핑 규칙:**

1. Playwright report의 suite를 재귀 순회하여 모든 spec을 수집
2. 각 spec의 file 경로 또는 suite title로 분류:
   - file 경로에 `e2e/flows/` 포함 → key_flow 테이블
   - file 경로에 `{slug}-list`, `{slug}-detail`, `{slug}-form` 포함 → 엔티티 템플릿 테이블
   - `dashboard` 포함 → 대시보드 행
3. 결과를 pass/fail로 표시

**템플릿 기반 테이블 출력 예시:**

```markdown
### 템플릿 기반

| 엔티티 | list | detail | form | 결과 |
|--------|------|--------|------|------|
| 객실 | PASS | PASS | PASS | 3/3 |
| 예약 | PASS | FAIL | PASS | 2/3 |
| 고객 | PASS | PASS | PASS | 3/3 |
```

**key_flow 테이블 출력 예시:**

```markdown
### key_flow

| Flow | 테스트 파일 | 결과 |
|------|------------|------|
| 예약 목록 조회 및 필터링 | reservation-list-filter.spec.ts | PASS |
| 신규 예약 등록 | reservation-create.spec.ts | FAIL |
```

### 4-3. Playwright report 파싱 실패 시

파일이 없거나 파싱 실패하면 기존처럼 "-" 표시. 에러를 삼키되 reporter가 터지지 않도록 방어.

---

## 5. 테스트 변경

| 테스트 파일 | 변경 내용 |
|---|---|
| `__tests__/types.test.ts` | EvalResult stats optional 필드 검증 추가 |
| `__tests__/e2e-evaluator.test.ts` | vacuous pass 시나리오 (빈 suites, total 0) 테스트 추가. stats 반환 검증 |
| `__tests__/evaluator.test.ts` | pipeline에서 page_check hard fail 시 이후 evaluator 스킵 검증 |
| `__tests__/reporter.test.ts` 또는 `reporter.enhanced.test.ts` | stats 포함 시 커버리지 섹션 출력 검증 |

---

## 6. 변경 파일 요약

| 파일 | 변경 유형 |
|---|---|
| `src/types.ts` | EvalResultSchema에 stats 추가 |
| `src/evaluator/e2e.ts` | collectAllSpecs, vacuous pass 방지, stats 반환 |
| `src/evaluator/pipeline.ts` | BLOCKING_EVALUATORS에 page_check 추가 |
| `src/reporter.ts` | stats 표시 + playwright report 파싱 + 커버리지 매핑 |
| `src/__tests__/types.test.ts` | stats 필드 테스트 |
| `src/__tests__/e2e-evaluator.test.ts` | vacuous pass, stats 테스트 |
| `src/__tests__/evaluator.test.ts` | page_check blocking 테스트 |
| `src/__tests__/reporter.enhanced.test.ts` | 커버리지 매핑 테스트 |
