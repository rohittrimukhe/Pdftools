import { PdfError } from './errors';

/**
 * Parses what people type for pages: "1-3, 5, 8-" (8 to the end), "-2" (1 to 2),
 * "last", "2-last". Page numbers are 1-based in the text and 0-based in the result.
 * Each comma-separated part becomes one group, in the order typed.
 */
export function parsePageGroups(text: string, pageCount: number): number[][] {
  const parts = text.split(/[,;]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) throw new PdfError('bad-range', 'Type the pages you want, for example 1-3, 5.');
  const toPage = (token: string, fallback: number): number => {
    if (token === '') return fallback;
    if (token === 'last' || token === 'end') return pageCount;
    if (!/^\d+$/.test(token)) throw new PdfError('bad-range', `“${token}” isn’t a page number.`);
    return Number(token);
  };
  return parts.map((part) => {
    const [a = '', b, ...rest] = part.split(/\s*[-–]\s*/);
    if (rest.length) throw new PdfError('bad-range', `“${part}” has too many dashes.`);
    const start = toPage(a, 1);
    const end = b === undefined ? start : toPage(b, pageCount);
    for (const n of [start, end]) {
      if (n < 1 || n > pageCount) throw new PdfError('bad-range', `Page ${n} doesn’t exist. This PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}.`);
    }
    if (end < start) throw new PdfError('bad-range', `“${part}” runs backwards. Write it as ${end}-${start}.`);
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  });
}

/** All pages from the text, once each, in the order typed. */
export function parsePageList(text: string, pageCount: number): number[] {
  return [...new Set(parsePageGroups(text, pageCount).flat())];
}

/** Groups of `size` pages: 10 pages by 4 → [0-3], [4-7], [8-9]. */
export function chunkPages(pageCount: number, size: number): number[][] {
  if (!Number.isInteger(size) || size < 1) throw new PdfError('bad-range', 'Pages per file must be 1 or more.');
  const groups: number[][] = [];
  for (let i = 0; i < pageCount; i += size) groups.push(Array.from({ length: Math.min(size, pageCount - i) }, (_, j) => i + j));
  return groups;
}
