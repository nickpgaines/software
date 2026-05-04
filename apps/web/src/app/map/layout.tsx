import { PulseSidebar } from "@/components/pulse/Sidebar";
import { PULSE } from "@/components/pulse/theme";

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{ background: PULSE.bg, color: PULSE.text }}
    >
      <PulseSidebar />
      {/* Map is full-bleed (no max-width container) so it can fill the
          viewport beside the sidebar. */}
      <main className="ml-60">{children}</main>
    </div>
  );
}
