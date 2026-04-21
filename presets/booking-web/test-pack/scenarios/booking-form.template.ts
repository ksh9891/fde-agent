/**
 * Booking Form E2E Test Template
 * 로그인 후 예약 폼 접근 가능성·투숙자 필드 존재·빈 폼 제출 거부.
 * 플레이스홀더 없음 — 로그인 계정은 Test Writer가 key_flows를 보고 signup chain으로 생성하거나 seed 계정을 사용한다.
 */
import { test, expect } from "@playwright/test";

const TEST_USERNAME = "bookuser";
const TEST_PASSWORD = "bookpass1";

async function ensureLogin(page: import("@playwright/test").Page) {
  // 가입 시도 — 이미 존재하면 로그인으로 폴백
  await page.goto("/signup");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByLabel(/이름/).fill("테스트");
  await page.getByLabel(/연락처/).fill("010-0000-0000");
  await page.getByRole("button", { name: /회원가입/ }).click();
  // 성공이든 실패든 로그인으로 이동해 세션 확보
  await page.goto("/login");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /로그인/ }).click();
  await page.waitForURL(/\/(my\/reservations|.*)/);
}

test.describe("예약 폼", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLogin(page);
  });

  test("예약 폼 페이지에 투숙자 입력이 있다", async ({ page }) => {
    // 주의: 테스트용 itemId=1 가정. seed 데이터가 1번 id를 보장해야 한다.
    await page.goto("/book/1");
    await expect(page.getByLabel(/투숙자/)).toBeVisible();
    await expect(page.getByRole("button", { name: /예약하기/ })).toBeVisible();
  });

  test("빈 폼 제출 시 페이지 유지", async ({ page }) => {
    await page.goto("/book/1");
    await page.getByRole("button", { name: /예약하기/ }).click();
    await expect(page).toHaveURL(/\/book\/1/);
  });
});
