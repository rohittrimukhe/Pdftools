import { describe, expect, it } from 'vitest';
import { bestQuality, fitUnder, kb, shrinkSteps } from './search';
import { IMAGE_PRESETS } from './presets';

// A pretend encoder: size grows with quality and with the square of scale, like JPEG roughly does.
const encoder = (base: number) => async (scale: number) => async (q: number) => Math.round(base * scale * scale * (0.15 + q));

describe('size search', () => {
  it('returns the highest quality that fits', async () => {
    const found = await bestQuality(await encoder(100_000)(1), 60_000);
    expect(found).not.toBeNull();
    expect(found!.bytes).toBeLessThanOrEqual(60_000);
    expect(found!.quality).toBeGreaterThan(0.4); // 0.45 is the exact answer; search lands within one step
  });

  it('keeps full quality when the file already fits', async () => {
    expect(await bestQuality(await encoder(10_000)(1), 60_000)).toEqual({ quality: 0.95, bytes: 11_000 });
  });

  it('shrinks the picture only when quality alone cannot reach the limit', async () => {
    const result = await fitUnder(encoder(400_000), kb(50), shrinkSteps());
    expect(result).not.toBeNull();
    expect(result!.scale).toBeLessThan(1);
    expect(result!.bytes).toBeLessThanOrEqual(kb(50));
  });

  it('reports when nothing fits', async () => {
    expect(await fitUnder(encoder(10_000_000), 1000, [1, 0.5])).toBeNull();
  });

  it('steps down in 15% decrements to a floor', () => {
    expect(shrinkSteps(0.5)).toEqual([1, 0.85, 0.722, 0.614, 0.522]);
  });

  it('every preset has a sensible range', () => {
    for (const p of IMAGE_PRESETS) {
      expect(p.maxKb, p.id).toBeGreaterThan(p.minKb ?? 0);
      if (p.width || p.height) expect(Boolean(p.width && p.height), p.id).toBe(true);
    }
  });
});

import { whitenPixels } from './image';

describe('signature clean-up', () => {
  it('turns paper white, ink solid, and keeps edges soft', () => {
    const px = new Uint8ClampedArray([230, 225, 210, 255, 40, 40, 60, 255, 130, 130, 130, 255]);
    whitenPixels(px);
    expect([px[0], px[4], px[8]]).toEqual([255, 20, 138]);
  });
});
