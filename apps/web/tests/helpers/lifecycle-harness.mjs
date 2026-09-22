import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
let activeDb;
export async function getDb() { return activeDb; }
export async function requireCompanyId() { return 1; }
export const sends = [];
export async function sendAndLogCompanySms(input) { sends.push(input); return { ok: true, messageId: 88, status: "queued", error: null }; }
export async function loadRealLifecycleSmsSender() {
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/db") return { url: import.meta.url, shortCircuit: true };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  } });
  try { return (await import("../../src/lib/sms.ts")).sendAndLogCompanySms; }
  finally { hooks.deregister(); }
}
export async function loadLifecycleRoute(path) {
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (["@/lib/db", "@/lib/auth", "@/lib/sms"].includes(specifier)) return { url: import.meta.url, shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier === "./lib/widget-http") return nextResolve(new URL("../../src/lib/widget-http.ts", import.meta.url).href, context);
    if (specifier === "./lib/forge-billing/config") return nextResolve(new URL("../../src/lib/forge-billing/config.ts", import.meta.url).href, context);
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  } });
  try { return path === "middleware" ? await import("../../src/middleware.ts") : await import(`../../src/app/api/${path}/route.ts`); }
  finally { hooks.deregister(); }
}

export function installLifecycleSchema(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS company (id INTEGER PRIMARY KEY, name TEXT, time_zone TEXT NOT NULL DEFAULT 'America/New_York', address TEXT, phone TEXT, email TEXT, website TEXT, logo_url TEXT, updated_at TEXT);
    INSERT OR IGNORE INTO company(id,name) VALUES (1,'Summit'), (2,'Other company');
    CREATE TABLE IF NOT EXISTS estimates (company_id INTEGER, customer_id INTEGER, sms_transactional_consent INTEGER);
    CREATE TABLE IF NOT EXISTS customization_settings (company_id INTEGER, config TEXT);
    CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT);
    CREATE TABLE IF NOT EXISTS job_assignments (job_id INTEGER, staff_id INTEGER, role TEXT);
    CREATE TABLE IF NOT EXISTS job_lifecycle_notifications (
      id INTEGER PRIMARY KEY, company_id INTEGER, job_id INTEGER, step TEXT,
      outcome TEXT NOT NULL DEFAULT 'pending', customer_id INTEGER, body TEXT,
      message_id INTEGER, error TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
      locked_at TEXT, last_attempt_at TEXT, retry_requested_at TEXT, retry_requested_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(job_id,step));
  `);
}

export function lifecycleDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  installLifecycleSchema(sqlite);
  sqlite.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT);
    INSERT INTO customers VALUES (90,1,'Ada Lovelace');
    CREATE TABLE jobs (id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      scheduled_at TEXT, price_cents INTEGER, status TEXT DEFAULT 'scheduled',
      completed_at TEXT, started_at TEXT, arrived_at TEXT, en_route_at TEXT);
    INSERT INTO jobs(id,company_id,customer_id,scheduled_at,price_cents) VALUES (12,1,90,'2026-08-24T15:00:00.000Z',5000);
    INSERT INTO estimates VALUES (1,90,1);
  `);
  let chain = Promise.resolve();
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        get: async (...args) => stmt.get(...args),
        all: async (...args) => stmt.all(...args),
        run: async (...args) => { const result = stmt.run(...args); return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) }; },
      };
    },
    exec: async sql => sqlite.exec(sql),
    transaction(fn) {
      const result = chain.then(async () => {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn({ ...db, transaction: async nested => nested(db) });
          sqlite.exec('COMMIT');
          return result;
        } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      });
      chain = result.catch(() => {});
      return result;
    },
  };
  activeDb = db;
  sends.length = 0;
  return { sqlite, db, close: () => sqlite.close() };
}
