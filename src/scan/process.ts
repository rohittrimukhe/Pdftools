import { decodeImage, drawImage } from '../images/codec';
import { detectPage, insetQuad, outputSize, rotate90, warp, type Pixels, type Quad } from './geometry';
import { enhance, type Enhance } from './filters';

/** One scanned page: the photo, where the page is in it, and how to clean it up. */
export interface ScanPage {
  id: string;
  file: File;
  /** Page corners as fractions of the photo's width and height (0–1). */
  quad: Quad;
  /** Quarter turns clockwise. */
  turns: 0 | 1 | 2 | 3;
  mode: Enhance;
  /** True when the corners were found automatically. */
  found: boolean;
}

/** The photo drawn at most `longSide` pixels long, upright (phone photos carry their rotation in EXIF). */
export async function photoCanvas(file: Blob, longSide: number): Promise<HTMLCanvasElement> {
  const image = await decodeImage(file);
  try {
    const k = Math.min(1, longSide / Math.max(image.width, image.height));
    return drawImage(image, Math.max(1, Math.round(image.width * k)), Math.max(1, Math.round(image.height * k)), '#ffffff');
  } finally {
    image.close();
  }
}

const pixelsOf = (canvas: HTMLCanvasElement): Pixels => {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return { data: data.data, width: data.width, height: data.height };
};

const toFraction = (q: Quad, w: number, h: number): Quad => q.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad;
const toPixels = (q: Quad, w: number, h: number): Quad => q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;

/** Finds the page in a photo; falls back to a box just inside the edges. */
export async function findPage(file: File): Promise<{ quad: Quad; found: boolean }> {
  const canvas = await photoCanvas(file, 800);
  const found = detectPage(pixelsOf(canvas));
  return found ? { quad: toFraction(found, canvas.width, canvas.height), found: true } : { quad: toFraction(insetQuad(1, 1), 1, 1), found: false };
}

/** The finished page as a canvas, with its long side at most `longSide` pixels. */
export async function renderScan(page: ScanPage, longSide: number): Promise<HTMLCanvasElement> {
  // Decode a little larger than the output, so straightening never has to stretch.
  const photo = await photoCanvas(page.file, Math.round(longSide * 1.25));
  const quad = toPixels(page.quad, photo.width, photo.height);
  let px = warp(pixelsOf(photo), quad, outputSize(quad, longSide));
  for (let t = 0; t < page.turns; t++) px = rotate90(px);
  px = enhance(px, page.mode);
  const out = document.createElement('canvas');
  out.width = px.width;
  out.height = px.height;
  out.getContext('2d')!.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), 0, 0);
  return out;
}

export const canvasJpeg = (canvas: HTMLCanvasElement, quality = 0.85) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the page'))), 'image/jpeg', quality));
