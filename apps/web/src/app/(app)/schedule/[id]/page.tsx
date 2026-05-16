import { notFound } from "next/navigation";
import { getDb, type CustomerSubscription } from "@/lib/db";
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
  const job = await getJobDetail(db, id, companyId);
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
