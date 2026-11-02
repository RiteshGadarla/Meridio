/**
 * FILE: backend/src/lib/logger.test.ts
 * PURPOSE: Verifies secrets are redacted from log output.
 * LAYER: Test
 */
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

function capture() {
  const lines: string[] = [];
  const logger = createLogger(
    { NODE_ENV: 'production' },
    { write: (line: string) => void lines.push(line) },
  );
  return { lines, logger };
}

// Protects: SECURITY: passwords, cookies and tokens never reach log storage.
describe('logger redaction', () => {
  it('does not output password fields', () => {
    const { lines, logger } = capture();
    logger.info(
      { password: 'hunter2', user: { password: 'hunter3', passwordHash: '$2b$x' } },
      'login',
    );
    const out = lines.join('');
    expect(out).not.toMatch(/hunter|\$2b\$x/);
    expect(out).toContain('[Redacted]');
  });

  it('does not output cookie or authorization headers', () => {
    const { lines, logger } = capture();
    logger.info(
      { req: { headers: { cookie: 'sf_session=abc.def', authorization: 'Bearer tok' } } },
      'req',
    );
    expect(lines.join('')).not.toMatch(/sf_session=abc|Bearer tok/);
  });
});
