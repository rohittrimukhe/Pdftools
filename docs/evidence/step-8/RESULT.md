# Step 8 — Website launch on GitHub Pages

**Date:** 2026-10-23  **Result:** ready to go live (needs one setting in GitHub, below)

## What was built
- **Deploy workflow** (`.github/workflows/deploy.yml`): on every merge to `main` it runs the unit tests, builds for the `/Pdftools/` address, removes source maps and publishes to GitHub Pages. Ad settings come from repository variables and stay empty, so ads are off.
- **Pre-rendered pages:** every route and tool has its own `index.html` with its own title, description, canonical link and social preview tags. Tools not built yet are marked `noindex` and left out of the sitemap.
- **`404.html`:** links into the app open correctly on GitHub Pages.
- **`sitemap.xml`** (21 pages) and **`robots.txt`**.
- **Installable app:** a web app manifest with icons (including a maskable one), so phones and computers can install Happy PDF.
- **Offline:** a service worker caches the app shell (67 files, 2.85 MB) on the first visit. Pages are fresh when online and come from the cache when offline. pdf.js data files are cached the first time they're used. It only ever touches Happy PDF's own files.
- **Faster tool pages:** the PDF engines (pdf-lib, pdf.js) now load when a file is opened or an action runs, not when a tool page opens.
- **Browser tab:** each screen sets its own title and description.
- **SOP:** `docs/sop/deploy-github-pages.md` covers the one-time setup, releases, checks and rollback.

## Checks
| Check | Result |
|---|---|
| Unit tests | 53 of 53 passed |
| Browser tests | 128 of 128 passed (phone and desktop) |
| Works offline | After one visit with the network turned off, Merge opens, runs and its output is correct |
| Pre-rendered pages | `/tools/compress/` has its own title and canonical link; unbuilt tools are `noindex`; sitemap and manifest correct |
| Lighthouse, Home (mobile) | Performance **99**, Accessibility **100**, Best practices **100**, SEO **100** (LCP 1.8 s, TBT 30 ms) |
| Lighthouse, Compress PDF (mobile) | Performance **97**, Accessibility **100**, Best practices **100**, SEO **100** (LCP 2.4 s, TBT 10 ms) |

Reports: `lighthouse-home.report.html`, `lighthouse-compress.report.html`.

## Bugs found and fixed
- **Slow tool pages:** Lighthouse scored the Compress page 80, because tool pages downloaded about 490 KB of PDF engine code before a file was chosen (LCP 4.5 s). The engines now load on demand: the page downloads 100 KB, LCP is 2.4 s and the score is 97.

## To go live (Rohit, once)
GitHub → Pdftools → **Settings → Pages → Source: GitHub Actions**, then merge the pull request. The site
appears at https://rohittrimukhe.github.io/Pdftools/. Details in `docs/sop/deploy-github-pages.md`.
