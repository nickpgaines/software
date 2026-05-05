import { getReportsOverview } from "../../concept-live/_data";
import EditorialView from "./EditorialView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <EditorialView overview={overview} />;
}
