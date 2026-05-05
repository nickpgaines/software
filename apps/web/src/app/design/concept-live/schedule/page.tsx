import { getUpcomingJobs } from "../_data";
import ScheduleView from "./ScheduleView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const jobs = await getUpcomingJobs(14);
  return <ScheduleView jobs={jobs} />;
}
