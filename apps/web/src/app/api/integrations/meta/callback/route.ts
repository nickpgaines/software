import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchManagedPages,
  fetchMetaUser,
  getMetaConfig,
} from "@/lib/meta";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = cookies().get("meta_oauth_state")?.value;

  const integrationsUrl = `${url.origin}/leads/integrations`;

  if (error) {
    return NextResponse.redirect(
      `${integrationsUrl}?meta_error=${encodeURIComponent(error)}`
    );
  }
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(`${integrationsUrl}?meta_error=invalid_state`);
  }
  const cfg = getMetaConfig(url.origin);
  if (!cfg) {
    return NextResponse.redirect(`${integrationsUrl}?meta_error=not_configured`);
  }

  try {
    const short = await exchangeCodeForToken(cfg, code);
    const long = await exchangeForLongLivedToken(cfg, short.access_token);
    const me = await fetchMetaUser(long.access_token);
    const pages = await fetchManagedPages(long.access_token);
    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : null;

    const db = await getDb();
    await db
      .prepare(
        `UPDATE meta_integration
            SET user_id = ?, user_name = ?, access_token = ?,
                token_expires_at = ?, connected_at = datetime('now'),
                updated_at = datetime('now')
          WHERE id = 1`
      )
      .run(me.id, me.name, long.access_token, expiresAt);

    for (const p of pages) {
      await db
        .prepare(
          `INSERT INTO meta_pages (page_id, page_name, page_access_token, enabled)
             VALUES (?, ?, ?, 0)
             ON CONFLICT(page_id) DO UPDATE SET
               page_name = excluded.page_name,
               page_access_token = excluded.page_access_token,
               updated_at = datetime('now')`
        )
        .run(p.id, p.name, p.access_token);
    }

    const res = NextResponse.redirect(`${integrationsUrl}?meta_connected=1`);
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.redirect(
      `${integrationsUrl}?meta_error=${encodeURIComponent(message)}`
    );
  }
}
