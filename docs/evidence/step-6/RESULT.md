# Step 6 — Image tools

**Date:** 2026-10-23  **Result:** passed

## What was built
- **Image codec** (`src/images/codec.ts`):
  - **Reads** JPG, PNG, WebP, GIF (first frame), BMP and SVG in every browser, and HEIC where the browser supports it (Safari; elsewhere a clear message says how to switch the iPhone camera to "Most Compatible").
  - **Writes** JPG, PNG, WebP and GIF (via `gifenc`, MIT). A browser that can't write a format says so instead of quietly saving PNG.
  - Camera rotation is applied.
- **Image to PDF:** reorder images; A4, US Letter or "same as image" pages; wide images turn the page sideways; no, small or large margin. Big phone photos are scaled to 3000 px on the long side.
- **PDF to image:** JPG or PNG at 96, 150 or 300 dpi; all pages or typed pages; several pages come as one ZIP.
- **Convert image:** to JPG, PNG, WebP or GIF, with quality for JPG and WebP. Transparent areas become white in JPG. Several images give one ZIP.
- **Resize image:** by percentage, exact pixels (keep shape or stretch) or longest side; same format or any output format; batch to ZIP.

## Checks
| Check | Result |
|---|---|
| Unit tests | 47 of 47 passed (resize maths incl. limits) |
| Browser tests | 116 of 116 passed (phone and desktop) |
| Image to PDF | A wide image becomes an 842 × 595 landscape A4 page; "same as image" pages match the image size |
| PDF to image | Page 2 alone as a JPG at 150 dpi (1240 × 1754 px); all 3 pages as PNG in a ZIP |
| Convert | Output bytes really are WebP, GIF or JPG (checked by file signature); SVG becomes a 1024 × 512 PNG |
| Resize | 50% → 500 × 300; longest side 250 → 250 × 150; stretch to 300 × 300; two images → one ZIP |
| HEIC in Chromium | Clear explanation instead of a failure |
| Accessibility scan (axe) on Image to PDF, Resize image (empty and loaded) | No violations |

Screenshots: `image-to-pdf-*`, `resize-result-*` (phone and desktop, light and dark).

## Bugs found and fixed
- Pages were drawn one pixel narrow (sizes rounded down, so 1239.6 px became 1239). Now rounded to the nearest pixel. Found by the PDF-to-image test.
- "Add more" buttons stretched across the screen and competed with the main action; they now keep their own width.

## Known limit
- HEIC photos open only in browsers that support HEIC (Safari on iPhone, iPad and Mac). Native HEIC decoding comes with the Android and desktop apps in step 9.
