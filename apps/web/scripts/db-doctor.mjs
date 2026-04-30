#!/usr/bin/env node
// Read-only diagnostic for the customers table on Turso.
// Prints the URL host (token redacted), row counts, and a sample.
//
// Usage:
//   cd apps/web
//   npm run db:doctor

import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");
let envSource = "process.env";
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
      if (key.startsWith("TURSO_")) envSource = "apps/web/.env";
    }
  }
}

const url = (process.env.TURSO_DATABASE_URL || "").trim();
const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing.");
  process.exit(1);
}

console.log(`URL source : ${envSource}`);
try {
  const u = new URL(url);
  console.log(`URL host   : ${u.host}`);
  console.log(`URL scheme : ${u.protocol.replace(":", "")}`);
} catch {
  console.log(`URL (raw)  : ${url}`);
}
console.log(`Auth token : ${authToken.slice(0, 6)}…(${authToken.length} chars)`);
console.log("");

const client = createClient({ url, authToken, intMode: "number" });

async function run() {
  const cols = await client.execute("PRAGMA table_info(customers)");
  console.log("customers schema:");
  for (const row of cols.rows) {
    console.log(`  ${String(row.name).padEnd(20)} ${row.type}${row.notnull ? " NOT NULL" : ""}`);
  }
  console.log("");

  const total = await client.execute("SELECT COUNT(*) AS n FROM customers");
  console.log(`total customers              : ${total.rows[0].n}`);

  const withCoords = await client.execute(
    "SELECT COUNT(*) AS n FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
  );
  console.log(`customers with lat AND lng   : ${withCoords.rows[0].n}`);

  const nullCoords = await client.execute(
    "SELECT COUNT(*) AS n FROM customers WHERE latitude IS NULL OR longitude IS NULL"
  );
  console.log(`customers with NULL lat/lng  : ${nullCoords.rows[0].n}`);
  console.log("");

  const sample = await client.execute(
    "SELECT id, first_name, last_name, address_line1, latitude, longitude, is_recurring FROM customers ORDER BY id LIMIT 20"
  );
  console.log(`sample (up to 20):`);
  for (const r of sample.rows) {
    console.log(
      `  #${r.id}  ${String(r.first_name ?? "").padEnd(10)} ${String(
        r.last_name ?? ""
      ).padEnd(14)}  ${String(r.address_line1 ?? "").padEnd(22)}  ` +
        `lat=${r.latitude ?? "NULL"}  lng=${r.longitude ?? "NULL"}  recurring=${r.is_recurring}`
    );
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("doctor failed:", err);
    process.exit(1);
  });
