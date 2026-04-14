# Preset Quality Uniformity Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin-web 프리셋의 품질 균일성을 검증하기 위해 실제 비즈니스 수준의 복잡한 eval spec YAML 2개를 작성한다.

**Architecture:** 기존 `examples/resort-admin-spec.yaml`과 동일한 `EvalSpecSchema` 형식을 따른다. 상태 머신, 역할 체계, 전이 가드 등 스키마에 전용 필드가 없는 정보는 `key_flows`, `constraints`, `description`, `acceptance_criteria`에 자연어로 인코딩한다.

**Tech Stack:** YAML, Zod schema validation (`orchestrator/src/types.ts`)

**Spec:** `docs/superpowers/specs/2026-04-14-preset-quality-uniformity-test-design.md`

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Create | `examples/ecommerce-admin-spec.yaml` | E-commerce 주문/운영 관리 eval spec |
| Create | `examples/hr-admin-spec.yaml` | HR/인사 관리 eval spec |
| Read | `orchestrator/src/types.ts` | EvalSpecSchema — YAML 구조 검증 기준 |
| Read | `examples/resort-admin-spec.yaml` | 기존 예시 — 형식 참고 |

---

### Task 1: E-commerce Admin Eval Spec 작성

**Files:**
- Create: `examples/ecommerce-admin-spec.yaml`

- [ ] **Step 1: YAML 파일 작성**

```yaml
project: ecommerce-admin-prototype
preset: admin-web
palette: corporate-blue

domain:
  entities:
    - name: 상품
      slug: products
      fields: [상품코드, 상품명, 카테고리, 기본가격, 상태]
    - name: 상품옵션
      slug: product-options
      fields: [옵션명, 추가가격, 재고수량, SKU, 안전재고, 상품]
    - name: 고객
      slug: customers
      fields: [고객번호, 이름, 이메일, 연락처, 등급, 누적구매액]
    - name: 주문
      slug: orders
      fields: [주문번호, 고객, 주문일시, 총액, 할인액, 최종결제액, 상태]
    - name: 주문상세
      slug: order-items
      fields: [주문, 상품옵션, 수량, 단가, 소계]
    - name: 결제
      slug: payments
      fields: [결제번호, 주문, 결제수단, 금액, 상태, 결제일시]
    - name: 배송
      slug: shipments
      fields: [송장번호, 주문, 택배사, 상태, 발송일, 도착예정일]
    - name: 반품
      slug: returns
      fields: [반품번호, 주문, 사유, 상태, 환불액, 처리자]
    - name: 쿠폰
      slug: coupons
      fields: [쿠폰코드, 할인유형, 할인값, 최소주문액, 유효기간, 사용한도, 현재사용횟수]
    - name: 감사로그
      slug: audit-logs
      fields: [일시, 수행자, 대상엔티티, 대상ID, 액션, 변경전, 변경후]

  key_flows:
    - "상품 등록: 상품 기본정보 입력 → 옵션 N개 동적 추가(옵션명/추가가격/재고/SKU) → 저장"
    - "상품 목록 조회: 카테고리별·상태별 필터, 검색, 품절 상품 시각적 구분"
    - "재고 부족 경고: 안전재고 이하 옵션에 경고 배지 표시"
    - "주문 목록 조회: 상태별 탭 필터, 날짜 범위 필터, 고객명 검색"
    - "주문 상세 통합 뷰: 주문항목·결제·배송·반품 정보를 탭 또는 섹션으로 한 페이지에 통합"
    - "주문 상태 변경: 상태 머신(주문접수→결제완료→상품준비→배송중→배송완료→구매확정, 취소는 배송중 이전만). 가능한 전이만 버튼 표시, 전이 조건 미충족 시 사유 안내, 확인 다이얼로그"
    - "주문 상태 전이 가드: 주문접수→결제완료(결제 레코드 필수), 결제완료→상품준비(재고 확인 후 차감), 상품준비→배송중(송장번호 필수)"
    - "주문 취소 + 재고 복원: 취소 시 차감된 재고 자동 복원, 결제 상태→환불처리, 배송중 이후 취소 불가"
    - "주문 일괄 상태 변경: 체크박스 다중 선택 → 같은 현재 상태인 항목만 일괄 전이"
    - "반품 처리: 주문 상세에서 반품 요청(사유 드롭다운 선택) → 상태 머신(반품요청→수거중→수거완료→검수중→환불완료). 환불완료 시 환불액 입력 필수, 결제 환불 상태 연동"
    - "배송 관리: 상태 머신(준비중→집화→이동중→배달중→배달완료, 역방향 불가). 상태별·택배사별 필터"
    - "쿠폰 관리: 정액/정률 선택, 유효기간 캘린더, 최소주문액, 사용한도. 만료/소진 쿠폰 자동 비활성 표시"
    - "고객 목록: 등급별 필터, 누적구매액 정렬, 등급 배지 색상 구분"
    - "고객 상세: 고객 정보 + 해당 고객 주문 이력 테이블 + 누적 통계(주문건수/총구매액)"
    - "고객 삭제 방지: 주문 이력 있는 고객 삭제 시 에러 메시지, 삭제 차단"
    - "대시보드 — 매출 현황: 오늘/이번주/이번달 매출, 주문건수, 평균 주문액, 전기 대비 증감 표시"
    - "대시보드 — 상태 분포: 주문 상태별 건수 차트/카드, 클릭 시 해당 상태 목록으로 이동"
    - "대시보드 — 최근 주문 + 알림: 최근 10건 주문 요약, 반품 요청/재고 부족 알림 카드"
    - "역할 체계: admin(전체 접근), manager(주문/배송/반품 처리, 쿠폰 생성 불가, 고객 삭제 불가), viewer(조회만, 모든 CUD 버튼 미표시)"
    - "감사 로그: 모든 CUD 자동 기록(일시/수행자/대상/액션/변경전후), 읽기전용, 엔티티/액션별 필터, 변경 전후 diff 표시"
    - "CSV 내보내기: 주문·고객·상품 목록에서 현재 필터 기준 CSV 다운로드"

requirements:
  - id: FR-001
    title: 상품 등록 (옵션 포함)
    severity: hard
    test_method: e2e
    description: 상품 기본정보와 함께 옵션을 N개 동적으로 추가/삭제할 수 있다
    acceptance_criteria:
      - "상품 등록 폼에서 '옵션 추가' 버튼으로 옵션 행을 동적으로 추가할 수 있다"
      - "각 옵션 행에 옵션명, 추가가격, 재고수량, SKU를 입력할 수 있다"
      - "옵션 행을 삭제할 수 있다"
      - "저장 후 상품 상세에서 등록된 옵션을 확인할 수 있다"
      - "상품명, 카테고리, 기본가격은 필수 — 미입력 시 에러 메시지 표시"

  - id: FR-002
    title: 상품 목록 + 필터
    severity: hard
    test_method: e2e
    description: 상품 목록을 테이블로 조회하고 카테고리/상태별 필터와 검색이 가능하다
    acceptance_criteria:
      - "상품 목록 페이지에 테이블이 표시된다"
      - "카테고리 필터 드롭다운으로 필터링할 수 있다"
      - "상태(판매중/품절/단종) 필터가 동작한다"
      - "검색창에 상품명 입력 시 테이블이 필터링된다"
      - "품절 상품은 행에 시각적 구분(배경색 또는 배지)이 있다"

  - id: FR-003
    title: 재고 부족 경고
    severity: soft
    test_method: e2e
    description: 안전재고 이하인 상품옵션에 경고를 표시한다
    acceptance_criteria:
      - "상품 상세의 옵션 목록에서 재고수량 ≤ 안전재고인 옵션에 경고 배지가 표시된다"

  - id: FR-004
    title: 주문 목록 + 상태 필터
    severity: hard
    test_method: e2e
    description: 주문 목록을 상태별·날짜별로 필터링하고 검색할 수 있다
    acceptance_criteria:
      - "주문 목록 페이지에 테이블이 표시된다"
      - "상태별 탭 또는 필터로 주문을 필터링할 수 있다"
      - "날짜 범위 필터가 동작한다"
      - "고객명으로 검색할 수 있다"

  - id: FR-005
    title: 주문 상세 (통합 뷰)
    severity: hard
    test_method: e2e
    description: 주문 상세 페이지에서 주문항목, 결제, 배송, 반품 정보를 모두 확인할 수 있다
    acceptance_criteria:
      - "주문 상세 페이지에 주문 기본정보(주문번호, 고객, 일시, 금액)가 표시된다"
      - "주문항목 목록(상품옵션명, 수량, 단가, 소계)이 표시된다"
      - "결제 정보(결제수단, 금액, 상태)가 표시된다"
      - "배송 정보(송장번호, 택배사, 상태)가 표시된다"
      - "반품이 있는 경우 반품 정보(사유, 상태, 환불액)가 표시된다"

  - id: FR-006
    title: 주문 상태 변경 + 가드
    severity: hard
    test_method: e2e
    description: 주문 상태를 변경할 수 있으며, 현재 상태에서 가능한 전이만 표시되고 전이 조건을 검증한다
    acceptance_criteria:
      - "현재 상태에서 가능한 다음 상태 버튼만 표시된다"
      - "상태 변경 클릭 시 확인 다이얼로그가 표시된다"
      - "결제완료→상품준비 전이 시 재고가 차감된다"
      - "상품준비→배송중 전이 시 송장번호 입력이 필수이다"
      - "전이 조건 미충족 시 사유를 안내하는 메시지가 표시된다"

  - id: FR-007
    title: 주문 취소 + 재고 복원
    severity: hard
    test_method: e2e
    description: 주문을 취소하면 재고가 자동 복원되고, 배송중 이후에는 취소할 수 없다
    acceptance_criteria:
      - "주문접수/결제완료/상품준비 상태에서 취소 버튼이 표시된다"
      - "취소 시 차감된 재고가 자동으로 복원된다"
      - "배송중/배송완료/구매확정 상태에서는 취소 버튼이 표시되지 않는다"

  - id: FR-008
    title: 주문 일괄 상태 변경
    severity: soft
    test_method: e2e
    description: 주문 목록에서 체크박스로 여러 주문을 선택하여 일괄 상태 변경할 수 있다
    acceptance_criteria:
      - "주문 목록 테이블에 체크박스가 있다"
      - "여러 주문을 선택하면 일괄 상태 변경 버튼이 나타난다"
      - "같은 현재 상태인 주문만 일괄 변경된다"

  - id: FR-009
    title: 반품 요청 처리
    severity: hard
    test_method: e2e
    description: 주문 상세에서 반품을 요청하고 반품 상태를 추적할 수 있다
    acceptance_criteria:
      - "주문 상세 페이지에서 반품 요청 버튼을 클릭할 수 있다"
      - "반품 사유를 드롭다운에서 선택해야 한다"
      - "반품 요청 후 반품 상태(반품요청→수거중→수거완료→검수중→환불완료)를 추적할 수 있다"
      - "환불완료 전이 시 환불액 입력이 필수이다"

  - id: FR-010
    title: 쿠폰 관리
    severity: soft
    test_method: e2e
    description: 쿠폰을 생성/조회/수정/삭제할 수 있으며 유효성 규칙이 적용된다
    acceptance_criteria:
      - "쿠폰 등록 폼에서 할인유형(정액/정률)을 선택할 수 있다"
      - "유효기간을 캘린더로 설정할 수 있다"
      - "최소주문액 조건을 설정할 수 있다"
      - "만료되거나 사용한도 소진된 쿠폰은 목록에서 비활성으로 표시된다"

  - id: FR-011
    title: 고객 목록 + 등급 필터
    severity: hard
    test_method: e2e
    description: 고객 목록을 등급별로 필터링하고 누적구매액으로 정렬할 수 있다
    acceptance_criteria:
      - "고객 목록 페이지에 테이블이 표시된다"
      - "등급(VIP/일반/신규) 필터가 동작한다"
      - "누적구매액 기준 정렬이 가능하다"
      - "등급별 배지가 색상으로 구분된다"

  - id: FR-012
    title: 고객 상세 (주문 이력)
    severity: hard
    test_method: e2e
    description: 고객 상세 페이지에서 해당 고객의 주문 이력과 누적 통계를 확인할 수 있다
    acceptance_criteria:
      - "고객 상세 페이지에 고객 기본정보가 표시된다"
      - "해당 고객의 주문 이력 테이블이 표시된다"
      - "누적 통계(주문건수, 총구매액)가 표시된다"

  - id: FR-013
    title: 고객 삭제 방지
    severity: hard
    test_method: e2e
    description: 주문 이력이 있는 고객은 삭제할 수 없다
    acceptance_criteria:
      - "주문 이력이 있는 고객의 삭제 버튼 클릭 시 에러 메시지가 표시된다"
      - "삭제가 실제로 차단된다 (목록에 여전히 남아있다)"

  - id: FR-014
    title: 대시보드 — 매출 현황
    severity: hard
    test_method: e2e
    description: 대시보드에 매출 관련 핵심 지표가 표시된다
    acceptance_criteria:
      - "오늘/이번주/이번달 매출 금액이 표시된다"
      - "주문 건수가 표시된다"
      - "평균 주문액이 표시된다"
      - "전기 대비 증감이 표시된다 (화살표 또는 퍼센트)"

  - id: FR-015
    title: 대시보드 — 상태 분포
    severity: hard
    test_method: e2e
    description: 대시보드에 주문 상태별 분포가 표시되고 클릭으로 이동 가능하다
    acceptance_criteria:
      - "주문 상태별 건수가 차트 또는 카드로 표시된다"
      - "각 상태 항목 클릭 시 해당 상태로 필터된 주문 목록으로 이동한다"

  - id: FR-016
    title: 대시보드 — 최근 주문 + 알림
    severity: soft
    test_method: e2e
    description: 대시보드에 최근 주문과 알림(반품 요청, 재고 부족)이 표시된다
    acceptance_criteria:
      - "최근 10건 주문이 요약 테이블로 표시된다"
      - "반품 요청이 있으면 알림 카드가 표시된다"
      - "재고 부족 옵션이 있으면 알림 카드가 표시된다"

  - id: FR-017
    title: 역할별 UI 제어
    severity: hard
    test_method: e2e
    description: 역할(admin/manager/viewer)에 따라 UI 요소가 제어된다
    acceptance_criteria:
      - "viewer 역할은 모든 생성/수정/삭제 버튼이 표시되지 않는다"
      - "manager 역할은 쿠폰 생성 버튼이 표시되지 않는다"
      - "manager 역할은 고객 삭제 버튼이 표시되지 않는다"
      - "admin 역할은 모든 기능에 접근 가능하다"

  - id: FR-018
    title: 감사 로그 조회
    severity: soft
    test_method: e2e
    description: 모든 데이터 변경 이력을 조회할 수 있다
    acceptance_criteria:
      - "감사 로그 목록 페이지에 테이블이 표시된다"
      - "엔티티별, 액션별 필터가 동작한다"
      - "각 로그 항목에서 변경 전후 diff를 확인할 수 있다"

  - id: FR-019
    title: CSV 내보내기
    severity: soft
    test_method: e2e
    description: 주요 목록 페이지에서 현재 필터 기준으로 CSV를 다운로드할 수 있다
    acceptance_criteria:
      - "주문 목록에 CSV 내보내기 버튼이 있다"
      - "고객 목록에 CSV 내보내기 버튼이 있다"
      - "상품 목록에 CSV 내보내기 버튼이 있다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check
    description: npm run build가 성공해야 한다

  - id: NFR-002
    title: 콘솔 에러 없음
    severity: hard
    test_method: console_check
    description: 치명적 콘솔 에러가 없어야 한다

  - id: NFR-003
    title: 모든 페이지 접근 가능
    severity: hard
    test_method: page_check
    description: 모든 엔티티의 목록/상세/폼 페이지가 200 응답을 반환해야 한다

  - id: NFR-004
    title: 유닛 테스트 통과
    severity: hard
    test_method: unit_test
    description: npm run test가 성공해야 한다

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
  - 한국어 UI
  - "역할 체계: admin(전체 접근), manager(주문/배송/반품 처리 가능, 쿠폰 생성 불가, 고객 삭제 불가), viewer(조회만, 모든 CUD 버튼 미표시)"
  - "테스트 계정: admin@example.com/password (admin), manager@example.com/password (manager), viewer@example.com/password (viewer)"
  - "주문 상태 머신: 주문접수→결제완료→상품준비→배송중→배송완료→구매확정. 취소는 배송중 이전에만 가능"
  - "배송 상태 머신: 준비중→집화→이동중→배달중→배달완료. 역방향 전이 불가"
  - "반품 상태 머신: 반품요청→수거중→수거완료→검수중→환불완료"
  - "감사 로그: 모든 CUD 작업 시 자동 기록, 읽기전용"
  - "관계 무결성: 주문 이력이 있는 고객 삭제 불가, 재고 0인 옵션 주문 불가"
  - "고객 등급: VIP(누적 100만 이상), 일반(누적 10만 이상), 신규(10만 미만)"
```

- [ ] **Step 2: eval-spec-parser로 YAML 유효성 검증**

Run: `cd orchestrator && npx tsx -e "import { parseEvalSpec } from './src/eval-spec-parser.js'; parseEvalSpec('../examples/ecommerce-admin-spec.yaml').then(s => console.log('OK: ' + s.project + ', entities=' + s.domain.entities.length + ', requirements=' + s.requirements.length)).catch(e => { console.error(e.message); process.exit(1); })"`

Expected: `OK: ecommerce-admin-prototype, entities=10, requirements=22`

- [ ] **Step 3: Commit**

```bash
git add examples/ecommerce-admin-spec.yaml
git commit -m "feat: add E-commerce admin eval spec for quality uniformity test"
```

---

### Task 2: HR Admin Eval Spec 작성

**Files:**
- Create: `examples/hr-admin-spec.yaml`

- [ ] **Step 1: YAML 파일 작성**

```yaml
project: hr-admin-prototype
preset: admin-web
palette: dark-modern

domain:
  entities:
    - name: 부서
      slug: departments
      fields: [부서코드, 부서명, 상위부서, 부서장, 위치]
    - name: 직급
      slug: positions
      fields: [직급코드, 직급명, 등급, 기본급최소, 기본급최대]
    - name: 직원
      slug: employees
      fields: [사번, 이름, 이메일, 연락처, 부서, 직급, 입사일, 상태]
    - name: 근태
      slug: attendances
      fields: [직원, 날짜, 출근시각, 퇴근시각, 근무시간, 상태]
    - name: 연차
      slug: leaves
      fields: [직원, 유형, 시작일, 종료일, 사용일수, 사유, 상태, 승인자]
    - name: 초과근무
      slug: overtimes
      fields: [직원, 날짜, 시작시각, 종료시각, 시간, 사유, 상태, 승인자]
    - name: 급여
      slug: payrolls
      fields: [직원, 연월, 기본급, 초과근무수당, 공제액, 실지급액, 상태]
    - name: 평가
      slug: evaluations
      fields: [직원, 평가기간, 자기평가점수, 상사평가점수, 최종등급, 상태]
    - name: 공지사항
      slug: notices
      fields: [제목, 내용, 작성자, 대상부서, 게시일, 만료일, 고정여부]
    - name: 감사로그
      slug: audit-logs
      fields: [일시, 수행자, 대상엔티티, 대상ID, 액션, 변경전, 변경후]

  key_flows:
    - "부서 관리: 부서 CRUD, 상위부서 선택(드롭다운), 조직도 트리 뷰 표시. 자기참조 트리 구조"
    - "직원 등록: 부서·직급 드롭다운 선택, 이메일 중복 검사, 입사일 필수"
    - "직원 목록 조회: 부서별·직급별·상태별 필터, 이름 검색, 상태(재직/휴직/퇴직) 배지 색상 구분"
    - "직원 상세 통합 프로필: 기본정보·근태 요약·연차 잔여·최근 평가 등급을 탭/섹션으로 통합"
    - "직원 상태 변경: 상태 머신(재직↔휴직, 재직→퇴직, 휴직→퇴직). 퇴직은 역전이 불가. 퇴직 처리 시 미처리 연차/초과근무 신청 있으면 경고"
    - "출퇴근 기록: 출근/퇴근 버튼, 09:00 이후 출근 시 자동 지각 처리, 퇴근-출근 근무시간 자동 계산"
    - "근태 월별 조회: 캘린더 또는 테이블 뷰, 월 선택, 정상/지각/조퇴/결근 색상 구분"
    - "연차 신청: 유형(연차/반차/병가/경조사) 선택, 날짜 범위 선택, 잔여일수 표시, 잔여일수 초과 시 신청 불가"
    - "연차 승인: 상태 머신(신청→승인대기→승인→사용완료, 반려). 승인자는 신청자의 부서장. 반려 시 사유 입력 필수"
    - "초과근무 신청: 시간 입력, 월 누적시간 표시, 월 40시간 초과 시 경고 + 신청 불가"
    - "초과근무 승인: 상태 머신(신청→승인대기→승인→정산완료, 반려)"
    - "급여 자동 산출: 연월 선택 → 전 직원 급여 일괄 산출(기본급 + 승인된 초과근무수당 - 공제액)"
    - "급여 명세 조회 + 확정: 직원별 명세 상세, admin만 확정 가능, 상태 머신(산출→검토중→확정→지급완료). 확정 후 수정 불가"
    - "평가 작성: 자기평가 점수 입력 → 저장 → 상사평가 점수 입력. 순서 강제(자기평가 미완료 시 상사평가 불가). 상태 머신(미작성→자기평가완료→상사평가완료→조정중→확정). 확정 후 수정 불가"
    - "평가 최종 등급: S/A/B/C/D 등급 부여"
    - "대시보드 — 인원 현황: 재직/휴직/퇴직 인원수, 부서별 인원 분포"
    - "대시보드 — 금일 근태: 오늘 출근율, 지각/결근 인원, 미출근 직원 목록"
    - "대시보드 — 연차/승인 대기: 연차 소진율, 승인 대기 건수, 클릭 시 해당 목록으로 이동"
    - "역할 체계: admin(전체 접근, 급여 확정), manager(소속부서 직원 관리, 연차/초과근무 승인, 평가 작성, 급여 확정 불가, 타 부서 직원 수정 불가), employee(본인 정보 조회, 연차/초과근무 신청, 자기평가 작성, 타인 정보 조회 불가)"
    - "감사 로그: 모든 CUD 자동 기록, 읽기전용, 엔티티/액션별 필터, 변경 전후 diff 표시"
    - "CSV 내보내기: 직원·근태·급여 목록 CSV 다운로드"
    - "공지사항: CRUD, 대상부서 선택(전체/특정), 만료일 이후 자동 비활성, 고정 공지 상단 표시"

requirements:
  - id: FR-001
    title: 부서 관리 (트리 구조)
    severity: hard
    test_method: e2e
    description: 부서를 CRUD하고 조직도를 트리 뷰로 확인할 수 있다
    acceptance_criteria:
      - "부서 등록 폼에서 부서코드, 부서명, 상위부서(드롭다운), 부서장(직원 드롭다운), 위치를 입력할 수 있다"
      - "상위부서 선택으로 계층 구조를 만들 수 있다"
      - "조직도가 트리 뷰로 표시된다"
      - "부서 수정/삭제가 가능하다"

  - id: FR-002
    title: 직원 등록 + 부서/직급 배정
    severity: hard
    test_method: e2e
    description: 직원을 등록하고 부서와 직급을 배정할 수 있다
    acceptance_criteria:
      - "직원 등록 폼에서 부서를 드롭다운으로 선택할 수 있다"
      - "직급을 드롭다운으로 선택할 수 있다"
      - "이메일 중복 시 에러 메시지가 표시된다"
      - "입사일은 필수 — 미입력 시 에러 메시지 표시"
      - "저장 후 직원 상세에서 배정된 부서/직급을 확인할 수 있다"

  - id: FR-003
    title: 직원 목록 + 필터
    severity: hard
    test_method: e2e
    description: 직원 목록을 부서별/직급별/상태별로 필터링하고 검색할 수 있다
    acceptance_criteria:
      - "직원 목록 페이지에 테이블이 표시된다"
      - "부서별 필터 드롭다운이 동작한다"
      - "직급별 필터가 동작한다"
      - "상태(재직/휴직/퇴직) 필터가 동작한다"
      - "이름 검색이 동작한다"
      - "상태별 배지가 색상으로 구분된다 (예: 재직=초록, 휴직=노랑, 퇴직=회색)"

  - id: FR-004
    title: 직원 상세 (통합 프로필)
    severity: hard
    test_method: e2e
    description: 직원 상세 페이지에서 기본정보, 근태 요약, 연차 잔여, 최근 평가를 확인할 수 있다
    acceptance_criteria:
      - "직원 기본정보(사번, 이름, 부서, 직급, 입사일, 상태)가 표시된다"
      - "근태 요약(이번 달 출근일수, 지각 횟수)이 표시된다"
      - "연차 잔여일수가 표시된다"
      - "최근 평가 등급이 표시된다"
      - "정보가 탭 또는 섹션으로 구분되어 있다"

  - id: FR-005
    title: 직원 상태 변경 + 가드
    severity: hard
    test_method: e2e
    description: 직원 상태를 변경할 수 있으며, 전이 규칙과 경고가 적용된다
    acceptance_criteria:
      - "재직 상태에서 휴직/퇴직 버튼이 표시된다"
      - "휴직 상태에서 재직/퇴직 버튼이 표시된다"
      - "퇴직 상태에서는 상태 변경 버튼이 없다"
      - "퇴직 처리 시 미처리 연차/초과근무 신청이 있으면 경고 메시지가 표시된다"
      - "상태 변경 시 확인 다이얼로그가 표시된다"

  - id: FR-006
    title: 출퇴근 기록 + 자동 판정
    severity: hard
    test_method: e2e
    description: 출근/퇴근을 기록하고 지각 여부가 자동 판정된다
    acceptance_criteria:
      - "출근 버튼을 클릭하면 현재 시각으로 출근이 기록된다"
      - "퇴근 버튼을 클릭하면 현재 시각으로 퇴근이 기록된다"
      - "09:00 이후 출근 시 자동으로 지각 상태가 된다"
      - "근무시간이 퇴근시각-출근시각으로 자동 계산된다"

  - id: FR-007
    title: 근태 월별 조회
    severity: hard
    test_method: e2e
    description: 근태를 월별로 조회하고 상태별 색상으로 구분할 수 있다
    acceptance_criteria:
      - "월 선택 드롭다운 또는 캘린더가 있다"
      - "해당 월의 근태가 테이블 또는 캘린더 뷰로 표시된다"
      - "정상/지각/조퇴/결근이 색상으로 구분된다"

  - id: FR-008
    title: 연차 신청 + 잔여 확인
    severity: hard
    test_method: e2e
    description: 연차를 신청할 수 있고, 잔여일수를 초과하면 신청이 불가하다
    acceptance_criteria:
      - "유형(연차/반차/병가/경조사)을 선택할 수 있다"
      - "시작일/종료일을 선택할 수 있다"
      - "현재 잔여일수가 표시된다"
      - "사용일수가 잔여일수를 초과하면 에러 메시지가 표시되고 신청이 불가하다"
      - "사유를 입력할 수 있다"

  - id: FR-009
    title: 연차 승인/반려
    severity: hard
    test_method: e2e
    description: 승인 대기 중인 연차를 승인하거나 반려할 수 있다
    acceptance_criteria:
      - "승인 대기 연차 목록이 표시된다"
      - "승인 버튼을 클릭하면 상태가 승인으로 변경된다"
      - "반려 버튼을 클릭하면 사유 입력 모달이 표시된다"
      - "반려 사유를 입력해야 반려가 완료된다"

  - id: FR-010
    title: 초과근무 신청 + 월 한도
    severity: hard
    test_method: e2e
    description: 초과근무를 신청할 수 있고, 월 40시간 한도를 초과하면 경고가 표시된다
    acceptance_criteria:
      - "날짜, 시작시각, 종료시각을 입력할 수 있다"
      - "시간이 자동 계산된다"
      - "이번 달 누적 초과근무 시간이 표시된다"
      - "40시간 초과 시 경고 메시지가 표시되고 신청이 불가하다"

  - id: FR-011
    title: 초과근무 승인/반려
    severity: soft
    test_method: e2e
    description: 승인 대기 중인 초과근무를 승인하거나 반려할 수 있다
    acceptance_criteria:
      - "승인 대기 초과근무 목록이 표시된다"
      - "승인/반려 처리가 가능하다"

  - id: FR-012
    title: 급여 자동 산출
    severity: hard
    test_method: e2e
    description: 연월을 선택하면 전 직원의 급여가 일괄 산출된다
    acceptance_criteria:
      - "연월 선택 UI가 있다"
      - "산출 버튼 클릭 시 전 직원의 급여가 생성된다"
      - "기본급 + 승인된 초과근무수당 - 공제액 = 실지급액이 자동 계산된다"

  - id: FR-013
    title: 급여 명세 조회 + 확정
    severity: hard
    test_method: e2e
    description: 직원별 급여 명세를 조회하고 admin이 확정할 수 있다
    acceptance_criteria:
      - "급여 목록에서 직원별 명세를 확인할 수 있다"
      - "명세 상세에 기본급, 초과근무수당, 공제액, 실지급액이 표시된다"
      - "admin 역할만 확정 버튼이 표시된다"
      - "확정 후에는 수정이 불가하다"

  - id: FR-014
    title: 평가 작성 (자기→상사)
    severity: hard
    test_method: e2e
    description: 평가를 자기평가 → 상사평가 순서로 작성할 수 있다
    acceptance_criteria:
      - "자기평가 점수를 입력하고 저장할 수 있다"
      - "자기평가 완료 후 상사평가 점수를 입력할 수 있다"
      - "자기평가가 미완료이면 상사평가를 입력할 수 없다"
      - "평가 상태가 순서대로 진행된다 (미작성→자기평가완료→상사평가완료→조정중→확정)"

  - id: FR-015
    title: 평가 최종 등급 확정
    severity: soft
    test_method: e2e
    description: 최종 등급을 부여하고 확정하면 수정이 불가하다
    acceptance_criteria:
      - "S/A/B/C/D 등급을 선택할 수 있다"
      - "확정 후에는 등급과 점수를 수정할 수 없다"

  - id: FR-016
    title: 대시보드 — 인원 현황
    severity: hard
    test_method: e2e
    description: 대시보드에 인원 관련 현황이 표시된다
    acceptance_criteria:
      - "재직/휴직/퇴직 인원수가 표시된다"
      - "부서별 인원 분포가 차트 또는 카드로 표시된다"

  - id: FR-017
    title: 대시보드 — 금일 근태
    severity: hard
    test_method: e2e
    description: 대시보드에 오늘의 근태 현황이 표시된다
    acceptance_criteria:
      - "오늘 출근율이 표시된다"
      - "지각/결근 인원수가 표시된다"
      - "미출근 직원 목록이 표시된다"

  - id: FR-018
    title: 대시보드 — 연차/승인 대기
    severity: soft
    test_method: e2e
    description: 대시보드에 연차 소진율과 승인 대기 현황이 표시된다
    acceptance_criteria:
      - "전체 연차 소진율이 표시된다"
      - "승인 대기 건수가 표시된다"
      - "클릭 시 해당 목록으로 이동한다"

  - id: FR-019
    title: 역할별 UI 제어
    severity: hard
    test_method: e2e
    description: 역할(admin/manager/employee)에 따라 UI 요소가 제어된다
    acceptance_criteria:
      - "employee 역할은 본인 정보와 신청 기능만 접근 가능하다"
      - "manager 역할은 소속 부서 직원만 관리할 수 있다"
      - "manager 역할은 급여 확정 버튼이 표시되지 않는다"
      - "admin 역할은 모든 기능에 접근 가능하다"

  - id: FR-020
    title: 감사 로그 조회
    severity: soft
    test_method: e2e
    description: 모든 데이터 변경 이력을 조회할 수 있다
    acceptance_criteria:
      - "감사 로그 목록 페이지에 테이블이 표시된다"
      - "엔티티별, 액션별 필터가 동작한다"
      - "각 로그 항목에서 변경 전후 diff를 확인할 수 있다"

  - id: FR-021
    title: CSV 내보내기
    severity: soft
    test_method: e2e
    description: 주요 목록 페이지에서 CSV를 다운로드할 수 있다
    acceptance_criteria:
      - "직원 목록에 CSV 내보내기 버튼이 있다"
      - "근태 목록에 CSV 내보내기 버튼이 있다"
      - "급여 목록에 CSV 내보내기 버튼이 있다"

  - id: NFR-001
    title: 빌드 성공
    severity: hard
    test_method: build_check
    description: npm run build가 성공해야 한다

  - id: NFR-002
    title: 콘솔 에러 없음
    severity: hard
    test_method: console_check
    description: 치명적 콘솔 에러가 없어야 한다

  - id: NFR-003
    title: 모든 페이지 접근 가능
    severity: hard
    test_method: page_check
    description: 모든 엔티티의 목록/상세/폼 페이지가 200 응답을 반환해야 한다

  - id: NFR-004
    title: 유닛 테스트 통과
    severity: hard
    test_method: unit_test
    description: npm run test가 성공해야 한다

data_source:
  type: mock

constraints:
  - React + TypeScript + Next.js
  - shadcn/ui 컴포넌트 사용
  - 한국어 UI
  - "역할 체계: admin(전체 접근, 급여 확정), manager(소속부서 직원 관리, 연차/초과근무 승인, 평가 작성, 급여 확정 불가, 타 부서 직원 수정 불가), employee(본인 정보 조회, 연차/초과근무 신청, 자기평가 작성, 타인 정보 조회 불가)"
  - "테스트 계정: admin@example.com/password (admin), manager@example.com/password (manager), employee@example.com/password (employee)"
  - "직원 상태 머신: 재직↔휴직, 재직→퇴직, 휴직→퇴직. 퇴직은 역전이 불가"
  - "연차 상태 머신: 신청→승인대기→승인→사용완료. 반려 가능. 승인자는 부서장"
  - "초과근무 상태 머신: 신청→승인대기→승인→정산완료. 반려 가능. 월 40시간 한도"
  - "평가 상태 머신: 미작성→자기평가완료→상사평가완료→조정중→확정. 순서 강제, 확정 후 수정 불가"
  - "급여 상태 머신: 산출→검토중→확정→지급완료. 확정은 admin만 가능"
  - "감사 로그: 모든 CUD 작업 시 자동 기록, 읽기전용"
  - "근태 자동 판정: 09:00 이후 출근은 지각, 근무시간은 퇴근-출근 자동 계산"
  - "부서 구조: 자기참조 트리 (상위부서 → 하위부서)"
  - "연차 일수: 연간 15일 기본 부여, 잔여일수 초과 신청 불가"
```

- [ ] **Step 2: eval-spec-parser로 YAML 유효성 검증**

Run: `cd orchestrator && npx tsx -e "import { parseEvalSpec } from './src/eval-spec-parser.js'; parseEvalSpec('../examples/hr-admin-spec.yaml').then(s => console.log('OK: ' + s.project + ', entities=' + s.domain.entities.length + ', requirements=' + s.requirements.length)).catch(e => { console.error(e.message); process.exit(1); })"`

Expected: `OK: hr-admin-prototype, entities=10, requirements=25`

- [ ] **Step 3: Commit**

```bash
git add examples/hr-admin-spec.yaml
git commit -m "feat: add HR admin eval spec for quality uniformity test"
```

---

### Task 3: 두 스펙 동시 검증 (스모크 테스트)

**Files:**
- Read: `examples/ecommerce-admin-spec.yaml`
- Read: `examples/hr-admin-spec.yaml`

- [ ] **Step 1: 두 스펙 모두 파서 통과 확인**

Run: `cd orchestrator && npx tsx -e "
import { parseEvalSpec } from './src/eval-spec-parser.js';
async function main() {
  const e = await parseEvalSpec('../examples/ecommerce-admin-spec.yaml');
  const h = await parseEvalSpec('../examples/hr-admin-spec.yaml');
  console.log('E-commerce: entities=' + e.domain.entities.length + ' reqs=' + e.requirements.length + ' flows=' + e.domain.key_flows.length);
  console.log('HR: entities=' + h.domain.entities.length + ' reqs=' + h.requirements.length + ' flows=' + h.domain.key_flows.length);
  console.log('Both specs valid.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
"`

Expected:
```
E-commerce: entities=10 reqs=22 flows=21
HR: entities=10 reqs=25 flows=22
Both specs valid.
```

- [ ] **Step 2: 기존 orchestrator 테스트가 깨지지 않았는지 확인**

Run: `cd orchestrator && npm run build && npm run test`

Expected: All tests pass, build succeeds.
