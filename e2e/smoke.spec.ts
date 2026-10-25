import { expect, test } from '@playwright/test';

test('the app opens and states its promise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Happy PDF' })).toBeVisible();
  await expect(page.getByText('nothing is uploaded', { exact: false })).toBeVisible();
});

test('opening the app talks to no other website', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin && url.protocol !== 'data:' && url.protocol !== 'blob:') foreign.push(request.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});
