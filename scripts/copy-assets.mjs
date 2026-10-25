// Copies engine files into public/ so they are served from our own site, never a CDN:
// - pdf.js support files (character maps, standard fonts, image decoders) -> public/pdfjs
// - OCR engine (Tesseract worker and core) and English/Hindi language data -> public/ocr
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('public/pdfjs', { recursive: true, force: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `public/pdfjs/${dir}`, { recursive: true });
}

rmSync('public/ocr', { recursive: true, force: true });
mkdirSync('public/ocr/core', { recursive: true });
mkdirSync('public/ocr/lang', { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
// Only the LSTM builds: the app always uses the neural engine. The worker picks the fastest the device supports.
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  cpSync(`node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`, `public/ocr/core/tesseract-core-${variant}.wasm.js`);
}
// "best_int": the accurate models, stored as integers to stay small (English 2.9 MB, Hindi 1.4 MB).
for (const lang of ['eng', 'hin']) {
  cpSync(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `public/ocr/lang/${lang}.traineddata.gz`);
}
console.log('Copied pdf.js and OCR assets to public/');
