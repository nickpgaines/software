import { notFound } from "next/navigation";
import { getDb, syncReplica, type CustomerSubscription } from "@/lib/db";
import { getJobDetail } from "@/lib/jobs";
import { requireCompanyId } from "@/lib/auth";
import JobDetailClient from "@/components/JobDetailClient";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    console.warn(
      `JobDetailPage: invalid id param "${params.id}" (company ${companyId})`
    );
    notFound();
  }
  // Sync the embedded replica before the first read so the page reflects
  // the latest committed state (fresh creation, price edit, reschedule
  // from another instance). Mirrors GET /api/jobs/[id]; coalesced and a
  // cheap no-op when not in replica mode.
  await syncReplica();
  let job = await getJobDetail(db, id, companyId);
  // A miss here right after creation almost always means the write landed
  // after the sync above started. Force one more sync and retry before
  // 404-ing the user.
  if (!job) {
    await syncReplica();
    job = await getJobDetail(db, id, companyId);
  }
  if (!job) {
    console.warn(
      `JobDetailPage: job ${id} not found for company ${companyId}`
    );
    notFound();
  }

  let subscription: CustomerSubscription | null = null;
  if (job.subscription_id) {
    subscription =
      ((await db
        .prepare(
          "SELECT * FROM customer_subscriptions WHERE id = ? AND company_id = ?"
        )
        .get(job.subscription_id, companyId)) as
        | CustomerSubscription
        | undefined) || null;
  }

  return (
    <JobDetailClient initialJob={job} initialSubscription={subscription} />
  );
}
