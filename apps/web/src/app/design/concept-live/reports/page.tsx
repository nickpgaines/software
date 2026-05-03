import { getRevenueThisMonth } from "../_data";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const revenue = await getRevenueThisMonth();
  return <ReportsView revenue={revenue} />;
}
