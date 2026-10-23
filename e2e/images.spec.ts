import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PDFDocument } from '@cantoo/pdf-lib';
import { asFile, jpegSize, makePdf, openImageTool, openTool, png, pngSize, saveResult, unzip } from './fixtures';

test.describe.configure({ timeout: 120_000 });

test('Image to PDF makes A4 pages in the chosen order, turning wide images sideways', async ({ page }) => {
  await openImageTool(page, 'image-to-pdf', [png('tall.png', 600, 800), png('wide.png', 800, 400)]);
  await page.getByRole('button', { name: 'Move wide.png up' }).click();
  await page.getByRole('button', { name: 'Make a PDF of 2 images' }).click();
  const out = await saveResult(page);
  const doc = await PDFDocument.load(out.bytes);
  const sizes = doc.getPages().map((p) => p.getSize()).map(({ width, height }) => [Math.round(width), Math.round(height)]);
  expect(sizes).toEqual([[842, 595], [595, 842]]);
});

test('Image to PDF can size each page to its image', async ({ page }) => {
  await openImageTool(page, 'image-to-pdf', [png('a.png', 400, 200)]);
  await page.getByRole('button', { name: 'Same as image' }).click();
  await page.getByRole('button', { name: 'Make a PDF of 1 image' }).click();
  const out = await saveResult(page);
  const { width, height } = (await PDFDocument.load(out.bytes)).getPage(0).getSize();
  expect([width, height]).toEqual([300, 150]);
});

test('PDF to image saves one chosen page as JPG, or all pages as PNGs in a ZIP', async ({ page }) => {
  await openTool(page, 'pdf-to-image', [asFile('deck.pdf', await makePdf(3))]);
  await page.getByLabel('Pages').fill('2');
  await page.getByRole('button', { name: 'Save 1 page as JPG' }).click();
  let out = await saveResult(page);
  expect(out.name).toBe('deck-page-2.jpg');
  expect(jpegSize(out.bytes)).toEqual({ width: 1240, height: 1754 }); // 595 × 842 pt at 150 dpi, rounded

  await page.getByLabel('Pages').fill('');
  await page.getByRole('button', { name: 'PNG' }).click();
  await page.getByRole('button', { name: 'Screen (96 dpi)' }).click();
  await page.getByRole('button', { name: 'Save 3 pages as PNG' }).click();
  out = await saveResult(page);
  const files = unzip(out.bytes);
  expect(Object.keys(files)).toEqual(['deck-page-1.png', 'deck-page-2.png', 'deck-page-3.png']);
  expect(pngSize(files['deck-page-1.png']!)).toEqual({ width: 793, height: 1123 }); // 595 × 842 pt at 96 dpi
});

for (const [format, magic] of [['WebP', 'WEBP'], ['GIF', 'GIF8'], ['JPG', '\xff\xd8\xff']] as const) {
  test(`Convert image writes real ${format}`, async ({ page }) => {
    await openImageTool(page, 'convert-image', [png('logo.png', 120, 80)]);
    await page.getByRole('group', { name: 'Save as' }).getByRole('button', { name: format, exact: true }).click();
    await page.getByRole('button', { name: 'Convert 1 image' }).click();
    const out = await saveResult(page);
    const head = Buffer.from(out.bytes.slice(0, 12)).toString('latin1');
    expect(head.includes(magic)).toBe(true);
  });
}

test('Convert turns an SVG into a PNG', async ({ page }) => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#f90"/></svg>');
  await openImageTool(page, 'convert-image', [{ name: 'badge.svg', mimeType: 'image/svg+xml', buffer: svg }]);
  await page.getByRole('group', { name: 'Save as' }).getByRole('button', { name: 'PNG', exact: true }).click();
  await page.getByRole('button', { name: 'Convert 1 image' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('badge.png');
  expect(pngSize(out.bytes)).toEqual({ width: 1024, height: 512 });
});

test('Resize by percent, longest side and exact pixels', async ({ page }) => {
  await openImageTool(page, 'resize-image', [png('p.png', 1000, 600)]);
  await page.getByRole('button', { name: 'Resize 1 image' }).click();
  expect(pngSize((await saveResult(page)).bytes)).toEqual({ width: 500, height: 300 });

  await page.getByRole('button', { name: 'Longest side' }).click();
  await page.getByLabel('Longest side (px)').fill('250');
  await page.getByRole('button', { name: 'Resize 1 image' }).click();
  expect(pngSize((await saveResult(page)).bytes)).toEqual({ width: 250, height: 150 });

  await page.getByRole('button', { name: 'Exact pixels' }).click();
  await page.getByLabel('Width (px)').fill('300');
  await page.getByLabel('Height (px)').fill('300');
  await page.getByRole('button', { name: 'Stretch to fit' }).click();
  await page.getByRole('button', { name: 'Resize 1 image' }).click();
  expect(pngSize((await saveResult(page)).bytes)).toEqual({ width: 300, height: 300 });
});

test('Resizing several images gives one ZIP', async ({ page }) => {
  await openImageTool(page, 'resize-image', [png('a.png', 400, 400), png('b.png', 200, 100)]);
  await page.getByRole('button', { name: 'Resize 2 images' }).click();
  const out = await saveResult(page);
  expect(Object.keys(unzip(out.bytes))).toEqual(['a-200x200.png', 'b-100x50.png']);
});

test('a HEIC photo the browser cannot open is explained', async ({ page }) => {
  await openImageTool(page, 'convert-image', [{ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('\0\0\0\x18ftypheic\0\0\0\0') }]);
  await page.getByRole('button', { name: 'Convert 1 image' }).click();
  await expect(page.getByText(/This browser can’t open HEIC photos/)).toBeVisible();
});

test('an image tool with files passes the accessibility scan', async ({ page }) => {
  await openImageTool(page, 'image-to-pdf', [png('a.png', 100, 100), png('b.png', 100, 100)]);
  await expect(page.getByRole('button', { name: 'Move b.png up' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
