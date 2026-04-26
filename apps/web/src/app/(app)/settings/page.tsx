import SettingsTabs from "@/components/SettingsTabs";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const user = getSessionUser() || "";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your team, profile, company details, and billing.
        </p>
      </div>
      <SettingsTabs username={user} />
    </div>
  );
}
