/**
 * List View E2E Test Template
 *
 * Test Writer: Replace ENTITY_NAME, ENTITY_PATH, SEARCH_FIELD with actual values.
 * Example: ENTITY_NAME="예약", ENTITY_PATH="/reservations", SEARCH_FIELD="예약번호"
 */
import { test, expect } from '@playwright/test';

// Template variables — Test Writer replaces these
const ENTITY_NAME = '__ENTITY_NAME__';
const ENTITY_PATH = '__ENTITY_PATH__';
const SEARCH_FIELD = '__SEARCH_FIELD__';

test.describe(`${ENTITY_NAME} 목록 조회`, () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('목록 페이지 접근 가능', async ({ page }) => {
    await page.goto(ENTITY_PATH);
    await expect(page).toHaveURL(ENTITY_PATH);
    // Table should be visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('검색 기능 동작', async ({ page }) => {
    await page.goto(ENTITY_PATH);
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('test');
    // Table should update (at minimum, not crash)
    await expect(page.locator('table')).toBeVisible();
  });

  test('페이지네이션 동작', async ({ page }) => {
    await page.goto(ENTITY_PATH);
    const nextButton = page.locator('button:has-text("다음")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('행 클릭 시 상세 페이지 이동', async ({ page }) => {
    await page.goto(ENTITY_PATH);
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      // Should navigate away from list
      await expect(page).not.toHaveURL(ENTITY_PATH);
    }
  });
});
