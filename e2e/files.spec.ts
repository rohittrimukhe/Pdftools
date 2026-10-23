import { expect, test, type Page } from '@playwright/test';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

async function chooseOnHome(page: Page, files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files' }).click();
  await (await chooser).setFiles(files);
  await expect(page).toHaveURL(/\/open$/);
}

test('Smart Drop recognises files by content and suggests tools', async ({ page }) => {
  await chooseOnHome(page, [
    { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: PDF },
    { name: 'renamed-photo.pdf', mimeType: 'application/pdf', buffer: PNG },
  ]);
  const files = page.getByRole('list', { name: 'Opened files' });
  await expect(files.getByRole('listitem')).toHaveCount(2);
  await expect(files).toContainText('invoice.pdf');
  await expect(files).toContainText('PDF ·');
  await expect(files).toContainText('Image ·');
  await expect(page.getByText('0 bytes uploaded')).toBeVisible();
  // A PDF and an image together: merging them is the first suggestion.
  await expect(page.getByRole('button', { name: /Merge PDF/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Compress PDF/ }).click();
  await expect(page).toHaveURL(/\/tools\/compress$/);
});

test('dropping a file anywhere opens it', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'dropped.pdf', { type: 'application/pdf' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [...PDF]);
  await expect(page).toHaveURL(/\/open$/);
  await expect(page.getByRole('list', { name: 'Opened files' })).toContainText('dropped.pdf');
});

test('pasting a file opens it, but typing in a field is left alone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').focus();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'ignored.pdf'));
    document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'pasted.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [...PNG]);
  await expect(page).toHaveURL(/\/open$/);
  await expect(page.getByRole('list', { name: 'Opened files' })).toContainText('pasted.png');
});

test('the upload badge reports anything the page sends', async ({ page }) => {
  await chooseOnHome(page, [{ name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  await expect(page.getByText('0 bytes uploaded')).toBeVisible();
  await page.evaluate(() => fetch('/__probe', { method: 'POST', body: new Uint8Array(2048) }).catch(() => {}));
  await expect(page.getByText('2 KB sent')).toBeVisible();
});

test('the result card saves under the edited name', async ({ page }) => {
  await page.goto('/design');
  const card = page.getByRole('region', { name: 'Your file is ready' });
  await card.getByLabel('File name').fill('my report');
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Save' }).click();
  expect((await download).suggestedFilename()).toBe('my report.pdf');
  await expect(page.getByRole('status').filter({ hasText: 'Saved my report.pdf' })).toBeVisible();
});

test('Recent lists files on this device and can save, remove and clear them', async ({ page }) => {
  await page.goto('/recent');
  await expect(page.getByText('Nothing here yet')).toBeVisible();
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const r = indexedDB.open('happy-pdf', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('recent', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction('recent', 'readwrite');
    const now = Date.now();
    for (const [i, name] of ['merged.pdf', 'small.pdf'].entries()) {
      tx.objectStore('recent').put({ id: String(i), name, type: 'application/pdf', size: 1024, tool: 'merge', createdAt: now - i * 1000, blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) });
    }
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    db.close();
  });
  await page.reload();
  const list = page.getByRole('list', { name: 'Recent files' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toContainText('merged.pdf');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save merged.pdf' }).click();
  expect((await download).suggestedFilename()).toBe('merged.pdf');

  await page.getByRole('button', { name: 'Remove small.pdf' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove all' }).click();
  await expect(page.getByText('Nothing here yet')).toBeVisible();
});

test('suggestions start short and expand on request', async ({ page }) => {
  await chooseOnHome(page, [{ name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  const actions = page.locator('.open__actions > li');
  await expect(actions).toHaveCount(6);
  await page.getByRole('button', { name: /Show all \d+ tools/ }).click();
  expect(await actions.count()).toBeGreaterThan(6);
});
