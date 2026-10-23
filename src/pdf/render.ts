// The legacy build is pdf.js transpiled for older engines (older Android WebViews, iOS 15-17 Safari).
// The modern build needs JavaScript features those browsers lack, such as Map.getOrInsertComputed.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { damaged, passwordRequired, wrongPassword } from './errors';

GlobalWorkerOptions.workerSrc = workerUrl;
const assets = `${import.meta.env.BASE_URL}pdfjs/`;

/** Opens a PDF for drawing. Everything pdf.js needs is served from our own site. */
export async function openForView(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const task = getDocument({
    data: bytes.slice(),
    password,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
    enableXfa: false,
  });
  try {
    return await task.promise;
  } catch (error) {
    const name = (error as { name?: string }).name;
    const code = (error as { code?: number }).code;
    if (name === 'PasswordException') throw code === 2 ? wrongPassword() : passwordRequired();
    throw damaged();
  }
}

/** Draws one page into a canvas, `scale` × its size in points (1 pt = 1/72 in). */
export async function renderPage(page: PDFPageProxy, scale: number, rotation = 0): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is not available');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality));

/** Small previews of every page, `width` CSS pixels wide (drawn at device resolution). Caller revokes the URLs. */
export async function thumbnails(doc: PDFDocumentProxy, width: number, onEach?: (index: number, url: string) => void): Promise<string[]> {
  const urls: string[] = [];
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const canvas = await renderPage(page, (width * dpr) / base.width);
    const url = URL.createObjectURL(await toBlob(canvas, 'image/jpeg', 0.8));
    page.cleanup();
    urls.push(url);
    onEach?.(i - 1, url);
  }
  return urls;
}

export interface RasterOptions {
  /** Image resolution in dots per inch: 72 small, 110 balanced, 150 sharp. */
  dpi: number;
  /** JPEG quality 0..1. */
  quality: number;
  grayscale?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Strong compression: each page becomes one JPEG at the chosen resolution,
 * placed at the page's original size. Text stops being selectable, which the
 * tool says before you choose it.
 */
export async function rasterizePdf(bytes: Uint8Array, options: RasterOptions, password?: string): Promise<Uint8Array> {
  const doc = await openForView(bytes, password);
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const page = await doc.getPage(i);
      const size = page.getViewport({ scale: 1 });
      const canvas = await renderPage(page, options.dpi / 72);
      if (options.grayscale) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = img.data;
          for (let p = 0; p < d.length; p += 4) {
            const y = 0.299 * d[p]! + 0.587 * d[p + 1]! + 0.114 * d[p + 2]!;
            d[p] = d[p + 1] = d[p + 2] = y;
          }
          ctx.putImageData(img, 0, 0);
        }
      }
      const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', options.quality)).arrayBuffer());
      const image = await out.embedJpg(jpeg);
      out.addPage([size.width, size.height]).drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
      page.cleanup();
      canvas.width = canvas.height = 0;
      options.onProgress?.(i, doc.numPages);
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    await doc.loadingTask.destroy();
  }
}
