---
name: password-security
description: 'Secure password handling: Argon2id with a bcrypt fallback, salting and peppering, upgrading hashes on login, password policy, breached-password checks, login throttling and safe reset flows. Use whenever the task stores, verifies, changes, resets or validates passwords, builds signup, login or reset-password endpoints or forms, migrates password hashes, or reviews code that touches credentials, even if the user only says "add signup" or "hash the password".'
---

# Password Security

Protect user credentials against modern attacks (GPU and ASIC cracking, credential stuffing, side channels, leaked databases) without making sign-in painful. Follow the project's existing hashing library when it is already one of the algorithms below; migrate when it is not.

## Objectives

1. **Never store plaintext.** Passwords are protected with a strong, slow, salted hash. Never log them, email them, return them in a response, or put them in a URL.
2. **Resist modern hardware.** Prefer memory-hard algorithms.
3. **Upgrade seamlessly.** Re-hash legacy credentials during normal logins, with no forced mass reset.

## 1. Algorithm selection

### The standard: Argon2id

- **Rule:** Argon2id is the default for all new applications.
- **Why:** it is memory-hard (it resists GPU and ASIC parallelism) and mixes the data-dependent and data-independent passes that defend against both trade-off and side-channel attacks.
- **Parameters:** the OWASP floor is **19 MiB of memory, 2 iterations, 1 degree of parallelism**. When resources allow, start higher (a good profile is **64 MiB, 3 iterations, parallelism 4**, in line with RFC 9106) and tune until verification takes the target latency below. Never go below the floor.

### The fallback: bcrypt

- **Rule:** if constrained to bcrypt, use a cost factor of at least 10, ideally 12 to 14 on current hardware.
- **Gotcha 1, truncation:** bcrypt silently ignores everything after 72 bytes.
- **Gotcha 2, memory:** bcrypt uses a fixed ~4 KB, which makes it far easier to parallelize on GPUs than Argon2.
- **Long passwords:** if inputs over 72 bytes must be accepted, use OWASP's construction `bcrypt(base64(hmac-sha384(password, pepper)))`. Do not pre-hash with a plain fast hash (it enables "password shucking").

### Only when compliance requires it

PBKDF2-HMAC-SHA256 with at least 600,000 iterations (FIPS-140 environments). scrypt is acceptable with strong parameters. Do not use MD5, SHA-1 or a bare SHA-2 hash for passwords, with or without salt.

## 2. Salting and peppering

- **Salt:** a unique, cryptographically random salt for every credential. Modern libraries generate it and embed it in the encoded hash string; store that string whole. Security does not depend on hiding the salt.
- **Pepper (optional):** a site-wide secret key applied with HMAC. Generate it with strong randomness and store it **outside** the credential database (secret manager, KMS, or environment variable), never next to the hashes. Plan for pepper rotation before you adopt one.

## 3. Performance and upgrading

- **Target latency:** the highest cost your servers can bear without hurting sign-in, typically **250 to 500 ms** of verification on production hardware. Measure it; do not guess.
- **Lazy hash rotation:** when a user signs in, verify against the stored hash. If it succeeds and the hash uses a legacy algorithm or weaker parameters, re-hash the submitted password with the current settings and overwrite the stored hash.
- Verification and rehash happen in the same request, and a failed login never triggers a rehash.
- Hashing is CPU and memory heavy: run it off the main event loop (native bindings or a worker pool) and cap concurrency so a burst of logins cannot exhaust memory.

## 4. Policy and surrounding flows

Most password breaches come from these, not from the hash:

- **Policy (NIST SP 800-63B direction):** favor length over composition rules. Accept long passphrases (at least 64 characters) and all Unicode, with a sensible minimum length (12 or more; check the figure for your assurance level in current NIST guidance). No forced "one symbol, one capital" rules and no forced periodic rotation. Allow paste and password managers.
- **Breached and common passwords:** reject passwords found in breach corpuses or common-password lists (for example the Pwned Passwords range API, which uses k-anonymity so the full hash never leaves your server).
- **Throttling:** rate-limit per account and per IP, with backoff or temporary lockout, and alert on credential stuffing patterns. Offer MFA, and require it for privileged roles.
- **Generic failures:** one message for "unknown email" and "wrong password", with comparable response times, so attackers cannot enumerate accounts.
- **Reset flow:** a random single-use token from a CSPRNG (at least 128 bits), stored **hashed**, expiring in 15 to 60 minutes; after a successful reset, invalidate it, revoke all sessions (see `jwt-auth-lifecycle`), and notify the user. Never reveal in the UI whether an email exists.
- **Change password:** require the current password (or fresh re-authentication), apply the same policy, and revoke other sessions.
- **Forms:** `autocomplete="current-password"` and `"new-password"`, a show/hide control, no blocked paste.

## 5. Output instructions

When asked to implement password handling:

1. **Dependencies:** recommend the maintained native binding for the stack (for example `@node-rs/argon2` or `argon2` for Node.js, `argon2-cffi` for Python), and say why it is preferred over a pure-JS or bare-hash approach.
2. **Hash function:** the secure hashing function with memory, time and parallelism set explicitly (Argon2id) or the cost factor (bcrypt).
3. **Verify function:** verification with transparent upgrading when legacy hashes exist (detect by algorithm prefix or parameters, rehash on success).
4. **Surrounding pieces when the task includes sign-up or reset:** policy check, throttling, generic errors, and a reset-token flow as in section 4.
5. **Tests:** correct password verifies, wrong one does not, legacy hash is upgraded exactly once on success, rehash does not occur on failure, and no log line contains a password.

```javascript
import { hash, verify } from "@node-rs/argon2";

// The library's default algorithm is Argon2id. memoryCost is in KiB (65536 = 64 MiB); tune to 250-500 ms.
const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

export const hashPassword = (password) => hash(password, ARGON2_OPTIONS);
export const verifyPassword = (storedHash, password) => verify(storedHash, password);
```

## Works together with

`jwt-auth-lifecycle` (sessions and revocation after a password change), `api-standardization` (rate limiting, generic errors, 401), `single-source-of-truth` (the one place the policy and the Argon2 parameters live), `professional-ui-design` (sign-in and reset forms).
