# booking-web Preset 설계 (Phase 4 착수)

- **작성일**: 2026-04-21
- **작성자**: SangHyun Kim
- **상태**: 설계 승인 대기 → 이후 writing-plans로 인수

## 1. 배경과 목적

### 1.1 문제
현재 FDE Harness Agent는 `admin-web` preset 하나만 제공한다. admin-web은 sidebar+header 기반의 백오피스 CRUD 레이아웃에 특화되어 있어, **B2C 예약형 사이트**(리조트·호텔·스파·병원예약·투어 등)의 요구사항을 만족하는 프로토타입을 생성할 수 없다.

팀원들끼리 각자의 하네스로 같은 eval spec을 돌려 품질을 비교할 때, 리조트 예약 같은 B2C 스펙을 하네스가 기본 커버하지 못하면 "preset 기반 균일 품질"이라는 이 하네스의 핵심 셀링 포인트가 성립하지 않는다.

### 1.2 검토했으나 기각한 대안
"preset에 매칭되지 않으면 AI free-form 디자인에 맡긴다"는 fallback 아이디어가 있었으나 기각했다.

- 하네스의 본질("AI에 그냥 맡기면 빌드도 안 된다 → preset+evaluator로 해결")과 정면 충돌
- evaluator 루프 중 test-pack 자동 생성이 preset의 구조적 규약(URL·셀렉터·레이아웃)에 의존 — free-form이면 매번 구조가 달라 일반화 불가
- 팀원 비교에서 "내 하네스의 품질 균일성"을 증명해야 할 자리에 AI-의존 모드를 넣으면 차별점이 사라짐

### 1.3 해결 방향
`booking-web`이라는 **신규 preset**을 추가해 "재고+예약 확정" 플로우를 갖는 B2C 예약형 사이트 전반을 커버한다. preset 이름을 `consumer-web`이 아닌 `booking-web`으로 잡는 이유는 핵심 패턴이 카탈로그 조회와 **재고 기반 예약 확정**이기 때문이며, 이후 로드맵에 있는 `ecommerce-web`(장바구니·결제) / `corporate-site`(랜딩·CMS)와 기능적으로 겹치지 않게 된다.

## 2. 설계 원칙

이 preset은 기존 하네스 철학을 **그대로** 따른다.

1. **preset = 패턴 + shell**, 도메인 로직은 eval spec의 requirement/acceptance_criteria로 주입한다. 회원유형·재고 차감·예약 검증 같은 도메인 규칙을 preset의 scaffold/엔진에 내장하지 않는다.
2. **evaluator 루프가 품질을 보장**한다. Builder의 해석 편차는 build → unit_test → page_check → console → e2e 5종 evaluator가 잡는다.
3. **orchestrator·에이전트 코드는 변경하지 않는다**. preset은 디렉터리 단위 자산이고, `provisioner`가 preset 경로만 다르게 읽는다.
4. **팔레트는 preset 독립**이다. 기존 3종(`corporate-blue`, `warm-neutral`, `dark-modern`)을 그대로 재사용한다.

## 3. 디렉터리 구조

```
presets/booking-web/
├── core/scaffold/                 # Next.js + shadcn/ui 신규 scaffold
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)/          # 공개 영역 (헤더+푸터)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                 # 랜딩
│   │   │   │   ├── {slug}/page.tsx          # 카탈로그 목록
│   │   │   │   ├── {slug}/[id]/page.tsx     # 카탈로그 상세
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (member)/          # 보호 영역 (헤더+푸터, auth gate)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── book/[itemId]/page.tsx   # 예약 진행
│   │   │   │   └── my/reservations/page.tsx # 내 예약
│   │   │   └── api/               # auth, entity CRUD, booking
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── public-layout.tsx
│   │   │   │   └── member-layout.tsx
│   │   │   └── shared/
│   │   │       ├── catalog-card.tsx         # 카드형 목록 아이템
│   │   │       ├── catalog-grid.tsx         # 카드 그리드
│   │   │       ├── form-builder.tsx         # admin-web에서 재사용
│   │   │       ├── auth-gate.tsx            # 보호 영역 래퍼
│   │   │       ├── cta-button.tsx
│   │   │       └── status-badge.tsx         # admin-web에서 재사용
│   │   └── lib/
│   │       ├── data-store.ts                # admin-web에서 재사용
│   │       ├── auth.tsx                     # 세션+리디렉션 규칙
│   │       ├── design-tokens.ts
│   │       └── utils.ts
│   ├── e2e/                       # Playwright 기본 설정 + 생성된 테스트 위치
│   ├── package.json / tsconfig.json / 기타 설정
│   └── README.md
├── rules/
│   ├── CLAUDE.md                  # Builder 규칙(booking-web 전용)
│   └── protected-files.json       # Builder 수정 금지 파일 목록
└── test-pack/
    └── scenarios/                 # 8개 템플릿(§7)
```

admin-web에서 **그대로 재사용**: `FormBuilder`, `StatusBadge`, `data-store`, zod 검증 철학, design-tokens 구조, Playwright 구성.

admin-web에서 **대체**: AdminLayout → PublicLayout + MemberLayout, DataTable → CatalogGrid/Card, `(admin)` 단일 그룹 → `(public)` + `(member)` 2그룹, 보호 래핑 위치(전체 `(admin)` → `(member)`만).

## 4. Shell과 라우팅 규약

### 4.1 route groups
- `(public)`: 비로그인도 접근 가능. 헤더(로고·카탈로그·로그인·가입) + 푸터.
- `(member)`: 로그인 필수. 헤더(로고·예약·내 예약·로그아웃) + 푸터. 비로그인 시 `auth-gate`가 `/login?redirect={원래 URL}`로 리디렉션한다.

### 4.2 URL 규약
test-pack 템플릿과 evaluator가 이 규약에 의존하므로 **Builder가 임의로 바꾸지 못하도록** rules/CLAUDE.md에 명시한다.

| 역할 | URL |
|---|---|
| 랜딩 | `/` |
| 카탈로그 목록 | `/{entity-slug}` (예: `/rooms`) |
| 카탈로그 상세 | `/{entity-slug}/[id]` |
| 회원 가입 | `/signup` |
| 로그인 | `/login` |
| 예약 진행 | `/book/{item-id}` (item-id = 예약 대상 카탈로그 엔티티의 id) |
| 내 예약 | `/my/reservations` |
| API | `/api/auth/*`, `/api/{entity}`, `/api/reservations` |

### 4.3 로그인 후 redirect 정책
- `/login?redirect={원본 URL}`로 도착한 요청은 로그인 성공 후 `redirect` 파라미터의 URL로 이동한다.
- redirect 파라미터가 없으면 기본 `/my/reservations`으로 이동한다.
- 가입 성공 시에는 자동 로그인 처리 후 동일한 redirect 정책을 따른다.

## 5. 페이지 패턴

| 패턴 | 경로 | 구성 요소 | 비고 |
|---|---|---|---|
| Landing | `/` | Hero + 카탈로그 미리보기 + CTA | 공개 랜딩, SEO 태그 기본 |
| Catalog list | `/{slug}` | `CatalogGrid`(카드 그리드) + 검색/필터 | DataTable 대체 |
| Catalog detail | `/{slug}/[id]` | 이미지 블록 + 정보 섹션 + "예약하기" CTA(→ `/book/[id]`) | 회원유형별 가격/가용성 표시는 requirement가 지시할 때만 |
| Auth form(가입) | `/signup` | `FormBuilder` + zod 검증 | 가입 항목은 eval spec의 회원 엔티티 필드 기반 |
| Auth form(로그인) | `/login` | `FormBuilder` + 실패 메시지 | redirect 쿼리 처리 |
| Booking form | `/book/[itemId]` | 카탈로그 항목 요약 + 투숙자/예약 정보 폼 | 성공 시 `/my/reservations`로 이동 |
| Member list | `/my/reservations` | 본인 예약 카드/테이블 | 본인 것만 필터링 |

## 6. Data layer & Auth

- **데이터 저장소**: admin-web의 `src/lib/data-store.ts`를 그대로 사용한다. JSON 파일 기반 CRUD, zod 검증.
- **엔티티 CRUD API**: `/api/{entity}`, `/api/{entity}/[id]` — admin-web과 동일.
- **예약 트랜잭션 API**: `/api/reservations` POST는 (1) 세션 유효성, (2) 대상 카탈로그 항목 재고, (3) 회원유형 접근권 — 세 가지 검증을 거친 후 레코드 생성 + 재고 차감을 **단일 핸들러 내에서** 수행한다. mock이므로 동시성 제어는 비-목표.
- **인증**: 클라이언트 mock 세션. `AuthProvider`가 `localStorage`에 로그인 사용자 정보를 영속화하고 페이지 리로드 시 복원한다. 서버 API는 자격증명 검증만 담당한다: `/api/auth/signup`(멤버 레코드 생성+중복 아이디 체크), `/api/auth/login`(아이디/비밀번호 검증 후 사용자 반환). `auth-gate`는 `useAuth()`의 `isAuthenticated`를 보고 리디렉션한다. (admin-web의 `auth.tsx` 컨벤션을 계승하되 localStorage 영속화와 signup/멀티 유저 지원만 추가)
- **회원유형 표현**: preset은 "회원 엔티티에 임의 필드가 존재할 수 있다"는 구조만 보장한다. "분양회원번호 유무 → 회원유형 결정"과 같은 규칙은 eval spec의 requirement + acceptance_criteria로 부여한다(§10 예시 BR-001 참고).

## 7. Test-pack

8개 템플릿을 제공한다. 페이지 단위 6개 + 공통 체인 2개.

```
presets/booking-web/test-pack/scenarios/
  landing.template.ts
  catalog-list.template.ts
  catalog-detail.template.ts
  auth-form.template.ts
  booking-form.template.ts
  member-list.template.ts
  auth-gate.template.ts          # 보호 URL 직접 접근 → /login?redirect=... 확인
  signup-login-chain.template.ts # 가입 → 로그인 성공 체인
```

### 7.1 운용 규칙
- **공개 영역 템플릿**(`landing`, `catalog-list`, `catalog-detail`, `auth-form`)은 `beforeEach` 로그인 없이 시작한다.
- **보호 영역 템플릿**(`booking-form`, `member-list`)은 `beforeEach`에서 테스트용 계정으로 로그인한다(preset scaffold가 seed 계정 제공).
- **도메인 특정 체인**(예: "분양회원이 분양 전용 객실을 예약 성공", "재고 0일 때 예약 거부")은 **test-writer 에이전트가 `key_flows` + `acceptance_criteria`를 읽고 페이지 템플릿을 조합하여 생성**한다. test-pack에는 넣지 않는다. 이는 admin-web과 동일한 방식이다.
- 템플릿 변수 규약은 admin-web과 동일하게 `__VAR__` 플레이스홀더 치환이다.

### 7.2 공통 체인 템플릿 요지
- `auth-gate`: 세션 없이 `/book/...` 및 `/my/reservations`에 직접 접근 시 `/login?redirect=...`으로 이동하는지 확인.
- `signup-login-chain`: 가입 → 로그인 → 보호 영역 첫 페이지(기본 `/my/reservations`) 도달까지의 스모크 체인.

## 8. rules/CLAUDE.md 개요

admin-web의 rules를 기반으로 다음 항목만 교체·추가한다.

- **Layout 섹션 교체**: "AdminLayout 사용" 금지 → "`(public)`/`(member)` 두 route group 사용, `auth-gate`로 보호 래핑" 지시.
- **URL 규약 고정**(§4.2 표 그대로 삽입). 임의 변경 금지.
- **FormBuilder·data-store·StatusBadge 재사용** 지시. 동일 API.
- **Redirect 규칙**(§4.3) 명시.
- **회원/예약/카탈로그 API 계약**(§6) 명시.
- Korean UI, design-tokens 사용, 임의 색상 하드코딩 금지 — 기존 규칙 유지.

## 9. Orchestrator·에이전트 영향

실제 코드를 확인한 결과 **`provisioner.ts`에 admin-web 전용 가정이 하드코딩**되어 있어 최소한의 generalization이 필요하다. 그 외(에이전트, 루프, evaluator)는 변경 없음.

### 9.1 Provisioner 변경 (필수)

현재 `provisioner.ts`는 다음 두 단계에서 admin-web 전용 가정을 갖는다:
1. `generateEntitySkeletons()`가 `src/app/(admin)/{slug}/...` 경로에 list/detail/new/edit 4개 페이지를 자동 생성한다. booking-web의 라우팅 구조(`(public)` + `(member)`, catalog/booking/my-reservations)와 맞지 않는다.
2. `generateTemplateE2ETests()`가 admin-web 템플릿 파일명(`list-view`, `detail-view`, `form-submit`, `dashboard`)을 하드코딩해 읽는다. booking-web의 8종 템플릿은 무시된다.

**해결**: preset 디렉토리에 `core/preset.json` 메타파일을 추가하고 provisioner가 이를 읽어 분기하도록 한다.

```json
// presets/admin-web/core/preset.json
{
  "skeleton_generation": "admin-web"
}

// presets/booking-web/core/preset.json
{
  "skeleton_generation": "none"
}
```

- `skeleton_generation: "admin-web"` — 현재 동작 유지(하위 호환)
- `skeleton_generation: "none"` — 엔티티 스켈레톤 생성을 생략하고 Builder가 rules/CLAUDE.md에 따라 직접 페이지를 만든다

E2E 템플릿 복사는 **파일명 하드코딩 대신 디렉토리 스캔**으로 일반화한다:
- `*.template.ts` 파일을 순회
- 내용에 `__ENTITY_NAME__`/`__ENTITY_PATH__` 같은 entity 플레이스홀더가 있으면 entities마다 `{slug}-{template}.spec.ts`로 치환 복사(기존 동작)
- 플레이스홀더가 없으면 `{template}.spec.ts`로 1회 복사(기존 `dashboard.template.ts`와 동일한 처리)

이렇게 하면 admin-web/booking-web 모두 같은 로직으로 동작한다.

### 9.2 변경 없는 부분

- `agents/builder.md`, `agents/test-writer.md` 시스템 프롬프트 수정 없음 — 둘 다 preset의 `rules/CLAUDE.md`·`test-pack`을 참조하므로 preset을 바꾸는 것만으로 동작한다.
- `loop.ts`, `classifier.ts`, `reporter.ts`, `task-contract.ts`, `test-generation-stage.ts` 변경 없음.
- evaluator 5종(`build_check`, `unit_test`, `page_check`, `console_check`, `e2e`) 모두 그대로 재사용.

## 10. 리조트 예약 eval spec 초안 (팀원 비교용)

경로: `examples/resort-booking-spec.yaml`

```yaml
project: resort-booking-prototype
preset: booking-web
palette: warm-neutral

domain:
  entities:
    - name: 회원
      slug: members
      fields: [아이디, 비밀번호, 이름, 연락처, 이메일, 분양회원번호, 회원유형]
    - name: 객실
      slug: rooms
      fields: [객실코드, 객실명, 재고, 회원유형별금액, 예약가능회원유형]
    - name: 예약
      slug: reservations
      fields: [예약번호, 회원, 객실, 투숙자, 예약일자, 회원유형, 상태]

  key_flows:
    - 회원가입 (분양회원번호 유무로 자동 분류)
    - 로그인 / 로그아웃
    - 객실 목록 및 상세 조회 (비로그인 가능)
    - 예약 진행 (회원유형·재고 검증)
    - 내 예약 확인

requirements:
  - id: BR-001
    title: 분양회원번호 유무로 회원유형 자동 분류
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "분양회원번호를 입력하고 가입한 회원은 분양회원으로 분류된다"
      - "분양회원번호 없이 가입한 회원은 일반회원으로 분류된다"

  - id: BR-002
    title: 회원유형별 객실 예약 가능성 제어
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "객실의 예약가능회원유형에 포함되지 않는 회원은 예약 불가 처리된다"
      - "객실 상세에서 회원유형별 금액이 확인 가능하다"

  - id: BR-003
    title: 예약 성공 시 재고 1 차감, 재고 0이면 예약 거부
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "재고가 1 이상인 객실은 예약 성공 후 재고가 1 감소한다"
      - "재고가 0인 객실은 예약이 거부되고 안내 메시지가 표시된다"

  - id: BR-004
    title: 예약/내예약 페이지 접근은 로그인 필수
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "비로그인 상태로 /book/... 접근 시 /login?redirect=... 으로 이동한다"
      - "비로그인 상태로 /my/reservations 접근 시 /login 으로 이동한다"

  - id: BR-005
    title: 회원가입 폼 검증
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "비밀번호가 8자 미만이거나 영문+숫자 조합이 아니면 저장되지 않는다"
      - "필수 항목(아이디, 비밀번호, 이름, 연락처) 누락 시 저장되지 않는다"
      - "이메일 입력 시 이메일 형식이 검증된다"
      - "아이디 중복 시 저장이 거부되고 안내 메시지가 표시된다"

  - id: BR-006
    title: 예약 단위는 1박 1실
    severity: hard
    test_method: e2e
    acceptance_criteria:
      - "한 번의 예약은 하나의 객실, 1박으로만 가능하다"
      - "예약 폼에서 투숙자 정보를 입력할 수 있다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
  - 한국어 UI
```

## 11. 작업 스코프와 순서 (Phase 4 착수)

1. **Provisioner 일반화** — `core/preset.json` 지원 + E2E 템플릿 디렉토리 스캔 방식으로 변경(§9.1).
2. **scaffold 생성** — admin-web scaffold를 기준으로 fork 후 (public)/(member) 라우트·레이아웃·카탈로그 카드/그리드·auth-gate 구현. `npm run build` 통과.
3. **rules/CLAUDE.md + protected-files.json 작성** — §8 기준.
4. **test-pack 템플릿 8개 작성** — §7 기준. 각 템플릿은 admin-web 템플릿 스타일을 따른다(플레이스홀더 치환 변수, Playwright 패턴).
5. **examples/resort-booking-spec.yaml 확정본 작성** — §10 기준.
6. **스모크 실행** — `/fde-agent:run examples/resort-booking-spec.yaml`을 반복하며 evaluator 리포트가 pass에 도달할 때까지 preset scaffold/rules/test-pack을 조정.
7. **README 업데이트** — preset 표에 booking-web 추가, Phase 4 로드맵 상태 업데이트.

## 12. 비-목표 (YAGNI)

- 장바구니/결제 플로우 — 이후 `ecommerce-web`으로 분리.
- CMS/콘텐츠 허브/블로그 — 이후 `corporate-site`로 분리.
- 관리자 전용 화면 — admin-web을 사용.
- 실시간 재고 동시성 제어 — mock 환경에서는 의미 없음.
- 결제·배송·쿠폰·추천 — 범위 외.
- 이미지 업로드/멀티 이미지 — 플레이스홀더로 대체.

## 13. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| URL 규약(§4.2)을 Builder가 임의로 깨트림 | test-pack 전량 실패 | rules/CLAUDE.md의 고정 표 + protected-files로 route 경로 키 파일 보호, 초기 몇 회 스모크로 조기 검증 |
| 회원유형·재고 같은 복합 로직을 Builder가 매번 다르게 구현 | repair 반복 횟수 증가 | `acceptance_criteria`를 쪼개 test-writer가 세분화된 E2E를 만들도록 유도. 15회 한도는 설계 그대로 유지 |
| 공개/보호 분기 규칙을 Builder가 단일 레이아웃에 섞음 | auth-gate 템플릿 실패 | rules에 "(member) 아닌 영역에서는 auth-gate 사용 금지, (member)는 전부 auth-gate로 감쌀 것" 명시 |
| 카드형 목록 UI가 팔레트별로 과하게 달라짐 | 팀원 비교 공정성 저하 | design-tokens + shadcn/ui 컴포넌트로만 구성, 임의 색상/spacing 금지 규칙 유지 |

## 14. 성공 기준

- `examples/resort-booking-spec.yaml` 실행 시 evaluator 5종 모두 pass (NFR-001 외 BR-001~006 포함).
- 동일 spec을 팀원이 다른 하네스로 돌린 결과물과 비교 가능한 상태로 산출물이 생성된다.
- preset 추가로 orchestrator 코드·agent 정의·evaluator 어느 것도 수정되지 않는다.
