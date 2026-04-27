import { NextResponse } from "next/server";
import { getDb, type Payment, type PaymentMethod } from "@/lib/db";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["card", "cash", "check", "e_transfer", "other"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const jobId = Number(params.id);
  const rows = db
    .prepare(
      "SELECT * FROM payments WHERE job_id = ? ORDER BY created_at DESC, id DESC"
    )
    .all(jobId) as Payment[];
  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const jobId = Number(params.id);

  const job = db.prepare("SELECT id FROM jobs WHERE id = ?").get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    amount_cents: number;
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

  const result = db
    .prepare(
      `INSERT INTO payments
         (job_id, amount_cents, method, payment_date, notes, send_email, send_sms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      jobId,
      amountCents,
      method,
      payment_date,
      body.notes ? String(body.notes) : null,
      send_email,
      send_sms
    );
  const created = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(result.lastInsertRowid) as Payment;

  // TODO(post-vercel): wire real email/SMS sending via Resend + Twilio.
  // The toggle values are persisted on the payment record so we can
  // reconcile later when the senders go live.
  if (send_email) {
    console.log(
      "TODO: Send email receipt for payment",
      created.id,
      "on job",
      jobId
    );
  }
  if (send_sms) {
    console.log(
      "TODO: Send SMS receipt for payment",
      created.id,
      "on job",
      jobId
    );
  }

  return NextResponse.json(created, { status: 201 });
}
