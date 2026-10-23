# Step 5 — Exact-size studio

**Date:** 2026-10-23  **Result:** passed

## What was built
One screen with three modes:

- **Photo** and **Signature**: presets for SSC, IBPS, UPSC and NEET photos and signatures, US visa photos and passport-size photos, plus Custom. Width, height, smallest and largest KB are all editable. With a width and height set, the picture is cropped from the centre to that exact shape; without them it keeps its shape. **Clean background** (on by default for signatures) makes paper pure white and ink solid. The output is the sharpest JPEG that fits under the limit, and it uses the full quality budget when a portal has a minimum size.
- **PDF**: limits from 100 KB to 2 MB, or any typed limit. It tries a lossless re-save first; only if that's too big are pages drawn as images, starting at the highest resolution and searching for the best quality that fits. Pages are drawn once per resolution, and only the encoding is repeated during the search.
- Every preset is labelled as a common published value, with "check your official notice", because official limits change by year and post.

The search (`src/exact/search.ts`) is plain logic with its own tests; the browser part only draws and encodes.

## Checks
| Check | Result |
|---|---|
| Unit tests | 42 of 42 passed — incl. best-quality search, shrink steps, "nothing fits", preset sanity, signature clean-up |
| Browser tests | 94 of 94 passed (phone and desktop) |
| IBPS photo | Output exactly 200 × 230 px, between 20 and 50 KB |
| SSC signature | Exactly 315 × 157 px (4 × 2 cm at 200 dpi), at most 20 KB |
| Custom 30 KB, no pixel size | At most 30 KB, original shape kept |
| Photo-heavy 3-page PDF to 200 KB | At most 200 KB, all 3 pages readable |
| Small text PDF to 100 KB | Pages unchanged, text still selectable |
| Impossible limit (3 KB) | A plain explanation with what to try instead |
| Accessibility scan of the screen, light and dark | No violations |

Screenshots: `exact-photo-*`, `exact-result-*` (phone and desktop, light and dark). An SSC photo came out at 30.1 KB, 276 × 354 px.

## Bugs found and fixed
- The file header showed a PDF icon for photos; it now shows the right icon for the file type.
- The four size fields made one long column on phones; they are now two columns (four on wide screens).
- Test-only: "200 KB" also matched "Make it under 200 KB"; exact selectors used.
