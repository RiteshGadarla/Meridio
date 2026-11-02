# Architecture

## Database and Prisma (Stage 1)

**Version:** Prisma 7.10.1, pinned exactly. The `latest` npm tag currently points at an 8.0 release
candidate, so the newest stable major (7.x) is used.

**Why the setup looks the way it does (Prisma 7 + Neon):**

| Concern                   | Decision                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Runtime connection        | `@prisma/adapter-pg` over Neon's **pooled** URL (`DATABASE_URL`)                                            |
| Migration connection      | `prisma.config.ts` uses the **direct** URL (`DIRECT_URL`); poolers can't run migrations reliably            |
| Generated client          | `src/generated/prisma` (gitignored); rebuilt by `prisma generate`, which every backend script runs first    |
| Raw SQL migration         | CHECK constraints and `pg_trgm` indexes, which the Prisma schema cannot express                             |
| Trigram indexes in schema | Declared as `@@index(... type: Gin)` only so drift detection does not try to drop them                      |
| Tests                     | A separate Neon database (`TEST_DATABASE_URL`), migrated by vitest `globalSetup`, tables truncated per test |

**Tenant model:** `Organization` is the tenant. `User` and `Product` carry `organizationId`; SKU is
unique per `(organizationId, sku)`. One owner per organization is enforced in the signup service (a
later stage), not by a unique FK, so multi-user organizations need no schema change.
