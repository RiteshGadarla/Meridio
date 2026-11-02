/**
 * FILE: backend/src/lib/database-url.test.ts
 * PURPOSE: Unit tests for the DATABASE_URL helpers.
 */
import { describe, expect, it } from 'vitest';
import { databaseIdentity, toDirectUrl } from './database-url.js';

const POOLED =
  'postgresql://user:p%40ss@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Protects: migrations always get a direct connection even though the app only has one URL.
describe('toDirectUrl', () => {
  it('removes -pooler from the host and keeps credentials, database and query', () => {
    const direct = new URL(toDirectUrl(POOLED));
    expect(direct.hostname).toBe('ep-cool-name-123456.us-east-2.aws.neon.tech');
    expect(direct.username).toBe('user');
    expect(direct.password).toBe('p%40ss');
    expect(direct.pathname).toBe('/neondb');
    expect(direct.search).toBe('?sslmode=require&channel_binding=require');
  });

  it('leaves an already-direct URL unchanged', () => {
    const direct =
      'postgresql://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require';
    expect(toDirectUrl(direct)).toBe(direct);
  });

  // Why: a host that merely contains the word must not be mangled (for example a local database).
  it('does not touch non-Neon hosts', () => {
    expect(new URL(toDirectUrl('postgresql://u:p@localhost:5432/app')).hostname).toBe('localhost');
    expect(new URL(toDirectUrl('postgresql://u:p@my-pooler-box/app')).hostname).toBe(
      'my-pooler-box',
    );
  });
});

describe('databaseIdentity', () => {
  it('is equal for the pooled and direct form of the same database, different otherwise', () => {
    expect(databaseIdentity(POOLED)).toBe(databaseIdentity(toDirectUrl(POOLED)));
    expect(databaseIdentity(POOLED)).not.toBe(
      databaseIdentity(POOLED.replace('/neondb', '/other')),
    );
  });
});
