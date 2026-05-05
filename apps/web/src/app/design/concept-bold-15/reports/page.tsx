import { getReportsOverview } from "../../concept-live/_data";
import ReportsView from "../../concept-live/reports/ReportsView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <ReportsView overview={overview} />;
}
