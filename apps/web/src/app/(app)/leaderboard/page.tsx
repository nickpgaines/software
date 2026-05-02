import LeaderboardClient from "@/components/LeaderboardClient";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = getSessionUser() || "";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  let staffId: number | null = null;
  let isAdmin = user === adminUsername;
  if (user && !isAdmin) {
    const db = await getDb();
    const row = (await db
      .prepare(
        "SELECT id, permission_level FROM staff WHERE LOWER(email) = ? LIMIT 1"
      )
      .get(user.toLowerCase())) as
      | { id: number; permission_level: string | null }
      | undefined;
    staffId = row?.id ?? null;
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
