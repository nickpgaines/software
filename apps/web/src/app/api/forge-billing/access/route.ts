import { NextResponse } from "next/server";
import { BillingError } from "@/lib/forge-billing/config";
import { getSessionBillingAccess } from "@/lib/forge-billing/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    return NextResponse.json(await getSessionBillingAccess(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof BillingError ? error.status : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "unauthorized"
            : "Billing access is temporarily unavailable.",
      },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
