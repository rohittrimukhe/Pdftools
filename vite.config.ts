import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };
import { sitePlugin } from './build/site';

const base = process.env.HAPPY_BASE ?? '/';
const siteUrl = process.env.HAPPY_SITE_URL ?? `https://rohittrimukhe.github.io${base.replace(/\/$/, '')}`;

// `base` is set by the deploy workflow for GitHub Pages project sites
// (served under /<repo>/); everywhere else the app lives at the root.
/** Publishes ads.txt (required by AdSense) only when ads are configured. */
function adsTxt(): Plugin {
  return {
    name: 'happy-ads-txt',
    generateBundle() {
      const client = process.env.VITE_ADSENSE_CLIENT;
      if (!client) return;
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), adsTxt(), sitePlugin({ base, siteUrl })],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The PDF engine (pdf-lib, pdf.js) is one large chunk loaded only when a tool opens; Home stays small.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
