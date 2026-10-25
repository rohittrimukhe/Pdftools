import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { asFile, makeDocPhoto, makePdf, saveResult } from './fixtures';

/**
 * Runs the heaviest tools under the security policy the build writes to dist/_headers,
 * so the policy never silently breaks a feature (WebAssembly, workers, Word reader).
 */
test.describe.configure({ timeout: 120_000 });
test.use({ serviceWorkers: 'block' });

const csp = readFileSync('dist/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)![1]!
  .replace('; upgrade-insecure-requests', ''); // the test server is plain http

async function underPolicy(page: Page) {
  const violations: string[] = [];
  await page.route('**/*', async (route) => {
    try {
      const response = await route.fetch();
      // Like the real host: every response carries the policy, so workers get it too.
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    } catch {
      // The page closed while this request was in flight (end of a short test).
    }
  });
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to load: ${e.violatedDirective} ${e.blockedURI} at ${location.pathname} ${e.sourceFile}:${e.lineNumber} ${e.sample}`)));
  return violations;
}

test('the policy is really in force in these tests', async ({ page }) => {
  const violations = await underPolicy(page);
  await page.goto('/');
  // An inline script the page didn't ship must be refused, and reported.
  expect(await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__ran = true';
    document.head.append(s);
    return (window as unknown as { __ran?: boolean }).__ran ? 'ran' : 'blocked';
  })).toBe('blocked');
  await expect.poll(() => violations.length).toBeGreaterThan(0);
});

test('the site works under its own security policy', async ({ page }) => {
  const violations = await underPolicy(page);

  await page.goto('/tools/merge');
  let chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files' }).click();
  await (await chooser).setFiles([asFile('a.pdf', await makePdf(1)), asFile('b.pdf', await makePdf(1))]);
  await page.getByRole('button', { name: 'Merge 2 PDFs' }).click();
  await saveResult(page);

  await page.goto('/tools/ocr');
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files' }).click();
  await (await chooser).setFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: await makeDocPhoto(page, ['Policy check']) });
  await page.getByRole('button', { name: 'Read text' }).click();
  await expect(page.getByLabel('Recognised text')).toHaveValue(/Policy check/, { timeout: 60_000 });

  await page.goto('/tools/word-to-pdf');
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file' }).click();
  await (await chooser).setFiles({ name: 'report.docx', mimeType: 'application/octet-stream', buffer: readFileSync('e2e/fixtures/office/report.docx') });
  await page.getByRole('button', { name: 'Convert to PDF' }).click();
  await saveResult(page);

  await page.goto('/tools/resume-builder');
  await page.getByRole('button', { name: 'Fill with an example' }).click();
  await expect(page.getByRole('img', { name: 'Page 1 of your resume' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/tools/scan');
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photos' }).click();
  await (await chooser).setFiles({ name: 's.jpg', mimeType: 'image/jpeg', buffer: await makeDocPhoto(page, ['Scan']) });
  await expect(page.getByRole('list', { name: 'Scanned pages' }).locator('img')).toBeVisible();

  expect(violations).toEqual([]);
});
