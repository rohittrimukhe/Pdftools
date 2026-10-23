import { expect, test } from '@playwright/test';
import { asFile, makePdf, saveResult, texts } from './fixtures';

test('after one visit, the app and its tools work with no internet', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // the service worker now controls the page
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto('/tools/merge');
  await expect(page.getByRole('heading', { level: 1, name: 'Merge PDF' })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files' }).click();
  await (await chooser).setFiles([asFile('a.pdf', await makePdf(1, { label: 'A' })), asFile('b.pdf', await makePdf(1, { label: 'B' }))]);
  await page.getByRole('button', { name: 'Merge 2 PDFs' }).click();
  const out = await saveResult(page);
  expect(await texts(out.bytes)).toEqual(['A 1', 'B 1']);
  await context.setOffline(false);
});

test('each tool has its own pre-rendered page for search engines', async ({ request }) => {
  const html = await (await request.get('/tools/compress/')).text();
  expect(html).toContain('<title>Compress PDF: free, private, nothing uploaded · Happy PDF</title>');
  expect(html).toContain('rel="canonical"');
  expect(html).not.toContain('noindex');
  expect(await (await request.get('/tools/word-to-pdf/')).text()).toContain('<meta name="robots" content="noindex" />');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/tools/merge/</loc>');
  expect(sitemap).not.toContain('word-to-pdf');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Happy PDF', display: 'standalone' });
});

test('the browser tab names the screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Split PDF/ }).first().click();
  await expect(page).toHaveTitle('Split PDF: free, private, nothing uploaded · Happy PDF');
});
