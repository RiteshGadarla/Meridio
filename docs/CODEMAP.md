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

| File                  | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `package.json`        | Package `@meridio/contracts`, builds to `dist`    |
| `tsconfig.json`       | Typecheck config (includes tests)                 |
| `tsconfig.build.json` | Build config (emits `dist`, excludes tests)       |
| `src/index.ts`        | Public exports: `PRODUCT_NAME`, `ApiSuccess` type |
| `src/index.test.ts`   | Smoke test for the exports                        |

## backend

| File                                                               | Purpose                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `package.json`                                                     | Scripts: dev (tsx), build (tsc), start, test                       |
| `tsconfig.json`                                                    | Typecheck config                                                   |
| `tsconfig.build.json`                                              | Build config (emits `dist`)                                        |
| `.env.example`                                                     | Backend env vars (copy to `backend/.env`, never commit)            |
| `prisma.config.ts`                                                 | Prisma CLI config: schema path, migrations folder, direct Neon URL |
| `prisma/schema.prisma`                                             | Database schema: Organization, User, Product                       |
| `prisma/migrations/*_init/migration.sql`                           | Initial tables, indexes and foreign keys                           |
| `prisma/migrations/*_constraints_and_search_indexes/migration.sql` | CHECK constraints and pg_trgm search indexes                       |
| `prisma/seed.ts`                                                   | Idempotent dev seed (2 orgs, 2 users, 14 products)                 |
| `src/lib/prisma.ts`                                                | Shared PrismaClient singleton and `createPrismaClient` factory     |
| `test/db.ts`                                                       | Test DB helpers: safe URL guard, client factory, table reset       |
| `test/global-setup.ts`                                             | Migrates the test database once before the suite                   |
| `test/db/schema.test.ts`                                           | Constraints, SKU uniqueness, Decimal precision, cascades           |
| `test/db/seed.test.ts`                                             | Seed idempotency and cross-org SKU reuse                           |
| `test/db/safety.test.ts`                                           | Test helper refuses the dev database                               |
| `vitest.config.ts`                                                 | Vitest config (node environment)                                   |
| `src/app.ts`                                                       | `createApp()`: builds the Express app, no listen                   |
| `src/server.ts`                                                    | Entry point: listens on `PORT` at 0.0.0.0                          |
| `src/app.test.ts`                                                  | Supertest test for `GET /api/v1/ping` and workspace link           |

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
