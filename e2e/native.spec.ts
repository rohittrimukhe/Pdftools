import { expect, test, type Page } from '@playwright/test';
import { asFile, makePdf, openTool } from './fixtures';

/**
 * Stands in for the Tauri desktop shell: records the commands the app sends and
 * answers the Save dialog with `answer` (a path, or null for Cancel). Like the
 * real shell, the file bytes travel over the local ipc:// channel.
 */
async function fakeDesktop(page: Page, answer: string | null) {
  await page.addInitScript((saveAnswer) => {
    const calls: Array<{ cmd: string; args: unknown; bytes?: number }> = [];
    (window as unknown as { __calls: typeof calls }).__calls = calls;
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: unknown) => {
        if (args instanceof Uint8Array) {
          calls.push({ cmd, args: null, bytes: args.byteLength });
          await fetch(`ipc://localhost/${encodeURIComponent(cmd)}`, { method: 'POST', body: args as Uint8Array<ArrayBuffer> }).catch(() => undefined);
          return null;
        }
        calls.push({ cmd, args });
        return cmd === 'plugin:dialog|save' ? saveAnswer : null;
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
    };
  }, answer);
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: Array<{ cmd: string; args: any; bytes?: number }> }).__calls);

test('desktop app saves through the system Save dialog and still reports 0 bytes uploaded', async ({ page }) => {
  await fakeDesktop(page, '/home/me/Documents/report-watermarked.pdf');
  await openTool(page, 'watermark', [asFile('report.pdf', await makePdf(1))]);
  await page.getByRole('button', { name: 'Add watermark' }).click();
  const card = page.getByRole('region', { name: 'Your file is ready' });
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/^Saved .*\.pdf$/)).toBeVisible();

  const log = await calls(page);
  const dialog = log.find((c) => c.cmd === 'plugin:dialog|save');
  expect(dialog?.args.options.defaultPath).toMatch(/\.pdf$/);
  expect(dialog?.args.options.filters).toEqual([{ name: 'PDF', extensions: ['pdf'] }]);
  const write = log.find((c) => c.cmd === 'plugin:fs|write_file');
  expect(write?.bytes).toBeGreaterThan(500);
  await page.waitForTimeout(1500); // the badge re-measures every second
  await expect(card).toContainText('0 bytes uploaded');
});

test('desktop app does nothing when the Save dialog is cancelled', async ({ page }) => {
  await fakeDesktop(page, null);
  await openTool(page, 'watermark', [asFile('report.pdf', await makePdf(1))]);
  await page.getByRole('button', { name: 'Add watermark' }).click();
  await page.getByRole('region', { name: 'Your file is ready' }).getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await calls(page)).some((c) => c.cmd === 'plugin:dialog|save')).toBe(true);
  expect((await calls(page)).some((c) => c.cmd === 'plugin:fs|write_file')).toBe(false);
  await expect(page.getByText(/^Saved /)).toHaveCount(0);
});

test('native apps skip the website-only service worker', async ({ page }) => {
  await fakeDesktop(page, null);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations())?.length ?? 0)).toBe(0);
});
