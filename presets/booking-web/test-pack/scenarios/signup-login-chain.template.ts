/**
 * Signup → Login Chain E2E Test Template
 * 가입 → 로그인 성공 → 보호 영역 접근까지의 스모크 체인.
 * 플레이스홀더 없음.
 */
import { test, expect } from "@playwright/test";

test.describe("가입 후 로그인 체인", () => {
  test("신규 가입 후 로그인하면 내 예약 페이지로 이동", async ({ page }) => {
    const unique = Date.now().toString();
    const username = `user${unique}`;
    const password = `pw${unique}`;

    await page.goto("/signup");
    await page.getByLabel(/아이디/).fill(username);
    await page.getByLabel(/비밀번호/).fill(password);
    await page.getByLabel(/이름/).fill("홍길동");
    await page.getByLabel(/연락처/).fill("010-1234-5678");
    await page.getByRole("button", { name: /회원가입/ }).click();

    // 가입 성공 시 자동 로그인되어 /my/reservations로 이동
    await page.waitForURL(/\/my\/reservations/);
    await expect(page.locator("h2")).toBeVisible();
  });
});
