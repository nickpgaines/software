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
    if (!jobsCols.some((c) => c.name === col)) {
      await _db.exec(`ALTER TABLE jobs ADD COLUMN ${col} ${def}`);
    }
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
  ];
  for (const [col, def] of staffAdds) {
    if (!staffCols.some((c) => c.name === col)) {
      await _db.exec(`ALTER TABLE staff ADD COLUMN ${col} ${def}`);
    }
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
  if (!customerCols.some((c) => c.name === "first_name")) {
    await _db.exec("ALTER TABLE customers ADD COLUMN first_name TEXT");
  }
  if (!customerCols.some((c) => c.name === "last_name")) {
    await _db.exec("ALTER TABLE customers ADD COLUMN last_name TEXT");
  }
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
    if (!customerCols.some((c) => c.name === col)) {
      await _db.exec(`ALTER TABLE customers ADD COLUMN ${col} ${def}`);
    }
  }
  if (!customerCols.some((c) => c.name === "is_recurring")) {
    await _db.exec(
      "ALTER TABLE customers ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!customerCols.some((c) => c.name === "updated_at")) {
    await _db.exec("ALTER TABLE customers ADD COLUMN updated_at TEXT");
    await _db.exec(
      "UPDATE customers SET updated_at = created_at WHERE updated_at IS NULL"
    );
  }
  await _db.exec(
    "CREATE INDEX IF NOT EXISTS idx_customers_lat_lng ON customers(latitude, longitude)"
  );

  const paymentCols = await _db
    .prepare("PRAGMA table_info(payments)")
    .all<{ name: string }>();
  if (
    paymentCols.length > 0 &&
    !paymentCols.some((c) => c.name === "tip_cents")
  ) {
    await _db.exec(
      "ALTER TABLE payments ADD COLUMN tip_cents INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (
    paymentCols.length > 0 &&
    !paymentCols.some((c) => c.name === "stripe_payment_intent_id")
  ) {
    await _db.exec(
      "ALTER TABLE payments ADD COLUMN stripe_payment_intent_id TEXT"
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
  ];
  for (const [col, def] of companyAdds) {
    if (!companyCols.some((c) => c.name === col)) {
      await _db.exec(`ALTER TABLE company ADD COLUMN ${col} ${def}`);
    }
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
      id INTEGER PRIMARY KEY CHECK (id = 1),
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
  `);

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
}

export async function getDb(): Promise<Db> {
  if (!_initPromise) _initPromise = init();
  await _initPromise;
  return _db;
}

export type Customer = {
  id: number;
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
  created_at: string;
  updated_at: string | null;
};

export type Job = {
  id: number;
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
};

export type Message = {
  id: number;
  customer_id: number;
  body: string;
  direction: "outbound" | "inbound";
  created_at: string;
  read_at: string | null;
};

export type PaymentMethod =
  | "card"
  | "cash"
  | "check"
  | "e_transfer"
  | "other";

export type Payment = {
  id: number;
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

export default getDb;
