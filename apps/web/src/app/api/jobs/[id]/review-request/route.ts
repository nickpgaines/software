import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import {
  DEFAULT_CUSTOMIZATIONS,
  mergeCustomizations,
  type CustomizationConfig,
} from "@/lib/customizations";
import {
  buildPlainTextFallback,
  getCompanyForFooter,
  resolveEmailSender,
  sendEmailViaResend,
} from "@/lib/email";
import {
  getCompanyMessagingStatus,
  normalizeUSPhone,
  sendCompanySms,
} from "@/lib/sms";

export const dynamic = "force-dynamic";

type ConfigRow = { config: string };

async function loadCustomizations(
  companyId: number
): Promise<CustomizationConfig> {
  const db = await getDb();
  const row = (await db
    .prepare(
      "SELECT config FROM customization_settings WHERE company_id = ? LIMIT 1"
    )
    .get(companyId)) as ConfigRow | undefined;
  if (!row) return DEFAULT_CUSTOMIZATIONS;
  try {
    return mergeCustomizations(JSON.parse(row.config));
  } catch {
    return DEFAULT_CUSTOMIZATIONS;
  }
}

function renderTemplate(
  template: string,
  vars: { company_name: string; review_link: string; customer_first_name: string }
): string {
  return template
    .replaceAll("{company_name}", vars.company_name)
    .replaceAll("{review_link}", vars.review_link)
    .replaceAll("{customer_first_name}", vars.customer_first_name);
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = ctx.companyId;
  const jobId = Number(params.id);
  if (!jobId) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const db = await getDb();
  const job = (await db
    .prepare(
      `SELECT j.id, c.name AS customer_name, c.email AS customer_email,
              c.phone AS customer_phone
         FROM jobs j
         JOIN customers c ON c.id = j.customer_id
        WHERE j.id = ? AND j.company_id = ?`
    )
    .get(jobId, companyId)) as
    | {
        id: number;
        customer_name: string | null;
        customer_email: string | null;
        customer_phone: string | null;
      }
    | undefined;
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const config = await loadCustomizations(companyId);
  const block = config.messages.review_request;
  if (!block.enabled) {
    return NextResponse.json(
      { error: "Review requests are disabled in Customizations." },
      { status: 400 }
    );
  }
  if (!block.template.trim()) {
    return NextResponse.json(
      { error: "Review request template is empty in Customizations." },
      { status: 400 }
    );
  }
  if (!config.messages.review_link.trim()) {
    return NextResponse.json(
      { error: "Set a Review Link in Settings → Customizations → Messages." },
      { status: 400 }
    );
  }

  const company = await getCompanyForFooter(companyId);
  const firstName = (job.customer_name || "").trim().split(/\s+/)[0] || "";
  const body = renderTemplate(block.template, {
    company_name: company.name || "us",
    review_link: config.messages.review_link.trim(),
    customer_first_name: firstName,
  });

  const sent = { sms: false, email: false };
  const errors: string[] = [];

  if (job.customer_phone) {
    try {
      const messaging = await getCompanyMessagingStatus(companyId);
      if (messaging.configured) {
        const to = normalizeUSPhone(job.customer_phone);
        if (to) {
          const result = await sendCompanySms({ companyId, to, body });
          if (result.ok) sent.sms = true;
          else if (result.error) errors.push(`SMS: ${result.error}`);
        }
      }
    } catch (e) {
      errors.push(`SMS: ${(e as Error).message}`);
    }
  }

  if (!sent.sms && job.customer_email) {
    try {
      const sender = await resolveEmailSender(companyId);
      if (sender) {
        const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5;"><p>${body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p></div>`;
        const text = buildPlainTextFallback(html);
        const result = await sendEmailViaResend({
          sender,
          to: job.customer_email.trim(),
          subject: `A quick favor${company.name ? ` from ${company.name}` : ""}`,
          html,
          text,
        });
        if (result.ok) sent.email = true;
        else if (result.error) errors.push(`Email: ${result.error}`);
      }
    } catch (e) {
      errors.push(`Email: ${(e as Error).message}`);
    }
  }

  if (!sent.sms && !sent.email) {
    return NextResponse.json(
      {
        error:
          errors[0] ||
          "No SMS or email channel is configured for this company.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ sent });
}
