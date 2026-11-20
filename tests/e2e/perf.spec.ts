import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

/**
 * PLAN §11 M5: camera transitions run at 60 fps in a performance trace on a throttled mobile
 * profile (phone viewport, CPU slowed 4×). Runs in its own Playwright project after all other
 * tests, so no other browser competes for the CPU while frames are timed.
 */
test.describe('performance', () => {
  // One at a time: frame timing and paint timing must not compete for the CPU.
  test.describe.configure({ mode: 'serial' });

  test('camera moves hold 60 fps on a throttled mobile profile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.waitForTimeout(500);
    judge(await timeFlights(page));
  });

  // PLAN §14 P4.3: with Threads' arcs drawn over the spiral, the camera still holds 60 fps.
  // The arcs are a few joined paths (TX7), so the scene stays small however many there are.
  test('camera moves hold 60 fps with Threads on, on a throttled mobile profile', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.getByTestId('view-threads').click();
    await expect(page.locator('html')).toHaveAttribute('data-threads', 'ready');
    // The heaviest ceiling (TX7): every corpus pair switched on, not only the default Old ↔ New.
    const tab = page.getByTestId('thread-filter-tab');
    if (await tab.isVisible()) await tab.click();
    for (const pair of await page
      .locator('[data-pair-chip][aria-pressed="false"]')
      .evaluateAll((cs) => cs.map((c) => (c as HTMLElement).dataset.pairChip!)))
      await page.locator(`[data-pair-chip="${pair}"]`).click();
    await expect(page.locator('[data-pair-chip][aria-pressed="false"]')).toHaveCount(0);
    if (await tab.isVisible()) await tab.click();
    await page.waitForTimeout(1200); // the arcs have faded in
    judge(await timeFlights(page));
  });

  // PLAN §16 P6.3: the Spiral ⇄ Themes flight holds 60 fps both ways on the same profile: the
  // median frame. Owner, 2026-11-17: with a star for every reading in each of its sub-themes
  // (1,406) drawn as round dots in flight, some frames may run long (under 35% here, raised from
  // 30% by the owner on 2026-11-18 after the brighter sky and the zoomed-out Themes view; on a 4×
  // slowed CPU with a software canvas); the flight looked right to the owner on a real device.
  test('the Spiral ⇄ Themes flight holds 60 fps on a throttled mobile profile', async ({
    page,
  }) => {
    // Two round trips of 3.4 s flights at 4× slowdown, the first one unmeasured.
    test.setTimeout(90_000);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const frames: number[] = [];
    // A first round trip warms up (the themes' data and the star field's code load on the first
    // switch); the second is measured.
    for (const [to, measured] of [
      ['themes', false],
      ['spiral', false],
      ['themes', true],
      ['spiral', true],
    ] as const) {
      const flight = await page.evaluate(async (to) => {
        const ts: number[] = [];
        let on = true;
        const tick = (t: number) => {
          ts.push(t);
          if (on) requestAnimationFrame(tick);
        };
        document.querySelector<HTMLButtonElement>(`[data-testid=view-${to}]`)!.click();
        // Time the flight itself, from the moment the stars start moving.
        await new Promise<void>((r) => {
          const wait = () =>
            document.documentElement.dataset.vaultView === `to-${to}` ? r() : setTimeout(wait, 5);
          wait();
        });
        requestAnimationFrame(tick);
        await new Promise<void>((r) => {
          const wait = () =>
            document.documentElement.dataset.vaultView === to ? r() : setTimeout(wait, 20);
          wait();
        });
        on = false;
        return ts.slice(1).map((t, i) => t - ts[i]!);
      }, to);
      if (measured) frames.push(...flight);
      await page.waitForTimeout(300);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = [...frames].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const long = frames.filter((f) => f > 25).length;
    test.info().annotations.push({
      type: 'frames',
      description: `n=${frames.length} median=${median.toFixed(1)}ms long=${long}`,
    });
    expect(frames.length).toBeGreaterThan(100);
    expect(median).toBeLessThan(17.5);
    expect(long / frames.length).toBeLessThan(0.35);
  });

  // PLAN §12: Largest Contentful Paint under 2.5 s on a throttled mobile profile.
  for (const path of ['/', '/book/Gen/', '/read/gen-01/']) {
    test(`LCP on ${path} is under 2.5 s on a throttled phone`, async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      // Slow 4G, as Lighthouse's mobile profile: 150 ms round trip, 1.6 Mbps down.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await page.goto(path, { waitUntil: 'load' });
      const lcp = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let last = 0;
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) last = e.startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => resolve(last), 1500);
          }),
      );
      console.log(`LCP ${path}: ${Math.round(lcp)} ms`);
      expect(lcp).toBeGreaterThan(0);
      expect(lcp).toBeLessThan(2500);
    });
  }

  // PLAN §12: initial JavaScript on `/` (the scripts its HTML loads) under 160 KB gzipped (raised
  // from 150 KB by the owner, 2026-11-17, as the whole Bible's names and pickers joined the Vault).
  test('initial JavaScript on / is under 160 KB gzipped', () => {
    const html = fs.readFileSync('out/index.html', 'utf8');
    const srcs = [
      ...new Set(
        [...html.matchAll(/<script(?![^>]*noModule)[^>]+src="([^"]+)"/g)].map((m) => m[1]!),
      ),
    ];
    const kb = srcs.reduce((n, src) => n + gzipSync(fs.readFileSync(`out${src}`)).length, 0) / 1024;
    console.log(`initial JS on /: ${kb.toFixed(1)} KB gzipped`);
    expect(kb).toBeLessThan(160);
  });
});

/**
 * Frame times (ms) of camera flights at 4× CPU slowdown: one unmeasured warm-up flight (first-run
 * costs: code paths, layer creation), then a flight to each book in turn, each timed over its own
 * window. Several flights judged together keep one stray long frame from deciding the result,
 * while a camera that really drops frames still fails (owner, 2026-11-17).
 */
async function timeFlights(page: Page, books = ['1Sam', 'Jer', 'Luke', 'Gen']): Promise<number[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const fly = (book: string) =>
    page.evaluate(async (book) => {
      const ts: number[] = [];
      let on = true;
      const tick = (t: number) => {
        ts.push(t);
        if (on) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // Focusing a book in the (hidden) list flies the camera to it.
      document
        .querySelector<HTMLAnchorElement>(
          `section[aria-label="The path, as a list"] a[data-book="${book}"]`,
        )!
        .focus();
      await new Promise((r) => setTimeout(r, 900));
      on = false;
      return ts.slice(1).map((t, i) => t - ts[i]!);
    }, book);
  await fly('Exod'); // warm-up, not counted
  await page.waitForTimeout(300);
  const frames: number[] = [];
  for (const b of books) {
    frames.push(...(await fly(b)));
    await page.waitForTimeout(300); // let the camera settle between flights
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return frames;
}

/** 60 fps: the median frame under 17.5 ms, and under 5% of frames longer than 25 ms. */
function judge(frames: number[]) {
  const sorted = [...frames].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1]!;
  const long = frames.filter((f) => f > 25).length;
  test.info().annotations.push({
    type: 'frames',
    description: `n=${frames.length} median=${median.toFixed(1)}ms long=${long}`,
  });
  expect(frames.length).toBeGreaterThan(150);
  expect(median).toBeLessThan(17.5);
  expect(long / frames.length).toBeLessThan(0.05);
}
