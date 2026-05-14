import PhoneClientProvider from "@/components/PhoneClient";
import { PulseSidebar } from "@/components/pulse/Sidebar";
import { PULSE } from "@/components/pulse/theme";
import SmsWelcomeModal from "@/components/SmsWelcomeModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneClientProvider>
      <div
        className="min-h-screen"
        style={{ background: PULSE.bg, color: PULSE.text }}
      >
        <PulseSidebar />
        <main className="ml-60">
          <div className="max-w-app mx-auto px-10 py-10">{children}</div>
        </main>
        <SmsWelcomeModal />
      </div>
    </PhoneClientProvider>
  );
}
