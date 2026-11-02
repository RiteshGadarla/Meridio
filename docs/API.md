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
