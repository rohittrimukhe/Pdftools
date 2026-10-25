import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/open', '/recent', '/settings', '/about', '/privacy', '/licenses', '/tools/merge', '/tools/exact-size', '/tools/image-to-pdf', '/tools/resize-image', '/tools/resume-builder', '/tools/resume-score', '/tools/word-to-pdf', '/nope'];

test('the main navigation reaches every tab and marks the current one', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Recent', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recent' })).toBeVisible();
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Happy PDF' })).toBeVisible();
});

test('search narrows the tools and explains an empty result', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: /Search \d+ tools/ });
  await search.fill('50kb');
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toContainText('1 tool matches');
  await expect(page.getByRole('link', { name: /Exact-size studio/ })).toBeVisible();
  await search.fill('zebra');
  await expect(page.getByText('No tool matches that yet')).toBeVisible();
  await page.getByRole('button', { name: 'Show all tools' }).click();
  await expect(search).toHaveValue('');
});

test('a filter chip shows only that kind of tool', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Filter tools by kind' }).getByRole('button', { name: 'Secure' }).click();
  await expect(page.getByRole('link', { name: /Protect PDF/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Merge PDF/ })).toHaveCount(0);
});

test('a tool opens from Home and Back returns there', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Word to PDF/ }).click();
  await expect(page).toHaveURL(/\/tools\/word-to-pdf$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Word to PDF' })).toBeVisible();
  await expect(page.getByText('Coming soon')).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Back on a shared link goes to its parent screen', async ({ page }) => {
  await page.goto('/licenses');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('unknown addresses show a way home', async ({ page }) => {
  await page.goto('/tools/does-not-exist');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to Home' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Happy PDF' })).toBeVisible();
});

test('licenses list the libraries the app ships', async ({ page }) => {
  await page.goto('/licenses');
  await expect(page.getByText('react-dom', { exact: true })).toBeVisible();
  await expect(page.getByText('pdfjs-dist', { exact: true })).toBeVisible();
});

test('the theme setting changes the app', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen passes the accessibility scan and never scrolls sideways (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), route).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route).toBeLessThanOrEqual(0);
    }
  });
}
