# emr-backend

Backend API server for a Korean medicine clinic EMR, redesigned from a static analysis of an existing web client.

## Layout

| Path | Contents |
|---|---|
| `docs/design/` | Domain design (Korean). Start with [`docs/design/README.md`](docs/design/README.md) |
| `docs/reference/` | Evidence from the analysis: feature specs, endpoint list, permission codes |
| `src/shared/` | Cross-cutting conventions: prefixed ids, RFC 9457 problem details, job types |
| `src/modules/` | Bounded contexts as modules of a modular monolith |

The reverse-engineered client code that `docs/design/review.md` cites as `re-upstream/restored/` is kept outside this repository.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:3000/v1/health
pnpm typecheck
pnpm test
pnpm build
```

## Status

Only the first piece of domain logic exists: the visit state machine in `src/modules/front-desk/visits/`. The HTTP framework (Hono) is a provisional choice; persistence (PostgreSQL + outbox) is not wired yet. Open decisions are listed in `docs/design/review.md`.
