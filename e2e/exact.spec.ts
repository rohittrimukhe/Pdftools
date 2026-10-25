import { expect, test, type Page } from '@playwright/test';
import { asFile, jpegSize, makePdf, makePng, readPdf, saveResult } from './fixtures';

test.describe.configure({ timeout: 120_000 });

async function openExact(page: Page, mode: 'Photo' | 'Signature' | 'PDF', file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto('/tools/exact-size');
  await page.getByRole('group', { name: 'What to resize' }).getByRole('button', { name: mode }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file' }).click();
  await (await chooser).setFiles(file);
}
const photo = () => ({ name: 'selfie.png', mimeType: 'image/png', buffer: Buffer.from(makePng(1200, 1600)) });

test('an IBPS photo comes out at 200 × 230 px between 20 and 50 KB', async ({ page }) => {
  await openExact(page, 'Photo', photo());
  await page.getByRole('button', { name: 'IBPS photo' }).click();
  await page.getByRole('button', { name: 'Make it under 50 KB' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('selfie-50kb.jpg');
  expect(jpegSize(out.bytes)).toEqual({ width: 200, height: 230 });
  expect(out.bytes.length).toBeLessThanOrEqual(50 * 1024);
  expect(out.bytes.length).toBeGreaterThanOrEqual(20 * 1024);
  await expect(out.card).toContainText('200 × 230 px');
});

test('a custom limit without pixel sizes keeps the shape and fits the KB', async ({ page }) => {
  await openExact(page, 'Photo', photo());
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.getByLabel('Width').fill('');
  await page.getByLabel('Height').fill('');
  await page.getByLabel('Smallest allowed').fill('');
  await page.getByLabel('Largest allowed').fill('30');
  await page.getByRole('button', { name: 'Make it under 30 KB' }).click();
  const out = await saveResult(page);
  const { width, height } = jpegSize(out.bytes);
  expect(out.bytes.length).toBeLessThanOrEqual(30 * 1024);
  expect(Math.abs(width / height - 1200 / 1600)).toBeLessThan(0.01);
});

test('a signature is cleaned and sized for SSC', async ({ page }) => {
  await openExact(page, 'Signature', { name: 'sign.png', mimeType: 'image/png', buffer: Buffer.from(makePng(900, 450)) });
  await expect(page.getByRole('switch', { name: 'Clean background' })).toBeChecked();
  await page.getByRole('button', { name: 'SSC signature' }).click();
  await page.getByRole('button', { name: 'Make it under 20 KB' }).click();
  const out = await saveResult(page);
  expect(out.bytes.length).toBeLessThanOrEqual(20 * 1024);
  expect(jpegSize(out.bytes)).toEqual({ width: 315, height: 157 });
});

test('half-filled sizes are explained before running', async ({ page }) => {
  await openExact(page, 'Photo', photo());
  await page.getByLabel('Height').fill('');
  await expect(page.getByText('Enter both width and height, or leave both empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Make it under/ })).toBeDisabled();
});

test('a photo-heavy PDF fits under 200 KB and stays readable', async ({ page }) => {
  const heavy = await makePdf(3, { heavy: true });
  await openExact(page, 'PDF', asFile('scan.pdf', heavy));
  await page.getByRole('button', { name: '200 KB', exact: true }).click();
  await page.getByRole('button', { name: 'Make it under 200 KB' }).click();
  const out = await saveResult(page);
  expect(out.bytes.length).toBeLessThanOrEqual(200 * 1024);
  expect((await readPdf(out.bytes)).length).toBe(3);
  await expect(out.card).toContainText('dpi');
});

test('an impossible PDF limit is explained', async ({ page }) => {
  await openExact(page, 'PDF', asFile('scan.pdf', await makePdf(3, { heavy: true })));
  await page.getByLabel('Or type a limit').fill('3');
  await page.getByRole('button', { name: 'Make it under 3 KB' }).click();
  await expect(page.getByText(/can’t get under 3 KB while staying readable/)).toBeVisible();
});

test('a small text PDF is fitted without turning pages into images', async ({ page }) => {
  await openExact(page, 'PDF', asFile('letter.pdf', await makePdf(2)));
  await page.getByRole('button', { name: '100 KB', exact: true }).click();
  await page.getByRole('button', { name: 'Make it under 100 KB' }).click();
  const out = await saveResult(page);
  expect(await readPdf(out.bytes).then((p) => p.map((x) => x.text))).toEqual(['Page 1', 'Page 2']);
  await expect(out.card).toContainText('pages unchanged');
});
