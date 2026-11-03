---
name: backend-unit-testing
description: Layered, dependency-injected backend architecture and unit testing standards. Use when writing or changing backend code (services, controllers, repositories, middleware, validators, custom error classes), designing a backend module or feature, writing or fixing unit and integration tests, mocking dependencies, or when code is hard to test, even if the user only says "add a service", "write tests for this" or "how should I structure this backend?". Covers separation of layers, dependency injection, centralized error handling, test structure, mocking boundaries, deterministic tests and coverage.
---

# Backend Architecture and Unit Testing

Write production-quality backend code that is modular, cohesive, loosely coupled and easy to test, and write the tests that prove it. Inspect the project's existing structure, framework and test setup first and match them. The layout below is the default when there is none; the principles apply in any language, and the Node.js, Express and Jest names are only examples.

## Objectives

1. **Correctness and reliability:** code does exactly what it is meant to, including on failure paths.
2. **Testability:** easy to mock and stub without complex setup. Dependency injection is mandatory.
3. **Separation of concerns:** strict layers.
4. **Predictable error handling:** custom error classes and centralized handling.
5. **Minimal coupling:** interface boundaries and injection.
6. **Maintainability:** readable, documented where it matters, SOLID.

## Constraints

- Do not handle deployment, CI/CD, Docker, VPS, cloud infrastructure or production deployment configuration unless explicitly asked. Focus on application code and tests.
- Lower layers never call higher ones (a repository never calls a controller).
- No global state or singletons that leak state between tests.

## 1. Architecture

Use a strict layered architecture. Recommended structure (rename to fit the framework):

```text
src/
├── config/        # environment variables and configuration (validated once at boot)
├── controllers/   # HTTP request and response handlers
├── services/      # core business logic
├── repositories/  # database access and query building
├── models/        # schemas and domain entities
├── routes/        # route definitions mapped to controllers
├── middleware/    # auth, error handling, rate limiting
├── validators/    # request payload validation (Joi, Zod, ...)
├── utils/         # pure functions and stateless helpers
├── errors/        # custom error classes
└── app.js         # application bootstrap

tests/
├── unit/          # mirrors src/: services, controllers, repositories, utils, validators
└── integration/   # API and database tests
```

## 2. Component responsibilities

**Controllers (presentation)**
- Do: read the HTTP request, call services, format responses and status codes, pass errors to the error middleware.
- Do not: business logic, database queries, authentication logic, manual payload validation.

**Services (business)**
- Do: execute business rules, orchestrate repositories, throw domain-specific errors (`NotFoundError`). Stay framework-agnostic: no knowledge of HTTP, `req` or `res`.
- Do not: database driver code, raw SQL, HTTP status codes.

**Repositories (data access)**
- Do: all database interaction, hide the database technology, map records to domain entities.

## 3. Designing for testability

1. **Dependency injection.** Inject repositories, external API clients, loggers, the clock and ID generators through constructors or factory functions. Do not hardcode `require` or `import` of collaborators deep inside business logic.
2. **Pure functions.** Utilities do not read the clock or random generators; pass them in (`now`, `generateId`) so tests are deterministic.
3. **Mocking boundaries.**
   - Testing a controller: mock the service.
   - Testing a service: mock the repository.
   - Testing a repository: unit-test only the query-building logic against a mocked driver, and verify real persistence behavior (uniqueness, indexes, transactions) in **integration tests** against a real or in-memory database. A mock cannot prove a query works.

```javascript
// Composition root wires real dependencies; tests pass fakes.
export const createUserService = ({ userRepository, passwordHasher, clock }) => ({
  async register({ email, password }) {
    if (await userRepository.findByEmail(email)) throw new ConflictError("EMAIL_TAKEN");
    return userRepository.create({ email, passwordHash: await passwordHasher.hash(password), createdAt: clock.now() });
  },
});
```

## 4. Error handling

- One centralized error-handling middleware or handler.
- Custom errors extending `Error` (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`), each carrying a stable `code`.
- Services throw custom errors, controllers let them propagate (`next(err)` or an async wrapper), and the central handler maps code to status and response (see `api-standardization`). No swallowed exceptions, no empty `catch`.

## 5. Writing the tests

- **Structure:** Arrange, Act, Assert. One behavior per test. Name tests as behavior: `registers a user when the email is free`, `throws ConflictError when the email is taken`.
- **Test behavior, not implementation.** Assert on results, thrown error type or code, and calls to collaborators that are part of the contract. Do not assert private details; refactoring must not break good tests.
- **Cover:** the happy path, **every error branch**, and edge cases (empty, null, boundary values, duplicates). Use table-driven tests (`test.each`) for many inputs to one rule.
- **Deterministic and isolated:** no real network, database, time or randomness in unit tests; create fresh mocks in `beforeEach`; no ordering dependence between tests.
- **Mock only the boundaries** (repositories, external APIs, clock). Never mock the unit under test, and avoid mocking so much that the test only restates the implementation.
- **Assert on error codes or types**, not only message text.
- **Coverage is a signal, not a goal.** Aim for at least 80% on new code, but a covered line without an assertion proves nothing. A good test fails when the behavior breaks.
- **Integration tests** exercise routes with a real HTTP layer and a test database, including auth success and failure (see the checklist in `api-standardization`).

```javascript
describe("userService.register", () => {
  const build = (overrides = {}) => {
    const userRepository = { findByEmail: jest.fn().mockResolvedValue(null), create: jest.fn(async (u) => ({ id: "u1", ...u })) };
    const passwordHasher = { hash: jest.fn().mockResolvedValue("hashed") };
    const clock = { now: () => new Date("2026-01-01T00:00:00Z") };
    return { userRepository, service: createUserService({ userRepository, passwordHasher, clock, ...overrides }) };
  };

  it("creates the user with a hashed password when the email is free", async () => {
    const { service, userRepository } = build();
    const user = await service.register({ email: "a@example.com", password: "s3cret-passphrase" });
    expect(user.passwordHash).toBe("hashed");
    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({ email: "a@example.com" }));
  });

  it("throws ConflictError when the email is taken", async () => {
    const { service, userRepository } = build();
    userRepository.findByEmail.mockResolvedValue({ id: "u9" });
    await expect(service.register({ email: "a@example.com", password: "x" })).rejects.toBeInstanceOf(ConflictError);
  });
});
```

## 6. Output instructions

When asked to implement a feature, respond in this order:

1. **Models / schemas:** briefly define the data structure.
2. **Repository:** the data access logic.
3. **Service:** the business logic, explicitly showing dependency injection.
4. **Controller:** the HTTP handler.
5. **Unit tests:** at least one complete suite for the service layer with a modern framework (Jest or similar), covering the happy path and the error paths, and showing how dependencies are mocked. Add an integration test outline when the feature touches the database or auth.

## Works together with

`api-standardization` (controllers, status codes, auth tests), `mongodb-architecture` (repositories for MongoDB), `jwt-auth-lifecycle` and `password-security` (what the auth and credential services must do), `clean-code-sonarqube-guard` (complexity and test hygiene), `single-source-of-truth` (config and error catalog).
