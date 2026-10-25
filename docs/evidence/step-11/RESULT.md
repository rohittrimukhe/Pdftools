# Step 11 — Scanner and OCR (English and Hindi)

**Date:** 2026-10-25  **Result:** done; both tools are live in the app (Scan section)

## What was built
- **Scan document** (`/tools/scan`)
  - **Take a photo** opens the phone's back camera; **Choose photos** takes existing ones.
  - Each page's **edges are found automatically**: the largest light area against a darker surface, with its four corners. When nothing page-like stands out, the page is marked "check edges".
  - **Corner editor:** drag the four corners, or focus one and use the arrow keys (Shift for bigger steps). Also: Find edges, Whole photo, Rotate, and a live result.
  - The page is **straightened** (perspective correction) and **cleaned up**:
    - Document: shadows lifted, paper white, ink dark.
    - Colour: levels stretched, colour kept.
    - Black & white.
    - Original.
  - Reorder and remove pages. Output: A4 or the page's own shape, as a PDF with no watermark.
  - Optionally **searchable**: each page's words are read on the device and laid invisibly over the picture.
- **Text from scan (OCR)** (`/tools/ocr`)
  - Reads photos, scans and image-only PDFs in **English, Hindi, or both**.
  - Results:
    - Editable text, with **Copy text** and a `.txt` file.
    - Optionally a **searchable PDF** at the original page size.
  - Warns when a page's text may be unreliable (blurry, small or tilted).
- **OCR engine:** Tesseract 7, its neural (LSTM) engine, accurate "best_int" models: English 2.9 MB, Hindi 1.4 MB.
  - Served from our own site (`public/ocr`), never a CDN.
  - The website caches it the first time it's used, so **OCR works offline** after one use.
  - The phone and desktop apps include it, so they need no network.
  - The engine is released when you leave the screen (it holds about 100 MB while working).

## Checks
| Check | Result |
|---|---|
| Unit tests | 88 of 88 passed (10 new: corner order, perspective maths, page detection, straightening, clean-up modes, rotation) |
| Browser tests | 156 of 156 passed, phone and desktop (10 new) |
| Scan, end to end | Two synthetic phone photos (tilted page, shadow): both found automatically, reordered, searchable A4 PDF; its text reads back exactly ("INVOICE 4521 … Total amount 1,250") |
| OCR, English | "Meeting at 10 AM / Room 204, Pune office" read exactly from a photo; `.txt` saved |
| OCR, image-only PDF | Becomes searchable at its original page size (595 × 793 pt); text reads back |
| OCR, Hindi | "नमस्ते दुनिया / यह हिंदी पाठ है" read exactly; mixed Hindi and English too (`ocr-*-hindi.png`) |
| OCR offline | After one use, with the network off and the page reloaded, OCR still works |
| Accessibility | Scan, OCR and the corner editor pass the WCAG 2.1 AA scan |
| Desktop app type check | Still passes |
| Speed (this machine) | About 0.4–0.8 s per page once the engine has loaded |

Screenshots: `scan-*-start.png`, `scan-*-pages.png`, `scan-*-editor.png`, `ocr-*-hindi.png`; test photo `sample-photo.jpg`.

## Design decisions
- **Searchable PDFs are built by us, not by Tesseract.** Tesseract's own PDF sizes the page from the image's resolution, which phone photos and canvases don't carry, giving pages metres wide. We put our own JPEG on a correctly sized page and lay Tesseract's invisible text layer exactly over the picture.
- **The OCR files (16 MB) are not in the first-visit offline cache.** They download only when someone uses OCR, so the website stays light for everyone else.

## Bugs found and fixed
1. **Thin line of table along the page edge** after auto-crop (seen in the corner editor's result). Detected corners now sit 1.2% towards the middle.
2. **A Hindi test could fail at random:** once the offline service worker was running, it fetched the test's font from the network instead of the test's own copy. That test now runs without the service worker.
