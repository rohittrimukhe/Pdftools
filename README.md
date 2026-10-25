# Happy PDF

**Every document tool. Free. Private. Nothing uploaded.**

Happy PDF works with PDFs, Word, Excel, PowerPoint, images, scans and resumes. Every tool
runs on your own device, in the browser or in the app, so your files never reach a server.
There's no sign-up, no limit and no watermark, and it keeps working offline.

> **Public preview (0.9).** Please try it and [report problems or suggest tools](https://github.com/rohittrimukhe/Pdftools/issues/new).

## Tools
| Group | Tools |
|---|---|
| Organise | Merge, Split, Organise pages (reorder, rotate, delete), Extract pages |
| Optimise | Compress PDF, Exact-size studio (PDF, photo or signature under a KB limit, with exam and visa presets) |
| Convert | Image to PDF, PDF to image, Convert image, Resize image, Word to PDF, Excel to PDF, PowerPoint to PDF, PDF to Word |
| Edit | Sign, Watermark, Page numbers |
| Secure | Protect with a password (AES-256), Unlock |
| Scan | Scan document (finds the page edges, straightens and cleans it up), Text from scan (OCR) in English and Hindi, searchable PDFs |
| Career | Resume builder (ATS-friendly templates), Resume score (ATS check against a job post) |

**Smart Drop:** drop or paste any file on Home, and Happy PDF suggests what you can do with it.

## Privacy you can check
- Under every result, a badge measures what the page sent anywhere: **0 bytes uploaded**.
- No accounts, analytics or tracking. Recent files and drafts stay on your device and can be cleared.
- The Android app has no internet permission. The desktop app blocks every network address.
- [Privacy policy](src/features/about/Privacy.tsx) · [Terms of use](src/features/about/Terms.tsx)

## Where it runs
- **Web:** any modern browser on phone or computer; installable, and works offline.
- **Desktop:** Windows, macOS and Linux installers, built by the **Apps** workflow.
- **Phone:** Android and iOS apps from the same code, built by the **Apps** workflow.

## For developers
```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck, unit tests, build, browser tests
```
- Stack: TypeScript, React, Vite. pdf-lib and pdf.js for PDFs, Tesseract for OCR, mammoth for Word; Tauri (desktop) and Capacitor (phones).
- [Build plan](docs/ROADMAP.md) · [Design](docs/DESIGN.md) · [Evidence for every step](docs/evidence/) · [Hosting](docs/HOSTING.md) · [Procedures (SOPs)](docs/sop/README.md)

## License
Copyright (c) 2026 Rohit Trimukhe. All rights reserved. This is not open-source software; see [LICENSE](LICENSE).
Third-party components keep their own licenses, listed in the app under Settings › Open-source licenses.
