import { getReportsOverview } from "../../concept-live/_data";
import SoftView from "./SoftView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <SoftView overview={overview} />;
}
