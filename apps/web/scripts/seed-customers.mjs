#!/usr/bin/env node
// Seeds the customers table with a handful of Charleston, SC test customers.
// Coordinates are hardcoded (no live geocoding — see TODO in CustomerCard.tsx).
//
// Usage:
//   cd apps/web
//   npm run seed:customers
//
// Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (loaded automatically from
// apps/web/.env if present).

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
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set. Configure apps/web/.env or export the var first."
  );
  process.exit(1);
}
if (!authToken) {
  console.error(
    "TURSO_AUTH_TOKEN is not set. Configure apps/web/.env or export the var first."
  );
  process.exit(1);
}

const client = createClient({ url, authToken, intMode: "number" });

// Approximate coordinates within the Charleston, SC metro. These are NOT
// precision-geocoded — they're picked to spread across downtown peninsula,
// West Ashley, James Island, and Mount Pleasant for realistic test density.
const CUSTOMERS = [
  {
    first_name: "Hannah",
    last_name: "Calhoun",
    phone: "843-555-0142",
    email: "hannah.calhoun@example.com",
    address_line1: "122 E Bay St",
    city: "Charleston",
    state: "SC",
    zip: "29401",
    latitude: 32.7782,
    longitude: -79.9268,
    is_recurring: 1,
  },
  {
    first_name: "Marcus",
    last_name: "Pinckney",
    phone: "843-555-0273",
    email: "marcus.pinckney@example.com",
    address_line1: "360 Concord St",
    city: "Charleston",
    state: "SC",
    zip: "29401",
    latitude: 32.7869,
    longitude: -79.9261,
    is_recurring: 0,
  },
  {
    first_name: "Eleanor",
    last_name: "Ravenel",
    phone: "843-555-0388",
    email: "eleanor.ravenel@example.com",
    address_line1: "50 Lockwood Dr",
    city: "Charleston",
    state: "SC",
    zip: "29401",
    latitude: 32.7795,
    longitude: -79.9466,
    is_recurring: 1,
  },
  {
    first_name: "Theo",
    last_name: "Magwood",
    phone: "843-555-0419",
    email: "theo.magwood@example.com",
    address_line1: "1 Carriage Ln",
    city: "Charleston",
    state: "SC",
    zip: "29407",
    latitude: 32.7948,
    longitude: -79.9893,
    is_recurring: 0,
  },
  {
    first_name: "Beatrice",
    last_name: "Vanderhorst",
    phone: "843-555-0537",
    email: "beatrice.vanderhorst@example.com",
    address_line1: "480 King St",
    city: "Charleston",
    state: "SC",
    zip: "29403",
    latitude: 32.7903,
    longitude: -79.9388,
    is_recurring: 1,
  },
  {
    first_name: "Owen",
    last_name: "Drayton",
    phone: "843-555-0654",
    email: "owen.drayton@example.com",
    address_line1: "287 Meeting St",
    city: "Charleston",
    state: "SC",
    zip: "29401",
    latitude: 32.7847,
    longitude: -79.9325,
    is_recurring: 0,
  },
  {
    first_name: "Sadie",
    last_name: "Middleton",
    phone: "843-555-0712",
    email: "sadie.middleton@example.com",
    address_line1: "1654 Folly Rd",
    city: "Charleston",
    state: "SC",
    zip: "29412",
    latitude: 32.7338,
    longitude: -79.9558,
    is_recurring: 1,
  },
  {
    first_name: "Jasper",
    last_name: "Legare",
    phone: "843-555-0890",
    email: "jasper.legare@example.com",
    address_line1: "1180 Coleman Blvd",
    city: "Mount Pleasant",
    state: "SC",
    zip: "29464",
    latitude: 32.8052,
    longitude: -79.8634,
    is_recurring: 0,
  },
];

function fullName(c) {
  return `${c.first_name} ${c.last_name}`.trim();
}
function streetAddress(c) {
  return [c.address_line1, c.city, c.state, c.zip].filter(Boolean).join(", ");
}

async function run() {
  let inserted = 0;
  let skipped = 0;
  for (const c of CUSTOMERS) {
    const name = fullName(c);
    const formatted = streetAddress(c);
    const existing = await client.execute({
      sql:
        "SELECT id FROM customers WHERE first_name = ? AND last_name = ? AND address_line1 = ? LIMIT 1",
      args: [c.first_name, c.last_name, c.address_line1],
    });
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }
    await client.execute({
      sql: `INSERT INTO customers
              (name, first_name, last_name, phone, email,
               address, address_line1, city, state, zip,
               latitude, longitude, formatted_address, is_recurring,
               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    datetime('now'), datetime('now'))`,
      args: [
        name,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        formatted,
        c.address_line1,
        c.city,
        c.state,
        c.zip,
        c.latitude,
        c.longitude,
        formatted,
        c.is_recurring,
      ],
    });
    inserted++;
  }
  console.log(`Seed complete: ${inserted} inserted, ${skipped} skipped (already present).`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
