import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { renderResume } from '../src/resume/pdf';
import { sampleResume } from '../src/resume/model';
import { downloadBytes, readPdf, saveResult } from './fixtures';

test.describe.configure({ timeout: 90_000 });

async function fillBasics(page: Page) {
  await page.goto('/tools/resume-builder');
  await page.getByLabel('Full name').fill('Ravi Kumar');
  await page.getByLabel('Headline').fill('Data Analyst');
  await page.getByLabel('Email').fill('ravi@example.com');
  await page.getByLabel('Phone').fill('+91 90000 12345');
  await page.getByLabel('Job title').fill('Data Analyst');
  await page.getByLabel('Company').fill('Northwind');
  await page.getByLabel('What you achieved, one per line').fill('Built Power BI dashboards used by 30 managers\nCut monthly reporting time by 60% with SQL automation');
  await page.getByLabel('Skills, separated by commas').fill('SQL, Power BI, Excel, Python');
}

test('builds a text PDF that ATS software can read, and keeps the draft on this device', async ({ page }) => {
  await fillBasics(page);
  await page.getByRole('button', { name: 'Classic' }).click();
  await expect(page.getByRole('img', { name: 'Page 1 of your resume' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Create PDF' }).click();
  const out = await saveResult(page);
  expect(out.name).toBe('Ravi Kumar resume.pdf');
  const [first] = await readPdf(out.bytes);
  for (const part of ['Ravi Kumar', 'ravi@example.com', 'EXPERIENCE', 'Northwind', 'Cut monthly reporting time by 60%', 'SKILLS', 'Power BI']) expect(first!.text).toContain(part);
  await expect(out.card).toContainText('0 bytes uploaded');

  // The draft survives a reload, and "Start over" deletes it.
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Ravi Kumar');
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Delete draft' }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('');
});

test('roles can be added, reordered and removed', async ({ page }) => {
  await page.goto('/tools/resume-builder');
  await page.getByLabel('Job title').fill('Second job');
  await page.getByRole('button', { name: 'Add a role' }).click();
  await page.getByLabel('Job title').nth(1).fill('First job');
  await page.getByRole('button', { name: 'Move First job up' }).click();
  await expect(page.getByLabel('Job title').first()).toHaveValue('First job');
  await page.getByRole('button', { name: 'Remove Second job' }).click();
  await expect(page.getByLabel('Job title')).toHaveCount(1);
});

test('a backup restores the whole resume', async ({ page }) => {
  await fillBasics(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup' }).click();
  const backup = await downloadBytes(await download);
  expect(JSON.parse(new TextDecoder().decode(backup)).name).toBe('Ravi Kumar');

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Delete draft' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByLabel('Full name')).toHaveValue('Ravi Kumar');
  await expect(page.getByLabel('Company')).toHaveValue('Northwind');
});

test('the score checks the builder resume against a job post and names missing keywords', async ({ page }) => {
  await fillBasics(page);
  await page.getByRole('button', { name: 'Check ATS score' }).click();
  await expect(page).toHaveURL(/\/tools\/resume-score$/);
  await expect(page.getByText('Checking “Ravi Kumar” from the')).toBeVisible();
  await page.getByLabel('Job post (optional)').fill('Data Analyst. Analyse data with SQL and Python. Build dashboards in Power BI and Tableau. Advanced Excel required.');
  await page.getByRole('button', { name: 'Check my resume' }).click();
  await expect(page.getByRole('heading', { name: /^ATS score \d+/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Keywords found' })).toContainText('power bi');
  await expect(page.getByRole('list', { name: 'Keywords missing' })).toContainText('tableau');
  await expect(page.getByText('0 bytes uploaded')).toBeVisible();
  // Short resume: the length check asks for more.
  await expect(page.getByText(/words is thin/)).toBeVisible();
});

test('the score reads an uploaded resume PDF and warns about a scanned one', async ({ page }) => {
  await page.goto('/tools/resume-score');
  const { bytes } = await renderResume(sampleResume());
  let chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file' }).click();
  await (await chooser).setFiles({ name: 'asha.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await expect(page.getByText('1 page', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Check my resume' }).click();
  await expect(page.getByText('“Experience” section: passed')).toBeAttached();
  await expect(page.getByText('“Skills” section: passed')).toBeAttached();
  await expect(page.getByText('Basics only. Add a job post to see the keyword match.')).toBeVisible();

  // A picture of a resume has no text for software to read.
  const scan = await PDFDocument.create();
  scan.addPage([595, 842]).drawRectangle({ x: 50, y: 50, width: 400, height: 600, color: rgb(0.9, 0.9, 0.9) });
  await page.getByRole('button', { name: 'Choose a different file' }).click();
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file' }).click();
  await (await chooser).setFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await scan.save()) });
  await expect(page.getByText(/probably a scan or an image/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check my resume' })).toBeDisabled();
});

test('the resume screens pass the accessibility scan when filled in', async ({ page }) => {
  await fillBasics(page);
  await expect(page.getByRole('img', { name: 'Page 1 of your resume' })).toBeVisible({ timeout: 15_000 });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Check ATS score' }).click();
  await page.getByRole('button', { name: 'Check my resume' }).click();
  await expect(page.getByRole('heading', { name: /^ATS score/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});
