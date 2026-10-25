import type { Pixels } from './geometry';

/**
 * Cleaning up a photographed page, in place on RGBA pixels.
 * - document: grey, paper made white and ink made dark (shadows lifted);
 * - colour: the same levels, keeping colour (stamps, signatures, photos);
 * - bw: pure black and white, smallest files, for text-only pages;
 * - original: untouched.
 */
export type Enhance = 'document' | 'colour' | 'bw' | 'original';

export const ENHANCE_LABEL: Record<Enhance, string> = { document: 'Document', colour: 'Colour', bw: 'Black & white', original: 'Original' };

const luma = (d: Uint8ClampedArray, i: number) => d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114;

/** The grey levels below which `low` and above which `high` of the pixels lie. */
export function levels(px: Pixels, low = 0.02, high = 0.9): { black: number; white: number } {
  const hist = new Array<number>(256).fill(0);
  const { data } = px;
  const step = Math.max(1, Math.floor(data.length / 4 / 200_000)) * 4;
  let n = 0;
  for (let i = 0; i < data.length; i += step) { hist[luma(data, i) | 0]!++; n++; }
  let acc = 0, black = 0, white = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]!; if (acc >= n * low) { black = v; break; } }
  acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]!; if (acc >= n * high) { white = v; break; } }
  if (white - black < 40) { black = Math.max(0, white - 120); }
  return { black, white };
}

/**
 * Paper is never evenly lit in a photo. Divides each pixel by a blurred copy
 * of the page (the lighting), which flattens shadows and gradients.
 */
function flattenLight(px: Pixels): Float32Array {
  const { width: w, height: h, data } = px;
  const grey = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) grey[p] = luma(data, i);
  // Lighting estimate: a box blur about 1/12 of the page, computed on a small grid.
  const cell = Math.max(4, Math.round(Math.max(w, h) / 48));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const bright = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      // The bright end of each cell is the paper; ink pixels pull the mean down, so take the 90th percentile roughly via max of means.
      let max = 0;
      for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 2) {
        for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 2) max = Math.max(max, grey[y * w + x]!);
      }
      bright[gy * gw + gx] = max;
    }
  }
  // Smooth the grid so text never leaves a mark on the lighting estimate.
  const smooth = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x >= 0 && y >= 0 && x < gw && y < gh) { s += bright[y * gw + x]!; n++; }
      }
      smooth[gy * gw + gx] = s / n;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1.001, Math.max(0, y / cell - 0.5)), y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1.001, Math.max(0, x / cell - 0.5)), x0 = fx | 0, tx = fx - x0;
      const i = y0 * gw + x0;
      const top = smooth[i]! + (smooth[i + 1]! - smooth[i]!) * tx;
      const bottom = smooth[i + gw]! + (smooth[i + gw + 1]! - smooth[i + gw]!) * tx;
      const light = Math.max(40, top + (bottom - top) * ty);
      out[y * w + x] = Math.min(1, grey[y * w + x]! / light);
    }
  }
  return out;
}

export function enhance(px: Pixels, mode: Enhance): Pixels {
  if (mode === 'original') return px;
  const { data, width, height } = px;
  const out = new Uint8ClampedArray(data.length);
  if (mode === 'colour') {
    const { black, white } = levels(px);
    const k = 255 / Math.max(1, white - black);
    for (let i = 0; i < data.length; i += 4) {
      out[i] = (data[i]! - black) * k; out[i + 1] = (data[i + 1]! - black) * k; out[i + 2] = (data[i + 2]! - black) * k; out[i + 3] = 255;
    }
    return { data: out, width, height };
  }
  const flat = flattenLight(px);
  // On the flattened page, paper is near 1.0; push it to white and ink to black with a curve.
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    const v = flat[p]!;
    const g = mode === 'bw' ? (v > 0.78 ? 255 : 0) : 255 * Math.min(1, Math.max(0, (v - 0.35) / 0.5)) ** 1.6;
    out[i] = g; out[i + 1] = g; out[i + 2] = g; out[i + 3] = 255;
  }
  return { data: out, width, height };
}
