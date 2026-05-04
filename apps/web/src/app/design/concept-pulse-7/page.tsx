import { getIdentity, getTodayJobs, getRevenueThisMonth } from "../concept-live/_data";
import DashboardView from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ firstName, initials }, jobs, revenue] = await Promise.all([
    getIdentity(),
    getTodayJobs(),
    getRevenueThisMonth(),
  ]);
  return (
    <DashboardView
      firstName={firstName}
      initials={initials}
      jobs={jobs}
      revenue={revenue}
    />
  );
}
