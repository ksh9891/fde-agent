# FDE Harness Agent

**Preset 기반 프로토타입 생성 + Eval-Driven 품질 검증 시스템**

FDE(Forward Deployed Engineer)가 고객 요구사항을 검증 가능한 프로토타입으로 빠르게 전환하기 위한 Claude Code Plugin.

## 핵심 개념

```
Eval Spec (검증규약)
  → Preset 선택 + Workspace 생성
  → Builder (Claude Code Headless) 실행
  → Evaluator (빌드/테스트/페이지 검증)
  → 실패 시 Repair Loop (최대 15회)
  → 통과 시 리포트 + 프로토타입 출력
```

### 설계 원칙

- **Claude Code는 Builder Runtime** — 전체 시스템이 아니라 생성/수정 엔진
- **Orchestrator가 루프를 제어** — 종료 판단은 deterministic evaluation
- **Preset = 패턴 공장** — 기능이 아니라 패턴(목록/상세/폼/대시보드)을 공통화하고, 도메인은 주입
- **글로벌 팔레트** — 같은 preset이라도 고객에 맞는 톤 앤 매너 적용

## 사용법

### 1. Plugin 설치

```bash
/plugin marketplace add your-org/fde-agent
/plugin install fde-agent
```

### 2. Eval Spec 작성

```yaml
# eval-spec.yaml
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
    - 신규 예약 등록
    - 예약 상태 변경

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
    description: npm run build가 성공해야 한다

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
```

### 3. 실행

```bash
/fde-agent:run eval-spec.yaml
```

### 4. 결과

```
[FDE-AGENT] Status: completed
[FDE-AGENT] Total iterations: 1
[FDE-AGENT] Report written to: workspaces/<run-id>/report/summary.md
```

생성되는 결과물:
- `workspaces/<run-id>/app/` — 실행 가능한 Next.js 프로토타입
- `workspaces/<run-id>/report/summary.md` — 검증 리포트
- `workspaces/<run-id>/meta/iterations.json` — 반복 이력

## 프로젝트 구조

```
fde-agent/
├── .claude-plugin/plugin.json     # Plugin manifest
├── skills/run/SKILL.md            # /fde-agent:run 진입점
├── agents/
│   ├── builder.md                 # Builder 시스템 프롬프트
│   └── test-writer.md             # Test Writer 시스템 프롬프트
├── hooks/hooks.json               # raw SQL/bulk op 차단
├── global/palettes/               # 글로벌 팔레트 (3종)
│   ├── corporate-blue.json
│   ├── warm-neutral.json
│   └── dark-modern.json
├── presets/admin-web/
│   ├── core/scaffold/             # Next.js + shadcn/ui 기본 프로젝트
│   ├── rules/CLAUDE.md            # Builder 규칙
│   └── test-pack/scenarios/       # E2E 시나리오 템플릿
├── orchestrator/                  # TypeScript CLI
│   └── src/
│       ├── index.ts               # CLI 진입점
│       ├── loop.ts                # 메인 루프 (최대 15회)
│       ├── eval-spec-parser.ts    # YAML 파싱 + Zod 검증
│       ├── task-contract.ts       # 작업 계약 생성
│       ├── classifier.ts          # 에러 분류 (repairable/env_issue/unknown)
│       ├── provisioner.ts         # workspace 생성 + 스켈레톤 페이지 자동 생성
│       ├── reporter.ts            # 검증 리포트 생성
│       ├── resume.ts              # 중단/재개
│       ├── builder/claude-code.ts # Claude Code headless 호출
│       └── evaluator/             # 빌드/유닛테스트/페이지 검증
└── examples/
    └── resort-admin-spec.yaml     # 예시 eval spec
```

## 생성되는 프로토타입 기능

`admin-web` preset 기준:

- 로그인/인증 (mock)
- 사이드바 + 헤더 레이아웃 (반응형)
- 엔티티별 CRUD 페이지 자동 생성
  - 목록 (검색, 페이지네이션)
  - 상세 (삭제 포함)
  - 등록/수정 폼
- 대시보드 (StatCard)
- JSON 파일 기반 데이터 저장 (서버 재시작해도 유지)
- API Route 자동 생성 (`/api/[entity]`, `/api/[entity]/[id]`)
- 현실적 한국어 시드 데이터 자동 생성

## 팔레트

| 팔레트 | 분위기 | 적합한 고객 |
|--------|--------|-------------|
| corporate-blue | 신뢰/전문 | 금융, 컨설팅, B2B |
| warm-neutral | 부드러운 | 리조트, 호텔, 라이프스타일 |
| dark-modern | 모던/테크 | IT, 스타트업, SaaS |

## Data Source 지원

| 타입 | 용도 |
|------|------|
| `mock` | 개발/시연용 시드 데이터 |
| `db_direct` | 고객사 개발DB 직접 연결 |
| `api` | 고객사 API 연동 |
| `db_snapshot` | DB 스냅샷 로컬 복제 |

## Escalation & Resume

외부 API 키 누락, DB 접속 실패 등 Builder가 해결할 수 없는 문제는 자동으로 FDE에게 escalation됩니다.

```bash
# 환경 문제 해결 후 재개
/fde-agent:run eval-spec.yaml --resume <run-id>
```

## 개발

```bash
# Orchestrator 빌드
cd orchestrator && npm install && npm run build

# 테스트
npm run test

# Scaffold 빌드 확인
cd presets/admin-web/core/scaffold && npm install && npm run build
```

## 기술 스택

- **Orchestrator**: TypeScript, Node.js, Zod, js-yaml, execa
- **Scaffold**: Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui
- **Testing**: Vitest (orchestrator), Playwright (E2E — Phase 2)

## 향후 계획

| 단계 | 내용 |
|------|------|
| Phase 2 | Playwright E2E evaluator, 반응형/스크린샷 비교 |
| Phase 3 | corporate-site, ecommerce-web preset 추가 |
| Phase 4 | Requirements-to-Eval Compiler (반자동) |
| Phase 5 | 로컬 LLM Builder 지원 |
| Phase 6 | Mobile App / Backend API harness |

## 라이선스

Private
