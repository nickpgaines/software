import PhoneClientProvider from "@/components/PhoneClient";
import { PulseSidebar } from "@/components/pulse/Sidebar";
import { PULSE } from "@/components/pulse/theme";
import SmsWelcomeModal from "@/components/SmsWelcomeModal";
import { AppFrame } from "@/components/AppFrame";
import MobileBottomNav from "@/components/MobileBottomNav";
import { loadMe } from "@/lib/me";
import { GlobalSearchProvider } from "@/components/search/GlobalSearchProvider";
import { TerminalLifecycleProvider } from "@/components/payments/TerminalLifecycle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Load the current user on the server so the sidebar's name + avatar are
  // correct on first paint. Without this seed the sidebar mounts with a
  // "You" placeholder and only fills in after a client-side /api/me round
  // trip, which flashes on every cold navigation.
  const me = await loadMe();
  return (
    <PhoneClientProvider>
      <GlobalSearchProvider>
        <TerminalLifecycleProvider identityKey={`${me?.identity ?? ''}:${me?.staff?.company_id ?? ''}:${me?.staff?.id ?? ''}`}>
        <div
          className="min-h-screen"
          style={{ background: PULSE.bg, color: PULSE.text }}
        >
          <PulseSidebar initialMe={me} />
          <AppFrame>{children}</AppFrame>
          <MobileBottomNav />
          <SmsWelcomeModal />
        </div>
        </TerminalLifecycleProvider>
      </GlobalSearchProvider>
    </PhoneClientProvider>
  );
}
