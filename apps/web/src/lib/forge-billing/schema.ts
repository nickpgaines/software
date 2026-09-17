import type { Db } from '@/lib/db';
export async function installForgeBillingSchema(db: Db): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS forge_billing_accounts (
    company_id INTEGER PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL, livemode INTEGER NOT NULL,
    customer_id TEXT UNIQUE, customer_key TEXT NOT NULL UNIQUE,
    deleting INTEGER NOT NULL DEFAULT 0, sync_version INTEGER NOT NULL DEFAULT 0,
    subscription_id TEXT UNIQUE, subscription_status TEXT,
    price_id TEXT, plan TEXT, interval TEXT, seat_limit INTEGER,
    paid_through TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS forge_billing_checkout (
    company_id INTEGER PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
    reservation_id TEXT NOT NULL UNIQUE, plan TEXT NOT NULL, interval TEXT NOT NULL,
    price_id TEXT NOT NULL, session_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'reserved',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS forge_billing_events (
    event_id TEXT PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
}
