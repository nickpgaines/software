#!/usr/bin/env node
// One-time tenant data cleanup.
//
// Reassigns rows from one company_id (the "from" tenant) to another
// (the "to" tenant), for every company-scoped data table. Skips per-tenant
// settings rows (messaging_settings, email_settings, ai_settings,
// meta_integration, payroll_settings, email_automations defaults,
// lead_workflows defaults) and the staff table — those should stay with
// the company they were created under.
//
// Use case: an Ocean Bay account was created after the multi-tenancy
// migration, but legacy data was already attached to the original tenant.
// The new account showed cross-tenant rows because two API endpoints
// weren't filtering by company_id (now fixed). After that fix some rows
// may have been written to the wrong tenant; this script moves them.
//
// Usage:
//   cd apps/web
//   # 1. Discovery — list every company and its staff so you can pick IDs:
//   node scripts/migrate-tenant-data.mjs --list
//
//   # 2. Dry run — show what would change moving rows from tenant 2 to 1:
//   node scripts/migrate-tenant-data.mjs --from 2 --to 1
//
//   # 3. Execute — actually run the UPDATEs:
//   node scripts/migrate-tenant-data.mjs --from 2 --to 1 --execute

import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

const url = (process.env.TURSO_DATABASE_URL || "").trim();
const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing.");
  process.exit(1);
}

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}
const wantList = args.includes("--list");
const fromId = Number(arg("--from"));
const toId = Number(arg("--to"));
const execute = args.includes("--execute");

// Tables that hold tenant business data. Rows here will be moved.
const DATA_TABLES = [
  "customers",
  "jobs",
  "messages",
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
  "leads",
  "lead_forms",
  "sprints",
  "payroll_payouts",
  "meta_pages",
];

// Tables explicitly NOT touched. These hold per-tenant config or identity
// rows that belong to the company they were created under.
const SKIP_TABLES = [
  "staff",
  "messaging_settings",
  "email_settings",
  "ai_settings",
  "meta_integration",
  "payroll_settings",
  "email_automations",
  "lead_workflows",
];

const client = createClient({ url, authToken, intMode: "number" });

async function listCompanies() {
  const companies = await client.execute(
    "SELECT id, name FROM company ORDER BY id"
  );
  console.log("Companies:");
  for (const c of companies.rows) {
    console.log(`  #${c.id}  ${c.name ?? ""}`);
    const staff = await client.execute({
      sql: "SELECT id, name, email, permission_level FROM staff WHERE company_id = ? ORDER BY id",
      args: [c.id],
    });
    if (staff.rows.length === 0) {
      console.log("       (no staff)");
    } else {
      for (const s of staff.rows) {
        console.log(
          `       staff #${s.id}  ${String(s.name ?? "").padEnd(24)} ${String(
            s.email ?? ""
          ).padEnd(40)} ${s.permission_level ?? ""}`
        );
      }
    }
    // Also show data row counts for this company so you can confirm which
    // tenant currently owns what.
    const counts = [];
    for (const t of DATA_TABLES) {
      try {
        const r = await client.execute({
          sql: `SELECT COUNT(*) AS n FROM ${t} WHERE company_id = ?`,
          args: [c.id],
        });
        const n = Number(r.rows[0].n);
        if (n > 0) counts.push(`${t}=${n}`);
      } catch {
        // table may not exist in older schemas
      }
    }
    if (counts.length) {
      console.log("       data: " + counts.join(", "));
    } else {
      console.log("       data: (none)");
    }
  }
}

async function showCompany(id, label) {
  const r = await client.execute({
    sql: "SELECT id, name FROM company WHERE id = ? LIMIT 1",
    args: [id],
  });
  if (r.rows.length === 0) {
    console.error(`${label} company_id ${id} does not exist.`);
    process.exit(1);
  }
  console.log(`${label}: company #${id} — ${r.rows[0].name ?? ""}`);
}

async function migrate() {
  await showCompany(fromId, "FROM");
  await showCompany(toId, "TO  ");
  console.log("");
  console.log(execute ? "EXECUTING moves:" : "DRY RUN — no changes will be written:");

  let totalMoved = 0;
  for (const t of DATA_TABLES) {
    let count;
    try {
      const r = await client.execute({
        sql: `SELECT COUNT(*) AS n FROM ${t} WHERE company_id = ?`,
        args: [fromId],
      });
      count = Number(r.rows[0].n);
    } catch (e) {
      console.log(`  ${t.padEnd(28)} (skipped — ${e.message})`);
      continue;
    }
    if (count === 0) {
      console.log(`  ${t.padEnd(28)} 0 rows`);
      continue;
    }
    if (execute) {
      const upd = await client.execute({
        sql: `UPDATE ${t} SET company_id = ? WHERE company_id = ?`,
        args: [toId, fromId],
      });
      console.log(`  ${t.padEnd(28)} moved ${upd.rowsAffected ?? count} rows`);
      totalMoved += Number(upd.rowsAffected ?? count);
    } else {
      console.log(`  ${t.padEnd(28)} would move ${count} rows`);
      totalMoved += count;
    }
  }

  console.log("");
  console.log(`Skipped (left on company #${fromId}):`);
  for (const t of SKIP_TABLES) {
    try {
      const r = await client.execute({
        sql: `SELECT COUNT(*) AS n FROM ${t} WHERE company_id = ?`,
        args: [fromId],
      });
      console.log(`  ${t.padEnd(28)} ${r.rows[0].n} rows`);
    } catch {
      // table may not exist
    }
  }

  console.log("");
  console.log(
    execute
      ? `Done. Moved ${totalMoved} rows from company #${fromId} to company #${toId}.`
      : `Dry run complete. Would move ${totalMoved} rows. Re-run with --execute to apply.`
  );
}

async function main() {
  if (wantList) {
    await listCompanies();
    return;
  }
  if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
    console.error(
      "Usage:\n" +
        "  --list                          show every company, its staff, and data counts\n" +
        "  --from <id> --to <id>           dry run reassignment\n" +
        "  --from <id> --to <id> --execute apply reassignment\n"
    );
    process.exit(1);
  }
  if (fromId === toId) {
    console.error("--from and --to must be different.");
    process.exit(1);
  }
  await migrate();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("migrate-tenant-data failed:", err);
    process.exit(1);
  });
