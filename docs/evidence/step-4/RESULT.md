# Step 4 — PDF essentials

**Date:** 2026-10-23  **Result:** passed

## What was built
Ten tools, all running on the device:

| Tool | What it does |
|---|---|
| Merge PDF | Join PDFs; reorder with up/down; files that fail to open are left out with a reason |
| Split PDF | Every N pages, every page, or custom ranges ("1-3, 4-6, 7-last"); several files come as one ZIP |
| Organise pages | Thumbnails; drag or arrows to reorder; rotate left/right; remove/restore; rotate all; undo all |
| Extract pages | Tap pages or type ranges, kept in sync; keeps the typed order |
| Compress PDF | "Keep everything" (lossless) or Light / Balanced / Strong with optional black and white; never returns a bigger file |
| Sign PDF | Draw, type or upload a signature; tap the page to place it (arrow keys too); size; this page or every page |
| Watermark | Text, size, colour, diagonal or straight, visibility |
| Page numbers | Six positions, three styles ("3", "Page 3", "3 of 10"), first number, skip a cover |
| Protect PDF | AES-256 password, typed twice, with plain advice for weak passwords |
| Unlock PDF | Removes a password you know |

Shared: any tool opens a password-protected PDF after asking for the password; errors are plain sentences;
the engine (`src/pdf/engine.ts`) is separate from the screens and unit-tested on its own.

## Checks
| Check | Result |
|---|---|
| Unit tests | 35 of 35 passed — page ranges, merge, reorder/rotate, split, watermark on rotated pages, page numbers, protect/unlock round trip, signature placement, lossless re-save, damaged and non-PDF files |
| Browser tests | 80 of 80 passed on phone and desktop — every tool is run end to end and its **downloaded output is re-read with pdf.js** to check pages, order, rotation, text, encryption and images |
| Compression | A 9.3 MB photo-heavy 2-page PDF became 197 KB on Balanced (98% smaller); a tiny PDF is handed back unchanged rather than bigger |
| Accessibility scan (axe) on a loaded tool | No violations |

Screenshots: `merge-*`, `merge-result-*`, `organise-*`, `compress-result-*`, `sign-*` (phone and desktop, light and dark).

## Bugs found and fixed
- **pdf.js modern build broke on older browsers** (`Map.getOrInsertComputed` missing): page previews and Strong compression hung. Switched to pdf.js's legacy build, which supports older Android WebViews and iOS Safari. A new test checks that thumbnails actually render.
- **Unlock kept the encryption** when re-saving a decrypted PDF. It now copies pages into a fresh document. Caught by a unit test.
- **A truncated PDF opened as an empty document** instead of an error. Zero pages now counts as damaged.
- **Organise:** rotated thumbnails overflowed their tile, and page buttons wrapped untidily; fixed after screenshot review. White pages now sit on a tinted tile so their edges show.
- Test-only fixes: the password field selector also matched "Show password"; the first compression fixture was vector-heavy (which correctly doesn't shrink), replaced by a photo-heavy one like a real scan.
