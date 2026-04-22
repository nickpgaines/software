import LeaderboardClient from "@/components/LeaderboardClient";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  const user = getSessionUser() || "";
  return <LeaderboardClient currentUser={user} />;
}
