import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  buildAuthorizeUrl,
  isQuickbooksConfigured,
} from "@/lib/quickbooks";
import { getAppOrigin } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isQuickbooksConfigured()) {
    return NextResponse.json(
      {
        error:
          "QuickBooks isn't configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in the deployment environment.",
      },
      { status: 503 }
    );
  }

  const origin = getAppOrigin(req);
  const redirectUri = `${origin}/api/quickbooks/connect/oauth-callback`;
  const state = randomBytes(16).toString("hex");
  const url = buildAuthorizeUrl(redirectUri, state);

  const res = NextResponse.json({ url });
  res.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
