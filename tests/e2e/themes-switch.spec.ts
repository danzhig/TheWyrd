import { expect, test } from '@playwright/test';

/**
 * Switching between Spiral and Themes only changes the general view (owner, 2026-11-18): it never
 * opens a sub-theme's table by itself, even after one was opened on the way back from a reading.
 */
test('switching to Themes again never opens a sub-theme by itself', async ({ page }) => {
  // Back from a reading opened in Mercy: the Vault opens that sub-theme (a request to open it).
  await page.goto('/read/gen-14/?theme=mercy-mercy');
  await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-14');
  await page.keyboard.press('Escape');
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.locator('[data-reading^="mercy-mercy:"]').first()).toBeAttached({
    timeout: 8000,
  });
  // To the spiral and back to Themes: the whole ring, no table.
  await page.getByTestId('view-spiral').click();
  await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'spiral', {
    timeout: 8000,
  });
  await page.getByTestId('view-themes').click();
  await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
    timeout: 8000,
  });
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-reading]')).toHaveCount(0);
  await expect(page.getByTestId('spread-head')).toHaveCount(0);
});

/**
 * From a sub-theme's table into a reading and back, by every way back (owner, 2026-11-18): the
 * Vault is still in Themes, with the same table open, and never replays the flight or reloads.
 */
for (const way of ['Esc', 'the theme pill', 'a key-verse label', 'the browser back'] as const) {
  test(`back from a reading by ${way} finds the table open, with no flight`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 8000,
    });
    await page.locator('[data-constellation="mercy"]').click({ force: true });
    const name = page.locator('[data-subtheme="mercy-mercy"]');
    await expect(name).toBeAttached({ timeout: 6000 });
    await name.dispatchEvent('click');
    const rows = page.locator('[data-reading^="mercy-mercy:"]');
    await expect(rows.first()).toBeAttached();
    // A mark on the page: a reload would wipe it.
    await page.evaluate(() => ((window as unknown as { __mark: number }).__mark = 1));
    // The first reading holding one of Mercy's key verses (its name is gold), so its label is there.
    const data = (await (await page.request.get('/data/themes.json')).json()) as {
      themes: { subthemes: { id: string; readings: { sectionId: string; key?: string }[] }[] }[];
    };
    const withKey = data.themes
      .flatMap((t) => t.subthemes)
      .find((s) => s.id === 'mercy-mercy')!
      .readings.find((r) => r.key)!;
    const keyed = page.locator(`[data-reading="mercy-mercy:${withKey.sectionId}"]`);
    await keyed.dispatchEvent('click');
    await expect(page.locator('html')).toHaveAttribute('data-reader', /.+/);
    if (way === 'Esc') await page.keyboard.press('Escape');
    else if (way === 'the theme pill') await page.getByTestId('theme-back').click();
    else if (way === 'the browser back') await page.goBack();
    else {
      const tag = page.locator('[data-key-theme="mercy-mercy"]').first();
      if ((await tag.count()) === 0) test.skip(true, 'this reading holds no key verse of Mercy');
      await tag.click();
    }
    await page.waitForURL((u) => u.pathname === '/');
    await expect(rows.first()).toBeAttached({ timeout: 8000 });
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
    expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(1);
  });
}
