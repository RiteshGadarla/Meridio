/**
 * FILE: frontend/src/test/setup.ts
 * PURPOSE: Vitest setup: jest-dom matchers, cleanup, MSW server lifecycle, relative-URL fetch.
 * LAYER: Test config
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

// WHY: the app calls relative /api/v1 URLs, which Node's fetch rejects. Resolve them against a
// fake origin so MSW can intercept them exactly like the browser proxy would.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nativeFetch(
    typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input,
    init,
  );

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // WHY: globals are off, so RTL's automatic cleanup is not registered; do it explicitly.
  cleanup();
});
afterAll(() => server.close());
