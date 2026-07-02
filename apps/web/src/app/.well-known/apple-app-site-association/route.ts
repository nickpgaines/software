import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Apple App Site Association (AASA) for iOS Universal Links — lets email/web
// links like https://www.forgecrm.app/invoices/pay/<token> open directly in the
// Capacitor app instead of Safari. See CAPACITOR_PLAN.md, Phase 2 item 3.
//
// Apple fetches this at https://www.forgecrm.app/.well-known/apple-app-site-association
// (no extension, Content-Type: application/json). The matching native side —
// the Associated Domains entitlement (applinks:www.forgecrm.app) and the app ID
// prefix below — requires the Apple Developer Team ID, which only exists after
// Phase 5 enrollment. Until IOS_APP_ID is set we return 404 so Apple doesn't
// cache an invalid association.
//
// Set IOS_APP_ID = "<TEAM_ID>.app.forgecrm" (not sensitive — it's public by
// design; Apple serves it unauthenticated) once the Apple Developer account
// exists.
const PATHS = [
  "/invoices/pay/*",
  "/estimates/accept/*",
  "/subscriptions/accept/*",
];

export async function GET() {
  const appId = process.env.IOS_APP_ID?.trim();
  if (!appId) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: PATHS.map((p) => ({ "/": p })),
        },
      ],
    },
  });
}
