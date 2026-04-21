/**
 * Catalog Detail E2E Test Template
 * __ENTITY_NAME__ / __DETAIL_PATH__ 치환됨 (예: '/rooms/1').
 */
import { test, expect } from "@playwright/test";

const ENTITY_NAME = '__ENTITY_NAME__';
const DETAIL_PATH = '__DETAIL_PATH__';

test.describe(`${ENTITY_NAME} 상세`, () => {
  test("상세 페이지 접근 가능 (비로그인)", async ({ page }) => {
    await page.goto(DETAIL_PATH);
    await expect(page).toHaveURL(DETAIL_PATH);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("예약하기 CTA가 보인다", async ({ page }) => {
    await page.goto(DETAIL_PATH);
    const cta = page.getByRole("link", { name: /예약/ });
    // 상품에 따라 예약 불가일 수 있으므로 버튼/링크 중 하나 존재를 기대
    const hasLink = await cta.first().isVisible().catch(() => false);
    const hasBtn = await page.getByRole("button", { name: /예약/ }).first().isVisible().catch(() => false);
    expect(hasLink || hasBtn).toBeTruthy();
  });
});
