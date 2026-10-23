# Step 7 — Ad slots (off until enabled)

**Date:** 2026-10-23  **Result:** passed

## What was built
- **Off by default:** ads stay off unless the site is built with an AdSense publisher ID and an ad unit ID for each placement. Malformed IDs are ignored rather than sent to the ad network.
- **Three placements, and nowhere else:** Home (below the tools), under a finished file, and Recent. Never while a document is open or being processed. Each ad sits in a labelled **Advertisement** box with reserved height, so the page doesn't jump.
- **The upload badge stays honest:** the monitor counts requests to ad-serving hosts separately, so ad traffic is never reported as your files leaving the device. The host list is kept narrow on purpose; anything else still counts on the badge.
- **Settings:** a "Non-personalised ads only" switch appears only when ads are on.
- **Privacy policy:** its Advertising section changes with the build. It says "no ads" now, and describes AdSense, cookies, consent and the opt-out when ads are on.
- **`ads.txt`:** generated at build time only when a publisher ID is set.
- **Native apps:** the Android, iOS and desktop apps never show web ads; they use their own ad SDKs in step 9.
- **SOP:** `docs/sop/ads.md` covers AdSense sign-up, Google's free EU/UK consent message, ad units, the build settings for GitHub and Cloudflare, checking and turning ads off.

## Checks
| Check | Result |
|---|---|
| Unit tests | 53 of 53 passed (ad rules: off by default, per-placement IDs, malformed IDs ignored, never in native apps, ad host matching kept narrow; ad traffic counted apart from uploads) |
| Browser tests | 122 of 122 passed (phone and desktop) |
| Default build | No Advertisement boxes, no request to any ad network on Home, Recent, Settings and Privacy; no `ads.txt` |
| Build with ad IDs | Ad on Home; none on Recent (no ad unit set); none while a document is loaded; ad under the finished file; the badge still shows **0 bytes uploaded** even though the stand-in ad script sent a 4 KB beacon; Settings switch and policy section present; `ads.txt` correct |

Screenshots: `home-ad-slot-*` and `settings-ads-*` from a build with test IDs (the ad network was stubbed, so the box is empty).

## Bugs found and fixed
- Test-only: the ads tests started their own preview server, but stopping `npx` left the server running and holding the port. Each test project now gets its own build and port, and the whole process group is stopped.
