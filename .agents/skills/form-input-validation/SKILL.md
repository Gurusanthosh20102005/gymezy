---
name: form-input-validation
description: >-
  Framework-agnostic form input validation, normalization, and sanitization rules
  for client and server: passwords, confirm password, mobile numbers (IN/US, E.164),
  email, names, OTP, usernames, postal codes (IN PIN / US ZIP), and Luhn card checks.
  Use when implementing or reviewing form validation, input sanitizers, or shared
  client/server validation modules.
---

# Form Input Validation

Provides a single, framework-agnostic validation core ([assets/validation-core.mjs](./assets/validation-core.mjs)) with shared rules, messages, and normalizers so the client (live validation) and server (authoritative validation) never disagree.

## Included Assets & Scripts

- **[assets/validation-core.mjs](./assets/validation-core.mjs)**: Dependency-free validation, normalization, and sanitization module.
  - Every validator returns `{ valid, message, normalized }`.
  - Exports `MESSAGES`, `PASSWORD_POLICY`, `MOBILE_REGIONS`, `POSTAL_REGIONS`, `VALIDATORS`, `checkPassword`, `validatePasswordConfirm`, `digitsOnly`, `normalizeNational`, `sanitizeMobile`, `validateMobile`, `isE164`, `validateEmail`, `validateName`, `validateOtp`, `validateUsername`, `validatePostalCode`, `luhnValid`, and `validateCardNumber`.
- **[assets/test-vectors.json](./assets/test-vectors.json)**: Cross-platform test vectors for verification.
- **[scripts/selftest.mjs](./scripts/selftest.mjs)**: Automated self-test suite (229 checks).

## Usage & Verification

1. Copy or adapt [assets/validation-core.mjs](./assets/validation-core.mjs) into the project's shared module so frontend and backend enforce the exact same rules and error messages.
2. Customize policy constants (`PASSWORD_POLICY`, `MOBILE_REGIONS`, `POSTAL_REGIONS`, `MESSAGES`) in one place only.
3. Run the self-test after any rule or policy change:
   ```bash
   node scripts/selftest.mjs
   ```
