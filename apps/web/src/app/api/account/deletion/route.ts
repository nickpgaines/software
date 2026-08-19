import { NextResponse } from "next/server";
import twilio from "twilio";
import {
  decideSelfDeletion,
  type AccountDeletionDecision,
} from "@/lib/account-deletion-policy";
import {
  getSessionContext,
  SESSION_COOKIE,
  type SessionContext,
} from "@/lib/auth";
import { getDb, syncReplica, type Company, type Db, type Staff } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getMasterCreds } from "@/lib/twilio-platform";

export const dynamic = "force-dynamic";

type DeletionState = {
  staff: Pick<Staff, "id" | "company_id" | "password_hash" | "permission_level">;
  company: Company;
  employeeCount: number;
  adminCount: number;
};

type DeletionPreview = {
  scope: "employee" | "organization";
  companyName: string;
  employeeCount: number;
  adminCount: number;
  blockedReason: "last_admin" | null;
};

async function readDeletionState(
  db: Db,
  ctx: SessionContext
): Promise<DeletionState | null> {
  if (ctx.isPlatformAdmin || ctx.staffId == null) return null;

  const staff = await db
    .prepare(
      `SELECT id, company_id, password_hash, permission_level
         FROM staff
        WHERE id = ? AND company_id = ?
        LIMIT 1`
    )
    .get<DeletionState["staff"]>(ctx.staffId, ctx.companyId);
  if (!staff) return null;

  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(ctx.companyId);
  if (!company) return null;

  const counts = await db
    .prepare(
      `SELECT
         COUNT(*) AS employee_count,
         SUM(CASE WHEN permission_level = 'admin' THEN 1 ELSE 0 END) AS admin_count
       FROM staff
       WHERE company_id = ?`
    )
    .get<{ employee_count: number; admin_count: number | null }>(ctx.companyId);

  return {
    staff,
    company,
    employeeCount: Number(counts?.employee_count ?? 0),
    adminCount: Number(counts?.admin_count ?? 0),
  };
}

function decisionFor(state: DeletionState): AccountDeletionDecision {
  return decideSelfDeletion({
    employeeCount: state.employeeCount,
    adminCount: state.adminCount,
    actorIsAdmin: state.staff.permission_level === "admin",
  });
}

function toPreview(state: DeletionState): DeletionPreview {
  const decision = decisionFor(state);
  return {
    scope: decision.kind === "organization" ? "organization" : "employee",
    companyName: state.company.name?.trim() || "this organization",
    employeeCount: state.employeeCount,
    adminCount: state.adminCount,
    blockedReason: decision.kind === "blocked" ? "last_admin" : null,
  };
}

function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function cleanupConnectedServices(company: Company) {
  const tasks: Array<Promise<void>> = [];

  if (
    company.stripe_account_id &&
    company.stripe_account_type === "standard" &&
    isStripeConfigured() &&
    process.env.STRIPE_CONNECT_CLIENT_ID?.trim()
  ) {
    tasks.push(
      getStripe()
        .oauth.deauthorize({
          client_id: process.env.STRIPE_CONNECT_CLIENT_ID.trim(),
          stripe_user_id: company.stripe_account_id,
        })
        .then(() => undefined)
    );
  }

  if (company.twilio_subaccount_sid) {
    const master = getMasterCreds();
    if (master) {
      tasks.push(
        twilio(master.accountSid, master.authToken).api.v2010
          .accounts(company.twilio_subaccount_sid)
          .update({ status: "closed" })
          .then(() => undefined)
      );
    }
  }

  const settled = await Promise.allSettled(tasks);
  for (const result of settled) {
    if (result.status === "rejected") {
      console.error("Account deletion provider cleanup failed:", result.reason);
    }
  }
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (ctx.isPlatformAdmin || ctx.staffId == null) {
    return NextResponse.json(
      { error: "This account cannot be deleted here." },
      { status: 403 }
    );
  }

  const state = await readDeletionState(await getDb(), ctx);
  if (!state) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json(toPreview(state));
}

type DeleteBody = {
  password?: string;
  confirmation?: string;
  expected_scope?: "employee" | "organization";
};

type DeleteResult =
  | { kind: "deleted"; scope: "employee" | "organization"; company?: Company }
  | { kind: "error"; status: number; error: string };

export async function DELETE(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (ctx.isPlatformAdmin || ctx.staffId == null) {
    return NextResponse.json(
      { error: "This account cannot be deleted here." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as DeleteBody;
  const password = body.password || "";
  if (!password) {
    return NextResponse.json({ error: "Current password is required." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.transaction(async (tx): Promise<DeleteResult> => {
    const state = await readDeletionState(tx, ctx);
    if (!state) {
      return { kind: "error", status: 401, error: "Your account is no longer available." };
    }
    if (!state.staff.password_hash || !verifyPassword(password, state.staff.password_hash)) {
      return { kind: "error", status: 401, error: "Current password is incorrect." };
    }

    const decision = decisionFor(state);
    if (decision.kind === "blocked") {
      return {
        kind: "error",
        status: 409,
        error: "Promote another employee to administrator before deleting your account.",
      };
    }

    const scope = decision.kind;
    if (body.expected_scope && body.expected_scope !== scope) {
      return {
        kind: "error",
        status: 409,
        error: "Your team changed. Review the updated deletion details and try again.",
      };
    }
    if (scope === "organization" && body.confirmation !== "DELETE") {
      return {
        kind: "error",
        status: 400,
        error: "Type DELETE to confirm organization deletion.",
      };
    }

    if (scope === "employee") {
      await tx
        .prepare("DELETE FROM staff WHERE id = ? AND company_id = ?")
        .run(state.staff.id, ctx.companyId);
      return { kind: "deleted", scope };
    }

    await tx.prepare("DELETE FROM company WHERE id = ?").run(ctx.companyId);
    return { kind: "deleted", scope, company: state.company };
  });

  if (result.kind === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await syncReplica();
  if (result.company) await cleanupConnectedServices(result.company);

  const res = NextResponse.json({ ok: true, scope: result.scope });
  clearSession(res);
  return res;
}
