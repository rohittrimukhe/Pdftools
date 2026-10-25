/**
 * Straightening a photographed page: find its four corners, then map that
 * quadrilateral onto a flat rectangle (a perspective warp). Pure maths on
 * pixel arrays, so it runs anywhere and can be unit-tested.
 */
export interface Point { x: number; y: number }
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Puts four points in reading order: top-left, top-right, bottom-right, bottom-left. */
export function orderCorners(points: Point[]): Quad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  return [bySum[0]!, byDiff[3]!, bySum[3]!, byDiff[0]!];
}

/** A box a little inside the photo's edges: the starting crop when no page is found. */
export const insetQuad = (width: number, height: number, inset = 0.04): Quad => [
  { x: width * inset, y: height * inset }, { x: width * (1 - inset), y: height * inset },
  { x: width * (1 - inset), y: height * (1 - inset) }, { x: width * inset, y: height * (1 - inset) },
];

/** The flat page size for a quad: its longest top/bottom and left/right edges, capped. */
export function outputSize(q: Quad, maxSide = 2600): { width: number; height: number } {
  let width = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let height = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * k));
  height = Math.max(1, Math.round(height * k));
  return { width, height };
}

/** Solves the 8 numbers of the homography that maps the unit square's corners onto `q`. */
function squareToQuad(q: Quad): [number, number, number, number, number, number, number, number] {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
  const h = den === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h];
}

/** Where a point (u, v) of the flat page (0..1 each way) lies in the photo. */
export function mapPoint(q: Quad, u: number, v: number): Point {
  const [a, b, c, d, e, f, g, h] = squareToQuad(q);
  const w = g * u + h * v + 1;
  return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
}

/** Cuts the quad out of the photo and lays it flat (bilinear sampling, RGBA in and out). */
export function warp(src: Pixels, q: Quad, size = outputSize(q)): Pixels {
  const { width, height } = size;
  const out = new Uint8ClampedArray(width * height * 4);
  const [a, b, c, d, e, f, g, h] = squareToQuad(q);
  const sw = src.width, sh = src.height, s = src.data;
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const w = g * u + h * v + 1;
      const sx = Math.min(sw - 1.001, Math.max(0, (a * u + b * v + c) / w - 0.5));
      const sy = Math.min(sh - 1.001, Math.max(0, (d * u + e * v + f) / w - 0.5));
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * width + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const top = s[i00 + ch]! + (s[i10 + ch]! - s[i00 + ch]!) * fx;
        const bottom = s[i01 + ch]! + (s[i11 + ch]! - s[i01 + ch]!) * fx;
        out[o + ch] = top + (bottom - top) * fy;
      }
    }
  }
  return { data: out, width, height };
}

/** Otsu's threshold: the grey level that best splits dark from light. */
export function otsu(grey: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of grey) hist[v]!++;
  const total = grey.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0, wB = 0, best = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/**
 * Finds a light page on a darker background. Works on a small copy of the
 * photo: the largest bright region, then its four extreme corners. Returns
 * null when nothing page-like stands out, so the caller can fall back.
 */
export function detectPage(src: Pixels): Quad | null {
  const scale = Math.min(1, 256 / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const grey = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((Math.min(src.height - 1, Math.floor(y / scale)) * src.width) + Math.min(src.width - 1, Math.floor(x / scale))) * 4;
      grey[y * w + x] = (src.data[i]! * 0.299 + src.data[i + 1]! * 0.587 + src.data[i + 2]! * 0.114) | 0;
    }
  }
  const t = otsu(grey);
  // Largest connected bright region (4-neighbour flood fill).
  const label = new Int32Array(w * h).fill(-1);
  let bestSize = 0, bestLabel = -1;
  const stack: number[] = [];
  for (let start = 0, id = 0; start < w * h; start++) {
    if (label[start] !== -1 || grey[start]! <= t) continue;
    let size = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w, y = (p / w) | 0;
      for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (n >= 0 && label[n] === -1 && grey[n]! > t) { label[n] = id; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; bestLabel = id; }
    id++;
  }
  // A page fills a fair part of the photo but not all of it (then there's no background to find it against).
  const share = bestSize / (w * h);
  if (bestLabel < 0 || share < 0.15 || share > 0.97) return null;
  let tl = { x: 0, y: 0, s: Infinity }, br = { x: 0, y: 0, s: -Infinity }, tr = { x: 0, y: 0, s: -Infinity }, bl = { x: 0, y: 0, s: Infinity };
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== bestLabel) continue;
    const x = p % w, y = (p / w) | 0;
    if (x + y < tl.s) tl = { x, y, s: x + y };
    if (x + y > br.s) br = { x, y, s: x + y };
    if (x - y > tr.s) tr = { x, y, s: x - y };
    if (x - y < bl.s) bl = { x, y, s: x - y };
  }
  const up = (p: { x: number; y: number }, dx: number, dy: number): Point => ({
    x: Math.min(src.width, Math.max(0, (p.x + dx) / scale)), y: Math.min(src.height, Math.max(0, (p.y + dy) / scale)),
  });
  const raw: Quad = [up(tl, 0, 0), up(tr, 1, 0), up(br, 1, 1), up(bl, 0, 1)];
  // Pull each corner a hair towards the middle, so no sliver of table shows along the edges.
  const cx = raw.reduce((n, p) => n + p.x, 0) / 4, cy = raw.reduce((n, p) => n + p.y, 0) / 4;
  const quad = raw.map((p) => ({ x: p.x + (cx - p.x) * 0.012, y: p.y + (cy - p.y) * 0.012 })) as Quad;
  // Reject slivers: a real page has a sensible shape.
  const { width: qw, height: qh } = outputSize(quad, Infinity);
  if (qw < src.width * 0.2 || qh < src.height * 0.2) return null;
  return quad;
}

/** Turns the page a quarter turn clockwise. */
export function rotate90(src: Pixels): Pixels {
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = (x * height + (height - 1 - y)) * 4;
      out[o] = data[i]!; out[o + 1] = data[i + 1]!; out[o + 2] = data[i + 2]!; out[o + 3] = data[i + 3]!;
    }
  }
  return { data: out, width: height, height: width };
}
