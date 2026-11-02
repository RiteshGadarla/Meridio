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
| `src/modules/settings/settings.service.ts`                         | Read/update organization default threshold                                       |
| `src/modules/settings/settings.routes.ts`                          | `/settings` routes and handlers                                                  |
| `src/modules/dashboard/dashboard.service.ts`                       | SQL-level overview metrics and low-stock list                                    |
| `src/modules/dashboard/dashboard.routes.ts`                        | `/dashboard/overview` route and handler                                          |
| `test/api/dashboard-settings.test.ts`                              | Dashboard, settings and isolation tests                                          |
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

## frontend (Stage 6)

| File                                   | Purpose                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/styles/tokens.css`                | Design tokens (palette, fonts, radii, shadow, motion) mapped into Tailwind `@theme` |
| `src/styles/globals.css`               | Fonts, Tailwind, base styles, `.font-data`, reduced-motion rule                     |
| `src/styles/tokens.test.ts`            | Guards the 9 palette hex values                                                     |
| `src/lib/cn.ts`                        | Class name joiner                                                                   |
| `src/lib/format.ts` (+ test)           | Currency, number and date formatting (Intl)                                         |
| `src/lib/api-client.ts` (+ test)       | Fetch wrapper, `ApiError`, 401 hook                                                 |
| `src/components/logo.tsx`              | StockFlow mark and wordmark                                                         |
| `src/components/ui/button.tsx`         | Button variants, sizes, loading                                                     |
| `src/components/ui/form.tsx`           | Label, Input, Textarea, Select, FieldError, Field                                   |
| `src/components/ui/badge.tsx`          | Badge and StatusBadge (marker + text)                                               |
| `src/components/ui/table.tsx`          | Ledger table primitives                                                             |
| `src/components/ui/skeleton.tsx`       | Skeleton, TableSkeleton, MetricSkeleton                                             |
| `src/components/ui/states.tsx`         | EmptyState, ErrorState                                                              |
| `src/components/ui/overlay.tsx`        | Modal base: portal, focus trap, Escape, scroll lock                                 |
| `src/components/ui/drawer.tsx`         | Right drawer (full screen on mobile)                                                |
| `src/components/ui/confirm-dialog.tsx` | Confirmation dialog                                                                 |
| `src/components/ui/toast.tsx`          | Toast provider with aria-live regions                                               |
| `src/components/ui/ui.test.tsx`        | Primitive behaviour tests                                                           |
| `src/layouts/app-shell.tsx` (+ test)   | Sidebar layout with mobile menu                                                     |
| `src/layouts/page-header.tsx`          | Eyebrow, title, description, action                                                 |
| `src/app/query-client.ts`              | TanStack Query defaults (no retry on 401/404)                                       |
| `src/app/providers.tsx`                | Query and Toast providers                                                           |
| `src/app/routes.tsx`                   | Route table (dev-only `/design`)                                                    |
| `src/pages/*-page.tsx`                 | Page placeholders: dashboard, products, settings, login, signup, not-found          |
| `src/pages/design-page.tsx`            | Dev-only living style guide                                                         |
| `src/App.tsx`, `src/App.test.tsx`      | Root component and routing smoke tests                                              |

### Stage 7 additions

| File                                        | Purpose                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/features/auth/api.ts`                  | signup, login, logout, `fetchCurrentUser` (401 becomes `null`)                  |
| `src/features/auth/hooks.ts`                | `useCurrentUser`, `useLogin`, `useSignup`, `useLogout` (clears the cache)       |
| `src/features/auth/guards.tsx`              | `RequireAuth`, `RedirectIfAuthed`, `AuthedShell`, `SessionWatcher` (global 401) |
| `src/features/auth/auth-layout.tsx`         | Minimal frame for login and signup                                              |
| `src/features/auth/auth.test.tsx`           | Auth UI, guards, logout and expiry tests (MSW)                                  |
| `src/test/server.ts`, `src/test/render.tsx` | MSW server and app render helpers                                               |
| `src/test/setup.ts`                         | Now also starts MSW and resolves relative fetch URLs                            |
