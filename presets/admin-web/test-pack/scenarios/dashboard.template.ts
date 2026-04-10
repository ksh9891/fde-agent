/**
 * Dashboard E2E Test Template
 */
import { test, expect } from '@playwright/test';

test.describe('대시보드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('대시보드 페이지 접근 가능', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('통계 카드가 표시됨', async ({ page }) => {
    await page.goto('/dashboard');
    // At least one stat card should be visible
    const cards = page.locator('[data-testid="stat-card"], .card');
    await expect(cards.first()).toBeVisible();
  });

  test('콘솔 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    const fatalErrors = errors.filter(e =>
      /TypeError|ReferenceError|SyntaxError/.test(e)
    );
    expect(fatalErrors).toEqual([]);
  });
});
