import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base` is set by the deploy workflow for GitHub Pages project sites
// (served under /<repo>/); everywhere else the app lives at the root.
export default defineConfig({
  base: process.env.HAPPY_BASE ?? '/',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
