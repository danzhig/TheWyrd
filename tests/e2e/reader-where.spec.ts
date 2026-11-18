import { expect, test } from '@playwright/test';

/**
 * Where you are (owner, 2026-11-18): in the reader, a marker on the right edge shows the chapter
 * and verse at the top of the screen and slides down as you read; Esc on a book's map goes home.
 */
test.describe('Where you are', () => {
  test('the marker follows the reading across chapters, and moves down the edge', async ({
    page,
  }) => {
    // The Flood: Genesis 6–9, more than one chapter.
    await page.goto('/read/gen-04/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-04');
    const where = page.getByTestId('reader-where');
    const cv = where.locator('[data-where-cv]');
    await expect(cv).toHaveText('6:1');
    const y = () => where.evaluate((el) => el.getBoundingClientRect().top);
    const start = await y();
    // Read on to chapter 8: the marker names it, and has moved down.
    await page.locator('[id="v-8-1"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect(cv).toHaveText(/^8:\d+$/);
    expect(await y()).toBeGreaterThan(start);
    // In the Douay-Rheims it shows that Bible's own numbers.
    await page.getByTestId('translation-drc').click();
    await expect(page.getByTestId('drc-body')).toBeVisible();
    await expect(cv).toHaveText(/^\d+:\d+$/);
    await page.getByTestId('translation-webc').click();
  });

  test('key verses are marked however a reading is reached, named with their themes', async ({
    page,
  }) => {
    // Along the path (no theme in the address): Jeremiah 29:11 is key to Hope and to Trust.
    await page.goto('/read/jer-x121/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'jer-x121');
    await expect(page.locator('[data-key-verse]')).toHaveCount(1);
    await expect(page.locator('[data-key-verse]')).toHaveAttribute('data-verse', 'Jer.29.11');
    const tag = page.getByTestId('key-tag');
    await expect(tag).toHaveCount(1);
    await expect(tag.locator('a[data-key-theme="faith-hope"]')).toHaveAttribute(
      'href',
      '/?theme=faith-hope',
    );
    // Opened from the theme: the same, and it opens there.
    await page.goto('/read/jer-x121/?theme=faith-hope#v-29-11');
    await expect(page.locator('[data-key-verse]')).toBeInViewport();
    // Still marked in the Douay-Rheims.
    await page.getByTestId('translation-drc').click();
    await expect(page.getByTestId('drc-body')).toBeVisible();
    await expect(page.locator('[data-testid=drc-body] [data-key-verse]').first()).toBeAttached();
    await expect(page.locator('[data-testid=drc-body] [data-testid=key-tag]')).toHaveCount(1);
    await page.getByTestId('translation-webc').click();
  });

  test('Esc on a book’s map leads back to the Vault', async ({ page }) => {
    await page.goto('/book/Gen/');
    await expect(page.locator('html')).toHaveAttribute('data-book-map', /.*/);
    await page.keyboard.press('Escape');
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
  });
});
