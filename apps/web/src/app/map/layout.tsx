import { PulseSidebar } from "@/components/pulse/Sidebar";
import { PULSE } from "@/components/pulse/theme";
import MobileBottomNav from "@/components/MobileBottomNav";
import { MobileNavShell } from "@/components/MobileNavShell";

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileNavShell>
      <div
        className="min-h-screen"
        style={{ background: PULSE.bg, color: PULSE.text }}
      >
        <PulseSidebar />
        {/* Map is full-bleed (no max-width container) so it can fill the
            viewport beside the sidebar on desktop and fill the screen on
            mobile. */}
        <main className="md:ml-60">{children}</main>
        <MobileBottomNav />
      </div>
    </MobileNavShell>
  );
}
