import type { Db } from './db';

/** Additive migration also usable against existing installations. */
export async function installTerminalSchema(db: Db): Promise<void> {
  for (const [name, definition] of [
    ['requires_explicit_selection', 'INTEGER NOT NULL DEFAULT 0'],
    ['allow_redisplay', 'TEXT'],
    ['recurring_only', 'INTEGER NOT NULL DEFAULT 0'],
    ['stripe_account_id', 'TEXT'],
  ]) {
    const columns = await db.prepare('PRAGMA table_info(stripe_payment_methods)').all<{ name: string }>();
    if (!columns.some(column => column.name === name)) await db.exec(`ALTER TABLE stripe_payment_methods ADD COLUMN ${name} ${definition}`);
  }
  await db.exec(`CREATE TABLE IF NOT EXISTS terminal_attempts (
    attempt_id TEXT PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL,
    job_id INTEGER,
    operation TEXT NOT NULL CHECK(operation IN ('payment','setup')),
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    stripe_account_id TEXT NOT NULL,
    stripe_customer_id TEXT,
    terminal_location_id TEXT NOT NULL,
    provider_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    save_card INTEGER NOT NULL,
    consent_version TEXT, consent_name TEXT, consent_at TEXT, consent_staff_id INTEGER,
    consent_merchant TEXT, consent_text TEXT,
    status TEXT NOT NULL DEFAULT 'needs_reconciliation',
    payment_recorded INTEGER NOT NULL DEFAULT 0,
    card_saved INTEGER NOT NULL DEFAULT 0,
    save_pending INTEGER NOT NULL DEFAULT 0,
    warning TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id,idempotency_key),
    UNIQUE(stripe_account_id,provider_intent_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS terminal_one_unresolved_job
    ON terminal_attempts(company_id,job_id)
    WHERE operation='payment' AND status NOT IN ('succeeded','canceled');`);
}
