import { fitUnder, kb, shrinkSteps } from './search';

export interface ImageTarget {
  width?: number;
  height?: number;
  minKb?: number;
  maxKb: number;
  /** Clean a signature scan: paper becomes pure white, ink becomes solid. */
  whiten?: boolean;
}

export interface FittedImage { blob: Blob; width: number; height: number; quality: number; underMin: boolean }

export class FitError extends Error {}

/** Decodes a photo the way it was taken (camera rotation applied). */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new FitError('This image can’t be opened here. Use a JPG, PNG or WebP. (HEIC photos: set your camera to “Most compatible”, or convert them first.)');
  }
}

/**
 * Draws the image at the target size. With both width and height given the
 * picture is cropped to that shape from the centre, the way a photo studio
 * would; otherwise it is scaled, keeping its shape.
 */
function draw(bitmap: ImageBitmap, target: ImageTarget, scale: number): HTMLCanvasElement {
  const longEdge = 2000;
  const fixed = target.width !== undefined && target.height !== undefined;
  let width: number, height: number;
  if (fixed) { width = target.width!; height = target.height!; }
  else {
    const fit = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height)) * scale;
    width = Math.max(1, Math.round(bitmap.width * fit));
    height = Math.max(1, Math.round(bitmap.height * fit));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  if (fixed) {
    const ratio = Math.max(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * ratio;
    const h = bitmap.height * ratio;
    ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
  } else {
    ctx.drawImage(bitmap, 0, 0, width, height);
  }
  if (target.whiten) whiten(ctx, width, height);
  return canvas;
}

/** Paper to white, ink to a solid dark tone, keeping smooth edges. */
export function whitenPixels(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    // Above 170 is paper; below 90 is ink; between is a soft edge.
    const t = Math.min(1, Math.max(0, (lum - 90) / 80));
    const v = Math.round(20 + t * 235);
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function whiten(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const img = ctx.getImageData(0, 0, width, height);
  whitenPixels(img.data);
  ctx.putImageData(img, 0, 0);
}

const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new FitError('Could not encode the image.'))), 'image/jpeg', quality));

/** A JPEG that fits under `maxKb`, as sharp as possible; exact pixel size when the target sets one. */
export async function fitImage(file: Blob, target: ImageTarget): Promise<FittedImage> {
  const bitmap = await decodeImage(file);
  const fixed = target.width !== undefined && target.height !== undefined;
  const canvases = new Map<number, HTMLCanvasElement>();
  const canvasAt = (scale: number) => {
    let c = canvases.get(scale);
    if (!c) { c = draw(bitmap, target, scale); canvases.set(scale, c); }
    return c;
  };
  const found = await fitUnder(async (scale) => async (q) => (await jpeg(canvasAt(scale), q)).size, kb(target.maxKb), fixed ? [1] : shrinkSteps(0.1));
  if (!found) {
    throw new FitError(fixed
      ? `This picture can’t get under ${target.maxKb} KB at ${target.width} × ${target.height} pixels. Try a plainer background, or a larger KB limit if your form allows it.`
      : `This picture can’t get under ${target.maxKb} KB. Try a larger limit.`);
  }
  let quality = found.quality;
  let blob = await jpeg(canvasAt(found.scale), quality);
  // Some portals reject files that are too small: use the full quality budget first.
  if (target.minKb && blob.size < kb(target.minKb)) {
    const best = await jpeg(canvasAt(found.scale), 1);
    if (best.size <= kb(target.maxKb)) { blob = best; quality = 1; }
  }
  const canvas = canvasAt(found.scale);
  bitmap.close();
  return { blob, width: canvas.width, height: canvas.height, quality, underMin: Boolean(target.minKb && blob.size < kb(target.minKb)) };
}
