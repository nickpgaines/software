import TeamSettings from "@/components/TeamSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your team and other preferences.
        </p>
      </div>
      <section>
        <TeamSettings />
      </section>
    </div>
  );
}
