import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { loadMe } from "@/lib/me";
import { getDb } from "@/lib/db";
import { FULL_SCHEDULE_PERMISSIONS } from "@/lib/technicianColors";

export const dynamic = "force-dynamic";

export type SearchItem = { id: number; title: string; subtitle: string | null; href: string };
export type SearchGroup = {
  type: "customer" | "job" | "invoice" | "lead";
  label: string;
  items: SearchItem[];
};

const LIMIT = 5;

type CustomerRow = { id: number; first_name: string | null; last_name: string | null; name: string | null; phone: string | null; email: string | null };
type JobRow = { id: number; status: string | null; scheduled_at: string | null; cust_name: string | null; cust_fallback: string | null };
type InvoiceRow = { id: number; title: string | null; status: string | null; total_cents: number | null };
type LeadRow = { id: number; first_name: string | null; last_name: string | null; stage: string | null };

function usd(cents: number | null): string | null {
  if (cents == null) return null;
  const v = cents / 100;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function shortDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  // Default to the most restrictive posture; widen only for known roles.
  // A non-admin session with no staffId (anomalous, e.g. mid-migration) stays
  // fail-closed: no leads, and jobs filtered to technician_id = null → no rows.
  let canViewLeads = false;
  let restrictJobsToTech = true;
  if (ctx.isPlatformAdmin) {
    canViewLeads = true;
    restrictJobsToTech = false;
  } else if (ctx.staffId != null) {
    const me = await loadMe();
    const perms = new Set(me?.permissions ?? []);
    canViewLeads = perms.has("leads.view");
    const level = me?.staff?.permission_level ?? "admin";
    restrictJobsToTech = !FULL_SCHEDULE_PERMISSIONS.has(level);
  }

  const db = await getDb();
  // Escape LIKE metacharacters so a literal % or _ in the query doesn't act as
  // a wildcard. Paired with `ESCAPE '\'` on each LIKE clause below.
  const escaped = q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const like = `%${escaped}%`;
  const companyId = ctx.companyId;

  try {
    const customersP = db
      .prepare(
        `SELECT id, first_name, last_name, name, phone, email
           FROM customers
          WHERE company_id = ?
            AND ( LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(name,'')) LIKE ? ESCAPE '\\'
               OR COALESCE(phone,'') LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(email,'')) LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(formatted_address, address_line1, address, '')) LIKE ? ESCAPE '\\' )
          ORDER BY first_name COLLATE NOCASE
          LIMIT ?`
      )
      .all<CustomerRow>(companyId, like, like, like, like, like, LIMIT);

    const jobsSql =
      `SELECT j.id AS id, j.status AS status, j.scheduled_at AS scheduled_at,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS cust_name,
              c.name AS cust_fallback
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
        WHERE j.company_id = ?
          AND ( LOWER(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(c.name,'')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(j.notes,'')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(j.status,'')) LIKE ? ESCAPE '\\' )
          ${restrictJobsToTech ? "AND j.technician_id = ?" : ""}
        ORDER BY j.scheduled_at DESC
        LIMIT ?`;
    let jobsP: Promise<JobRow[]>;
    if (restrictJobsToTech) {
      jobsP = db
        .prepare(jobsSql)
        .all<JobRow>(companyId, like, like, like, like, ctx.staffId, LIMIT);
    } else {
      jobsP = db
        .prepare(jobsSql)
        .all<JobRow>(companyId, like, like, like, like, LIMIT);
    }

    const invoicesP = db
      .prepare(
        `SELECT i.id AS id, i.title AS title, i.status AS status, i.total_cents AS total_cents
           FROM invoices i
           LEFT JOIN customers c ON c.id = i.customer_id
          WHERE i.company_id = ?
            AND ( LOWER(COALESCE(i.title,'')) LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(i.notes,'')) LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) LIKE ? ESCAPE '\\'
               OR LOWER(COALESCE(c.name,'')) LIKE ? ESCAPE '\\' )
          ORDER BY i.created_at DESC
          LIMIT ?`
      )
      .all<InvoiceRow>(companyId, like, like, like, like, LIMIT);

    const leadsP: Promise<LeadRow[]> = canViewLeads
      ? db
          .prepare(
            `SELECT id, first_name, last_name, stage
               FROM leads
              WHERE company_id = ?
                AND ( LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ? ESCAPE '\\'
                   OR LOWER(COALESCE(email,'')) LIKE ? ESCAPE '\\'
                   OR COALESCE(phone,'') LIKE ? ESCAPE '\\'
                   OR LOWER(COALESCE(address,'')) LIKE ? ESCAPE '\\' )
              ORDER BY created_at DESC
              LIMIT ?`
          )
          .all<LeadRow>(companyId, like, like, like, like, LIMIT)
      : Promise.resolve([]);

    const [customers, jobs, invoices, leads] = await Promise.all([
      customersP, jobsP, invoicesP, leadsP,
    ]);

    const groups: SearchGroup[] = [];

    if (customers.length) {
      groups.push({
        type: "customer",
        label: "Customers",
        items: customers.map((c) => ({
          id: c.id,
          title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || "Customer",
          subtitle: c.phone || c.email || null,
          href: `/customers/${c.id}`,
        })),
      });
    }
    if (jobs.length) {
      groups.push({
        type: "job",
        label: "Jobs",
        items: jobs.map((j) => ({
          id: j.id,
          title: (j.cust_name || "").trim() || j.cust_fallback || "Job",
          subtitle: [j.status, shortDate(j.scheduled_at)].filter(Boolean).join(" • ") || null,
          href: `/schedule/${j.id}`,
        })),
      });
    }
    if (invoices.length) {
      groups.push({
        type: "invoice",
        label: "Invoices",
        items: invoices.map((i) => ({
          id: i.id,
          title: i.title || `Invoice #${i.id}`,
          subtitle: [i.status, usd(i.total_cents)].filter(Boolean).join(" • ") || null,
          href: `/invoices/${i.id}`,
        })),
      });
    }
    if (leads.length) {
      groups.push({
        type: "lead",
        label: "Leads",
        items: leads.map((l) => ({
          id: l.id,
          title: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Lead",
          subtitle: l.stage || null,
          href: `/leads`,
        })),
      });
    }

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[/api/search] error", err);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}
