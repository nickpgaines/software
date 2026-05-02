import LeadsTabs from "@/components/LeadsTabs";

export default function LeadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
        <LeadsTabs />
      </div>
      <div className="border-t border-slate-200" />
      {children}
    </div>
  );
}
