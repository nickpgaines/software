import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { PULSE } from "@/components/pulse/theme";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();
  return (
    <div
      className="min-h-screen"
      style={{ background: PULSE.bg, color: PULSE.text }}
    >
      <header
        className="border-b"
        style={{ borderColor: PULSE.cardBorder, background: PULSE.bgAlt }}
      >
        <div className="max-w-app mx-auto px-4 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link
              href="/admin"
              className="text-[18px] font-extrabold tracking-tight"
            >
              Platform admin
            </Link>
            <span
              className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
              style={{
                background: PULSE.text,
                color: PULSE.bg,
              }}
            >
              Internal
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-[12.5px] font-bold"
            style={{ color: PULSE.textSubtle }}
          >
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="max-w-app mx-auto px-4 md:px-10 py-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
