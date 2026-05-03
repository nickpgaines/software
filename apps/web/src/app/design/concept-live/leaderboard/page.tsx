import { getLeaderboard } from "../_data";
import LeaderboardView from "./LeaderboardView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getLeaderboard();
  return <LeaderboardView rows={rows} />;
}
