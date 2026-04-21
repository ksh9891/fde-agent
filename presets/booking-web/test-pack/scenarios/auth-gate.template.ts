/**
 * Auth Gate E2E Test Template
 * 비로그인 상태로 보호 URL 접근 시 /login?redirect=... 으로 이동하는지 확인.
 * 플레이스홀더 없음 — 모든 booking-web 프로토타입이 공통으로 갖는 규칙.
 */
import { test, expect } from "@playwright/test";

test.describe("인증 게이트", () => {
  test.beforeEach(async ({ context }) => {
    // localStorage 비우기
    await context.clearCookies();
  });

  test("비로그인 상태로 /book/1 접근 시 로그인으로 이동", async ({ page }) => {
    await page.goto("/book/1");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test("비로그인 상태로 /my/reservations 접근 시 로그인으로 이동", async ({ page }) => {
    await page.goto("/my/reservations");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});
