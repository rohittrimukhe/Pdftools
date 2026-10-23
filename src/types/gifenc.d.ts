// Types for the parts of gifenc (MIT) that Happy PDF uses.
declare module 'gifenc' {
  export type Palette = number[][];
  export function quantize(rgba: Uint8ClampedArray, maxColors: number, options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number }): Palette;
  export function applyPalette(rgba: Uint8ClampedArray, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; transparent?: boolean; transparentIndex?: number; delay?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): Encoder;
}
