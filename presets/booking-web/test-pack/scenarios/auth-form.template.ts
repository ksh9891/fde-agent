/**
 * Auth Form E2E Test Template
 * 로그인·회원가입 폼 접근성과 필수 필드 확인.
 */
import { test, expect } from "@playwright/test";

test.describe("로그인 폼", () => {
  test("로그인 페이지 접근 가능", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/아이디/)).toBeVisible();
    await expect(page.getByLabel(/비밀번호/)).toBeVisible();
  });

  test("빈 폼 제출 시 페이지 유지", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /로그인/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("회원가입 폼", () => {
  test("회원가입 페이지 접근 가능", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByLabel(/아이디/)).toBeVisible();
    await expect(page.getByLabel(/비밀번호/)).toBeVisible();
    await expect(page.getByLabel(/이름/)).toBeVisible();
    await expect(page.getByLabel(/연락처/)).toBeVisible();
  });

  test("필수 항목 누락 시 저장 불가", async ({ page }) => {
    await page.goto("/signup");
    // Scope to <main> because PublicLayout header also has a "회원가입" nav button.
    await page.getByRole("main").getByRole("button", { name: /회원가입/ }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
