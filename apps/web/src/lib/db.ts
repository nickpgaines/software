import { createClient, type Client, type InValue } from "@libsql/client";

type Args = InValue[];

export type RunResult = { lastInsertRowid: number; changes: number };

export interface Stmt {
  get<T = unknown>(...args: Args): Promise<T | undefined>;
  all<T = unknown>(...args: Args): Promise<T[]>;
  run(...args: Args): Promise<RunResult>;
}

export interface Db {
  prepare(sql: string): Stmt;
  exec(sql: string): Promise<void>;
  transaction<R>(fn: (db: Db) => Promise<R>): Promise<R>;
}

type Executor = (
  sql: string,
  args: Args
) => Promise<{
  rows: unknown[];
  columns: string[];
  lastInsertRowid?: bigint | number | null;
  rowsAffected?: number;
}>;

type ExecMany = (sql: string) => Promise<void>;

let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. The app requires a Turso database; configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment."
    );
  }
  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is not set. The app requires a Turso database; configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment."
    );
  }
  return createClient({ url, authToken, intMode: "number" });
}

function getClient(): Client {
  if (_client) return _client;
  _client = makeClient();
  return _client;
}

function rowToObject<T>(row: unknown, columns: string[]): T {
  const obj: Record<string, unknown> = {};
  for (const c of columns) obj[c] = (row as Record<string, unknown>)[c];
  return obj as T;
}

function makeStmt(exec: Executor, sql: string): Stmt {
  return {
    async get<T>(...args: Args): Promise<T | undefined> {
      const r = await exec(sql, args);
      if (r.rows.length === 0) return undefined;
      return rowToObject<T>(r.rows[0], r.columns);
    },
    async all<T>(...args: Args): Promise<T[]> {
      const r = await exec(sql, args);
      return r.rows.map((row) => rowToObject<T>(row, r.columns));
    },
    async run(...args: Args): Promise<RunResult> {
      const r = await exec(sql, args);
      const lastInsertRowid =
        r.lastInsertRowid != null ? Number(r.lastInsertRowid) : 0;
      return { lastInsertRowid, changes: r.rowsAffected ?? 0 };
    },
  };
}

function makeDb(exec: Executor, execMany: ExecMany, txCapable: boolean): Db {
  const db: Db = {
    prepare(sql: string) {
      return makeStmt(exec, sql);
    },
    async exec(sql: string) {
      await execMany(sql);
    },
    async transaction<R>(fn: (inner: Db) => Promise<R>): Promise<R> {
      if (!txCapable) {
        // Already inside a transaction; reuse.
        return fn(db);
      }
      const tx = await getClient().transaction("write");
      try {
        const innerExec: Executor = async (sql, args) => {
          const r = await tx.execute({ sql, args });
          return {
            rows: r.rows as unknown[],
            columns: r.columns as string[],
            lastInsertRowid: r.lastInsertRowid,
            rowsAffected: r.rowsAffected,
          };
        };
        const innerExecMany: ExecMany = async (sql) => {
          for (const stmt of splitStatements(sql)) {
            await tx.execute(stmt);
          }
        };
        const innerDb = makeDb(innerExec, innerExecMany, false);
        const result = await fn(innerDb);
        await tx.commit();
        return result;
      } catch (e) {
        try {
          await tx.rollback();
        } catch {
          // ignore rollback errors
        }
        throw e;
      }
    },
  };
  return db;
}

// Split a multi-statement SQL string into individual statements. Honors
// single-quoted string literals so semicolons inside strings don't split
// the statement. We don't have block comments or other edge cases in our
// migration SQL, so this is sufficient.
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inSingle = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      buf += ch;
      if (inSingle && sql[i + 1] === "'") {
        // Escaped quote
        buf += sql[i + 1];
        i++;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (ch === ";" && !inSingle) {
      const s = buf.trim();
      if (s) out.push(s);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

const topLevelExec: Executor = async (sql, args) => {
  const r = await getClient().execute({ sql, args });
  return {
    rows: r.rows as unknown[],
    columns: r.columns as string[],
    lastInsertRowid: r.lastInsertRowid,
    rowsAffected: r.rowsAffected,
  };
};

const topLevelExecMany: ExecMany = async (sql) => {
  await getClient().executeMultiple(sql);
};

const _db: Db = makeDb(topLevelExec, topLevelExecMany, true);

// SQLite has no atomic "add column if not exists". Multiple Vercel function
// instances may race init(): both see "column missing", both try to ALTER,
// the second errors with "duplicate column name". Wrap each ALTER so a
// concurrent winner doesn't tear down init().
async function alterAddColumn(
  table: string,
  col: string,
  def: string,
  existing: { name: string }[]
): Promise<void> {
  if (existing.some((c) => c.name === col)) return;
  try {
    await _db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!/duplicate column/i.test(String((e as Error)?.message ?? e))) throw e;
  }
}

// Rebuilds a table to drop the legacy `CHECK (id = 1)` single-row constraint
// without touching its data. SQLite cannot drop a CHECK constraint in place,
// so we copy into a new table and rename. No-op if the constraint isn't
// present (fresh DBs already use AUTOINCREMENT).
async function rebuildDropIdCheck(table: string): Promise<void> {
  const row = await _db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get<{ sql: string }>(table);
  if (!row?.sql) return;
  if (!/CHECK\s*\(\s*id\s*=\s*1\s*\)/i.test(row.sql)) return;

  const tmp = `__rebuild_${table}`;
  const newSql = row.sql
    .replace(
      new RegExp(
        `^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["'\`]?${table}["'\`]?`,
        "i"
      ),
      `CREATE TABLE ${tmp}`
    )
    .replace(/CHECK\s*\(\s*id\s*=\s*1\s*\)\s*/gi, "");

  const cols = await _db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  const colNames = cols.map((c) => c.name).join(", ");

  await _db.exec(newSql);
  await _db.exec(
    `INSERT INTO ${tmp} (${colNames}) SELECT ${colNames} FROM ${table}`
  );
  await _db.exec(`DROP TABLE ${table}`);
  await _db.exec(`ALTER TABLE ${tmp} RENAME TO ${table}`);
}

async function init(): Promise<void> {
  // Pragmas. Best-effort — Turso ignores some, local file accepts both.
  try {
    await _db.prepare("PRAGMA foreign_keys = ON").run();
  } catch {
    // ignore
  }

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      price_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const jobsCols = (await _db
    .prepare("PRAGMA table_info(jobs)")
    .all<{ name: string }>());
  const jobAdds: [string, string][] = [
    ["salesperson_id", "INTEGER REFERENCES staff(id) ON DELETE SET NULL"],
    ["technician_id", "INTEGER REFERENCES staff(id) ON DELETE SET NULL"],
    ["end_time", "TEXT"],
    ["anytime", "INTEGER NOT NULL DEFAULT 0"],
    ["schedule_later", "INTEGER NOT NULL DEFAULT 0"],
    ["lead_source", "TEXT"],
    ["en_route_at", "TEXT"],
    ["arrived_at", "TEXT"],
    ["started_at", "TEXT"],
    ["completed_at", "TEXT"],
    ["recurring", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of jobAdds) {
    await alterAddColumn("jobs", col, def, jobsCols);
  }

  const staffCols = await _db
    .prepare("PRAGMA table_info(staff)")
    .all<{ name: string }>();
  const staffAdds: [string, string][] = [
    ["role", "TEXT"],
    ["first_name", "TEXT"],
    ["last_name", "TEXT"],
    ["phone", "TEXT"],
    ["email", "TEXT"],
    ["password_hash", "TEXT"],
    ["color", "TEXT NOT NULL DEFAULT 'blue'"],
    ["permission_level", "TEXT NOT NULL DEFAULT 'manager'"],
    ["photo_url", "TEXT"],
    ["updated_at", "TEXT"],
    ["sales_commission_rate", "REAL NOT NULL DEFAULT 0.30"],
    ["tech_commission_rate", "REAL NOT NULL DEFAULT 0.20"],
  ];
  for (const [col, def] of staffAdds) {
    await alterAddColumn("staff", col, def, staffCols);
  }
  await _db.exec(`
    UPDATE staff
    SET first_name = CASE
          WHEN INSTR(TRIM(name), ' ') > 0
            THEN SUBSTR(TRIM(name), 1, INSTR(TRIM(name), ' ') - 1)
          ELSE TRIM(name)
        END,
        last_name = CASE
          WHEN INSTR(TRIM(name), ' ') > 0
            THEN TRIM(SUBSTR(TRIM(name), INSTR(TRIM(name), ' ') + 1))
          ELSE ''
        END
    WHERE name IS NOT NULL
      AND (first_name IS NULL OR first_name = '')
  `);
  await _db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL`
  );

  const customerCols = await _db
    .prepare("PRAGMA table_info(customers)")
    .all<{ name: string }>();
  await alterAddColumn("customers", "first_name", "TEXT", customerCols);
  await alterAddColumn("customers", "last_name", "TEXT", customerCols);
  const customerAddressAdds: [string, string][] = [
    ["address_line1", "TEXT"],
    ["unit", "TEXT"],
    ["city", "TEXT"],
    ["state", "TEXT"],
    ["zip", "TEXT"],
    ["latitude", "REAL"],
    ["longitude", "REAL"],
    ["formatted_address", "TEXT"],
  ];
  for (const [col, def] of customerAddressAdds) {
    await alterAddColumn("customers", col, def, customerCols);
  }
  await alterAddColumn(
    "customers",
    "is_recurring",
    "INTEGER NOT NULL DEFAULT 0",
    customerCols
  );
  if (!customerCols.some((c) => c.name === "updated_at")) {
    await alterAddColumn("customers", "updated_at", "TEXT", customerCols);
    await _db.exec(
      "UPDATE customers SET updated_at = created_at WHERE updated_at IS NULL"
    );
  }
  await _db.exec(
    "CREATE INDEX IF NOT EXISTS idx_customers_lat_lng ON customers(latitude, longitude)"
  );

  const messageCols = await _db
    .prepare("PRAGMA table_info(messages)")
    .all<{ name: string }>();
  const messageAdds: [string, string][] = [
    ["status", "TEXT"],
    ["error", "TEXT"],
    ["provider_sid", "TEXT"],
    ["to_phone", "TEXT"],
    ["from_phone", "TEXT"],
  ];
  for (const [col, def] of messageAdds) {
    await alterAddColumn("messages", col, def, messageCols);
  }

  const messagingSettingsCols = await _db
    .prepare("PRAGMA table_info(messaging_settings)")
    .all<{ name: string }>();
  const messagingSettingsAdds: [string, string][] = [
    ["voice_api_key_sid", "TEXT"],
    ["voice_api_key_secret", "TEXT"],
    ["voice_twiml_app_sid", "TEXT"],
    ["voice_record_calls", "INTEGER NOT NULL DEFAULT 1"],
  ];
  for (const [col, def] of messagingSettingsAdds) {
    await alterAddColumn("messaging_settings", col, def, messagingSettingsCols);
  }

  const paymentCols = await _db
    .prepare("PRAGMA table_info(payments)")
    .all<{ name: string }>();
  if (paymentCols.length > 0) {
    await alterAddColumn(
      "payments",
      "tip_cents",
      "INTEGER NOT NULL DEFAULT 0",
      paymentCols
    );
    await alterAddColumn(
      "payments",
      "stripe_payment_intent_id",
      "TEXT",
      paymentCols
    );
  }

  const companyCols = await _db
    .prepare("PRAGMA table_info(company)")
    .all<{ name: string }>();
  const companyAdds: [string, string][] = [
    ["stripe_account_id", "TEXT"],
    ["stripe_charges_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["stripe_payouts_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["stripe_details_submitted", "INTEGER NOT NULL DEFAULT 0"],
    ["stripe_account_type", "TEXT"],
  ];
  for (const [col, def] of companyAdds) {
    await alterAddColumn("company", col, def, companyCols);
  }

  // invoices: stripe-payment columns + opaque pay-link token. Best-effort
  // because the table itself is created later in the same init() call —
  // PRAGMA on a missing table returns an empty list, in which case we
  // skip and rely on the column existing on the freshly-created table.
  const invoiceCols = await _db
    .prepare("PRAGMA table_info(invoices)")
    .all<{ name: string }>();
  if (invoiceCols.length > 0) {
    const invoiceAdds: [string, string][] = [
      ["stripe_pay_token", "TEXT"],
      ["stripe_checkout_session_id", "TEXT"],
      ["stripe_payment_intent_id", "TEXT"],
    ];
    for (const [col, def] of invoiceAdds) {
      await alterAddColumn("invoices", col, def, invoiceCols);
    }
    await _db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_pay_token
         ON invoices(stripe_pay_token)
         WHERE stripe_pay_token IS NOT NULL`
    );
  }

  await _db.exec(`
    UPDATE customers
    SET first_name = CASE
          WHEN INSTR(TRIM(name), ' ') > 0
            THEN SUBSTR(TRIM(name), 1, INSTR(TRIM(name), ' ') - 1)
          ELSE TRIM(name)
        END,
        last_name = CASE
          WHEN INSTR(TRIM(name), ' ') > 0
            THEN TRIM(SUBSTR(TRIM(name), INSTR(TRIM(name), ' ') + 1))
          ELSE ''
        END
    WHERE name IS NOT NULL
      AND (first_name IS NULL OR last_name IS NULL)
  `);
  await _db.exec(`
    UPDATE customers
    SET address_line1     = TRIM(address),
        formatted_address = TRIM(address)
    WHERE address IS NOT NULL
      AND TRIM(address) != ''
      AND address_line1     IS NULL
      AND formatted_address IS NULL
  `);

  await _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_salesperson_id ON jobs(salesperson_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_technician_id ON jobs(technician_id);

    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      price_cents INTEGER NOT NULL DEFAULT 0,
      taxable INTEGER NOT NULL DEFAULT 0,
      upsell INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_line_items_job_id ON line_items(job_id);

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_checklist_items_job_id ON checklist_items(job_id);

    CREATE TABLE IF NOT EXISTS job_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('sales', 'tech')),
      UNIQUE (job_id, staff_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_assignments_staff_id ON job_assignments(staff_id);

    CREATE TABLE IF NOT EXISTS map_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'not_home',
      objections TEXT,
      notes TEXT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_map_pins_status ON map_pins(status);
    CREATE INDEX IF NOT EXISTS idx_map_pins_created_at ON map_pins(created_at);
    CREATE INDEX IF NOT EXISTS idx_map_pins_customer_id ON map_pins(customer_id);

    CREATE TABLE IF NOT EXISTS territories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      polygon TEXT NOT NULL,
      assigned_employee_ids TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      phone TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO company (id, name, address, phone) VALUES (1, NULL, NULL, NULL);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

    CREATE TABLE IF NOT EXISTS messaging_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'twilio',
      account_sid TEXT,
      auth_token TEXT,
      from_number TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO messaging_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      twilio_call_sid TEXT,
      direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
      status TEXT NOT NULL DEFAULT 'queued',
      from_phone TEXT,
      to_phone TEXT,
      duration_seconds INTEGER,
      recording_sid TEXT,
      recording_url TEXT,
      recording_duration_seconds INTEGER,
      started_at TEXT,
      answered_at TEXT,
      ended_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_calls_customer_id ON calls(customer_id);
    CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;

    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'resend',
      api_key TEXT,
      from_address TEXT,
      from_name TEXT,
      reply_to TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO email_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'anthropic',
      api_key TEXT,
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      company_voice TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO ai_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS email_blasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audience TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      from_address TEXT,
      from_name TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_blasts_created_at ON email_blasts(created_at);

    CREATE TABLE IF NOT EXISTS email_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blast_id INTEGER NOT NULL REFERENCES email_blasts(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_id TEXT,
      error TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_recipients_blast ON email_recipients(blast_id);
    CREATE INDEX IF NOT EXISTS idx_email_recipients_email ON email_recipients(email);

    CREATE TABLE IF NOT EXISTS email_unsubscribes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      reason TEXT,
      source TEXT,
      unsubscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON email_unsubscribes(email);

    CREATE TABLE IF NOT EXISTS email_automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('welcome','seasonal')),
      season TEXT,
      name TEXT NOT NULL,
      description TEXT,
      audience TEXT NOT NULL DEFAULT 'all_customers',
      subject TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      send_month INTEGER,
      send_day INTEGER,
      enabled INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT,
      last_sent_year INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_automations_kind ON email_automations(kind);

    INSERT OR IGNORE INTO email_automations
      (key, kind, season, name, description, audience, subject, body_html, send_month, send_day)
    VALUES
      ('welcome', 'welcome', NULL,
       'Welcome email',
       'Sent automatically the first time a customer with an email is added.',
       'all_customers',
       'Welcome — thanks for choosing us',
       '<p>Hi there,</p><p>Thanks for choosing us. We''re glad to have you, and we''ll be in touch soon to confirm your service.</p><p>If you have any questions, just reply to this email.</p>',
       NULL, NULL),
      ('spring_blast', 'seasonal', 'spring',
       'Spring blast',
       'Goes out once each spring — a seasonal reminder, service kickoff, or discount.',
       'all_customers',
       'Spring is here — book your seasonal service',
       '<p>Spring is here!</p><p>Now''s the perfect time to schedule your seasonal service. Reply to this email or give us a call to get on the schedule.</p>',
       3, 21),
      ('summer_blast', 'seasonal', 'summer',
       'Summer blast',
       'Goes out once each summer.',
       'all_customers',
       'Summer special — book now',
       '<p>Summer''s in full swing.</p><p>We''re running a seasonal special this month — reach out to take advantage before it ends.</p>',
       6, 21),
      ('fall_blast', 'seasonal', 'fall',
       'Fall blast',
       'Goes out once each fall.',
       'all_customers',
       'Fall reminder — get ready for the season',
       '<p>Fall is here.</p><p>Time to wrap up the year''s service and get ready for what''s next. Reply to schedule.</p>',
       9, 21),
      ('winter_blast', 'seasonal', 'winter',
       'Winter blast',
       'Goes out once each winter.',
       'all_customers',
       'Winter check-in',
       '<p>Hi,</p><p>Just checking in for the winter season. Let us know if there''s anything we can help with.</p>',
       12, 21);

    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      tip_cents    INTEGER NOT NULL DEFAULT 0,
      method       TEXT    NOT NULL CHECK (method IN ('card','cash','check','e_transfer','other')),
      payment_date TEXT    NOT NULL,
      notes        TEXT,
      send_email   INTEGER NOT NULL DEFAULT 0,
      send_sms     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_job_id     ON payments(job_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

    CREATE TABLE IF NOT EXISTS subscription_terms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      body        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_templates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      description  TEXT,
      price_cents  INTEGER NOT NULL DEFAULT 0,
      interval     TEXT    NOT NULL DEFAULT 'monthly'
                    CHECK (interval IN ('weekly','biweekly','monthly','quarterly','yearly')),
      active       INTEGER NOT NULL DEFAULT 1,
      terms_id     INTEGER REFERENCES subscription_terms(id) ON DELETE SET NULL,
      require_signature INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subscription_templates_active
      ON subscription_templates(active);

    CREATE TABLE IF NOT EXISTS customer_subscriptions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      template_id  INTEGER REFERENCES subscription_templates(id) ON DELETE SET NULL,
      name         TEXT    NOT NULL,
      description  TEXT,
      price_cents  INTEGER NOT NULL DEFAULT 0,
      interval     TEXT    NOT NULL DEFAULT 'monthly'
                    CHECK (interval IN ('weekly','biweekly','monthly','quarterly','yearly')),
      status       TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','declined','canceled')),
      sent_at      TEXT,
      accepted_at  TEXT,
      canceled_at  TEXT,
      created_by   TEXT,
      terms_snapshot TEXT,
      require_signature INTEGER NOT NULL DEFAULT 0,
      signature_data TEXT,
      signature_name TEXT,
      signed_at    TEXT,
      start_date   TEXT,
      sold_by_id   INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer
      ON customer_subscriptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_template
      ON customer_subscriptions(template_id);
    CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status
      ON customer_subscriptions(status);

    CREATE TABLE IF NOT EXISTS estimates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      title          TEXT,
      notes          TEXT,
      status         TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','accepted','declined','expired','canceled')),
      total_cents    INTEGER NOT NULL DEFAULT 0,
      tax_rate_bps   INTEGER NOT NULL DEFAULT 0,
      valid_until    TEXT,
      sent_at        TEXT,
      accepted_at    TEXT,
      declined_at    TEXT,
      signature_data TEXT,
      signature_name TEXT,
      signed_at      TEXT,
      sold_by_id     INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      created_by     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);

    CREATE TABLE IF NOT EXISTS estimate_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      estimate_id  INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      description  TEXT,
      quantity     REAL NOT NULL DEFAULT 1,
      price_cents  INTEGER NOT NULL DEFAULT 0,
      taxable      INTEGER NOT NULL DEFAULT 0,
      position     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate
      ON estimate_items(estimate_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      job_id         INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      title          TEXT,
      notes          TEXT,
      status         TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','partial','paid','overdue','void')),
      total_cents    INTEGER NOT NULL DEFAULT 0,
      paid_cents     INTEGER NOT NULL DEFAULT 0,
      tax_rate_bps   INTEGER NOT NULL DEFAULT 0,
      due_date       TEXT,
      sent_at        TEXT,
      paid_at        TEXT,
      voided_at      TEXT,
      sold_by_id     INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      created_by     TEXT,
      stripe_pay_token             TEXT,
      stripe_checkout_session_id   TEXT,
      stripe_payment_intent_id     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_pay_token
      ON invoices(stripe_pay_token)
      WHERE stripe_pay_token IS NOT NULL;

    CREATE TABLE IF NOT EXISTS invoice_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      description  TEXT,
      quantity     REAL NOT NULL DEFAULT 1,
      price_cents  INTEGER NOT NULL DEFAULT 0,
      taxable      INTEGER NOT NULL DEFAULT 0,
      position     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
      ON invoice_items(invoice_id);

    CREATE TABLE IF NOT EXISTS leads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name      TEXT,
      last_name       TEXT,
      email           TEXT,
      phone           TEXT,
      address         TEXT,
      source          TEXT NOT NULL DEFAULT 'manual',
      source_page_id  TEXT,
      source_page_name TEXT,
      source_form_id  TEXT,
      source_form_name TEXT,
      meta_lead_id    TEXT,
      raw_payload     TEXT,
      stage           TEXT NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','contacted','responded','estimate_sent')),
      position        INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      contacted_at    TEXT,
      responded_at    TEXT,
      estimate_sent_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_meta_lead_id
      ON leads(meta_lead_id) WHERE meta_lead_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS lead_workflows (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      trigger      TEXT NOT NULL DEFAULT 'lead_created',
      max_per_day  INTEGER NOT NULL DEFAULT 3,
      enabled      INTEGER NOT NULL DEFAULT 0,
      steps        TEXT NOT NULL DEFAULT '[]',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lead_workflow_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id  INTEGER NOT NULL REFERENCES lead_workflows(id) ON DELETE CASCADE,
      lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      step_index   INTEGER NOT NULL DEFAULT 0,
      last_step_at TEXT,
      error        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lwr_workflow ON lead_workflow_runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_lwr_lead ON lead_workflow_runs(lead_id);

    CREATE TABLE IF NOT EXISTS lead_forms (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      slug         TEXT NOT NULL UNIQUE,
      fields       TEXT NOT NULL DEFAULT '[]',
      enabled      INTEGER NOT NULL DEFAULT 1,
      submit_count INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meta_integration (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT,
      user_name       TEXT,
      access_token    TEXT,
      token_expires_at TEXT,
      connected_at    TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO meta_integration (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS meta_pages (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id           TEXT NOT NULL UNIQUE,
      page_name         TEXT NOT NULL,
      page_access_token TEXT,
      enabled           INTEGER NOT NULL DEFAULT 1,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO lead_workflows (id, name, trigger, max_per_day, enabled, steps)
    VALUES
      (1, 'Missed Call Text-Back', 'lead_created', 3, 0, '[]'),
      (2, 'CRACKED lead follow-up sequence', 'lead_created', 3, 0, '[]'),
      (3, 'Contact fresh leads', 'lead_created', 3, 0, '[]');

    CREATE TABLE IF NOT EXISTS sprints (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      description  TEXT,
      view         TEXT    NOT NULL CHECK (view IN ('sales', 'tech')),
      start_at     TEXT    NOT NULL,
      end_at       TEXT    NOT NULL,
      created_by   TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sprints_view_end ON sprints(view, end_at);

    CREATE TABLE IF NOT EXISTS sprint_prizes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id  INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
      place      INTEGER NOT NULL,
      title      TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_sprint_prizes_sprint ON sprint_prizes(sprint_id);

    CREATE TABLE IF NOT EXISTS payroll_payouts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id     INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      role         TEXT    NOT NULL CHECK (role IN ('sales','tech')),
      period_start TEXT    NOT NULL,
      period_end   TEXT    NOT NULL,
      paid_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (staff_id, role, period_start, period_end)
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_payouts_period
      ON payroll_payouts(period_start, period_end);

    CREATE TABLE IF NOT EXISTS payroll_settings (
      id                              INTEGER PRIMARY KEY CHECK (id = 1),
      pay_period_frequency            TEXT NOT NULL DEFAULT 'monthly'
                                        CHECK (pay_period_frequency IN
                                          ('weekly','biweekly','semimonthly','monthly')),
      hourly_time_calculation         TEXT NOT NULL DEFAULT 'scheduled'
                                        CHECK (hourly_time_calculation IN
                                          ('scheduled','en_route_to_complete','start_to_complete')),
      hourly_bonus_enabled            INTEGER NOT NULL DEFAULT 0,
      hourly_bonus_threshold_cents    INTEGER NOT NULL DEFAULT 0,
      hourly_bonus_amount_cents       INTEGER NOT NULL DEFAULT 0,
      sales_commission_mode           TEXT NOT NULL DEFAULT 'flat'
                                        CHECK (sales_commission_mode IN ('flat','tiers')),
      sales_commission_flat_rate      REAL NOT NULL DEFAULT 0.30,
      sales_commission_tiers          TEXT NOT NULL DEFAULT '[]',
      tech_commission_mode            TEXT NOT NULL DEFAULT 'flat'
                                        CHECK (tech_commission_mode IN ('flat','tiers')),
      tech_commission_flat_rate       REAL NOT NULL DEFAULT 0.20,
      tech_commission_tiers           TEXT NOT NULL DEFAULT '[]',
      sales_overrides_enabled         INTEGER NOT NULL DEFAULT 0,
      sales_overrides_rate            REAL NOT NULL DEFAULT 0.05,
      tech_overrides_enabled          INTEGER NOT NULL DEFAULT 0,
      tech_overrides_rate             REAL NOT NULL DEFAULT 0.05,
      plan_sale_bonuses_enabled       INTEGER NOT NULL DEFAULT 0,
      plan_sale_bonus_cents           INTEGER NOT NULL DEFAULT 0,
      exclude_one_time_services       INTEGER NOT NULL DEFAULT 0,
      updated_at                      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO payroll_settings (id) VALUES (1);
  `);

  const tplCols = await _db
    .prepare("PRAGMA table_info(subscription_templates)")
    .all<{ name: string }>();
  const tplAdds: [string, string][] = [
    ["terms_id", "INTEGER REFERENCES subscription_terms(id) ON DELETE SET NULL"],
    ["require_signature", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of tplAdds) {
    await alterAddColumn("subscription_templates", col, def, tplCols);
  }

  const subCols = await _db
    .prepare("PRAGMA table_info(customer_subscriptions)")
    .all<{ name: string }>();
  const subAdds: [string, string][] = [
    ["terms_snapshot", "TEXT"],
    ["require_signature", "INTEGER NOT NULL DEFAULT 0"],
    ["signature_data", "TEXT"],
    ["signature_name", "TEXT"],
    ["signed_at", "TEXT"],
    ["start_date", "TEXT"],
    ["sold_by_id", "INTEGER REFERENCES staff(id) ON DELETE SET NULL"],
  ];
  for (const [col, def] of subAdds) {
    await alterAddColumn("customer_subscriptions", col, def, subCols);
  }

  const legacy = await _db
    .prepare(
      `SELECT j.id, j.salesperson_id, j.technician_id, j.scheduled_at, j.duration_minutes, j.end_time
       FROM jobs j`
    )
    .all<{
      id: number;
      salesperson_id: number | null;
      technician_id: number | null;
      scheduled_at: string;
      duration_minutes: number;
      end_time: string | null;
    }>();

  for (const j of legacy) {
    if (j.salesperson_id) {
      await _db
        .prepare(
          `INSERT OR IGNORE INTO job_assignments (job_id, staff_id, role) VALUES (?, ?, ?)`
        )
        .run(j.id, j.salesperson_id, "sales");
    }
    if (j.technician_id) {
      await _db
        .prepare(
          `INSERT OR IGNORE INTO job_assignments (job_id, staff_id, role) VALUES (?, ?, ?)`
        )
        .run(j.id, j.technician_id, "tech");
    }
    if (!j.end_time) {
      const end = new Date(
        new Date(j.scheduled_at).getTime() + (j.duration_minutes || 60) * 60_000
      );
      await _db
        .prepare(`UPDATE jobs SET end_time = ? WHERE id = ?`)
        .run(end.toISOString(), j.id);
    }
  }

  // Multi-tenancy migration. Drops the legacy single-row CHECK on the
  // company + settings tables, then adds a company_id FK to every
  // tenant-owned table and backfills all existing rows to the legacy
  // tenant (company.id = 1). Child tables (line_items, invoice_items,
  // estimate_items, sprint_prizes, etc.) inherit scope through their
  // parent FK, so they don't need a column of their own.
  for (const t of [
    "company",
    "messaging_settings",
    "email_settings",
    "ai_settings",
    "meta_integration",
  ]) {
    await rebuildDropIdCheck(t);
  }

  const companyScopedTables = [
    "customers",
    "jobs",
    "staff",
    "messages",
    "messaging_settings",
    "email_settings",
    "ai_settings",
    "meta_integration",
    "meta_pages",
    "calls",
    "payments",
    "subscription_terms",
    "subscription_templates",
    "customer_subscriptions",
    "estimates",
    "invoices",
    "map_pins",
    "territories",
    "email_blasts",
    "email_unsubscribes",
    "email_automations",
    "leads",
    "lead_workflows",
    "lead_forms",
    "sprints",
    "payroll_payouts",
  ];

  for (const table of companyScopedTables) {
    const cols = await _db
      .prepare(`PRAGMA table_info(${table})`)
      .all<{ name: string }>();
    if (cols.length === 0) continue;
    await alterAddColumn(
      table,
      "company_id",
      "INTEGER REFERENCES company(id) ON DELETE CASCADE",
      cols
    );
    await _db.exec(
      `UPDATE ${table} SET company_id = 1 WHERE company_id IS NULL`
    );
    await _db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${table}_company_id ON ${table}(company_id)`
    );
  }
}

export async function getDb(): Promise<Db> {
  if (!_initPromise) {
    _initPromise = init().catch((e) => {
      // A rejected init() promise sticks for the entire Lambda lifetime, so
      // every subsequent request would fail. Clear it on failure so the next
      // caller retries with a fresh init().
      _initPromise = null;
      throw e;
    });
  }
  await _initPromise;
  return _db;
}

export type Customer = {
  id: number;
  company_id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_line1: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  notes: string | null;
  is_recurring: number;
  created_at: string;
  updated_at: string | null;
};

export type PermissionLevel =
  | "admin"
  | "manager"
  | "team_lead"
  | "salesperson_all"
  | "salesperson_own"
  | "field_tech"
  | "custom";

export type Staff = {
  id: number;
  company_id: number;
  name: string;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  password_hash: string | null;
  color: string;
  permission_level: PermissionLevel;
  photo_url: string | null;
  sales_commission_rate: number;
  tech_commission_rate: number;
  created_at: string;
  updated_at: string | null;
};

export type Job = {
  id: number;
  company_id: number;
  customer_id: number;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: string;
  notes: string | null;
  salesperson_id: number | null;
  technician_id: number | null;
  end_time: string | null;
  anytime: number;
  schedule_later: number;
  lead_source: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  recurring: number;
  created_at: string;
};

export type LineItem = {
  id: number;
  job_id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
  taxable: number;
  upsell: number;
  position: number;
  created_at: string;
};

export type ChecklistItem = {
  id: number;
  job_id: number;
  text: string;
  completed: number;
  position: number;
};

export type JobAssignment = {
  id: number;
  job_id: number;
  staff_id: number;
  role: "sales" | "tech";
};

export type JobWithCustomer = Job & {
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

export type MapPin = {
  id: number;
  company_id: number;
  lat: number;
  lng: number;
  address: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
  objections: string | null;
  notes: string | null;
  customer_id: number | null;
  created_by: string | null;
  created_at: string;
};

export type Territory = {
  id: number;
  company_id: number;
  name: string;
  color: string;
  polygon: string;
  assigned_employee_ids: string | null;
  created_by: string | null;
  created_at: string;
};

export type Company = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  updated_at: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: number;
  stripe_payouts_enabled: number;
  stripe_details_submitted: number;
  stripe_account_type: "express" | "standard" | null;
};

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received"
  | "not_configured";

export type Message = {
  id: number;
  company_id: number;
  customer_id: number;
  body: string;
  direction: "outbound" | "inbound";
  created_at: string;
  read_at: string | null;
  status: MessageStatus | null;
  error: string | null;
  provider_sid: string | null;
  to_phone: string | null;
  from_phone: string | null;
};

export type MessagingSettings = {
  id: number;
  company_id: number;
  provider: string;
  account_sid: string | null;
  auth_token: string | null;
  from_number: string | null;
  voice_api_key_sid: string | null;
  voice_api_key_secret: string | null;
  voice_twiml_app_sid: string | null;
  voice_record_calls: number;
  updated_at: string;
};

export type CallDirection = "outbound" | "inbound";

export type Call = {
  id: number;
  company_id: number;
  customer_id: number | null;
  twilio_call_sid: string | null;
  direction: CallDirection;
  status: string;
  from_phone: string | null;
  to_phone: string | null;
  duration_seconds: number | null;
  recording_sid: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};

export type EmailSettings = {
  id: number;
  company_id: number;
  provider: string;
  api_key: string | null;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  updated_at: string;
};

export type AiSettings = {
  id: number;
  company_id: number;
  provider: string;
  api_key: string | null;
  model: string;
  company_voice: string | null;
  updated_at: string;
};

export type EmailAudience =
  | "all_customers"
  | "active_subscribers"
  | "non_subscribers"
  | "prospects";

export type EmailBlast = {
  id: number;
  company_id: number;
  audience: EmailAudience | string;
  subject: string;
  body_html: string;
  body_text: string | null;
  from_address: string | null;
  from_name: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
};

export type EmailRecipient = {
  id: number;
  blast_id: number;
  customer_id: number | null;
  email: string;
  name: string | null;
  status: string;
  provider_id: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

export type EmailUnsubscribe = {
  id: number;
  company_id: number;
  email: string;
  reason: string | null;
  source: string | null;
  unsubscribed_at: string;
};

export type EmailAutomationKind = "welcome" | "seasonal";
export type EmailSeason = "spring" | "summer" | "fall" | "winter";

export type EmailAutomation = {
  id: number;
  company_id: number;
  key: string;
  kind: EmailAutomationKind;
  season: EmailSeason | null;
  name: string;
  description: string | null;
  audience: EmailAudience | string;
  subject: string;
  body_html: string;
  send_month: number | null;
  send_day: number | null;
  enabled: number;
  last_sent_at: string | null;
  last_sent_year: number | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type SubscriptionTerms = {
  id: number;
  company_id: number;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionTemplate = {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  price_cents: number;
  interval: SubscriptionInterval;
  active: number;
  terms_id: number | null;
  require_signature: number;
  created_at: string;
  updated_at: string;
};

export type CustomerSubscriptionStatus =
  | "pending"
  | "active"
  | "declined"
  | "canceled";

export type CustomerSubscription = {
  id: number;
  company_id: number;
  customer_id: number;
  template_id: number | null;
  name: string;
  description: string | null;
  price_cents: number;
  interval: SubscriptionInterval;
  status: CustomerSubscriptionStatus;
  sent_at: string | null;
  accepted_at: string | null;
  canceled_at: string | null;
  created_by: string | null;
  terms_snapshot: string | null;
  require_signature: number;
  signature_data: string | null;
  signature_name: string | null;
  signed_at: string | null;
  start_date: string | null;
  sold_by_id: number | null;
  created_at: string;
};

export type EstimateStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "canceled";

export type Estimate = {
  id: number;
  company_id: number;
  customer_id: number;
  title: string | null;
  notes: string | null;
  status: EstimateStatus;
  total_cents: number;
  tax_rate_bps: number;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  signature_data: string | null;
  signature_name: string | null;
  signed_at: string | null;
  sold_by_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EstimateItem = {
  id: number;
  estimate_id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
  taxable: number;
  position: number;
};

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "void";

export type Invoice = {
  id: number;
  company_id: number;
  customer_id: number;
  job_id: number | null;
  title: string | null;
  notes: string | null;
  status: InvoiceStatus;
  total_cents: number;
  paid_cents: number;
  tax_rate_bps: number;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  sold_by_id: number | null;
  created_by: string | null;
  stripe_pay_token: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
  taxable: number;
  position: number;
};

export type LeadStage = "new" | "contacted" | "responded" | "estimate_sent";

export type Lead = {
  id: number;
  company_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  source: string;
  source_page_id: string | null;
  source_page_name: string | null;
  source_form_id: string | null;
  source_form_name: string | null;
  meta_lead_id: string | null;
  raw_payload: string | null;
  stage: LeadStage;
  position: number;
  notes: string | null;
  customer_id: number | null;
  contacted_at: string | null;
  responded_at: string | null;
  estimate_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadWorkflow = {
  id: number;
  company_id: number;
  name: string;
  trigger: string;
  max_per_day: number;
  enabled: number;
  steps: string;
  created_at: string;
  updated_at: string;
};

export type LeadWorkflowRun = {
  id: number;
  workflow_id: number;
  lead_id: number;
  status: string;
  step_index: number;
  last_step_at: string | null;
  error: string | null;
  created_at: string;
};

export type LeadForm = {
  id: number;
  company_id: number;
  name: string;
  slug: string;
  fields: string;
  enabled: number;
  submit_count: number;
  created_at: string;
  updated_at: string;
};

export type MetaIntegration = {
  id: number;
  company_id: number;
  user_id: string | null;
  user_name: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  updated_at: string;
};

export type MetaPage = {
  id: number;
  company_id: number;
  page_id: string;
  page_name: string;
  page_access_token: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod =
  | "card"
  | "cash"
  | "check"
  | "e_transfer"
  | "other";

export type Sprint = {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  view: "sales" | "tech";
  start_at: string;
  end_at: string;
  created_by: string | null;
  created_at: string;
};

export type SprintPrize = {
  id: number;
  sprint_id: number;
  place: number;
  title: string;
};

export type Payment = {
  id: number;
  company_id: number;
  job_id: number;
  amount_cents: number;
  tip_cents: number;
  method: PaymentMethod;
  payment_date: string;
  notes: string | null;
  send_email: number;
  send_sms: number;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

export type PayPeriodFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export type HourlyTimeCalculation =
  | "scheduled"
  | "en_route_to_complete"
  | "start_to_complete";

export type CommissionMode = "flat" | "tiers";

export type CommissionTier = {
  threshold_cents: number;
  rate: number;
};

export type PayrollSettings = {
  id: number;
  pay_period_frequency: PayPeriodFrequency;
  hourly_time_calculation: HourlyTimeCalculation;
  hourly_bonus_enabled: number;
  hourly_bonus_threshold_cents: number;
  hourly_bonus_amount_cents: number;
  sales_commission_mode: CommissionMode;
  sales_commission_flat_rate: number;
  sales_commission_tiers: string;
  tech_commission_mode: CommissionMode;
  tech_commission_flat_rate: number;
  tech_commission_tiers: string;
  sales_overrides_enabled: number;
  sales_overrides_rate: number;
  tech_overrides_enabled: number;
  tech_overrides_rate: number;
  plan_sale_bonuses_enabled: number;
  plan_sale_bonus_cents: number;
  exclude_one_time_services: number;
  updated_at: string;
};

export default getDb;
