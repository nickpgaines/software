import { NextResponse } from "next/server";
import { getDb, type Payment, type PaymentMethod } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { autoCompleteSteps } from "@/lib/jobs";
import { sendPaymentReceipt } from "@/lib/payment-receipts";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["card", "cash", "check", "e_transfer", "other"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const jobId = Number(params.id);
  const rows = (await db
    .prepare(
      `SELECT p.* FROM payments p
         JOIN jobs j ON j.id = p.job_id
        WHERE p.job_id = ? AND j.company_id = ?
        ORDER BY p.created_at DESC, p.id DESC`
    )
    .all(jobId, companyId)) as Payment[];
  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const jobId = Number(params.id);

  const job = await db
    .prepare("SELECT id FROM jobs WHERE id = ? AND company_id = ?")
    .get(jobId, companyId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
    tip: number;
    tip_cents: number;
    method: string;
    notes: string | null;
    send_email: boolean | number;
    send_sms: boolean | number;
  }>;

  const amount = Number(body.amount_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }
  const amountCents = Math.round(amount);

  // Tip is optional: accept either `tip` (dollars) or `tip_cents`
  // (cents). Default to 0. Reject negative values.
  let tipCents = 0;
  if (body.tip_cents !== undefined && body.tip_cents !== null) {
    const v = Number(body.tip_cents);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json(
        { error: "Tip must be zero or greater" },
        { status: 400 }
      );
    }
    tipCents = Math.round(v);
  } else if (body.tip !== undefined && body.tip !== null) {
    const v = Number(body.tip);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json(
        { error: "Tip must be zero or greater" },
        { status: 400 }
      );
    }
    tipCents = Math.round(v * 100);
  }

  const method = String(body.method || "") as PaymentMethod;
  if (!METHODS.includes(method)) {
    return NextResponse.json(
      { error: `method must be one of ${METHODS.join(", ")}` },
      { status: 400 }
    );
  }

  // payment_date is no longer accepted from the client. Stamp it
  // server-side as today (YYYY-MM-DD, server clock) so the column
  // stays populated for any read path that uses it.
  const payment_date = new Date().toISOString().slice(0, 10);

  const send_email = body.send_email ? 1 : 0;
  const send_sms = body.send_sms ? 1 : 0;

  // Atomic: insert the payment row AND auto-complete any unset work
  // steps in the same transaction. If anything throws, BOTH the row
  // and the step timestamps roll back.
  const insertedId = await db.transaction(async (tx) => {
    const result = await tx
      .prepare(
        `INSERT INTO payments
           (company_id, job_id, amount_cents, tip_cents, method, payment_date, notes, send_email, send_sms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        companyId,
        jobId,
        amountCents,
        tipCents,
        method,
        payment_date,
        body.notes ? String(body.notes) : null,
        send_email,
        send_sms
      );
    await autoCompleteSteps(tx, jobId, companyId);
    return Number(result.lastInsertRowid);
  });

  const created = (await db
    .prepare("SELECT * FROM payments WHERE id = ? AND company_id = ?")
    .get(insertedId, companyId)) as Payment;

  if (send_email || send_sms) {
    await sendPaymentReceipt({
      jobId,
      paymentId: created.id,
      companyId,
      amountCents: created.amount_cents,
      tipCents: created.tip_cents ?? 0,
      method,
      paymentDate: created.payment_date || payment_date,
      sendEmail: !!send_email,
      sendSms: !!send_sms,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
