# Step 3 — Smart Drop, saving, Recent and the 0-bytes-uploaded proof

**Date:** 2026-10-23  **Result:** passed

## What was built
- **File detection by content** (`src/files/detect.ts`): PDF (even with junk before the header), JPEG, PNG, GIF, WebP, BMP, HEIC/AVIF, SVG, and Word, Excel or PowerPoint told apart by their internal parts. A renamed file is still recognised.
- **Smart Drop:** a card on Home (choose or drop files), plus drag-and-drop or paste **anywhere** in the app. Paste inside a text field is left alone.
- **Open screen (`/open`):** lists each file with its real type and size, and suggests what to do with it (merge first for several files, compress first for one PDF, image-to-PDF for photos). Shows the top 6 with "Show all".
- **Upload monitor** (`src/privacy/uploadMonitor.ts`): installed before the app starts. It counts every byte the page sends through fetch, XHR, beacons or WebSockets, and the **0 bytes uploaded** badge shows that measurement live.
- **Result card:** rename (extension kept), size, the upload badge, Save, and Share where the device supports it. The finished file is added to Recent.
- **Recent:** finished files kept in this device's IndexedDB for 7 days. Save, share, remove or clear all (with confirmation). A Settings switch turns keeping off, and "Clear recent files now" empties it.
- **Save adapter:** the web uses download and the share sheet. The native apps plug in their own save in step 9.

## Checks
| Check | Result |
|---|---|
| Unit tests | 21 of 21 passed: detection of 13 formats, upload counting, Recent store incl. 7-day expiry and opt-out, file names, suggestions — `unit-tests.txt` |
| Browser tests | 50 of 50 passed on phone and desktop — `browser-tests.txt` |
| Smart Drop, window drop, paste (and paste-in-field ignored) | Passed |
| Upload badge: 0 bytes while reading files; shows "2 KB sent" when a test sends 2 KB | Passed: the measurement is real |
| Save uses the edited name; Recent save, remove, clear | Passed |
| Accessibility scan (axe) on all 10 screens, light and dark; no sideways scroll | Passed |

Screenshots: `home-smart-drop-*`, `open-*`, `result-card-*` (phone and desktop, light and dark).

## Bugs found and fixed
- The typecheck rejected the WebSocket patch signature (shared buffers). Fixed by forwarding `send`'s own parameter types.
- Review of the Open screen screenshot: 16 suggestions was too long to scan. Now the top 6 show, with "Show all".
