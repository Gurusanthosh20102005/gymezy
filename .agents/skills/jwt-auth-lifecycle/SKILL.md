---
name: jwt-auth-lifecycle
description: 'Secure authentication and session lifecycle: JWT access and refresh tokens, cookie flags, where the client keeps tokens, auth middleware, logout and revocation, session expiry, CSRF, and tenant binding when the system is multi-tenant. Use whenever the task touches login, logout, sessions, token refresh, protecting routes, auth middleware, cookies, JWTs, API clients that send credentials, or keeping a user signed in, even if the user only says "add auth" or "remember me".'
---

# JWT and Session Lifecycle

Authentication mistakes are invisible until someone exploits them, so this skill sets safe defaults for how tokens are issued, stored, sent, verified, refreshed and revoked.

**Look at the project's existing auth first and match it.** Change it only when it is insecure, and say so when you do. Priority when things conflict: security, then correctness, then consistency with the project, then preference.

## Objectives

1. **Tokens are out of reach of injected script.** A token that JavaScript can read can be stolen by any XSS bug anywhere on the site.
2. **Short-lived access, revocable sessions.** A stolen token works for minutes, and logout really ends the session.
3. **Identity comes from the verified token, never from the request.** User, roles and (when multi-tenant) tenant are read from the verified credential, not from params, query strings, bodies or client headers.

## 1. Choose the transport pattern

| Situation | Pattern | How it works |
|---|---|---|
| Browser app whose API is on the same site (the default) | **HttpOnly session cookie** | The server sets `Set-Cookie: authToken=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`. The browser attaches it automatically and JavaScript never sees it. State-changing requests need CSRF protection (SameSite plus a CSRF token or a required custom header). |
| Browser SPA on a different site from its API, third-party clients, mobile apps | **Short-lived Bearer access token plus HttpOnly refresh cookie** | The access token (5 to 15 minutes) is held in memory only and sent as `Authorization: Bearer <token>`. A refresh cookie (HttpOnly, Secure, SameSite, rotated on every use) gets a fresh access token from `/auth/refresh` on page load and on a 401. Mobile apps keep tokens in the OS secure store (Keychain, Keystore), never in plain preferences. |

Rules for both patterns:

- **Never store tokens in `localStorage` or `sessionStorage`.**
- **A cookie your own JavaScript reads** (`getCookie("authToken")` copied into a Bearer header) **is exactly as exposed to XSS as `localStorage`**: any injected script can read `document.cookie`. It adds nothing against token theft. If the project already works this way, do not rewrite it silently: flag the risk, keep your change small, and propose migrating to one of the patterns above. Until then keep the token short-lived, rotate refresh tokens, and ship a strict Content-Security-Policy.
- Cookie attributes are not optional: `HttpOnly`, `Secure` (HTTPS only; relax on localhost in development through configuration, never in code), `SameSite=Lax` or `Strict`, a narrow `Path`, and a `Max-Age` that matches the token lifetime.
- Accepting the same token from both a header and a cookie means the cookie path needs CSRF protection. Accept the sources your chosen pattern needs and nothing else.

## 2. Token design

- **Access token:** short-lived. **Refresh token:** long-lived (days to weeks), opaque or signed, stored server-side as a **hash** (never the raw token) with a session or family ID, so it can be revoked.
- **Rotate on every refresh** and detect reuse: if an already-used refresh token appears again, revoke the whole family, because it was stolen or replayed.
- **Claims stay minimal:** `sub` (user ID), `roles`, `iat`, `exp`, `jti`, `iss`, `aud`, plus `tenantId` only when the system is multi-tenant. Never put passwords, hashes, SSNs, phone numbers or other PII in a payload: a JWT is signed, not encrypted.
- **Signing:** a strong secret from the environment or a secret manager (never in source), at least 256 bits for HS256. With several services use an asymmetric algorithm (RS256 or ES256) with a `kid` so keys can rotate.
- **Pin the accepted algorithms** when verifying and reject `alg: none`. Verify `iss` and `aud`.

## 3. Server middleware

Every protected route passes through one authentication middleware (never copied into controllers). It must:

1. Read the credential from the source your pattern defines (cookie for pattern 1, `Authorization: Bearer` for pattern 2) and reject a missing or malformed value with `401`.
2. Verify the signature, the pinned algorithm, `exp`, `iss` and `aud`. Expired or invalid means `401` immediately.
3. When sessions are revocable, check the session or token version against the store.
4. Attach `userId`, `roles` and (multi-tenant) `tenantId` from the **verified claims** to `req.user`. Authorization (what this user may do) is a separate step: see `api-standardization`.

```javascript
import jwt from "jsonwebtoken";
import { config } from "../config.js"; // validated once at boot; see single-source-of-truth

export function authenticate(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.authToken; // keep only the source your pattern uses
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required", error: { code: "AUTH_REQUIRED" } });
  }
  try {
    const claims = jwt.verify(token, config.jwt.secret, {
      algorithms: ["HS256"],          // pinned; never accept "none"
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
    req.user = { id: claims.sub, roles: claims.roles ?? [], tenantId: claims.tenantId };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session", error: { code: "AUTH_INVALID" } });
  }
}
```

## 4. Logout and revocation

- Logout clears the cookie with the **same attributes** it was set with (`Path`, `Domain`, `Secure`, `SameSite`), and **revokes server-side**: delete the refresh token or session record, or add the access token's `jti` to a denylist until it expires. Clearing only on the client is not logout.
- Revoke all of a user's sessions when the password changes or is reset, when the account is disabled, and on "log out everywhere".
- Expired sessions return `401` and the client moves to the sign-in screen without leaving stale user data on screen.

## 5. Multi-tenant binding (only when the system is multi-tenant)

- The tenant comes from the verified token or server-side session, never from a client-supplied header, body field or URL alone. If a route also carries a tenant identifier, it must equal the token's tenant, otherwise `403`.
- Every data access is scoped by tenant (see `mongodb-architecture` for how repositories enforce it).
- A token minted for one tenant must not be accepted for another.

## 6. Abuse protection and logging

- Rate-limit and back off on login, refresh and password reset. Use one generic message for failed sign-ins so responses never reveal whether an account exists.
- Log authentication events (sign-in, failure, refresh, logout, reuse detected) with user ID and request ID. **Never log tokens, `Authorization` headers, cookies or passwords.**
- Alert on refresh-token reuse and bursts of failures.

## 7. Output instructions

When asked to implement authentication, deliver in this order and state which pattern you chose and why:

1. **Server:** login handler (issues tokens and sets cookies with the flags above), refresh handler with rotation, and logout handler (clears cookie and revokes).

   ```javascript
   res.cookie("authToken", accessToken, {
     httpOnly: true,
     secure: config.isProduction,
     sameSite: "lax",
     path: "/",
     maxAge: 15 * 60 * 1000,
   });
   ```

2. **Middleware:** the `authenticate` middleware above, adjusted to the pattern.
3. **Client:** for pattern 1, `fetch(url, { credentials: "include" })` (or `withCredentials: true` in Axios) and nothing else. For pattern 2, an in-memory token plus a refresh-on-401 interceptor:

   ```javascript
   let accessToken = null; // memory only; never localStorage or sessionStorage
   export const setAccessToken = (token) => { accessToken = token; };

   api.interceptors.request.use((cfg) => {
     if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
     return cfg;
   });

   let refreshing = null; // share one in-flight refresh between concurrent 401s
   api.interceptors.response.use(undefined, async (error) => {
     const original = error.config;
     if (error.response?.status !== 401 || original._retried) return Promise.reject(error);
     original._retried = true;
     refreshing ??= axios.post("/auth/refresh", null, { withCredentials: true }).finally(() => { refreshing = null; });
     const { data } = await refreshing;
     setAccessToken(data.data.accessToken);
     return api(original);
   });
   ```

4. **Tests:** valid, missing, malformed, expired and wrong-algorithm tokens; refresh rotation and reuse; logout really revokes; cross-tenant token rejected.

## Works together with

`api-standardization` (401 versus 403, request pipeline), `password-security` (credential storage and reset), `mongodb-architecture` (tenant scoping), `single-source-of-truth` (one validated config module for secrets and lifetimes).
