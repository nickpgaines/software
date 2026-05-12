import { ThemePreviewShell } from "../_shell";
import { DashboardContent } from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function Option1Page() {
  return (
    <ThemePreviewShell
      option={{
        id: 1,
        label: "Option 1 — As-is",
        description: "Current dashboard, no changes.",
        accent: "violet",
        dashes: false,
      }}
    >
      <DashboardContent />
    </ThemePreviewShell>
  );
}
