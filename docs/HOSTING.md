# Hosting plan

Happy PDF is a static site: HTML, JavaScript, WebAssembly and images. Documents are
processed on the user's device, so there is no server, no database and no file
storage. Hosting is free at any realistic traffic level.

## Stage 1: GitHub Pages (launch)

- The repository is public, so GitHub Pages is free.
- A GitHub Actions workflow builds `main` and publishes `dist/` on every merge.
- Address: `https://rohittrimukhe.github.io/Pdftools/` until a custom domain is added.

Limits (GitHub docs):
- Published site up to 1 GB.
- Soft bandwidth limit of 100 GB per month.
- No custom response headers. Every build writes the headers to `dist/_headers`; Cloudflare adds them (Stage 2). This matters for two things:
  - Security headers (CSP and others) cannot be set by GitHub Pages.
  - Multi-threaded WebAssembly needs cross-origin isolation headers. Until Stage 2 we
    run single-threaded, which works everywhere, only slower on big jobs.

## Stage 2: Cloudflare (domain bought: steps in docs/sop/custom-domain.md)

The only real cost is the domain name (roughly ₹800–1,500 a year). Everything below
is on Cloudflare's free plan.

**Recommended: Cloudflare Pages, connected to this GitHub repo**
- Static requests and bandwidth are unmetered on the free plan.
- 500 builds a month, 20,000 files, 25 MiB per file (our largest asset must stay under this).
- A preview link for every pull request.
- A `_headers` file sets security headers and cross-origin isolation, so multi-threaded
  WebAssembly works.
- The global CDN, free SSL, DDoS protection and the web application firewall come with it.

**Alternative: keep GitHub Pages and put Cloudflare in front**
- Point the domain's DNS at GitHub Pages through Cloudflare's proxy.
- SSL mode "Full (strict)".
- Response-header transform rules add the security headers.
- Cache rules cache static files at the edge.

We do not need a gateway or API server: nothing is uploaded and there is no backend.
If we later need one small server feature (for example, a contact form), Cloudflare
Workers' free plan covers about 100,000 requests a day.

## Ads and hosting

AdSense generally does not approve sites on a shared `github.io` address. Ads go live
after Stage 2 with our own domain. The ad slots stay switched off until then.

## When traffic gets large

Static hosting on Cloudflare does not get more expensive with traffic. Costs only appear
if we add server features (sync, accounts, AI in the cloud). We decide those later
based on real numbers.
