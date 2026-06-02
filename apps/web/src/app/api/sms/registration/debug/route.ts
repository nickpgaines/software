import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { getDb, type Company } from "@/lib/db";
import { ensureTenantSubaccount, getPlatformConfig } from "@/lib/twilio-platform";
import {
  fetchCustomerProfile,
  fetchTrustProduct,
  fetchBrandRegistration,
  fetchCampaign,
  listCustomerProfiles,
} from "@/lib/twilio-trust-hub";

export const dynamic = "force-dynamic";

// Admin-only diagnostic: returns Forge's tracked SIDs alongside Twilio's
// actual status for each one. Lets us tell whether a stuck registration is
// because Twilio is genuinely still reviewing, or because Forge has the
// wrong SID stored.
export async function GET() {
  const companyId = await requireCompanyId();
  const cfg = getPlatformConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Platform not configured" }, { status: 500 });
  }

  const db = await getDb();
  const company = await db
    .prepare("SELECT * FROM company WHERE id = ? LIMIT 1")
    .get<Company>(companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  let creds;
  try {
    creds = await ensureTenantSubaccount({
      companyId,
      friendlyName: company.name ?? `tenant-${companyId}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Subaccount: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  async function safeFetch<T>(label: string, fn: () => Promise<T>) {
    try {
      return { ok: true as const, data: await fn() };
    } catch (e) {
      return { ok: false as const, error: `${label}: ${(e as Error).message}` };
    }
  }

  const [cp, tp, brand, campaign, allCps] = await Promise.all([
    company.twilio_customer_profile_sid
      ? safeFetch("CP", () =>
          fetchCustomerProfile({ creds, sid: company.twilio_customer_profile_sid! })
        )
      : Promise.resolve({ ok: false as const, error: "no SID stored" }),
    company.twilio_trust_product_sid
      ? safeFetch("TP", () =>
          fetchTrustProduct({ creds, sid: company.twilio_trust_product_sid! })
        )
      : Promise.resolve({ ok: false as const, error: "no SID stored" }),
    company.twilio_brand_sid
      ? safeFetch("Brand", () =>
          fetchBrandRegistration({ creds, sid: company.twilio_brand_sid! })
        )
      : Promise.resolve({ ok: false as const, error: "no SID stored" }),
    company.twilio_campaign_sid && company.twilio_messaging_service_sid
      ? safeFetch("Campaign", () =>
          fetchCampaign({
            creds,
            messagingServiceSid: company.twilio_messaging_service_sid!,
            campaignSid: company.twilio_campaign_sid!,
          })
        )
      : Promise.resolve({ ok: false as const, error: "no SID stored" }),
    safeFetch("all CPs", () => listCustomerProfiles({ creds })),
  ]);

  return NextResponse.json(
    {
      company_id: companyId,
      forge_state: company.a2p_registration_state,
      forge_error: company.a2p_registration_error,
      subaccount_sid: company.twilio_subaccount_sid,
      stored_sids: {
        customer_profile: company.twilio_customer_profile_sid,
        trust_product: company.twilio_trust_product_sid,
        brand: company.twilio_brand_sid,
        messaging_service: company.twilio_messaging_service_sid,
        campaign: company.twilio_campaign_sid,
      },
      twilio_status: {
        customer_profile: cp,
        trust_product: tp,
        brand,
        campaign,
      },
      all_customer_profiles_in_subaccount: allCps,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
