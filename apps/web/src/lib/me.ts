import { getDb, syncReplica, type Staff } from "@/lib/db";
import { getSessionContext, type SessionContext } from "@/lib/auth";

export type Me = {
  identity: string;
  is_admin_account: boolean;
  staff: Staff | null;
};

async function lookupStaff(ctx: SessionContext): Promise<Staff | undefined> {
  const db = await getDb();
  if (ctx.staffId != null) {
    const byId = (await db
      .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ? LIMIT 1")
      .get(ctx.staffId, ctx.companyId)) as Staff | undefined;
    if (byId) return byId;
  }
  return (await db
    .prepare(
      "SELECT * FROM staff WHERE LOWER(email) = ? AND company_id = ? ORDER BY id ASC LIMIT 1"
    )
    .get(ctx.identity.toLowerCase(), ctx.companyId)) as Staff | undefined;
}

export async function buildMe(ctx: SessionContext): Promise<Me> {
  if (ctx.isPlatformAdmin) {
    return { identity: ctx.identity, is_admin_account: true, staff: null };
  }
  let staff = await lookupStaff(ctx);
  // If the row isn't visible yet, this instance's embedded replica is
  // probably stale (signup just happened on another instance, or this one
  // hasn't ticked its sync yet). Force a sync and try once more before
  // giving up — much better UX than rendering the email fallback.
  if (!staff && ctx.staffId != null) {
    await syncReplica();
    staff = await lookupStaff(ctx);
  }
  return {
    identity: ctx.identity,
    is_admin_account: false,
    staff: staff ?? null,
  };
}

// Server-side helper for layouts / pages that want the current user
// without going through HTTP. Returns null when there's no session.
export async function loadMe(): Promise<Me | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  return buildMe(ctx);
}
