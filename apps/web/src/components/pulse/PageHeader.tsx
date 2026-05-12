import { PULSE } from "./theme";

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
      <div>
        {kicker && (
          <div
            className="text-sm font-bold mb-3"
            style={{ color: PULSE.textDim }}
          >
            {kicker}
          </div>
        )}
        <h1 className="text-[48px] font-extrabold tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-3 font-bold" style={{ color: PULSE.textMuted }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
