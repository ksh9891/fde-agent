# FDE Harness Agent

> Eval Spec 하나로 검증된 프로토타입을 자동 생성하는 Claude Code Plugin

## About

FDE(Forward Deployed Engineer)가 고객 현장에서 요구사항을 프로토타입으로 빠르게 전환해야 할 때, "대충 만들어서 보여주기"가 아니라 **검증 조건을 통과한 프로토타입**을 자동으로 만들어주는 시스템입니다.

- **문제**: 프로토타입을 수작업으로 만들면 느리고, AI에게 그냥 시키면 빌드조차 안 되는 결과물이 나옴
- **해결**: Eval Spec(검증규약)을 정의하면, Orchestrator가 빌드/테스트/페이지 검증을 통과할 때까지 자동으로 생성-검증-수정을 반복
- **대상**: FDE 팀원 — 고객 미팅 전에 동작하는 프로토타입이 필요한 사람

## 핵심 흐름

```text
Eval Spec → Preset 선택 → Workspace 생성 → Builder(Claude Code) 생성
  → Evaluator 검증 (빌드/콘솔/페이지/E2E)
  → 실패 시 자동 수정 (최대 15회)
  → 통과 시 프로토타입 + 검증 리포트 출력
```

핵심 원칙:

- **Orchestrator(TypeScript CLI)가 루프를 제어**하고, Claude Code는 생성/수정만 담당
- **종료 판단은 Builder가 아니라 Evaluator**가 한다
- **Preset = 패턴**(목록/상세/폼/대시보드). 도메인은 Eval Spec에서 주입

## Features

- **Eval-Driven 품질 보장** — 빌드 성공, 콘솔 에러 없음, 페이지 렌더링, E2E 테스트까지 자동 검증
- **Preset 기반 생성** — admin-web preset으로 CRUD + 대시보드 + 인증 화면을 즉시 스캐폴딩
- **도메인 자유 주입** — 리조트든 병원이든, Eval Spec의 entities/fields만 바꾸면 됨
- **글로벌 팔레트** — 같은 preset이라도 고객 톤 앤 매너에 맞게 3종 팔레트 적용
- **자동 수정 루프** — 검증 실패 시 에러를 분류하고 Builder에게 수정을 지시, 최대 15회 반복
- **중단/재개** — 환경 문제로 멈추면 `--resume`으로 이어서 실행
- **E2E 테스트 자동 생성** — key_flows 기반으로 Playwright 테스트를 자동 작성하여 검증

## Quick Start

### 전제조건

- Claude Code CLI 설치 및 인증 완료
- Node.js 22+
- npm 10+

### 1. Plugin 설치

```bash
# marketplace 등록
/plugin marketplace add ksh9891/fde-agent

# plugin 설치
/plugin install fde-agent@fde-agent-marketplace
```

또는 직접 clone하여 로컬 설치:

```bash
git clone https://github.com/ksh9891/fde-agent.git
claude --plugin-dir /path/to/fde-agent
```

### 2. 첫 실행

> Orchestrator 의존성 설치와 빌드는 첫 실행 시 자동으로 수행됩니다.

```bash
/fde-agent:run examples/resort-admin-spec.yaml
# 또는 B2C 예약형(booking-web) 예시:
/fde-agent:run examples/resort-booking-spec.yaml
```

### 3. 결과 확인

실행이 완료되면 `workspaces/<run-id>/` 아래에 결과물이 생성됩니다:

| 경로 | 내용 |
|------|------|
| `app/` | 실행 가능한 Next.js 프로토타입 |
| `report/summary.md` | 검증 리포트 (pass/fail 상세) |
| `meta/iterations.json` | 반복 이력 |

프로토타입 직접 실행:

```bash
cd workspaces/<run-id>/app
npm run dev
```

## Usage

### Eval Spec 작성

Eval Spec은 프로토타입의 도메인, 검증 조건, 제약사항을 정의하는 YAML 파일입니다.

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
    - 신규 예약 등록
    - 예약 상태 변경

requirements:
  - id: FR-001
    title: 신규 예약 등록
    severity: hard          # hard = 반드시 통과, soft = 권장
    test_method: e2e        # build_check | console_check | unit_test | e2e
    description: 객실 선택 → 고객 정보 입력 → 저장까지 완료 가능
    acceptance_criteria:
      - "예약 등록 폼에서 객실, 체크인/체크아웃, 고객명을 입력할 수 있다"
      - "저장 후 예약 목록에 새 항목이 추가된다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check

data_source:
  type: mock                # mock | db_direct | api | db_snapshot

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
  - 한국어 UI
```

### 실행

```bash
# 기본 실행
/fde-agent:run --spec eval-spec.yaml

# 중단된 실행 재개
/fde-agent:run --spec eval-spec.yaml --resume <run-id>
```

### Evaluator 종류

| test_method | 검증 내용 |
|-------------|----------|
| `build_check` | `npm run build` 성공 여부 |
| `unit_test` | `npm run test` (Vitest) 성공 여부 |
| `console_check` | 브라우저 콘솔 치명적 에러 없음 |
| `e2e` | Playwright 기반 사용자 흐름 테스트 |

> `page_check`는 Evaluator 파이프라인에서 자동으로 실행되지만, Eval Spec의 test_method로는 지정하지 않습니다.

## Configuration

### Preset

현재 사용 가능한 preset:

| Preset | 설명 | 포함 패턴 |
|--------|------|----------|
| `admin-web` | 관리자 페이지 | 목록/상세/폼/대시보드, 사이드바+헤더 레이아웃, 로그인(mock) |
| `booking-web` | B2C 예약 사이트 | 랜딩/카탈로그 목록·상세/회원가입·로그인/예약·내 예약, `(public)`+`(member)` 2-그룹 shell |

> 향후 `corporate-site`, `ecommerce-web` 등 추가 예정

### 팔레트

Eval Spec의 `palette` 필드로 지정합니다. 같은 preset이라도 고객에 맞는 톤 앤 매너를 적용할 수 있습니다.

| 팔레트 | 분위기 | 적합한 고객 |
|--------|--------|-------------|
| `corporate-blue` | 신뢰/전문 | 금융, 컨설팅, B2B |
| `warm-neutral` | 부드러운 | 리조트, 호텔, 라이프스타일 |
| `dark-modern` | 모던/테크 | IT, 스타트업, SaaS |

### Data Source

| 타입 | 용도 | 현재 지원 |
|------|------|----------|
| `mock` | 개발/시연용 시드 데이터 자동 생성 | O |
| `db_direct` | 고객사 개발DB 직접 연결 | 예정 |
| `api` | 고객사 API 연동 | 예정 |
| `db_snapshot` | DB 스냅샷 로컬 복제 | 예정 |

## 프로젝트 구조

```text
fde-agent/
├── orchestrator/              # TypeScript CLI — 루프 제어, 평가, 리포트
│   └── src/
│       ├── index.ts           # CLI 진입점
│       ├── loop.ts            # 메인 루프 (최대 15회)
│       ├── eval-spec-parser.ts
│       ├── provisioner.ts     # workspace 생성 + 스켈레톤 페이지
│       ├── task-contract.ts   # Builder에게 전달할 작업 계약
│       ├── classifier.ts      # 에러 분류 (repairable/env_issue/unknown)
│       ├── reporter.ts        # 검증 리포트 생성
│       ├── resume.ts          # 중단/재개
│       ├── test-generation-stage.ts  # key_flows + requirements → E2E 테스트 생성
│       ├── builder/
│       │   ├── interface.ts          # BuilderInterface 정의
│       │   └── claude-code.ts        # Claude Code headless 호출
│       └── evaluator/         # build-check, console-check, page-check, e2e, unit-test
├── presets/admin-web/
│   ├── core/scaffold/         # Next.js + shadcn/ui 기본 프로젝트
│   ├── rules/
│   │   ├── CLAUDE.md          # Builder(헤드리스 Claude)용 규칙
│   │   └── protected-files.json  # Builder 수정 금지 파일 목록
│   └── test-pack/scenarios/   # E2E 시나리오 템플릿
├── global/palettes/           # 팔레트 JSON (3종)
├── agents/                    # builder.md, test-writer.md
├── skills/run/SKILL.md        # /fde-agent:run 진입점
├── hooks/hooks.json           # 안전장치 (raw SQL/bulk op 차단)
├── examples/                  # 예시 eval spec
└── workspaces/                # 런타임 산출물 (gitignore)
```

## 개발

```bash
# Orchestrator 빌드 + 테스트
cd orchestrator
npm install
npm run build
npm run test

# Scaffold 빌드 확인
cd presets/admin-web/core/scaffold
npm install
npm run build
```

## 기술 스택

| 영역 | 스택 |
|------|------|
| Orchestrator | TypeScript, Node.js, Zod, js-yaml, execa |
| Scaffold | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Testing | Vitest (orchestrator), Playwright (E2E) |

## Project Status

**현재: Phase 2B 완료 (Alpha)**

Orchestrator 코어 루프 + 5종 Evaluator + E2E 테스트 자동 생성 + requirement_id 기반 severity 매핑 + entity slug/acceptance_criteria 지원이 동작합니다.

| 단계 | 내용 | 상태 |
|------|------|------|
| Phase 1 | Orchestrator + Evaluator 파이프라인 + E2E | 완료 |
| Phase 2A | requirement_id E2E binding + Test Writer blocking | 완료 |
| Phase 2B | Entity slug + acceptance_criteria | 완료 |
| Phase 3 | 반응형 검증, 스크린샷 비교 | 예정 |
| Phase 4 | booking-web preset 추가 (리조트·호텔·병원예약) | 완료 |
| Phase 4+ | corporate-site, ecommerce-web preset 추가 | 예정 |
| Phase 5 | Requirements-to-Eval Compiler (반자동) | 예정 |
| Phase 6 | 로컬 LLM Builder 지원 | 예정 |
| Phase 7 | Mobile App / Backend API harness | 예정 |

## License

MIT
