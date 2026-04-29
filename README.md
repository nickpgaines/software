# Nick360

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
- SQLite (via `better-sqlite3`) — database file is created automatically at `apps/web/data/crm.db`
- Cookie-based auth signed with HMAC — no OAuth, no external services
