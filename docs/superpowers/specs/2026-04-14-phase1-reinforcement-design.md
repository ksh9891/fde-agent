# Phase 1 보강: E2E 평가 파이프라인 + FDE 기술 리포트

> 상태: Draft  
> 작성일: 2026-04-14  
> 관련: `docs/design/fde_harness_agent_design_v2.md`

## 목적

MVP에서 빠져 있는 소프트 평가기(E2E, Console)를 파이프라인에 연결하고, 테스트 자동 생성을 구현하며, FDE 내부 검증용 기술 리포트를 강화한다.

## 범위

| 포함 | 제외 |
|------|------|
| Playwright scaffold 셋업 | 추가 preset (corporate-site, ecommerce-web) |
| 템플릿 기반 E2E 테스트 생성 | 클라이언트 대면 리포트 |
| Test Writer Agent key_flow 테스트 생성 | Escalation UX 개선 |
| ConsoleCheck / E2E 평가기 pipeline 연결 | Phase 2+ 평가기 (스크린샷 비교, Lighthouse) |
| FDE 기술 리포트 강화 | HTML/PDF 변환 |

## Escalation UX

현재 수준 유지. env_issue 감지 + `--resume` 재개 기능은 이미 동작하므로 이번 스펙에서 변경하지 않는다.

---

## 1. Playwright 셋업 (scaffold 확장)

### 변경 대상

- `presets/admin-web/core/scaffold/`

### 추가 파일

| 파일 | 내용 |
|------|------|
| `playwright.config.ts` | baseURL `http://localhost:3000`, headless, JSON reporter (`playwright-report/results.json`), chromium only |
| `e2e/.gitkeep` | Provisioner가 테스트를 생성할 디렉토리 |

### package.json 변경

```json
{
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  },
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

### Provisioner 변경

workspace 생성 시 scaffold 복사 후:
1. `npm install` (기존)
2. Playwright 브라우저 설치: 이미 설치되어 있으면 skip, 없을 때만 `npx playwright install chromium` 실행. 설치 실패 시 env_issue로 escalation한다. CI/로컬 캐시 전략은 구현 plan에서 상세화한다.

---

## 2. 테스트 생성 — 하이브리드 방식

### 2-1. 템플릿 기반 (deterministic) — Provisioner 단계

Provisioner가 `test-pack/scenarios/` 템플릿을 엔티티별로 치환하여 `e2e/` 디렉토리에 생성한다.

| 템플릿 | 생성 결과 | 생성 단위 |
|--------|-----------|-----------|
| `list-view.template.ts` | `e2e/{entity}-list.spec.ts` | 엔티티당 1개 |
| `detail-view.template.ts` | `e2e/{entity}-detail.spec.ts` | 엔티티당 1개 |
| `form-submit.template.ts` | `e2e/{entity}-form.spec.ts` | 엔티티당 1개 |
| `dashboard.template.ts` | `e2e/dashboard.spec.ts` | 프로젝트당 1개 |

**치환 변수:**
- `{{ENTITY_NAME}}` — 엔티티 한글명 (예: 객실)
- `{{ENTITY_SLUG}}` — URL 경로용 슬러그 (예: rooms)
- `{{FIELDS}}` — 필드 목록 (테이블 컬럼 검증용)
- `{{SEED_VALUE}}` — 시드 데이터의 첫 번째 레코드 값 (검색/상세 검증용)

Provisioner는 deterministic 작업만 수행한다. LLM 호출은 여기에 포함하지 않는다.

### 2-2. Test Writer Agent (LLM) — TestGenerationStage

eval spec의 `key_flows`에 대해 Test Writer Agent를 호출한다.

**실행 주체:** `TestGenerationStage` — Provisioner와 분리된 독립 스테이지  
**실행 시점:** Builder 1회 실행 후 (Builder가 실제 페이지를 생성한 뒤 라우트 구조가 확정된 상태에서 실행)  
**실행 방식:** `builder/claude-code.ts`와 동일한 headless Claude Code 호출  
**입력:**
- key_flows 목록 (eval spec에서 추출)
- Builder가 생성한 실제 페이지 구조 (디렉토리 목록)
- 시드 데이터 (JSON)
- 템플릿 기반 테스트 파일 (참고용)

**출력:** `e2e/flows/` 디렉토리에 flow별 spec 파일
- `e2e/flows/{flow-slug}.spec.ts`

**Agent 프롬프트:** 기존 `agents/test-writer.md`를 활용. task contract 형태로 key_flows와 컨텍스트를 전달한다.

**Orchestrator deterministic 원칙:** Provisioner는 deterministic 유지. Test Writer 호출은 별도 스테이지(`TestGenerationStage`)로 격리하여 "Orchestrator 본체는 deterministic, LLM은 agent 경계 내부" 원칙을 준수한다.

---

## 3. 평가기 파이프라인 연결

### 변경 전

```
BuildCheck(hard) → UnitTest(hard) → PageCheck(hard)
```

### 변경 후

```
BuildCheck(hard) → UnitTest(hard) → PageCheck(hard) → ConsoleCheck(configurable) → E2E(requirement severity)
```

hard evaluator가 하나라도 실패하면 이후 evaluator는 실행하지 않는다 (기존 EvalPipeline의 hard-fail-stop 로직 유지).

### ConsoleCheckEvaluator 변경

현재 코드(65줄)에 dev server 시작/종료 로직을 추가한다.

**실행 절차:**
1. BuildCheck가 이미 앞에서 `npm run build`를 통과했으므로, `npm run start`만 실행하여 production 서버를 spawn
2. 서버 ready 대기 (localhost:3000 health check)
3. Playwright로 각 엔티티 페이지 접근, `console.error` 이벤트 수집
4. `finally` 블록에서 서버 프로세스 종료
5. 콘솔 에러가 있으면 failure 반환

**severity 규칙:**
- 기본: `soft`
- **hard로 승격하는 에러:** TypeError, ReferenceError, hydration error, uncaught exception
- **무시하는 에러:** warning, info 수준 로그
- failure에 repair hint 포함: 어떤 페이지에서 어떤 에러가 발생했는지

### E2EEvaluator 변경

현재 코드(117줄)는 Playwright JSON report를 파싱하는 구조가 이미 있다. 변경 최소화.

1. `npm run test:e2e` 실행 (ConsoleCheck에서 이미 서버가 떠 있다면 재활용, 아니면 별도 spawn)
2. `playwright-report/results.json` 파싱 (기존 로직)
3. 실패한 테스트별 failure 생성

**severity 규칙:**
- E2E Evaluator 자체의 고정 severity는 없다.
- 각 실패의 severity는 해당 테스트가 매핑된 eval spec `requirements[].severity`를 따른다.
- 템플릿 기반 테스트(list/detail/form/dashboard): `soft` (기본 패턴 검증)
- key_flow 테스트: 해당 requirement의 severity 상속 (hard일 수 있음)
- JSON report 경로를 `playwright.config.ts`의 설정과 일치시킴

### index.ts 변경

evaluator 등록 배열에 추가. E2EEvaluator는 requirements 정보를 받아 severity를 동적으로 결정한다:

```typescript
const evaluators = [
  new BuildCheckEvaluator(),
  new UnitTestEvaluator(),
  new PageCheckEvaluator(entities),
  new ConsoleCheckEvaluator(entities),          // 신규
  new E2EEvaluator(evalSpec.requirements),      // 신규, severity 동적
];
```

---

## 4. FDE 기술 리포트 강화

### 리포트 구조 (`report/summary.md`)

```markdown
# 프로토타입 검증 리포트

## 개요
- 프로젝트명, 프리셋, 팔레트, 실행 시각, Run ID
- 최종 상태 (통과/실패/에스컬레이션), 총 반복 횟수

## 평가 결과 요약
| Evaluator | Severity | Status | 실패 항목 수 |

## 반복 이력
### Iteration 1
- 실패 항목: [목록]
- Builder 수정 내역 요약
### Iteration 2
- ...

## 실패 상세 (최종 잔여 실패)
### {evaluator명}
- 실패 메시지
- Repair hint

## 테스트 커버리지
### 템플릿 기반
| 엔티티 | list | detail | form | 결과 |
### key_flow
| Flow | 테스트 파일 | 결과 |

## 실행 환경
- Node 버전, preset, 타임스탬프
```

### 변경 포인트

**reporter.ts:**
- `generateSummary()` 파라미터 확장: `EvalSpec` 메타데이터 (프로젝트명, 프리셋, 팔레트) 추가
- 반복 이력 섹션: iteration별 failure details (메시지, hint) 포함
- 테스트 커버리지 섹션: 생성된 테스트 파일 목록과 pass/fail 집계
- 실행 환경 섹션 추가

**IterationState (types.ts):**
- `history[].failures` 타입 변경: `string[]` → `{ id: string; message: string; hint?: string }[]`
- 기존 `string[]` 호환을 위한 마이그레이션 불필요 (iterations.json은 런타임 산출물, 버전 관리 안 함)

**eval-results.json:**
- 구조 변경 없음. 기존대로 유지.

---

## 5. 전체 데이터 흐름

```
EvalSpec (YAML)
  → Parser (Zod 검증)
  → Provisioner (deterministic만)
      ├── scaffold 복사 + deps 설치
      ├── Playwright 브라우저 설치 (캐시 있으면 skip)
      ├── 엔티티 페이지/API/시드 생성 (기존)
      └── 템플릿 기반 E2E 테스트 생성 (신규)
  → Builder 1회 실행 (초기 프로토타입 생성)
  → TestGenerationStage (신규, 별도 스테이지)
      └── Test Writer Agent → key_flow E2E 생성
  → Main Loop (최대 15회)
      ├── TaskContract 생성
      ├── Builder Agent 실행
      └── EvalPipeline
            ├── BuildCheck (hard)
            ├── UnitTest (hard)
            ├── PageCheck (hard)
            ├── ConsoleCheck (configurable) ← 신규
            └── E2E (requirement severity) ← 신규
  → Reporter
      ├── summary.md (강화)
      ├── eval-results.json (유지)
      └── iterations.json (failure details 추가)
```

## 6. 구현 순서

1. Playwright scaffold 셋업 (config, package.json, 브라우저 캐시 로직)
2. 템플릿 치환 로직 (Provisioner 확장, deterministic만)
3. TestGenerationStage 구현 (Provisioner와 분리된 LLM 호출 스테이지)
4. ConsoleCheckEvaluator 서버 spawn/종료 + severity 승격 로직
5. E2EEvaluator requirement severity 매핑
6. Pipeline에 ConsoleCheck/E2E 등록
7. IterationState failure details 확장
8. Reporter 강화
9. 통합 테스트 (resort-admin-spec으로 스모크)
