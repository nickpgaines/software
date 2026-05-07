import { NextResponse } from "next/server";
import { getDb, type Staff } from "@/lib/db";
import { getSessionContext, type SessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: Staff | null;
};

async function buildMe(ctx: SessionContext): Promise<Me> {
  if (ctx.isPlatformAdmin) {
    return { identity: ctx.identity, is_admin_account: true, staff: null };
  }
  const db = await getDb();
  // Look up by staffId from the session — the dashboard's greeting uses the
  // same primary-key lookup, so both surfaces stay consistent. Falling back
  // to a LOWER(email) match could return a different row when stale rows
  // share the email, which produced a flip-flop between greeting and sidebar.
  let staff: Staff | undefined;
  if (ctx.staffId != null) {
    staff = (await db
      .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ? LIMIT 1")
      .get(ctx.staffId, ctx.companyId)) as Staff | undefined;
  }
  if (!staff) {
    staff = (await db
      .prepare(
        "SELECT * FROM staff WHERE LOWER(email) = ? AND company_id = ? ORDER BY id ASC LIMIT 1"
      )
      .get(ctx.identity.toLowerCase(), ctx.companyId)) as Staff | undefined;
  }
  return {
    identity: ctx.identity,
    is_admin_account: false,
    staff: staff ?? null,
  };
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json(await buildMe(ctx));
}

export async function PATCH(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: "The built-in admin account can't be edited here." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    photo_url?: string | null;
  };

  const me = await buildMe(ctx);
  if (!me.staff) {
    return NextResponse.json(
      { error: "No employee record found for this account." },
      { status: 404 }
    );
  }

  if (body.photo_url !== undefined) {
    const db = await getDb();
    await db
      .prepare(
        "UPDATE staff SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(body.photo_url, me.staff.id);
  }

  return NextResponse.json(await buildMe(ctx));
}
