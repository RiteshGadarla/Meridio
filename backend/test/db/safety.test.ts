/**
 * FILE: backend/test/db/safety.test.ts
 * PURPOSE: Ensures the test helper can never be pointed at the development database.
 * LAYER: Test (pure, no database access)
 */
import { describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../db.js';

const dev = 'postgresql://u:p@ep-abc-pooler.c-8.aws.neon.tech/neondb?sslmode=require';

// Protects: tests TRUNCATE tables, so running them against the dev database would destroy data.
describe('getTestDatabaseUrl', () => {
  it('throws when TEST_DATABASE_URL equals DATABASE_URL', () => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: dev, DATABASE_URL: dev })).toThrow(
      /same database/,
    );
  });

  it('throws when it is the same database reached via the direct (non-pooler) host', () => {
    const direct = 'postgresql://u:p@ep-abc.c-8.aws.neon.tech/neondb?sslmode=require';
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: direct, DATABASE_URL: dev })).toThrow(
      /same database/,
    );
  });

  it('throws when TEST_DATABASE_URL is missing', () => {
    expect(() => getTestDatabaseUrl({})).toThrow(/not set/);
  });

  it('accepts a different database', () => {
    const test = 'postgresql://u:p@ep-abc.c-8.aws.neon.tech/stockflow_test';
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: test, DATABASE_URL: dev })).toBe(test);
  });
});
