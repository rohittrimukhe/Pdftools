import { unzipSync } from 'fflate';
import { all, find, kid, kids, parseXml, textOf } from './xml';
import type { Block, Run } from './flow';
import { FriendlyError } from '../lib/errors';

/**
 * Reads an Excel workbook (.xlsx) into tables, one per visible sheet, with
 * values shown the way Excel shows them: saved formula results, number
 * formats (decimals, thousands, percent, dates), bold header cells.
 */
export interface Sheet { name: string; rows: string[][]; bold: boolean[][]; widths: number[]; numeric: boolean[] }

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const BUILTIN: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd-mm-yyyy', 15: 'd-mmm-yy', 16: 'd-mmm',
  17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'dd-mm-yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;(#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;(#,##0.00)', 49: '@',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Excel serial date (days since 1899-12-30) to a date. */
const excelDate = (serial: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));

/** Shows a number the way its Excel format asks, for the formats people use. */
export function formatNumber(value: number, code: string): string {
  // Excel's second format section is for negative numbers, shown without a minus unless it says so.
  const sections = code.split(';');
  const negativeSection = value < 0 && sections.length > 1;
  const fmt = sections[negativeSection ? 1 : 0]!.replace(/"[^"]*"|\\.|\[[^\]]*\]|_.|\*./g, (m) => (m.startsWith('"') ? m.slice(1, -1) : m.startsWith('\\') ? m.slice(1) : ''));
  const v = negativeSection ? -value : value;
  if (/^general$/i.test(fmt.trim()) || fmt.trim() === '' || fmt === '@') {
    return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(11)));
  }
  if (/[dmyhs]/i.test(fmt) && !/[0#]/.test(fmt)) {
    const d = excelDate(v);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = d.getUTCHours();
    const ampm = /AM\/PM/i.test(fmt);
    return fmt
      .replace(/yyyy/gi, String(d.getUTCFullYear())).replace(/yy/gi, String(d.getUTCFullYear()).slice(2))
      .replace(/mmmm/gi, MONTHS[d.getUTCMonth()]!).replace(/mmm/gi, MONTHS[d.getUTCMonth()]!)
      .replace(/(h+)(:)mm/gi, (_m, h: string, c: string) => `${h}${c}${pad(d.getUTCMinutes())}`)
      .replace(/mm/gi, pad(d.getUTCMonth() + 1)).replace(/(?<![a-z])m(?![a-z])/gi, String(d.getUTCMonth() + 1))
      .replace(/dd/gi, pad(d.getUTCDate())).replace(/(?<![a-z])d(?![a-z])/gi, String(d.getUTCDate()))
      .replace(/hh?/gi, String(ampm ? (hours % 12 || 12) : hours)).replace(/ss/gi, pad(d.getUTCSeconds()))
      .replace(/AM\/PM/gi, hours < 12 ? 'AM' : 'PM');
  }
  const percent = fmt.includes('%');
  const n = percent ? v * 100 : v;
  const decimals = (fmt.match(/\.([0#]+)/)?.[1] ?? '').length;
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: fmt.includes(',') });
  const prefix = (fmt.match(/^[^0#.,%]*/)?.[0] ?? '').replace(/[()-]/g, '').trim(); // a currency sign such as ₹ or $
  const signed = negativeSection ? (fmt.includes('(') ? `(${body})` : fmt.includes('-') ? `-${body}` : body) : n < 0 ? `-${body}` : body;
  return `${prefix}${signed}${percent ? '%' : ''}`;
}

export function readXlsx(data: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(data); } catch { throw new FriendlyError('This file isn’t an Excel workbook (.xlsx) Happy PDF can open.'); }
  const xml = (path: string) => parseXml(files[path] ? new TextDecoder().decode(files[path]) : '');
  const book = xml('xl/workbook.xml');
  if (!find(book, 'workbook')) throw new FriendlyError('This file isn’t an Excel workbook (.xlsx) Happy PDF can open.');
  const rels: Record<string, string> = {};
  for (const r of all(xml('xl/_rels/workbook.xml.rels'), 'Relationship')) rels[r.attrs.Id!] = r.attrs.Target!.replace(/^\/?(xl\/)?/, 'xl/');
  const shared = kids(find(xml('xl/sharedStrings.xml'), 'sst'), 'si').map((si) => all(si, 't').map(textOf).join(''));

  // Number format and boldness per cell style.
  const styles = xml('xl/styles.xml');
  const custom: Record<string, string> = {};
  for (const f of all(find(styles, 'numFmts'), 'numFmt')) custom[f.attrs.numFmtId!] = f.attrs.formatCode!;
  const fonts = kids(find(styles, 'fonts'), 'font').map((f) => { const b = kid(f, 'b'); return Boolean(b && b.attrs.val !== '0' && b.attrs.val !== 'false'); });
  const xfs = kids(find(styles, 'cellXfs'), 'xf').map((xf) => {
    const id = Number(xf.attrs.numFmtId ?? 0);
    return { format: custom[id] ?? BUILTIN[id] ?? 'General', bold: fonts[Number(xf.attrs.fontId ?? 0)] ?? false };
  });

  const sheets: Sheet[] = [];
  for (const s of all(find(book, 'sheets'), 'sheet')) {
    if (s.attrs.state === 'hidden' || s.attrs.state === 'veryHidden') continue;
    const path = rels[s.attrs['r:id']!];
    if (!path || !files[path]) continue;
    const ws = xml(path);
    const rows: string[][] = [];
    const bold: boolean[][] = [];
    const numericCount: number[] = [];
    const textCount: number[] = [];
    for (const row of all(find(ws, 'sheetData'), 'row')) {
      const r = Number(row.attrs.r ?? rows.length + 1) - 1;
      if (r > 5000) break; // keep huge sheets printable
      for (const c of kids(row, 'c')) {
        const col = c.attrs.r ? colIndex(c.attrs.r) : (rows[r]?.length ?? 0);
        if (col > 60) continue;
        const style = xfs[Number(c.attrs.s ?? 0)] ?? { format: 'General', bold: false };
        const v = textOf(kid(c, 'v'));
        let text = '';
        let numeric = false;
        switch (c.attrs.t) {
          case 's': text = shared[Number(v)] ?? ''; break;
          case 'inlineStr': text = all(kid(c, 'is'), 't').map(textOf).join(''); break;
          case 'str': text = v; break;
          case 'b': text = v === '1' ? 'TRUE' : 'FALSE'; break;
          case 'e': text = v; break;
          default: if (v !== '') { text = formatNumber(Number(v), style.format); numeric = true; }
        }
        (rows[r] ??= [])[col] = text;
        (bold[r] ??= [])[col] = style.bold;
        if (text) { if (numeric) numericCount[col] = (numericCount[col] ?? 0) + 1; else textCount[col] = (textCount[col] ?? 0) + 1; }
      }
    }
    // Drop empty rows and columns at the edges; fill gaps so every row has every column.
    const used = rows.map((r) => r?.some((v) => v) ?? false);
    const first = used.indexOf(true), last = used.lastIndexOf(true);
    if (first < 0) { sheets.push({ name: s.attrs.name ?? 'Sheet', rows: [], bold: [], widths: [], numeric: [] }); continue; }
    const cols = Math.max(...rows.slice(first, last + 1).map((r) => (r ?? []).reduce((n, v, i) => (v ? i + 1 : n), 0)));
    const widths: number[] = [];
    for (const c of all(find(ws, 'cols'), 'col')) for (let i = Number(c.attrs.min) - 1; i < Math.min(cols, Number(c.attrs.max)); i++) widths[i] = Number(c.attrs.width);
    const grid = (src: Array<Array<string | boolean> | undefined>, empty: string | boolean) =>
      src.slice(first, last + 1).map((r) => Array.from({ length: cols }, (_, i) => r?.[i] ?? empty));
    sheets.push({
      name: s.attrs.name ?? 'Sheet',
      rows: grid(rows, '') as string[][],
      bold: grid(bold, false) as boolean[][],
      widths: Array.from({ length: cols }, (_, i) => widths[i] ?? 0),
      numeric: Array.from({ length: cols }, (_, i) => (numericCount[i] ?? 0) > (textCount[i] ?? 0)),
    });
  }
  if (!sheets.length) throw new FriendlyError('This workbook has no visible sheets.');
  return sheets;
}

/** One heading and one table per sheet, each sheet from a new page. */
export function sheetsToBlocks(sheets: Sheet[]): Block[] {
  const blocks: Block[] = [];
  sheets.forEach((sheet, i) => {
    if (i > 0) blocks.push({ kind: 'pagebreak' });
    blocks.push({ kind: 'heading', level: 3, runs: [{ text: sheet.name }] });
    if (!sheet.rows.length) { blocks.push({ kind: 'para', runs: [{ text: 'This sheet is empty.', italic: true }] }); return; }
    const rows: Run[][][] = sheet.rows.map((row, r) => row.map((text, c) => [{ text, bold: sheet.bold[r]?.[c] ?? false }]));
    const header = sheet.rows.length > 1 && sheet.bold[0]!.some(Boolean);
    blocks.push({ kind: 'table', rows, header, widths: sheet.widths, align: sheet.numeric.map((n) => (n ? 'right' : 'left')) });
  });
  return blocks;
}
