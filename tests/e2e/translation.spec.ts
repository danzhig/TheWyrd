import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The second translation (Phase 7, P7.2): a reader switches a page between the WEBC and the
 * Douay-Rheims; the choice is kept; links, threads and folds keep working in both.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-reader', /.+/);
}

test.describe('Translation', () => {
  test('switches a page to the Douay-Rheims and back, and is remembered', async ({ page }) => {
    await open(page, '/read/luke-02/');
    const webc = page.getByTestId('translation-webc');
    const drc = page.getByTestId('translation-drc');
    await expect(webc).toHaveAttribute('aria-pressed', 'true');
    const before = await page.locator('article .prose').first().innerText();
    await drc.click();
    await expect(page.getByTestId('drc-body')).toBeVisible();
    await expect(page.getByTestId('drc-reference')).toContainText('Luke 1:');
    const after = await page.getByTestId('drc-body').locator('.prose').first().innerText();
    expect(after).not.toBe(before);
    // A thread still marks its verse (Luke 1:35 carries one), at the WEBC anchor.
    await expect(page.locator('[data-testid=drc-body] [data-thread="v-1-35"]')).toBeAttached();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-translation', 'drc');
    await expect(page.getByTestId('drc-body')).toBeVisible();
    expect(
      await new AxeBuilder({ page })
        .include('article')
        .analyze()
        .then((r) =>
          r.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => v.id),
        ),
    ).toEqual([]);
    await page.getByTestId('translation-webc').click();
    await expect(page.getByTestId('drc-body')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-translation', 'webc');
  });

  test('the Bible is chosen on the Vault, before any reading, and carried into it', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-vault', 'ready');
    const picker = page.getByTestId('vault-translation');
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('WEBC');
    await page.getByTestId('vault-translation-select').selectOption('drc');
    await expect(picker).toContainText('Douay-Rheims');
    await open(page, '/read/luke-02/');
    await expect(page.getByTestId('drc-body')).toBeVisible();
    await expect(page.getByTestId('reader-translation')).toContainText('DR');
    // Back on the Vault, its picker shows the choice.
    await page.goto('/');
    await expect(page.getByTestId('vault-translation')).toContainText('Douay-Rheims');
  });

  test('switches in the middle of a reading from the tab at the edge, keeping the place', async ({
    page,
  }) => {
    await open(page, '/read/gen-04/');
    const tab = page.getByTestId('reader-translation');
    // Read down to a verse well into the chapter.
    await page.locator('[id="v-7-11"]').evaluate((el) => {
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -120);
    });
    // The verse at the top of the screen (the first below the top bar): the one to keep in place.
    const id = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('article [id^="v-"]')].find(
          (el) => el.getBoundingClientRect().top >= 64,
        )!.id,
    );
    const verse = page.locator(`[id="${id}"]`);
    await expect(tab).toBeInViewport();
    const top = () => verse.evaluate((el) => el.getBoundingClientRect().top);
    const before = await top();
    await page.getByTestId('reader-translation-select').selectOption('drc');
    await expect(page.getByTestId('drc-body')).toBeVisible();
    // The verse that was in view stays where it was (within a line).
    await expect.poll(async () => Math.abs((await top()) - before)).toBeLessThan(40);
    await expect(tab).toBeInViewport();
    await page.getByTestId('reader-translation-select').selectOption('webc');
    await expect(page.getByTestId('drc-body')).toHaveCount(0);
    await expect.poll(async () => Math.abs((await top()) - before)).toBeLessThan(40);
  });

  test('keeps a section’s folds and verse links in the Douay-Rheims', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('sas:v1:settings', JSON.stringify({ translation: 'drc' })),
    );
    await open(page, '/read/dan-03/');
    await expect(page.getByTestId('drc-body')).toBeVisible();
    const folds = await page.locator('[data-testid=drc-body] [data-fold]').count();
    expect(folds).toBeGreaterThan(0);
    // A link to a WEBC verse still lands on its place.
    const first = page.locator('[data-testid=drc-body] [id^="v-"]').first();
    const id = await first.getAttribute('id');
    expect(id).toMatch(/^v-\d+-\d+/);
  });

  test('the choice is in the reading settings too', async ({ page }) => {
    await open(page, '/read/gen-01/');
    await page.getByRole('button', { name: 'Reading settings' }).click();
    await page.getByRole('radio', { name: 'Douay-Rheims' }).check();
    await expect(page.getByTestId('drc-body')).toBeVisible();
    await expect(page.getByTestId('translation-drc')).toHaveAttribute('aria-pressed', 'true');
  });
});
