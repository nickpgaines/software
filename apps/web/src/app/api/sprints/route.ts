import { NextResponse } from "next/server";
import { getDb, type Sprint, type SprintPrize } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

type View = "sales" | "tech";

type Standing = {
  staff_id: number;
  name: string;
  photo_url: string | null;
  revenue_cents: number;
  job_count: number;
};

type SprintWithExtras = Sprint & {
  prizes: SprintPrize[];
  standings: Standing[];
};

async function requireAdmin(): Promise<
  { ok: true; user: string; companyId: number } | NextResponse
> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (ctx.isPlatformAdmin) {
    return { ok: true, user: ctx.identity, companyId: ctx.companyId };
  }
  const db = await getDb();
  const staff = (await db
    .prepare(
      "SELECT permission_level FROM staff WHERE id = ? AND company_id = ? LIMIT 1"
    )
    .get(ctx.staffId, ctx.companyId)) as
    | { permission_level: string }
    | undefined;
  if (staff?.permission_level === "admin") {
    return { ok: true, user: ctx.identity, companyId: ctx.companyId };
  }
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

async function loadStandings(
  sprint: Sprint,
  companyId: number
): Promise<Standing[]> {
  const db = await getDb();
  const role = sprint.view === "tech" ? "tech" : "sales";
  const rows = (await db
    .prepare(
      `SELECT s.id AS staff_id, s.name, s.photo_url,
              COALESCE(SUM(j.price_cents), 0) AS revenue_cents,
              COUNT(j.id) AS job_count
       FROM staff s
       LEFT JOIN job_assignments ja ON ja.staff_id = s.id AND ja.role = ?
       LEFT JOIN jobs j ON j.id = ja.job_id
         AND j.company_id = ?
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       WHERE s.company_id = ?
       GROUP BY s.id
       HAVING COUNT(j.id) > 0
       ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all(role, companyId, sprint.start_at, sprint.end_at, companyId)) as Standing[];
  return rows;
}

async function hydrate(
  sprint: Sprint,
  companyId: number
): Promise<SprintWithExtras> {
  const db = await getDb();
  const prizes = (await db
    .prepare(
      `SELECT * FROM sprint_prizes WHERE sprint_id = ? ORDER BY place ASC`
    )
    .all(sprint.id)) as SprintPrize[];
  const standings = await loadStandings(sprint, companyId);
  return { ...sprint, prizes, standings };
}

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const db = await getDb();
  const url = new URL(req.url);
  const view = (url.searchParams.get("view") || "sales") as View;
  const includeEnded = url.searchParams.get("includeEnded") === "1";
  const nowIso = new Date().toISOString();
  const sprints = (await db
    .prepare(
      includeEnded
        ? `SELECT * FROM sprints WHERE company_id = ? AND view = ? ORDER BY end_at DESC`
        : `SELECT * FROM sprints WHERE company_id = ? AND view = ? AND end_at > ? ORDER BY end_at ASC`
    )
    .all(
      ...(includeEnded ? [companyId, view] : [companyId, view, nowIso])
    )) as Sprint[];
  const out = await Promise.all(sprints.map((s) => hydrate(s, companyId)));
  return NextResponse.json({ sprints: out });
}

type CreateBody = {
  name?: string;
  description?: string | null;
  view?: View;
  start_at?: string;
  end_at?: string;
  prizes?: { place: number; title: string }[];
};

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = (body.name || "").trim();
  const view: View = body.view === "tech" ? "tech" : "sales";
  const start_at = body.start_at;
  const end_at = body.end_at;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!start_at || !end_at) {
    return NextResponse.json(
      { error: "Start and end are required" },
      { status: 400 }
    );
  }
  const startMs = Date.parse(start_at);
  const endMs = Date.parse(end_at);
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return NextResponse.json(
      { error: "Invalid sprint duration" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const r = await db
    .prepare(
      `INSERT INTO sprints (company_id, name, description, view, start_at, end_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      auth.companyId,
      name,
      body.description?.trim() || null,
      view,
      new Date(startMs).toISOString(),
      new Date(endMs).toISOString(),
      auth.user
    );
  const sprintId = r.lastInsertRowid;

  const prizes = (body.prizes || [])
    .map((p) => ({
      place: Math.max(1, Math.floor(Number(p.place))),
      title: (p.title || "").toString().trim(),
    }))
    .filter((p) => p.title.length > 0);

  for (const p of prizes) {
    await db
      .prepare(
        `INSERT INTO sprint_prizes (sprint_id, place, title) VALUES (?, ?, ?)`
      )
      .run(sprintId, p.place, p.title);
  }

  const sprint = (await db
    .prepare(`SELECT * FROM sprints WHERE id = ? AND company_id = ?`)
    .get(sprintId, auth.companyId)) as Sprint;
  return NextResponse.json(await hydrate(sprint, auth.companyId));
}
