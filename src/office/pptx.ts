import { unzipSync } from 'fflate';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type RGB } from '@cantoo/pdf-lib';
import { all, find, kid, kids, parseXml, textOf, type XmlNode } from './xml';
import { drawable } from '../resume/pdf';
import { FriendlyError } from '../lib/errors';

/**
 * PowerPoint to PDF, one page per slide: text boxes, placeholders (with
 * positions, sizes and bullets inherited from the slide layout and master),
 * pictures, filled shapes, simple tables and backgrounds. Not drawn: charts,
 * SmartArt, gradients, effects and animations.
 */
const EMU_PER_PT = 12700;
const dir = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
function resolve(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dir(base) + target).split('/');
  const out: string[] = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
  return out.join('/');
}

export interface PptxResult { bytes: Uint8Array; slides: number; dropped: string[]; skipped: string[] }

interface Box { x: number; y: number; w: number; h: number }
type Transform = (b: Box) => Box;
interface Part { path: string; xml: XmlNode; rels: Record<string, string> }

export async function pptxToPdf(data: Uint8Array): Promise<PptxResult> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(data); } catch { throw new FriendlyError('This file isn’t a PowerPoint presentation (.pptx) Happy PDF can open.'); }
  const text = (path: string) => (files[path] ? new TextDecoder().decode(files[path]) : '');
  const part = (path: string): Part => {
    const relsPath = `${dir(path)}_rels/${path.slice(path.lastIndexOf('/') + 1)}.rels`;
    const rels: Record<string, string> = {};
    for (const r of all(parseXml(text(relsPath)), 'Relationship')) if (r.attrs.TargetMode !== 'External') rels[r.attrs.Id!] = resolve(path, r.attrs.Target!);
    return { path, xml: parseXml(text(path)), rels };
  };
  const pres = part('ppt/presentation.xml');
  if (!find(pres.xml, 'p:presentation')) throw new FriendlyError('This file isn’t a PowerPoint presentation (.pptx) Happy PDF can open.');
  const size = find(pres.xml, 'p:sldSz');
  const pw = Number(size?.attrs.cx ?? 9144000) / EMU_PER_PT, ph = Number(size?.attrs.cy ?? 6858000) / EMU_PER_PT;
  const slidePaths = all(find(pres.xml, 'p:sldIdLst'), 'p:sldId').map((s) => pres.rels[s.attrs['r:id']!]).filter((p): p is string => Boolean(p && files[p]));

  // Theme colours, for "scheme" colours used by masters and shapes.
  const themePath = Object.values(part(Object.values(pres.rels).find((p) => p.includes('slideMasters/')) ?? '').rels).find((p) => p.includes('theme/'));
  const scheme: Record<string, string> = {};
  for (const c of find(parseXml(themePath ? text(themePath) : ''), 'a:clrScheme')?.children ?? []) {
    const v = find(c, 'a:srgbClr')?.attrs.val ?? find(c, 'a:sysClr')?.attrs.lastClr;
    if (v) scheme[c.name.replace('a:', '')] = v;
  }
  const ALIAS: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
  const colorOf = (fill: XmlNode | undefined): RGB | null => {
    if (!fill) return null;
    const srgb = find(fill, 'a:srgbClr')?.attrs.val;
    const sch = find(fill, 'a:schemeClr')?.attrs.val;
    const hex = srgb ?? (sch ? scheme[ALIAS[sch] ?? sch] : undefined);
    if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return null;
    return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  };

  const doc = await PDFDocument.create();
  const [regular, bold, italic, boldItalic] = await Promise.all([StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique].map((f) => doc.embedFont(f)));
  const supported = new Set(regular!.getCharacterSet());
  const dropped = new Set<string>();
  const skipped = new Set<string>();
  const clean = (t: string) => { const r = drawable(t, supported); r.dropped.forEach((d) => dropped.add(d)); return r.text; };
  const fontFor = (b: boolean, i: boolean): PDFFont => (b ? (i ? boldItalic! : bold!) : (i ? italic! : regular!));
  const images = new Map<string, PDFImage | null>();
  const image = async (path: string) => {
    if (!images.has(path)) {
      const bytes = files[path];
      let img: PDFImage | null = null;
      try {
        if (bytes && /\.png$/i.test(path)) img = await doc.embedPng(bytes);
        else if (bytes && /\.jpe?g$/i.test(path)) img = await doc.embedJpg(bytes);
      } catch { img = null; }
      if (!img) skipped.add('pictures in formats other than PNG or JPG');
      images.set(path, img);
    }
    return images.get(path)!;
  };

  const xfrmBox = (n: XmlNode | undefined): Box | null => boxOf(find(n, 'a:xfrm'));
  const boxOf = (x: XmlNode | undefined): Box | null => {
    const off = kid(x, 'a:off'), ext = kid(x, 'a:ext');
    if (!off || !ext) return null;
    return { x: Number(off.attrs.x) / EMU_PER_PT, y: Number(off.attrs.y) / EMU_PER_PT, w: Number(ext.attrs.cx) / EMU_PER_PT, h: Number(ext.attrs.cy) / EMU_PER_PT };
  };
  const phOf = (sp: XmlNode) => find(kid(sp, 'p:nvSpPr') ?? kid(sp, 'p:nvPicPr'), 'p:ph');
  const phKind = (type: string | undefined) => (type === 'title' || type === 'ctrTitle' ? 'title' : type === 'subTitle' ? 'subTitle' : type ?? 'body');
  /** The matching placeholder in a layout or master: same index, else same kind. */
  const matchPh = (tree: XmlNode | undefined, ph: XmlNode, byIdx: boolean) => {
    const shapes = all(tree, 'p:sp');
    if (byIdx && ph.attrs.idx) { const m = shapes.find((s) => phOf(s)?.attrs.idx === ph.attrs.idx); if (m) return m; }
    const kind = phKind(ph.attrs.type);
    return shapes.find((s) => { const p = phOf(s); return p && (phKind(p.attrs.type) === kind || (kind === 'subTitle' && phKind(p.attrs.type) === 'body')); });
  };

  for (const slidePath of slidePaths) {
    const slide = part(slidePath);
    const layout = part(Object.values(slide.rels).find((p) => p.includes('slideLayouts/')) ?? '');
    const master = part(Object.values(layout.rels).find((p) => p.includes('slideMasters/')) ?? '');
    const page = doc.addPage([pw, ph]);

    // Background: the slide's own, else its layout's, else its master's.
    for (const src of [slide, layout, master]) {
      const bg = find(src.xml, 'p:bg');
      if (!bg) continue;
      const c = colorOf(kid(find(bg, 'p:bgPr'), 'a:solidFill')) ?? colorOf(find(bg, 'p:bgRef'));
      if (c) page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: c });
      break;
    }

    const styleFor = (kind: string) => find(find(master.xml, 'p:txStyles'), kind === 'title' ? 'p:titleStyle' : kind === 'other' ? 'p:otherStyle' : 'p:bodyStyle');
    const lvlProp = (styles: Array<XmlNode | undefined>, lvl: number, attr: string): string | undefined => {
      for (const s of styles) {
        const p = find(s, `a:lvl${lvl + 1}pPr`);
        const v = attr === 'sz' || attr === 'b' || attr === 'i' ? find(p, 'a:defRPr')?.attrs[attr] : p?.attrs[attr];
        if (v !== undefined) return v;
      }
      return undefined;
    };

    const drawShape = async (sp: XmlNode, t: Transform) => {
      const ph0 = phOf(sp);
      const lay = ph0 ? matchPh(find(layout.xml, 'p:spTree'), ph0, true) : undefined;
      const mas = ph0 ? matchPh(find(master.xml, 'p:spTree'), ph0, false) : undefined;
      const raw = xfrmBox(kid(sp, 'p:spPr')) ?? xfrmBox(kid(lay, 'p:spPr')) ?? xfrmBox(kid(mas, 'p:spPr'));
      if (!raw) return;
      const box = t(raw);
      const spPr = kid(sp, 'p:spPr');
      const fill = kid(spPr, 'a:noFill') ? null : colorOf(kid(spPr, 'a:solidFill')) ?? (kid(spPr, 'a:solidFill') ? null : colorOf(find(kid(sp, 'p:style'), 'a:fillRef')));
      if (fill && !ph0) page.drawRectangle({ x: box.x, y: ph - box.y - box.h, width: box.w, height: box.h, color: fill });
      const body = kid(sp, 'p:txBody');
      if (!body) return;
      const kind = ph0 ? phKind(ph0.attrs.type) : 'other';
      const styles = [kid(body, 'a:lstStyle'), kid(kid(lay, 'p:txBody'), 'a:lstStyle'), kid(kid(mas, 'p:txBody'), 'a:lstStyle'), styleFor(kind)];
      const bodyPr = [kid(body, 'a:bodyPr'), kid(kid(lay, 'p:txBody'), 'a:bodyPr'), kid(kid(mas, 'p:txBody'), 'a:bodyPr')];
      const anchor = bodyPr.map((b) => b?.attrs.anchor).find(Boolean) ?? 't';
      const wrap = bodyPr[0]?.attrs.wrap !== 'none';
      const scale = Number(find(bodyPr[0], 'a:normAutofit')?.attrs.fontScale ?? 100000) / 100000;
      const inset = { l: Number(bodyPr[0]?.attrs.lIns ?? 91440) / EMU_PER_PT, r: Number(bodyPr[0]?.attrs.rIns ?? 91440) / EMU_PER_PT, t: Number(bodyPr[0]?.attrs.tIns ?? 45720) / EMU_PER_PT, b: Number(bodyPr[0]?.attrs.bIns ?? 45720) / EMU_PER_PT };
      const textColor = colorOf(find(kid(sp, 'p:style'), 'a:fontRef')) ?? rgb(0, 0, 0);

      // Lay out paragraphs into lines of words.
      interface Word { text: string; font: PDFFont; size: number; color: RGB; space: boolean }
      const lines: Array<{ words: Word[]; align: string; bullet?: string; indent: number; size: number }> = [];
      const maxW = (wrap ? box.w : Infinity) - inset.l - inset.r;
      for (const p of kids(body, 'a:p')) {
        const pPr = kid(p, 'a:pPr');
        const lvl = Number(pPr?.attrs.lvl ?? 0);
        const align = pPr?.attrs.algn ?? lvlProp(styles, lvl, 'algn') ?? (kind === 'title' && ph0?.attrs.type === 'ctrTitle' ? 'ctr' : 'l');
        const defSz = Number(lvlProp(styles, lvl, 'sz') ?? 1800) / 100;
        const hasBullet = !kid(pPr, 'a:buNone') && (kid(pPr, 'a:buChar') || ((kind === 'body') && find(find(styles[3], `a:lvl${lvl + 1}pPr`), 'a:buChar')));
        const words: Word[] = [];
        let size = defSz * scale;
        for (const r of p.children) {
          if (r.name === 'a:br') { words.push({ text: '\n', font: regular!, size, color: textColor, space: false }); continue; }
          if (r.name !== 'a:r' && r.name !== 'a:fld') continue;
          const rPr = kid(r, 'a:rPr');
          size = Number(rPr?.attrs.sz ?? defSz * 100) / 100 * scale;
          const b = (rPr?.attrs.b ?? lvlProp(styles, lvl, 'b')) === '1';
          const i = (rPr?.attrs.i ?? lvlProp(styles, lvl, 'i')) === '1';
          const color = colorOf(kid(rPr, 'a:solidFill')) ?? textColor;
          for (const m of clean(textOf(kid(r, 'a:t'))).matchAll(/(\S+)(\s*)/g)) words.push({ text: m[1]!, font: fontFor(b, i), size, color, space: Boolean(m[2]) });
        }
        const indent = hasBullet ? size * 1.2 + lvl * size * 1.5 : lvl * size * 1.5;
        let line: Word[] = [];
        let w = 0;
        const push = (first: boolean) => lines.push({ words: line, align, bullet: first && hasBullet ? '•' : undefined, indent, size: Math.max(size, ...line.map((x) => x.size)) });
        let first = true;
        for (const word of words) {
          if (word.text === '\n') { push(first); first = false; line = []; w = 0; continue; }
          const ww = word.font.widthOfTextAtSize(word.text, word.size);
          const sw = word.font.widthOfTextAtSize(' ', word.size);
          if (line.length && w + ww > maxW - indent) { push(first); first = false; line = []; w = 0; }
          line.push(word);
          w += ww + (word.space ? sw : 0);
        }
        push(first);
      }
      const total = lines.reduce((n, l) => n + l.size * 1.2, 0);
      const inner = box.h - inset.t - inset.b;
      let y = box.y + inset.t + (anchor === 'ctr' ? (inner - total) / 2 : anchor === 'b' ? inner - total : 0);
      for (const l of lines) {
        y += l.size * 1.2;
        const widths = l.words.map((w) => w.font.widthOfTextAtSize(w.text, w.size));
        const lw = widths.reduce((a, b, i) => a + b + (i < l.words.length - 1 && l.words[i]!.space ? l.words[i]!.font.widthOfTextAtSize(' ', l.words[i]!.size) : 0), 0);
        const avail = box.w - inset.l - inset.r - l.indent;
        let x = box.x + inset.l + l.indent + (l.align === 'ctr' ? (avail - lw) / 2 : l.align === 'r' ? avail - lw : 0);
        const baseline = ph - y + l.size * 0.2;
        if (l.bullet) page.drawText(l.bullet, { x: x - l.size * 1.1, y: baseline, size: l.size, font: regular!, color: l.words[0]?.color ?? textColor });
        l.words.forEach((w, i) => {
          page.drawText(w.text, { x, y: baseline, size: w.size, font: w.font, color: w.color });
          x += widths[i]! + (w.space ? w.font.widthOfTextAtSize(' ', w.size) : 0);
        });
      }
    };

    const drawPic = async (pic: XmlNode, t: Transform) => {
      const raw = xfrmBox(kid(pic, 'p:spPr'));
      const embed = find(pic, 'a:blip')?.attrs['r:embed'];
      if (!raw || !embed || !slide.rels[embed]) return;
      const img = await image(slide.rels[embed]!);
      if (!img) return;
      const b = t(raw);
      page.drawImage(img, { x: b.x, y: ph - b.y - b.h, width: b.w, height: b.h });
    };

    const drawTable = (frame: XmlNode, t: Transform) => {
      const raw = boxOf(kid(frame, 'p:xfrm'));
      const tbl = find(frame, 'a:tbl');
      if (!raw || !tbl) { skipped.add('charts and SmartArt'); return; }
      const b = t(raw);
      const cols = all(find(tbl, 'a:tblGrid'), 'a:gridCol').map((c) => Number(c.attrs.w) / EMU_PER_PT);
      let y = b.y;
      for (const row of kids(tbl, 'a:tr')) {
        const h = Number(row.attrs.h) / EMU_PER_PT;
        let x = b.x;
        kids(row, 'a:tc').forEach((cell, c) => {
          const w = cols[c] ?? 50;
          page.drawRectangle({ x, y: ph - y - h, width: w, height: h, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.6 });
          const label = clean(all(cell, 'a:t').map(textOf).join(' ').trim());
          const size = Math.min(14, Math.max(7, h * 0.4));
          let s = label;
          while (s && regular!.widthOfTextAtSize(s, size) > w - 8) s = s.slice(0, -1);
          if (s) page.drawText(s, { x: x + 4, y: ph - y - h / 2 - size * 0.35, size, font: regular!, color: rgb(0, 0, 0) });
          x += w;
        });
        y += h;
      }
    };

    const walk = async (tree: XmlNode | undefined, t: Transform) => {
      for (const n of tree?.children ?? []) {
        if (n.name === 'p:sp') await drawShape(n, t);
        else if (n.name === 'p:pic') await drawPic(n, t);
        else if (n.name === 'p:graphicFrame') drawTable(n, t);
        else if (n.name === 'p:grpSp') {
          const x = find(kid(n, 'p:grpSpPr'), 'a:xfrm');
          const off = kid(x, 'a:off'), ext = kid(x, 'a:ext'), chOff = kid(x, 'a:chOff'), chExt = kid(x, 'a:chExt');
          if (!off || !ext || !chOff || !chExt) { await walk(n, t); continue; }
          const sx = Number(ext.attrs.cx) / Math.max(1, Number(chExt.attrs.cx)), sy = Number(ext.attrs.cy) / Math.max(1, Number(chExt.attrs.cy));
          const ox = Number(off.attrs.x) / EMU_PER_PT, oy = Number(off.attrs.y) / EMU_PER_PT, cx = Number(chOff.attrs.x) / EMU_PER_PT, cy = Number(chOff.attrs.y) / EMU_PER_PT;
          await walk(n, (b) => t({ x: ox + (b.x - cx) * sx, y: oy + (b.y - cy) * sy, w: b.w * sx, h: b.h * sy }));
        } else if (n.name === 'mc:AlternateContent') await walk(kid(n, 'mc:Fallback'), t);
      }
    };
    await walk(find(slide.xml, 'p:spTree'), (b) => b);
  }

  doc.setCreator('Happy PDF');
  doc.setProducer('Happy PDF');
  return { bytes: await doc.save(), slides: slidePaths.length, dropped: [...dropped], skipped: [...skipped] };
}

