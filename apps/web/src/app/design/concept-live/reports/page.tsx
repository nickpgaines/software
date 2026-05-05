import { getReportsOverview } from "../_data";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <ReportsView overview={overview} />;
}
