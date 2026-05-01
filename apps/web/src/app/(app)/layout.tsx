import NavBar from "@/components/NavBar";
import PhoneClientProvider from "@/components/PhoneClient";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneClientProvider>
      <div className="min-h-screen">
        <NavBar />
        <main className="ml-60">
          <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
        </main>
      </div>
    </PhoneClientProvider>
  );
}
