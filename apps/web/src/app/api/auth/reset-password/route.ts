import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  tokenMatchesCurrentHash,
  validateNewPassword,
  verifyResetToken,
} from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const INVALID_LINK = {
  error:
    "This password-reset link is invalid or has expired. Please request a new one.",
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: unknown;
    password?: unknown;
  };

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json(INVALID_LINK, { status: 400 });

  const passwordCheck = validateNewPassword(body.password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
  }
  const newPassword = passwordCheck.value;

  const verified = verifyResetToken(token);
  if (!verified.ok) {
    return NextResponse.json(INVALID_LINK, { status: 400 });
  }

  const db = await getDb();
  const staff = (await db
    .prepare("SELECT * FROM staff WHERE id = ? LIMIT 1")
    .get(verified.staffId)) as Staff | undefined;

  if (!staff || !staff.password_hash) {
    return NextResponse.json(INVALID_LINK, { status: 400 });
  }

  // Single-use enforcement: the token bound itself to the password hash that
  // was current when the link was minted. If the user has reset their
  // password since (or anything else changed the hash), reject.
  if (!tokenMatchesCurrentHash(verified.hashPrefix, staff.password_hash)) {
    return NextResponse.json(INVALID_LINK, { status: 400 });
  }

  const newHash = hashPassword(newPassword);
  await db
    .prepare(
      "UPDATE staff SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(newHash, staff.id);

  return NextResponse.json({ ok: true });
}
