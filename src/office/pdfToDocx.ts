import { loadRender } from '../pdf/lazy';
import { writeDocx, type DocPart } from './writeDocx';
import { FriendlyError } from '../lib/errors';

/**
 * PDF to an editable Word document: the text of each page, in reading order,
 * grouped into paragraphs, with larger text turned into headings. Layout,
 * pictures and tables are not rebuilt. A scanned PDF has no text to take:
 * the screen sends people to OCR first.
 */
export interface TextItem { str: string; x: number; y: number; size: number; width: number }
interface Line { text: string; x: number; y: number; size: number }

/** Groups a page's text pieces into lines (top to bottom, left to right). */
export function toLines(items: TextItem[]): Line[] {
  const sorted = items.filter((i) => i.str.trim() || i.str === ' ').sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ items: TextItem[]; y: number; size: number }> = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - it.y) <= Math.max(2, Math.min(line.size, it.size) * 0.4)) { line.items.push(it); line.size = Math.max(line.size, it.size); }
    else lines.push({ items: [it], y: it.y, size: it.size });
  }
  return lines.map((l) => {
    const parts = l.items.sort((a, b) => a.x - b.x);
    let text = '';
    let end = -Infinity;
    for (const p of parts) {
      if (text && !text.endsWith(' ') && !p.str.startsWith(' ') && p.x - end > l.size * 0.2) text += ' ';
      text += p.str;
      end = p.x + p.width;
    }
    return { text: text.replace(/\s+/g, ' ').trim(), x: parts[0]!.x, y: l.y, size: Math.round(l.size * 2) / 2 };
  }).filter((l) => l.text);
}

/** The most common text size (weighted by characters): the body text. */
export const bodySizeOf = (lines: Line[]) => {
  const count = new Map<number, number>();
  for (const l of lines) count.set(l.size, (count.get(l.size) ?? 0) + l.text.length);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;
};

/** Lines into headings and paragraphs: a paragraph ends at a bigger gap, a size change or an indent change. */
export function toParts(pages: Line[][], body: number): DocPart[] {
  const sizes = [...new Set(pages.flat().map((l) => l.size).filter((s) => s >= body * 1.2))].sort((a, b) => b - a);
  const level = (size: number): 1 | 2 | 3 => (Math.min(3, sizes.indexOf(size) + 1) || 3) as 1 | 2 | 3;
  const parts: DocPart[] = [];
  pages.forEach((lines, pi) => {
    if (pi > 0) parts.push({ kind: 'pagebreak' });
    let para: Line[] = [];
    const flush = () => {
      if (!para.length) return;
      const size = para[0]!.size;
      // Join lines; a hyphen at a line end that splits a word is removed.
      const text = para.map((l) => l.text).reduce((acc, t) => (acc.endsWith('-') && /^[a-z]/.test(t) ? acc.slice(0, -1) + t : `${acc} ${t}`));
      parts.push(size >= body * 1.2 && text.length < 160 ? { kind: 'heading', level: level(size), text } : { kind: 'para', text, size });
      para = [];
    };
    lines.forEach((line, i) => {
      const prev = lines[i - 1];
      const gap = prev ? prev.y - line.y : 0;
      const newPara = !prev || line.size !== prev.size || gap > Math.max(line.size, prev.size) * 1.65 || Math.abs(line.x - prev.x) > line.size * 2.5;
      if (newPara) flush();
      para.push(line);
    });
    flush();
  });
  return parts;
}

export async function pdfToDocx(bytes: Uint8Array, { title, password, onProgress }: { title: string; password?: string; onProgress?: (f: number) => void }): Promise<{ docx: Uint8Array; pages: number; words: number }> {
  const { openForView } = await loadRender();
  const doc = await openForView(bytes, password);
  try {
    const pages: Line[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const [a, b, , , x, y] = it.transform as number[];
        items.push({ str: it.str, x: x!, y: y!, size: Math.hypot(a!, b!), width: it.width });
      }
      pages.push(toLines(items));
      page.cleanup();
      onProgress?.(i / doc.numPages);
    }
    const all = pages.flat();
    const words = all.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
    if (words < 3) throw new FriendlyError('This PDF has no text to copy: it is probably a scan. Use “Text from scan (OCR)” first, then convert the searchable PDF.');
    const body = bodySizeOf(all);
    return { docx: writeDocx(toParts(pages, body), { title, bodySize: Math.round(body) }), pages: doc.numPages, words };
  } finally {
    await doc.loadingTask.destroy();
  }
}
