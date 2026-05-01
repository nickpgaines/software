import { NextResponse } from "next/server";
import { isStripeConfigured, getAppOrigin } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Starts the Stripe Connect *Standard* OAuth flow — for users who
 * already have a Stripe account and want to connect that one (instead
 * of creating a new Express sub-account).
 *
 * Requires STRIPE_CONNECT_CLIENT_ID (looks like `ca_...`). Get it from
 * Stripe dashboard → Connect → Settings → "OAuth integration".
 *
 * Returns { url } — the frontend redirects there, the user signs in to
 * their existing Stripe and authorizes our platform, then Stripe sends
 * them back to /api/stripe/connect/oauth-callback.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe platform keys are not configured on the server" },
      { status: 503 }
    );
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "OAuth isn't configured. Set STRIPE_CONNECT_CLIENT_ID (Stripe dashboard → Connect → Settings → OAuth).",
      },
      { status: 503 }
    );
  }

  const origin = getAppOrigin(req);
  const redirectUri = `${origin}/api/stripe/connect/oauth-callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    "stripe_user[country]": "US",
  });

  return NextResponse.json({
    url: `https://connect.stripe.com/oauth/authorize?${params.toString()}`,
  });
}
