import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// `base` is set by the deploy workflow for GitHub Pages project sites
// (served under /<repo>/); everywhere else the app lives at the root.
export default defineConfig({
  base: process.env.HAPPY_BASE ?? '/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
