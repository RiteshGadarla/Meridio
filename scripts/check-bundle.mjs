#!/usr/bin/env node
/**
 * FILE: scripts/check-bundle.mjs
 * PURPOSE: Fails the build if the built web app (frontend/dist) contains anything that must never
 *          ship to a browser: localhost URLs, database URLs, secrets, or the backend's host.
 * USAGE:   node scripts/check-bundle.mjs [dir]   (default frontend/dist). Runs at the end of
 *          `npm run build`.
 * NOTES:   The backend URL must exist ONLY in frontend/vercel.json; the browser calls relative /api/v1.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Each rule: a name and a pattern that must NOT appear in any built file. */
export const FORBIDDEN = [
  { name: 'localhost API URL', pattern: /localhost:4000/ },
  { name: 'JWT_SECRET reference', pattern: /JWT_SECRET/ },
  { name: 'DATABASE_URL reference', pattern: /DATABASE_URL|DIRECT_URL/ },
  { name: 'Postgres connection string', pattern: /postgres(ql)?:\/\//i },
  { name: 'Neon credential', pattern: /npg_[A-Za-z0-9]{8,}/ },
  { name: 'hardcoded Render host', pattern: /\.onrender\.com/ },
  { name: 'bcrypt hash', pattern: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/ },
];

/** Recursively lists files under a directory. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

/**
 * Scans every text-like file under `dir`.
 * @param {string} dir built output directory
 * @returns {{ file: string, rule: string }[]} one entry per forbidden match (empty = clean)
 */
export function scanDirectory(dir) {
  const findings = [];
  for (const file of walk(dir)) {
    if (!/\.(js|mjs|css|html|json|map|txt|svg)$/i.test(file)) continue; // skip fonts/images
    const text = readFileSync(file, 'utf8');
    for (const { name, pattern } of FORBIDDEN) {
      if (pattern.test(text)) findings.push({ file, rule: name });
    }
  }
  return findings;
}

// ===== CLI =====
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2] ?? 'frontend/dist';
  if (!existsSync(dir)) {
    console.error(`Bundle check: ${dir} does not exist. Build the frontend first.`);
    process.exit(1);
  }
  const findings = scanDirectory(dir);
  if (findings.length > 0) {
    console.error('Bundle check FAILED. Forbidden content in the web build:');
    for (const f of findings) console.error(`  - ${f.rule}: ${f.file}`);
    process.exit(1);
  }
  console.log(`Bundle check passed: no forbidden content in ${dir}.`);
}
