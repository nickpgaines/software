import PhoneClientProvider from "@/components/PhoneClient";
import { PulseSidebar } from "@/components/pulse/Sidebar";
import { PULSE } from "@/components/pulse/theme";
import SmsWelcomeModal from "@/components/SmsWelcomeModal";
import { AppFrame } from "@/components/AppFrame";
import {
  MobileMenuButton,
  MobileNavShell,
} from "@/components/MobileNavShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneClientProvider>
      <MobileNavShell>
        <div
          className="min-h-screen"
          style={{ background: PULSE.bg, color: PULSE.text }}
        >
          <PulseSidebar />
          <MobileMenuButton />
          <AppFrame>{children}</AppFrame>
          <SmsWelcomeModal />
        </div>
      </MobileNavShell>
    </PhoneClientProvider>
  );
}
