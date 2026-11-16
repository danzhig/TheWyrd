import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { PublicConnections } from '../../lib/types';

/**
 * Threads on the Vault (PLAN §14, P4.3): gold arcs between medallions weighted by connections,
 * a filter by type, an arc's connections in a panel, and each one followed into the reader.
 */
const connections = (
  JSON.parse(fs.readFileSync('public/data/connections.json', 'utf8')) as PublicConnections
).connections;
const pairs = new Map<string, number>();
for (const c of connections) {
  const k = [c.ends[0].bookId, c.ends[1].bookId].sort().join('|');
  pairs.set(k, (pairs.get(k) ?? 0) + 1);
}
const [busiest] = [...pairs].sort((a, b) => b[1] - a[1]);

async function threadsOn(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
  await page.getByTestId('view-threads').click();
  await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
}

test.describe('Threads on the Vault', () => {
  test.skip(!connections.length, 'no verified connections yet');

  test('draws one arc per pair of books, weighted, under 300 nodes', async ({ page }) => {
    await threadsOn(page);
    await expect(page.getByTestId('view-threads')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-arc]')).toHaveCount(pairs.size);
    const [key, n] = busiest!;
    await expect(page.locator(`[data-arc="${key}"]`)).toHaveAttribute('data-count', String(n));
    const nodes = await page.evaluate(
      () => document.querySelector('[data-testid="vault-scene"]')!.querySelectorAll('*').length,
    );
    expect(nodes).toBeLessThan(300);
  });

  test('filters arcs by type', async ({ page }) => {
    await threadsOn(page);
    const type = connections[0]!.type;
    const without = new Set(
      connections
        .filter((c) => c.type !== type)
        .map((c) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|')),
    );
    await page.locator(`[data-testid="thread-filter"] [data-type="${type}"]`).click();
    await expect(page.locator('[data-arc]')).toHaveCount(without.size);
    await page.locator(`[data-testid="thread-filter"] [data-type="${type}"]`).click();
    await expect(page.locator('[data-arc]')).toHaveCount(pairs.size);
  });

  test('tapping an arc lists its connections, and one is followed into the reader', async ({
    page,
  }) => {
    await threadsOn(page);
    const [key, n] = busiest!;
    // Tap the arc where nothing covers it: its middle.
    const hit = page.locator(`[data-arc-hit="${key}"]`);
    await hit.dispatchEvent('click');
    const panel = page.getByTestId('arc-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-panel-connection]')).toHaveCount(n);
    // Measure contrast once the panel has finished fading in.
    await panel.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    const results = await new AxeBuilder({ page }).include('[data-testid="arc-panel"]').analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    const c = connections.find(
      (x) => [x.ends[0].bookId, x.ends[1].bookId].sort().join('|') === key,
    )!;
    await panel.locator(`[data-open-end="${c.id}:1"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-reader', c.ends[1].sectionId);
    expect(page.url()).toContain(`?thread=${c.id}#${c.ends[1].anchor}`);
    await expect(page.getByTestId('thread-back')).toBeVisible();

    // Back to the Vault: Threads is still on.
    await page.goBack();
    await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
  });

  test('the list holds every arc, and Esc closes the panel', async ({ page }) => {
    await threadsOn(page);
    await page.getByRole('button', { name: 'List' }).click();
    const list = page.getByTestId('thread-list');
    await expect(list).toBeVisible();
    await expect(list.locator('[data-arc-item]')).toHaveCount(pairs.size);
    const first = list.locator('[data-arc-item]').first();
    await first.click();
    await expect(page.getByTestId('arc-panel')).toBeVisible();
    await expect(page.locator('#arc-heading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('arc-panel')).toBeHidden();
    await expect(first).toBeFocused();
  });

  test('Themes turns Threads off', async ({ page }) => {
    await threadsOn(page);
    await page.getByTestId('view-themes').click();
    await expect(page.getByTestId('view-threads')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-arc]')).toHaveCount(0);
  });
});
