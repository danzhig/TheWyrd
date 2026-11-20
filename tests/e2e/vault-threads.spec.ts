import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { PublicConnections } from '../../lib/types';

/**
 * Threads on the Vault (PLAN §14, P4.3): gold arcs between medallions weighted by connections,
 * a filter by type, an arc's connections in a panel, and each one followed into the reader.
 */
// Every published file: Old ↔ New and the threads inside each Testament (Threads mode loads all).
const connections = [
  'connections.json',
  'connections-within-ot.json',
  'connections-within-nt.json',
].flatMap((f) =>
  fs.existsSync(`public/data/${f}`)
    ? (JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8')) as PublicConnections).connections
    : [],
);
// Only Old ↔ New is on at first (owner, 2026-11-20); the other pairs wait behind their chips.
const all = connections;
const onAtFirst = all.filter((c) => c.pair === 'ot-nt');
const pairs = new Map<string, number>();
for (const c of onAtFirst) {
  const k = [c.ends[0].bookId, c.ends[1].bookId].sort().join('|');
  pairs.set(k, (pairs.get(k) ?? 0) + 1);
}
const [busiest] = [...pairs].sort((a, b) => b[1] - a[1]);

/** Every arc drawn (the arcs are a few joined paths; `__sasArcs` lists them one by one). */
type ArcInfo = { key: string; count: number; pair: string; x: number; y: number };
const drawn = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sasArcs?: () => ArcInfo[] }).__sasArcs?.() ?? []);
const arcCount = (page: Page, pair?: string) =>
  expect.poll(async () => (await drawn(page)).filter((a) => !pair || a.pair === pair).length);

/** On phones the filters fold behind a tab on the right edge. */
async function openFilters(page: Page) {
  const tab = page.getByTestId('thread-filter-tab');
  if ((await tab.isVisible()) && (await tab.getAttribute('aria-expanded')) !== 'true')
    await tab.click();
}

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
    await arcCount(page).toBe(pairs.size);
    const [key, n] = busiest!;
    expect((await drawn(page)).find((a) => a.key === key)?.count).toBe(n);
    // A few paths, whatever the number of arcs.
    expect(await page.locator('[data-arc-bundle]').count()).toBeLessThan(40);
    const nodes = await page.evaluate(
      () => document.querySelector('[data-testid="vault-scene"]')!.querySelectorAll('*').length,
    );
    expect(nodes).toBeLessThan(300);
  });

  test('filters arcs by type', async ({ page }) => {
    await threadsOn(page);
    const type = onAtFirst[0]!.type;
    const without = new Set(
      onAtFirst
        .filter((c) => c.type !== type)
        .map((c) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|')),
    );
    await openFilters(page);
    await page.locator(`[data-testid="thread-filter"] [data-type="${type}"]`).click();
    await arcCount(page).toBe(without.size);
    await page.locator(`[data-testid="thread-filter"] [data-type="${type}"]`).click();
    await arcCount(page).toBe(pairs.size);
  });

  test('tapping an arc lists its connections, and one is followed into the reader', async ({
    page,
  }) => {
    await threadsOn(page);
    // Tap an arc where nothing covers it: the first whose middle is open sky. (Arcs are one path
    // each; a tap is matched to the nearest arc.)
    const target = await page.evaluate(() => {
      const list =
        (
          window as unknown as {
            __sasArcs?: () => { key: string; count: number; x: number; y: number }[];
          }
        ).__sasArcs?.() ?? [];
      for (const a of list) {
        const el = document.elementFromPoint(a.x, a.y);
        if (
          el &&
          !el.closest('a, button, aside') &&
          a.x > 0 &&
          a.y > 120 &&
          a.x < innerWidth &&
          a.y < innerHeight - 140
        )
          return { key: a.key, n: a.count, x: a.x, y: a.y };
      }
      return null;
    });
    expect(target).not.toBeNull();
    const { key, n } = target!;
    await page.mouse.click(target!.x, target!.y);
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

    const c = onAtFirst.find((x) => [x.ends[0].bookId, x.ends[1].bookId].sort().join('|') === key)!;
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

  test('the panel shows each thread as a closed card, one open at a time', async ({ page }) => {
    const counts = new Map<string, number>();
    for (const x of onAtFirst) {
      const k = [x.ends[0].bookId, x.ends[1].bookId].sort().join('|');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const key = [...counts].find(([, n]) => n > 1)![0];
    await threadsOn(page);
    await page.getByRole('button', { name: 'List' }).click();
    await page.locator(`[data-arc-item="${key}"]`).click();
    const panel = page.getByTestId('arc-panel');
    const cards = panel.locator('[data-thread-card]');
    await expect(cards.first().locator('[data-direction]')).toBeVisible();
    await expect(cards.first().locator('[data-summary]')).toBeVisible();
    const [a, b] = [cards.nth(0).locator('[data-more]'), cards.nth(1).locator('[data-more]')];
    await a.locator('summary').click();
    await expect(a).toHaveAttribute('open', '');
    await b.locator('summary').click();
    await expect(b).toHaveAttribute('open', '');
    await expect(a).not.toHaveAttribute('open', '');
  });

  // A tap on a medallion, as the pointer would make it (labels may lie over the bubble).
  const tapBook = (page: Page, id: string) =>
    page
      .locator(`[data-testid="vault-view"] a[data-book="${id}"]`)
      .evaluate((a) =>
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })),
      );
  const threaded = new Set(onAtFirst.flatMap((c) => c.ends.map((e) => e.bookId)));

  test('the first tap on a book shows its threads, the second goes into the book', async ({
    page,
  }) => {
    await threadsOn(page);
    await tapBook(page, 'Luke');
    const panel = page.getByTestId('book-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('#book-heading')).toBeFocused();
    expect(new URL(page.url()).pathname).toBe('/');
    const n = onAtFirst.filter((c) => c.ends.some((e) => e.bookId === 'Luke')).length;
    await expect(page.locator('#book-heading')).toContainText(`${n} threads`);
    await expect(
      panel.locator('[data-book-group="drawsOn"] [data-book-row]').first(),
    ).toBeVisible();
    // Every other book's arcs dim.
    await expect(page.locator('[data-arc-bundle="dim"]').first()).toHaveCSS('opacity', '0.12');
    await expect(page.locator('[data-arc-bundle="lit"]').first()).toBeAttached();
    await panel.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    const results = await new AxeBuilder({ page }).include('[data-testid="book-panel"]').analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
    await tapBook(page, 'Luke');
    await expect(page).toHaveURL(/\/book\/Luke\/$/);
  });

  test('"Open" in the book panel goes in; Esc steps out a card, a row, then the panel', async ({
    page,
  }) => {
    await threadsOn(page);
    await tapBook(page, 'Luke');
    const panel = page.getByTestId('book-panel');
    const row = panel.locator('[data-book-row]').first();
    await row.locator('> summary').click();
    await expect(row).toHaveAttribute('open', '');
    const card = row.locator('[data-more]').first();
    await card.locator('summary').click();
    await expect(card).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('open', '');
    await expect(row).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(row).not.toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await tapBook(page, 'Luke');
    await page.getByTestId('open-book').click();
    await expect(page).toHaveURL(/\/book\/Luke\/$/);
  });

  test('a book with no threads goes straight in, drawn dimmed', async ({ page }) => {
    await threadsOn(page);
    const ids = await page
      .locator('[data-testid="vault-view"] a[data-book]')
      .evaluateAll((as) => as.map((a) => (a as HTMLElement).dataset.book!));
    const none = ids.find((id) => !threaded.has(id))!;
    expect(none).toBeTruthy();
    await expect(page.locator(`[data-testid="vault-view"] a[data-book="${none}"]`)).toHaveAttribute(
      'data-threadless',
      '',
    );
    await tapBook(page, none);
    await expect(page).toHaveURL(new RegExp(`/book/${none}/$`));
  });

  test('with Threads off, one tap opens the book', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await tapBook(page, 'Luke');
    await expect(page).toHaveURL(/\/book\/Luke\/$/);
  });

  test("an arc's panel says which way its threads run and filters by type", async ({ page }) => {
    await threadsOn(page);
    await page.getByRole('button', { name: 'List' }).click();
    // The busiest arc where a use is claimed (many threads inside a Testament claim none).
    const used = new Map<string, number>();
    for (const c of onAtFirst.filter((c) => c.order.uses)) {
      const k = [c.ends[0].bookId, c.ends[1].bookId].sort().join('|');
      used.set(k, (used.get(k) ?? 0) + 1);
    }
    const [key] = [...used].sort((a, b) => b[1] - a[1])[0]!;
    await page.locator(`[data-arc-item="${key}"]`).click();
    const panel = page.getByTestId('arc-panel');
    await expect(page.locator('#arc-heading')).toContainText(`${pairs.get(key)} threads`);
    await expect(panel.getByTestId('arc-summary')).toContainText('draws on');
    const chip = panel.locator('[data-panel-type]').first();
    const type = await chip.getAttribute('data-panel-type');
    await chip.click();
    const shown = await panel.locator('[data-panel-connection]').count();
    expect(shown).toBe(
      onAtFirst.filter(
        (c) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|') === key && c.type === type,
      ).length,
    );
  });

  test('arcs are plain lines; corpus pairs filter them', async ({ page }) => {
    await threadsOn(page);
    // Direction is shown on the cards, not on the arcs (owner, 2026-11-19): plain lines.
    await expect(page.locator('[data-testid="thread-arcs"] [marker-mid]')).toHaveCount(0);
    // The pair chips: one per pair present, each a toggle; only Old ↔ New is on at first.
    await openFilters(page);
    const chips = page.getByTestId('pair-filter').locator('[data-pair-chip]');
    const present = [...new Set(all.map((c) => c.pair))];
    await expect(chips).toHaveCount(present.length);
    await expect(page.locator('[data-pair-chip="ot-nt"]')).toHaveAttribute('aria-pressed', 'true');
    const nn = page.locator('[data-pair-chip="nt-nt"]');
    await expect(nn).toHaveAttribute('aria-pressed', 'false');
    await arcCount(page, 'nt-nt').toBe(0);
    const nnArcs = new Set(
      all
        .filter((c) => c.pair === 'nt-nt')
        .map((c) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|')),
    );
    await nn.click();
    await expect(nn).toHaveAttribute('aria-pressed', 'true');
    await arcCount(page, 'nt-nt').toBe(nnArcs.size);
    // With the Old Testament hidden, only threads inside the New are left.
    await page.getByTestId('testament-ot').click();
    await arcCount(page).toBe(nnArcs.size);
    await page.getByTestId('testament-ot').click();
    // The choice is kept: after a reload, New ↔ New is still on.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    if ((await page.getByTestId('view-threads').getAttribute('aria-pressed')) !== 'true')
      await page.getByTestId('view-threads').click();
    await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
    await openFilters(page);
    await expect(nn).toHaveAttribute('aria-pressed', 'true');
    await arcCount(page, 'nt-nt').toBe(nnArcs.size);
  });

  test('the filters sit in a sidebar on the right', async ({ page }) => {
    await threadsOn(page);
    const bar = page.getByTestId('thread-filter');
    const tab = page.getByTestId('thread-filter-tab');
    // Phones fold it behind a tab on the right edge.
    if (await tab.isVisible()) {
      await expect(page.locator('[data-pair-chip="ot-nt"]')).toBeHidden();
      await tab.click();
      await expect(tab).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(page.locator('[data-pair-chip="ot-nt"]')).toBeVisible();
    const box = (await bar.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x + box.width).toBeGreaterThan(width - 40);
    expect(box.x).toBeGreaterThan(width / 2);
    const results = await new AxeBuilder({ page })
      .include('[data-testid="thread-filter"]')
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('Themes turns Threads off', async ({ page }) => {
    await threadsOn(page);
    await page.getByTestId('view-themes').click();
    await expect(page.getByTestId('view-threads')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('thread-arcs')).toHaveCount(0);
  });
});
