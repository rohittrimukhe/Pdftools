import { describe, expect, it } from 'vitest';
import { resizedSize } from './codec';

describe('resizedSize', () => {
  it('scales by percent', () => expect(resizedSize(1000, 500, { by: 'percent', percent: 50 })).toEqual({ width: 500, height: 250 }));
  it('fits the longest side', () => expect(resizedSize(800, 1200, { by: 'longest', pixels: 600 })).toEqual({ width: 400, height: 600 }));
  it('keeps the shape from one side', () => {
    expect(resizedSize(1000, 500, { by: 'pixels', width: 300, keepShape: true })).toEqual({ width: 300, height: 150 });
    expect(resizedSize(1000, 500, { by: 'pixels', height: 100, keepShape: true })).toEqual({ width: 200, height: 100 });
  });
  it('fits inside a box when keeping the shape, or stretches when told to', () => {
    expect(resizedSize(1000, 500, { by: 'pixels', width: 400, height: 400, keepShape: true })).toEqual({ width: 400, height: 200 });
    expect(resizedSize(1000, 500, { by: 'pixels', width: 400, height: 400, keepShape: false })).toEqual({ width: 400, height: 400 });
  });
  it('never goes below 1 px or above 16384 px', () => {
    expect(resizedSize(10, 10, { by: 'percent', percent: 1 })).toEqual({ width: 1, height: 1 });
    expect(resizedSize(1000, 1000, { by: 'percent', percent: 10000 }).width).toBe(16384);
  });
});
