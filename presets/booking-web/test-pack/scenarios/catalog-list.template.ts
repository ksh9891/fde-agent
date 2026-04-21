/**
 * Catalog List E2E Test Template
 * Provisioner가 __ENTITY_NAME__, __ENTITY_PATH__ 플레이스홀더를 entity별로 치환한다.
 * 예: ENTITY_NAME='객실', ENTITY_PATH='/rooms'
 */
import { test, expect } from "@playwright/test";

const ENTITY_NAME = '__ENTITY_NAME__';
const ENTITY_PATH = '__ENTITY_PATH__';

test.describe(`${ENTITY_NAME} 카탈로그 목록`, () => {
  test("카탈로그 목록 페이지 접근 가능 (비로그인)", async ({ page }) => {
    await page.goto(ENTITY_PATH);
    await expect(page).toHaveURL(ENTITY_PATH);
    // 카탈로그 카드 그리드가 있어야 함 (비어 있더라도 컨테이너는 존재)
    await expect(page.locator("h2")).toBeVisible();
  });

  test("카드 클릭 시 상세로 이동", async ({ page }) => {
    await page.goto(ENTITY_PATH);
    const firstCard = page.locator("a").filter({ has: page.locator("h3, .card-title, [class*='CardTitle']") }).first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page).not.toHaveURL(ENTITY_PATH);
    }
  });
});
