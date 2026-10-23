import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { addPageNumbers, addWatermark, compressLossless, mergePdfs, openPdf, pageCount, pageLabel, placeImages, protectPdf, rebuildPdf, splitPdf, unlockPdf } from './engine';
import { chunkPages, parsePageGroups, parsePageList } from './ranges';
import { readPdf, samplePdf } from './testing';

const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

describe('page ranges', () => {
  it('reads what people type', () => {
    expect(parsePageGroups('1-3, 5, 8-', 10)).toEqual([[0, 1, 2], [4], [7, 8, 9]]);
    expect(parsePageGroups('-2;last', 4)).toEqual([[0, 1], [3]]);
    expect(parsePageGroups(' 2 – last ', 3)).toEqual([[1, 2]]);
    expect(parsePageList('3, 1-3', 5)).toEqual([2, 0, 1]);
  });
  it('explains mistakes in plain words', () => {
    expect(() => parsePageGroups('', 3)).toThrow(/Type the pages/);
    expect(() => parsePageGroups('4', 3)).toThrow('Page 4 doesn’t exist. This PDF has 3 pages.');
    expect(() => parsePageGroups('3-1', 3)).toThrow(/runs backwards/);
    expect(() => parsePageGroups('two', 3)).toThrow(/isn’t a page number/);
  });
  it('chunks pages evenly with the remainder last', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(() => chunkPages(5, 0)).toThrow();
  });
});

describe('PDF engine', () => {
  it('merges in order', async () => {
    const merged = await mergePdfs([await samplePdf(2), await samplePdf(1)]);
    expect((await readPdf(merged)).map((p) => p.text)).toEqual(['Page 1', 'Page 2', 'Page 1']);
  });

  it('reorders, rotates and drops pages', async () => {
    const out = await rebuildPdf(await samplePdf(3), [{ index: 2, rotate: 90 }, { index: 0 }]);
    const pages = await readPdf(out);
    expect(pages.map((p) => p.text)).toEqual(['Page 3', 'Page 1']);
    expect(pages.map((p) => p.rotation)).toEqual([90, 0]);
  });

  it('adds rotation to a page that was already rotated', async () => {
    const out = await rebuildPdf(await samplePdf(1, { rotate: 270 }), [{ index: 0, rotate: 180 }]);
    expect((await readPdf(out))[0]?.rotation).toBe(90);
  });

  it('splits into one file per group', async () => {
    const parts = await splitPdf(await samplePdf(5), chunkPages(5, 2));
    expect(await Promise.all(parts.map(async (p) => (await readPdf(p)).map((x) => x.text)))).toEqual([['Page 1', 'Page 2'], ['Page 3', 'Page 4'], ['Page 5']]);
  });

  it('watermarks every page, including rotated ones', async () => {
    const src = await mergePdfs([await samplePdf(1), await samplePdf(1, { rotate: 90 })]);
    const pages = await readPdf(await addWatermark(src, { text: 'CONFIDENTIAL' }));
    for (const page of pages) expect(page.text).toContain('CONFIDENTIAL');
    await expect(addWatermark(src, { text: '  ' })).rejects.toThrow(/Type the watermark text/);
  });

  it('numbers pages, skipping a cover and counting from a chosen number', async () => {
    const pages = await readPdf(await addPageNumbers(await samplePdf(3), { style: 'n-of-total', skipFirst: 1, startAt: 1 }));
    expect(pages[0]?.text).toBe('Page 1');
    expect(pages[1]?.text).toContain('1 of 2');
    expect(pages[2]?.text).toContain('2 of 2');
    expect(pageLabel('page-n', 4, 9)).toBe('Page 4');
  });

  it('protects with a password and unlocks with it again', async () => {
    const locked = await protectPdf(await samplePdf(1), 'sunny-42');
    await expect(openPdf(locked)).rejects.toMatchObject({ code: 'password-required' });
    await expect(openPdf(locked, 'wrong')).rejects.toMatchObject({ code: 'wrong-password' });
    expect((await readPdf(locked, 'sunny-42'))[0]?.text).toBe('Page 1');
    const open = await unlockPdf(locked, 'sunny-42');
    expect((await PDFDocument.load(open)).isEncrypted).toBe(false);
    expect((await readPdf(open))[0]?.text).toBe('Page 1');
  });

  it('places a signature image on the chosen page', async () => {
    const out = await placeImages(await samplePdf(2), [{ page: 1, image: PNG_1PX, box: { x: 0.6, y: 0.8, width: 0.25, height: 0.08 } }]);
    const doc = await PDFDocument.load(out);
    const images = (p: number) => {
      const xobjects = doc.getPage(p).node.Resources()?.lookup(PDFName.of('XObject'));
      return xobjects instanceof PDFDict ? xobjects.keys().length : 0;
    };
    expect(images(1)).toBe(1);
    expect(images(0)).toBe(0);
    await expect(placeImages(out, [{ page: 5, image: PNG_1PX, box: { x: 0, y: 0, width: 0.1, height: 0.1 } }])).rejects.toThrow(/Page 6 doesn’t exist/);
  });

  it('re-saves losslessly with the same pages', async () => {
    const src = await samplePdf(4);
    const out = await compressLossless(src);
    expect((await readPdf(out)).map((p) => p.text)).toEqual(['Page 1', 'Page 2', 'Page 3', 'Page 4']);
    expect(await pageCount(out)).toBe(4);
  });

  it('says plainly when a file is not a PDF or is damaged', async () => {
    await expect(openPdf(new TextEncoder().encode('hello'))).rejects.toMatchObject({ code: 'not-pdf' });
    const cut = (await samplePdf(2)).slice(0, 200);
    await expect(openPdf(cut)).rejects.toMatchObject({ code: 'damaged' });
  });
});
