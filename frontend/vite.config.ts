/**
 * FILE: frontend/vite.config.ts
 * PURPOSE: Vite dev/build config and Vitest (jsdom) test config for the SPA.
 * LAYER: Config
 * NOTES:
 *  - server.proxy: WHY: the browser only ever calls relative /api/v1; in dev Vite forwards it to the
 *    Express API on 4000, mirroring the Vercel rewrite used in production (same-origin cookies).
 *  - tailwindcss(): Tailwind v4 Vite plugin; no tailwind.config.js needed, theme lives in CSS.
 *  - test.environment 'jsdom': React Testing Library needs a DOM.
 *  - test.setupFiles: registers jest-dom matchers like toBeInTheDocument.
 *  - test.coverage (npm run test:coverage): web >= 70%; the dev-only style guide and the WebGL MagicRings effect (cannot run in jsdom) are excluded.
 */
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // WHY: read frontend/.env so the dev proxy target is configurable without code changes.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { '/api': env.VITE_DEV_API_TARGET ?? 'http://localhost:4000' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        // tests, test helpers, the dev-only style guide, and the bootstrap/type files
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/pages/design-page.tsx',
          'src/components/magic-rings/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
        thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
      },
    },
  };
});
