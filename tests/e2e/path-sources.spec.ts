import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const pinned = (
  JSON.parse(fs.readFileSync('sources/manifest.json', 'utf8')) as { sources: { id: string }[] }
).sources;

async function noSerious(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

test.describe('the path and sources pages', () => {
  test('the path opens from the Vault, shows progress and opens a section', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('sas:v1:progress', JSON.stringify({ 'gen-01': '2026-11-10' })),
    );
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('path-link').click();
    await page.waitForURL(/\/path\/$/);
    const first = page.locator('[data-row="gen-01"]');
    await expect(first).toContainText('read');
    await expect(page.locator('[data-row="john-01"]')).toContainText('optional detour');
    await expect(page.locator('[data-row^="br-"]')).toHaveCount(4);
    await page.locator('[data-row="exod-03"]').click();
    await page.waitForURL(/\/read\/exod-03\/$/);
  });

  test("the timeline counts each section's threads", async ({ page }) => {
    // Luke 1 (Two Annunciations) is the busiest reading on the path for threads.
    // Counted across every published file (Old ↔ New and inside each Testament).
    const all = ['connections.json', 'connections-within-ot.json', 'connections-within-nt.json']
      .filter((f) => fs.existsSync(`public/data/${f}`))
      .flatMap(
        (f) =>
          (
            JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8')) as {
              connections: { ends: { sectionId: string }[] }[];
            }
          ).connections,
      );
    const n = all.filter((c) => c.ends.some((e) => e.sectionId === 'luke-02')).length;
    await page.goto('/path/');
    await expect(page.locator('[data-row="luke-02"]')).toContainText(`${n} threads`);
  });

  test('every pinned source appears on /sources with its license', async ({ page }) => {
    await page.goto('/sources/');
    for (const s of pinned) {
      // Files from one work share a credit: data-source lists every id it covers.
      const card = page.locator(`[data-source~="${s.id}"]`);
      await expect(card, s.id).toHaveCount(1);
      await expect(card.locator('dd a').first(), s.id).toHaveAttribute('href', /^https?:\/\//);
    }
  });

  for (const path of ['/path/', '/sources/']) {
    test(`no serious accessibility issues on ${path}`, async ({ page }) => {
      await page.goto(path);
      await noSerious(page);
    });
  }
});
