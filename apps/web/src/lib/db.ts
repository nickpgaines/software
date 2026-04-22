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
  if (!jobsCols.some((c) => c.name === "salesperson_id")) {
    db.exec(
      "ALTER TABLE jobs ADD COLUMN salesperson_id INTEGER REFERENCES staff(id) ON DELETE SET NULL"
    );
  }
  if (!jobsCols.some((c) => c.name === "technician_id")) {
    db.exec(
      "ALTER TABLE jobs ADD COLUMN technician_id INTEGER REFERENCES staff(id) ON DELETE SET NULL"
    );
  }

  const staffCols = db
    .prepare("PRAGMA table_info(staff)")
    .all() as { name: string }[];
  if (!staffCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE staff ADD COLUMN role TEXT");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_salesperson_id ON jobs(salesperson_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_technician_id ON jobs(technician_id);
  `);
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
  created_at: string;
};

export type JobWithCustomer = Job & {
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

export default getDb;
