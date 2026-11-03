---
name: mongodb-architecture
description: 'MongoDB (Mongoose or the native driver) architecture standards: one shared connection, the repository pattern, schema design (embed versus reference), indexes and query safety, hiding internal _id and __v from API output, and tenant isolation when the system is multi-tenant. Use whenever the task creates or changes a MongoDB model, schema, query, repository, connection setup, index, migration or aggregation, or asks how to store, relate, filter or paginate data in MongoDB, even if the user only says "add a collection" or "save this data".'
---

# MongoDB Architecture

Design and maintain a MongoDB data layer (Mongoose or the native driver) that is efficient, consistent, and organized so that database details never leak into business logic. Inspect the project's existing models, repositories and connection code first and match them; these rules are the default when there is no established pattern, or when the existing one is a real problem.

## Objectives

1. **No accidental duplication:** no duplicate connections or pools, no copies of data without a sync plan.
2. **Single source of truth for queries:** every database call lives in a repository, not scattered across controllers and services.
3. **Tenant discipline (only if the system is multi-tenant):** strict isolation without architectural chaos.
4. **Performance and consistency:** embed or reference according to access patterns, and index for the queries you actually run.

## 1. Connection management

The most common cause of "duplicate DB" problems in Node.js and serverless environments is failing to reuse the connection pool.

- **Create the client once.** Initialize the `MongoClient` (or the Mongoose connection) exactly once at startup and reuse its pool for every request.
- **Never connect inside a request handler, service or repository.**
- **Serverless:** cache the connection promise on `globalThis` so warm invocations reuse it.
- Set the pool size, `serverSelectionTimeoutMS` and query time limits (`maxTimeMS`) explicitly. Read the connection string from the validated config module (see `single-source-of-truth`), never from source. Close the client on graceful shutdown.

```javascript
// db/connection.js
import mongoose from "mongoose";
import { config } from "../config.js";

let connecting;
export function connectDb() {
  connecting ??= mongoose.connect(config.mongo.uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  return connecting;
}
```

## 2. Multi-tenant rules (apply only if the system is multi-tenant)

Adhere to the one strategy the project chose; do not mix them.

- **Shared database, shared collections (pool):** every document in a tenant-scoped collection has a required, indexed `tenantId`, and **every repository query includes it**. Enforce this in one place (a base repository or a schema plugin) so no developer has to remember it. Put `tenantId` first in compound indexes, and make uniqueness per tenant (`{ tenantId: 1, email: 1 }` unique).
- **Database per tenant (silo):** manage connections through one `TenantConnectionFactory` that caches and reuses handles. Do **not** create a `MongoClient` per tenant: call `client.db(tenantName)` on the single shared client.
- The tenant comes from the verified auth context (see `jwt-auth-lifecycle`), never from a request field.

```javascript
// repositories/tenantRepository.js: the tenant filter cannot be overridden by the caller
export class TenantRepository {
  constructor(model, tenantId) { this.model = model; this.tenantId = tenantId; }
  async find(filter = {}, { limit = 20, sort = { _id: 1 } } = {}) {
    const docs = await this.model.find({ ...filter, tenantId: this.tenantId }).sort(sort).limit(limit).lean();
    return docs.map(toEntity);
  }
}
```

## 3. Data modeling: embed or reference

MongoDB allows duplication for read speed. Do it deliberately.

- **Embed (duplicate) when** the data is read together, rarely changes, and the array is strictly bounded (a user's address).
- **Reference (do not duplicate) when** the data changes often, is shared by many parents, or can grow without bound (a `Company` referenced from a `User`).
- **Never use unbounded arrays** (comments, events, logins) inside a document: they hit the 16 MB limit and make updates slow. Use a child collection.
- **If data must be duplicated** (for example `userName` inside an `Order`), implement the sync (Change Streams, or an event in the service layer) so every copy updates when the source changes, and document which field is the source of truth.
- Validate shape at the database boundary with a Mongoose schema or a `$jsonSchema` validator (required fields, types, enums), and enable `timestamps`.

## 4. Architectural boundaries: the repository pattern

Database logic must never bleed into business logic.

- Controllers and services **never** import Mongoose models or `MongoClient`, and never use MongoDB operators or types (`$set`, `$push`, `ObjectId`).
- All database access is inside **repositories**. The service passes plain JavaScript objects in; the repository runs the query and returns plain objects.
- This is the same layering as `backend-unit-testing`: it is what lets services be unit-tested with a fake repository.

## 5. Output sanitization and ID masking (this skill owns the rule)

Raw `_id` (`ObjectId`) and `__v` never appear in API responses or client payloads (the API-level rule is in `api-standardization`).

- **Preferred: an explicit mapper in the repository.** It works for plain objects (`.lean()` results) and for documents.

  ```javascript
  const toEntity = ({ _id, __v, ...rest }) => ({ id: String(_id), ...rest });
  ```

- **Alternative: a schema transform.** Be aware it applies only to documents, **not** to `.lean()` results, so combining the two silently leaks `_id`.

  ```javascript
  schema.set("toJSON", {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
  ```

- Also strip sensitive fields (password hashes, internal flags) in the mapper, not in controllers.

## 6. Indexes, queries and safety

- **Index for the queries you run.** Compound index order follows **Equality, Sort, Range**. Check slow queries with `explain()`. Every index costs writes, so remove unused ones.
- **Unique constraints** are enforced by a unique index, not only by a pre-check (races). Translate the duplicate-key error (`11000`) into a domain `ConflictError`.
- **Select only what you need** (projection) and use `.lean()` for read-only queries.
- **Paginate with a cursor or range** on a stable sort key (`_id`, or `createdAt` plus `_id`) for large collections; a large `skip` scans every skipped document.
- **Operator injection:** a JSON body such as `{ "email": { "$ne": null } }` turns a lookup into a match-all. Validate types (a string must be a string) before building filters, and never pass `req.body` or `req.query` straight into a query object. Avoid `$where` and server-side JavaScript.
- **Transactions** (replica set required) only where multi-document atomicity is truly needed; otherwise design documents so a single write is atomic.
- Keep migrations as scripts that can be re-run safely; never change shapes by hand in production.

## 7. Output instructions

When asked to implement a MongoDB feature or model:

1. **Schema / model:** the schema definition (Mongoose schema or `$jsonSchema`), highlighting indexes (including the tenant-first compound index when multi-tenant), references, validation, `timestamps`, and the ID-masking mapper.
2. **Connection logic (if requested):** the single shared connection above.
3. **Repository:** the repository class, showing queries abstracted from the service, tenant scoping enforced in one place, projections and pagination, and sanitized output.
4. **Tests:** repository behavior against a real or in-memory MongoDB in integration tests; services with a fake repository (see `backend-unit-testing`).

## Works together with

`backend-unit-testing` (layers and tests), `api-standardization` (public identifiers, pagination), `jwt-auth-lifecycle` (tenant from the verified token), `single-source-of-truth` (config module, constants and enums).
