import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { asFile, makePdf } from './fixtures';

const AD_SCRIPT = /pagead2\.googlesyndication\.com/;

test('the app ships with no ads and never contacts an ad network', async ({ page }) => {
  const adRequests: string[] = [];
  page.on('request', (r) => { if (AD_SCRIPT.test(r.url())) adRequests.push(r.url()); });
  for (const route of ['/', '/recent', '/settings', '/privacy']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toHaveCount(0);
  }
  await expect(page.getByText('Happy PDF currently shows no ads.')).toBeVisible();
  expect(adRequests).toEqual([]);
});

test.describe('with ads switched on', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  let base = '';
  let server: ChildProcess;

  test.beforeAll(async ({}, info) => {
    // Each project (phone, desktop) gets its own build and port, so parallel workers don't collide.
    const port = 4330 + info.parallelIndex;
    const outDir = `test-results/dist-ads-${info.project.name}`;
    base = `http://127.0.0.1:${port}`;
    const env = { ...process.env, VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456', VITE_ADSENSE_SLOT_HOME: '1111111111', VITE_ADSENSE_SLOT_RESULT: '2222222222' };
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { env, stdio: 'ignore' });
    server = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
    for (let i = 0; i < 150; i++) {
      try { if ((await fetch(base)).ok) return; } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('ads preview server did not start');
  });
  // Stop the whole process group: npx and the preview server it started.
  test.afterAll(() => { if (server?.pid) { try { process.kill(-server.pid); } catch { /* already gone */ } } });

  test.beforeEach(async ({ page }) => {
    // A stand-in for Google's script: it sends a beacon, as real ad code does.
    await page.route(AD_SCRIPT, (route) => route.fulfill({ contentType: 'text/javascript', body: "navigator.sendBeacon('https://pagead2.googlesyndication.com/pagead/ping', 'x'.repeat(4096));" }));
  });

  test('ads appear only on Home and under a finished file, labelled', async ({ page }) => {
    await page.goto(`${base}/`);
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toBeVisible();
    await page.goto(`${base}/recent`);
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toHaveCount(0); // no ad unit set for Recent

    await page.goto(`${base}/tools/watermark`);
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toHaveCount(0);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose file' }).click();
    await (await chooser).setFiles(asFile('a.pdf', await makePdf(1)));
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toHaveCount(0); // never while working
    await page.getByRole('button', { name: 'Add watermark' }).click();
    const card = page.getByRole('region', { name: 'Your file is ready' });
    await expect(card).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Advertisement' })).toBeVisible();
    // The ad script sent 4 KB, but none of it was your file: the badge stays honest.
    await page.waitForTimeout(1500);
    await expect(card.getByText('0 bytes uploaded')).toBeVisible();
  });

  test('settings and the privacy policy describe the ads', async ({ page }) => {
    await page.goto(`${base}/settings`);
    await expect(page.getByRole('switch', { name: 'Non-personalised ads only' })).toBeVisible();
    await page.goto(`${base}/privacy`);
    await expect(page.getByText(/some screens show ads from Google AdSense/)).toBeVisible();
    expect(await (await fetch(`${base}/ads.txt`)).text()).toContain('pub-1234567890123456, DIRECT');
  });
});
