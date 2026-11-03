---
name: professional-engineering-standards
description: 'Entry point and definition of done for professional software work. Use for ANY task that writes, changes, reviews, designs or documents code: features, bug fixes, refactors, endpoints, database models, authentication, UI and pages, tests, README, commit messages and project setup, even small ones and even when the user never mentions standards or best practices. Routes the task to the specialist skills (UI, API, auth, passwords, MongoDB, React architecture, backend testing, clean code, single source of truth, git, README) and applies the shared rules: discover the project first, secure by default, no hardcoded secrets or fallback identities, handle failure paths, and verify before reporting. Skip for pure conversation with no code.'
---

# Professional Engineering Standards

The entry point for professional software work. It does three things: makes sure the right specialist skills are used, applies the rules every task shares, and defines what "done" means. It deliberately stays short; the detail lives in the specialist skills, defined once.

Skip this skill for pure conversation with no code or file changes (explaining a concept, answering a quick question) and for one-line edits with no design decision in them.

## 1. Start: discover, then decide

1. **Read the project before changing it:** structure, conventions, configuration, tests, and how similar things are already done. Match them. These standards are the default for gaps and for new work, not a license to restyle a working codebase.
2. **Priority when guidance conflicts:** security, then correctness, then consistency with the project, then preference. An explicit instruction from the user overrides defaults; if it creates a security or accessibility risk, do what was asked and say so in one line.
3. **Ask only when blocked.** If a reasonable default exists (a color, a library already in the project, a folder name), choose it, say what you assumed, and keep going.

## 2. Route to the specialist skills

Read every skill that applies before writing code. Most real tasks touch two or three.

| If the task involves | Use |
|---|---|
| Anything a person will see: pages, screens, components, forms, tables, styling, themes, mockups, prototypes | `professional-ui-design` |
| Endpoints, routes, controllers, middleware, response and error shapes, pagination, status codes | `api-standardization` |
| Login, logout, sessions, tokens, cookies, refresh, auth middleware, protecting routes | `jwt-auth-lifecycle` |
| Passwords, hashing, signup, reset flows, credential storage | `password-security` |
| MongoDB models, schemas, queries, repositories, connections, indexes, tenants | `mongodb-architecture` |
| Backend structure (controllers, services, repositories), dependency injection, unit and integration tests | `backend-unit-testing` |
| React components, pages, hooks, state, folder structure, API client | `react-project-architecture` |
| Writing or refactoring any JavaScript or TypeScript (complexity, nesting, accessibility semantics, secure randomness, regex, secrets) | `clean-code-sonarqube-guard` |
| Defining or changing constants, enums, validation rules, config and env access, error codes, roles, tokens, messages | `single-source-of-truth` |
| Commit messages, branches, pull requests, git commands | `git-workflow` |
| README, setup instructions, environment variable docs | `readme-documentation` |

If two skills disagree on where something lives, `single-source-of-truth` decides the location and the other skill decides the style within it. If they disagree on security, the safer rule wins.

## 3. Rules that always apply

- **No secrets in source, logs, examples or commits.** Keys, tokens, passwords and connection strings come from validated configuration (a secret manager or environment), never from code.
- **No hardcoded fallback identities or demo data in production paths.** Fixtures live in tests and stories only.
- **Define each fact once.** Search for an existing constant, schema, token, message or helper before creating one.
- **Handle the unhappy paths:** errors, empty results, timeouts, missing permissions, bad input. No swallowed exceptions; no stack traces or internals shown to users.
- **Validate at boundaries, trust nothing from the client:** identity, role and tenant come from the verified credential, never from the request.
- **Keep changes focused.** No unrelated rewrites, no new dependency without a reason, and never disable a lint rule, test or security check to make something pass; fix the cause.
- **Write for the next reader:** plain names, small functions, comments that explain why, consistent style with the surrounding code.

## 4. Definition of done

Work is done when each applicable item is true, and the final report says which you could not verify.

- [ ] It runs, and the relevant tests pass. New behavior has tests, including failure paths.
- [ ] Security basics hold: no secrets, input validated, authorization checked on the server, no sensitive data in logs or responses.
- [ ] Lint and quality rules are satisfied without suppressions that hide real problems.
- [ ] UI work was looked at, not just written: checked at narrow, medium and wide widths and in every state (loading, empty, error, success), and its accessibility baseline holds.
- [ ] Configuration, environment variables, scripts, structure or setup changed, so the README and `.env.example` changed with them.
- [ ] Commit message and PR text follow the project's convention (Conventional Commits by default).
- [ ] Nothing was left behind: debug output, commented-out code, unused imports, temporary files.

## 5. Final report

Finish with a short, factual summary, not a narration of the process:

1. **What changed and why**, in a few lines.
2. **Assumptions you made** (library, naming, brand color, behavior not specified).
3. **How you verified it**, and what you did not or could not verify (for example "tests not run: no database available").
4. **Risks and follow-ups** the user should decide on, such as an insecure pattern you found and left in place.

Be direct about problems you introduced or discovered, and never claim something was tested when it was not.
