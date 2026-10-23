# Step 2 — App shell, Home and Settings

**Date:** 2026-10-23  **Result:** passed

## What was built
- **Navigation:** bottom navigation bar on phones and a navigation rail from 840 px wide, with the same three destinations (Home, Recent, Settings) in the same order. A skip link, and focus moves to each new screen.
- **Home:** One UI large title, the privacy promise, search (by name, everyday words and keywords such as "50kb" or "ssc photo"), filter chips that wrap, four Popular quick tiles, and every tool grouped by kind. Tools from later steps are honestly marked **Soon**.
- **Tool catalogue:** 23 tools across Organise, Optimise, Convert, Edit, Secure, Scan and Career, each tagged with the build step that ships it.
- **Settings:** theme, a plain privacy statement, and links to About, Privacy policy, Open-source licenses and the Design system.
- **About, Privacy policy and Licenses:** the licenses list is generated from the libraries in each build, so it can't go out of date.
- **Recent:** an empty state for now. Files arrive in step 3.
- **Errors:** a "Page not found" screen with a way home.
- **Back:** returns to the previous screen, or to the parent screen when the visit started from a shared link.

## Checks
| Check | Result |
|---|---|
| Typecheck | Passed |
| Unit tests | 6 of 6 passed (format and catalogue search) — `unit-tests.txt` |
| Browser tests | 36 of 36 passed on phone and desktop — `browser-tests.txt` |
| Accessibility scan (axe, WCAG 2.1 AA) on all 9 screens, light and dark | No violations |
| No sideways scrolling on all 9 screens | Passed |

Screenshots: `home-*`, `settings-*`, `tools-word-to-pdf-*` (phone and desktop, light and dark).

## Bugs found and fixed
- Back first used `document.referrer`, which never changes inside a single-page app, so it could leave the app. Replaced with a depth counter on the app's history entries.
- Two tests failed on first run because of the tests themselves: the home wording had changed, and on desktop "Home" also matched the logo link "Happy PDF home". Both fixed with exact selectors.
