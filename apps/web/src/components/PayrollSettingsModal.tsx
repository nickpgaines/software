"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PayPeriodFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

type HourlyTimeCalculation =
  | "scheduled"
  | "en_route_to_complete"
  | "start_to_complete"
  | "day_rate";

type CommissionMode = "flat" | "tiers";

type Tier = { threshold_cents: number; rate: number };
type BonusTier = { threshold_cents: number; amount_cents: number };

export type PayrollSettingsValue = {
  pay_period_frequency: PayPeriodFrequency;
  hourly_time_calculation: HourlyTimeCalculation;
  day_rate_cents: number;
  hourly_bonus_enabled: number;
  hourly_bonus_tiers: string;
  sales_commission_mode: CommissionMode;
  sales_commission_flat_rate: number;
  sales_commission_tiers: string;
  tech_commission_mode: CommissionMode;
  tech_commission_flat_rate: number;
  tech_commission_tiers: string;
  sales_overrides_enabled: number;
  sales_overrides_rate: number;
  tech_overrides_enabled: number;
  tech_overrides_rate: number;
  plan_sale_bonuses_enabled: number;
  plan_sale_bonus_cents: number;
  exclude_one_time_services: number;
};

const PAY_PERIOD_LABELS: Record<PayPeriodFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Semimonthly",
  monthly: "Monthly",
};

const HOURLY_TIME_LABELS: Record<HourlyTimeCalculation, string> = {
  scheduled: "Scheduled time",
  en_route_to_complete: "En route to last job completed",
  start_to_complete: "Start to complete time",
  day_rate: "Fixed day rate",
};

function parseTiers(s: string): Tier[] {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t) => ({
        threshold_cents: Number(t?.threshold_cents) || 0,
        rate: Number(t?.rate) || 0,
      }))
      .sort((a, b) => a.threshold_cents - b.threshold_cents);
  } catch {
    return [];
  }
}

function parseBonusTiers(s: string): BonusTier[] {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t) => ({
        threshold_cents: Number(t?.threshold_cents) || 0,
        amount_cents: Number(t?.amount_cents) || 0,
      }))
      .sort((a, b) => a.threshold_cents - b.threshold_cents);
  } catch {
    return [];
  }
}

function dollarsToCents(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToDollarStr(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

export default function PayrollSettingsModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: PayrollSettingsValue;
  onSaved?: (next: PayrollSettingsValue) => void;
}) {
  const [draft, setDraft] = useState<PayrollSettingsValue>(initial);
  const [salesTiers, setSalesTiers] = useState<Tier[]>(
    parseTiers(initial.sales_commission_tiers)
  );
  const [techTiers, setTechTiers] = useState<Tier[]>(
    parseTiers(initial.tech_commission_tiers)
  );
  const [bonusTiers, setBonusTiers] = useState<BonusTier[]>(
    parseBonusTiers(initial.hourly_bonus_tiers)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setSalesTiers(parseTiers(initial.sales_commission_tiers));
      setTechTiers(parseTiers(initial.tech_commission_tiers));
      setBonusTiers(parseBonusTiers(initial.hourly_bonus_tiers));
      setError(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function patch<K extends keyof PayrollSettingsValue>(
    key: K,
    value: PayrollSettingsValue[K]
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: PayrollSettingsValue = {
      ...draft,
      sales_commission_tiers: JSON.stringify(salesTiers),
      tech_commission_tiers: JSON.stringify(techTiers),
      hourly_bonus_tiers: JSON.stringify(bonusTiers),
    };
    try {
      const res = await fetch("/api/reports/payroll/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Save failed (${res.status})`);
      }
      const next = (await res.json()) as PayrollSettingsValue;
      onSaved?.(next);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-line px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-page-title text-white">
              Payroll Settings
            </h2>
            <p className="text-sm text-zinc-400 mt-3 font-bold">
              Configure pay periods and commission rules.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto w-auto text-zinc-500 hover:text-zinc-300 hover:bg-transparent p-1 -m-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-7">
          <Section title="Pay Period">
            <Field label="Pay period frequency">
              <Select
                value={draft.pay_period_frequency}
                onChange={(v) =>
                  patch("pay_period_frequency", v as PayPeriodFrequency)
                }
                options={(
                  ["weekly", "biweekly", "semimonthly", "monthly"] as const
                ).map((k) => ({ value: k, label: PAY_PERIOD_LABELS[k] }))}
              />
            </Field>

            <Field
              label="Hourly time calculation"
              help="Applies to all employees on hourly pay."
            >
              <Select
                value={draft.hourly_time_calculation}
                onChange={(v) =>
                  patch("hourly_time_calculation", v as HourlyTimeCalculation)
                }
                options={(
                  [
                    "scheduled",
                    "en_route_to_complete",
                    "start_to_complete",
                    "day_rate",
                  ] as const
                ).map((k) => ({ value: k, label: HOURLY_TIME_LABELS[k] }))}
              />
            </Field>

            {draft.hourly_time_calculation === "day_rate" && (
              <Field
                label="Day rate ($)"
                help="Flat amount paid per full day worked."
              >
                <DollarInput
                  cents={draft.day_rate_cents}
                  onChange={(c) => patch("day_rate_cents", c)}
                />
              </Field>
            )}

            <ToggleRow
              title="Daily revenue bonus"
              description="Pay a one-time cash bonus when an hourly employee hits a daily revenue threshold. Add multiple tiers for stacking bonuses."
              checked={draft.hourly_bonus_enabled === 1}
              onChange={(v) => patch("hourly_bonus_enabled", v ? 1 : 0)}
            />
            {draft.hourly_bonus_enabled === 1 && (
              <div className="pl-1">
                <BonusTiersEditor
                  tiers={bonusTiers}
                  onChange={setBonusTiers}
                />
              </div>
            )}
          </Section>

          <Divider />

          <Section
            title="Default Commission"
            subtitle="Pre-filled when adding new employees to payroll."
          >
            <CommissionConfig
              roleLabel="Sales"
              mode={draft.sales_commission_mode}
              onMode={(m) => patch("sales_commission_mode", m)}
              flatRate={draft.sales_commission_flat_rate}
              onFlatRate={(v) => patch("sales_commission_flat_rate", v)}
              tiers={salesTiers}
              onTiers={setSalesTiers}
              flatPlaceholder="e.g. 20"
            />

            <CommissionConfig
              roleLabel="Technician"
              mode={draft.tech_commission_mode}
              onMode={(m) => patch("tech_commission_mode", m)}
              flatRate={draft.tech_commission_flat_rate}
              onFlatRate={(v) => patch("tech_commission_flat_rate", v)}
              tiers={techTiers}
              onTiers={setTechTiers}
              flatPlaceholder="e.g. 15"
            />
          </Section>

          <Divider />

          <Section title="Overrides">
            <ToggleRow
              title="Sales overrides"
              description="Pay reps a percentage of commissions earned by reps under them."
              checked={draft.sales_overrides_enabled === 1}
              onChange={(v) => patch("sales_overrides_enabled", v ? 1 : 0)}
            />
            {draft.sales_overrides_enabled === 1 && (
              <div className="pl-1">
                <Field label="Override rate (%)">
                  <PctInput
                    rate={draft.sales_overrides_rate}
                    onChange={(r) => patch("sales_overrides_rate", r)}
                  />
                </Field>
              </div>
            )}

            <ToggleRow
              title="Technician overrides"
              description="Pay technicians a percentage of commissions earned by techs under them."
              checked={draft.tech_overrides_enabled === 1}
              onChange={(v) => patch("tech_overrides_enabled", v ? 1 : 0)}
            />
            {draft.tech_overrides_enabled === 1 && (
              <div className="pl-1">
                <Field label="Override rate (%)">
                  <PctInput
                    rate={draft.tech_overrides_rate}
                    onChange={(r) => patch("tech_overrides_rate", r)}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Divider />

          <Section title="Plan Sale Bonuses">
            <ToggleRow
              title="Plan sale bonuses"
              description="Pay reps a one-time bonus when they sell a subscription."
              checked={draft.plan_sale_bonuses_enabled === 1}
              onChange={(v) => patch("plan_sale_bonuses_enabled", v ? 1 : 0)}
            />
            {draft.plan_sale_bonuses_enabled === 1 && (
              <div className="pl-1">
                <Field label="Bonus per plan sold ($)">
                  <DollarInput
                    cents={draft.plan_sale_bonus_cents}
                    onChange={(c) => patch("plan_sale_bonus_cents", c)}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Divider />

          <Section title="Job Filter">
            <ToggleRow
              title="Exclude one-time services"
              description="Only include subscription-linked jobs in payroll calculations."
              checked={draft.exclude_one_time_services === 1}
              onChange={(v) => patch("exclude_one_time_services", v ? 1 : 0)}
            />
          </Section>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-line px-6 py-4 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto px-4 py-2 text-eyebrow uppercase text-zinc-500 hover:text-white hover:bg-transparent"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={save}
            disabled={saving}
            className="h-auto px-4 py-2 text-sm font-bold text-white tracking-tight bg-slate-900 hover:bg-slate-800 rounded-full"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-zinc-400 mt-3 font-bold">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line" />;
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="block text-sm font-extrabold text-white tracking-tight">
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-zinc-400">{help}</p>}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  // Native <select> kept: deferred Select migration (custom chevron via background-image, and consistency with other deferred selects).
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full appearance-none border border-line-strong rounded-full px-4 py-2.5 text-sm pr-10 bg-card bg-no-repeat bg-right"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 14px center",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-extrabold text-white tracking-tight">{title}</div>
        <p className="text-sm text-zinc-400 mt-2 font-bold max-w-md">{description}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative h-6 w-11 p-0 shrink-0 rounded-full justify-start hover:bg-current " +
          (checked ? "bg-slate-900 hover:bg-slate-900" : "bg-line hover:bg-line")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 rounded-full bg-card shadow transform transition " +
            (checked ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </Button>
    </div>
  );
}

function CommissionConfig({
  roleLabel,
  mode,
  onMode,
  flatRate,
  onFlatRate,
  tiers,
  onTiers,
  flatPlaceholder,
}: {
  roleLabel: string;
  mode: CommissionMode;
  onMode: (m: CommissionMode) => void;
  flatRate: number;
  onFlatRate: (rate: number) => void;
  tiers: Tier[];
  onTiers: (tiers: Tier[]) => void;
  flatPlaceholder: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-extrabold text-white tracking-tight">{roleLabel}</div>
      <SegmentedControl
        value={mode}
        onChange={onMode}
        options={[
          { value: "flat", label: "Flat rate" },
          { value: "tiers", label: "Commission tiers" },
        ]}
      />
      {mode === "flat" ? (
        <PctInput rate={flatRate} onChange={onFlatRate} placeholder={flatPlaceholder} />
      ) : (
        <TiersEditor tiers={tiers} onChange={onTiers} />
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center bg-black rounded-full p-1 text-sm">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            onClick={() => onChange(o.value)}
            className={
              "h-auto px-4 py-1.5 rounded-full hover:bg-transparent " +
              (active
                ? "bg-card text-white shadow-sm font-bold"
                : "text-zinc-400 hover:text-white font-bold")
            }
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}

function PctInput({
  rate,
  onChange,
  placeholder,
}: {
  rate: number;
  onChange: (rate: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(rate > 0 ? (rate * 100).toFixed(1) : "");
  useEffect(() => {
    setText(rate > 0 ? (rate * 100).toFixed(1) : "");
  }, [rate]);

  function commit(s: string) {
    const v = parseFloat(s);
    if (!Number.isFinite(v)) {
      onChange(0);
      return;
    }
    const r = Math.max(0, Math.min(1, v / 100));
    onChange(r);
  }

  return (
    <div className="relative w-full">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-full h-auto border-line-strong rounded-full px-4 py-2.5 pr-10 text-sm"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        %
      </span>
    </div>
  );
}

function DollarInput({
  cents,
  onChange,
}: {
  cents: number;
  onChange: (cents: number) => void;
}) {
  const [text, setText] = useState(centsToDollarStr(cents));
  useEffect(() => {
    setText(centsToDollarStr(cents));
  }, [cents]);
  return (
    <div className="relative w-full">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        $
      </span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(dollarsToCents(text))}
        placeholder="0.00"
        inputMode="decimal"
        className="w-full h-auto border-line-strong rounded-full pl-8 pr-4 py-2.5 text-sm"
      />
    </div>
  );
}

function TiersEditor({
  tiers,
  onChange,
}: {
  tiers: Tier[];
  onChange: (tiers: Tier[]) => void;
}) {
  function update(idx: number, patch: Partial<Tier>) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    onChange(next);
  }
  function add() {
    const last = tiers[tiers.length - 1];
    const nextThreshold = last ? last.threshold_cents + 100000 : 0;
    onChange([...tiers, { threshold_cents: nextThreshold, rate: 0 }]);
  }
  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {tiers.length === 0 && (
        <p className="text-sm text-zinc-400 font-bold">
          No tiers yet. Add a tier to define a revenue threshold and its rate.
        </p>
      )}
      {tiers.map((t, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 bg-black rounded-2xl p-2"
        >
          <div className="flex-1">
            <Label className="block text-[11px] uppercase tracking-wider text-zinc-400 px-2 font-normal">
              From ($)
            </Label>
            <DollarInput
              cents={t.threshold_cents}
              onChange={(c) => update(idx, { threshold_cents: c })}
            />
          </div>
          <div className="flex-1">
            <Label className="block text-[11px] uppercase tracking-wider text-zinc-400 px-2 font-normal">
              Rate (%)
            </Label>
            <PctInput
              rate={t.rate}
              onChange={(r) => update(idx, { rate: r })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => remove(idx)}
            className="h-auto w-auto text-zinc-500 hover:text-rose-600 hover:bg-transparent p-2"
            aria-label="Remove tier"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={add}
        className="h-auto p-0 gap-1 text-eyebrow uppercase text-zinc-500 hover:text-white hover:bg-transparent"
      >
        <Plus className="w-4 h-4" /> Add tier
      </Button>
    </div>
  );
}

function BonusTiersEditor({
  tiers,
  onChange,
}: {
  tiers: BonusTier[];
  onChange: (tiers: BonusTier[]) => void;
}) {
  function update(idx: number, patch: Partial<BonusTier>) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    onChange(next);
  }
  function add() {
    const last = tiers[tiers.length - 1];
    const nextThreshold = last ? last.threshold_cents + 50000 : 100000;
    const nextAmount = last ? last.amount_cents : 2500;
    onChange([
      ...tiers,
      { threshold_cents: nextThreshold, amount_cents: nextAmount },
    ]);
  }
  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {tiers.length === 0 && (
        <p className="text-sm text-zinc-400 font-bold">
          No bonus tiers yet. Add one to pay a bonus when daily revenue
          reaches a threshold.
        </p>
      )}
      {tiers.map((t, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 bg-black rounded-2xl p-2"
        >
          <div className="flex-1">
            <Label className="block text-[11px] uppercase tracking-wider text-zinc-400 px-2 font-normal">
              Daily revenue ≥ ($)
            </Label>
            <DollarInput
              cents={t.threshold_cents}
              onChange={(c) => update(idx, { threshold_cents: c })}
            />
          </div>
          <div className="flex-1">
            <Label className="block text-[11px] uppercase tracking-wider text-zinc-400 px-2 font-normal">
              Bonus ($)
            </Label>
            <DollarInput
              cents={t.amount_cents}
              onChange={(c) => update(idx, { amount_cents: c })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => remove(idx)}
            className="h-auto w-auto text-zinc-500 hover:text-rose-600 hover:bg-transparent p-2"
            aria-label="Remove bonus tier"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={add}
        className="h-auto p-0 gap-1 text-eyebrow uppercase text-zinc-500 hover:text-white hover:bg-transparent"
      >
        <Plus className="w-4 h-4" /> Add bonus tier
      </Button>
    </div>
  );
}
