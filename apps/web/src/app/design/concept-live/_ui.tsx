"use client";

import { useTokens, ACCENT } from "./_theme";

export function PageHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: string }) {
  // Page-level text always dark — sits on the light grey canvas, not on a flipping widget
  return (
    <div className="mb-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-zinc-950">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-500 mt-1 font-semibold">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const t = useTokens();
  return (
    <section className={`${t.card} ${t.cardShadow} rounded-2xl ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({
  title,
  subtitle,
  action,
  accentLine = true,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  accentLine?: boolean;
}) {
  const t = useTokens();
  return (
    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h3 className={`font-bold tracking-tight text-[15px] ${t.text}`}>{title}</h3>
        {subtitle && <p className={`text-[12px] mt-0.5 font-semibold ${t.muted}`}>{subtitle}</p>}
        {accentLine && (
          <span className="inline-block mt-1.5 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <div className="py-12 flex flex-col items-center text-center px-6">
      <div className={`w-12 h-12 rounded-full ${t.iconChip} flex items-center justify-center`}>
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </div>
      <p className={`mt-3 font-bold ${t.text}`}>{title}</p>
      {subtitle && (
        <p className={`text-sm ${t.subtle} mt-1 font-semibold max-w-xs`}>{subtitle}</p>
      )}
    </div>
  );
}
