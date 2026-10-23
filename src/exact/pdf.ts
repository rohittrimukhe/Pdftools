import { compressLossless } from '../pdf/engine';
import { jpegsToPdf, openForView, renderPage, toBlob } from '../pdf/render';
import { bestQuality, kb } from './search';

export interface FittedPdf { bytes: Uint8Array; dpi?: number; quality?: number; lossless: boolean }

const DPIS = [150, 120, 100, 85, 72, 60, 50];

/**
 * The sharpest PDF under `maxKb`. Lossless first; otherwise pages become JPEGs,
 * trying the highest resolution first and the best quality that fits at each one.
 * Pages are drawn once per resolution and only re-encoded while searching.
 */
export async function fitPdf(bytes: Uint8Array, maxKb: number, password: string | undefined, onProgress: (fraction: number, note: string) => void): Promise<FittedPdf | null> {
  const limit = kb(maxKb);
  onProgress(0.02, 'Trying without changing the pages');
  const lossless = await compressLossless(bytes, password);
  if (lossless.length <= limit) return { bytes: lossless, lossless: true };

  const doc = await openForView(bytes, password);
  try {
    for (const [step, dpi] of DPIS.entries()) {
      const pages: Array<{ canvas: HTMLCanvasElement; width: number; height: number }> = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const view = page.getViewport({ scale: 1 });
        pages.push({ canvas: await renderPage(page, dpi / 72), width: view.width, height: view.height });
        page.cleanup();
        onProgress((step + i / doc.numPages) / DPIS.length, `Trying ${dpi} dpi, page ${i} of ${doc.numPages}`);
      }
      // A PDF adds a little around each image; keep that out of the image budget.
      const overhead = 1200 + 400 * pages.length;
      const encode = async (q: number) => {
        let total = overhead;
        for (const p of pages) total += (await toBlob(p.canvas, 'image/jpeg', q)).size;
        return total;
      };
      const found = await bestQuality(encode, limit, { low: 0.2, steps: 5 });
      if (found) {
        for (let q = found.quality; q >= 0.15; q -= 0.05) {
          const jpegs = await Promise.all(pages.map(async (p) => ({ jpeg: new Uint8Array(await (await toBlob(p.canvas, 'image/jpeg', q)).arrayBuffer()), width: p.width, height: p.height })));
          const out = await jpegsToPdf(jpegs);
          if (out.length <= limit) return { bytes: out, dpi, quality: q, lossless: false };
        }
      }
      pages.forEach((p) => { p.canvas.width = p.canvas.height = 0; });
    }
    return null;
  } finally {
    await doc.loadingTask.destroy();
  }
}
