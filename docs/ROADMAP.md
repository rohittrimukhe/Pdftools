# Happy PDF build plan

**Positioning:** Every document tool. Free. Private. Nothing uploaded.

**Business rules for now**
- No subscription and no usage limits. Revisit only after daily traffic is large enough that infrastructure cost needs it.
- All document work runs on the user's device. We store no user data and run no database.
- Space for ads is designed in from the start, switched off until we turn it on.
- Every line of code, design, text and artwork is our own. Open-source libraries keep their own licenses.

**Stack:** TypeScript + React + Vite for the app. Capacitor for Android and iOS. Tauri 2 for Windows, Linux and macOS. The web build is static files.

---

## How every step is built (the quality gate)

No step is "done" until all of these are true:

1. **Built** on a feature branch, one pull request per step.
2. **Checked:** `npm run typecheck`, `npm test` (unit tests) and `npm run e2e` (browser tests) all pass.
3. **Bugs fixed:** anything found is fixed in the same pull request, or logged as a GitHub issue with a label and linked.
4. **Evidence saved** in `docs/evidence/<step>/`: screenshots (phone and desktop, light and dark), test output and a short `RESULT.md`.
5. **SOP written** in `docs/sop/` for anything a person must do by hand (release, hosting, ads, store upload).
6. **Reviewed and merged** to `main`. `main` must always build and deploy.

---

## Steps

| # | Step | What is in it | Done when |
|---|---|---|---|
| 0 | Foundation | Project setup, folder structure, typecheck, unit and browser test tooling, CI on every pull request | CI is green on an empty app |
| 1 | Design system and brand | Our colours (sunny amber), type, shapes, light/dark, Happy PDF logo and app icons, base components (button, card, chip, sheet, progress, toast) | Component gallery page screenshots in both themes; contrast checks pass |
| 2 | App shell | Navigation bar (phone) and rail (desktop), large-title headers, Home with search, chips, quick tiles, tool list, Settings, About, Licenses | Every route renders on phone and desktop with no sideways scroll |
| 3 | File handling | Smart Drop (drop any file, see what you can do), picker, progress, result card, save/share, "0 bytes uploaded" badge | A browser test proves no network request carries file data |
| 4 | PDF essentials | Merge, split, extract, organise (rotate, delete, reorder), compress, protect/unlock, watermark, page numbers, sign | Unit tests on real sample PDFs for every tool |
| 5 | Exact-Size Studio | Compress PDFs, photos and signatures to an exact KB target, with presets (SSC, UPSC, IBPS, NEET, passport, visa) | Output sizes land under target on the test set |
| 6 | Image tools | Convert, resize, compress, crop for JPG, PNG, WebP, SVG, HEIC, GIF; image to PDF and PDF to image | Round-trip tests for each format |
| 7 | Ad slots | Ad component with places on Home, Results and Help only; never during document work; consent prompt; off unless an ad ID is set | Screenshots with slots on and off; consent stored on the device only |
| 8 | Web launch | GitHub Pages deploy from `main`, offline support (works in airplane mode after first load), SEO pages per tool | Live URL, Lighthouse report saved |
| 9 | Desktop and mobile apps | Tauri builds for Windows, Linux and macOS; Capacitor projects for Android and iOS | Installers built in CI; app screenshots ([evidence](evidence/step-9/RESULT.md)) |
| 10 | Resume Studio | Resume builder, ATS score and job-description match, all on the device | Scoring tests on sample resumes ([evidence](evidence/step-10/RESULT.md)) |
| 11 | Scanner and OCR | Camera scan with edge crop, OCR including Hindi | OCR accuracy checks on sample scans ([evidence](evidence/step-11/RESULT.md)) |
| 12 | Office files | Word, Excel and PowerPoint viewing and conversion, then editing | Fidelity checks on a sample document set ([evidence](evidence/step-12/RESULT.md)) |
| 13 | Recipes and private AI | Chain steps into one tap; on-device summarise and translate where the device supports it | Recipe run tests; AI disabled cleanly where unsupported |
| 14 | Move to Cloudflare | Custom domain behind Cloudflare, see `docs/HOSTING.md` | Domain live over HTTPS with security headers |

Steps 0 to 8 are the first public release. Steps 9 onward ship as updates.
