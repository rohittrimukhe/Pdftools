import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib';
import { PdfError, damaged, passwordRequired, wrongPassword } from './errors';

export type Bytes = Uint8Array | ArrayBuffer;

/** Opens a PDF, decrypting it when a password is given. Turns library errors into ones people can act on. */
export async function openPdf(bytes: Bytes, password?: string): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    doc = password === undefined
      ? await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
      : await PDFDocument.load(bytes, { password, updateMetadata: false });
  } catch (error) {
    if (password !== undefined && /password/i.test(String(error))) throw wrongPassword();
    if (/No PDF header found|Failed to parse/i.test(String(error))) throw new PdfError('not-pdf', 'This file isn’t a PDF.');
    throw damaged();
  }
  if (doc.getPageCount() === 0) throw damaged();
  if (password === undefined && doc.isEncrypted) {
    // Many PDFs are "encrypted" with an empty user password: they open without one.
    try {
      return await PDFDocument.load(bytes, { password: '', updateMetadata: false });
    } catch {
      throw passwordRequired();
    }
  }
  return doc;
}

export async function pageCount(bytes: Bytes, password?: string): Promise<number> {
  return (await openPdf(bytes, password)).getPageCount();
}

const save = (doc: PDFDocument) => doc.save({ useObjectStreams: true });

/** Joins PDFs in the given order. */
export async function mergePdfs(files: Bytes[]): Promise<Uint8Array> {
  if (files.length === 0) throw new PdfError('empty', 'Add at least one PDF.');
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await openPdf(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  return save(out);
}

export interface PagePick {
  /** 0-based page index in the source. */
  index: number;
  /** Extra clockwise rotation: 0, 90, 180 or 270. */
  rotate?: number;
}

/** A new PDF from chosen pages, in the order given, each optionally rotated. Organise, extract and delete use this. */
export async function rebuildPdf(bytes: Bytes, picks: PagePick[], password?: string): Promise<Uint8Array> {
  if (picks.length === 0) throw new PdfError('empty', 'Keep at least one page.');
  const src = await openPdf(bytes, password);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, picks.map((p) => p.index));
  pages.forEach((page, i) => {
    const extra = picks[i]?.rotate ?? 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });
  return save(out);
}

/** One PDF per group of 0-based page indices. */
export async function splitPdf(bytes: Bytes, groups: number[][], password?: string): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (const group of groups) out.push(await rebuildPdf(bytes, group.map((index) => ({ index })), password));
  return out;
}

/** Visible size of a page as the reader sees it (rotation applied). */
function viewSize(page: PDFPage) {
  const { width, height } = page.getSize();
  const turned = page.getRotation().angle % 180 !== 0;
  return turned ? { width: height, height: width } : { width, height };
}

/**
 * Maps a point in the page as the reader sees it (origin bottom-left, after
 * rotation) to the page's own coordinates, so text and images land upright.
 */
function placeOnPage(page: PDFPage, x: number, y: number) {
  const { width, height } = page.getSize();
  switch (page.getRotation().angle % 360) {
    case 90: return { x: width - y, y: x, angle: 90 };
    case 180: return { x: width - x, y: height - y, angle: 180 };
    case 270: return { x: y, y: height - x, angle: 270 };
    default: return { x, y, angle: 0 };
  }
}

export interface WatermarkOptions {
  text: string;
  /** 0..1 */
  opacity?: number;
  /** As a share of the page's shorter side: 0.1 is subtle, 0.2 is bold. */
  scale?: number;
  /** 'diagonal' runs corner to corner; 'flat' is horizontal. */
  layout?: 'diagonal' | 'flat';
  color?: [number, number, number];
}

export async function addWatermark(bytes: Bytes, options: WatermarkOptions, password?: string): Promise<Uint8Array> {
  const text = options.text.trim();
  if (!text) throw new PdfError('empty', 'Type the watermark text.');
  const doc = await openPdf(bytes, password);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const [r, g, b] = options.color ?? [0.55, 0.55, 0.55];
  for (const page of doc.getPages()) {
    const view = viewSize(page);
    const size = Math.min(view.width, view.height) * (options.scale ?? 0.12);
    const textWidth = font.widthOfTextAtSize(text, size);
    const tilt = options.layout === 'flat' ? 0 : Math.atan2(view.height, view.width) * (180 / Math.PI);
    const rad = (tilt * Math.PI) / 180;
    // Start point so the text's centre sits at the page's centre.
    const cx = view.width / 2 - (textWidth / 2) * Math.cos(rad) + (size / 3) * Math.sin(rad);
    const cy = view.height / 2 - (textWidth / 2) * Math.sin(rad) - (size / 3) * Math.cos(rad);
    const at = placeOnPage(page, cx, cy);
    page.drawText(text, { x: at.x, y: at.y, size, font, color: rgb(r, g, b), opacity: options.opacity ?? 0.25, rotate: degrees(tilt + at.angle) });
  }
  return save(doc);
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
export type NumberStyle = 'n' | 'page-n' | 'n-of-total';

export interface PageNumberOptions {
  position?: NumberPosition;
  style?: NumberStyle;
  /** Number shown on the first numbered page. */
  startAt?: number;
  /** Leave the first N pages unnumbered (a cover). */
  skipFirst?: number;
  fontSize?: number;
}

export function pageLabel(style: NumberStyle, n: number, total: number): string {
  if (style === 'page-n') return `Page ${n}`;
  if (style === 'n-of-total') return `${n} of ${total}`;
  return String(n);
}

export async function addPageNumbers(bytes: Bytes, options: PageNumberOptions = {}, password?: string): Promise<Uint8Array> {
  const doc = await openPdf(bytes, password);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const skip = Math.max(0, options.skipFirst ?? 0);
  const start = options.startAt ?? 1;
  const size = options.fontSize ?? 10;
  const position = options.position ?? 'bottom-center';
  const total = start + (pages.length - skip) - 1;
  pages.forEach((page, i) => {
    if (i < skip) return;
    const label = pageLabel(options.style ?? 'n', start + i - skip, total);
    const view = viewSize(page);
    const margin = Math.max(18, Math.min(view.width, view.height) * 0.04);
    const width = font.widthOfTextAtSize(label, size);
    const x = position.endsWith('left') ? margin : position.endsWith('right') ? view.width - margin - width : (view.width - width) / 2;
    const y = position.startsWith('top') ? view.height - margin - size : margin;
    const at = placeOnPage(page, x, y);
    page.drawText(label, { x: at.x, y: at.y, size, font, color: rgb(0.2, 0.2, 0.2), rotate: degrees(at.angle) });
  });
  return save(doc);
}

/** Adds a password needed to open the PDF (AES-256). */
export async function protectPdf(bytes: Bytes, password: string, current?: string): Promise<Uint8Array> {
  if (password.length === 0) throw new PdfError('empty', 'Choose a password.');
  const doc = await openPdf(bytes, current);
  doc.encrypt({ userPassword: password, ownerPassword: password, permissions: { printing: 'highResolution', modifying: true, copying: true, annotating: true, fillingForms: true, contentAccessibility: true, documentAssembly: true } });
  return doc.save({ useObjectStreams: true });
}

/** Copies every page into a fresh document: drops unused objects and any encryption. */
async function copyAll(src: PDFDocument): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((page) => out.addPage(page));
  const title = src.getTitle();
  if (title) out.setTitle(title);
  return out;
}

/** Removes the password from a PDF whose password you know. */
export async function unlockPdf(bytes: Bytes, password: string): Promise<Uint8Array> {
  return save(await copyAll(await openPdf(bytes, password)));
}

export interface ImagePlacement {
  /** 0-based page index. */
  page: number;
  /** PNG or JPEG bytes. */
  image: Uint8Array;
  /** Box in fractions of the page as seen (0..1), origin top-left like the screen. */
  box: { x: number; y: number; width: number; height: number };
}

/** Stamps images (signatures, initials) onto pages. */
export async function placeImages(bytes: Bytes, placements: ImagePlacement[], password?: string): Promise<Uint8Array> {
  const doc = await openPdf(bytes, password);
  const pages = doc.getPages();
  for (const { page: index, image, box } of placements) {
    const page = pages[index];
    if (!page) throw new PdfError('bad-range', `Page ${index + 1} doesn’t exist.`);
    const isPng = image[0] === 0x89 && image[1] === 0x50;
    const embedded = isPng ? await doc.embedPng(image) : await doc.embedJpg(image);
    const view = viewSize(page);
    const w = box.width * view.width;
    const h = box.height * view.height;
    const left = box.x * view.width;
    const bottom = view.height - (box.y * view.height) - h;
    const at = placeOnPage(page, left, bottom);
    page.drawImage(embedded, { x: at.x, y: at.y, width: w, height: h, rotate: degrees(at.angle) });
  }
  return save(doc);
}

/** Re-saves with compact object streams and no unused objects. Lossless; small gains on most files. */
export async function compressLossless(bytes: Bytes, password?: string): Promise<Uint8Array> {
  return save(await copyAll(await openPdf(bytes, password)));
}
