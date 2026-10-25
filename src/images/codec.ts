/**
 * Decoding and encoding images on the device with the browser's own codecs.
 * Reads JPG, PNG, WebP, GIF (first frame), BMP and SVG everywhere, and HEIC
 * where the browser can (Safari). Writes JPG, PNG, WebP and GIF.
 */
import { FriendlyError } from '../lib/errors';
export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'gif';

export const FORMAT_LABEL: Record<OutputFormat, string> = { jpeg: 'JPG', png: 'PNG', webp: 'WebP', gif: 'GIF' };
export const FORMAT_EXT: Record<OutputFormat, string> = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif' };
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml,image/heic,image/heif,.heic,.heif,.svg';

export class ImageError extends FriendlyError {}

export interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** True when the source can have transparent areas. */
  alpha: boolean;
  close: () => void;
}

const isSvg = (file: Blob & { name?: string }) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name ?? '');
const isHeic = (file: Blob & { name?: string }) => /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '');

/** SVGs have no pixel size of their own: draw them at their declared size, or 1024 px wide. */
async function decodeSvg(file: Blob): Promise<Decoded> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') throw new ImageError('This SVG file can’t be read.');
  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  let width = parseFloat(svg.getAttribute('width') ?? '') || (viewBox ? viewBox[2]! : 0);
  let height = parseFloat(svg.getAttribute('height') ?? '') || (viewBox ? viewBox[3]! : 0);
  if (!width || !height) { width = 1024; height = 1024; }
  if (width < 1024) { const k = 1024 / width; width *= k; height *= k; }
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try { await img.decode(); } catch { URL.revokeObjectURL(url); throw new ImageError('This SVG file can’t be drawn.'); }
  return { source: img, width: Math.round(width), height: Math.round(height), alpha: true, close: () => URL.revokeObjectURL(url) };
}

export async function decodeImage(file: Blob & { name?: string }): Promise<Decoded> {
  if (isSvg(file)) return decodeSvg(file);
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, alpha: !/jpe?g/.test(file.type), close: () => bitmap.close() };
  } catch {
    throw new ImageError(isHeic(file)
      ? 'This browser can’t open HEIC photos. Open Happy PDF in Safari, or set your iPhone camera to “Most Compatible” (Settings › Camera › Formats).'
      : 'This file isn’t an image Happy PDF can open. Use JPG, PNG, WebP, GIF, BMP or SVG.');
  }
}

/** Draws the image at a new size, on a background colour when the output can't be transparent. */
export function drawImage(image: Decoded, width: number, height: number, background?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encodeGif(canvas: HTMLCanvasElement): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
  const index = applyPalette(data, palette, 'rgba4444');
  const gif = GIFEncoder();
  const transparentIndex = palette.findIndex((c) => c[3] === 0);
  gif.writeFrame(index, width, height, { palette, transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex) });
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

export async function encodeImage(canvas: HTMLCanvasElement, format: OutputFormat, quality = 0.9): Promise<Blob> {
  if (format === 'gif') return encodeGif(canvas);
  const type = `image/${format}`;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new ImageError(`This browser can’t save ${FORMAT_LABEL[format]} images.`);
  // A browser that can't write the format silently falls back to PNG.
  if (blob.type !== type) throw new ImageError(`This browser can’t save ${FORMAT_LABEL[format]} images. Try JPG or PNG.`);
  return blob;
}

/** Output dimensions for a resize request. */
export type Resize =
  | { by: 'percent'; percent: number }
  | { by: 'pixels'; width?: number; height?: number; keepShape: boolean }
  | { by: 'longest'; pixels: number };

export function resizedSize(width: number, height: number, resize: Resize): { width: number; height: number } {
  const clamp = (n: number) => Math.max(1, Math.min(16384, Math.round(n)));
  if (resize.by === 'percent') return { width: clamp((width * resize.percent) / 100), height: clamp((height * resize.percent) / 100) };
  if (resize.by === 'longest') {
    const k = resize.pixels / Math.max(width, height);
    return { width: clamp(width * k), height: clamp(height * k) };
  }
  const { width: w, height: h, keepShape } = resize;
  if (w && h && !keepShape) return { width: clamp(w), height: clamp(h) };
  if (w && h) { const k = Math.min(w / width, h / height); return { width: clamp(width * k), height: clamp(height * k) }; }
  if (w) return { width: clamp(w), height: clamp((height * w) / width) };
  if (h) return { width: clamp((width * h) / height), height: clamp(h) };
  return { width, height };
}
