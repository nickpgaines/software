import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type ShiftRow = {
  id: number;
  staff_id: number;
  work_date: string;
  start_minutes: number;
  end_minutes: number;
};

type DefaultShiftRow = {
  id: number;
  staff_id: number;
  weekday: number;
  start_minutes: number;
  end_minutes: number;
};

type StaffRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  color: string | null;
  photo_url: string | null;
};

function isValidDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function weekdayOf(yyyyMmDd: string): number {
  // Local-time interpretation; matches the calendar grid (Sun=0..Sat=6).
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!isValidDateString(start) || !isValidDateString(end)) {
    return NextResponse.json(
      { error: "start and end (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }
  const db = await getDb();

  const staff = await db
    .prepare(
      `SELECT id, name, first_name, last_name, email, color, photo_url
         FROM staff
        ORDER BY COALESCE(first_name, name), last_name`
    )
    .all<StaffRow>();

  const shifts = await db
    .prepare(
      `SELECT id, staff_id, work_date, start_minutes, end_minutes
         FROM staff_shifts
        WHERE work_date >= ? AND work_date <= ?
        ORDER BY work_date`
    )
    .all<ShiftRow>(start, end);

  const defaults = await db
    .prepare(
      `SELECT id, staff_id, weekday, start_minutes, end_minutes
         FROM staff_default_shifts
        ORDER BY staff_id, weekday`
    )
    .all<DefaultShiftRow>();

  return NextResponse.json({ staff, shifts, defaults });
}

type ShiftInput = {
  staff_id: number;
  work_date: string;
  start_minutes: number;
  end_minutes: number;
};

type RemoveInput = {
  staff_id: number;
  work_date: string;
};

type PostBody = {
  upserts?: ShiftInput[];
  removals?: RemoveInput[];
  as_default?: boolean;
};

function validateShift(s: unknown): ShiftInput | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const staff_id = Number(o.staff_id);
  const work_date = o.work_date;
  const start_minutes = Number(o.start_minutes);
  const end_minutes = Number(o.end_minutes);
  if (!Number.isFinite(staff_id) || staff_id <= 0) return null;
  if (!isValidDateString(work_date)) return null;
  if (
    !Number.isFinite(start_minutes) ||
    start_minutes < 0 ||
    start_minutes >= 24 * 60
  )
    return null;
  if (
    !Number.isFinite(end_minutes) ||
    end_minutes <= start_minutes ||
    end_minutes > 24 * 60
  )
    return null;
  return {
    staff_id,
    work_date,
    start_minutes: Math.round(start_minutes),
    end_minutes: Math.round(end_minutes),
  };
}

function validateRemoval(s: unknown): RemoveInput | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const staff_id = Number(o.staff_id);
  const work_date = o.work_date;
  if (!Number.isFinite(staff_id) || staff_id <= 0) return null;
  if (!isValidDateString(work_date)) return null;
  return { staff_id, work_date };
}

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const upserts: ShiftInput[] = (body.upserts ?? [])
    .map(validateShift)
    .filter((s): s is ShiftInput => s !== null);
  const removals: RemoveInput[] = (body.removals ?? [])
    .map(validateRemoval)
    .filter((s): s is RemoveInput => s !== null);
  const asDefault = body.as_default === true;

  const db = await getDb();

  for (const u of upserts) {
    await db
      .prepare(
        `INSERT INTO staff_shifts (staff_id, work_date, start_minutes, end_minutes)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(staff_id, work_date) DO UPDATE SET
             start_minutes = excluded.start_minutes,
             end_minutes   = excluded.end_minutes,
             updated_at    = datetime('now')`
      )
      .run(u.staff_id, u.work_date, u.start_minutes, u.end_minutes);
  }

  for (const r of removals) {
    await db
      .prepare(
        `DELETE FROM staff_shifts WHERE staff_id = ? AND work_date = ?`
      )
      .run(r.staff_id, r.work_date);
  }

  if (asDefault) {
    // Upserts → set the weekday default to those hours.
    for (const u of upserts) {
      const weekday = weekdayOf(u.work_date);
      await db
        .prepare(
          `INSERT INTO staff_default_shifts
             (staff_id, weekday, start_minutes, end_minutes)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(staff_id, weekday) DO UPDATE SET
               start_minutes = excluded.start_minutes,
               end_minutes   = excluded.end_minutes,
               updated_at    = datetime('now')`
        )
        .run(u.staff_id, weekday, u.start_minutes, u.end_minutes);
    }
    // Removals → also clear the default for that weekday.
    for (const r of removals) {
      const weekday = weekdayOf(r.work_date);
      await db
        .prepare(
          `DELETE FROM staff_default_shifts
             WHERE staff_id = ? AND weekday = ?`
        )
        .run(r.staff_id, weekday);
    }
  }

  return NextResponse.json({ ok: true });
}
