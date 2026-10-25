/**
 * Finds the best quality that still fits under a size limit. `encode` returns the
 * encoded size in bytes for a quality (0..1); it is called about 7-8 times.
 * Returns the highest quality whose size is <= maxBytes, or null if even the
 * lowest quality is too big.
 */
export async function bestQuality(
  encode: (quality: number) => Promise<number>,
  maxBytes: number,
  { low = 0.05, high = 0.95, steps = 7 } = {},
): Promise<{ quality: number; bytes: number } | null> {
  const top = await encode(high);
  if (top <= maxBytes) return { quality: high, bytes: top };
  const bottom = await encode(low);
  if (bottom > maxBytes) return null;
  let best = { quality: low, bytes: bottom };
  let lo = low;
  let hi = high;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const size = await encode(mid);
    if (size <= maxBytes) { best = { quality: mid, bytes: size }; lo = mid; } else { hi = mid; }
  }
  return best;
}

export interface FitPlan {
  /** Scale factors to try in order, largest first, when quality alone isn't enough. */
  scales: number[];
}

/** Smaller and smaller sizes to try: 100%, 85%, 72%… down to `floor`. */
export function shrinkSteps(floor = 0.25, factor = 0.85): number[] {
  const steps = [1];
  while (steps[steps.length - 1]! * factor >= floor) steps.push(Math.round(steps[steps.length - 1]! * factor * 1000) / 1000);
  return steps;
}

/**
 * Tries quality first at full size, then smaller sizes, and stops at the first
 * size that fits. `encodeAt(scale)` returns an encoder for that scale.
 */
export async function fitUnder(
  encodeAt: (scale: number) => Promise<(quality: number) => Promise<number>>,
  maxBytes: number,
  scales: number[],
): Promise<{ scale: number; quality: number; bytes: number } | null> {
  for (const scale of scales) {
    const found = await bestQuality(await encodeAt(scale), maxBytes);
    if (found) return { scale, ...found };
  }
  return null;
}

export const kb = (n: number) => n * 1024;
