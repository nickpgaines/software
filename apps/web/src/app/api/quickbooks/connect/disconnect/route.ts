import { NextResponse } from "next/server";
import {
  clearQuickbooksConnection,
  getQuickbooksCompany,
  isQuickbooksConfigured,
  revokeToken,
} from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export async function POST() {
  const company = await getQuickbooksCompany();

  if (
    company.quickbooks_refresh_token &&
    isQuickbooksConfigured()
  ) {
    try {
      await revokeToken(company.quickbooks_refresh_token);
    } catch (e) {
      console.error("QuickBooks token revoke failed (continuing):", e);
    }
  }

  await clearQuickbooksConnection();
  return NextResponse.json({ ok: true });
}
