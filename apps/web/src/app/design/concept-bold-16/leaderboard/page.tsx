import { getLeaderboard } from "../../concept-live/_data";
import LeaderboardView from "../../concept-live/leaderboard/LeaderboardView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getLeaderboard();
  return <LeaderboardView rows={rows} />;
}
