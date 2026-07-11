import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

// Platform-admin allowlist for the /admin backend dashboard. These accounts
// see *every* tenant's data, deliberately bypassing the company_id scoping
// the rest of the app relies on. Keep this list minimal.
//
// Resolution order:
//   1. The env-admin backdoor login (isPlatformAdmin) always counts.
//   2. PLATFORM_ADMIN_EMAILS env var (comma-separated) if set.
//   3. Otherwise, the founder's email — baked in so /admin works in any
//      environment without per-deploy config.
const DEFAULT_PLATFORM_ADMIN_EMAILS = ["nick@homeserviceascension.com"];

function platformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  if (!raw) return DEFAULT_PLATFORM_ADMIN_EMAILS.map((e) => e.toLowerCase());
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Gate every /admin route. Renders the global not-found page for both
// unauthed users and authed non-admins, so /admin doesn't reveal its
// existence to a curious tenant who finds the path.
export async function requirePlatformAdmin(): Promise<void> {
  if (await isPlatformAdminRequest()) return;
  notFound();
}

// Same allowlist as requirePlatformAdmin, but returns a boolean so API
// routes can return a 404 JSON body instead of throwing notFound() (which
// is for pages).
export async function isPlatformAdminRequest(): Promise<boolean> {
  const ctx = await getSessionContext();
  if (!ctx) return false;
  if (ctx.isPlatformAdmin) return true;
  const allowed = platformAdminEmails();
  return allowed.includes(ctx.identity.toLowerCase());
}
