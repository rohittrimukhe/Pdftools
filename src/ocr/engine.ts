import type { Worker } from 'tesseract.js';

/**
 * Text recognition (OCR) on this device with Tesseract. The engine and the
 * language data are served from our own site (public/ocr), so it works offline
 * once used, and inside the apps with no network at all.
 */
export type OcrLanguage = 'eng' | 'hin';

export const LANGUAGES: ReadonlyArray<{ id: OcrLanguage; name: string }> = [
  { id: 'eng', name: 'English' },
  { id: 'hin', name: 'Hindi' },
];

export interface OcrPage {
  text: string;
  /** 0–100: how sure the engine is, on average. */
  confidence: number;
  /** The page's words as an invisible text layer (a one-page PDF with no picture), to lay over the page. */
  textLayer?: Uint8Array;
}

const base = () => `${import.meta.env.BASE_URL}ocr/`;

let cached: { key: string; worker: Promise<Worker> } | null = null;
let report: ((progress: number) => void) | undefined;

/** One engine at a time, kept warm for the next page; a new language set starts a new one. */
async function engine(languages: OcrLanguage[]): Promise<Worker> {
  const key = [...languages].sort().join('+');
  if (cached?.key === key) return cached.worker;
  if (cached) void (await cached.worker.catch(() => null))?.terminate();
  const worker = import('tesseract.js').then(({ createWorker, OEM }) => createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: `${base()}worker.min.js`,
    corePath: `${base()}core`,
    langPath: `${base()}lang`,
    gzip: true,
    workerBlobURL: false,
    logger: (m) => { if (m.status === 'recognizing text') report?.(m.progress); },
  }));
  cached = { key, worker };
  worker.catch(() => { if (cached?.worker === worker) cached = null; });
  return worker;
}

export async function recognize(image: Blob, languages: OcrLanguage[], { textLayer = false, onProgress }: { textLayer?: boolean; onProgress?: (fraction: number) => void } = {}): Promise<OcrPage> {
  if (!languages.length) throw new Error('Choose at least one language');
  const worker = await engine(languages);
  report = onProgress;
  try {
    const { data } = await worker.recognize(image, { pdfTextOnly: true }, { text: true, pdf: textLayer });
    return { text: data.text.replace(/[ \t]+\n/g, '\n').trim(), confidence: Math.round(data.confidence), textLayer: data.pdf ? new Uint8Array(data.pdf) : undefined };
  } finally {
    report = undefined;
  }
}

/** Frees the engine's memory (about 100 MB) when OCR is done. */
export async function stopOcr() {
  const current = cached;
  cached = null;
  if (current) await (await current.worker.catch(() => null))?.terminate();
}
