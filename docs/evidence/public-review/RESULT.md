# Public review readiness (version 0.9.0, public preview)

**Date:** 2026-10-25  **Result:** ready for public review once the domain is connected (docs/sop/custom-domain.md)

## What was done
- **Own domain in one setting:** repository variable `HAPPY_DOMAIN`.
  - The deploy workflow then builds for the domain's root, with canonical links, sitemap, `robots.txt` and social previews on `https://<domain>`.
  - Without it, the site keeps working at `rohittrimukhe.github.io/Pdftools/`.
- **Security headers:** every build writes `dist/_headers`.
  - Strict content security policy: only our own files, no inline code except the hashed theme script, no frames, no plugins. Google's ad hosts are added only when ads are switched on.
  - Also nosniff, referrer and permissions policies, no framing, and HSTS.
  - Read directly by Cloudflare Pages, or copied into a Cloudflare transform rule in front of GitHub Pages.
- **Policy test:** `e2e/csp.spec.ts` runs Merge, OCR (WebAssembly in a worker), Word to PDF, the resume preview and Scan under that policy.
  - It shows that an injected script is refused, so the policy is really active in the test.
  - It fails if anything is blocked: with WebAssembly permission removed, the OCR step fails as expected.
- **Terms of use** page (`/terms`) and an updated **privacy policy**: on-device storage and how to clear it, camera use, the OCR download, the apps' network rules, and a changes section.
- **Feedback:** "Report a problem or suggest a tool" in About; contact links in the privacy policy and terms.
- **Version 0.9.0** on the web, desktop and Android, shown as "Public preview" in About.
- **App store readiness:**
  - iOS now declares why it uses the camera. Without that, iOS would end the app on "Take a photo".
  - Android declares the camera for the same button; the camera is optional hardware.
  - Store listing text, privacy answers and a screenshot list: `docs/store-listing.md`.
- README rewritten for reviewers. SOP for the domain and Cloudflare: `docs/sop/custom-domain.md`.

## Checks
| Check | Result |
|---|---|
| Unit tests | 100 of 100 passed |
| Browser tests | 179 of 179 passed, phone and desktop, including every catalogue tool opening its own screen and the security-policy run |
| Lighthouse, Home (mobile) | 97 / 100 / 100 / 100 (LCP 1.8 s) |
| Lighthouse, Word to PDF | 96 / 100 / 100 / 100 (LCP 2.7 s) |
| Lighthouse, Scan document | 95 / 100 / 100 / 100 (LCP 2.8 s) |
| Domain build | With `HAPPY_DOMAIN=happypdf.example`: canonical `https://happypdf.example/tools/merge`, sitemap on the domain |

Reports: `lighthouse-*.report.html`.

## Not yet done (by design, or needs a person)
- **Connecting the domain:** DNS and Cloudflare need the owner's accounts. Steps in `docs/sop/custom-domain.md`.
- **Real-device check of camera capture** on an Android phone and an iPhone: the CI builds can't press buttons. Do it with the CI build before submitting to the stores.
- **Store submission:** needs the Google Play and Apple developer accounts.
- **Step 13 (Recipes and on-device AI):** moved after public review, so feedback can shape it.
