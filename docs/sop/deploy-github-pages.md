# Deploy the website to GitHub Pages

**Who:** Rohit (once), then automatic  **When:** first launch; after that every merge to `main`  **Time:** 5 minutes once

## One-time setup
1. Open github.com/rohittrimukhe/Pdftools → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
   Expected result: the page says the site will be built by GitHub Actions.
3. Merge the pull request into `main` (or open **Actions → Deploy website → Run workflow**).
4. Wait for the **Deploy website** run to finish (about 2–3 minutes).
   Expected result: a green run whose **deploy** step shows the site address.

The site is then live at **https://rohittrimukhe.github.io/Pdftools/**.

## Every later release
Merge to `main`. The workflow runs the unit tests, builds the site for the `/Pdftools/` address, removes source
maps, and publishes. Visitors get the new version on their next visit; the app also updates its offline copy.

## Check it worked
- The home page opens and shows **0 bytes uploaded** after you use a tool.
- `https://rohittrimukhe.github.io/Pdftools/sitemap.xml` lists the tools.
- Turn on airplane mode after one visit and reload: the app still opens and the tools still work.

## If something goes wrong
- The deploy job says Pages is not enabled → do steps 1–2.
- The site loads without styles or with blank pages → the build ran without `HAPPY_BASE`; re-run the workflow
  (it sets it from the repository name automatically).
- An old version keeps showing → reload once; the offline copy updates in the background and is used next time.
- Rolling back: in **Actions → Deploy website**, open an older successful run and choose **Re-run all jobs**.
