import LeaderboardClient from "@/components/LeaderboardClient";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = getSessionUser() || "";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  let staffId: number | null = null;
  if (user && user !== adminUsername) {
    const db = await getDb();
    const row = (await db
      .prepare("SELECT id FROM staff WHERE LOWER(email) = ? LIMIT 1")
      .get(user.toLowerCase())) as { id: number } | undefined;
    staffId = row?.id ?? null;
  }
  return <LeaderboardClient currentUser={user} currentStaffId={staffId} />;
}
