import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ReadingPlanSchema } from '../../lib/types';

const plan = ReadingPlanSchema.parse(
  JSON.parse(fs.readFileSync('content/plan/reading-plan.json', 'utf8')),
);

async function openVault(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
}

const scale = (page: Page) =>
  page.getByTestId('vault-scene').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

const listLinks = (page: Page) =>
  page
    .locator(
      'section[aria-label="The path, as a list"] ol a[data-book], section[aria-label="The path, as a list"] ol a[data-bridge]',
    )
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));

test.describe('the Vault', () => {
  test('the list view exposes the same links as the ceiling', async ({ page }) => {
    await openVault(page);
    const scene = await page
      .getByTestId('vault-scene')
      .locator('a[data-book]:not([data-offpath]), a[data-bridge]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const list = await listLinks(page);
    expect([...list].sort()).toEqual([...scene].sort());
    expect(list).toHaveLength(plan.books.length + plan.bridges.length);
    // The books outside the path (the library) appear in both, linking to their books.
    const offHrefs = (sel: string) =>
      page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('href')).sort());
    const off = await offHrefs('[data-testid="vault-scene"] a[data-offpath]');
    expect(off).toHaveLength(49);
    expect(await offHrefs('[data-offpath-item] a')).toEqual(off);
    // List mode shows it.
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('region', { name: 'The path, as a list' })).toBeVisible();
    await expect(page.getByTestId('vault-view')).toBeHidden();
    await page.getByRole('link', { name: 'Exodus' }).click();
    await page.waitForURL(/\/book\/Exod\/$/);
  });

  test('the path list follows the plan order, with bridges and the John 11 detour', async ({
    page,
  }) => {
    await openVault(page);
    const hrefs = await listLinks(page);
    const expected: string[] = [];
    for (const step of plan.steps) {
      if (step.kind === 'book') expected.push(`/book/${step.id}/`);
      if (step.kind === 'bridge') expected.push(`/bridge/${step.id}/`);
      if (step.kind === 'book' && step.id === 'Luke') expected.push('/book/John/');
    }
    expect(hrefs).toEqual(expected);
  });

  test('tapping a medallion flies in and opens the book; returning pulls back out', async ({
    page,
  }) => {
    await openVault(page);
    const before = await scale(page);
    await page.getByTestId('vault-scene').locator('a[data-book="Exod"]').click();
    // A closed book lifts out of the medallion and lands exactly on the book page's cover.
    const flying = page.getByTestId('flying-book');
    await expect(flying).toBeAttached();
    await page.waitForURL(/\/book\/Exod\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-book-map', 'Exod');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open', {
      timeout: 3000,
    });
    await page.getByRole('link', { name: '← All books' }).click();
    // The cover closes, then the closed book shrinks back into its medallion.
    await expect(flying).toBeAttached({ timeout: 3000 });
    await page.waitForURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 4000 });
    // The camera ends where it was before flying in.
    await expect.poll(() => scale(page), { timeout: 3000 }).toBeCloseTo(before, 2);
  });

  test('Genesis opens like a novel: the first page turns with the map, and turns back', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('vault-scene').locator('a[data-book="Gen"]').click();
    await page.waitForURL(/\/book\/Gen\/$/);
    // On a spread the half-title page turns over carrying a copy of the map's left half.
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      await expect(page.locator('[data-leaf-print]')).toBeAttached({ timeout: 3000 });
    }
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'open', {
      timeout: 4000,
    });
    // Once open, the copy is gone and the live map is whole and unique.
    await expect(page.locator('[data-leaf-print]')).toHaveCount(0);
    await expect(page.locator('[data-pages]')).toHaveCSS('clip-path', 'none');
    await expect(page.locator('[data-station="gen-01"]')).toHaveCount(1);
    await page.getByRole('link', { name: '← All books' }).click();
    await expect(page.locator('[data-book-frame]')).toHaveAttribute('data-state', 'closing');
    await expect(page.getByTestId('flying-book')).toBeAttached({ timeout: 4000 });
    await page.waitForURL(/\/$/);
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 4000 });
  });

  test('keyboard focus moves along the spiral and the camera follows', async ({ page }) => {
    await openVault(page);
    await page.locator('a[data-book="Gen"]').last().focus();
    await expect(page.getByTestId('vault-scene').locator('a[data-book="Gen"]')).toHaveClass(
      /focused/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(
      page.locator('section[aria-label="The path, as a list"] a[data-book="Job"]'),
    ).toBeFocused();
    await expect(page.getByTestId('vault-scene').locator('a[data-book="Job"]')).toHaveClass(
      /focused/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(
      page.locator('section[aria-label="The path, as a list"] a[data-book="Exod"]'),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/book\/Exod\/$/);
  });

  test('Continue names the reader’s place and opens it; the spark marks its book', async ({
    page,
  }) => {
    await openVault(page);
    // Nothing read yet: it offers the beginning.
    await expect(page.getByTestId('continue')).toContainText('Begin');
    await page.goto('/read/1sam-08/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', '1sam-08');
    await openVault(page);
    await expect(page.getByTestId('vault-scene').locator('a[data-book="1Sam"]')).toHaveClass(
      /current/,
    );
    const title = await page.evaluate(
      async () =>
        (
          (await (await fetch('/data/manifest.json')).json()) as {
            sections: { id: string; title: string }[];
          }
        ).sections.find((s) => s.id === '1sam-08')!.title,
    );
    await expect(page.getByTestId('continue')).toContainText(`Continue · ${title}`);
    await page.getByTestId('continue').click();
    await page.waitForURL(/\/read\/1sam-08\/$/);
  });

  test('in List mode the view switch changes which list is shown', async ({ page }) => {
    await openVault(page);
    await page.getByRole('button', { name: 'List' }).click();
    const genesis = page.locator('section[aria-label="The path, as a list"] a[data-book="Gen"]');
    await expect(genesis).toBeVisible();
    await page.getByTestId('view-themes').click();
    await expect(page.getByTestId('theme-tree')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
    await page.getByTestId('view-spiral').click();
    await expect(genesis).toBeVisible({ timeout: 6000 });
  });

  test('the Testaments switch shows the Old, the New or both, and is remembered', async ({
    page,
  }) => {
    await openVault(page);
    const ot = page.getByTestId('testament-ot');
    const nt = page.getByTestId('testament-nt');
    await expect(ot).toHaveAttribute('aria-pressed', 'true');
    await expect(nt).toHaveAttribute('aria-pressed', 'true');
    const gen = page.getByTestId('vault-scene').locator('a[data-book="Gen"]');
    const luke = page.getByTestId('vault-scene').locator('a[data-book="Luke"]');
    // Old off: only the New is shown, on the ceiling and in the list.
    await ot.click();
    await expect(ot).toHaveAttribute('aria-pressed', 'false');
    await expect(gen).toHaveCSS('opacity', '0');
    await expect(luke).not.toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: 'List' }).click();
    const list = page.locator('section[aria-label="The path, as a list"]');
    await expect(list.locator('a[data-book="Gen"]')).toBeHidden();
    await expect(list.locator('a[data-book="Luke"]')).toBeVisible();
    await expect(list.locator('[data-offpath-item="Rom"]')).toBeVisible();
    await expect(list.locator('[data-offpath-item="Isa"]')).toBeHidden();
    // Kept across visits.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await expect(page.getByTestId('testament-ot')).toHaveAttribute('aria-pressed', 'false');
    // The New off as well would leave nothing: it shows the Old instead; Old on again shows both.
    await page.getByTestId('testament-nt').click();
    await expect(page.getByTestId('testament-ot')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('testament-nt')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('testament-nt').click();
    await expect(page.getByTestId('testament-ot')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('testament-nt')).toHaveAttribute('aria-pressed', 'true');
  });

  test('with the Old Testament off, Themes and Threads keep only the New', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('testament-ot').click();
    await page.getByRole('button', { name: 'List' }).click();
    // Threads: only connections with both ends in the New Testament.
    await page.getByTestId('view-threads').click();
    await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
    const ot = ['Gen', 'Exod', 'Num', 'Deut', 'Isa', 'Ps', 'Job', 'Jer', 'Dan', '1Sam', '2Sam'];
    const arcs = await page
      .locator('[data-arc-item]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-arc-item')!));
    for (const key of arcs) for (const b of key.split('|')) expect(ot).not.toContain(b);
    // Themes: the tree lists no passage from an Old Testament book.
    await page.getByTestId('view-threads').click();
    await page.getByTestId('view-themes').click();
    await expect(page.getByTestId('theme-tree')).toBeVisible({ timeout: 6000 });
    const refs = await page
      .locator('[data-tree-passage]')
      .evaluateAll((els) => els.map((e) => e.textContent ?? ''));
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(r).not.toMatch(/^(Genesis|Exodus|Isaiah|Psalm|Job|Jeremiah) /);
  });

  test('zooming in reveals names (semantic zoom) and stays within limits', async ({ page }) => {
    await openVault(page);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 8; i++) await zoomIn.click();
    // Quick taps add up, to the medallion-detail limit and no further.
    await expect.poll(() => scale(page)).toBeCloseTo(2.6, 2);
    // Book names appear in the label layer (screen space, sharp at any zoom).
    await expect(page.locator('[data-testid="vault-labels"] [data-name]').first()).toBeVisible();
    // Wheel zoom works too.
    const before = await scale(page);
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => scale(page)).toBeLessThan(before);
  });

  test('books outside the path open their library book', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('vault-scene').locator('[data-offpath="Rev"]').click({ force: true });
    await page.waitForURL(/\/book\/Rev\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-book-map', /.+/);
    await expect(page.getByTestId('library-label')).toBeVisible();
    await expect(page.locator('#transition-layer > *')).toHaveCount(0, { timeout: 3000 });
  });

  test('stays under 300 interactive nodes at any zoom', async ({ page }) => {
    await openVault(page);
    const count = () =>
      page.locator('[data-testid="vault-view"] *, [data-testid="vault-label-frame"] *').count();
    expect(await count()).toBeLessThan(300);
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await count()).toBeLessThan(300);
  });

  test('reduced motion: no camera flight, straight to the book', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openVault(page);
    await page.getByTestId('vault-scene').locator('a[data-book="Ruth"]').click();
    await page.waitForURL(/\/book\/Ruth\/$/, { timeout: 2000 });
    await context.close();
  });

  test('works with storage blocked', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openVault(page);
    await expect(page.getByTestId('continue')).toContainText('Begin');
    await page.getByRole('button', { name: 'List' }).click();
    expect(errors).toEqual([]);
    await context.close();
  });

  for (const mode of ['map', 'list'] as const) {
    test(`no serious accessibility issues (${mode})`, async ({ page }) => {
      await openVault(page);
      if (mode === 'list') await page.getByRole('button', { name: 'List' }).click();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
      ).toEqual([]);
    });
  }
});
