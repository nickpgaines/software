import { getUpcomingJobs } from "../../concept-live/_data";
import ScheduleView from "../../concept-live/schedule/ScheduleView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const jobs = await getUpcomingJobs(14);
  return <ScheduleView jobs={jobs} />;
}
