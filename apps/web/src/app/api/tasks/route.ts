import { NextResponse } from "next/server";
import { getDb, type TaskRecurrence } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RECURRENCES: TaskRecurrence[] = ["daily", "weekly", "biweekly", "monthly"];

// How many future occurrences to pre-generate when a task is created with a
// recurrence. Chosen so each cadence covers a reasonable horizon without
// flooding the table:
//   daily    × 60  ≈ 2 months
//   weekly   × 26  ≈ 6 months
//   biweekly × 26  ≈ 1 year
//   monthly  × 24  ≈ 2 years
function occurrenceCount(rec: TaskRecurrence): number {
  if (rec === "daily") return 60;
  if (rec === "weekly") return 26;
  if (rec === "biweekly") return 26;
  return 24;
}

function addRecurrence(date: Date, rec: TaskRecurrence, n: number): Date {
  const d = new Date(date);
  if (rec === "daily") d.setUTCDate(d.getUTCDate() + n);
  else if (rec === "weekly") d.setUTCDate(d.getUTCDate() + 7 * n);
  else if (rec === "biweekly") d.setUTCDate(d.getUTCDate() + 14 * n);
  else if (rec === "monthly") d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

type ListRow = {
  id: number;
  title: string;
  details: string | null;
  start_at: string;
  end_at: string;
  assignee_user_id: number | null;
  assignee_name: string | null;
  created_by_user_id: number | null;
  is_team_task: number;
  recurrence: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const scope = url.searchParams.get("scope"); // "mine" | "all" | null (default: visible-to-me)
  const status = url.searchParams.get("status"); // "open" | "done" | null

  const where: string[] = ["t.company_id = ?"];
  const args: (string | number | null)[] = [ctx.companyId];

  // Visibility: a task is visible if it's a team task, or it's assigned to
  // the caller, or the caller created it. Platform admins see everything.
  if (!ctx.isPlatformAdmin) {
    if (scope === "mine" && ctx.staffId != null) {
      where.push("(t.assignee_user_id = ? OR t.created_by_user_id = ?)");
      args.push(ctx.staffId, ctx.staffId);
    } else if (ctx.staffId != null) {
      where.push(
        "(t.is_team_task = 1 OR t.assignee_user_id = ? OR t.created_by_user_id = ?)"
      );
      args.push(ctx.staffId, ctx.staffId);
    }
  }
  if (from) {
    where.push("t.start_at >= ?");
    args.push(from);
  }
  if (to) {
    where.push("t.start_at < ?");
    args.push(to);
  }
  if (status === "open" || status === "done") {
    where.push("t.status = ?");
    args.push(status);
  }

  const rows = (await db
    .prepare(
      `SELECT t.id, t.title, t.details, t.start_at, t.end_at,
              t.assignee_user_id,
              COALESCE(NULLIF(TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')), ''), a.name) AS assignee_name,
              t.created_by_user_id,
              t.is_team_task, t.recurrence,
              t.status, t.completed_at, t.created_at
         FROM tasks t
         LEFT JOIN staff a ON a.id = t.assignee_user_id
        WHERE ${where.join(" AND ")}
        ORDER BY t.start_at ASC, t.id ASC`
    )
    .all(...args)) as ListRow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const body = (await req.json().catch(() => ({}))) as Partial<{
    title: string;
    details: string | null;
    start_at: string;
    end_at: string;
    assignee_user_id: number | null;
    is_team_task: boolean | number;
    recurrence: string | null;
  }>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const startAt = typeof body.start_at === "string" ? body.start_at : "";
  const endAt = typeof body.end_at === "string" ? body.end_at : "";
  if (!startAt || !endAt) {
    return NextResponse.json(
      { error: "Start and end times are required" },
      { status: 400 }
    );
  }
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return NextResponse.json(
      { error: "Start and end must be valid ISO timestamps" },
      { status: 400 }
    );
  }
  if (endMs < startMs) {
    return NextResponse.json(
      { error: "End must be after start" },
      { status: 400 }
    );
  }

  const isTeamTask = body.is_team_task ? 1 : 0;
  const recurrenceRaw =
    typeof body.recurrence === "string" ? body.recurrence : null;
  const recurrence: TaskRecurrence | null =
    recurrenceRaw && RECURRENCES.includes(recurrenceRaw as TaskRecurrence)
      ? (recurrenceRaw as TaskRecurrence)
      : null;

  // Assignee resolution. If is_team_task=1, assignee is null. Otherwise
  // accept the supplied id; null means "assigned to me" (the caller).
  let assigneeId: number | null = null;
  if (!isTeamTask) {
    if (typeof body.assignee_user_id === "number") {
      assigneeId = body.assignee_user_id;
    } else if (ctx.staffId != null) {
      assigneeId = ctx.staffId;
    }
  }

  const createdId = await db.transaction(async (tx) => {
    const result = await tx
      .prepare(
        `INSERT INTO tasks
           (company_id, created_by_user_id, title, details,
            start_at, end_at, assignee_user_id, is_team_task,
            recurrence, recurrence_parent_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'open')`
      )
      .run(
        ctx.companyId,
        ctx.staffId,
        title,
        body.details ? String(body.details) : null,
        startAt,
        endAt,
        assigneeId,
        isTeamTask,
        recurrence
      );
    const id = Number(result.lastInsertRowid);

    // Pre-generate future occurrences for recurring tasks. Each instance
    // is an independent row that can be completed individually; they're
    // linked via recurrence_parent_id back to the original. Keep a small
    // backlog horizon (see occurrenceCount) — if the parent is later
    // deleted or canceled, the remaining children stay deletable too.
    if (recurrence) {
      const count = occurrenceCount(recurrence);
      const start = new Date(startMs);
      const end = new Date(endMs);
      for (let i = 1; i < count; i++) {
        const occStart = addRecurrence(start, recurrence, i).toISOString();
        const occEnd = addRecurrence(end, recurrence, i).toISOString();
        await tx
          .prepare(
            `INSERT INTO tasks
               (company_id, created_by_user_id, title, details,
                start_at, end_at, assignee_user_id, is_team_task,
                recurrence, recurrence_parent_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`
          )
          .run(
            ctx.companyId,
            ctx.staffId,
            title,
            body.details ? String(body.details) : null,
            occStart,
            occEnd,
            assigneeId,
            isTeamTask,
            recurrence,
            id
          );
      }
    }

    return id;
  });

  return NextResponse.json({ id: createdId }, { status: 201 });
}
