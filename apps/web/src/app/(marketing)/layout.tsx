import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { NativeMarketingGate } from "@/components/marketing/NativeMarketingGate";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NativeMarketingGate>
      <div className="marketing-accent-reset min-h-screen bg-canvas text-fg flex flex-col">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </NativeMarketingGate>
  );
}
