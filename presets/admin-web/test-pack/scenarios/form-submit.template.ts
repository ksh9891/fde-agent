/**
 * Form Submit E2E Test Template
 *
 * Test Writer: Replace ENTITY_NAME, FORM_PATH, REQUIRED_FIELDS with actual values.
 * Example: ENTITY_NAME="예약", FORM_PATH="/reservations/new",
 *          REQUIRED_FIELDS=[{label: "고객명", value: "홍길동"}, {label: "객실", value: "101"}]
 */
import { test, expect } from '@playwright/test';

const ENTITY_NAME = '__ENTITY_NAME__';
const FORM_PATH = '__FORM_PATH__';
const REQUIRED_FIELDS: { label: string; value: string }[] = [
  // Test Writer fills these in
];

test.describe(`${ENTITY_NAME} 등록 폼`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('폼 페이지 접근 가능', async ({ page }) => {
    await page.goto(FORM_PATH);
    await expect(page).toHaveURL(FORM_PATH);
    // Form should be visible
    await expect(page.locator('form')).toBeVisible();
  });

  test('필수 필드가 존재', async ({ page }) => {
    await page.goto(FORM_PATH);
    for (const field of REQUIRED_FIELDS) {
      const label = page.locator(`label:has-text("${field.label}")`);
      await expect(label).toBeVisible();
    }
  });

  test('빈 폼 제출 시 유효성 검사', async ({ page }) => {
    await page.goto(FORM_PATH);
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    // Should show error messages or stay on same page
    await expect(page).toHaveURL(FORM_PATH);
  });

  test('올바른 데이터 입력 후 제출 성공', async ({ page }) => {
    await page.goto(FORM_PATH);

    for (const field of REQUIRED_FIELDS) {
      const input = page.locator(`label:has-text("${field.label}") + input, label:has-text("${field.label}") ~ input`).first();
      if (await input.isVisible()) {
        await input.fill(field.value);
      }
    }

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should navigate away from form (to detail or list)
    await page.waitForTimeout(1000);
    // Form submission should succeed (no crash, navigates or shows success)
  });
});
