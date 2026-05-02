import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildOAuthUrl, getMetaConfig } from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const cfg = getMetaConfig(origin);
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Meta integration is not configured. Set META_APP_ID and META_APP_SECRET on the server.",
      },
      { status: 400 }
    );
  }
  const state = crypto.randomBytes(16).toString("hex");
  const url = buildOAuthUrl(cfg, state);
  const res = NextResponse.redirect(url);
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
