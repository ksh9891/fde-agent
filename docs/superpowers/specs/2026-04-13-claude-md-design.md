# CLAUDE.md 설계 (레포 루트)

**Date**: 2026-04-13
**Target file**: `/Users/kimsanghyun/develop/AI/fde_agent/CLAUDE.md`
**Audience**: Claude (LLM) — 이 레포에서 코드 작업을 보조할 때 매 대화에 자동 로드됨
**Inspiration**: [humanlayer — Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

---

## 목적

fde-agent 레포에서 Claude Code가 반복적으로 잘못 이해하거나 기본값으로 엇나가는 지점을 CLAUDE.md 한 파일로 교정한다.

## 설계 원칙

1. **짧게**: 60~120줄 목표. humanlayer 가이드 "<300줄, 가능하면 <60줄"을 따른다.
2. **Claude 전용 프롬프트**: 인간 온보딩 문서가 아니다. README·설계문서와 역할을 나눈다.
3. **지시 수 제한**: Claude Code 시스템 프롬프트가 이미 ~50개를 쓴다. 이 파일은 5~10개 수준의 강한 규칙만.
4. **중복 금지**: 커밋 규칙, YAGNI, 린터/포매터, 파일 생성 자제 같은 시스템 프롬프트 기본값은 다시 쓰지 않는다.
5. **Progressive disclosure**: 세부는 기존 문서로 포인터만 준다.

## 섹션 구조

### 1. Project one-liner (3~5줄)

WHAT과 WHY를 한 문단에 압축.

> FDE Harness Agent — Claude Code Plugin. Eval spec을 입력받아 preset 기반 프로토타입을 생성하고 deterministic evaluation으로 검증한다. **핵심 분리: Orchestrator(TypeScript CLI)가 루프의 주인이고, Claude Code는 생성/수정을 담당하는 Builder runtime일 뿐이다.**

### 2. Repo 경계 지도

혼동 교정용. 어디가 "우리 코드"이고 어디가 "생성물의 템플릿"인지 명시.

- `fde-agent/orchestrator/` — 우리가 짜는 TypeScript CLI. Deterministic 로직. **LLM 호출은 `src/builder/claude-code.ts` 한 군데로만** 격리.
- `fde-agent/presets/<preset>/` — Builder가 생성할 프로토타입의 스캐폴드/규칙. 여기를 고칠 때는 "생성물"을 바꾸는 것이지 orchestrator 동작이 아님.
  - `core/scaffold/` — Next.js + shadcn/ui 기본 프로젝트
  - `rules/CLAUDE.md` — Builder(헤드리스 Claude)에게 주는 규칙. 이 파일과 역할 다름.
  - `test-pack/` — E2E 시나리오 템플릿
- `fde-agent/global/palettes/` — 팔레트(전역 톤 앤 매너). preset과 독립.
- `fde-agent/workspaces/` — 런타임 산출물. 읽기만. 커밋·수정 대상 아님.
- `fde-agent/agents/*.md`, `fde-agent/skills/*/SKILL.md`, `fde-agent/hooks/hooks.json` — 플러그인 정의 파일.
- `docs/`, `fde_harness_agent_design*.md` — 설계 레퍼런스. **코드와 충돌 시 코드가 진실.**

### 3. 불변 설계 원칙

아키텍처 위반을 차단하는 강한 규칙.

- Orchestrator는 deterministic. LLM 호출은 `builder/claude-code.ts`와 `agents/*.md` 프롬프트 경계 안에만.
- **루프 종료 판단은 evaluator가 한다.** Builder가 "완료했다"고 주장해도 evaluator가 pass 내지 않으면 루프는 계속 돈다. Builder 자체 평가로 종료 로직을 만들지 말 것.
- Preset = 패턴(목록/상세/폼/대시보드). **도메인은 eval spec에서 주입된다.** 패턴 파일에 엔티티명·필드명 하드코딩 금지.
- 팔레트는 `global/palettes/`에만. preset 스캐폴드에 색상 하드코딩 금지.
- 최대 repair 반복 15회. 이 상수를 바꾸려면 설계 문서 업데이트가 선행되어야 한다.

### 4. 완료 전 검증

"했다"고 선언하기 전에 해당 범위 검증을 **실제로 실행**한다.

| 변경 범위 | 실행 명령 |
|---|---|
| Orchestrator 코드 | `cd fde-agent/orchestrator && npm run build && npm run test` |
| Scaffold | `cd fde-agent/presets/admin-web/core/scaffold && npm install && npm run build` |
| Eval spec 파서/스키마 | 위 orchestrator 테스트 + `examples/resort-admin-spec.yaml` 스모크 |
| Preset rules / agents 프롬프트 | `examples/` 스펙으로 `/fde-agent:run` 스모크 |

검증 명령을 돌리지 않았거나 실패한 상태에서 "완료"라고 보고하지 않는다.

### 5. Progressive disclosure 포인터

더 알아야 하면 읽을 것:

- 전체 아키텍처 & 설계 의도: `fde_harness_agent_design_v2.md`
- 플러그인 사용법·구조·로드맵: `fde-agent/README.md`
- Builder 시스템 프롬프트: `fde-agent/agents/builder.md`
- Builder 규칙(preset별): `fde-agent/presets/<preset>/rules/CLAUDE.md`
- Orchestrator 엔트리: `fde-agent/orchestrator/src/index.ts`, `loop.ts`

---

## 의도적으로 제외하는 것

다음은 Claude Code 시스템 프롬프트·전용 도구가 이미 처리하므로 CLAUDE.md에서 중복 기재하지 않는다.

- 커밋/push 규칙 (시스템 프롬프트: 명시 요청 없이 커밋 금지)
- YAGNI, 기존 파일 선호, 불필요 추상화 금지 (시스템 프롬프트 기본값)
- 린터/포매터 (deterministic tool·hook으로 분리)
- 기술 스택 상세 (README.md에 있음)
- 코딩 스타일 상세 (코드 자체가 레퍼런스)

## 품질 체크리스트 (작성 후 확인)

- [ ] 120줄 이하
- [ ] "강한 지시"는 10개 이하 (bullet 수 기준)
- [ ] 시스템 프롬프트와 중복되는 조항 없음
- [ ] 모든 포인터 경로가 실제 존재 (작성 시 1회 검증)
- [ ] WHAT/WHY/HOW 3요소가 한 번씩은 등장

## 파일 경로 (최종 산출물)

- `/Users/kimsanghyun/develop/AI/fde_agent/CLAUDE.md`

## 다음 단계

이 spec 승인 후 writing-plans skill로 구현 계획 수립 → CLAUDE.md 초안 작성.
