import { NextResponse } from "next/server";
import { getSessionContext, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revokeWidgetTokensForStaff } from "@/lib/widget-auth";

export async function POST() {
  try {
    const ctx = await getSessionContext();
    if (ctx?.staffId != null) {
      const db = await getDb();
      await revokeWidgetTokensForStaff(db, ctx.companyId, ctx.staffId);
    }
  } catch {
    return NextResponse.json(
      { error: "Could not log out." },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
