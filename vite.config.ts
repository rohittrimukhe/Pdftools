import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

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
  base: process.env.HAPPY_BASE ?? '/',
  plugins: [react(), adsTxt()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The PDF engine (pdf-lib, pdf.js) is one large chunk loaded only when a tool opens; Home stays small.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
