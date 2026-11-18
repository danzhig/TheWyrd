import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Themes view (PLAN §16, P6.3). The switch is an active flight both ways (owner,
 * 2026-11-12): stars are sampled mid-flight and must be between their book's medallion and their
 * constellation, never jumping. The stars are canvas pixels, so the page exposes their positions
 * (`window.__sasStars`).
 */
type Sample = {
  p: number;
  fade: boolean;
  stars: {
    home: { x: number; y: number };
    end: { x: number; y: number };
    now: { x: number; y: number };
  }[];
} | null;

const sample = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sasStars: () => Sample }).__sasStars());

async function openVault(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
}

/** Wait until the flight is between `lo` and `hi`, then report how many stars are on their way. */
async function midFlight(page: Page, lo: number, hi: number) {
  let s: Sample = null;
  await expect
    .poll(
      async () => {
        s = await sample(page);
        return !!s && s.p > lo && s.p < hi;
      },
      { intervals: [16], timeout: 5000 },
    )
    .toBe(true);
  const stars = s!.stars;
  const between = stars.filter(
    (t) =>
      Math.hypot(t.now.x - t.home.x, t.now.y - t.home.y) > 1 &&
      Math.hypot(t.now.x - t.end.x, t.now.y - t.end.y) > 1,
  );
  return between.length / stars.length;
}

/** Wait until the camera stops moving (the scene's transform holds still). */
async function cameraAtRest(page: Page) {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = await page
          .getByTestId('vault-scene')
          .evaluate((el) => getComputedStyle(el).transform);
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [300], timeout: 6000 },
    )
    .toBe(true);
}

test.describe('themes', () => {
  test('switching flies every star from its book to its constellation, and back', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'to-themes');
    // Mid-flight the spiral is still there, fading, and the stars are on their way.
    expect(await midFlight(page, 0.45, 0.55)).toBeGreaterThan(0.9);
    await expect(page.getByTestId('spiral-layer')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 5000,
    });
    await expect(page.getByTestId('spiral-layer')).toHaveCount(0);
    const data = (await (await page.request.get('/data/themes.json')).json()) as {
      themes: unknown[];
    };
    await expect(page.locator('[data-constellation]')).toHaveCount(data.themes.length);
    expect((await sample(page))!.p).toBe(1);

    await page.getByTestId('view-spiral').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'to-spiral');
    expect(await midFlight(page, 0.45, 0.55)).toBeGreaterThan(0.9);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'spiral', {
      timeout: 5000,
    });
    await expect(page.getByTestId('themes-layer')).toHaveCount(0);
    await expect(page.locator('[data-testid="vault-scene"] a[data-book]').first()).toBeVisible();
    expect((await sample(page))!.p).toBe(0);
  });

  test('nothing flashes back when a flight lands, either way', async ({ page }) => {
    await openVault(page);
    // Watch every frame: once the stars are almost in, the layer they left must stay invisible
    // (the spiral after the flight out, the constellations' names after the flight home).
    // A resize observer runs after the frame's callbacks and layout, just before paint, so it
    // sees exactly what is about to be painted.
    const watch = (leaving: 'spiral-layer' | 'themes-layer', settled: string) =>
      page.evaluate(
        ([leaving, settled]) =>
          new Promise<number>((resolve) => {
            let worst = 0;
            let after = -1;
            const probe = document.createElement('div');
            probe.style.cssText =
              'position:fixed;left:0;top:0;height:1px;width:1px;pointer-events:none';
            document.body.append(probe);
            const sample = () => {
              const s = (
                window as unknown as { __sasStars: () => { p: number } | null }
              ).__sasStars();
              const near = !!s && (leaving === 'spiral-layer' ? s.p > 0.9 : s.p < 0.1);
              const layer = document.querySelector<HTMLElement>(`[data-testid="${leaving}"]`);
              if ((near || after >= 0) && layer) {
                const kids = [
                  ...layer.querySelectorAll<HTMLElement>('[data-book], [data-constellation]'),
                ].slice(0, 40);
                const child = kids.length
                  ? Math.max(...kids.map((k) => Number(getComputedStyle(k).opacity)))
                  : 1;
                worst = Math.max(worst, Number(getComputedStyle(layer).opacity) * child);
              }
            };
            const ro = new ResizeObserver(sample);
            ro.observe(probe);
            const tick = () => {
              probe.style.width = probe.style.width === '1px' ? '2px' : '1px';
              if (document.documentElement.dataset.vaultView === settled && after < 0) after = 0;
              if (after >= 0 && ++after > 10) {
                ro.disconnect();
                probe.remove();
                resolve(worst);
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        [leaving, settled] as const,
      );
    const out = watch('spiral-layer', 'themes');
    await page.getByTestId('view-themes').click();
    expect(await out).toBeLessThan(0.05);
    const home = watch('themes-layer', 'spiral');
    await page.getByTestId('view-spiral').click();
    expect(await home).toBeLessThan(0.05);
  });

  test('a sub-theme opens to every reading, spread out and legible; a reading opens the reader', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    // The fullest sub-theme (owner, 2026-11-17: one star per reading, all of them readable).
    const data = (await (await page.request.get('/data/themes.json')).json()) as {
      themes: { id: string; subthemes: { id: string; readings: unknown[] }[] }[];
    };
    const [theme, sub] = data.themes
      .flatMap((t) => t.subthemes.map((s) => [t, s] as const))
      .sort((a, b) => b[1].readings.length - a[1].readings.length)[0]!;
    await page.locator(`[data-constellation="${theme.id}"]`).click({ force: true });
    const name = page.locator(`[data-subtheme="${sub.id}"]`);
    await expect(name).toBeAttached({ timeout: 6000 });
    await expect(name).toContainText(String(sub.readings.length));
    await name.dispatchEvent('click');
    await expect(page.getByTestId('spread-head')).toContainText(`${sub.readings.length} readings`);
    const readings = page.locator(`[data-reading^="${sub.id}:"]`);
    await expect(readings).toHaveCount(sub.readings.length, { timeout: 6000 });
    expect(
      await page
        .locator('[data-testid="vault-view"] *, [data-testid="vault-label-frame"] *')
        .count(),
    ).toBeLessThan(300);
    // No two names overlap, and each is at least 12 px tall on screen.
    const boxes = await readings.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    for (const [i, a] of boxes.entries()) {
      expect(a.h).toBeGreaterThanOrEqual(12);
      for (const b of boxes.slice(i + 1))
        expect(
          a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1,
        ).toBe(false);
    }
    // The first row is on screen.
    await expect(readings.first()).toBeInViewport();

    const first = readings.first();
    const href = (await first.getAttribute('href'))!;
    expect(href).toMatch(
      new RegExp(`^/read/[^/]+/\\?theme=${sub.id}(&key=[\\w.-]+)?(#v-\\d+-\\d+)?$`),
    );
    await first.dispatchEvent('click');
    const section = href.split('/')[2]!;
    await page.waitForURL(new RegExp(`/read/${section}/`));
    await expect(page.locator('html')).toHaveAttribute('data-reader', section);
    // Back on the Vault, it is still showing the themes.
    await page.goBack();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
  });

  test('back and Esc close an open sub-theme', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    await page.locator('[data-constellation="mercy"]').click({ force: true });
    const name = page.locator('[data-subtheme="mercy-grace"]');
    await expect(name).toBeAttached({ timeout: 6000 });
    await name.dispatchEvent('click');
    await expect(page.locator('[data-reading^="mercy-grace:"]').first()).toBeAttached();
    await page.getByTestId('spread-back').click();
    await expect(page.locator('[data-reading]')).toHaveCount(0);
    await expect(page.getByTestId('spread-back')).toHaveCount(0);
    await name.dispatchEvent('click');
    await expect(page.locator('[data-reading^="mercy-grace:"]').first()).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-reading]')).toHaveCount(0);
  });

  test('the whole ring first; one zoom shows every sub-theme name; a tap flies in; counts follow the testaments', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    await cameraAtRest(page);
    // Zoomed out over the whole ring: every constellation's name on screen, no sub-theme names.
    for (const name of await page.locator('[data-constellation]').all())
      await expect(name).toBeInViewport();
    await expect(page.locator('[data-subtheme]')).toHaveCount(0);
    // A tap on the sky by a constellation (not on its name) flies into it; at that zoom every
    // constellation's sub-theme names show, not only the large ones'.
    const view = page.viewportSize()!;
    const p = await page.evaluate(() => {
      const el = document.querySelector('[data-constellation="mercy"]')!.getBoundingClientRect();
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    });
    const centre = { x: view.width / 2, y: view.height / 2 };
    // From the name, step toward the oculus onto the constellation's stars.
    const t = 0.18;
    await page.mouse.click(p.x + (centre.x - p.x) * t, p.y + (centre.y - p.y) * t);
    await expect(page.locator('[data-subtheme="mercy-mercy"]')).toBeAttached({ timeout: 4000 });
    const data = (await (await page.request.get('/data/themes.json')).json()) as {
      themes: { subthemes: unknown[] }[];
    };
    await expect(page.locator('[data-subtheme]')).toHaveCount(
      data.themes.reduce((n, t) => n + t.subthemes.length, 0),
    );
    // The counts beside the names follow the Old / New switch.
    const count = () => page.locator('[data-subtheme="mercy-mercy"] span').innerText();
    const both = Number(await count());
    await page.getByTestId('testament-ot').click();
    await expect.poll(async () => Number(await count())).toBeLessThan(both);
    const nt = Number(await count());
    await page.getByTestId('testament-ot').click();
    await page.getByTestId('testament-nt').click();
    await expect.poll(async () => Number(await count())).toBe(both - nt);
    await page.getByTestId('testament-nt').click();
    await expect.poll(async () => Number(await count())).toBe(both);
  });

  test('Esc steps out one level at a time: readings, sub-theme, constellation, the whole map', async ({
    page,
  }) => {
    await openVault(page);
    // The camera's zoom as it is now (the scene's transform), even mid-flight.
    const k = () =>
      page
        .getByTestId('vault-scene')
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    // The camera settles on the whole map.
    let last = -1;
    await expect
      .poll(
        async () => {
          const now = await k();
          const still = Math.abs(now - last) < 1e-6;
          last = now;
          return still;
        },
        { intervals: [400], timeout: 5000 },
      )
      .toBe(true);
    const whole = last;
    await page.locator('[data-constellation="story"]').click({ force: true });
    const name = page.locator('[data-subtheme="story-land"]');
    await expect(name).toBeAttached({ timeout: 6000 });
    await page.waitForTimeout(900);
    const constellation = await k();
    await name.dispatchEvent('click');
    await expect(page.locator('[data-reading^="story-land:"]').first()).toBeAttached();
    await page.waitForTimeout(900);
    const readings = await k();

    // 1. The readings close: the sub-theme, its stars gathered again, nearer than the constellation.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-reading]')).toHaveCount(0);
    await page.waitForTimeout(900);
    const sub = await k();
    expect(sub).toBeLessThanOrEqual(readings + 0.01);
    // 2. Out to the constellation.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await expect
      .poll(async () => Math.abs((await k()) - constellation) / constellation, { timeout: 4000 })
      .toBeLessThan(0.1);
    // 3. Out to the whole map.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await expect
      .poll(async () => Math.abs((await k()) - whole) / whole, { timeout: 4000 })
      .toBeLessThan(0.1);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
  });

  test('the reader’s back arrow returns to the sub-theme, in a visit and on a fresh load', async ({
    page,
  }) => {
    // In a visit: open a reading from Mercy, then go up — back in Themes, Mercy open.
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    await page.locator('[data-constellation="mercy"]').click({ force: true });
    await page.locator('[data-subtheme="mercy-mercy"]').dispatchEvent('click');
    const passages = page.locator('[data-reading^="mercy-mercy:"]');
    await expect(passages.first()).toBeAttached({ timeout: 6000 });
    const href = (await passages.first().getAttribute('href'))!;
    const section = href.split('/')[2]!;
    await passages.first().dispatchEvent('click');
    await expect(page.locator('html')).toHaveAttribute('data-reader', section);
    await page.locator('a[aria-label="Back to the theme"]').click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes');
    await expect(passages.first()).toBeAttached({ timeout: 6000 });

    // A fresh load of a passage opened from a theme: Esc goes to the Vault, which switches to
    // Themes and opens that sub-theme.
    await page.goto(`/read/${section}/?theme=mercy-forgiveness`);
    await expect(page.locator('html')).toHaveAttribute('data-reader', section);
    await page.keyboard.press('Escape');
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 8000,
    });
    await expect(page.locator('[data-reading^="mercy-forgiveness:"]').first()).toBeAttached({
      timeout: 6000,
    });
    expect(new URL(page.url()).search).toBe('');
  });

  test('the theme tree has a link for every star, arrow keys move along it and the camera follows', async ({
    page,
  }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    // Every star has a matching tree link (PLAN P6.4).
    const stars = await page.evaluate(() =>
      (window as unknown as { __sasStars: () => { stars: { key: string }[] } })
        .__sasStars()
        .stars.map((s) => s.key),
    );
    const links = await page
      .locator('[data-tree-passage]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-tree-passage')!));
    expect([...links].sort()).toEqual([...stars].sort());
    // In Themes the tree replaces the path's list as the accessible structure.
    await expect(page.getByRole('region', { name: 'The path, as a list' })).toHaveCount(0);
    // Focus moves along the tree with the arrow keys, and the camera flies to each star.
    const scale = () =>
      page
        .getByTestId('vault-scene')
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const before = await scale();
    const first = page.locator('[data-tree-passage]').first();
    await first.focus();
    await expect.poll(scale).toBeGreaterThan(before);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-tree-passage]').nth(1)).toBeFocused();
    // List shows the tree; no serious accessibility issues.
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByTestId('theme-tree')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });

  test('the reader lists a passage’s themes, and the breadcrumb leads back to the one it came from', async ({
    page,
  }) => {
    await page.goto('/read/gen-14/?theme=mercy-forgiveness');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-14');
    await expect(page.getByTestId('theme-breadcrumb')).toContainText('Mercy and forgiveness');
    // The way back also stays in view wherever the passage is scrolled to.
    await expect(page.getByTestId('theme-back')).toBeInViewport();
    await expect(page.getByTestId('theme-back')).toHaveAttribute(
      'href',
      '/?theme=mercy-forgiveness',
    );
    const themeLinks = page.getByTestId('section-themes').locator('a[data-theme-link]');
    expect(await themeLinks.count()).toBeGreaterThan(0);
    await expect(page.locator('a[data-theme-link="mercy-forgiveness"]')).toHaveAttribute(
      'href',
      '/?theme=mercy-forgiveness',
    );
    // Without ?theme there is no breadcrumb, but the Themes line stays.
    await page.goto('/read/gen-14/');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-14');
    await expect(page.getByTestId('theme-breadcrumb')).toHaveCount(0);
    // A Themes link opens the Vault in Themes at that sub-theme.
    await page.locator('a[data-theme-link="mercy-forgiveness"]').click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 8000,
    });
    await expect(page.locator('[data-reading^="mercy-forgiveness:"]').first()).toBeAttached({
      timeout: 6000,
    });
    // The breadcrumb's link is the same way back.
    await page.goto('/read/gen-14/?theme=mercy-forgiveness');
    await expect(page.locator('html')).toHaveAttribute('data-reader', 'gen-14');
    await page.getByTestId('breadcrumb-subtheme').click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 8000,
    });
  });

  test('the wheel zooms over a sub-theme or a reading’s name as over the open sky', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'a mouse wheel');
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    await page.locator('[data-constellation="mercy"]').click({ force: true });
    const sub = page.locator('[data-subtheme^="mercy-"]').first();
    await expect(sub).toBeAttached({ timeout: 6000 });
    await page.waitForTimeout(900); // the flight to the constellation lands
    const k = () =>
      page.evaluate(() =>
        Number(
          getComputedStyle(
            document.querySelector('[data-testid="vault-labels"]')!,
          ).getPropertyValue('--k'),
        ),
      );
    const wheelOver = async (target: typeof sub) => {
      const before = await k();
      const box = (await target.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, before > 3 ? 300 : -300);
      await expect.poll(k, { timeout: 3000 }).not.toBe(before);
    };
    await wheelOver(sub);
    // Over a reading's name in an open sub-theme.
    await page.waitForTimeout(600);
    await page.locator('[data-subtheme="mercy-mercy"]').dispatchEvent('click');
    const reading = page.locator('[data-reading^="mercy-mercy:"]').first();
    await expect(reading).toBeAttached();
    await page.waitForTimeout(700);
    await wheelOver(reading);
  });

  test('reduced motion cross-fades instead of flying', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await openVault(page);
    await page.getByTestId('view-themes').click();
    let s: Sample = null;
    await expect
      .poll(async () => (s = await sample(page)) && s.p > 0, { intervals: [16], timeout: 3000 })
      .toBe(true);
    expect(s!.fade).toBe(true);
    for (const t of s!.stars) expect(t.now).toEqual(t.end);
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 1500,
    });
    await context.close();
  });

  test('no serious accessibility issues in the Themes view', async ({ page }) => {
    await openVault(page);
    await page.getByTestId('view-themes').click();
    await expect(page.locator('html')).toHaveAttribute('data-vault-view', 'themes', {
      timeout: 6000,
    });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
});
