import { loadPdfLib } from '../pdf/lazy';

export interface SearchablePage {
  jpeg: Uint8Array;
  /** Page size in points. */
  points: [number, number];
  /** Where the picture sits on the page, in points. Default: the whole page. */
  imageRect?: { x: number; y: number; width: number; height: number };
  /** The invisible text layer from OCR, if the page was read. */
  textLayer?: Uint8Array;
}

/**
 * A PDF of page pictures with their words laid over them invisibly, so the
 * PDF can be searched, selected and copied like a typed document.
 */
export async function searchablePdf(pages: SearchablePage[], title?: string): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const [width, height] = p.points;
    const page = doc.addPage([width, height]);
    const rect = p.imageRect ?? { x: 0, y: 0, width, height };
    page.drawImage(await doc.embedJpg(p.jpeg), rect);
    // The text layer covers exactly the picture, so each invisible word sits over its printed one.
    if (p.textLayer) {
      const [layer] = await doc.embedPdf(p.textLayer, [0]);
      page.drawPage(layer!, rect);
    }
  }
  if (title) doc.setTitle(title);
  doc.setCreator('Happy PDF');
  doc.setProducer('Happy PDF');
  return doc.save();
}
