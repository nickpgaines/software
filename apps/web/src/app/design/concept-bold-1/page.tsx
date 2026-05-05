import { BoldDashboard } from "../_bold";
import { boldConfig } from "./_config";
import { getIdentity, getTodayJobs, getRevenueThisMonth } from "../concept-live/_data";

export const dynamic = "force-dynamic";

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Page() {
  const [{ firstName }, jobs, revenue] = await Promise.all([
    getIdentity(),
    getTodayJobs(),
    getRevenueThisMonth(),
  ]);
  return (
    <BoldDashboard
      config={boldConfig}
      greeting={greeting(new Date().getHours())}
      firstName={firstName}
      jobs={jobs}
      revenue={revenue}
    />
  );
}
