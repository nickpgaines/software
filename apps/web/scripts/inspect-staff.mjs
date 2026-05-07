#!/usr/bin/env node
// Read-only diagnostic: prints every staff row whose email (case-insensitive)
// matches the argument, plus the matching company rows. Use this to figure
// out why login or the dashboard greeting is misbehaving for a given email.
//
// Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from process.env or apps/web/.env.
//
// Usage:
//   cd apps/web
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/inspect-staff.mjs lebron@gmail.com

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
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (process.env[m[1]] == null || process.env[m[1]] === "") {
      process.env[m[1]] = val;
    }
  }
}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/inspect-staff.mjs <email>");
  process.exit(1);
}

const url = (process.env.TURSO_DATABASE_URL || "").trim();
const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing.");
  process.exit(1);
}

try {
  const u = new URL(url);
  console.log(`turso host : ${u.host}`);
} catch {
  console.log(`turso url  : ${url}`);
}
console.log(`email      : ${email}`);
console.log("");

const client = createClient({ url, authToken, intMode: "number" });

function summarize(value, max = 80) {
  if (value == null) return "NULL";
  const s = String(value);
  if (s.length <= max) return JSON.stringify(s);
  return JSON.stringify(s.slice(0, max) + "…");
}

async function run() {
  const schemaRes = await client.execute(
    "SELECT version FROM _schema_version WHERE id = 1 LIMIT 1"
  ).catch(() => ({ rows: [] }));
  console.log(
    `schema_ver : ${schemaRes.rows[0]?.version ?? "(no _schema_version row)"}`
  );
  console.log("");

  const indexRes = await client.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='staff'"
  );
  console.log("staff indexes:");
  for (const r of indexRes.rows) {
    console.log(`  ${r.name}  ${r.sql ?? ""}`);
  }
  console.log("");

  const exactRes = await client.execute({
    sql: "SELECT * FROM staff WHERE email = ?",
    args: [email],
  });
  console.log(`rows where email = ${JSON.stringify(email)} (case-sensitive):  ${exactRes.rows.length}`);

  const ciRes = await client.execute({
    sql: "SELECT * FROM staff WHERE LOWER(email) = ?",
    args: [email],
  });
  console.log(`rows where LOWER(email) = ${JSON.stringify(email)}:                ${ciRes.rows.length}`);
  console.log("");

  if (ciRes.rows.length === 0) {
    console.log("No staff rows match that email.");
    console.log("Possibilities:");
    console.log("  - signup transaction was rolled back (no staff row was ever persisted)");
    console.log("  - the row was deleted via /api/staff/[id] DELETE");
    console.log("  - the email was stored under a different value (typo, trailing whitespace)");
    console.log("");
    console.log("Sampling the most recent staff rows so you can eyeball it:");
    const recent = await client.execute(
      "SELECT id, company_id, email, name, first_name, created_at FROM staff ORDER BY id DESC LIMIT 10"
    );
    for (const r of recent.rows) {
      console.log(
        `  #${r.id}  company=${r.company_id}  email=${summarize(r.email)}  name=${summarize(r.name)}  first=${summarize(r.first_name)}  created=${r.created_at}`
      );
    }
    return;
  }

  for (const r of ciRes.rows) {
    console.log(`---- staff row #${r.id} ----`);
    console.log(`  company_id        : ${r.company_id}`);
    console.log(`  email             : ${summarize(r.email)}`);
    console.log(`  name              : ${summarize(r.name)}`);
    console.log(`  first_name        : ${summarize(r.first_name)}`);
    console.log(`  last_name         : ${summarize(r.last_name)}`);
    console.log(`  permission_level  : ${r.permission_level}`);
    console.log(`  password_hash set : ${r.password_hash ? `yes (len=${String(r.password_hash).length})` : "NO"}`);
    if (r.password_hash) {
      const parts = String(r.password_hash).split("$");
      console.log(`  password_hash fmt : parts=${parts.length}, scheme=${JSON.stringify(parts[0] ?? "")}`);
    }
    console.log(`  created_at        : ${r.created_at}`);
    console.log(`  updated_at        : ${r.updated_at ?? "NULL"}`);

    const company = await client.execute({
      sql: "SELECT id, name FROM company WHERE id = ?",
      args: [r.company_id],
    });
    if (company.rows[0]) {
      console.log(
        `  company           : #${company.rows[0].id} ${summarize(company.rows[0].name)}`
      );
    } else {
      console.log(`  company           : MISSING (company_id=${r.company_id} not found)`);
    }

    const oauth = await client.execute({
      sql: "SELECT provider, provider_user_id, email FROM oauth_accounts WHERE staff_id = ?",
      args: [r.id],
    }).catch(() => ({ rows: [] }));
    if (oauth.rows.length) {
      console.log(`  oauth_accounts    : ${oauth.rows.length} link(s)`);
      for (const o of oauth.rows) {
        console.log(`    - ${o.provider}  user=${o.provider_user_id}  email=${summarize(o.email)}`);
      }
    } else {
      console.log(`  oauth_accounts    : none`);
    }
    console.log("");
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("inspect-staff failed:", err);
    process.exit(1);
  });
