import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { asFile, makePdf, openTool, readPdf, saveResult, texts, unzip } from './fixtures';

test.describe.configure({ timeout: 90_000 });

test('Merge joins files in the chosen order', async ({ page }) => {
  await openTool(page, 'merge', [asFile('a.pdf', await makePdf(2, { label: 'A' })), asFile('b.pdf', await makePdf(1, { label: 'B' }))]);
  const list = page.getByRole('list', { name: 'Files to merge, in order' });
  await expect(list).toContainText('2 pages');
  await page.getByRole('button', { name: 'Move b.pdf up' }).click();
  await page.getByRole('button', { name: 'Merge 2 PDFs' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('b-merged.pdf');
  expect(await texts(out.bytes)).toEqual(['B 1', 'A 1', 'A 2']);
  await expect(out.card).toContainText('0 bytes uploaded');
});

test('Split makes one file per group, zipped', async ({ page }) => {
  await openTool(page, 'split', [asFile('book.pdf', await makePdf(5))]);
  await page.getByLabel('Pages in each file').fill('2');
  await expect(page.getByText('Makes 3 files')).toBeVisible();
  await page.getByRole('button', { name: 'Split into 3 files' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('book-split.zip');
  const files = unzip(out.bytes);
  expect(Object.keys(files)).toEqual(['book-pages-1-2.pdf', 'book-pages-3-4.pdf', 'book-pages-5.pdf']);
  expect(await texts(files['book-pages-5.pdf']!)).toEqual(['Page 5']);
});

test('Split explains a page range that does not exist', async ({ page }) => {
  await openTool(page, 'split', [asFile('short.pdf', await makePdf(3))]);
  await page.getByRole('button', { name: 'Custom ranges' }).click();
  await page.getByLabel('Pages for each file').fill('1-2, 9');
  await expect(page.getByText('Page 9 doesn’t exist. This PDF has 3 pages.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Split/ })).toBeDisabled();
});

test('Organise reorders, rotates and removes pages', async ({ page }) => {
  await openTool(page, 'organise', [asFile('scan.pdf', await makePdf(3))]);
  await page.getByRole('button', { name: 'Remove page 2' }).click();
  await page.getByRole('button', { name: 'Rotate page 1 right' }).click();
  await page.getByRole('button', { name: 'Move page 3 earlier' }).click();
  await page.getByRole('button', { name: 'Move page 3 earlier' }).click();
  await page.getByRole('button', { name: 'Save 2 pages' }).click();
  const out = await saveResult(page);
  const pages = await readPdf(out.bytes);
  expect(pages.map((p) => p.text)).toEqual(['Page 3', 'Page 1']);
  expect(pages.map((p) => p.rotation)).toEqual([0, 90]);
});

test('page thumbnails render', async ({ page }) => {
  await openTool(page, 'organise', [asFile('scan.pdf', await makePdf(3))]);
  const thumbs = page.getByRole('list', { name: 'Pages' }).locator('img');
  await expect(thumbs).toHaveCount(3);
  for (const img of await thumbs.all()) await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(50);
});

test('Extract keeps typed pages in the typed order', async ({ page }) => {
  await openTool(page, 'extract', [asFile('report.pdf', await makePdf(4))]);
  await page.getByLabel('Pages to keep').fill('4, 1-2');
  await expect(page.getByRole('button', { name: 'Page 4' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Extract 3 pages' }).click();
  const out = await saveResult(page);
  expect(await texts(out.bytes)).toEqual(['Page 4', 'Page 1', 'Page 2']);
});

test('Compress makes a heavy PDF much smaller and reports the saving', async ({ page }) => {
  const heavy = await makePdf(2, { heavy: true });
  await openTool(page, 'compress', [asFile('heavy.pdf', heavy)]);
  await page.getByRole('button', { name: 'Strong' }).click();
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('heavy-compressed.pdf');
  expect(out.bytes.length).toBeLessThan(heavy.length / 2);
  expect((await readPdf(out.bytes)).length).toBe(2);
  await expect(page.getByText(/% smaller\./)).toBeVisible();
});

test('Compress never hands back a bigger file', async ({ page }) => {
  await openTool(page, 'compress', [asFile('tiny.pdf', await makePdf(1))]);
  await page.getByRole('button', { name: 'Light' }).click();
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(page.getByText(/already as small as this setting can make it/)).toBeVisible();
});

test('Watermark stamps every page', async ({ page }) => {
  await openTool(page, 'watermark', [asFile('draft.pdf', await makePdf(2))]);
  await page.getByLabel('Watermark text').fill('DRAFT COPY');
  await page.getByRole('button', { name: 'Add watermark' }).click();
  const out = await saveResult(page);
  for (const text of await texts(out.bytes)) expect(text).toContain('DRAFT COPY');
});

test('Page numbers can skip the cover', async ({ page }) => {
  await openTool(page, 'page-numbers', [asFile('thesis.pdf', await makePdf(3))]);
  await page.getByRole('button', { name: 'Leave it blank' }).click();
  await page.getByRole('group', { name: 'Style' }).getByRole('button', { name: '1 of 2' }).click();
  await page.getByRole('button', { name: 'Add page numbers' }).click();
  const out = await saveResult(page);
  const pages = await texts(out.bytes);
  expect(pages[0]).toBe('Page 1');
  expect(pages[1]).toContain('1 of 2');
  expect(pages[2]).toContain('2 of 2');
});

test('Protect requires matching passwords and locks the file', async ({ page }) => {
  await openTool(page, 'protect', [asFile('salary.pdf', await makePdf(1))]);
  await page.getByLabel('New password').fill('sunny-day-42');
  await page.getByLabel('Type it again').fill('sunny-day-4');
  await expect(page.getByText('The two passwords don’t match.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Protect PDF' })).toBeDisabled();
  await page.getByLabel('Type it again').fill('sunny-day-42');
  await page.getByRole('button', { name: 'Protect PDF' }).click();
  const out = await saveResult(page);
  await expect(readPdf(out.bytes)).rejects.toThrow();
  expect(await texts(out.bytes, 'sunny-day-42')).toEqual(['Page 1']);
});

test('Unlock asks for the password, rejects a wrong one, then removes it', async ({ page }) => {
  await openTool(page, 'unlock', [asFile('locked.pdf', await makePdf(1, { password: 'open-sesame' }))]);
  await page.getByLabel('Password', { exact: true }).fill('nope');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await expect(page.getByText('That password didn’t open this PDF.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('open-sesame');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await page.getByRole('button', { name: 'Remove password' }).click();
  const out = await saveResult(page);
  expect((await PDFDocument.load(out.bytes)).isEncrypted).toBe(false);
  expect(await texts(out.bytes)).toEqual(['Page 1']);
});

test('Other tools open protected PDFs after asking for the password', async ({ page }) => {
  await openTool(page, 'watermark', [asFile('locked.pdf', await makePdf(1, { password: 'pw' }))]);
  await page.getByLabel('Password', { exact: true }).fill('pw');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await page.getByRole('button', { name: 'Add watermark' }).click();
  const out = await saveResult(page);
  expect((await texts(out.bytes))[0]).toContain('CONFIDENTIAL');
});

test('Sign places a drawn signature on the chosen page', async ({ page }) => {
  await openTool(page, 'sign', [asFile('contract.pdf', await makePdf(2))]);
  const pad = page.getByRole('img', { name: /Signature drawing area/ });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 120);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + 120 - (i % 2) * 50);
  await page.mouse.up();
  const sheet = page.getByRole('button', { name: /^Page 2\. Signature at/ });
  await sheet.waitFor();
  const target = (await sheet.boundingBox())!;
  await sheet.click({ position: { x: target.width * 0.3, y: target.height * 0.9 } });
  await expect(sheet).toHaveAccessibleName(/Signature at 30% across, 90% down/);
  await page.getByRole('button', { name: 'Sign PDF' }).click();
  const out = await saveResult(page);
  const doc = await PDFDocument.load(out.bytes);
  const images = (i: number) => { const x = doc.getPage(i).node.Resources()?.lookup(PDFName.of('XObject')); return x instanceof PDFDict ? x.keys().length : 0; };
  expect([images(0), images(1)]).toEqual([0, 1]);
});

test('a loaded tool screen passes the accessibility scan', async ({ page }) => {
  await openTool(page, 'organise', [asFile('scan.pdf', await makePdf(2))]);
  await expect(page.getByRole('button', { name: 'Remove page 2' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
