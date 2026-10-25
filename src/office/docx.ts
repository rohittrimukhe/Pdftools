import { parseXml, type XmlNode } from './xml';
import type { Block, Run } from './flow';
import { FriendlyError } from '../lib/errors';

/**
 * Word (.docx) to flowing blocks. mammoth reads the document's structure
 * (headings, lists, tables, pictures, bold and italic); this turns its HTML
 * into blocks for the page layout. Fonts, colours and exact spacing are not
 * kept: the result is a clean, readable PDF of the same content.
 */
export interface DocxRead { blocks: Block[]; warnings: string[] }

export async function readDocx(data: Uint8Array): Promise<DocxRead> {
  const { default: mammoth } = await import('mammoth/mammoth.browser.js');
  let result;
  try {
    // A page break in Word becomes an <hr>, which turns into a page break here.
    result = await mammoth.convertToHtml({ arrayBuffer: data.slice().buffer }, { styleMap: ['br[type=\'page\'] => hr.page-break'] });
  } catch {
    throw new FriendlyError('This file isn’t a Word document (.docx) Happy PDF can open. Old .doc files need saving as .docx first.');
  }
  return { blocks: htmlToBlocks(result.value), warnings: result.messages.filter((m) => m.type === 'warning').map((m) => m.message) };
}

const dataUrl = /^data:image\/(png|jpe?g);base64,(.+)$/i;
function base64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/** Width and height of a PNG or JPEG from its header. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  for (let i = 2; i < bytes.length - 9;) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! };
    i += 2 + len;
  }
  return null;
}

/** Text runs inside an element, keeping bold, italic and underline; <br> becomes a line break. */
function runsOf(node: XmlNode, style: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = [];
  for (const c of node.children) {
    if (c.name === '#text') { if (c.text) out.push({ text: c.text.replace(/\s+/g, ' '), ...style }); continue; }
    const tag = c.name.toLowerCase();
    if (tag === 'br') { out.push({ text: '\n', ...style }); continue; }
    if (tag === 'img') continue;
    const next = { ...style, ...(tag === 'strong' || tag === 'b' ? { bold: true } : {}), ...(tag === 'em' || tag === 'i' ? { italic: true } : {}), ...(tag === 'u' ? { underline: true } : {}) };
    out.push(...runsOf(c, next));
  }
  return out;
}
const isEmpty = (runs: Run[]) => runs.every((r) => !r.text.trim());

export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const images = (n: XmlNode) => {
    for (const img of all(n, 'img')) {
      const m = (img.attrs.src ?? '').match(dataUrl);
      if (!m) continue;
      const bytes = base64(m[2]!);
      const size = imageSize(bytes);
      if (size) blocks.push({ kind: 'image', bytes, format: m[1]!.toLowerCase() === 'png' ? 'png' : 'jpg', width: size.width, height: size.height });
    }
  };
  const list = (n: XmlNode, ordered: boolean, depth: number) => {
    let i = 0;
    for (const li of n.children.filter((c) => c.name.toLowerCase() === 'li')) {
      i++;
      const own: XmlNode = { ...li, children: li.children.filter((c) => !['ul', 'ol'].includes(c.name.toLowerCase())) };
      blocks.push({ kind: 'para', runs: runsOf(own), marker: ordered ? `${i}.` : depth % 2 ? '–' : '•', indent: depth * 18 });
      for (const sub of li.children) if (['ul', 'ol'].includes(sub.name.toLowerCase())) list(sub, sub.name.toLowerCase() === 'ol', depth + 1);
    }
  };
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      const tag = c.name.toLowerCase();
      const h = tag.match(/^h([1-6])$/);
      if (h) { blocks.push({ kind: 'heading', level: Number(h[1]), runs: runsOf(c) }); continue; }
      if (tag === 'p') {
        const runs = runsOf(c);
        if (!isEmpty(runs)) blocks.push({ kind: 'para', runs });
        images(c);
        // mammoth puts a Word page break inside a paragraph: <p><hr class="page-break" /></p>.
        if (all(c, 'hr').length) blocks.push({ kind: 'pagebreak' });
        continue;
      }
      if (tag === 'ul' || tag === 'ol') { list(c, tag === 'ol', 0); continue; }
      if (tag === 'table') {
        const rows = all(c, 'tr').map((tr) => tr.children.filter((td) => /^t[dh]$/i.test(td.name)).map((td) => {
          // A cell can hold several paragraphs: keep them as lines.
          const paras = td.children.filter((x) => x.name.toLowerCase() === 'p');
          const runs = paras.length ? paras.flatMap((p, i) => [...(i ? [{ text: '\n' }] : []), ...runsOf(p)]) : runsOf(td);
          return runs;
        }));
        const header = Boolean(find(c, 'th')) || Boolean(find(c, 'thead'));
        blocks.push({ kind: 'table', rows, header, fullWidth: true }); // Word's default table spans the page
        continue;
      }
      if (tag === 'hr') { blocks.push({ kind: 'pagebreak' }); continue; }
      if (tag === 'img') { images({ ...c, children: [c] }); continue; }
      if (c.children.length) walk(c);
    }
  };
  walk(parseXml(html));
  return blocks;
}

/** Like xml.ts `all`, but HTML tag names are compared without case. */
function all(n: XmlNode, name: string, out: XmlNode[] = []): XmlNode[] {
  for (const c of n.children) { if (c.name.toLowerCase() === name) out.push(c); all(c, name, out); }
  return out;
}
const find = (n: XmlNode, name: string) => all(n, name)[0];
