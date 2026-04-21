/**
 * Member List E2E Test Template — /my/reservations
 * 로그인 후 본인 예약 목록 페이지 접근 가능 확인.
 */
import { test, expect } from "@playwright/test";

const TEST_USERNAME = "listuser";
const TEST_PASSWORD = "listpass1";

async function ensureLogin(page: import("@playwright/test").Page) {
  await page.goto("/signup");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByLabel(/이름/).fill("테스트");
  await page.getByLabel(/연락처/).fill("010-0000-0000");
  await page.getByRole("button", { name: /회원가입/ }).click();
  await page.goto("/login");
  await page.getByLabel(/아이디/).fill(TEST_USERNAME);
  await page.getByLabel(/비밀번호/).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /로그인/ }).click();
  await page.waitForURL(/.*/);
}

test.describe("내 예약 목록", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLogin(page);
  });

  test("내 예약 페이지 접근 가능", async ({ page }) => {
    await page.goto("/my/reservations");
    await expect(page).toHaveURL(/\/my\/reservations/);
    await expect(page.locator("h2")).toBeVisible();
  });
});
