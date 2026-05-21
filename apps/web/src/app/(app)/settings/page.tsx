import SettingsTabs from "@/components/SettingsTabs";
import { getSessionUser } from "@/lib/auth";
import { loadMe } from "@/lib/me";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = getSessionUser() || "";
  // Seed the profile panel server-side so the form doesn't render a
  // "Loading…" placeholder while it client-fetches /api/me.
  const me = await loadMe();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Manage your team, profile, company details, and billing.
        </p>
      </div>
      <SettingsTabs username={user} initialMe={me} />
    </div>
  );
}
