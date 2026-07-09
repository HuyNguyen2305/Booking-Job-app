# Architecture & conventions

This repository follows a standard template used across multiple applications
(different names, same skeleton): Fastify + Sequelize (PostgreSQL) + Awilix DI,
layered `Router → Controller → Service → Repository → Model`, schema-per-tenant
multi-tenancy, and a distinctive Jest ESM test structure.

Everything in **"Reusable template"** below is app-agnostic — when starting a new
application built on this same stack, copy that section into its `CLAUDE.md`
verbatim (only file/module *names* change, not the pattern). **"This application"**
holds the details specific to this particular codebase.

---

## Reusable template

No sibling `package.json` typically lives in the folder this file is generated
for — the `imports` map (path aliases below) and dependency list live in a
`package.json` at the actual project root, which may sit one level up from
wherever `src/`+`test/` were checked out. Don't assume you can run
`npm test`/`npm install` from here without checking.

### Path aliases

Imports use Node subpath-import aliases (`#name/...`), not relative paths:

| Alias | Resolves to |
|---|---|
| `#src/*` | `src/*` |
| `#configs/*` | `src/configs/*` |
| `#constants/*` | `src/common/constants/*` |
| `#controllers/*` | `src/controllers/*` |
| `#services/*` | `src/services/*` |
| `#repositories/*` | `src/repositories/*` |
| `#models/*` | `src/models/*` |
| `#schemas/*` | `src/schemas/*` |
| `#common-schemas/*` | `src/common/schemas/*` |
| `#utils/*` | `src/utils/*` |
| `#test/*` | `test/*` |

Always use the alias form matching what surrounding files in that directory already
use — e.g. repositories import models as `#models/x.model`, never `../../models/x.model`.

### Layering

Strict pipeline: `Router → Controller → Service → Repository → Model`.

- `src/routers/*.router.js` — Fastify routes, auto-loaded via `@fastify/autoload`
  (matches `*.router.js` only, one directory deep). A router is a small class:
  constructor resolves its controller from the DI container and builds any
  `passportPlugin.authenticate(...)` guards it needs; `register()` declares routes on
  `this.fastify`, each with `config: { responseFormat: 'standard' }`, a `schema`, and a
  `preValidation` auth guard.
- `src/controllers/*.controller.js` — thin HTTP orchestration only: read identity off
  request context, call services/repositories, shape the response. No business logic,
  no direct Sequelize/model access.
- `src/services/*.service.js` — business logic lives here.
- `src/repositories/*.repository.js` — data access only. All extend
  `src/common/base/base.repository.js` (generic `get/getOne/create/update/delete/
  softDelete/pagination`); add table-specific query methods on the subclass.
- `src/models/*.model.js` — one Sequelize model per DB table.
- `src/schemas/*.schema.js` — Fastify JSON-schema request/response validation
  (also powers the generated Swagger docs). See conventions below.

Each layer has an `index.js` that registers its classes into the Awilix container
(`src/container.js`) via `registerSingleton(KEY, ClassName)`. Resolution elsewhere is
by string key (`REPOSITORY_KEYS.X`, `SERVICE_KEYS.X`, `CONTROLLER_KEYS.X`) from
`#constants/singleton`, not auto-wired.

**Naming**: kebab-case, type-suffixed filenames (`access-token.repository.js`,
`booking.service.js`), never nested-by-type folders for the domain object itself.

### Adding a new feature — checklist

1. Model in `src/models/`, if the table doesn't already have one.
2. Repository in `src/repositories/` extending `BaseRepository`; register it in
   `src/repositories/index.js` and add a key to `REPOSITORY_KEYS` in
   `#constants/singleton`.
3. Service in `src/services/` (if there's business logic beyond CRUD); register in
   `src/services/index.js` + `SERVICE_KEYS`.
4. Controller method, resolving its services/repositories from the container in the
   constructor; register the controller class in `src/controllers/index.js` +
   `CONTROLLER_KEYS` if it's new.
5. Schema in `src/schemas/` using `buildSuccessResponse(...)` from
   `#common-schemas/response.schema` for the 200 response and `AUTH_HEADERS_SCHEMA`
   from `#common-schemas/common.schema` for authenticated routes.
6. Route in the relevant `src/routers/*.router.js`, wiring `schema`,
   `config: { responseFormat: 'standard' }`, and a `preValidation` auth guard
   (`passportPlugin.authenticate('access-token', { session: false, authInfo: false })`
   or another strategy from `src/common/auth/strategies/`).
7. Tests: one unit test file per new method under `test/unit/...`, plus an
   integration test per new repository method under `test/integration/...` — see
   Tests section below for the exact directory/naming shape.

### Controller conventions

- Read auth/tenant context via `requestContext.get('identity')` (from
  `@fastify/request-context`) or `request.requestContext.get('identity')` — both
  appear in the codebase; prefer whichever the file you're editing already uses.
- Success response shape is `{ success: true, message: [] | string, data: {...} }`
  sent directly via `reply.send(...)` — matches `buildSuccessResponse` in the schema
  and the global `preSerialization` hook in `src/index.js`.
- Throw `CustomError(statusCode, message, options)` or a subclass (`AuthError`, ...)
  from `#configs/error` for error paths that should produce a proper HTTP error
  status; the global `setErrorHandler` in `src/index.js` formats it. Some existing
  handlers instead `return reply.send({ success: false, message })` with a 200
  status for "soft" failures — match the pattern the surrounding controller already
  uses rather than mixing both in one method.

### Auth

Passport-based (`src/common/middleware/passport.js`), with custom strategies in
`src/common/auth/strategies/`. Shared helpers live in
`src/common/auth/auth-context.js` (token/device-id parsing, `setIdentity`,
token validation) — reuse these instead of re-parsing headers in a new strategy.
`setIdentity` is what populates `requestContext.get('identity')` for every
downstream layer.

### Multi-tenancy

One Postgres **schema per tenant**, not a `tenant_id` column. `BaseRepository.setSchema()`
reads `identity.tenant` from `@fastify/request-context` (set during auth) and calls
`.schema(tenantSchema)` on every query. `cls-hooked` + `Sequelize.useCLS` propagate this
through async calls without explicit threading.

### Tests

Two top-level suites, split by whether they touch a real database:

- `test/unit/**` — pure logic only (services, factories, utils). **Never touches
  Sequelize/Postgres.** DB-backed methods live in `test/integration` instead.
- `test/integration/**` — hits a real Postgres inside a transaction that's rolled
  back after each test. No DB mocking.

#### File-per-method convention

Each source file gets its own **directory** (mirroring the source filename, without
the `.service`/`.repository` suffix), and each exported method gets its own **test
file** inside it:

```
src/services/booking.service.js
  → test/unit/services/booking-service/build-day-item.unit.test.js
  → test/unit/services/booking-service/create-booking-context.unit.test.js
  → test/unit/services/booking-service/is-date-blocked-by-exception.unit.test.js
  → ... (one file per method)
```

Same pattern under `test/integration/repositories/<name>-repository/<method>.integration.test.js`.
Do not put multiple methods' tests in one file, and do not drop the `.unit.test.js` /
`.integration.test.js` suffix (it's kept even though the directory already encodes the
type — filenames should stay self-describing if moved).

#### Unit test mocking pattern

This is native ESM Jest, not Babel-transpiled CJS, so:

1. Build the mock object first.
2. Register it with `jest.unstable_mockModule('#alias/path', () => ({ ExportName: mock }))`
   **before** importing anything that depends on it.
3. Only then `await import(...)` the module under test — static `import` at the top
   of the file will load the real module before the mock is registered.

```js
import { jest } from '@jest/globals';

const timeUtilMock = { time: jest.fn(), getDate: jest.fn() /* ... */ };
jest.unstable_mockModule('#utils/time.util', () => ({ TimeUtil: timeUtilMock }));

const { BookingService } = await import('#services/booking.service');
```

For the class under test, don't resolve it through the Awilix container — instantiate
via `Object.create(ClassName.prototype)` and hand-assign mocked repos/services as
properties directly (skips DI entirely, keeps the test isolated to one method).

#### Integration test pattern

Use `seedWithTransaction` from `test/helpers/seed-fixtures.js`:

```js
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { RepoClass } = await import('#repositories/x.repository');

describe('XRepository.method (integration)', () => {
  let rollback;
  const repo = new RepoClass();

  afterEach(async () => {
    if (rollback) await rollback();
  });

  it('does the thing', async () => {
    const ctx = await seedWithTransaction([
      { table: 'some_table', schema: 'gorilladesk', rows: [...] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async () => {
      const result = await repo.method(...);
      expect(result).toEqual(...);
    });
  });
});
```

Fixture row data lives in `test/fixtures/*.cjs` (CJS extension, not ESM, to stay
compatible with Sequelize-CLI-style seeders) — reuse existing fixtures where the table
overlaps rather than inlining new row literals per test.

---

## This application: GorillaDesk Portal API

App-specific details that do **not** carry over to a differently-named app built on
the template above.

- Serves a customer-facing portal (bookings, payments, account/profile info) in
  front of a larger legacy PHP application's shared PostgreSQL database.
- Default/shared tenant schema name is `gorilladesk`; some tables are mid-migration
  from per-account schemas (`acct_<user_id>`) to this shared schema — see
  `MIGRATED_TABLES` in `#constants/default-table.const` before assuming a new table
  follows the per-tenant pattern.
- Identity fields populated by this app's auth strategies: `identity.user_id`
  (owner), `identity.token.user_id` (customer, from the `access-token` strategy),
  `identity.currency`.
- Auth strategies present: `access-token`, `owner`, `owner-id`, `account-id`,
  `portal-token`.
- Payment gateways: Stripe and Square, behind a factory in
  `src/common/factory/payment-gateway/`.
