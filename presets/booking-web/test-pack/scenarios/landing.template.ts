/**
 * Landing E2E Test Template
 * 랜딩 페이지 접근성 + 메인 CTA 존재 확인.
 * 체인이 아닌 단일 페이지 템플릿이므로 플레이스홀더 없음.
 */
import { test, expect } from "@playwright/test";

test.describe("랜딩 페이지", () => {
  test("랜딩 페이지 접근 가능", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("회원가입·로그인 CTA 노출", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /회원가입/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /로그인/ })).toBeVisible();
  });
});
