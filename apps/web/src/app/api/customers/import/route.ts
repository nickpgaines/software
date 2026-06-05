import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ImportRow = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  // ISO timestamp; when present, overrides the default created_at so
  // imported customers carry their original "joined" date from the
  // source CRM. Falls back to now() if absent or unparseable.
  created_at?: string | null;
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
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as { rows?: ImportRow[] };
  const rows = body.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "rows array is required" },
      { status: 400 }
    );
  }

  const existing = (await db
    .prepare("SELECT phone, email FROM customers WHERE company_id = ?")
    .all(companyId)) as { phone: string | null; email: string | null }[];
  const phoneSet = new Set<string>();
  const emailSet = new Set<string>();
  for (const c of existing) {
    if (c.phone && c.phone.trim()) phoneSet.add(c.phone.trim().toLowerCase());
    if (c.email && c.email.trim()) emailSet.add(c.email.trim().toLowerCase());
  }

  const skippedReasons: Skipped[] = [];
  const errors: ErrorEntry[] = [];
  let inserted = 0;

  try {
    await db.transaction(async (tx) => {
      // Two inserts: the default uses datetime('now') for created_at, the
      // override accepts an explicit ISO timestamp. Picking between them at
      // call-time keeps the common path unchanged for callers that don't
      // pass a date.
      const insertNow = tx.prepare(
        `INSERT INTO customers
           (company_id, name, first_name, last_name, phone, email,
            address, address_line1, formatted_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertWithDate = tx.prepare(
        `INSERT INTO customers
           (company_id, name, first_name, last_name, phone, email,
            address, address_line1, formatted_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
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
          continue;
        }

        if (phone && phoneSet.has(phone.toLowerCase())) {
          skippedReasons.push({
            row: rowNum,
            reason: `Phone "${phone}" already exists`,
          });
          continue;
        }
        if (email && emailSet.has(email.toLowerCase())) {
          skippedReasons.push({
            row: rowNum,
            reason: `Email "${email}" already exists`,
          });
          continue;
        }

        // Accept a pre-normalized ISO date from the client; on any parse
        // failure fall back to now() rather than rejecting the row.
        let createdAtIso: string | null = null;
        if (raw.created_at && typeof raw.created_at === "string") {
          const d = new Date(raw.created_at.trim());
          if (!isNaN(d.getTime())) createdAtIso = d.toISOString();
        }

        const name = `${first} ${last}`.trim();
        if (createdAtIso) {
          await insertWithDate.run(
            companyId,
            name,
            first,
            last,
            phone || null,
            email || null,
            address || null,
            address || null,
            address || null,
            createdAtIso
          );
        } else {
          await insertNow.run(
            companyId,
            name,
            first,
            last,
            phone || null,
            email || null,
            address || null,
            address || null,
            address || null
          );
        }

        if (phone) phoneSet.add(phone.toLowerCase());
        if (email) emailSet.add(email.toLowerCase());
        inserted++;
      }
    });
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
