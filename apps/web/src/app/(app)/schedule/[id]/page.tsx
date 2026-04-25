import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getJobDetail } from "@/lib/jobs";
import JobDetailClient from "@/components/JobDetailClient";

export const dynamic = "force-dynamic";

export default function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const db = getDb();
  const id = Number(params.id);
  const job = getJobDetail(db, id);
  if (!job) notFound();
  return <JobDetailClient initialJob={job} />;
}
