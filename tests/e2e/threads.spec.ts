import { THREAD_FILES } from '../../lib/thread-files';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { PublicConnections } from '../../lib/types';

/**
 * Threads in the reader (PLAN §14, P4.2): a verse's glyph opens its cards; "Go there" opens the
 * other end with the way back; only verified connections appear (drafts stay hidden, check 13).
 */
// Every published file: the reader shows Old ↔ New and the threads inside each Testament.
const published = THREAD_FILES.flatMap((f) =>
  fs.existsSync(`public/data/${f}`)
    ? (JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8')) as PublicConnections).connections
    : [],
);
const content = [
  'connections.json',
  'within-ot.json',
  'within-nt.json',
  'library-ot-nt.json',
].flatMap((f) =>
  fs.existsSync(`content/connections/${f}`)
    ? (
        JSON.parse(fs.readFileSync(`content/connections/${f}`, 'utf8')) as {
          connections: { id: string; status: string }[];
        }
      ).connections
    : [],
);

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-reader', /.+/);
}

async function seriousViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('Threads', () => {
  test('only verified connections are on the site', () => {
    const verified = content.filter((c) => c.status === 'verified').map((c) => c.id);
    expect(published.map((c) => c.id).sort()).toEqual(verified.sort());
  });

  test('a draft shows no glyph and no card', async ({ page }) => {
    const draft = content.find((c) => c.status !== 'verified');
    test.skip(!draft, 'every connection is verified');
    const sections = fs
      .readdirSync('public/data/sections')
      .filter((f) => f.startsWith('luke-'))
      .slice(0, 3);
    for (const f of sections) {
      await open(page, `/read/${f.replace('.json', '')}/`);
      await expect(page.locator(`[data-thread-card="${draft!.id}"]`)).toHaveCount(0);
    }
  });

  test('the glyph opens the cards, Go there leads to the passage and back', async ({ page }) => {
    const c = published.find((x) => !x.ends[0].library && !x.ends[1].library) ?? published[0];
    test.skip(!c, 'no verified connections yet');
    const [here, there] = c!.ends;
    await open(page, `/read/${here.sectionId}/`);

    const glyph = page.locator(`a.thread-glyph[data-thread="${here.anchor}"]`);
    await expect(glyph).toHaveAttribute('href', `#threads-${here.anchor}`);
    // The list at the end of the section holds the same card (it works without JavaScript).
    await expect(
      page.locator(`[data-from="${here.anchor}"] [data-thread-card="${c!.id}"]`),
    ).toHaveCount(1);

    await glyph.click();
    const dialog = page.getByTestId('thread-dialog');
    await expect(dialog).toBeVisible();
    const card = dialog.locator(`[data-thread-card="${c!.id}"]`);
    await expect(card).toContainText(c!.label);
    await expect(card).toContainText(there.display);
    await expect(card).toContainText(there.excerpt.slice(0, 30));
    // Measure contrast once the dialog has finished fading in.
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    expect(await seriousViolations(page, '[data-testid="thread-dialog"]')).toEqual([]);

    // Escape closes it and gives focus back to the glyph.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(glyph).toBeFocused();

    await glyph.click();
    await card.locator('a[data-go-there]').click();
    await expect(page.locator('html')).toHaveAttribute('data-reader', there.sectionId);
    expect(page.url()).toContain(`?thread=${c!.id}#${there.anchor}`);
    await expect(page.locator(`#${there.anchor}`)).toBeVisible();
    const back = page.getByTestId('thread-back');
    await expect(back).toBeInViewport();
    await back.click();
    await expect(page.locator('html')).toHaveAttribute('data-reader', here.sectionId);
  });

  test('the card: direction older first, the summary, the rest on demand, links at the foot', async ({
    page,
  }) => {
    // Daniel 7:14 echoed in Luke 1:33, read from Luke (the later end).
    const c = published.find((x) => x.id === 'dan07') ?? published[0]!;
    const older = c.ends[c.order.older ?? 0]!;
    const later = c.ends[1 - (c.order.older ?? 0)]!;
    await open(page, `/read/${later.sectionId}/`);
    const card = page.locator(`[data-from="${later.anchor}"] [data-thread-card="${c.id}"]`);
    const refs = card.locator('[data-direction] [data-end]');
    await expect(refs).toHaveText([older.display, later.display]);
    await expect(card.locator('[data-summary]')).toBeVisible();
    const more = card.locator('[data-more]');
    await expect(more).not.toHaveAttribute('open', '');
    const excerpt = card.locator('blockquote').first();
    await expect(excerpt).toBeHidden();
    await more.locator('summary').click();
    await expect(more).toHaveAttribute('open', '');
    await expect(excerpt).toBeVisible();
    await more.locator('summary').click();
    await expect(excerpt).toBeHidden();
    // The end on this page is named here; the other is a link along the thread.
    await expect(card.locator('a[data-go-there]')).toHaveText(`Read ${older.display}`);
    await expect(card.locator('a[data-go-there]')).toHaveAttribute(
      'href',
      `/read/${older.sectionId}/?thread=${c.id}#${older.anchor}`,
    );
  });

  test('the list groups threads by direction; the glyph counts and lands on its verse', async ({
    page,
  }) => {
    // Luke 1 (Two Annunciations): everything it takes up is older; parallels claim no use.
    await open(page, '/read/luke-02/');
    const list = page.getByTestId('threads');
    const mine = published.filter((x) => x.ends.some((e) => e.sectionId === 'luke-02'));
    const groupOf = (x: (typeof mine)[number]) => {
      const here = x.ends.findIndex((e) => e.sectionId === 'luke-02');
      if (x.order.older === null || !x.order.uses) return 'alongside';
      return x.order.older === here ? 'takenUpIn' : 'drawsOn';
    };
    for (const g of ['drawsOn', 'takenUpIn', 'alongside'] as const) {
      const n = mine.filter((x) => groupOf(x) === g).length;
      const group = list.locator(`[data-thread-group="${g}"]`);
      if (g === 'alongside' && !n) await expect(group).toHaveCount(0);
      else await expect(group.locator('[data-thread-card]')).toHaveCount(n);
    }
    // An empty group says so.
    await expect(list.locator('[data-thread-group="takenUpIn"]')).toContainText('No thread yet');
    // A verse with more than one thread shows the count; its link lands on its first card.
    const counts = new Map<string, number>();
    for (const x of mine) {
      const e = x.ends.find((y) => y.sectionId === 'luke-02')!;
      counts.set(e.anchor, (counts.get(e.anchor) ?? 0) + 1);
    }
    const busy = [...counts].find(([, n]) => n > 1);
    if (busy) {
      const glyph = page.locator(`a.thread-glyph[data-thread="${busy[0]}"]`);
      await expect(glyph.locator('.thread-count')).toHaveText(String(busy[1]));
      await expect(page.locator(`#threads-${busy[0]}`)).toHaveAttribute('data-from', busy[0]);
      // The dialog groups the same way.
      await glyph.click();
      await expect(
        page.getByTestId('thread-dialog').locator('[data-dialog-group]').first(),
      ).toBeVisible();
    }
  });

  test('the heaviest reading stays a reasonable size', async ({ request }) => {
    // Threads are rendered into each page; the busiest sections must stay light (threads plan §6).
    const per = new Map<string, number>();
    for (const x of published)
      for (const e of x.ends) per.set(e.sectionId, (per.get(e.sectionId) ?? 0) + 1);
    const [heaviest] = [...per].sort((a, b) => b[1] - a[1])[0]!;
    const html = await (await request.get(`/read/${heaviest}/`)).text();
    expect(html.length).toBeLessThan(300_000);
  });

  test('a section with threads is accessible', async ({ page }) => {
    const c = published[0];
    test.skip(!c, 'no verified connections yet');
    await open(page, `/read/${c!.ends[1].sectionId}/`);
    await expect(page.getByTestId('threads')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('a passage reached inside a closed fold is opened', async ({ page }) => {
    // A connection into a part of John the path skips (the whole section is folded).
    const c = published.find((x) => x.ends.some((e) => /^john-x\d/.test(e.sectionId)));
    test.skip(!c, 'no verified connection into a folded section');
    const end = c!.ends.find((e) => /^john-x\d/.test(e.sectionId))!;
    await open(page, `/read/${end.sectionId}/?thread=${c!.id}#${end.anchor}`);
    await expect(page.locator(`#${end.anchor}`)).toBeVisible();
  });
});
