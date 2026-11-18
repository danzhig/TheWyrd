import { expect, test } from '@playwright/test';

/**
 * The zoom-out limit lies beyond the opening view (owner, 2026-11-18): on wide screens the opening
 * view takes in the outer ring and its names, and a wheel turn outward from it must zoom out (or
 * stay), never jump in.
 */
test('the wheel zooms out from the opening view, never in', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a mouse wheel');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
  const scale = () =>
    page
      .getByTestId('vault-scene')
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  const start = await scale();
  const view = page.viewportSize()!;
  await page.mouse.move(view.width / 2, view.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  expect(await scale()).toBeLessThanOrEqual(start + 1e-6);
});
