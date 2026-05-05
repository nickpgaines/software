import { getReportsOverview } from "../../concept-live/_data";
import BentoView from "./BentoView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <BentoView overview={overview} />;
}
