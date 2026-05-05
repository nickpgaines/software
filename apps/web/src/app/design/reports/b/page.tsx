import { getReportsOverview } from "../../concept-live/_data";
import ConsoleView from "./ConsoleView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getReportsOverview();
  return <ConsoleView overview={overview} />;
}
