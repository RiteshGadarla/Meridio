# StockFlow (code name Meridio)

Multi-tenant inventory SaaS: organizations manage products, stock levels and low-stock alerts.
Modular monolith (Express + Prisma) with a React SPA. Built stage by stage.

## Status

| Stage | Scope                             | Done |
| ----- | --------------------------------- | :--: |
| 0     | Monorepo, tooling                 | [x]  |
| 1     | Database foundation               | [ ]  |
| 2     | Express API foundation            | [ ]  |
| 3     | Authentication and tenant context | [ ]  |
| 4     | Product API                       | [ ]  |
| 5     | Dashboard and settings API        | [ ]  |
| 6     | Design system and app shell       | [ ]  |
| 7     | Temporary auth UI                 | [ ]  |
| 8     | Dashboard UI                      | [ ]  |
| 9     | Product management UI             | [ ]  |
| 10    | Settings UI                       | [ ]  |
| 11    | E2E, a11y, coverage               | [ ]  |
| 12    | Production deployment             | [ ]  |
| 13    | Docs and demo polish              | [ ]  |

## Local setup

Prerequisites: Node 20+.

```bash
npm install
cp backend/.env.example backend/.env     # then fill in secrets
cp frontend/.env.example frontend/.env
npm run dev     # API on :4000, web on :5173 (Vite proxies /api to the API)
```

Other scripts: `npm run build`, `lint`, `typecheck`, `test`, `format`.

## Layout

- `frontend`: React + Vite + Tailwind CSS
- `backend`: Express + TypeScript
- `packages/contracts`: shared types and Zod schemas (`@meridio/contracts`), built to `dist` before backend and frontend

See [docs/CODEMAP.md](docs/CODEMAP.md) for a file-by-file map.
