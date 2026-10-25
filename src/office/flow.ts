import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib';
import { drawable } from '../resume/pdf';

/**
 * Lays out flowing content (headings, styled text, lists, tables, pictures)
 * on pages and writes a real text PDF: words stay selectable and searchable.
 * Word and Excel files are read into these blocks first.
 */
export interface Run { text: string; bold?: boolean; italic?: boolean; underline?: boolean }

export type Block =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'para'; runs: Run[]; align?: 'left' | 'center' | 'right'; indent?: number; marker?: string }
  | { kind: 'table'; rows: Run[][][]; header?: boolean; widths?: number[]; align?: Array<'left' | 'right'>; fullWidth?: boolean }
  | { kind: 'image'; bytes: Uint8Array; format: 'png' | 'jpg'; width: number; height: number }
  | { kind: 'pagebreak' };

export interface FlowOptions {
  /** Page size in points, portrait. */
  paper?: [number, number];
  landscape?: boolean;
  margin?: number;
  fontSize?: number;
  serif?: boolean;
  title?: string;
}

export interface FlowResult { bytes: Uint8Array; pages: number; dropped: string[]; skippedImages: number }

export const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.1, 0.1, 0.1);
const RULE = rgb(0.6, 0.6, 0.6);
const HEADER_FILL = rgb(0.94, 0.93, 0.9);
const HEADING_SIZE = [0, 20, 16, 13.5, 12, 11.5, 11];

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }
interface Token { text: string; font: PDFFont; size: number; underline: boolean; width: number; space: number; br: boolean }

export async function renderFlow(blocks: Block[], options: FlowOptions = {}): Promise<FlowResult> {
  const doc = await PDFDocument.create();
  const families = options.serif
    ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic]
    : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique];
  const [regular, bold, italic, boldItalic] = await Promise.all(families.map((f) => doc.embedFont(f)));
  const fonts: Fonts = { regular: regular!, bold: bold!, italic: italic!, boldItalic: boldItalic! };
  const supported = new Set(fonts.regular.getCharacterSet());
  const dropped = new Set<string>();
  const clean = (t: string) => { const r = drawable(t, supported); r.dropped.forEach((d) => dropped.add(d)); return r.text; };
  const fontOf = (r: Run, forceBold = false) => ((r.bold || forceBold) ? (r.italic ? fonts.boldItalic : fonts.bold) : (r.italic ? fonts.italic : fonts.regular));

  const portrait = options.paper ?? A4;
  const [pw, ph] = options.landscape ? [portrait[1], portrait[0]] : portrait;
  const margin = options.margin ?? 56;
  const base = options.fontSize ?? 11;
  const left = margin, right = pw - margin, width = right - left;
  let page: PDFPage = doc.addPage([pw, ph]);
  let y = ph - margin;
  let skippedImages = 0;
  const newPage = () => { page = doc.addPage([pw, ph]); y = ph - margin; };
  const room = () => y - margin;

  /** Splits runs into measured words; "\n" forces a line break. */
  const tokenize = (runs: Run[], size: number, forceBold = false): Token[] => {
    const out: Token[] = [];
    for (const r of runs) {
      const font = fontOf(r, forceBold);
      for (const piece of clean(r.text).split(/(\n)/)) {
        if (piece === '\n') { out.push({ text: '', font, size, underline: false, width: 0, space: 0, br: true }); continue; }
        for (const m of piece.matchAll(/(\S+)(\s*)|(\s+)/g)) {
          if (m[3]) { // leading spaces glue onto the previous word
            const prev = out[out.length - 1];
            if (prev && !prev.br) prev.space += font.widthOfTextAtSize(' ', size);
            continue;
          }
          out.push({ text: m[1]!, font, size, underline: Boolean(r.underline), width: font.widthOfTextAtSize(m[1]!, size), space: m[2] ? font.widthOfTextAtSize(' ', size) : 0, br: false });
        }
      }
    }
    return out;
  };

  /** Breaks tokens into lines no wider than `max`, splitting words that are wider than a line. */
  const lineUp = (tokens: Token[], limit: number): Token[][] => {
    // A hair of tolerance: a column sized exactly to its widest word must not wrap on rounding.
    const max = limit + 0.01;
    const lines: Token[][] = [[]];
    let w = 0;
    for (const t of tokens) {
      if (t.br) { lines.push([]); w = 0; continue; }
      let tok = t;
      while (tok.width > max) { // a URL or a long number: cut it by characters
        let cut = tok.text.length - 1;
        while (cut > 1 && tok.font.widthOfTextAtSize(tok.text.slice(0, cut), tok.size) > max) cut--;
        const head = { ...tok, text: tok.text.slice(0, cut), width: tok.font.widthOfTextAtSize(tok.text.slice(0, cut), tok.size), space: 0 };
        if (lines[lines.length - 1]!.length) lines.push([]);
        lines[lines.length - 1]!.push(head);
        lines.push([]);
        w = 0;
        const rest = tok.text.slice(cut);
        tok = { ...tok, text: rest, width: tok.font.widthOfTextAtSize(rest, tok.size) };
      }
      const line = lines[lines.length - 1]!;
      if (line.length && w + tok.width > max) { lines.push([tok]); w = tok.width + tok.space; } else { line.push(tok); w += tok.width + tok.space; }
    }
    return lines.filter((l, i) => l.length || i < lines.length - 1);
  };
  const lineWidth = (line: Token[]) => line.reduce((n, t, i) => n + t.width + (i < line.length - 1 ? t.space : 0), 0);
  const lineHeight = (line: Token[], fallback: number) => Math.max(fallback, ...line.map((t) => t.size)) * 1.3;

  const drawLine = (line: Token[], x: number, baseline: number) => {
    let cx = x;
    for (const t of line) {
      if (t.text) page.drawText(t.text, { x: cx, y: baseline, size: t.size, font: t.font, color: INK });
      if (t.underline) page.drawLine({ start: { x: cx, y: baseline - t.size * 0.12 }, end: { x: cx + t.width, y: baseline - t.size * 0.12 }, thickness: t.size * 0.06, color: INK });
      cx += t.width + t.space;
    }
  };

  const paragraph = (runs: Run[], size: number, { indent = 0, align = 'left', marker, forceBold = false, before = 0, after = size * 0.55 }: { indent?: number; align?: string; marker?: string; forceBold?: boolean; before?: number; after?: number } = {}) => {
    const lines = lineUp(tokenize(runs, size, forceBold), width - indent);
    if (!lines.some((l) => l.length)) { y -= size * 0.8; return; } // an empty paragraph is a blank line
    if (y < ph - margin - 1) y -= before;
    lines.forEach((line, i) => {
      const lh = lineHeight(line, size);
      if (room() < lh) newPage();
      y -= lh * 0.8;
      const lw = lineWidth(line);
      const x = align === 'center' ? left + indent + (width - indent - lw) / 2 : align === 'right' ? right - lw : left + indent;
      if (i === 0 && marker) page.drawText(clean(marker), { x: left + indent - size * 1.4, y, size, font: fonts.regular, color: INK });
      drawLine(line, x, y);
      y -= lh * 0.2;
    });
    y -= after;
  };

  const table = (block: Extract<Block, { kind: 'table' }>) => {
    const cols = Math.max(0, ...block.rows.map((r) => r.length));
    if (!cols) return;
    const pad = 4;
    let size = Math.min(base, 10);
    // Natural column widths from the longest line in each column, scaled to fit the page.
    const measure = (s: number) => {
      const natural = new Array<number>(cols).fill(0), longestWord = new Array<number>(cols).fill(0);
      block.rows.forEach((row, ri) => row.forEach((cell, c) => {
        for (const line of cell.flatMap((r) => clean(r.text).split('\n').map((t) => ({ t, f: fontOf(r, block.header && ri === 0) })))) {
          natural[c] = Math.max(natural[c]!, line.f.widthOfTextAtSize(line.t, s) + pad * 2 + 1);
          for (const w of line.t.split(/\s+/)) longestWord[c] = Math.max(longestWord[c]!, Math.min(line.f.widthOfTextAtSize(w, s) + pad * 2, width / 3));
        }
      }));
      return { natural: natural.map((n, i) => Math.max(n, 18, block.widths ? (block.widths[i] ?? 0) * s * 0.55 : 0)), longestWord };
    };
    let m = measure(size);
    while (size > 6 && m.longestWord.reduce((a, b) => a + b, 0) > width) { size -= 0.5; m = measure(size); }
    const total = m.natural.reduce((a, b) => a + b, 0);
    let colW = total <= width ? m.natural : m.natural.map((n, i) => Math.max(m.longestWord[i]!, (n / total) * width));
    const sum = colW.reduce((a, b) => a + b, 0);
    if (sum > width || block.fullWidth) colW = colW.map((w) => (w / sum) * width);

    const layoutRow = (row: Run[][], header: boolean) => {
      const cells = Array.from({ length: cols }, (_, c) => lineUp(tokenize(row[c] ?? [], size, header), colW[c]! - pad * 2));
      const h = Math.max(...cells.map((ls) => ls.reduce((n, l) => n + lineHeight(l, size), 0))) + pad * 2;
      return { cells, h: Math.max(h, size * 1.3 + pad * 2) };
    };
    const drawRow = (laid: ReturnType<typeof layoutRow>, header: boolean) => {
      if (room() < laid.h) newPage();
      let x = left;
      const top = y;
      laid.cells.forEach((lines, c) => {
        const w = colW[c]!;
        if (header) page.drawRectangle({ x, y: top - laid.h, width: w, height: laid.h, color: HEADER_FILL });
        page.drawRectangle({ x, y: top - laid.h, width: w, height: laid.h, borderColor: RULE, borderWidth: 0.5 });
        let cy = top - pad;
        for (const line of lines) {
          const lh = lineHeight(line, size);
          cy -= lh * 0.8;
          const lw = lineWidth(line);
          drawLine(line, block.align?.[c] === 'right' && !header ? x + w - pad - lw : x + pad, cy);
          cy -= lh * 0.2;
        }
        x += w;
      });
      y = top - laid.h;
    };
    const header = block.header && block.rows.length > 1 ? layoutRow(block.rows[0]!, true) : null;
    if (room() < (header?.h ?? 0) + size * 3) newPage();
    if (header) drawRow(header, true);
    for (const row of block.rows.slice(header ? 1 : 0)) {
      const laid = layoutRow(row, false);
      if (room() < laid.h) { newPage(); if (header) drawRow(header, true); } // repeat the header on each page
      drawRow(laid, false);
    }
    y -= base * 0.8;
  };

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading': {
        const size = HEADING_SIZE[Math.min(6, Math.max(1, block.level))]!;
        if (room() < size * 4) newPage();
        paragraph(block.runs, size, { forceBold: true, before: size * 0.6, after: size * 0.35 });
        break;
      }
      case 'para':
        paragraph(block.runs, base, { indent: (block.indent ?? 0) + (block.marker ? base * 1.6 : 0), align: block.align, marker: block.marker });
        break;
      case 'table':
        table(block);
        break;
      case 'image': {
        let img;
        try { img = block.format === 'png' ? await doc.embedPng(block.bytes) : await doc.embedJpg(block.bytes); } catch { skippedImages++; break; }
        let w = block.width * 0.75, h = block.height * 0.75; // CSS pixels to points
        const k = Math.min(1, width / w, (ph - margin * 2) * 0.6 / h);
        w *= k; h *= k;
        if (room() < h) newPage();
        y -= h;
        page.drawImage(img, { x: left, y, width: w, height: h });
        y -= base * 0.8;
        break;
      }
      case 'pagebreak':
        if (y < ph - margin - 1) newPage();
        break;
    }
  }

  if (options.title) doc.setTitle(options.title);
  doc.setCreator('Happy PDF');
  doc.setProducer('Happy PDF');
  return { bytes: await doc.save(), pages: doc.getPageCount(), dropped: [...dropped], skippedImages };
}
