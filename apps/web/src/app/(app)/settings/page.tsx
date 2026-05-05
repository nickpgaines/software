import SettingsTabs from "@/components/SettingsTabs";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const user = getSessionUser() || "";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Manage your team, profile, company details, and billing.
        </p>
      </div>
      <SettingsTabs username={user} />
    </div>
  );
}
