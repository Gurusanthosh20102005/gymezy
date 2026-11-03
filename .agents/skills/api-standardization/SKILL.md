---
name: api-standardization
description: Enforces industry-standard REST API design, authentication and authorization checks, validation, error handling, pagination and security practices when creating, modifying, or reviewing backend API code. Use this whenever the user is building a new endpoint, adding a route, designing a controller/service/repository layer, writing middleware, shaping API responses or error formats, touching JWT/session auth, or asking for a review of existing API code, even if they do not say "REST" or "best practices." Also use when the user asks "does this endpoint look right?", "how should I structure this route?", or shares backend code that includes routes, controllers, or auth logic.
---

# API Industry Standards

## Why this skill exists

APIs are contracts. Once a frontend, a mobile app, or a third party starts calling an endpoint, the shape of its URL, its request body, and its response becomes something people depend on — and auth mistakes on that contract are usually invisible until they're exploited. This skill exists to keep new and modified endpoints consistent with the rest of the project and safe by default, without slowing down normal feature work.

**Before writing or changing any API code, inspect the existing project first**: routes, middleware, controllers, response shapes, and naming conventions. Match what's already there. These standards are the default to fall back on when the project has no established convention yet, or when the existing convention is a real security problem — not a license to rewrite a working codebase into a different style.

Priority when these things conflict: **security > correctness > consistency with the existing project > personal preference.**

---

## 1. Resource-oriented URLs

A URL identifies a *resource*; the HTTP method says what to do with it. Keeping these separate is what makes an API predictable to anyone who hasn't read the code.

- Plural nouns: `/users`, `/orders`, `/call-logs` — not `/user`, `/getUsers`, `/createUser`
- kebab-case paths: `/call-logs`, `/user-profiles` — not `/callLogs`, `/call_logs`
- IDs as path params: `/orders/456` — not `/orders?orderId=456`
- Version the base path when the project already does: `/api/v1/...`

```
GET    /api/v1/users
GET    /api/v1/users/123
POST   /api/v1/users
PUT    /api/v1/users/123      # full replace
PATCH  /api/v1/users/123      # partial update
DELETE /api/v1/users/123
```

Never introduce action-shaped endpoints (`/getUsers`, `/createUser`, `/updateOrder`) — if you find yourself naming an endpoint after a verb, it's almost always because it should be a query parameter, a nested resource, or a different HTTP method instead.

**Filtering, sorting, search, and pagination are query parameters, not new endpoints:**

```
GET /api/v1/users?role=admin
GET /api/v1/orders?status=pending&paymentStatus=paid
GET /api/v1/products?sort=price&order=asc
GET /api/v1/users?search=maria
GET /api/v1/users?page=1&limit=20
```

not `/getUsersByRole`, `/searchUsers`, `/getOrdersByStatus`.

**Nested resources** are fine when the relationship is the point of the request (`/users/123/orders`), but stop nesting once a resource has its own identity — `/order-items/789` beats `/users/123/orders/456/items/789`.

**JSON fields use camelCase** (`userId`, `createdAt`), matching typical JS/TS client conventions — unless the project has already standardized on something else (e.g. snake_case for a Python-first API), in which case follow the project.

---

## 2. Authentication: "who is this?"

Every protected endpoint must verify identity *before* any business logic runs. Concretely, for JWT-based auth:

1. Extract the `Authorization: Bearer <token>` header.
2. Reject if it's missing or malformed.
3. Verify the signature and expiration.
4. Attach the resolved user to the request context.
5. Only then hand off to the controller.

```
Client → Auth Middleware → Verify JWT → valid? ─┬─ no  → 401
                                                └─ yes → Authorization → Validation → Controller
```

**Centralize this.** JWT verification duplicated inside every controller is a maintenance and security hazard — one route that forgets to copy-paste the check is a hole. Write it once as middleware and attach it declaratively:

```js
router.get("/users", authenticate, getUsers);
router.get("/orders", authenticate, getOrders);
```

**Not everything needs auth.** Login, register, token refresh, and often public catalog reads (`GET /products`) are legitimately public. The judgment call: does this resource expose private or sensitive data? If yes, require auth by default — it's much easier to deliberately open up an endpoint later than to notice, after the fact, that one was quietly public.

### Where the token lives and how it is sent

Token storage, cookie flags, refresh and logout are owned by the `jwt-auth-lifecycle` skill; follow it instead of restating the rules here (one owner, so the two can never disagree). What matters at the API layer: the auth middleware reads the credential only from the places that skill allows (never from a query string), and a cookie-based credential means state-changing routes need CSRF protection.

### JWT hygiene

- Secrets live in environment variables, never in source or committed anywhere.
- Payloads stay minimal (`sub`, `role`, `iat`, `exp`, plus `tenantId` when the system is multi-tenant) — treat anything in the payload as readable by whoever holds the token, so no passwords, payment data, or other secrets in there.
- Always check `exp`. An expired token is a `401`, not a warning.
- Never log tokens or `Authorization` headers — logs often have broader read access than the API itself.

---

## 3. Authorization: "is this user allowed to do this?"

A valid JWT proves identity, not permission — these are genuinely separate checks, and conflating them is the most common source of API-level data leaks (user A fetching user B's data just because their token happened to be valid).

**Role-based**, when the app has roles:

```js
router.delete("/users/:id", authenticate, authorize("admin"), deleteUser);
```

**Resource-level (ownership)**, for anything scoped to a user:

```
GET /api/v1/call-logs/789
```

If the authenticated user is `123`, the backend must independently check that `123` may access call-log `789` — never trust `req.params.id` or `req.query.userId` as proof of anything. Those values come from the client and prove nothing about permission on their own.

Frontend role checks are UX, not security — they control what a well-behaved client shows, but the backend is the actual boundary, since nothing stops a request from being crafted by hand.

Status codes: missing/invalid/expired auth → **401**; authenticated but not permitted → **403**. Getting these two swapped is a common and confusing bug for API consumers trying to debug their own integration.

---

## 4. Validation

Validate everything the client sends, on the backend, regardless of what the frontend already checks — frontend validation is UX; it's trivial to bypass with a direct request, so it can't be the only line of defense.

Cover `req.params`, `req.query`, `req.body`, and relevant headers: required fields, types, string lengths, formats (email, etc.), numeric ranges, enum membership, and any business rules that would make the request nonsensical even if well-formed.

Request bodies belong in POST/PUT/PATCH bodies, not query strings — query strings are logged, cached, and length-limited in ways bodies aren't.

---

## 5. Responses and status codes

Reuse whatever response envelope the project already has. If there isn't one, a reasonable default:

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": { "id": 123, "firstName": "Maria" }
}
```

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

```json
{
  "success": false,
  "message": "User not found",
  "error": { "code": "USER_NOT_FOUND" }
}
```

Status codes, used precisely rather than defaulting everything to 200:

| Code | Meaning |
|---|---|
| 200 | Successful GET/PUT/PATCH |
| 201 | Resource created |
| 204 | Success, no body |
| 400 | Malformed request |
| 401 | Missing/invalid/expired auth |
| 403 | Authenticated, not authorized |
| 404 | Resource doesn't exist |
| 409 | Conflict / duplicate |
| 422 | Semantically invalid input |
| 429 | Rate limited |
| 500 | Unexpected server error |

**Errors should be centralized** (a single error-handling middleware/handler that controllers delegate to) rather than duplicated per-route, and production error responses must never leak stack traces, raw database errors, secrets, or filesystem paths — those are gifts to anyone probing the API.

### Environment-Aware Error Response Protocol (Development vs Production)

- **Development & Local Debug Mode (`NODE_ENV !== 'production'`)**:
  - Full transparent error details for debugging.
  - Returns exact error message, HTTP status code, validation errors array, and complete `stack` trace.
  - Example Development Error Response:
    ```json
    {
      "success": false,
      "message": "Cast to ObjectId failed for value \"abc\" at path \"_id\"",
      "statusCode": 400,
      "stack": "CastError: Cast to ObjectId failed...\n    at model.Query.exec ..."
    }
    ```
- **Production Mode (`NODE_ENV === 'production'`)**:
  - **Operational Client Errors (4xx Status Codes: 400, 401, 403, 404, 409, 422)**:
    - Return user-safe client message (e.g. "Validation failed", "Unauthorized access") and errors array.
    - Stack traces are completely omitted.
  - **Internal Server Errors & Unexpected Failures (5xx Status Codes)**:
    - Mask all internal exceptions, database query errors, and server internals.
    - Always return a generic safe message plus a request ID, for example `"An unexpected error occurred. Try again, and contact support with the request ID if it keeps happening."`. The same request ID is written to the server log next to the full error, so support can find it.
    - Full error details go to the structured server log (never to the client).
    - Example Production 500 Response:
      ```json
      {
        "success": false,
        "message": "An unexpected error occurred. Try again, and contact support with the request ID if it keeps happening.",
        "statusCode": 500,
        "requestId": "9f1c2b7e-4a35-4c8e-b1d0-2f6a7c3d9e10"
      }
      ```

### Public identifiers

Never expose internal database keys or bookkeeping fields (a MongoDB `_id` / `ObjectId` / `__v`, an auto-increment primary key you may later change, internal row versions). Every resource has a stable public `id` (string) or business identifier, and responses contain only the fields the client is meant to see. This applies to listings, pagination and UI tables as well as single resources.

Where the mapping happens (repository output or a schema `toJSON` transform) is a database concern: for MongoDB, follow `mongodb-architecture`, which owns the exact transform.

---

## 6. Request flow and layering

Keep the request pipeline in a consistent order so authorization can never be accidentally skipped or checked too late:

```
Request → Rate limiting → Authentication → Authorization → Validation → Controller → Service → Repository/DB → Response
```

Authorization must happen *before* any sensitive read/write — not as an afterthought once the database has already been touched.

Follow the project's existing layering (route → middleware → controller → service → repository is the common shape). Routes wire up middleware; controllers translate HTTP ↔ domain; services hold business logic; repositories talk to the database. Business logic piling up directly in route files is the main smell this layering prevents.

---

## 7. Security defaults

- Don't expose protected data without auth, ever — including "just for now" or "the frontend already checks."
- Don't trust user IDs or role claims sent by the client as authorization proof.
- Never store or return plaintext passwords.
- Don't hardcode secrets, and don't disable JWT verification to unblock a failing test or a stuck feature — that's a shortcut that tends to outlive the deadline that motivated it.

---

## 8. Testing checklist

For each protected endpoint, aim to cover:

1. Valid token → succeeds
2. Missing token → 401
3. Invalid/malformed token → 401
4. Expired token → 401
5. Valid token, insufficient role/ownership → 403
6. Valid token, authorized → succeeds
7. Invalid input shape → validation error
8. Nonexistent resource → 404
9. Sensitive fields absent from the response (no password hashes, no internal IDs that shouldn't leak, etc.)

## 9. Before shipping — quick review pass

**URL & method** — plural, kebab-case, IDs in the path, filters in the query string, correct HTTP verb, no action-shaped routes.

**Auth** — protected routes have authentication middleware; signature and expiration are both checked; 401 vs 403 used correctly; no hardcoded secrets or logged tokens.

**Authorization** — role and/or ownership checked server-side; nothing trusted from `req.params`/`req.query` alone.

**Validation** — params, query, and body all validated backend-side.

**Response** — matches the project's existing envelope; no stack traces or internals leak in error responses.

**Scale** — pagination/filtering/sorting in place for anything that can grow.

**Contract stability** — if modifying an existing endpoint: check who calls it, avoid silently breaking the request/response shape, update tests to match any intentional behavior change.

---

## 10. Operational hygiene

- **CORS:** an explicit allow-list of origins; never `*` together with credentials.
- **Security headers and transport:** HTTPS only, standard security headers (for example via `helmet`), no framework or version banners.
- **Limits:** request body size limits, request timeouts, and rate limiting on login, refresh, password reset and any expensive endpoint (`429` with `Retry-After`).
- **Time and money:** timestamps in ISO 8601 UTC; money as integer minor units or a decimal string, never a float.
- **Retries:** unsafe operations that clients may retry (payments, order creation) accept an `Idempotency-Key` header.
- **Contract:** document the API in OpenAPI generated from the shared schemas (see `single-source-of-truth`), and version or deprecate deliberately (`Deprecation` and `Sunset` headers) rather than changing shapes silently.
- **Observability:** a request ID on every request, response and log line; structured logs with no tokens, passwords or personal data.

## Core reminders

1. URL = resource, HTTP method = action
2. Authentication answers "who," authorization answers "may they" — a valid token is not a blank check
3. Never trust client-supplied IDs or roles as proof of permission
4. Validate on the backend regardless of frontend checks
5. Match the project's existing conventions unless they're a security problem

---

## Works together with

`jwt-auth-lifecycle` (token storage, refresh, logout), `password-security` (credential handling), `mongodb-architecture` (identifier mapping, tenant scoping), `backend-unit-testing` (layers and tests), `single-source-of-truth` (shared schemas, error catalog, routes).
