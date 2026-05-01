# CLAUDE.md

Project guidance for Claude Code sessions on this repo.

## Stack

- Next.js (App Router) + React + Tailwind in `apps/web`
- libSQL via `@libsql/client` (Turso in prod, local SQLite file in dev)
- Cookie-based HMAC auth — no OAuth / external auth services
- Stripe Connect for payments (each company connects its own Stripe account)

## Workflow

- Develop on a feature branch (`feature/*` or `claude/*`).
- Always run `npm run build` from `apps/web` before pushing — typecheck and
  Next build must both pass.
- Always commit and push the feature branch.

## Auto-merge policy

When a feature branch passes typecheck and build locally, **open a PR to
`main` and squash-merge it without asking for confirmation**, as long as the
change is additive — new pages, new API routes, new tables/columns added via
the auto-migration block, or self-contained UI components.

**Always ask first** before merging if the change:

- modifies authentication, session handling, or HMAC signing
- modifies billing, Stripe, or payment flows
- alters or drops existing DB columns/tables (additive ALTERs are fine)
- changes shared infra: middleware, the libSQL client setup, build config,
  CI, or env-var contracts
- removes a feature or breaks an existing public route/API contract
- touches files outside `apps/web` (root config, devcontainer, etc.)

If unsure which bucket a change falls into, ask.

## Branch naming

- New features: `feature/<short-kebab-name>`
- Claude-spawned exploratory branches: `claude/<short-kebab-name>`

## After merge

- Report the merge commit SHA and PR number.
- Do not delete the feature branch automatically.
