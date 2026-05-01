import { NextResponse } from "next/server";
import {
  getQuickbooksCompany,
  isQuickbooksConfigured,
} from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isQuickbooksConfigured();

  try {
    const company = await getQuickbooksCompany();
    const connected = !!company.quickbooks_realm_id;
    return NextResponse.json({
      configured,
      connected,
      realm_id: company.quickbooks_realm_id,
      environment: company.quickbooks_environment,
      company_name: company.quickbooks_company_name,
      connected_at: company.quickbooks_connected_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not load QuickBooks status: ${message}` },
      { status: 500 }
    );
  }
}
