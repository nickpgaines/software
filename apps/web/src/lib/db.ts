import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let _db: Database.Database | null = null;

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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

  const jobsCols = db
    .prepare("PRAGMA table_info(jobs)")
    .all() as { name: string }[];
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
      db.exec(`ALTER TABLE jobs ADD COLUMN ${col} ${def}`);
    }
  }

  const staffCols = db
    .prepare("PRAGMA table_info(staff)")
    .all() as { name: string }[];
  if (!staffCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE staff ADD COLUMN role TEXT");
  }

  const customerCols = db
    .prepare("PRAGMA table_info(customers)")
    .all() as { name: string }[];
  if (!customerCols.some((c) => c.name === "first_name")) {
    db.exec("ALTER TABLE customers ADD COLUMN first_name TEXT");
  }
  if (!customerCols.some((c) => c.name === "last_name")) {
    db.exec("ALTER TABLE customers ADD COLUMN last_name TEXT");
  }
  // Backfill first_name/last_name from existing 'name' for any rows
  // that haven't been migrated yet. Single-word names go entirely
  // into first_name; multi-word names split on the first space.
  db.exec(`
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

  db.exec(`
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
  `);

  const legacy = db
    .prepare(
      `SELECT j.id, j.salesperson_id, j.technician_id, j.scheduled_at, j.duration_minutes, j.end_time
       FROM jobs j`
    )
    .all() as {
    id: number;
    salesperson_id: number | null;
    technician_id: number | null;
    scheduled_at: string;
    duration_minutes: number;
    end_time: string | null;
  }[];

  const insertAssign = db.prepare(
    `INSERT OR IGNORE INTO job_assignments (job_id, staff_id, role) VALUES (?, ?, ?)`
  );
  const setEndTime = db.prepare(`UPDATE jobs SET end_time = ? WHERE id = ?`);
  for (const j of legacy) {
    if (j.salesperson_id) insertAssign.run(j.id, j.salesperson_id, "sales");
    if (j.technician_id) insertAssign.run(j.id, j.technician_id, "tech");
    if (!j.end_time) {
      const end = new Date(
        new Date(j.scheduled_at).getTime() + (j.duration_minutes || 60) * 60_000
      );
      setEndTime.run(end.toISOString(), j.id);
    }
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "crm.db"), { timeout: 5000 });
  init(db);
  _db = db;
  return db;
}

export type Customer = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type Staff = {
  id: number;
  name: string;
  role: string | null;
  created_at: string;
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
};

export type Message = {
  id: number;
  customer_id: number;
  body: string;
  direction: "outbound" | "inbound";
  created_at: string;
  read_at: string | null;
};

export default getDb;
