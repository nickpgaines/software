import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type ImportRow = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type Skipped = { row: number; reason: string };
type ErrorEntry = { row: number; reason: string };

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function autoSplitFirst(first: string, last: string) {
  if (last) return { first, last };
  if (!first.includes(" ")) return { first, last: "" };
  const idx = first.indexOf(" ");
  return {
    first: first.slice(0, idx).trim(),
    last: first.slice(idx + 1).trim(),
  };
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as { rows?: ImportRow[] };
  const rows = body.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "rows array is required" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare("SELECT phone, email FROM customers")
    .all() as { phone: string | null; email: string | null }[];
  const phoneSet = new Set<string>();
  const emailSet = new Set<string>();
  for (const c of existing) {
    if (c.phone && c.phone.trim()) phoneSet.add(c.phone.trim().toLowerCase());
    if (c.email && c.email.trim()) emailSet.add(c.email.trim().toLowerCase());
  }

  const insert = db.prepare(
    `INSERT INTO customers (name, first_name, last_name, phone, email, address)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const skippedReasons: Skipped[] = [];
  const errors: ErrorEntry[] = [];
  let inserted = 0;

  const tx = db.transaction(() => {
    rows.forEach((raw, i) => {
      const rowNum = i + 1;
      const split = autoSplitFirst(
        clean(raw.first_name),
        clean(raw.last_name)
      );
      const first = split.first;
      const last = split.last;
      const phone = clean(raw.phone);
      const email = clean(raw.email);
      const address = clean(raw.address);

      if (!first) {
        errors.push({ row: rowNum, reason: "Missing first name" });
        return;
      }

      if (phone && phoneSet.has(phone.toLowerCase())) {
        skippedReasons.push({
          row: rowNum,
          reason: `Phone "${phone}" already exists`,
        });
        return;
      }
      if (email && emailSet.has(email.toLowerCase())) {
        skippedReasons.push({
          row: rowNum,
          reason: `Email "${email}" already exists`,
        });
        return;
      }

      const name = `${first} ${last}`.trim();
      insert.run(name, first, last, phone || null, email || null, address || null);

      if (phone) phoneSet.add(phone.toLowerCase());
      if (email) emailSet.add(email.toLowerCase());
      inserted++;
    });
  });

  try {
    tx();
  } catch (err) {
    return NextResponse.json(
      {
        error: "Import failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inserted,
    skipped: skippedReasons.length,
    skippedReasons,
    errors,
  });
}
