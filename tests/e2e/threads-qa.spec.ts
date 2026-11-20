import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ALL_PAIRS } from '../../lib/corpora';
import { THREAD_FILES } from '../../lib/thread-files';
import type { PublicConnection, PublicConnections } from '../../lib/types';

/**
 * Threads QA (threads plan TX8): the whole of Threads with every corpus pair switched on, on every
 * engine and profile (Chromium phone and desktop, Pixel 7, and in CI Firefox, desktop Safari and
 * an iPhone). Every arc drawn and listed; each pair's busiest arc opened and a card followed into
 * the reader and back; a library book's threads; the reader's list and dialog; search; storage
 * blocked; reduced motion. Accessibility is checked at each stop.
 */
const all: PublicConnection[] = THREAD_FILES.flatMap((f) =>
  fs.existsSync(`public/data/${f}`)
    ? (JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8')) as PublicConnections).connections
    : [],
);
const keyOf = (c: PublicConnection) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|');
const arcs = new Map<string, PublicConnection[]>();
for (const c of all) arcs.set(keyOf(c), [...(arcs.get(keyOf(c)) ?? []), c]);
const present = ALL_PAIRS.filter((p) => all.some((c) => c.pair === p));

type ArcInfo = { key: string; count: number; pair: string; x: number; y: number };
const drawn = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sasArcs?: () => ArcInfo[] }).__sasArcs?.() ?? []);

/** The reader's choice of filters, as the Vault keeps it: every pair on, no kind off. */
async function everyPairOn(page: Page) {
  await page.addInitScript(
    (value) => {
      try {
        localStorage.setItem('sas:v1:threadFilters', value);
      } catch {
        /* storage blocked: the defaults apply */
      }
    },
    JSON.stringify({ pairs: [...ALL_PAIRS], typesOff: [] }),
  );
}

async function threadsOn(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
  if ((await page.getByTestId('view-threads').getAttribute('aria-pressed')) !== 'true')
    await page.getByTestId('view-threads').click();
  await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
}

/** On phones the filters fold behind a tab on the right edge. */
async function openFilters(page: Page) {
  const tab = page.getByTestId('thread-filter-tab');
  if ((await tab.isVisible()) && (await tab.getAttribute('aria-expanded')) !== 'true')
    await tab.click();
}

async function serious(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

const settled = (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

test.describe('Threads QA, every pair on', () => {
  test.skip(present.length < 2, 'only one corpus pair has threads');

  test.beforeEach(async ({ page }) => {
    await everyPairOn(page);
  });

  test('every arc is drawn and listed, and every pair chip is on', async ({ page }) => {
    await threadsOn(page);
    await expect.poll(async () => (await drawn(page)).length).toBe(arcs.size);
    // A few joined paths carry them all (the scene's node budget).
    expect(await page.locator('[data-arc-bundle]').count()).toBeLessThan(40);
    const nodes = await page.evaluate(
      () => document.querySelector('[data-testid="vault-scene"]')!.querySelectorAll('*').length,
    );
    expect(nodes).toBeLessThan(300);
    await openFilters(page);
    for (const p of present)
      await expect(page.locator(`[data-pair-chip="${p}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await serious(page, '[data-testid="thread-filter"]')).toEqual([]);
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByTestId('thread-list').locator('[data-arc-item]')).toHaveCount(arcs.size);
    expect(await serious(page)).toEqual([]);
  });

  for (const pair of ALL_PAIRS)
    test(`the busiest ${pair} arc opens, and a card leads into the reader and back`, async ({
      page,
    }) => {
      const mine = [...arcs].filter(([, list]) => list[0]!.pair === pair);
      test.skip(!mine.length, `no ${pair} threads`);
      const [key, list] = mine.sort((a, b) => b[1].length - a[1].length)[0]!;
      await threadsOn(page);
      await page.getByRole('button', { name: 'List' }).click();
      await page.locator(`[data-arc-item="${key}"]`).click();
      const panel = page.getByTestId('arc-panel');
      await expect(panel).toBeVisible();
      await expect(page.locator('#arc-heading')).toContainText(`${list.length} threads`);
      await settled(page, 'arc-panel');
      expect(await serious(page, '[data-testid="arc-panel"]')).toEqual([]);
      // Follow the first card's later (or second) end into the reader.
      const link = panel.locator('a[data-open-end]').first();
      const href = (await link.getAttribute('href'))!;
      const section = /\/read\/([^/]+)\//.exec(href)![1]!;
      await link.click();
      await expect(page.locator('html')).toHaveAttribute('data-reader', section);
      await expect(page.getByTestId('thread-back')).toBeVisible();
      // Back on the Vault, Threads is still on with every pair.
      await page.goBack();
      await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
      await expect.poll(async () => (await drawn(page)).length).toBe(arcs.size);
    });

  test("a library book's first tap shows its threads; the second goes in", async ({ page }) => {
    // The library book with the most threads.
    const counts = new Map<string, number>();
    for (const c of all)
      for (const e of c.ends) counts.set(e.bookId, (counts.get(e.bookId) ?? 0) + 1);
    await threadsOn(page);
    const library = await page
      .locator('[data-testid="vault-view"] a[data-book][data-offpath]')
      .evaluateAll((as) => as.map((a) => (a as HTMLElement).dataset.book!));
    const book = library.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0]!;
    const tap = () =>
      page
        .locator(`[data-testid="vault-view"] a[data-book="${book}"]`)
        .evaluate((a) =>
          a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })),
        );
    await tap();
    await expect(page.getByTestId('book-panel')).toBeVisible();
    await expect(page.locator('#book-heading')).toContainText(`${counts.get(book)} threads`);
    await settled(page, 'book-panel');
    expect(await serious(page, '[data-testid="book-panel"]')).toEqual([]);
    await tap();
    await expect(page).toHaveURL(new RegExp(`/book/${book}/$`));
  });
});

test.describe('Threads QA in the reader and search', () => {
  test('the busiest reading lists its threads in groups and opens a verse in the dialog', async ({
    page,
  }) => {
    const per = new Map<string, number>();
    for (const c of all)
      for (const e of c.ends) per.set(e.sectionId, (per.get(e.sectionId) ?? 0) + 1);
    const [section, n] = [...per].sort((a, b) => b[1] - a[1])[0]!;
    await page.goto(`/read/${section}/`);
    await expect(page.locator('html')).toHaveAttribute('data-reader', section);
    const list = page.getByTestId('threads');
    await expect(list.locator('[data-thread-card]')).toHaveCount(n);
    expect(await serious(page, '[data-testid="threads"]')).toEqual([]);
    const glyph = page.locator('a.thread-glyph').first();
    await glyph.scrollIntoViewIfNeeded();
    await glyph.click();
    const dialog = page.getByTestId('thread-dialog');
    await expect(dialog).toBeVisible();
    // Measured once the dialog has finished fading in.
    await settled(page, 'thread-dialog');
    await page.waitForTimeout(400);
    expect(await serious(page, '[data-testid="thread-dialog"]')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('search finds a thread from each file, with its direction', async ({ page }) => {
    for (const out of THREAD_FILES) {
      if (!fs.existsSync(`public/data/${out}`)) continue;
      const list = (JSON.parse(fs.readFileSync(`public/data/${out}`, 'utf8')) as PublicConnections)
        .connections;
      // A thread whose label is three words or more, searched by its label.
      const c = list.find((x) => x.label.split(' ').length >= 3);
      if (!c) continue;
      await page.goto(`/search/?q=${encodeURIComponent(c.label)}`);
      const hit = page.getByTestId('search-extras').locator(`[data-extra-thread="${c.id}"]`);
      await expect(hit).toBeVisible();
      await expect(hit.locator('[data-direction]')).toBeVisible();
    }
  });
});

test.describe('Threads QA, storage and motion', () => {
  async function blockedStorage(browser: Browser) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage'])
        Object.defineProperty(window, name, {
          get() {
            throw new Error('blocked');
          },
        });
    });
    return context;
  }

  test('with storage blocked, Threads opens on Old ↔ New and the chips still work', async ({
    browser,
  }) => {
    const context = await blockedStorage(browser);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await threadsOn(page);
    const ot = [...arcs.values()].filter((l) => l[0]!.pair === 'ot-nt').length;
    await expect.poll(async () => (await drawn(page)).length).toBe(ot);
    const other = present.find((p) => p !== 'ot-nt');
    if (other) {
      await openFilters(page);
      await page.locator(`[data-pair-chip="${other}"]`).click();
      await expect(page.locator(`[data-pair-chip="${other}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect.poll(async () => (await drawn(page)).length).toBeGreaterThan(ot);
    }
    expect(errors).toEqual([]);
    await context.close();
  });

  test('with reduced motion, the arcs appear without animating', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await everyPairOn(page);
    await threadsOn(page);
    await expect.poll(async () => (await drawn(page)).length).toBe(arcs.size);
    const names = await page
      .locator('[data-arc-bundle]')
      .evaluateAll((ps) => ps.map((p) => getComputedStyle(p).animationName));
    expect(names.every((n) => n === 'none')).toBe(true);
    await context.close();
  });
});
