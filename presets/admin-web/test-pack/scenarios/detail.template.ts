/**
 * Detail View E2E Test Template
 *
 * Test Writer: Replace ENTITY_NAME, DETAIL_PATH with actual values.
 * Example: ENTITY_NAME="예약", DETAIL_PATH="/reservations/1"
 */
import { test, expect } from '@playwright/test';

const ENTITY_NAME = '__ENTITY_NAME__';
const DETAIL_PATH = '__DETAIL_PATH__';

test.describe(`${ENTITY_NAME} 상세 보기`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('상세 페이지 접근 가능', async ({ page }) => {
    await page.goto(DETAIL_PATH);
    await expect(page).toHaveURL(DETAIL_PATH);
  });

  test('엔티티 정보가 표시됨', async ({ page }) => {
    await page.goto(DETAIL_PATH);
    // Card with entity details should be visible
    await expect(page.locator('[data-testid="detail-card"]').or(page.locator('.card')).first()).toBeVisible();
  });

  test('뒤로가기 버튼 동작', async ({ page }) => {
    await page.goto(DETAIL_PATH);
    const backButton = page.locator('button:has-text("목록"), a:has-text("목록"), button:has-text("뒤로")');
    if (await backButton.first().isVisible()) {
      await backButton.first().click();
      await expect(page).not.toHaveURL(DETAIL_PATH);
    }
  });

  test('수정 버튼 존재', async ({ page }) => {
    await page.goto(DETAIL_PATH);
    const editButton = page.locator('button:has-text("수정"), a:has-text("수정")');
    await expect(editButton.first()).toBeVisible();
  });
});
