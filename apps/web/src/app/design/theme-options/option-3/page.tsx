import { ThemePreviewShell } from "../_shell";
import { DashboardContent } from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function Option3Page() {
  return (
    <ThemePreviewShell
      option={{
        id: 3,
        label: "Option 3 — Purple + dashes",
        description:
          "Same layout as Option 2 but keeping the existing violet accent.",
        variant: "violet",
      }}
    >
      <DashboardContent accentName />
    </ThemePreviewShell>
  );
}
