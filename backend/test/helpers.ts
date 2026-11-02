/**
 * FILE: backend/test/helpers.ts
 * PURPOSE: Shared builders for API tests (a valid test Env and an app with test-only routes).
 * LAYER: Test support
 */
import type { Router } from 'express';
import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';

export const TEST_ORIGIN = 'http://localhost:5173';

/** A complete, valid config. Pass overrides to vary one setting. */
export function makeTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 4000,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://unused',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    JWT_EXPIRES_IN: '7d',
    TRUST_PROXY_HOPS: 1,
    APP_ORIGIN: TEST_ORIGIN,
    ...overrides,
  };
}

/** Builds the real app with extra routes mounted inside the real middleware stack. */
export function makeTestApp(
  mountRoutes?: (router: Router) => void,
  options: Parameters<typeof createApp>[0] = {},
) {
  return createApp({ env: makeTestEnv(), mountRoutes, ...options });
}
