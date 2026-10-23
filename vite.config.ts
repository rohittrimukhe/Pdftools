import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// `base` is set by the deploy workflow for GitHub Pages project sites
// (served under /<repo>/); everywhere else the app lives at the root.
export default defineConfig({
  base: process.env.HAPPY_BASE ?? '/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The PDF engine (pdf-lib, pdf.js) is one large chunk loaded only when a tool opens; Home stays small.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
