// Temporary preview page used to compare font weights for the Reports
// stat cards. Visit /reports/preview to see the same Jobs +
// Subscriptions sections rendered three times with weights 700, 600,
// and 500 applied to the headline number.

export const dynamic = "force-dynamic";

const WEIGHTS: { weight: 700 | 600 | 500; tw: string; label: string }[] = [
  { weight: 700, tw: "font-bold", label: "700 · font-bold" },
  { weight: 600, tw: "font-semibold", label: "600 · font-semibold" },
  { weight: 500, tw: "font-medium", label: "500 · font-medium" },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function JobCard({
  label,
  count,
  amountCents,
  weightClass,
}: {
  label: string;
  count?: number;
  amountCents: number;
  weightClass: string;
}) {
  const hasCount = typeof count === "number";
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4 flex flex-col min-h-[160px]">
      <div className="text-eyebrow uppercase text-zinc-500">{label}</div>
      <div className="flex-1 flex items-center">
        <div
          className={
            "text-[28px] tracking-tight leading-none tabular-nums text-white " +
            weightClass
          }
        >
          {hasCount ? count : money(amountCents)}
        </div>
      </div>
      {hasCount && (
        <div className="text-sm font-bold text-zinc-300 tabular-nums">
          {money(amountCents)}
        </div>
      )}
    </div>
  );
}

function SubCard({
  label,
  value,
  emerald,
  weightClass,
}: {
  label: string;
  value: string;
  emerald?: boolean;
  weightClass: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4 flex flex-col min-h-[160px]">
      <div className="text-eyebrow uppercase text-zinc-500">{label}</div>
      <div className="flex-1 flex items-center">
        <div
          className={
            "text-[28px] tracking-tight leading-none tabular-nums " +
            (emerald ? "text-emerald-500 " : "text-white ") +
            weightClass
          }
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Variant({ tw, label }: { tw: string; label: string }) {
  return (
    <div className="space-y-6">
      <div className="text-sm font-bold text-white tracking-tight border-b border-line pb-2">
        Variant — {label}
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-zinc-500">
          Jobs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <JobCard
            label="Scheduled"
            count={3}
            amountCents={184699}
            weightClass={tw}
          />
          <JobCard
            label="Completed"
            count={1}
            amountCents={109800}
            weightClass={tw}
          />
          <JobCard
            label="Paid"
            count={1}
            amountCents={109800}
            weightClass={tw}
          />
          <JobCard
            label="Avg Job Value"
            amountCents={61566}
            weightClass={tw}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-zinc-500">
          Subscriptions
        </h2>
        <div className="grid gap-4 lg:grid-cols-3 items-stretch">
          <div className="grid gap-4 grid-cols-2">
            <SubCard label="Total Subscriptions" value="4" weightClass={tw} />
            <SubCard label="Active Subscriptions" value="1" emerald weightClass={tw} />
            <SubCard label="Total MRR" value="$83.00" weightClass={tw} />
            <SubCard label="Total ARR" value="$996.00" weightClass={tw} />
          </div>
          <div className="bg-card border border-line rounded-2xl px-5 py-5 text-sm text-zinc-500 text-center">
            (Donut omitted in this preview — only headline-number weight is being compared.)
          </div>
          <div className="bg-card border border-line rounded-2xl px-5 py-5 text-sm text-zinc-500 text-center">
            (MRR bar chart omitted in this preview.)
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ReportsPreviewPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-page-title text-white">Reports · Weight Preview</h1>
        <p className="text-sm text-zinc-400 mt-3 font-bold">
          Side-by-side comparison of the Jobs and Subscriptions headline-number
          weights at the current 28px size. Currently shipped weight is 800 (font-extrabold).
        </p>
      </div>

      {WEIGHTS.map((w) => (
        <Variant key={w.weight} tw={w.tw} label={w.label} />
      ))}
    </div>
  );
}
