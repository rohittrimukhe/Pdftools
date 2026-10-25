import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from '@cantoo/pdf-lib';
import { makeDocPhoto, readPdf, saveResult } from './fixtures';

test.describe.configure({ timeout: 120_000 });

const DEVANAGARI = 'node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff2';

async function choose(page: Page, button: string, files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button }).click();
  await (await chooser).setFiles(files);
}
const jpg = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/jpeg', buffer });

test('Scan finds the page, cleans it up and makes a searchable A4 PDF', async ({ page }) => {
  await page.goto('/tools/scan');
  const one = await makeDocPhoto(page, ['INVOICE 4521', 'Happy PDF Scanner test', 'Total amount 1,250']);
  const two = await makeDocPhoto(page, ['SECOND PAGE', 'Signed by Asha']);
  await choose(page, 'Choose photos', [jpg('one.jpg', one), jpg('two.jpg', two)]);
  const pages = page.getByRole('list', { name: 'Scanned pages' });
  await expect(pages.getByRole('listitem')).toHaveCount(2);
  await expect(pages).not.toContainText('check edges'); // both pages found automatically

  await page.getByRole('button', { name: 'Move page 2 earlier' }).click();
  await page.getByRole('switch', { name: 'Make text searchable' }).check();
  await page.getByRole('button', { name: 'Make PDF of 2 pages' }).click();
  const out = await saveResult(page);
  expect(out.name).toMatch(/^scan-\d{4}-\d{2}-\d{2}\.pdf$/);
  const text = (await readPdf(out.bytes)).map((p) => p.text);
  expect(text[0]).toContain('SECOND PAGE');
  expect(text[1]).toContain('INVOICE 4521');
  expect(text[1]).toContain('Total amount 1,250');
  const doc = await PDFDocument.load(out.bytes);
  expect(doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])).toEqual([[595, 842], [595, 842]]);
  await expect(out.card).toContainText('0 bytes uploaded');
});

test('the corner editor moves corners with the keyboard and can be cancelled', async ({ page }) => {
  await page.goto('/tools/scan');
  await choose(page, 'Choose photos', [jpg('one.jpg', await makeDocPhoto(page, ['Hello']))]);
  await page.getByRole('button', { name: 'Adjust page 1' }).click();
  const corner = page.getByRole('button', { name: /^Top-left corner/ });
  await expect(corner).toBeVisible();
  const before = await corner.locator('circle').first().getAttribute('cx');
  await corner.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => corner.locator('circle').first().getAttribute('cx')).not.toBe(before);
  await expect(page.getByRole('img', { name: /after straightening and clean-up/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('list', { name: 'Scanned pages' })).toBeVisible();
});

test('OCR reads English from a photo and makes a searchable PDF from a scanned PDF', async ({ page }) => {
  await page.goto('/tools/ocr');
  await choose(page, 'Choose files', [jpg('note.jpg', await makeDocPhoto(page, ['Meeting at 10 AM', 'Room 204, Pune office']))]);
  await page.getByRole('button', { name: 'Read text' }).click();
  await expect(page.getByLabel('Recognised text')).toHaveValue(/Meeting at 10 AM\s+Room 204, Pune office/, { timeout: 60_000 });
  const txt = await saveResult(page);
  expect(txt.name).toBe('note-text.txt');
  expect(new TextDecoder().decode(txt.bytes)).toContain('Room 204');

  // A PDF made only of a picture (like a copier scan) becomes searchable.
  const photo = await makeDocPhoto(page, ['Account statement', 'Balance 52,300']);
  const scanned = await PDFDocument.create();
  const img = await scanned.embedJpg(photo);
  scanned.addPage([595, 793]).drawImage(img, { x: 0, y: 0, width: 595, height: 793 });
  await page.reload();
  await choose(page, 'Choose files', [{ name: 'statement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await scanned.save()) }]);
  await page.getByRole('switch', { name: 'Also make a searchable PDF' }).check();
  await page.getByRole('button', { name: 'Read text' }).click();
  const pdf = await saveResult(page);
  expect(pdf.name).toBe('statement-searchable.pdf');
  const [first] = await readPdf(pdf.bytes);
  expect(first!.text).toContain('Account statement');
  expect(first!.text).toContain('Balance 52,300');
  expect((await PDFDocument.load(pdf.bytes)).getPage(0).getSize()).toEqual({ width: 595, height: 793 });
});

test.describe('Hindi', () => {
  // The test serves its Hindi font itself; a service worker would fetch it from the network instead.
  test.use({ serviceWorkers: 'block' });
  test('OCR reads Hindi', async ({ page }) => {
    await page.route('**/test-font/deva.woff2', (r) => r.fulfill({ body: readFileSync(DEVANAGARI), contentType: 'font/woff2' }));
    await page.goto('/tools/ocr');
    await page.evaluate(async () => { const f = new FontFace('Deva', 'url(/test-font/deva.woff2)'); await f.load(); document.fonts.add(f); });
    await choose(page, 'Choose files', [jpg('hindi.jpg', await makeDocPhoto(page, ['नमस्ते दुनिया', 'यह हिंदी पाठ है'], { font: 'Deva' }))]);
    await page.getByRole('button', { name: 'English', exact: true }).click(); // off
    await page.getByRole('button', { name: 'Hindi', exact: true }).click(); // on
    await page.getByRole('button', { name: 'Read text' }).click();
    await expect(page.getByLabel('Recognised text')).toHaveValue(/नमस्ते दुनिया/, { timeout: 60_000 });
    await expect(page.getByLabel('Recognised text')).toHaveValue(/हिंदी/);
  });
});

test('OCR works offline after one use', async ({ page, context }) => {
  await page.goto('/tools/ocr');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const photo = jpg('a.jpg', await makeDocPhoto(page, ['Offline reading works']));
  await choose(page, 'Choose files', [photo]);
  await page.getByRole('button', { name: 'Read text' }).click();
  await expect(page.getByLabel('Recognised text')).toHaveValue(/Offline reading works/, { timeout: 60_000 });

  await context.setOffline(true);
  try {
    await page.reload();
    await choose(page, 'Choose files', [photo]);
    await page.getByRole('button', { name: 'Read text' }).click();
    await expect(page.getByLabel('Recognised text')).toHaveValue(/Offline reading works/, { timeout: 60_000 });
  } finally {
    await context.setOffline(false);
  }
});
