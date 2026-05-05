# Forge CRM

Simple CRM for a door-to-door window cleaning business. Login, dashboard, schedule, and customer management.

## Run it

```bash
cd apps/web
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with the default credentials:

- Username: `admin`
- Password: `admin`

To change them, edit `apps/web/.env`.

## Stack

- Next.js (App Router) + React + Tailwind
- libSQL via `@libsql/client` — talks to Turso in production, falls back to a local SQLite file at `apps/web/data/crm.db` when no Turso URL is configured
- Cookie-based auth signed with HMAC — no OAuth, no external services

## Deploy (Vercel + Turso)

The DB layer reads two environment variables:

- `TURSO_DATABASE_URL` — the `libsql://...turso.io` URL for your Turso database
- `TURSO_AUTH_TOKEN` — the auth token issued for that database

If both are set, the app talks to Turso. If they're unset (local dev), the app falls back to `file:./data/crm.db`. Schema is created/migrated on first connection.

To set up:

1. Create a database with the [Turso CLI](https://docs.turso.tech/cli) (`turso db create nick360`) and grab its URL + auth token.
2. In Vercel project settings, add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The other env vars from `.env.example` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) should also be configured.
3. Deploy. On first request the libSQL client runs the schema migrations against Turso.
