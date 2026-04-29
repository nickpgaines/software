import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getJobDetail } from "@/lib/jobs";
import JobForm from "@/components/JobForm";

export const dynamic = "force-dynamic";

export default function EditJobPage({
  params,
}: {
  params: { id: string };
}) {
  const db = getDb();
  const id = Number(params.id);
  const job = getJobDetail(db, id);
  if (!job) notFound();
  return <JobForm mode="edit" job={job} />;
}
