import { NextResponse } from "next/server";
import { getDb, syncReplica, type LeadForm, type Lead } from "@/lib/db";
import { fireTrigger } from "@/lib/lead-workflows";

export const dynamic = "force-dynamic";

// Public, no-auth submission endpoint. Looks up a form by its opaque
// slug, validates the payload against the form's saved field schema,
// inserts a lead, increments submit_count, and fires the lead_created
// trigger so any matching workflows kick off immediately.

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
};

// Field keys that map 1:1 onto columns of the leads table. Anything else
// flows into the notes column as a "Label: value" block and is also
// preserved verbatim in raw_payload.
const STANDARD_KEYS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "address",
]);

function parseFields(raw: string | null | undefined): FieldDef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f) => {
        if (!f || typeof f !== "object") return null;
        const key = typeof f.key === "string" ? f.key : null;
        const label = typeof f.label === "string" ? f.label : key;
        if (!key) return null;
        return {
          key,
          label: label || key,
          type: typeof f.type === "string" ? f.type : "text",
          required: f.required === true,
        } as FieldDef;
      })
      .filter((f): f is FieldDef => f !== null);
  } catch {
    return [];
  }
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const db = await getDb();
  const lookup = () =>
    db
      .prepare("SELECT * FROM lead_forms WHERE slug = ? LIMIT 1")
      .get(params.slug) as Promise<LeadForm | undefined>;
  let form = await lookup();
  // Embedded-replica miss recovery: a form created moments ago on a
  // different instance may not yet have synced here. Pull and retry once
  // before 404ing the submission.
  if (!form) {
    await syncReplica();
    form = await lookup();
  }
  if (!form || !form.enabled) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Honeypot: a hidden "website" field that real users never fill.
  // Bots that auto-fill every input trip it; pretend the submission
  // succeeded so they don't get a signal to retry with a different
  // strategy.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const fields = parseFields(form.fields);

  // Validate required fields.
  const values: Record<string, string> = {};
  for (const f of fields) {
    const raw = body[f.key];
    const val =
      typeof raw === "string"
        ? raw.trim()
        : raw == null
        ? ""
        : String(raw).trim();
    if (f.required && !val) {
      return NextResponse.json(
        { error: `${f.label} is required.` },
        { status: 400 }
      );
    }
    if (val) values[f.key] = val;
  }

  // Pull standard fields onto the dedicated leads columns; everything
  // else goes into notes as a labeled block.
  const first = values["first_name"] || null;
  const last = values["last_name"] || null;
  const email = values["email"] || null;
  const phone = values["phone"] || null;
  const address = values["address"] || null;

  // Require at least one way to contact the person — otherwise a submit
  // with everything blank but no required fields would produce a useless
  // empty lead.
  if (!first && !last && !email && !phone) {
    return NextResponse.json(
      { error: "Please provide a name, email, or phone." },
      { status: 400 }
    );
  }

  const extras = fields.filter(
    (f) => !STANDARD_KEYS.has(f.key) && values[f.key]
  );
  const notes = extras.length
    ? extras.map((f) => `${f.label}: ${values[f.key]}`).join("\n")
    : null;

  const result = await db
    .prepare(
      `INSERT INTO leads
         (company_id, first_name, last_name, email, phone, address, source,
          source_form_id, source_form_name,
          stage, notes, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, 'form', ?, ?, 'new', ?, ?)`
    )
    .run(
      form.company_id,
      first,
      last,
      email,
      phone,
      address,
      String(form.id),
      form.name,
      notes,
      JSON.stringify(values)
    );

  const created = (await db
    .prepare("SELECT * FROM leads WHERE id = ? AND company_id = ?")
    .get(result.lastInsertRowid, form.company_id)) as Lead;

  await db
    .prepare(
      `UPDATE lead_forms
         SET submit_count = submit_count + 1, updated_at = datetime('now')
       WHERE id = ? AND company_id = ?`
    )
    .run(form.id, form.company_id);

  await fireTrigger({
    companyId: form.company_id,
    leadId: created.id,
    trigger: "lead_created",
  });

  return NextResponse.json({ ok: true });
}
