import { describe, expect, it } from 'vitest';
import { detectPage, insetQuad, mapPoint, orderCorners, outputSize, rotate90, warp, type Pixels, type Point, type Quad } from './geometry';
import { enhance, levels } from './filters';

/** A photo: a dark table with a light page (the quad) on it, and a dark "text" bar on the page. */
function photo(width: number, height: number, page: Quad, { table = 60, paper = 225 } = {}): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = page[i]!, b = page[(i + 1) % 4]!;
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (cross !== 0) { if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false; }
    }
    return true;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const v = inside(x + 0.5, y + 0.5) ? paper : table;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width, height };
}

const near = (a: Point, b: Point, tolerance: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;

describe('page geometry', () => {
  it('orders corners whatever order they come in', () => {
    const q = orderCorners([{ x: 90, y: 95 }, { x: 10, y: 5 }, { x: 5, y: 90 }, { x: 95, y: 10 }]);
    expect(q).toEqual([{ x: 10, y: 5 }, { x: 95, y: 10 }, { x: 90, y: 95 }, { x: 5, y: 90 }]);
  });

  it('maps the flat page onto the quad corner to corner', () => {
    const q: Quad = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 400 }, { x: 0, y: 380 }];
    expect(near(mapPoint(q, 0, 0), q[0], 1e-9)).toBe(true);
    expect(near(mapPoint(q, 1, 0), q[1], 1e-9)).toBe(true);
    expect(near(mapPoint(q, 1, 1), q[2], 1e-9)).toBe(true);
    expect(near(mapPoint(q, 0, 1), q[3], 1e-9)).toBe(true);
  });

  it('finds a tilted page on a dark table', () => {
    const page: Quad = [{ x: 70, y: 40 }, { x: 330, y: 70 }, { x: 300, y: 440 }, { x: 40, y: 410 }];
    const found = detectPage(photo(400, 480, page));
    expect(found).not.toBeNull();
    found!.forEach((corner, i) => expect(near(corner, page[i]!, 12)).toBe(true));
  });

  it('gives up when there is no page to find', () => {
    expect(detectPage(photo(200, 200, insetQuad(200, 200, 0)))).toBeNull(); // all paper
    expect(detectPage(photo(200, 200, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]))).toBeNull(); // all table
  });

  it('lays a tilted page flat: the page fills the result and the table is gone', () => {
    const page: Quad = [{ x: 70, y: 40 }, { x: 330, y: 70 }, { x: 300, y: 440 }, { x: 40, y: 410 }];
    const flat = warp(photo(400, 480, page), page);
    expect(flat.width).toBeGreaterThan(250);
    expect(flat.height).toBeGreaterThan(360);
    let dark = 0;
    for (let i = 0; i < flat.data.length; i += 4) if (flat.data[i]! < 150) dark++;
    // Only the anti-aliased rim may touch the table.
    expect(dark / (flat.width * flat.height)).toBeLessThan(0.02);
  });

  it('keeps the page size sensible and capped', () => {
    expect(outputSize([{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 7000 }, { x: 0, y: 7000 }], 2600)).toEqual({ width: 1857, height: 2600 });
  });

  it('turns a page a quarter turn clockwise', () => {
    const px: Pixels = { width: 2, height: 1, data: new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255]) };
    const r = rotate90(px);
    expect([r.width, r.height]).toEqual([1, 2]);
    expect([r.data[0], r.data[4]]).toEqual([1, 2]);
  });
});

describe('page clean-up', () => {
  /** Paper with a shadow across it (bright left, dim right) and ink strokes. */
  function shadowedPage(): Pixels {
    const w = 300, h = 200, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const light = 230 - (x / w) * 110; // 230 -> 120
      const ink = y % 40 < 6 && x % 50 < 35;
      const v = ink ? light * 0.25 : light;
      const i = (y * w + x) * 4;
      data[i] = v; data[i + 1] = v * 0.97; data[i + 2] = v * 0.9; data[i + 3] = 255;
    }
    return { data, width: w, height: h };
  }
  const at = (px: Pixels, x: number, y: number) => px.data[(y * px.width + x) * 4]!;

  it('makes shadowed paper white and keeps ink dark', () => {
    const out = enhance(shadowedPage(), 'document');
    expect(at(out, 10, 20)).toBeGreaterThan(235); // bright paper
    expect(at(out, 290, 20)).toBeGreaterThan(235); // paper in shadow
    expect(at(out, 10, 2)).toBeLessThan(60); // ink in light
    expect(at(out, 260, 2)).toBeLessThan(60); // ink in shadow
  });

  it('black & white has only two colours', () => {
    const out = enhance(shadowedPage(), 'bw');
    const values = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i]!);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255]);
  });

  it('colour stretches levels and original is untouched', () => {
    const page = shadowedPage();
    const { black, white } = levels(page);
    expect(white).toBeGreaterThan(black + 40);
    expect(enhance(page, 'original')).toBe(page);
  });
});
