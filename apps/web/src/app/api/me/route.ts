import { NextResponse } from "next/server";
import { getDb, syncReplica } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { buildMe } from "@/lib/me";

export const dynamic = "force-dynamic";

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
    // Push the write through the local replica so subsequent reads on this
    // instance — and a router.refresh() that lands here — see the new photo
    // immediately instead of falling back to initials.
    await syncReplica();
  }

  return NextResponse.json(await buildMe(ctx));
}
