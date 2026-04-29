import NavBar from "@/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="ml-60 px-8 py-8">{children}</main>
    </div>
  );
}
