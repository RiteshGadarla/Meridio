/**
 * FILE: frontend/src/styles/tokens.test.ts
 * PURPOSE: Guards the owner-specified palette against accidental edits.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// WHY readFileSync (not ?raw): the Tailwind Vite plugin would transform an imported CSS module.
// Vitest runs with cwd = frontend/.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8').toLowerCase();

// Protects: the brand palette from the UI brief stays exactly as specified.
describe('tokens.css', () => {
  it.each([
    ['forest', '#173f35'],
    ['limestone', '#f3f1e9'],
    ['copper', '#c46b48'],
    ['sage', '#dce7d8'],
    ['graphite', '#202923'],
    ['sandstone', '#e8ddd1'],
    ['status-healthy', '#438365'],
    ['status-low', '#bd7737'],
    ['status-out', '#b74e43'],
  ])('defines %s as %s', (name, hex) => {
    expect(css).toMatch(new RegExp(`--color-${name}:\\s*${hex}`));
  });
});
