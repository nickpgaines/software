import type { Db } from './db';

async function addColumn(db:Db,table:string,name:string,definition:string) {
  const columns=()=>db.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();
  if((await columns()).some(column=>column.name===name))return;
  try{await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);}
  catch(error){
    // Another startup may have installed the same additive column. Suppress
    // only that proven race, never an unrelated database/migration failure.
    if(!(await columns()).some(column=>column.name===name))throw error;
  }
}

/** Additive migration also usable against existing installations. */
export async function installTerminalSchema(db: Db): Promise<void> {
  for (const [name, definition] of [
    ['requires_explicit_selection', 'INTEGER NOT NULL DEFAULT 0'],
    ['allow_redisplay', 'TEXT'],
    ['recurring_only', 'INTEGER NOT NULL DEFAULT 0'],
    ['stripe_account_id', 'TEXT'],
  ]) {
    await addColumn(db,'stripe_payment_methods',name,definition);
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
  await addColumn(db,'terminal_attempts','initiating_staff_id','INTEGER');
  await addColumn(db,'terminal_attempts','outcome_revision','INTEGER NOT NULL DEFAULT 0');
  await db.exec(`
    CREATE INDEX IF NOT EXISTS terminal_attempt_actor ON terminal_attempts(company_id,initiating_staff_id,updated_at);
    CREATE TABLE IF NOT EXISTS terminal_outcomes (
      id TEXT PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
      attempt_id TEXT NOT NULL REFERENCES terminal_attempts(attempt_id) ON DELETE CASCADE,
      stripe_account TEXT NOT NULL,
      provider_object_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('approved','declined','canceled')),
      occurred_at TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      UNIQUE(company_id,stripe_account,provider_object_id,kind)
    );
    CREATE INDEX IF NOT EXISTS terminal_outcome_attempt ON terminal_outcomes(company_id,attempt_id,occurred_at);
    CREATE TABLE IF NOT EXISTS terminal_notice_acknowledgments (
      company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
      staff_id INTEGER NOT NULL,
      notice_id TEXT NOT NULL,
      acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(company_id,staff_id,notice_id)
    );
    CREATE TRIGGER IF NOT EXISTS terminal_staff_deleted AFTER DELETE ON staff BEGIN
      UPDATE terminal_attempts SET initiating_staff_id=NULL WHERE company_id=OLD.company_id AND initiating_staff_id=OLD.id;
      DELETE FROM terminal_notice_acknowledgments WHERE company_id=OLD.company_id AND staff_id=OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS terminal_staff_moved AFTER UPDATE OF company_id ON staff WHEN OLD.company_id IS NOT NEW.company_id BEGIN
      UPDATE terminal_attempts SET initiating_staff_id=NULL WHERE company_id=OLD.company_id AND initiating_staff_id=OLD.id;
      DELETE FROM terminal_notice_acknowledgments WHERE company_id=OLD.company_id AND staff_id=OLD.id;
    END;
  `);
}
