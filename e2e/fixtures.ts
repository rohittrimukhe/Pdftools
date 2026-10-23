import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { unzipSync, zlibSync } from 'fflate';
import type { Download, Page } from '@playwright/test';
import { readPdf } from '../src/pdf/testing';

/** A photo-like PNG (gradients plus grain): large as a PNG, small as a JPEG, like a phone scan. */
export function makePng(width: number, height: number): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  let seed = 7;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const grain = (seed >> 16) % 40;
      const i = row + 1 + x * 3;
      raw[i] = (x * 255) / width * 0.7 + grain;
      raw[i + 1] = (y * 255) / height * 0.7 + grain;
      raw[i + 2] = 120 + grain;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height); header[8] = 8; header[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlibSync(raw, { level: 6 })), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { png.set(p, at); at += p.length; }
  return png;
}

export async function makePdf(pages: number, { label = 'Page', heavy = false, password }: { label?: string; heavy?: boolean; password?: string } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let photo: Uint8Array | undefined;
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${label} ${i}`, { x: 50, y: 760, size: 24, font });
    // "Heavy" pages carry a full-page photo, like a phone scan: big as PNG, much smaller as a JPEG.
    if (heavy) page.drawImage(await doc.embedPng(photo ??= makePng(1240, 1754)), { x: 0, y: 0, width: 595, height: 842 });
  }
  if (password) doc.encrypt({ userPassword: password, ownerPassword: password });
  return Buffer.from(await doc.save());
}

export const asFile = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/pdf', buffer });

/** Opens a tool and gives it files through its own picker. */
export async function openTool(page: Page, id: string, files: Array<ReturnType<typeof asFile>>) {
  await page.goto(`/tools/${id}`);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Choose files?$/ }).click();
  await (await chooser).setFiles(files);
}

export async function downloadBytes(download: Download) {
  return new Uint8Array(await readFile((await download.path())!));
}

/** Presses Save on the result card and returns the saved file. */
export async function saveResult(page: Page) {
  const card = page.getByRole('region', { name: 'Your file is ready' });
  await card.waitFor();
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Save' }).click();
  const file = await download;
  return { name: file.suggestedFilename(), bytes: await downloadBytes(file), card };
}

export const texts = async (bytes: Uint8Array, password?: string) => (await readPdf(bytes, password)).map((p) => p.text);
export const unzip = (bytes: Uint8Array) => unzipSync(bytes);
export { readPdf };
