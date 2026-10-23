# Turn ads on or off

**Who:** Rohit (account owner)  **When:** once the site is on our own domain (step 14)  **Time:** about 30 minutes, plus Google's review (days to weeks)

Ads are **off** in every build unless the publisher ID below is set. With ads off, the app makes no
contact with any ad network and shows no empty ad boxes.

## Where ads can appear
- Home, below the tool list.
- Under a finished file (after "Your file is ready").
- Recent, below the list.

Ads never appear while a document is open or being processed, and the ad code never receives files.
Requests from the ad network are counted separately, so the "0 bytes uploaded" badge still reports only what
leaves the device from your work.

## Before you start
- The site must be live on our own domain (AdSense does not accept shared `github.io` addresses).
- A Google account for the business.

## Steps
1. Go to adsense.google.com and sign up with the business Google account. Add the site's domain.
   Expected result: AdSense shows a publisher ID like `ca-pub-1234567890123456`.
2. In AdSense → **Privacy & messaging**, create a **European regulations** message (Google's free consent
   message for the EU, UK and Switzerland) and publish it. Optionally also a US state regulations message.
   Expected result: the message shows as "Published".
3. In AdSense → **Ads → By ad unit**, create three **Display ads** (responsive): "Home", "Result", "Recent".
   Expected result: each has a numeric ad unit ID like `1234567890`.
4. Add these as build settings where the site is built:
   - GitHub: repository **Settings → Secrets and variables → Actions → Variables**
   - Cloudflare Pages: project **Settings → Environment variables** (Production)

   | Name | Value |
   |---|---|
   | `VITE_ADSENSE_CLIENT` | your publisher ID (`ca-pub-…`) |
   | `VITE_ADSENSE_SLOT_HOME` | the Home ad unit ID |
   | `VITE_ADSENSE_SLOT_RESULT` | the Result ad unit ID |
   | `VITE_ADSENSE_SLOT_RECENT` | the Recent ad unit ID (leave empty to keep Recent ad-free) |

5. Re-run the deploy (push to `main`, or "Retry deployment").
   Expected result: `https://<our-domain>/ads.txt` shows `google.com, pub-…, DIRECT, f08c47fec0942fa0`.
6. In AdSense, request a review of the site.

## Check it worked
- Home shows a box labelled **Advertisement** below the tools.
- Settings shows **Ads → Non-personalised ads only**.
- Settings → Privacy policy shows the AdSense section.
- Running a tool still shows **0 bytes uploaded**.

## Turn ads off
Delete `VITE_ADSENSE_CLIENT` (or leave it empty) and re-deploy. The ad boxes, the Settings switch, the
policy section and `ads.txt` all disappear.

## If something goes wrong
- No ad box appears → the IDs must look like `ca-pub-` + digits and digits only; anything else is ignored on purpose.
- Box appears but stays blank → normal until AdSense approves the site; also check an ad blocker isn't on.
- AdSense says ads.txt is missing → check step 5 and that the domain matches the one in AdSense.
