import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { APP_NAME, ROUTE_META, TAGLINE } from '../src/app/meta';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

/**
 * After each production build: one pre-rendered page per route (own title,
 * description, canonical link), a 404 fallback for client-side routes, the
 * sitemap, robots.txt, the web app manifest and the offline service worker.
 */
/**
 * The security headers for hosts that read a `_headers` file (Cloudflare Pages, Netlify), and the
 * values to copy into a Cloudflare transform rule in front of GitHub Pages (docs/sop/custom-domain.md).
 * The policy allows only our own files, plus Google's ad hosts when ads are switched on.
 */
export function securityHeaders(inlineScripts: string[], ads: boolean): Record<string, string> {
  const hashes = inlineScripts.map((code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`);
  const adScripts = ads ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google https://*.googletagservices.com' : '';
  const adFrames = ads ? 'https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://www.google.com' : "'none'";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}${adScripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${ads ? ' https:' : ''}`,
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src 'self' blob: data:${ads ? ' https://*.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net' : ''}`,
    `frame-src ${adFrames}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000',
  };
}

export function sitePlugin({ base, siteUrl, ads = false }: { base: string; siteUrl: string; ads?: boolean }): Plugin {
  let outDir = 'dist';
  return {
    name: 'happy-site',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const site = siteUrl.replace(/\/$/, '');
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      const page = (path: string, title: string, description: string, index = true) => template
        .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, [
          `<meta name="description" content="${escape(description)}" />`,
          `<link rel="canonical" href="${site}${path}" />`,
          `<meta property="og:title" content="${escape(title)}" />`,
          `<meta property="og:description" content="${escape(description)}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:url" content="${site}${path}" />`,
          `<meta property="og:image" content="${site}/icons/icon-512.png" />`,
          `<link rel="manifest" href="${base}manifest.webmanifest" />`,
          ...(index ? [] : ['<meta name="robots" content="noindex" />']),
        ].join('\n    '));

      for (const meta of ROUTE_META) {
        const dir = join(outDir, meta.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), page(meta.path, meta.title, meta.description, meta.index !== false));
      }
      // GitHub Pages serves 404.html for unknown paths; the app then shows its own "Page not found".
      writeFileSync(join(outDir, '404.html'), page('/', ROUTE_META[0]!.title, ROUTE_META[0]!.description));

      // Security headers, with the hash of the one inline script (the theme, set before the page draws).
      const inline = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
      const headers = securityHeaders(inline, ads);
      writeFileSync(join(outDir, '_headers'), [
        `${base}*`, ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`),
        `${base}assets/*`, '  Cache-Control: public, max-age=31536000, immutable',
        `${base}sw.js`, '  Cache-Control: no-cache',
        '',
      ].join('\n'));

      const today = new Date().toISOString().slice(0, 10);
      writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTE_META.filter((m) => m.index !== false).map((m) => `  <url><loc>${site}${m.path === '/' ? '/' : `${m.path}/`}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
      writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
      writeFileSync(join(outDir, 'manifest.webmanifest'), JSON.stringify({
        name: APP_NAME,
        short_name: APP_NAME,
        description: TAGLINE,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8f6f1',
        theme_color: '#f8f6f1',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }, null, 2));

      // The app shell is cached on first visit; pdf.js data, the OCR engine (16 MB) and fonts are cached the first time they are used.
      const all = files(outDir).map((f) => relative(outDir, f).split('\\').join('/'));
      const shell = all.filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !f.startsWith('pdfjs/') && !f.startsWith('ocr/') && !/(^|\/)index\.html$/.test(f) || f === 'index.html');
      const version = createHash('sha256').update(shell.map((f) => `${f}:${statSync(join(outDir, f)).size}`).join('\n')).digest('hex').slice(0, 12);
      const sw = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__BASE__', base)
        .replace('__PRECACHE__', JSON.stringify(shell.map((f) => `${base}${f === 'index.html' ? '' : f}`)));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}
