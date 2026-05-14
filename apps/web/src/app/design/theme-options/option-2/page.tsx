import { ThemePreviewShell } from "../_shell";
import { DashboardContent } from "../_dashboard";

export const dynamic = "force-dynamic";

export default async function Option2Page() {
  return (
    <ThemePreviewShell
      option={{
        id: 2,
        label: "Option 2 — Blue + dashes",
        description:
          "Screenshot styling. Blue accent everywhere, accent dash under every section title.",
        variant: "blue",
      }}
    >
      <DashboardContent accentName />
    </ThemePreviewShell>
  );
}
