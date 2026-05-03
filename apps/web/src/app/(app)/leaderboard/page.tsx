import LeaderboardClient from "@/components/LeaderboardClient";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const ctx = await getSessionContext();
  const user = ctx?.identity || "";
  let staffId: number | null = ctx?.staffId ?? null;
  let isAdmin = ctx?.isPlatformAdmin ?? false;
  if (ctx?.staffId && !isAdmin) {
    const db = await getDb();
    const row = (await db
      .prepare(
        "SELECT permission_level FROM staff WHERE id = ? AND company_id = ? LIMIT 1"
      )
      .get(ctx.staffId, ctx.companyId)) as
      | { permission_level: string | null }
      | undefined;
    if (row?.permission_level === "admin") isAdmin = true;
  }
  return (
    <LeaderboardClient
      currentUser={user}
      currentStaffId={staffId}
      isAdmin={isAdmin}
    />
  );
}
