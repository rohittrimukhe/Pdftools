import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('design system', () => {
  test('has no automatically detectable accessibility problems in light or dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/design');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`), scheme).toEqual([]);
    }
  });

  test('the theme choice applies and survives a reload', async ({ page }) => {
    await page.goto('/design');
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('a sheet opens, confirms and reports with a toast', async ({ page }) => {
    await page.goto('/design');
    await page.getByRole('button', { name: 'Open a sheet' }).click();
    const sheet = page.getByRole('dialog', { name: 'Remove 3 files?' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('status')).toContainText('Removed 3 files');
  });

  test('Escape closes a sheet without acting', async ({ page }) => {
    await page.goto('/design');
    await page.getByRole('button', { name: 'Open a sheet' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('status')).not.toContainText('Removed');
  });

  test('the switch toggles from the keyboard', async ({ page }) => {
    await page.goto('/design');
    const toggle = page.getByRole('switch', { name: 'Keep finished files on this device' });
    await expect(toggle).toBeChecked();
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
  });

  test('the page never scrolls sideways', async ({ page }) => {
    await page.goto('/design');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
