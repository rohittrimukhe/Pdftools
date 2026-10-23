import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it('keeps small sizes in whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('switches unit at 1024 and keeps one decimal', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(50 * 1024)).toBe('50 KB');
    expect(formatBytes(1.45 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('rejects impossible sizes', () => {
    expect(() => formatBytes(-1)).toThrow(RangeError);
    expect(() => formatBytes(Number.NaN)).toThrow(RangeError);
  });
});
