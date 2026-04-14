# fde-agent — Claude 작업 규칙

이 파일은 레포에서 작업하는 Claude(LLM)를 위한 지시문이다. 인간 온보딩 문서가 아니다. 같은 주제의 상세는 README/설계 문서에 있다 — 여기는 Claude가 반복해서 틀리는 지점만 교정한다.

## 프로젝트 한 줄

FDE Harness Agent는 Claude Code Plugin이다. Eval spec을 입력받아 preset 기반 프로토타입을 생성하고 deterministic evaluation으로 검증한다. **Orchestrator(TypeScript CLI)가 루프의 주인이고, Claude Code는 생성/수정을 담당하는 Builder runtime일 뿐이다.**

## 셋업

```bash
cd orchestrator && npm install   # orchestrator 의존성
```

Scaffold(`presets/admin-web/core/scaffold/`)의 의존성은 Provisioner가 런타임에 설치하므로 수동 설치 불필요.

## 레포 경계 지도

어디가 "우리 코드"이고 어디가 "생성물의 템플릿/산출물"인지 혼동하지 말 것.

- `orchestrator/` — 우리가 짜는 TypeScript CLI. Deterministic 로직. **LLM 호출은 agent 경계 내부(`src/builder/claude-code.ts`, `src/test-generation-stage.ts`)로 격리**한다.
- `presets/<preset>/` — Builder가 생성할 프로토타입의 스캐폴드/규칙. 여기를 수정하는 것은 "생성물"을 바꾸는 것이지 orchestrator 동작을 바꾸는 것이 아니다.
  - `core/scaffold/` — Next.js + shadcn/ui 기본 프로젝트
  - `rules/CLAUDE.md` — Builder(헤드리스 Claude)용 규칙. 이 루트 CLAUDE.md와 역할이 다르다.
  - `test-pack/` — E2E 시나리오 템플릿
- `global/palettes/` — 팔레트(전역 톤 앤 매너). preset과 독립.
- `workspaces/` — 런타임 산출물. 읽기만. 수정·커밋 대상 아님.
- `agents/*.md`, `skills/*/SKILL.md`, `hooks/hooks.json` — 플러그인 정의.
- `docs/design/fde_harness_agent_design*.md`, `docs/superpowers/` — 설계 레퍼런스. **코드와 충돌 시 코드가 진실이다.**

## 불변 설계 원칙

- Orchestrator는 deterministic이다. 새로운 LLM 호출을 agent 경계(`builder/claude-code.ts`, `test-generation-stage.ts`, `agents/*.md` 프롬프트) 밖에 추가하지 말 것.
- **루프 종료 판단은 evaluator가 한다.** Builder가 "완료했다"고 주장해도 evaluator가 pass 내지 않으면 루프는 계속 돈다. Builder 자가 평가로 종료 로직을 만들지 말 것.
- Preset = 패턴(목록/상세/폼/대시보드). **도메인은 eval spec에서 주입된다.** 패턴 파일에 엔티티명·필드명을 하드코딩하지 말 것.
- 팔레트는 `global/palettes/`에만. preset 스캐폴드에 색상을 하드코딩하지 말 것.
- 최대 repair 반복 15회 상수를 바꾸려면 설계 문서 업데이트가 먼저다.
- `orchestrator/dist/`는 gitignore 대상이다. 스킬 실행 시 자동 빌드된다. dist/를 커밋하지 말 것.

## Evaluator 파이프라인

Evaluator 5종이 순서대로 실행된다: `build` → `unit_test` → `page_check` → `console` → `e2e`. 앞 3개(build, unit_test, page_check)는 **blocking** — hard severity 실패 시 나머지 evaluator를 건너뛴다. console과 e2e는 non-blocking이므로 항상 실행된다.

## 완료 전 검증

"했다"고 선언하기 전에 해당 범위의 명령을 **직접 실행**해서 통과를 확인한다.

| 변경 범위 | 실행 명령 |
|---|---|
| Orchestrator 코드 | `cd orchestrator && npm run build && npm run test` |
| Scaffold | `cd presets/admin-web/core/scaffold && npm install && npm run build` |
| Eval spec 파서/스키마 | 위 orchestrator 테스트 + `examples/resort-admin-spec.yaml`로 스모크 |
| Preset rules / agents 프롬프트 | `examples/`의 스펙으로 `/fde-agent:run` 스모크 |

검증 명령을 돌리지 않았거나 실패 상태에서 "완료"라고 보고하지 말 것.

## 더 필요하면

- 전체 아키텍처·설계 의도: `docs/design/fde_harness_agent_design_v2.md`
- 플러그인 사용법·구조·로드맵: `README.md`
- Builder 시스템 프롬프트: `agents/builder.md`
- Builder 규칙(preset별): `presets/<preset>/rules/CLAUDE.md`
- Orchestrator 엔트리: `orchestrator/src/index.ts`, `loop.ts`
