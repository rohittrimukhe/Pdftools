// Copies pdf.js support files (character maps, standard fonts, image decoders)
// into public/pdfjs so they are served from our own site, never a CDN.
import { cpSync, rmSync } from 'node:fs';
const target = 'public/pdfjs';
rmSync(target, { recursive: true, force: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `${target}/${dir}`, { recursive: true });
}
console.log('Copied pdf.js assets to public/pdfjs');
