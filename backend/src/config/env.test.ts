/**
 * FILE: backend/src/config/env.test.ts
 * PURPOSE: Verifies environment validation fails fast and never echoes secret values.
 * LAYER: Test
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://pooled',
  DIRECT_URL: 'postgresql://direct',
  JWT_SECRET: 'x'.repeat(40),
  APP_ORIGIN: 'https://stockflow.example.com/',
};

// Protects: the server refuses to boot with a missing or weak configuration.
describe('loadEnv', () => {
  it('accepts a valid config, applies defaults and normalises APP_ORIGIN', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN).toBe('7d');
    expect(env.APP_ORIGIN).toBe('https://stockflow.example.com');
  });

  it('throws when JWT_SECRET is missing', () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.JWT_SECRET;
    expect(() => loadEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is shorter than 32 characters, without printing it', () => {
    const weak = 'weak-secret-value';
    let message = '';
    try {
      loadEnv({ ...valid, JWT_SECRET: weak });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/JWT_SECRET.*32/);
    expect(message).not.toContain(weak);
  });

  it('throws for an invalid APP_ORIGIN', () => {
    expect(() => loadEnv({ ...valid, APP_ORIGIN: 'not a url' })).toThrow(/APP_ORIGIN/);
  });
});
