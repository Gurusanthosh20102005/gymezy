---
name: single-source-of-truth
description: 'Single Source of Truth (SSOT): every constant, enum, validation rule, API contract, error code, role or permission, config value, design token and user-facing message is defined exactly once and reused everywhere else. Use whenever defining or changing constants, enums, status lists, validation schemas, route paths, error messages, environment or config access, roles, theme tokens or UI text, and whenever the same value, rule or type appears written in more than one place, in any language or stack.'
---

# Single Source of Truth (SSOT)

## Core principle

Every piece of knowledge (a rule, a value, a shape, a message) is defined in exactly ONE place. Everything else imports, derives or generates from it. Never copy, retype or "mirror" it.

If you change a fact and have to edit more than one file, SSOT is broken.

This applies in any language or stack. The examples below use a typical JavaScript full-stack project (shared schemas, a server, a client); map each row to your ecosystem's equivalent (Pydantic or Protobuf, Bean Validation, Dart packages, a shared Gradle module, and so on). Follow the project's existing layout for *where* the owner lives; this skill decides *that there is exactly one*.

## Before writing any code, ask

1. Does this value, rule or shape already exist? Search first and reuse it.
2. If it is new: which layer owns it (see the ownership map)? Define it there only.
3. Can the other layers derive it (types, validators, docs, clients) instead of redefining it?

## Ownership map (what lives where, once)

| Fact | Single owner | Consumers derive from it |
|---|---|---|
| Data shape and validation rules | A shared schema (Zod, Joi, JSON Schema, Pydantic, Bean Validation) | Server validators, ORM/model hints, client forms, generated types |
| Enums and constants (status, roles, limits) | One constants module | DB models, API, UI dropdowns, tests |
| API routes and endpoint paths | A shared route registry (or the server's route table) | Routers, the client API layer, tests |
| API request/response contract | Shared schemas plus an OpenAPI document generated from them | Client, docs, mocks |
| Error codes and messages | One error catalog (code to message and HTTP status) | Server throw sites, client toasts, i18n |
| Roles and permissions | One role-to-capability matrix | Server middleware, client route guards, UI visibility |
| Environment and config | One validated config module per app, parsed once at boot | The whole app; nothing else reads `process.env` / `import.meta.env` / `os.environ` |
| Database structure | The model or schema definitions (one per collection or table) | Repositories and services only; no ad-hoc queries elsewhere |
| Server state in the UI | A data-fetching cache (React Query, RTK Query, SWR, Apollo) | All components; never duplicate API data into local state |
| Global client state | One store module per domain | Components via selectors |
| Design tokens (colors, spacing, type, radius) | One token or theme source (CSS variables, theme object, `ThemeData`) | The UI library theme, CSS, components (see `professional-ui-design`) |
| UI text and labels | One messages or i18n catalog | All components |
| Business rules (pricing, eligibility, limits) | One domain service or module on the backend | Controllers, jobs, scripts; the client only displays results |
| Secrets and credentials | The secret manager or environment, read through the config module | Nothing hardcodes or copies them |

## Recommended structure

Monorepo (preferred):

```text
/shared            <- the SSOT package (pure code, no framework imports)
  /constants
  /schemas
  /errors
  /permissions
  /api-routes
/server            <- imports from shared
/client            <- imports from shared
```

Separate repositories: publish `shared` as a private package (or a versioned submodule) consumed by both. Do not copy files between repositories.

## Rules

1. **Derive, do not duplicate.** Types come from schemas (`z.infer`, generated types), not hand-written interfaces beside them.
2. **Validate at the edges with the shared schema:** server middleware on the server, a form resolver on the client. Same rule, same source.
3. **No magic strings or numbers.** `"ADMIN"`, `"pending"`, `10`, `"/api/users"` come from a named constant.
4. **One config module.** Parse and validate environment variables at startup, fail fast if invalid, and export a typed object.
5. **One API client** in the frontend. Every call goes through it, and paths come from the shared routes.
6. **One place for error mapping.** The backend throws coded errors, a single handler maps code to HTTP status and message, and the frontend maps the code to display text from the same catalog.
7. **Permissions are data, not scattered `if (role === ...)` checks.** Check capabilities through the shared matrix.
8. **The persistence model owns the storage shape.** The DTOs that leave the API come from shared schemas, never from returning raw database records.
9. **Server data is not copied into client state.** Cache it, invalidate it, select from it.
10. **Generated artifacts** (OpenAPI, types, mocks, API clients) are never edited by hand; regenerate them from the source.
11. **Documentation is derived too.** The README's environment table documents the config module (and `.env.example` matches it); it does not invent its own list.

## Anti-patterns (flag and fix on sight)

- The same enum or status list typed in the model, the validator and a dropdown.
- A hand-written type duplicating a schema or model shape.
- Hardcoded URLs, ports, role names or limits in components or controllers.
- `process.env.X` (or the equivalent) read in many files.
- Validation rules that differ between frontend and backend.
- The same error text hardcoded in several places.
- API data copied into component state and kept "in sync" by hand.
- Colors and spacing hardcoded in components instead of tokens.
- Business logic duplicated on client and server.
- Two documents (or two skills) describing the same rule, so that they can drift apart.

## Workflow when changing a fact

1. Find the owner in the ownership map.
2. Change it there only.
3. Let types, validators, docs and UI follow automatically. Fix compile errors, not copies.
4. Add or update a test at the source (schema, constant, rule), not at every consumer.

## Review checklist

- [ ] Is every new constant, enum and rule defined once, in the correct owner location?
- [ ] Are types derived rather than re-declared?
- [ ] Do frontend and backend validate with the same schema?
- [ ] Is there any hardcoded string, number, URL, role or color that should be a named export?
- [ ] Is env and config accessed only through the config module?
- [ ] Are errors, permissions and messages looked up from their catalogs?
- [ ] Is any server data duplicated into client state?
- [ ] Were generated files regenerated instead of hand-edited?

## Works together with

`professional-engineering-standards` (the entry point), `api-standardization`, `jwt-auth-lifecycle`, `mongodb-architecture`, `react-project-architecture`, `clean-code-sonarqube-guard`, `readme-documentation` and `professional-ui-design`. When these skills conflict with SSOT on where something lives, SSOT ownership wins, and the other skill decides only the style within that location.
