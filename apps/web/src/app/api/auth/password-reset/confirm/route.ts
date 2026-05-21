import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

type TokenRow = {
  id: number;
  staff_id: number;
  expires_at: string;
  used_at: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token || !password) {
    return NextResponse.json(
      { error: "Missing token or password." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const tokenHash = hashResetToken(token);
  const row = (await db
    .prepare(
      `SELECT id, staff_id, expires_at, used_at
         FROM password_reset_tokens
        WHERE token_hash = ?
        LIMIT 1`
    )
    .get(tokenHash)) as TokenRow | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const newHash = hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .prepare("UPDATE staff SET password_hash = ? WHERE id = ?")
      .run(newHash, row.staff_id);
    await tx
      .prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?"
      )
      .run(row.id);
    // Invalidate any other outstanding reset tokens for this staff member so a
    // second leaked link can't also be redeemed.
    await tx
      .prepare(
        `UPDATE password_reset_tokens
            SET used_at = datetime('now')
          WHERE staff_id = ? AND used_at IS NULL AND id != ?`
      )
      .run(row.staff_id, row.id);
  });

  return NextResponse.json({ ok: true });
}
