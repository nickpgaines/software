import { NextResponse } from "next/server";
import { getDb, type Sprint, type SprintPrize, type Staff } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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

function adminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

async function requireAdmin(): Promise<{ ok: true; user: string } | NextResponse> {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user === adminUsername()) return { ok: true, user };
  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get(user.toLowerCase())) as Staff | undefined;
  if (staff?.permission_level === "admin") return { ok: true, user };
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

async function loadStandings(
  sprint: Sprint
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
         AND j.scheduled_at >= ? AND j.scheduled_at < ?
       GROUP BY s.id
       HAVING COUNT(j.id) > 0
       ORDER BY revenue_cents DESC, s.name COLLATE NOCASE ASC`
    )
    .all(role, sprint.start_at, sprint.end_at)) as Standing[];
  return rows;
}

async function hydrate(sprint: Sprint): Promise<SprintWithExtras> {
  const db = await getDb();
  const prizes = (await db
    .prepare(
      `SELECT * FROM sprint_prizes WHERE sprint_id = ? ORDER BY place ASC`
    )
    .all(sprint.id)) as SprintPrize[];
  const standings = await loadStandings(sprint);
  return { ...sprint, prizes, standings };
}

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const view = (url.searchParams.get("view") || "sales") as View;
  const includeEnded = url.searchParams.get("includeEnded") === "1";
  const nowIso = new Date().toISOString();
  const sprints = (await db
    .prepare(
      includeEnded
        ? `SELECT * FROM sprints WHERE view = ? ORDER BY end_at DESC`
        : `SELECT * FROM sprints WHERE view = ? AND end_at > ? ORDER BY end_at ASC`
    )
    .all(...(includeEnded ? [view] : [view, nowIso]))) as Sprint[];
  const out = await Promise.all(sprints.map(hydrate));
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
      `INSERT INTO sprints (name, description, view, start_at, end_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
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
    .prepare(`SELECT * FROM sprints WHERE id = ?`)
    .get(sprintId)) as Sprint;
  return NextResponse.json(await hydrate(sprint));
}
