import {
  buildPlainTextFallback,
  getCompanyForFooter,
  getEmailSettings,
  isEmailConfigured,
  sendEmailViaResend,
} from "@/lib/email";
import {
  getCompanyMessagingStatus,
  normalizeUSPhone,
  sendCompanySms,
} from "@/lib/sms";
import { getDb } from "@/lib/db";

type ReceiptCustomer = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type ReceiptCompany = {
  name: string | null;
  address: string | null;
};

function formatUsd(cents: number): string {
  const dollars = (Number.isFinite(cents) ? cents : 0) / 100;
  return `$${dollars.toFixed(2)}`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptHtml(args: {
  customerName: string | null;
  companyName: string | null;
  amountCents: number;
  tipCents: number;
  method: string;
  paymentDate: string;
}): string {
  const { customerName, companyName, amountCents, tipCents, method, paymentDate } = args;
  const grand = amountCents + (tipCents > 0 ? tipCents : 0);
  const greeting = customerName ? `Hi ${escape(customerName)},` : "Hi,";
  const company = companyName ? escape(companyName) : "us";
  const tipRow =
    tipCents > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Tip</td><td style="padding:4px 0;text-align:right;">${formatUsd(tipCents)}</td></tr>`
      : "";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.5;">
      <p>${greeting}</p>
      <p>Thanks for your payment to ${company}. Here are the details:</p>
      <table style="border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:4px 0;color:#6b7280;">Date</td><td style="padding:4px 0;padding-left:24px;text-align:right;">${escape(paymentDate)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Method</td><td style="padding:4px 0;padding-left:24px;text-align:right;">${escape(method)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Amount</td><td style="padding:4px 0;padding-left:24px;text-align:right;">${formatUsd(amountCents)}</td></tr>
        ${tipRow}
        <tr><td style="padding:8px 0 4px;border-top:1px solid #e5e7eb;font-weight:600;">Total</td><td style="padding:8px 0 4px;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatUsd(grand)}</td></tr>
      </table>
      <p>If anything looks off, just reply to this email and we'll sort it out.</p>
    </div>
  `;
}

function buildReceiptSms(args: {
  companyName: string | null;
  amountCents: number;
  tipCents: number;
}): string {
  const { companyName, amountCents, tipCents } = args;
  const grand = amountCents + (tipCents > 0 ? tipCents : 0);
  const who = companyName || "Us";
  return `${who}: payment of ${formatUsd(grand)} received. Thanks!`;
}

export type SendReceiptInput = {
  jobId: number;
  paymentId: number;
  companyId: number;
  amountCents: number;
  tipCents: number;
  method: string;
  paymentDate: string;
  sendEmail: boolean;
  sendSms: boolean;
};

export async function sendPaymentReceipt(input: SendReceiptInput): Promise<void> {
  if (!input.sendEmail && !input.sendSms) return;

  const db = await getDb();
  const customer = (await db
    .prepare(
      `SELECT c.id, c.name, c.email, c.phone
         FROM jobs j
         JOIN customers c ON c.id = j.customer_id
        WHERE j.id = ? AND j.company_id = ?`
    )
    .get(input.jobId, input.companyId)) as ReceiptCustomer | undefined;
  if (!customer) return;

  let company: ReceiptCompany;
  try {
    company = await getCompanyForFooter(input.companyId);
  } catch {
    company = { name: null, address: null };
  }

  if (input.sendEmail && customer.email && customer.email.trim()) {
    try {
      const settings = await getEmailSettings(input.companyId);
      if (isEmailConfigured(settings)) {
        const html = buildReceiptHtml({
          customerName: customer.name,
          companyName: company.name,
          amountCents: input.amountCents,
          tipCents: input.tipCents,
          method: input.method,
          paymentDate: input.paymentDate,
        });
        // Receipts are transactional, not marketing — skip the unsubscribe
        // footer to avoid implying customers can opt out of payment confirmations.
        const text = buildPlainTextFallback(html);
        await sendEmailViaResend({
          settings,
          to: customer.email.trim(),
          subject: `Payment received${company.name ? ` — ${company.name}` : ""}`,
          html,
          text,
        });
      }
    } catch (e) {
      console.error("Email receipt failed", { paymentId: input.paymentId, error: (e as Error).message });
    }
  }

  if (input.sendSms && customer.phone) {
    try {
      const messaging = await getCompanyMessagingStatus(input.companyId);
      if (messaging.configured) {
        const to = normalizeUSPhone(customer.phone);
        if (to) {
          const body = buildReceiptSms({
            companyName: company.name,
            amountCents: input.amountCents,
            tipCents: input.tipCents,
          });
          await sendCompanySms({ companyId: input.companyId, to, body });
        }
      }
    } catch (e) {
      console.error("SMS receipt failed", { paymentId: input.paymentId, error: (e as Error).message });
    }
  }

}
