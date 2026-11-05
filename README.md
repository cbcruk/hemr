# hemr

Backend API server for a Korean medicine clinic EMR, redesigned from a static analysis of an existing web client.

## Layout

| Path | Contents |
|---|---|
| `docs/design/` | Domain design (Korean). Start with [`docs/design/README.md`](docs/design/README.md) |
| `docs/reference/` | Evidence from the analysis: feature specs, endpoint list, permission codes, screen map |
| `docs/reference/rules/` | Business rules of the current client, extracted by executing the original code (Korean). Index: [`docs/reference/rules/README.md`](docs/reference/rules/README.md) |
| `test/fixtures/rules/` | Input → output cases for each rule, used as server test data |
| `src/shared/` | Cross-cutting conventions: prefixed ids, RFC 9457 problem details, job types |
| `src/modules/` | Bounded contexts as modules of a modular monolith |

Paths written as `re-upstream/restored/...` point to the reverse-engineered client tree used during analysis. That tree is not part of this repository; the rule documents quote the code they depend on.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:3000/v1/health
pnpm typecheck
pnpm test
pnpm format     # or format:check
pnpm build
```

`pnpm dev` stores data in SQLite at `data/hemr.sqlite` (override with `DATABASE_FILE`, or use `:memory:`), applies migrations on startup and seeds two sample visits. Repository and relay tests use in-memory SQLite (`:memory:`); service and HTTP tests use in-memory layers, with one HTTP test on SQLite. No database server is needed.

## Status

Only the first piece of domain logic exists: the visit state machine in `src/modules/front-desk/visits/`. The server is built on Effect (`effect/http-api`), with the HTTP contract in `src/api.ts`; visits are stored in SQLite (decision D9), and state changes write `visit.status_changed` to an outbox that an in-process relay publishes. Open decisions are listed in `docs/design/review.md`.
