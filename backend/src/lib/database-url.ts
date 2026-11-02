/**
 * FILE: backend/src/lib/database-url.ts
 * PURPOSE: Helpers for working with the single DATABASE_URL: derive Neon's direct (non-pooled)
 *          address for migrations, and compare two URLs to see if they name the same database.
 * LAYER: Library (pure, no I/O)
 * USED BY: prisma.config.ts (migrations), test/db.ts (dev-vs-test safety check)
 * NOTES: WHY one variable: Neon's pooled and direct addresses differ only by "-pooler" in the host
 *        name. Asking for both was redundant, so the app takes one URL and derives the other.
 */

/**
 * Returns the direct (non-pooled) form of a Neon connection string.
 * Migrations need a real session (advisory locks), which PgBouncer-style poolers do not provide.
 * A URL that is already direct, or a non-Neon URL, is returned unchanged.
 * @example toDirectUrl('postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/db') // host becomes ep-x.eu.aws.neon.tech
 */
export function toDirectUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, '');
  return parsed.toString();
}

/** Host (pooled or direct) plus database name, so two URLs for the same database compare equal. */
export function databaseIdentity(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/-pooler(?=\.)/, '')}${parsed.pathname}`;
}
