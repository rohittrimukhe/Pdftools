import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { parseXml, textOf, find } from './xml';
import { renderFlow, type Block } from './flow';
import { formatNumber, readXlsx, sheetsToBlocks } from './xlsx';
import { htmlToBlocks, imageSize } from './docx';
import { pptxToPdf } from './pptx';
import { writeDocx } from './writeDocx';
import { bodySizeOf, toLines, toParts } from './pdfToDocx';
import { readPdf } from '../pdf/testing';

const fixture = (name: string) => new Uint8Array(readFileSync(`e2e/fixtures/office/${name}`));

describe('xml reader', () => {
  it('reads elements, attributes, entities and HTML void tags', () => {
    const root = parseXml('<?xml version="1.0"?><a:p x="1 &amp; 2"><a:t>Tom &amp; Jerry &#8377;5</a:t><br><img src="x"><b>bold</b></a:p>');
    const p = find(root, 'a:p')!;
    expect(p.attrs.x).toBe('1 & 2');
    expect(textOf(find(p, 'a:t'))).toBe('Tom & Jerry ₹5');
    expect(p.children.map((c) => c.name)).toEqual(['a:t', 'br', 'img', 'b']);
  });
});

describe('Excel', () => {
  it('formats numbers the way Excel shows them', () => {
    expect(formatNumber(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(formatNumber(0.27397, '0.0%')).toBe('27.4%');
    expect(formatNumber(46114, 'dd\\-mm\\-yyyy')).toBe('02-04-2026');
    expect(formatNumber(46114, 'd-mmm-yy')).toBe('2-Apr-26');
    expect(formatNumber(-1500, '#,##0;(#,##0)')).toBe('(1,500)');
    expect(formatNumber(2500, '"₹"#,##0')).toBe('₹2,500');
    expect(formatNumber(0.1 + 0.2, 'General')).toBe('0.3');
  });

  it('reads sheets, saved formula results, formats and bold headers', () => {
    const [sales, notes] = readXlsx(fixture('sales.xlsx'));
    expect(sales!.name).toBe('Sales');
    expect(sales!.rows[0]).toEqual(['Region', 'Units', 'Price', 'Total', 'Share', 'Date']);
    expect(sales!.rows[1]).toEqual(['West', '120', '49.50', '5,940.00', '27.4%', '02-04-2026']);
    expect(sales!.bold[0]!.every(Boolean)).toBe(true);
    expect(sales!.numeric).toEqual([false, true, true, true, true, true]);
    expect(notes!.rows).toEqual([['Figures are in rupees.']]);
  });

  it('prints each sheet as a table PDF whose text can be read back', async () => {
    const { bytes, pages, dropped } = await renderFlow(sheetsToBlocks(readXlsx(fixture('sales.xlsx'))));
    expect(pages).toBe(2);
    expect(dropped).toEqual([]);
    const text = (await readPdf(bytes)).map((p) => p.text);
    expect(text[0]).toContain('Sales');
    expect(text[0]).toContain('5,940.00');
    expect(text[0]).toContain('27.4%');
    expect(text[1]).toContain('Figures are in rupees.');
  });

  it('refuses a file that is not a workbook', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/isn’t an Excel workbook/);
  });
});

describe('Word', () => {
  it('turns a real .docx into headings, styled text, lists, a table, a picture and a page break', async () => {
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(fixture('report.docx')) }, { styleMap: ['br[type=\'page\'] => hr.page-break'] });
    const blocks = htmlToBlocks(value);
    const kinds = blocks.map((b) => b.kind);
    expect(kinds[0]).toBe('heading');
    expect(kinds).toContain('table');
    expect(kinds).toContain('image');
    expect(kinds).toContain('pagebreak');
    const para = blocks.find((b) => b.kind === 'para' && b.runs.some((r) => r.text.includes('24 percent'))) as Extract<Block, { kind: 'para' }>;
    expect(para.runs.find((r) => r.text === '24 percent')?.bold).toBe(true);
    expect(blocks.filter((b) => b.kind === 'para' && b.marker === '•')).toHaveLength(3);
    expect(blocks.filter((b) => b.kind === 'para' && b.marker === '2.')).toHaveLength(1);

    const { bytes, pages, dropped } = await renderFlow(blocks);
    expect(dropped).toEqual([]); // ₹ is swapped for "Rs."
    expect(pages).toBe(2);
    const [first, second] = (await readPdf(bytes)).map((p) => p.text);
    for (const part of ['Quarterly Report', 'Sales grew by 24 percent this quarter', 'New store in Pune', 'Hire two analysts', 'Region Q1 Q2', 'West 120 149', 'Long paragraph.']) expect(first).toContain(part);
    // The page break puts the appendix on a page of its own.
    expect(first).not.toContain('Appendix');
    expect(second).toBe('Appendix Prepared by Happy PDF tests. Price: Rs.1,250.');
  });

  it('reads picture sizes from PNG and JPEG headers', () => {
    expect(imageSize(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0, 60]))).toEqual({ width: 120, height: 60 });
    expect(imageSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 50, 0, 80, 3, 0, 0, 0, 0]))).toEqual({ width: 80, height: 50 });
  });
});

describe('PowerPoint', () => {
  it('draws each slide with its placeholders, text box, filled shape and picture', async () => {
    const { bytes, slides, skipped, dropped } = await pptxToPdf(fixture('launch.pptx'));
    expect(slides).toBe(3);
    expect(skipped).toEqual([]);
    expect(dropped).toEqual([]);
    const pages = (await readPdf(bytes)).map((p) => p.text);
    expect(pages[0]).toContain('Happy PDF Launch');
    expect(pages[0]).toContain('Every document tool. Free. Private.');
    expect(pages[1]).toContain('Why people switch');
    expect(pages[1]).toMatch(/• Nothing is uploaded/);
    expect(pages[1]).toContain('No sign-up, no limits');
    expect(pages[2]).toContain('Picture slide');
    expect(pages[2]).toContain('Made with python-pptx');
  });

  it('refuses a file that is not a presentation', async () => {
    await expect(pptxToPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow(/isn’t a PowerPoint/);
  });
});

describe('PDF to Word', () => {
  it('groups text into lines, paragraphs and headings', () => {
    const item = (str: string, x: number, y: number, size = 11) => ({ str, x, y, size, width: str.length * size * 0.5 });
    const lines = toLines([item('Title', 50, 800, 20), item('First line of', 50, 760), item('text', 130, 760), item('second line.', 50, 746), item('New para', 50, 700)]);
    expect(lines.map((l) => l.text)).toEqual(['Title', 'First line of text', 'second line.', 'New para']);
    expect(bodySizeOf(lines)).toBe(11);
    expect(toParts([lines], 11)).toEqual([
      { kind: 'heading', level: 1, text: 'Title' },
      { kind: 'para', text: 'First line of text second line.', size: 11 },
      { kind: 'para', text: 'New para', size: 11 },
    ]);
  });

  it('writes a .docx that Word-compatible readers open', async () => {
    const docx = writeDocx([{ kind: 'heading', level: 1, text: 'Report <2026>' }, { kind: 'para', text: 'Body & text' }, { kind: 'pagebreak' }, { kind: 'para', text: 'Page two' }]);
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(docx) });
    expect(value).toContain('<h1>Report &lt;2026&gt;</h1>');
    expect(value).toContain('<p>Body &amp; text</p>');
    expect(value).toContain('<p>Page two</p>');
  });
});

describe('table layout', () => {
  it('never wraps a number inside a column sized to fit it', async () => {
    const rows = [[[{ text: 'Price', bold: true }]], [[{ text: '49.50' }]], [[{ text: '52.25' }]]];
    const { bytes } = await renderFlow([{ kind: 'table', rows, header: true }]);
    expect((await readPdf(bytes))[0]!.text).toBe('Price 49.50 52.25');
  });
});
