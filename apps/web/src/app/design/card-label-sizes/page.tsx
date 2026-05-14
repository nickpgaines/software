// Preview page for Reports stat-card label sizing.
// Four side-by-side options at 12 / 14 / 16 / 18 px for the top mini-heading
// and the bottom mini-footer. Both lines share the same boldness in every
// option; only the size and color (zinc-300 top / zinc-500 bottom) vary.
// Center value is locked at 32 px to match production.

const OPTIONS = [
  { size: 12, label: "12 px (current)", twClass: "text-xs" },
  { size: 14, label: "14 px", twClass: "text-sm" },
  { size: 16, label: "16 px", twClass: "text-base" },
  { size: 18, label: "18 px", twClass: "text-lg" },
];

const SAMPLE = [
  { label: "Scheduled", count: 3, amount: 1800_00 },
  { label: "Completed", count: 1, amount: 615_66 },
  { label: "Paid", count: 1, amount: 615_66 },
  { label: "Avg Job Value", count: null as number | null, amount: 615_66 },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function JobStatCard({
  label,
  count,
  amount,
  topClass,
  bottomClass,
}: {
  label: string;
  count: number | null;
  amount: number;
  topClass: string;
  bottomClass: string;
}) {
  const hasCount = typeof count === "number";
  return (
    <div className="bg-card border border-line rounded-2xl px-5 py-4 flex flex-col min-h-[140px]">
      <div className={`${topClass} font-bold text-zinc-300`}>{label}</div>
      <div className="flex-1 flex items-center">
        <div className="text-[32px] font-bold tracking-tight leading-none tabular-nums text-white">
          {hasCount ? count : money(amount)}
        </div>
      </div>
      {hasCount ? (
        <div className={`${bottomClass} font-bold text-zinc-500 tabular-nums`}>
          {money(amount)}
        </div>
      ) : (
        <div className={`${bottomClass} font-bold text-zinc-500 leading-tight truncate`}>
          Per completed job
        </div>
      )}
    </div>
  );
}

export default function CardLabelSizesPreview() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-xs text-zinc-400 mb-3 font-bold">
            Reports — Card label sizing
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-4">
            Mini heading + footer size options
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Four variants of the Reports stat card. Top mini-heading and
            bottom mini-footer share the same weight (font-bold) in every
            option; only the size and color vary. Center value stays locked
            at 32 px. Pick the option that reads best.
          </p>
        </div>

        <div className="space-y-12">
          {OPTIONS.map((opt) => (
            <section key={opt.size}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-xl font-extrabold tracking-tight">
                  {opt.label}
                </h2>
                <span className="text-sm font-bold text-zinc-500">
                  top + bottom = {opt.size} px · center = 32 px
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {SAMPLE.map((s) => (
                  <JobStatCard
                    key={s.label}
                    label={s.label}
                    count={s.count}
                    amount={s.amount}
                    topClass={opt.twClass}
                    bottomClass={opt.twClass}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
