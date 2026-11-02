# Code Map

One line per file. Updated every stage.

## Root

| File                 | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `package.json`       | npm workspaces and root scripts (dev, build, lint, typecheck, test) |
| `tsconfig.base.json` | Shared strict TypeScript options                                    |
| `eslint.config.js`   | Repo-wide ESLint flat config (typescript-eslint, react-hooks)       |
| `.prettierrc`        | Prettier formatting rules                                           |
| `.prettierignore`    | Paths Prettier skips                                                |
| `.editorconfig`      | Editor whitespace settings                                          |
| `.gitignore`         | Ignored files (env files, build output, private docs)               |
| `README.md`          | Stage status, local setup                                           |

## packages/contracts

| File                  | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `package.json`        | Package `@meridio/contracts`, builds to `dist`        |
| `tsconfig.json`       | Typecheck config (includes tests)                     |
| `tsconfig.build.json` | Build config (emits `dist`, excludes tests)           |
| `src/index.ts`        | Public exports: `PRODUCT_NAME`, `ApiSuccess` type     |
| `src/common.ts`       | Shared API envelope types and the list of error codes |
| `src/auth.ts`         | signup/login Zod schemas and the `AuthUser` type      |
| `src/auth.test.ts`    | Tests for the auth validation rules                   |
| `src/index.test.ts`   | Smoke test for the exports                            |

## backend

| File                                                               | Purpose                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `package.json`                                                     | Scripts: dev (tsx), build (tsc), start, test                                     |
| `tsconfig.json`                                                    | Typecheck config                                                                 |
| `tsconfig.build.json`                                              | Build config (emits `dist`)                                                      |
| `.env.example`                                                     | Backend env vars (copy to `backend/.env`, never commit)                          |
| `prisma.config.ts`                                                 | Prisma CLI config: schema path, migrations folder, direct Neon URL               |
| `prisma/schema.prisma`                                             | Database schema: Organization, User, Product                                     |
| `prisma/migrations/*_init/migration.sql`                           | Initial tables, indexes and foreign keys                                         |
| `prisma/migrations/*_constraints_and_search_indexes/migration.sql` | CHECK constraints and pg_trgm search indexes                                     |
| `prisma/seed.ts`                                                   | Idempotent dev seed (2 orgs, 2 users, 14 products)                               |
| `src/lib/prisma.ts`                                                | Shared PrismaClient singleton and `createPrismaClient` factory                   |
| `test/db.ts`                                                       | Test DB helpers: safe URL guard, client factory, table reset                     |
| `test/global-setup.ts`                                             | Migrates the test database once before the suite                                 |
| `test/db/schema.test.ts`                                           | Constraints, SKU uniqueness, Decimal precision, cascades                         |
| `test/db/seed.test.ts`                                             | Seed idempotency and cross-org SKU reuse                                         |
| `test/db/safety.test.ts`                                           | Test helper refuses the dev database                                             |
| `vitest.config.ts`                                                 | Vitest config (node environment)                                                 |
| `src/config/env.ts`                                                | Zod-validated environment config (`loadEnv`), fails fast without printing values |
| `src/config/env.test.ts`                                           | Tests env validation                                                             |
| `src/lib/logger.ts`                                                | pino logger with secret redaction, pretty in dev, JSON in prod                   |
| `src/lib/logger.test.ts`                                           | Tests log redaction                                                              |
| `src/middleware/request-id.ts`                                     | Assigns/echoes `x-request-id`                                                    |
| `src/middleware/origin-check.ts`                                   | Rejects foreign `Origin` on POST/PATCH/PUT/DELETE                                |
| `src/middleware/cache-control.ts`                                  | `private, no-store` on API responses (not health)                                |
| `src/middleware/not-found.ts`                                      | 404 error envelope for unmatched routes                                          |
| `src/middleware/error-handler.ts`                                  | Maps AppError, Zod, Prisma P2002, body-parser errors to the envelope             |
| `src/middleware/validate.ts`                                       | Zod validation for body/query/params, replaces with parsed value                 |
| `src/lib/password.ts`                                              | bcrypt (cost 12) hash and verify                                                 |
| `src/lib/password.test.ts`                                         | Tests hashing                                                                    |
| `src/lib/jwt.ts`                                                   | Sign/verify the session JWT; `parseDuration`                                     |
| `src/lib/jwt.test.ts`                                              | Tests round trip, wrong secret, expired, alg none                                |
| `src/middleware/auth.ts`                                           | `requireAuth` (cookie -> JWT -> DB user -> `req.auth`) and `getAuth`             |
| `src/middleware/rate-limit.ts`                                     | Login and signup rate limiters (configurable)                                    |
| `src/modules/auth/auth.cookie.ts`                                  | Set/clear/read the `sf_session` cookie                                           |
| `src/modules/auth/auth.service.ts`                                 | Signup transaction, login, current user                                          |
| `src/modules/auth/auth.controller.ts`                              | HTTP layer for auth                                                              |
| `src/modules/auth/auth.routes.ts`                                  | `/auth` routes wiring                                                            |
| `test/api/auth.test.ts`                                            | End-to-end auth, tenant context and rate-limit tests                             |
| `src/modules/inventory/stock-status.ts`                            | Single implementation of effective threshold and stock status                    |
| `src/modules/inventory/stock-status.test.ts`                       | Table-driven tests for the stock status rule                                     |
| `src/modules/inventory/index.ts`                                   | Public exports of the inventory module                                           |
| `src/modules/products/products.service.ts`                         | Tenant-scoped product CRUD, search, sort, pagination, status filter              |
| `src/modules/products/products.controller.ts`                      | HTTP layer for products                                                          |
| `src/modules/products/products.routes.ts`                          | `/products` routes (all behind requireAuth)                                      |
| `src/modules/products/index.ts`                                    | Exports `createProductsRouter`                                                   |
| `test/api/products.test.ts`                                        | Product CRUD, search, pagination, sorting, status filter tests                   |
| `test/api/tenant-isolation.test.ts`                                | Cross-tenant access, spoofing and SKU scoping tests                              |
| `src/utils/app-error.ts`                                           | `AppError` with code, status, fieldErrors                                        |
| `src/utils/api-response.ts`                                        | `ok()` success envelope helper                                                   |
| `src/utils/async-handler.ts`                                       | Forwards async handler rejections to the error handler                           |
| `src/modules/health/health.routes.ts`                              | `/health/live` and `/health/ready`                                               |
| `src/modules/{dashboard,settings}/index.ts`                        | Placeholders for future modules                                                  |
| `test/helpers.ts`                                                  | Builds a valid test Env and the real app with test-only routes                   |
| `test/api/foundation.test.ts`                                      | Health, error shapes, headers, request id, origin check                          |
| `test/api/error-handling.test.ts`                                  | Error mapping and `validate` middleware                                          |
| `src/app.ts`                                                       | `createApp()`: builds the Express app, no listen                                 |
| `src/server.ts`                                                    | Entry point: listens on `PORT` at 0.0.0.0                                        |

## frontend

| File                     | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `package.json`           | Scripts: dev, build, preview, test                                    |
| `tsconfig.json`          | SPA TypeScript config (bundler resolution)                            |
| `vite.config.ts`         | Vite + Tailwind plugin, `/api` dev proxy, Vitest jsdom                |
| `.env.example`           | Frontend env vars (`VITE_` only, no secrets; copy to `frontend/.env`) |
| `index.html`             | HTML shell                                                            |
| `src/main.tsx`           | Browser entry, mounts `<App />`, loads global CSS                     |
| `src/App.tsx`            | Placeholder page showing "StockFlow"                                  |
| `src/App.test.tsx`       | Render test for the placeholder                                       |
| `src/styles/globals.css` | Imports Tailwind CSS v4                                               |
| `src/test/setup.ts`      | Vitest setup (jest-dom matchers, cleanup)                             |
| `src/vite-env.d.ts`      | Vite client types                                                     |
