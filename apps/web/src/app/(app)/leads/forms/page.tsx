import LeadsFormsClient from "@/components/LeadsFormsClient";
import { getDb, type LeadForm } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsFormsPage() {
  const db = await getDb();
  const forms = (await db
    .prepare("SELECT * FROM lead_forms ORDER BY created_at DESC")
    .all()) as LeadForm[];
  return <LeadsFormsClient initialForms={forms} />;
}
