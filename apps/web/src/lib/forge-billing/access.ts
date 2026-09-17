import { getSessionContext } from "@/lib/auth";
import type { Db } from "@/lib/db";
import { isPlatformAdminRequest } from "@/lib/platform-admin";
import { BILLING_PLANS, type BillingPlan } from "./catalog";
import { BillingError, isForgeBillingEnabled } from "./config";
import {
  assertCompanyNotDeleting,
  getCompanyBillingStatus,
} from "./service";

export type ForgeBillingAccess = {
  allowed: boolean;
  reason:
    | "disabled"
    | "platform_admin"
    | "pre_cutoff"
    | "paid"
    | "subscription_required";
};

export async function getCompanyBillingAccess(
  companyId: number,
  now = new Date()
): Promise<ForgeBillingAccess> {
  if (!isForgeBillingEnabled()) {
    return { allowed: true, reason: "disabled" };
  }
  const status = await getCompanyBillingStatus(companyId, now);
  return { allowed: status.allowed, reason: status.reason };
}

export async function getSessionBillingAccess(): Promise<ForgeBillingAccess> {
  const session = await getSessionContext();
  if (!session) throw new BillingError("Unauthorized", 401);
  if (session.isPlatformAdmin || (await isPlatformAdminRequest())) {
    return { allowed: true, reason: "platform_admin" };
  }
  return getCompanyBillingAccess(session.companyId);
}

export async function requireCompanyBillingAccess(
  companyId: number
): Promise<ForgeBillingAccess> {
  const access = await getCompanyBillingAccess(companyId);
  if (!access.allowed) {
    throw new BillingError("A company subscription is required", 402);
  }
  return access;
}

type SeatState = {
  seat_limit: number | null;
  subscription_status: string | null;
  checkout_plan: BillingPlan | null;
  checkout_status: string | null;
};

/**
 * Call immediately before a staff INSERT, in the same write transaction.
 * This coordinates with both Checkout reservation and deletion transactions.
 */
export async function assertStaffInsertionAllowed(
  db: Db,
  companyId: number,
  releasableCheckoutReservationId: string | null = null
): Promise<void> {
  await assertCompanyNotDeleting(db, companyId);
  if (!isForgeBillingEnabled()) return;

  if (releasableCheckoutReservationId) {
    await db
      .prepare(
        `DELETE FROM forge_billing_checkout
          WHERE company_id = ?
            AND reservation_id = ?
            AND status IN ('complete','expired')`
      )
      .run(companyId, releasableCheckoutReservationId);
  }

  const state = await db
    .prepare(
      `SELECT a.seat_limit,
              a.subscription_status,
              c.plan AS checkout_plan,
              c.status AS checkout_status
         FROM company co
         LEFT JOIN forge_billing_accounts a ON a.company_id = co.id
         LEFT JOIN forge_billing_checkout c ON c.company_id = co.id
         WHERE co.id = ?
        LIMIT 1`
    )
    .get<SeatState>(companyId);
  if (!state) throw new BillingError("Company is no longer available", 409);

  const limits: number[] = [];
  if (
    state.seat_limit != null &&
    ["active", "past_due"].includes(state.subscription_status || "")
  ) {
    limits.push(Number(state.seat_limit));
  }
  if (
    state.checkout_plan &&
    state.checkout_status !== "expired" &&
    BILLING_PLANS[state.checkout_plan]
  ) {
    limits.push(BILLING_PLANS[state.checkout_plan].seats);
  }
  if (limits.length === 0) return;

  const seatLimit = Math.min(...limits);
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM staff WHERE company_id = ?")
    .get<{ count: number }>(companyId);
  if (Number(count?.count ?? 0) >= seatLimit) {
    throw new BillingError(
      `Your current billing plan supports ${seatLimit} employee${
        seatLimit === 1 ? "" : "s"
      }.`,
      409
    );
  }
}
