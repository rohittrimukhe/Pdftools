import { decodeImage, drawImage } from '../images/codec';
import { loadRender } from '../pdf/lazy';
import { detectFile } from '../files/detect';

/** One page to read: a JPEG at about 300 dpi for an A4 page (the size OCR reads best), and the page size in points. */
export interface PageImage { label: string; image: Blob; width: number; height: number; points: [number, number] }

const LONG_SIDE = 3000;

/** A photo's page size: its long side as long as an A4 page's (842 pt), keeping its shape. */
export const photoPoints = (width: number, height: number): [number, number] => {
  const k = 841.89 / Math.max(width, height);
  return [width * k, height * k];
};
const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the page'))), 'image/jpeg', 0.9));

/** Every page of every file, in order: each image is one page; each PDF page is drawn as an image. */
export async function* pageImages(files: File[], password?: string): AsyncGenerator<PageImage> {
  for (const file of files) {
    if ((await detectFile(file)) === 'pdf') {
      const { openForView, renderPage } = await loadRender();
      const doc = await openForView(new Uint8Array(await file.arrayBuffer()), password);
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const view = page.getViewport({ scale: 1 });
          const canvas = await renderPage(page, Math.min(300 / 72, LONG_SIDE / Math.max(view.width, view.height)));
          page.cleanup();
          yield { label: doc.numPages > 1 ? `${file.name}, page ${i}` : file.name, image: await toJpeg(canvas), width: canvas.width, height: canvas.height,
            points: [view.width, view.height] }; // the viewport already includes the page's rotation
        }
      } finally {
        await doc.loadingTask.destroy();
      }
    } else {
      const decoded = await decodeImage(file);
      try {
        const k = Math.min(1, LONG_SIDE / Math.max(decoded.width, decoded.height));
        const canvas = drawImage(decoded, Math.round(decoded.width * k), Math.round(decoded.height * k), '#ffffff');
        yield { label: file.name, image: await toJpeg(canvas), width: canvas.width, height: canvas.height, points: photoPoints(canvas.width, canvas.height) };
      } finally {
        decoded.close();
      }
    }
  }
}

/** Page count before reading, for the progress bar. */
export async function countPages(files: File[], password?: string): Promise<number> {
  let n = 0;
  for (const file of files) {
    if ((await detectFile(file)) !== 'pdf') { n += 1; continue; }
    const { openForView } = await loadRender();
    const doc = await openForView(new Uint8Array(await file.arrayBuffer()), password);
    n += doc.numPages;
    await doc.loadingTask.destroy();
  }
  return n;
}
