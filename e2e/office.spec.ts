import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { readPdf, saveResult, unzip } from './fixtures';

test.describe.configure({ timeout: 90_000 });

const office = (name: string) => ({ name, mimeType: 'application/octet-stream', buffer: readFileSync(`e2e/fixtures/office/${name}`) });
async function open(page: Page, tool: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(`/tools/${tool}`);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file' }).click();
  await (await chooser).setFiles(file);
}

test('Word to PDF keeps headings, lists, the table and the page break', async ({ page }) => {
  await open(page, 'word-to-pdf', office('report.docx'));
  await page.getByRole('button', { name: 'Convert to PDF' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('report-converted.pdf');
  const [first, second] = (await readPdf(out.bytes)).map((p) => p.text);
  for (const part of ['Quarterly Report', 'Sales grew by 24 percent', 'New store in Pune', 'Region Q1 Q2', 'West 120 149']) expect(first).toContain(part);
  expect(second).toContain('Appendix');
  await expect(out.card).toContainText('0 bytes uploaded');
});

test('Excel to PDF shows values the way Excel does', async ({ page }) => {
  await open(page, 'excel-to-pdf', office('sales.xlsx'));
  await page.getByRole('button', { name: 'Landscape' }).click();
  await page.getByRole('button', { name: 'Convert to PDF' }).click();
  const out = await saveResult(page);
  const pages = await readPdf(out.bytes);
  expect(pages[0]!.text).toContain('West 120 49.50 5,940.00 27.4% 02-04-2026');
  expect(pages[1]!.text).toContain('Figures are in rupees.');
  const doc = await PDFDocument.load(out.bytes);
  expect(doc.getPage(0).getWidth()).toBeGreaterThan(doc.getPage(0).getHeight());
});

test('PowerPoint to PDF makes one page per slide', async ({ page }) => {
  await open(page, 'ppt-to-pdf', office('launch.pptx'));
  await page.getByRole('button', { name: 'Convert to PDF' }).click();
  const out = await saveResult(page);
  const pages = (await readPdf(out.bytes)).map((p) => p.text);
  expect(pages).toHaveLength(3);
  expect(pages[0]).toContain('Happy PDF Launch');
  expect(pages[1]).toContain('Nothing is uploaded');
  expect(pages[2]).toContain('Picture slide');
});

test('a file of the wrong kind is explained', async ({ page }) => {
  await open(page, 'word-to-pdf', office('sales.xlsx'));
  await expect(page.getByText('That isn’t a Word document (.docx).')).toBeVisible();
  await open(page, 'word-to-pdf', { name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('not a docx') });
  await expect(page.getByText(/Older Office files need saving in the newer format first/)).toBeVisible();
});

test('PDF to Word gives an editable document with headings and paragraphs', async ({ page }) => {
  const doc = await PDFDocument.create();
  const [regular, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const p1 = doc.addPage([595, 842]);
  p1.drawText('Tenancy Agreement', { x: 60, y: 770, size: 22, font: bold });
  p1.drawText('This agreement is made between the owner and the', { x: 60, y: 720, size: 11, font: regular });
  p1.drawText('tenant on the first of April.', { x: 60, y: 706, size: 11, font: regular });
  p1.drawText('Rent is due on the fifth of each month.', { x: 60, y: 670, size: 11, font: regular });
  doc.addPage([595, 842]).drawText('Signed by both parties.', { x: 60, y: 770, size: 11, font: regular });
  await open(page, 'pdf-to-word', { name: 'lease.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await page.getByRole('button', { name: 'Convert to Word' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('lease-editable.docx');
  const xml = new TextDecoder().decode(unzip(out.bytes)['word/document.xml']);
  expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">Tenancy Agreement</);
  expect(xml).toContain('This agreement is made between the owner and the tenant on the first of April.');
  expect(xml).toContain('<w:br w:type="page"/>');
  expect(xml).toContain('Signed by both parties.');
});

test('PDF to Word sends scans to OCR', async ({ page }) => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawRectangle({ x: 50, y: 50, width: 400, height: 600, color: rgb(0.9, 0.9, 0.9) });
  await open(page, 'pdf-to-word', { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await page.getByRole('button', { name: 'Convert to Word' }).click();
  await expect(page.getByText(/probably a scan. Use “Text from scan \(OCR\)” first/)).toBeVisible();
});

test('the Office screens pass the accessibility scan', async ({ page }) => {
  await open(page, 'excel-to-pdf', office('sales.xlsx'));
  await expect(page.getByRole('button', { name: 'Convert to PDF' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});
