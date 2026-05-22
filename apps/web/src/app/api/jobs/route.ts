import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext, requireCompanyId } from "@/lib/auth";
import { computeJobStatus, createJob, type JobInput } from "@/lib/jobs";
import { FULL_SCHEDULE_PERMISSIONS } from "@/lib/technicianColors";

export const dynamic = "force-dynamic";

type JobRow = {
  id: number;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  price_cents: number;
  paid_total_cents: number;
};

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("No session");
  const companyId = ctx.companyId;
  const db = await getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Determine the caller's permission level so that field techs and
  // "own jobs only" salespeople see a filtered schedule. Platform admin
  // (no staffId) always sees everything.
  let permissionFilter: "all" | "tech" = "all";
  if (!ctx.isPlatformAdmin && ctx.staffId != null) {
    const me = (await db
      .prepare(
        "SELECT permission_level FROM staff WHERE id = ? AND company_id = ?"
      )
      .get(ctx.staffId, companyId)) as { permission_level: string | null } | undefined;
    const perm = me?.permission_level ?? "admin";
    if (perm === "technician") permissionFilter = "tech";
    else if (!FULL_SCHEDULE_PERMISSIONS.has(perm)) permissionFilter = "tech";
  }

  let sql = `
    SELECT j.*,
           c.name AS customer_name,
           c.address AS customer_address,
           c.phone AS customer_phone,
           sp.name AS salesperson_name,
           tc.name AS technician_name,
           tc.color AS technician_color,
           COALESCE(
             (SELECT SUM(amount_cents) FROM payments p WHERE p.job_id = j.id),
             0
           ) AS paid_total_cents
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    LEFT JOIN staff sp ON sp.id = j.salesperson_id
    LEFT JOIN staff tc ON tc.id = j.technician_id
  `;
  const where: string[] = ["j.company_id = ?"];
  const args: unknown[] = [companyId];
  if (from) {
    where.push("j.scheduled_at >= ?");
    args.push(from);
  }
  if (to) {
    where.push("j.scheduled_at < ?");
    args.push(to);
  }
  if (permissionFilter === "tech" && ctx.staffId != null) {
    where.push("j.technician_id = ?");
    args.push(ctx.staffId);
  }
  sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY j.scheduled_at ASC";

  const rows = (await db
    .prepare(sql)
    .all(...(args as (string | number | null)[]))) as (JobRow &
    Record<string, unknown>)[];
  const enriched = rows.map((row) => ({
    ...row,
    job_status: computeJobStatus({
      en_route_at: row.en_route_at,
      arrived_at: row.arrived_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      price_cents: row.price_cents,
      paid_total_cents: row.paid_total_cents,
    }),
  }));
  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<JobInput>;
  if (!body.customer_id || !body.start_time) {
    return NextResponse.json(
      { error: "customer_id and start_time are required" },
      { status: 400 }
    );
  }
  try {
    const id = await createJob(db, body as JobInput, companyId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    if (message === "Customer not found") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    console.error("POST /api/jobs failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
