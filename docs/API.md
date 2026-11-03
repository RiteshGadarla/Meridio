# API Reference

Base path: `/api/v1`. All bodies are JSON. The browser only talks to the frontend origin; `/api` is
proxied (Vite in development, a Vercel rewrite in production).

## Response envelope

Success:

```json
{ "data": { "status": "live" }, "meta": { "page": 1 } }
```

`meta` appears only when relevant (for example pagination).

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fieldErrors": { "email": "Enter a valid email" }
  }
}
```

`fieldErrors` appears only for validation-style errors and is keyed by field name.

## Error codes

| Code                  | HTTP | Meaning                                                               |
| --------------------- | ---- | --------------------------------------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Invalid input or malformed JSON; see `fieldErrors`                    |
| `UNAUTHENTICATED`     | 401  | Missing, invalid or expired session                                   |
| `FORBIDDEN_ORIGIN`    | 403  | State-changing request from an origin other than the app              |
| `NOT_FOUND`           | 404  | Unknown route, or a resource that does not exist in your organization |
| `DUPLICATE_SKU`       | 409  | SKU already exists in your organization                               |
| `EMAIL_TAKEN`         | 409  | An account with this email already exists                             |
| `PAYLOAD_TOO_LARGE`   | 413  | Request body over 100 KB                                              |
| `RATE_LIMITED`        | 429  | Too many requests                                                     |
| `INTERNAL_ERROR`      | 500  | Unexpected server error (details are only in server logs)             |
| `SERVICE_UNAVAILABLE` | 503  | Readiness check failed (database unreachable)                         |

Error text never contains stack traces, SQL or file paths.

## Cross-cutting behaviour

- Every response carries `x-request-id`. A safe inbound `x-request-id` (letters, digits, `.`, `_`, `-`,
  up to 128 characters) is reused; otherwise a UUID is generated.
- Every response except `/health/*` carries `Cache-Control: private, no-store`.
- `POST`, `PATCH`, `PUT`, `DELETE` with an `Origin` header other than the configured `APP_ORIGIN` are
  rejected with `FORBIDDEN_ORIGIN`. Requests with no `Origin` header are allowed.
- Security headers are set with Helmet. CORS allows only `APP_ORIGIN`, with credentials.

## Health

### `GET /health/live`

Always `200` while the process is running.

```json
{ "data": { "status": "live" } }
```

### `GET /health/ready`

`200` when the database answers a trivial query, otherwise `503`.

```json
{ "data": { "status": "ready" } }
```

```json
{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Database is not reachable" } }
```

Use `/health/ready` as the hosting platform health check path.

## Auth

Session is the `sf_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). All bodies
are JSON. `AuthUser` is `{ id, email, organization: { id, name, defaultLowStockThreshold } }`.

### `POST /auth/signup`

Creates an organization and its owner in one transaction, then signs the user in. Rate limit: 5 per
hour per IP.

```json
{ "email": "me@acme.test", "password": "Passw0rdOK", "organizationName": "Acme" }
```

`201`:

```json
{
  "data": {
    "id": "cm...",
    "email": "me@acme.test",
    "organization": { "id": "cm...", "name": "Acme", "defaultLowStockThreshold": 5 }
  }
}
```

Errors: `400 VALIDATION_ERROR` (password 8 to 72 characters with a letter and a number, valid email,
organization name 2 to 80 characters), `409 EMAIL_TAKEN` (case-insensitive), `429 RATE_LIMITED`.

### `POST /auth/login`

Body `{ "email", "password" }`. `200` returns `AuthUser` and sets the cookie. Rate limit: 10 per 15
minutes per IP and email.

Errors: `401 UNAUTHENTICATED` with the same message `Invalid email or password` whether the email
is unknown or the password is wrong; `429 RATE_LIMITED`.

### `POST /auth/logout`

Clears the cookie. Always `200 { "data": { "loggedOut": true } }`.

### `GET /auth/me`

Requires the cookie. `200` returns `AuthUser` with fresh organization data. `401 UNAUTHENTICATED`
when the cookie is missing, tampered, expired, or its user no longer exists.

## Products

All product endpoints require the session cookie (`401 UNAUTHENTICATED` otherwise) and are scoped to
the caller's organization. A product that belongs to another organization is reported as
`404 NOT_FOUND`, exactly like a missing one. Any `organizationId` sent in a body or query is ignored.

`ProductDto`:

```json
{
  "id": "cm...",
  "name": "Mechanical Keyboard",
  "sku": "KEY-001",
  "description": null,
  "quantityOnHand": 12,
  "costPrice": "45.00",
  "sellingPrice": "89.99",
  "lowStockThreshold": null,
  "effectiveThreshold": 5,
  "stockStatus": "HEALTHY",
  "updatedById": "cm...",
  "createdAt": "2026-11-02T10:00:00.000Z",
  "updatedAt": "2026-11-02T10:00:00.000Z"
}
```

Prices are strings (never floats). `effectiveThreshold` is the product's own threshold, or the
organization default when `lowStockThreshold` is `null`. `stockStatus` is `OUT_OF_STOCK` at quantity
0, `LOW_STOCK` when quantity <= `effectiveThreshold`, otherwise `HEALTHY`.

| Method | Path            | Purpose                                        |
| ------ | --------------- | ---------------------------------------------- |
| GET    | `/products`     | List with search, filter, sort, pagination     |
| POST   | `/products`     | Create (201)                                   |
| GET    | `/products/:id` | Get one                                        |
| PATCH  | `/products/:id` | Partial update (at least one field)            |
| DELETE | `/products/:id` | Hard delete, `200 { "data": { "id": "..." } }` |

### `GET /products`

Query parameters: `page` (default 1), `limit` (default 20, max 100), `search` (name or SKU,
case-insensitive, `%` and `_` are literal), `sort` (`createdAt` default, `name`, `sku`,
`quantityOnHand`, `sellingPrice`), `order` (`asc` | `desc`, default `desc`), `status`
(`HEALTHY` | `LOW_STOCK` | `OUT_OF_STOCK`).

```
GET /api/v1/products?search=key&status=LOW_STOCK&sort=name&order=asc&page=2&limit=10
```

```json
{
  "data": [{ "...": "ProductDto" }],
  "meta": { "page": 2, "limit": 10, "total": 25, "totalPages": 3 }
}
```

Errors: `400 VALIDATION_ERROR` for an unknown `sort`/`status`, `limit` above 100, or a bad `page`.

### `POST /products`

```json
{
  "name": "Mechanical Keyboard",
  "sku": "key-001",
  "quantityOnHand": 12,
  "costPrice": "45.00",
  "sellingPrice": 89.99,
  "lowStockThreshold": 3
}
```

Rules: name 1 to 120 characters; SKU is trimmed and uppercased (letters, digits, `. _ - /`, up to 64);
description up to 2000; quantity an integer 0 to 1,000,000 (default 0); prices optional, not negative,
at most 2 decimals, up to 9,999,999.99 (number or string accepted); threshold an optional integer >= 0.

Errors: `400 VALIDATION_ERROR` with `fieldErrors`, `409 DUPLICATE_SKU` with
`fieldErrors.sku = "This SKU already exists in your organization."` (the same SKU is allowed in
different organizations).

### `PATCH /products/:id`

Any subset of the create fields. Sending `"lowStockThreshold": null` removes the override so the
organization default applies again. An empty body is `400`. Sets `updatedById` to the caller.
Errors: `404 NOT_FOUND`, `409 DUPLICATE_SKU`, `400 VALIDATION_ERROR`.

### `PATCH /products/:id/stock`

Relative stock change ("+N" / "-N"). Body: `{ "delta": -5, "note": "Damaged" }` (`delta` is a non-zero
integer, `note` optional, max 200 chars). Applied atomically: the result must stay within
0 to 1,000,000, otherwise `400 VALIDATION_ERROR` with `fieldErrors.delta` (for example
"Only 3 in stock; you cannot remove 4."). `404 NOT_FOUND` for another tenant's product. Returns the
updated product and adds a line to the activity feed (including the note).

### `DELETE /products/:id`

Errors: `404 NOT_FOUND` (also for another organization's product).

## Activity

### `GET /activity?page=1&limit=15&action=&search=`

Newest-first, paginated feed of product changes for the caller's organization. `limit` is 1 to 50.
Optional filters: `action` (`PRODUCT_CREATED | PRODUCT_UPDATED | STOCK_ADJUSTED | PRODUCT_DELETED`)
and `search` (case-insensitive match on product name or SKU). Returns
`{ data: [...], meta: { page, limit, total, totalPages } }`. Each entry:
`{ id, action, productName, productSku, summary, note, actorName, createdAt }`. A basic feed, not
an audit trail: one short sentence per change.

## Dashboard

### `GET /dashboard/overview`

Requires the session cookie. Everything is scoped to the caller's organization.

```json
{
  "data": {
    "totalProducts": 14,
    "totalUnits": 530,
    "lowStockCount": 3,
    "outOfStockCount": 1,
    "lowStockProducts": [{ "...": "ProductDto" }]
  }
}
```

- **Low stock** means quantity <= the product's effective threshold (its own threshold, else the
  organization default). This INCLUDES out-of-stock items, so the UI calls the list "Needs attention".
- **Out of stock** means quantity 0 (always, even with a threshold of 0).
- `lowStockProducts` holds at most 50 items, out-of-stock first, then lowest quantity, then name.
  `lowStockCount` counts all of them, not just the 50 returned.
- An organization with no products returns zeros and an empty list.
- Totals use SQL aggregates, so nothing scales with catalogue size in memory.

## Settings

### `GET /settings`

```json
{ "data": { "defaultLowStockThreshold": 5, "organizationName": "Acme" } }
```

### `PATCH /settings`

```json
{ "defaultLowStockThreshold": 10 }
```

Returns the same shape as GET. The value must be an integer from 0 to 100,000. Products without their
own threshold follow the new default on the very next request (status is computed on read).
Errors: `400 VALIDATION_ERROR` with `fieldErrors.defaultLowStockThreshold`, `401 UNAUTHENTICATED`.
