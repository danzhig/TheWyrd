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

  test('keeps a section’s folds and verse links in the Douay-Rheims', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('sas:v1:settings', JSON.stringify({ translation: 'drc' })),
    );
    await open(page, '/read/dan-03/');
    await expect(page.getByTestId('drc-body')).toBeVisible();
    const folds = await page.locator('[data-testid=drc-body] details[data-fold]').count();
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
