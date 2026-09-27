import { NextResponse } from "next/server";
import { getDb, syncReplica } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { getLeaderboardRows } from "@/lib/widget-metrics";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "year" | "custom" | "all";
type View = "sales" | "tech";

function resolveRange(
  range: Range,
  from?: string | null,
  to?: string | null
): { start: string; end: string } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  if (range === "custom" && from && to) {
    return { start: new Date(from).toISOString(), end: new Date(to).toISOString() };
  }
  if (range === "today") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    return { start: startOfDay.toISOString(), end: end.toISOString() };
  }
  if (range === "week") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "all") {
    return { start: new Date(0).toISOString(), end: new Date(8640000000000000).toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  // Profile photo uploads on /settings update staff.photo_url on the primary,
  // but the leaderboard reads from the local replica which can lag. Without
  // a sync the user lands here right after uploading their photo and still
  // sees initials. Forcing a sync keeps the avatar fresh.
  await syncReplica();
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "month") as Range;
  const view = (url.searchParams.get("view") || "sales") as View;
  const role = view === "tech" ? "tech" : "sales";

  const { start, end } = resolveRange(
    range,
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const rows = await getLeaderboardRows(
    db,
    companyId,
    role,
    new Date(start),
    new Date(end)
  );

  return NextResponse.json({ range, view, start, end, rows });
}
