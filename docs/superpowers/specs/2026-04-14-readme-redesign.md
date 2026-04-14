# README 리디자인 설계

## 배경

현재 README.md는 Phase 1 구현 이후 실제 코드와 불일치하는 부분이 있고, "내부 개발자 매뉴얼" 스타일로 작성되어 있어 새 팀원이 "이해 → 실행 → 깊은 이해" 흐름을 따라가기 어려움.

## 의사결정

- **주 독자**: FDE 팀원 (팀 초기 단계, 페르소나 미확정)
- **언어**: 한국어
- **스타일**: "실전 가이드" — FastAPI README 참고. 가치 제안 → 흐름 → Quick Start → 상세
- **범위**: 제대로 한번 잡기. 현재 코드와 동기화하고, 나중에 독자가 명확해지면 톤만 조정

## README 구조

### 1. 프로젝트명 + 한 줄 설명

```markdown
# FDE Harness Agent

> Eval Spec 하나로 검증된 프로토타입을 자동 생성하는 Claude Code Plugin
```

### 2. About

문제-해결-대상 구조:
- **문제**: 프로토타입을 수작업으로 만들면 느리고, AI에게 그냥 시키면 빌드조차 안 되는 결과물이 나옴
- **해결**: Eval Spec(검증규약)을 정의하면, Orchestrator가 빌드/테스트/페이지 검증을 통과할 때까지 자동으로 생성-검증-수정을 반복
- **대상**: FDE 팀원 — 고객 미팅 전에 동작하는 프로토타입이 필요한 사람

### 3. 핵심 흐름 + 핵심 원칙

텍스트 다이어그램으로 파이프라인 표현. 핵심 원칙 3줄:
- Orchestrator가 루프 제어, Claude Code는 생성/수정만
- 종료 판단은 Builder가 아니라 Evaluator
- Preset = 패턴, 도메인은 Eval Spec에서 주입

### 4. Features (7개, 사용자 가치 중심)

- Eval-Driven 품질 보장 (빌드/콘솔/페이지/E2E 자동 검증)
- Preset 기반 생성 (admin-web: CRUD + 대시보드 + 인증)
- 도메인 자유 주입 (entities/fields만 변경)
- 글로벌 팔레트 (3종)
- 자동 수정 루프 (최대 15회)
- 중단/재개 (`--resume`)
- E2E 테스트 자동 생성 (key_flows 기반 Playwright)

### 5. Quick Start

전제조건 → 4단계 복붙 가능:
1. Plugin 설치: `/plugin marketplace add ksh9891/fde-agent` → `/plugin install fde-agent`
2. Orchestrator 빌드: `cd orchestrator && npm install && npm run build`
3. 첫 실행: `/fde-agent:run examples/resort-admin-spec.yaml`
4. 결과 확인: `workspaces/<run-id>/` 아래 app, report, meta

### 6. Usage

- Eval Spec YAML 작성법 (인라인 주석으로 필드 설명)
- 실행 명령 + `--resume` 옵션
- Evaluator 종류 테이블: build_check, console_check, page_check, e2e

### 7. Configuration

- **Preset 테이블**: admin-web (포함 패턴 명시), 향후 추가 예정 표기
- **팔레트 테이블**: corporate-blue, warm-neutral, dark-modern
- **Data Source 테이블**: mock(O), db_direct/api/db_snapshot(예정) — 현재 지원 여부 명시

### 8. 프로젝트 구조

디렉터리 트리 + 각 항목 한 줄 역할 설명. Phase 1 추가분 반영:
- `test-generation-stage.ts`
- evaluator 5종 (build-check, console-check, page-check, e2e, unit-test)

### 9. 개발

```bash
cd orchestrator && npm install && npm run build && npm run test
cd presets/admin-web/core/scaffold && npm install && npm run build
```

### 10. 기술 스택

테이블: Orchestrator / Scaffold / Testing 영역별 스택

### 11. Project Status

Phase 1 완료(Alpha) 명시. Phase 1~6 테이블에 상태 컬럼(완료/예정) 추가.

### 12. License

Private

## 현재 README에서 제거되는 섹션

- **"생성되는 프로토타입 기능"**: Features에 통합
- **"Escalation & Resume"**: Usage의 `--resume`과 About에 흡수
- **"Data Source 지원" (독립 섹션)**: Configuration 하위로 이동

## 현재 README에서 추가되는 내용

- About 섹션 (문제-해결-대상)
- Features (사용자 가치 중심 재작성)
- Evaluator 종류 테이블
- Data Source 현재 지원 여부
- Project Status 상태 컬럼
- Quick Start 전제조건 명시
