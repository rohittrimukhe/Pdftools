# Put Happy PDF on our own domain, behind Cloudflare

**Who:** owner of the GitHub repository and the domain  **When:** once, after buying the domain  **Time:** about 30 minutes, plus up to a day for DNS and the certificate

The site stays hosted free on GitHub Pages. Cloudflare's free plan sits in front: DNS,
HTTPS, a global cache, DDoS protection and our security headers. Below, `example.com`
stands for our domain.

## Before you start
- Admin access to the GitHub repository `rohittrimukhe/Pdftools`.
- Access to the registrar where the domain was bought.
- A free Cloudflare account (cloudflare.com).

## Steps
1. **Add the domain to Cloudflare.** Cloudflare → Add a domain → `example.com` → Free plan.
   - Expected result: Cloudflare lists two nameservers.
2. **Point the domain at Cloudflare.** At the registrar, replace the domain's nameservers with Cloudflare's two.
   - Expected result: within a few hours, Cloudflare shows the domain as **Active**.
3. **Create the DNS records** (Cloudflare → DNS → Records). Set both to **DNS only** (grey cloud) for now, so GitHub can issue the certificate:
   - `CNAME` · name `@` · target `rohittrimukhe.github.io`
   - `CNAME` · name `www` · target `rohittrimukhe.github.io`
4. **Tell the build about the domain.** GitHub → repository → Settings → Secrets and variables → Actions → Variables → **New repository variable**: name `HAPPY_DOMAIN`, value `example.com`.
   - Every page's links, sitemap, social previews and `robots.txt` then use `https://example.com`.
5. **Set the custom domain on GitHub.** Settings → Pages → Custom domain → `example.com` → Save.
   - Expected result: the DNS check turns green.
   - When **Enforce HTTPS** becomes available (minutes to a day), tick it.
6. **Publish again:** Actions → Deploy website → Run workflow (or merge any change to `main`).
   - Expected result: `https://example.com` shows Happy PDF, and `https://www.example.com` redirects to it.
7. **Turn on Cloudflare's proxy.** Back in Cloudflare DNS, switch both records to **Proxied** (orange cloud). Then:
   - SSL/TLS → Overview → mode **Full (strict)**.
   - SSL/TLS → Edge Certificates → **Always Use HTTPS** on.
8. **Add the security headers.** GitHub Pages can't send them, so Cloudflare adds them. Rules → Transform Rules → Modify Response Header → Create rule.
   - Applies to: all incoming requests.
   - **Set static** each header exactly as written in the `_headers` file of the latest build. It's in `dist/_headers` after `npm run build`; the build computes the policy, so always copy it from there:
     - `Content-Security-Policy`
     - `X-Content-Type-Options`
     - `Referrer-Policy`
     - `Permissions-Policy`
     - `X-Frame-Options`
     - `Strict-Transport-Security`
9. **Cache the hashed files hard.** Rules → Cache Rules → Create rule.
   - When: URI path starts with `/assets/`. Then: eligible for cache, Edge TTL **1 year**, Browser TTL **1 year**.
   - Leave everything else on default caching. `sw.js` and the HTML pages must stay fresh.

## Check it worked
- `https://example.com/tools/merge` opens Merge directly, with a padlock.
- securityheaders.com on `https://example.com` shows the headers above.
- In the browser's developer tools (Console), using Merge, OCR and Word to PDF shows no "Refused to" messages.
- Search Console (search.google.com/search-console): add the domain and submit `https://example.com/sitemap.xml`.

## If something goes wrong
- **GitHub says "DNS check unsuccessful"** → the records must be DNS only (grey) during step 5. Wait for DNS to spread, then press Check again.
- **"Too many redirects"** → the Cloudflare SSL mode is Flexible. Set **Full (strict)**.
- **A tool stops working after step 8** → the headers don't match the current build (a new inline script means a new hash). Copy them again from `dist/_headers`. The browser test `e2e/csp.spec.ts` checks every build against its own policy.
- **Old version still showing** → Cloudflare → Caching → Configuration → Purge Everything. HTML isn't cached long, so this is rarely needed.

## Alternative: Cloudflare Pages instead of GitHub Pages
Cloudflare Pages reads the `_headers` file itself, so step 8 isn't needed.
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → choose `rohittrimukhe/Pdftools`, branch `main`.
2. Build command `npm run build`, output directory `dist`, environment variables `NODE_VERSION=22` and `HAPPY_DOMAIN=example.com`.
3. Custom domains → add `example.com`; Cloudflare sets the DNS.
4. In GitHub, turn Pages off, so only one site is live.
