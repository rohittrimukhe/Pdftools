/**
 * Common published limits for Indian exam forms and visa photos. Official notices
 * change between years and differ by post, so every value is only a starting
 * point: the screen says so and lets you edit each one.
 */
export interface ImagePreset {
  id: string;
  label: string;
  kind: 'photo' | 'signature';
  /** Output size in pixels. Omitted when the portal only limits file size. */
  width?: number;
  height?: number;
  minKb?: number;
  maxKb: number;
  note?: string;
}

const cm = (value: number, dpi = 200) => Math.round((value / 2.54) * dpi);

export const IMAGE_PRESETS: ImagePreset[] = [
  { id: 'ssc-photo', label: 'SSC photo', kind: 'photo', width: cm(3.5), height: cm(4.5), minKb: 20, maxKb: 50, note: '3.5 × 4.5 cm, JPEG' },
  { id: 'ssc-sign', label: 'SSC signature', kind: 'signature', width: cm(4), height: cm(2), minKb: 10, maxKb: 20, note: '4 × 2 cm, black ink' },
  { id: 'ibps-photo', label: 'IBPS photo', kind: 'photo', width: 200, height: 230, minKb: 20, maxKb: 50, note: '200 × 230 px' },
  { id: 'ibps-sign', label: 'IBPS signature', kind: 'signature', width: 140, height: 60, minKb: 10, maxKb: 20, note: '140 × 60 px' },
  { id: 'upsc-photo', label: 'UPSC photo', kind: 'photo', minKb: 20, maxKb: 200, note: 'Size limit only' },
  { id: 'upsc-sign', label: 'UPSC signature', kind: 'signature', minKb: 20, maxKb: 100, note: 'Size limit only' },
  { id: 'neet-photo', label: 'NEET photo', kind: 'photo', width: cm(3.5, 300), height: cm(4.5, 300), minKb: 10, maxKb: 200, note: '3.5 × 4.5 cm' },
  { id: 'neet-sign', label: 'NEET signature', kind: 'signature', minKb: 4, maxKb: 30, note: 'Size limit only' },
  { id: 'us-visa', label: 'US visa photo', kind: 'photo', width: 600, height: 600, maxKb: 240, note: '600 × 600 px, square' },
  { id: 'passport-in', label: 'Passport size (3.5 × 4.5 cm)', kind: 'photo', width: cm(3.5, 300), height: cm(4.5, 300), maxKb: 100 },
];

export const PDF_TARGETS_KB = [100, 200, 300, 500, 1024, 2048];
