# FDE Harness Agent MVP 설계 스펙

## 1. 프로젝트 개요

### 1.1 한 줄 정의

> FDE Harness Agent는 검증된 eval spec을 입력받아, preset 기반으로 Claude Code Builder를 반복 실행하고, deterministic evaluation을 통과할 때까지 산출물을 수렴시키는 Claude Code Plugin이다.

### 1.2 목적

FDE(Forward Deployed Engineer) 사업을 시작하기 위한 핵심 인프라. 고객에게 **일관된 UI/UX, 균일한 품질**의 프로토타입을 제공하는 것이 핵심 가치.

### 1.3 해결하는 문제

현재 Claude Code로 "관리자 페이지 만들어줘"라고 요청하면:

- 기능이 실제로 동작하지 않는 경우가 많음
- 매 세션마다 다른 UI/UX가 나옴
- 품질 보장 수단이 없음

이 시스템은 preset(일관된 패턴) + eval loop(품질 검증)로 이 문제를 해결한다.

### 1.4 비목표 (MVP)

- Requirements-to-Eval Compiler (FDE가 직접 eval spec 작성)
- 로컬 LLM Builder 구현 (인터페이스만 준비)
- admin-web 외 다른 preset
- 반응형/스크린샷 비교 evaluator (2순위)
- 완전 무인 프로덕션 배포

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────┐
│  FDE (Claude Code Interactive Session)          │
│  /fde-agent:run eval-spec.yaml                  │
└──────────────────┬──────────────────────────────┘
                   │ eval spec (YAML) + palette 선택
                   ▼
┌─────────────────────────────────────────────────┐
│  Orchestrator (TypeScript CLI 스크립트)           │
│                                                 │
│  1. eval spec 파싱                               │
│  2. preset 선택 + workspace 프로비저닝             │
│  3. task contract 생성                           │
│  4. Builder 호출                                 │
│  5. Evaluator 실행                               │
│  6. pass → 종료 / fail → repair → 4로 복귀       │
│  7. 15회 초과 → FDE escalation                   │
│                                                 │
│  ┌───────────────┐    ┌───────────────┐         │
│  │ Builder       │    │ Evaluator     │         │
│  │ Interface     │    │ (Deterministic)│        │
│  │  ├ ClaudeCode │    │  ├ Build      │         │
│  │  │ Headless   │    │  ├ Unit Test  │         │
│  │  └(LocalLLM   │    │  ├ Console    │         │
│  │    후일 추가)  │    │  └ E2E       │         │
│  └───────────────┘    └───────────────┘         │
│                                                 │
│  ┌───────────────┐                              │
│  │ Test Writer   │                              │
│  │ (별도 세션)    │                              │
│  │ E2E 시나리오   │                              │
│  │ 독립 작성      │                              │
│  └───────────────┘                              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Output                                         │
│  ├ 프로토타입 (실행 가능한 웹앱)                    │
│  ├ 검증 리포트 (pass/fail + evidence)             │
│  └ 미해결 항목 목록 (escalation 사유)              │
└─────────────────────────────────────────────────┘
```

### 2.1 핵심 원칙

- **Orchestrator**가 루프를 제어한다. Claude Code는 Builder로만 동작한다.
- **Builder Interface**를 통해 호출한다. 나중에 로컬 LLM 교체 가능.
- **Evaluator**는 모두 deterministic이다. LLM 판단에 의존하지 않는다.
- **생성자와 평가자를 분리**한다. Builder와 Test Writer는 별도 세션이다.
- **종료 조건**: 모든 hard constraint 통과 OR 15회 초과.

### 2.2 Harness Engineering

이 시스템은 Harness Engineering 구조다. Harness의 정의:

> 특정 산출물 유형에 대해, 생성·실행·검증·계측·수정이 반복 가능하도록 만드는 실행 프레임.

| Harness 요소 | 담당 |
|---|---|
| 생성 | Builder (Claude Code Headless) |
| 실행 | Workspace에서 빌드/실행 |
| 검증 | Evaluator (빌드, 유닛 테스트, Playwright, 콘솔 에러) |
| 계측 | 스크린샷 캡처, 테스트 결과 수집, evidence 저장 |
| 수정 반복 | Orchestrator의 repair loop (최대 15회) |

preset + orchestrator + eval pack이 합쳐져서 하나의 harness가 된다.

---

## 3. Preset 구조

### 3.1 설계 철학

**"기능"이 아니라 "패턴"을 공통화한다.**

고객마다 도메인은 다르지만 관리자 페이지의 반복 패턴은 동일하다:

| 패턴 | 예시 |
|---|---|
| 목록 조회 + 필터 + 검색 | 고객 목록, 상품 목록, 예약 목록 |
| 상세 보기 | 고객 상세, 상품 상세 |
| 생성/수정 폼 | 고객 등록, 상품 등록 |
| 상태 변경 워크플로우 | 주문 승인/반려, 예약 확정/취소 |
| 대시보드/통계 | 매출 차트, 일별 현황 |
| 권한별 메뉴 제어 | 관리자/운영자/뷰어 역할 |

preset의 core가 이 패턴을 제공하고, 도메인(엔티티, 필드, 비즈니스 규칙)은 eval spec에서 주입된다.

### 3.2 글로벌 팔레트

팔레트는 preset과 독립적으로 조합 가능한 축이다. 같은 admin-web이라도 고객에 따라 다른 팔레트를 적용할 수 있다.

```
global/
└── palettes/
    ├── corporate-blue.json      # 신뢰/전문 (금융, 컨설팅)
    ├── warm-neutral.json        # 부드러운 (리조트, 호텔)
    └── dark-modern.json         # 모던/테크 (IT, 스타트업)
```

### 3.3 UI 전략

- shadcn/ui 기반으로 시작
- preset별로 테마 토큰, 레이아웃 규칙, 페이지 패턴을 얹는다
- Claude Code의 자유도를 줄여서 일관성을 확보한다

### 3.4 디렉터리 구조

```
presets/
└── admin-web/
    ├── core/
    │   ├── scaffold/             # Next.js + shadcn/ui 초기 구조
    │   ├── layouts/              # 사이드바+헤더, 모바일 대응
    │   ├── page-patterns/        # 목록, 상세, 폼, 대시보드 (4개)
    │   ├── components/           # DataTable, FormBuilder, StatusBadge 등
    │   └── auth/                 # 로그인, 역할 기반 메뉴 제어
    │
    ├── rules/
    │   ├── CLAUDE.md             # Builder에게 주는 규칙
    │   └── protected-files.json  # 수정 금지 파일 목록
    │
    └── test-pack/
        ├── scenarios/            # 패턴별 Playwright 시나리오 템플릿
        ├── responsive.config.ts  # 뷰포트별 검사 설정 (2순위)
        └── lighthouse.config.ts  # 성능/접근성 기준 (3순위)
```

### 3.5 MVP 범위

- preset 1개: `admin-web`
- 팔레트 2~3개: `corporate-blue`, `warm-neutral`, `dark-modern`
- page-patterns 4개: 목록, 상세, 폼, 대시보드

---

## 4. Orchestrator 실행 흐름

### 4.1 의사코드

```typescript
async function run(evalSpec: EvalSpec, options: RunOptions) {
  // 1. workspace 프로비저닝
  const workspace = await provisioner.create({
    preset: evalSpec.preset,
    palette: evalSpec.palette,
    domain: evalSpec.domain,
  })

  // 2. Test Writer 세션으로 E2E 시나리오 생성
  await testWriter.generateScenarios({
    workspace,
    evalSpec,
    templates: preset.testPack.scenarios,
  })

  // 3. 첫 task contract 생성
  let taskContract = buildTaskContract({
    evalSpec,
    workspace,
    iteration: 1,
    failingChecks: [],
  })

  // 4. 메인 루프
  for (let i = 1; i <= 15; i++) {
    await builder.execute(taskContract)

    const results = await evaluator.runAll(workspace)

    if (results.allHardConstraintsPassed) {
      return reporter.success(results)
    }

    taskContract = buildTaskContract({
      evalSpec,
      workspace,
      iteration: i + 1,
      failingChecks: results.failures,
    })
  }

  // 5. 15회 초과
  return reporter.escalate(results)
}
```

### 4.2 Task Contract 형식

Builder에게 전달되는 작업 계약:

```yaml
run_id: run_2026_04_10_001
preset: admin-web
palette: warm-neutral
iteration: 3
workspace: /workspace/run_2026_04_10_001
goal: 리조트 운영팀용 관리자 웹 프로토타입
domain:
  entities: [객실, 예약, 고객]
  key_flows: [예약 목록 조회, 예약 상세, 신규 예약 등록]
failing_checks:
  - "E2E: 신규 예약 등록 폼에서 저장 버튼 클릭 시 에러"
  - "CONSOLE: TypeError at /reservations/new"
repair_hint:
  - "예약 등록 폼의 onSubmit 핸들러에서 필수 필드 validation 누락 추정"
protected_files:
  - design-tokens.json
  - layout.tsx
```

- **iteration 1**: `failing_checks`가 비어있음 → Builder는 처음부터 생성
- **iteration 2+**: `failing_checks`와 `repair_hint`가 있음 → Builder는 수정에 집중
- **protected_files**: preset core의 레이아웃/토큰 등 Builder가 건드리면 안 되는 파일

### 4.3 Builder Interface

나중에 로컬 LLM 교체를 위해 추상화:

```typescript
interface BuilderInterface {
  execute(taskContract: TaskContract): Promise<BuildResult>
}

class ClaudeCodeBuilder implements BuilderInterface {
  // claude -p --system-prompt builder.md "task contract 내용"
}

// 후일 추가
class LocalLLMBuilder implements BuilderInterface {
  // 로컬 LLM API 호출
}
```

### 4.4 Escalation 에러 분류

Orchestrator는 Evaluator 실패를 분류해서 repair 가능 여부를 판단한다:

```typescript
function classifyFailure(failure: EvalFailure): "repairable" | "env_issue" | "unknown" {
  if (failure.message.match(/not defined|missing env|API_KEY|connection refused/)) {
    return "env_issue"   // Builder가 못 고침 → FDE escalation
  }
  if (failure.message.match(/TypeError|test failed|build error/)) {
    return "repairable"  // Builder가 고칠 수 있음 → repair loop
  }
  return "unknown"       // 판단 불가 → FDE escalation
}
```

- `repairable`: Builder에게 repair 지시
- `env_issue`: API 키 누락, DB 접속 실패 등 → repair loop에 보내지 않고 FDE에게 즉시 escalation
- `unknown`: 판단 불가 → FDE에게 escalation

### 4.5 Resume (중단 후 재개)

Escalation으로 중단되면 workspace와 상태가 그대로 보존된다. FDE가 문제를 해결한 뒤 재개:

```bash
/fde-agent:run eval-spec.yaml --resume run_2026_04_10_001
```

Resume이 하는 일:
1. 기존 workspace를 그대로 사용 (새로 생성 안 함)
2. `iterations.json`에서 마지막 상태 로드
3. Evaluator를 먼저 다시 실행 (FDE가 환경만 고쳤을 수 있으므로)
4. 여전히 실패하면 Builder에게 repair 지시
5. 15회 카운트는 누적 (이전 N회 + 이어서 최대 15-N회)

`iterations.json` 상태 예시:

```json
{
  "run_id": "run_2026_04_10_001",
  "total_iterations": 5,
  "max_iterations": 15,
  "status": "escalated",
  "escalation_reason": "env_issue: GOOGLE_MAPS_API_KEY not defined",
  "resumable": true,
  "history": [
    { "iteration": 1, "passed": ["NFR-001"], "failed": ["FR-001", "FR-002"] },
    { "iteration": 2, "passed": ["NFR-001", "FR-002"], "failed": ["FR-001"] },
    { "iteration": 3, "status": "escalated", "reason": "env_issue" }
  ]
}
```

---

## 5. Evaluator 설계

### 5.1 파이프라인 순서

```
빌드 체크 (npm run build)
    │ 실패 시 즉시 반환 — 빌드 안 되면 나머지 무의미
    ▼ 통과
내부 테스트 (npm run test)
    │ Builder가 작성한 유닛/컴포넌트 테스트
    ▼ 통과
콘솔 에러 수집
    │ Playwright로 페이지 순회, console.error 수집
    ▼ 통과
E2E 기능 테스트
    │ Test Writer가 작성한 시나리오 실행
    ▼ (MVP 이후)
반응형 검사 → 스크린샷 비교
```

### 5.2 이중 검증 구조

**층 1 — Builder 세션 내부 (Hook으로 강제)**

```
hooks/
├── post-edit.sh     # 도메인 로직 파일 수정 시 테스트 파일 존재 확인
└── pre-commit.sh    # npm run build && npm run test 통과 강제
```

CLAUDE.md 규칙만으로는 불충분하다. Hook으로 실제 강제한다:

- 도메인 로직 파일이 수정됐는데 테스트 파일이 없으면 차단
- npm run build 실패하면 차단
- npm run test 실패하면 차단

**층 2 — Orchestrator 레벨 (Evaluator로 재검증)**

Hook을 통과했더라도 Evaluator가 독립적으로 재검증한다. Evaluator의 판정이 최종이다.

### 5.3 테스트 책임 분리

| 테스트 종류 | 작성자 | 목적 |
|---|---|---|
| 유닛 테스트 (도메인 로직) | Builder | 코드와 함께 항상 작성 |
| 컴포넌트 테스트 | Builder | UI 렌더링 검증 |
| E2E 시나리오 | Test Writer (별도 세션) | 생성자와 평가자 분리 |

Test Writer는 preset의 시나리오 템플릿 + eval spec의 도메인 정보를 받아 E2E를 구체화한다.

### 5.4 Eval Result 형식

```typescript
interface EvalResult {
  evaluator: string          // "build" | "unit_test" | "console" | "e2e"
  status: "pass" | "fail"
  severity: "hard" | "soft"
  failures: {
    id: string               // requirement_id와 매핑
    message: string          // 사람이 읽을 수 있는 실패 설명
    evidence: string[]       // 스크린샷, 로그 파일 경로
    repair_hint?: string     // Builder에게 줄 수정 힌트
  }[]
}
```

### 5.5 각 Evaluator 상세

**빌드 체크**: `npm run build` → exit code 0 = pass. evidence: 에러 로그 전문. eval spec의 requirement와 무관하게 항상 실행.

**내부 테스트**: `npm run test` → 전체 통과 = pass. evidence: 실패 테스트 목록 + 에러 메시지. eval spec의 requirement와 무관하게 항상 실행. Builder가 코드와 함께 작성한 유닛/컴포넌트 테스트를 검증한다.

**콘솔 에러 수집**: Playwright로 모든 페이지 순회, TypeError/ReferenceError 등 치명적 에러 = hard fail. warning은 무시.

**E2E 기능 테스트**: eval spec의 blocking: true 항목 기준, 시나리오별 pass/fail. evidence: 비디오, 스크린샷, trace.

---

## 6. Eval Spec 형식

FDE가 작성하고 검증한 상태로 시스템에 투입하는 입력:

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
    - name: 고객
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

  - id: FR-002
    title: 예약 상태 변경
    severity: hard
    test_method: e2e
    description: 예약 상세에서 확정/취소 상태 변경 가능

  - id: FR-003
    title: 대시보드 현황 표시
    severity: hard
    test_method: e2e
    description: 오늘 체크인/체크아웃 건수가 대시보드에 표시

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check

  - id: NFR-002
    title: 콘솔 에러 없음
    severity: hard
    test_method: console_check

data_source:
  type: mock             # mock | api | db_direct | db_snapshot

  # type: mock — 시드 데이터로 동작 (개발 단계)
  # mock_config:
  #   seed_data: true

  # type: api — 고객사 API 연동
  # api_config:
  #   base_url: "https://customer-api.com/v1"
  #   auth: bearer_token
  #   endpoints:
  #     - GET /reservations
  #     - POST /reservations

  # type: db_direct — 고객사 개발DB 직접 연결 (시연/PoC, 가장 흔함)
  # db_direct_config:
  #   type: postgresql
  #   connection_env: DATABASE_URL       # 환경변수로 주입
  #   tables: [customers, reservations, rooms]
  #   field_mapping:
  #     customers:
  #       customer_id: 고객번호
  #       full_name: 이름
  #       phone: 연락처
  #   read_only: true                    # 고객사 DB에 쓰기 방지

  # type: db_snapshot — 고객사 DB 스냅샷 로컬 복제 (보안 엄격한 경우)
  # db_snapshot_config:
  #   source_type: postgresql
  #   snapshot_path: ./data/customer-snapshot.sql
  #   anonymize: true
  #   tables: [customers, reservations, rooms]
  #   field_mapping: (db_direct와 동일)

external_secrets:
  - name: GOOGLE_MAPS_API_KEY
    description: 지도 표시에 필요
    required: true
  - name: TOSS_PAYMENTS_CLIENT_KEY
    description: 결제 연동에 필요
    required: false       # 없으면 mock으로 대체

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
```

### 6.2 External Secrets

eval spec에 `external_secrets`를 선언하면 Orchestrator가 실행 전에 환경변수 존재 여부를 확인한다. `required: true`인 키가 없으면 FDE에게 안내 후 중단한다.

FDE가 미처 선언하지 못한 키가 실행 중 필요해지는 경우, Evaluator가 콘솔 에러(`not defined`, `missing env`, `API_KEY`)를 `env_issue`로 분류해서 repair loop에 보내지 않고 FDE에게 escalation한다.

### 6.3 Data Source 계층

| 레벨 | 용도 | 빈도 |
|------|------|------|
| mock | 초기 개발, 플로우 검증 | 항상 (첫 단계) |
| db_direct | 고객사 개발DB 직접 연결, 실데이터 시연 | 매우 자주 |
| api | 고객사 API 연동 | 자주 |
| db_snapshot | 고객사 DB 스냅샷 로컬 복제 | 보안 엄격한 고객사 |

**`field_mapping`이 핵심이다.** 고객사 DB 스키마는 제각각이므로, "고객사의 이 컬럼 → 도메인의 이 필드" 매핑을 eval spec에 명시하면 Builder가 데이터 계층을 맞춰 구현한다.

**`read_only: true`를 기본으로 둔다.** 고객사 DB에 실수로 쓰기를 방지한다.

**권장 흐름:**
1. mock으로 먼저 전체 플로우 검증 통과
2. 고객사 개발DB 접속 정보 확보 + field_mapping 작성
3. data_source만 바꿔서 다시 실행
4. 실제 데이터로 시연

### 6.3 DB Safety Guard

고객사 DB에 연결할 때 위험한 쿼리(전체 삭제, WHERE 없는 UPDATE 등)를 방지하기 위해 3개 층으로 방어한다.

**층 1 — DB 유저 권한 (원천 차단)**

FDE가 고객사에 "CRUD 가능하되 DDL 불가인 DB 계정"을 요청한다. DROP, TRUNCATE, ALTER, GRANT 등 스키마 변경 명령을 DB 레벨에서 차단.

**층 2 — ORM 강제 + Hook (코드 패턴 제한)**

Builder의 CLAUDE.md 규칙:
- raw SQL 사용 금지, Prisma ORM만 사용
- 삭제는 반드시 `findUnique` → `delete` 패턴 (단건만 허용)
- `deleteMany`, `updateMany` 등 일괄 처리 금지

Hook으로 강제:
```bash
# post-edit hook
# raw SQL 패턴 감지 시 차단
if grep -rn "query\|execute\|raw\|sql\`" --include="*.ts" src/; then
  echo "ERROR: raw SQL detected. Use Prisma ORM only."
  exit 1
fi
# 일괄 처리 감지 시 차단
if grep -rn "deleteMany\|updateMany" --include="*.ts" src/; then
  echo "ERROR: Bulk operations not allowed. Use single-record operations."
  exit 1
fi
```

**층 3 — 쿼리 미들웨어 (런타임 방어)**

preset에 DB 프록시 미들웨어를 포함시켜 런타임에 위험한 쿼리를 차단한다:
- DELETE/UPDATE에 WHERE 조건 없으면 차단
- 한 번에 영향 받는 행 수 제한 (기본 10건)
- DROP, TRUNCATE, ALTER 등 완전 차단

| 층 | 방어 내용 | 적용 시점 |
|---|---|---|
| DB 유저 권한 | DDL 원천 차단 | DB 연결 전 (고객사에 요청) |
| ORM 강제 + Hook | raw SQL 차단, 일괄 처리 차단 | Builder 코드 생성 시 |
| 쿼리 미들웨어 | WHERE 없는 변경 차단, 영향 행 수 제한 | 프로토타입 런타임 |

---

## 7. 리포트 출력

### 7.1 출력 구조

```
workspace/run_2026_04_10_001/
├── app/                          # 실행 가능한 프로토타입
├── report/
│   ├── summary.md                # 전체 요약
│   ├── eval-results.json         # 기계 판독용 상세 결과
│   └── evidence/
│       ├── screenshots/          # 페이지별 스크린샷
│       ├── videos/               # E2E 시나리오 실행 영상
│       └── logs/                 # 빌드/테스트/콘솔 로그
└── meta/
    ├── eval-spec.yaml            # 투입된 검증 규약 원본
    ├── iterations.json           # 회차별 pass/fail 변화
    └── unresolved.md             # 미해결 항목 (escalation 사유)
```

### 7.2 summary.md 예시

```markdown
# 리조트 관리자 프로토타입 — 검증 리포트

## 결과: 통과 (4회 반복)

| 항목 | 상태 | 비고 |
|------|------|------|
| FR-001 신규 예약 등록 | PASS | 3회차에서 통과 |
| FR-002 예약 상태 변경 | PASS | 1회차부터 통과 |
| FR-003 대시보드 현황 | PASS | 4회차에서 통과 |
| NFR-001 빌드 성공 | PASS | |
| NFR-002 콘솔 에러 없음 | PASS | 2회차에서 해결 |

## 반복 이력
- 1회차: 빌드 성공, FR-002 통과, FR-001/FR-003 실패
- 2회차: 콘솔 에러 해결, FR-001 폼 validation 에러 수정 중
- 3회차: FR-001 통과, FR-003 대시보드 데이터 바인딩 실패
- 4회차: 전 항목 통과 → 종료

## Evidence
- 스크린샷: report/evidence/screenshots/
- E2E 영상: report/evidence/videos/
```

### 7.3 FDE가 이 리포트로 할 수 있는 것

- 고객에게 "이 기준으로 검증했고, 전부 통과했습니다" 제시
- 실패 항목이 있으면 "이건 추가 논의가 필요합니다" 투명하게 공유
- 반복 이력으로 시스템이 어떻게 문제를 해결했는지 설명 가능

---

## 8. 패키징 및 배포

### 8.1 배포 형태: Claude Code Plugin

```
fde-agent-plugin/
├── .claude-plugin/
│   └── plugin.json                    # 플러그인 메타데이터
│
├── skills/
│   └── run/
│       └── SKILL.md                   # /fde-agent:run 진입점
│
├── agents/
│   ├── builder.md                     # Builder 세션 시스템 프롬프트
│   └── test-writer.md                 # Test Writer 세션 시스템 프롬프트
│
├── hooks/
│   └── hooks.json                     # post-edit, pre-commit 가드레일
│
├── presets/
│   └── admin-web/
│       ├── core/
│       ├── rules/
│       └── test-pack/
│
├── global/
│   └── palettes/
│
└── orchestrator/
    ├── dist/                          # 빌드된 JS (plugin에 포함)
    │   └── index.js
    ├── src/
    └── package.json
```

### 8.2 실행 흐름

```
FDE: /fde-agent:run eval-spec.yaml

내부:
  SKILL.md → Bash 실행
    → node orchestrator/dist/index.js --spec eval-spec.yaml
      → while 루프 (최대 15회)
        → claude -p --system-prompt builder.md "task contract"
        → npm run build && npm run test
        → playwright test
        → 결과 파싱 → 통과/재시도/escalation
      → 리포트 생성
    → 프로세스 종료
  ← 결과를 FDE에게 표시
```

Orchestrator는 상주 서버가 아니다. 실행하면 돌고 끝나면 종료되는 CLI 스크립트다.

### 8.3 FDE 팀원 설치

```bash
# 1회: marketplace 등록
/plugin marketplace add your-org/fde-agent

# 설치
/plugin install fde-agent

# 사용
/fde-agent:run eval-spec.yaml
```

Node.js만 설치되어 있으면 별도 서버 설정 불필요.

---

## 9. FDE 워크플로우 (시스템 범위 밖 포함)

전체 워크플로우에서 이 시스템이 담당하는 범위:

```
고객 소통 → FDE가 요구사항 세분화
  → LLM과 정제
  → FDE 검토/수정
  → LLM 수치화
  → FDE 검증
  → eval spec 확정
─────────────────── 여기서부터 시스템 범위 ───────────────────
  → /fde-agent:run eval-spec.yaml
  → preset 선택 + workspace 생성
  → Builder 실행 → Evaluator 검증 → repair loop
  → 리포트 + 프로토타입 출력
─────────────────── 여기까지 시스템 범위 ───────────────────
  → FDE가 결과물 + 리포트를 고객과 공유
```

---

## 10. MVP 성공 기준

1. `admin-web` preset으로 관리자 웹 프로토타입 생성 가능
2. eval spec의 hard constraint 기준으로 pass/fail 판정 가능
3. 최소 2회 이상 자동 repair loop 동작
4. 동일한 eval spec으로 여러 번 실행했을 때 일관된 품질의 결과물 산출
5. FDE가 리포트를 고객과 공유할 수 있는 형태로 출력

---

## 11. 향후 확장 경로

| 단계 | 내용 |
|------|------|
| MVP 이후 | 반응형 검사, 스크린샷 비교 evaluator 추가 |
| Phase 2 | corporate-site, ecommerce-web preset 추가 |
| Phase 3 | Requirements-to-Eval Compiler (반자동) |
| Phase 4 | 로컬 LLM Builder 구현체 추가 |
| Phase 5 | Mobile App / Backend API harness 확장 |
| Phase 6 | Multi-artifact orchestration (웹 + API + 문서 동시) |
