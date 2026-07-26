import { notFound } from "next/navigation";
import { getDb, type LeadForm } from "@/lib/db";
import PublicFormClient, { type FieldDef } from "./PublicFormClient";

export const dynamic = "force-dynamic";

async function loadForm(slug: string): Promise<{
  form: LeadForm;
  companyName: string;
  fields: FieldDef[];
} | null> {
  const db = await getDb();
  const form = (await db
    .prepare("SELECT * FROM lead_forms WHERE slug = ? LIMIT 1")
    .get(slug)) as LeadForm | undefined;
  if (!form || !form.enabled) return null;
  const company = (await db
    .prepare("SELECT name FROM company WHERE id = ?")
    .get(form.company_id)) as { name: string | null } | undefined;
  let fields: FieldDef[] = [];
  try {
    const parsed = JSON.parse(form.fields);
    if (Array.isArray(parsed)) {
      fields = parsed
        .map((f: unknown) => {
          if (!f || typeof f !== "object") return null;
          const r = f as Record<string, unknown>;
          const key = typeof r.key === "string" ? r.key : null;
          if (!key) return null;
          return {
            key,
            label: typeof r.label === "string" ? r.label : key,
            type: typeof r.type === "string" ? r.type : "text",
            required: r.required === true,
          } as FieldDef;
        })
        .filter((f): f is FieldDef => f !== null);
    }
  } catch {
    fields = [];
  }
  return {
    form,
    companyName: company?.name || "",
    fields,
  };
}

export default async function PublicFormPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadForm(params.slug);
  if (!data) notFound();
  return (
    <PublicFormClient
      slug={params.slug}
      formName={data.form.name}
      companyName={data.companyName}
      fields={data.fields}
    />
  );
}
