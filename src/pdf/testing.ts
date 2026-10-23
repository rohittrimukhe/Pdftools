import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'node:url';

const standardFontDataUrl = fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url));

/** A PDF whose pages say "Page 1", "Page 2"… so tests can see which page is where. */
export async function samplePdf(pages: number, { size = [595, 842] as [number, number], rotate = 0 } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage(size);
    page.drawText(`Page ${i}`, { x: 50, y: size[1] - 80, size: 24, font });
    if (rotate) page.setRotation({ type: 'degrees', angle: rotate } as never);
  }
  return doc.save();
}

/** Text and rotation of every page, read with pdf.js, the same engine that renders the app. */
export async function readPdf(bytes: Uint8Array, password?: string) {
  const task = getDocument({ data: bytes.slice(), password, useSystemFonts: false, standardFontDataUrl });
  const doc = await task.promise;
  const pages: Array<{ text: string; rotation: number }> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({ text: content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim(), rotation: page.rotate });
  }
  await task.destroy();
  return pages;
}
