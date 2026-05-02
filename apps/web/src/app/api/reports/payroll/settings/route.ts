import { NextResponse } from "next/server";
import { getDb, type PayrollSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAY_PERIOD_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
] as const;
const HOURLY_TIME_CALCULATIONS = [
  "scheduled",
  "en_route_to_complete",
  "start_to_complete",
  "day_rate",
] as const;
const COMMISSION_MODES = ["flat", "tiers"] as const;

type Tier = { threshold_cents: number; rate: number };
type BonusTier = { threshold_cents: number; amount_cents: number };

function normalizeTiers(input: unknown): Tier[] {
  if (!Array.isArray(input)) return [];
  const out: Tier[] = [];
  for (const t of input) {
    if (!t || typeof t !== "object") continue;
    const threshold = Number((t as { threshold_cents?: unknown }).threshold_cents);
    const rate = Number((t as { rate?: unknown }).rate);
    if (!Number.isFinite(threshold) || threshold < 0) continue;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) continue;
    out.push({ threshold_cents: Math.round(threshold), rate });
  }
  out.sort((a, b) => a.threshold_cents - b.threshold_cents);
  return out;
}

function normalizeBonusTiers(input: unknown): BonusTier[] {
  if (!Array.isArray(input)) return [];
  const out: BonusTier[] = [];
  for (const t of input) {
    if (!t || typeof t !== "object") continue;
    const threshold = Number((t as { threshold_cents?: unknown }).threshold_cents);
    const amount = Number((t as { amount_cents?: unknown }).amount_cents);
    if (!Number.isFinite(threshold) || threshold < 0) continue;
    if (!Number.isFinite(amount) || amount < 0) continue;
    out.push({
      threshold_cents: Math.round(threshold),
      amount_cents: Math.round(amount),
    });
  }
  out.sort((a, b) => a.threshold_cents - b.threshold_cents);
  return out;
}

export async function GET() {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT * FROM payroll_settings WHERE id = 1`)
    .get<PayrollSettings>();
  if (!row) {
    await db.prepare(`INSERT OR IGNORE INTO payroll_settings (id) VALUES (1)`).run();
    const fresh = await db
      .prepare(`SELECT * FROM payroll_settings WHERE id = 1`)
      .get<PayrollSettings>();
    return NextResponse.json(fresh);
  }
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string | number> = {};

  if (typeof body.pay_period_frequency === "string") {
    if (!PAY_PERIOD_FREQUENCIES.includes(body.pay_period_frequency as (typeof PAY_PERIOD_FREQUENCIES)[number])) {
      return NextResponse.json({ error: "Invalid pay_period_frequency" }, { status: 400 });
    }
    updates.pay_period_frequency = body.pay_period_frequency;
  }

  if (typeof body.hourly_time_calculation === "string") {
    if (!HOURLY_TIME_CALCULATIONS.includes(body.hourly_time_calculation as (typeof HOURLY_TIME_CALCULATIONS)[number])) {
      return NextResponse.json({ error: "Invalid hourly_time_calculation" }, { status: 400 });
    }
    updates.hourly_time_calculation = body.hourly_time_calculation;
  }

  if (body.day_rate_cents != null) {
    const v = Number(body.day_rate_cents);
    if (!Number.isFinite(v) || v < 0)
      return NextResponse.json({ error: "Invalid day_rate_cents" }, { status: 400 });
    updates.day_rate_cents = Math.round(v);
  }
  if (body.hourly_bonus_enabled != null) {
    updates.hourly_bonus_enabled = body.hourly_bonus_enabled ? 1 : 0;
  }
  if (body.hourly_bonus_tiers != null) {
    updates.hourly_bonus_tiers = JSON.stringify(
      normalizeBonusTiers(body.hourly_bonus_tiers)
    );
  }

  for (const role of ["sales", "tech"] as const) {
    const modeKey = `${role}_commission_mode` as const;
    const flatKey = `${role}_commission_flat_rate` as const;
    const tiersKey = `${role}_commission_tiers` as const;
    if (typeof body[modeKey] === "string") {
      if (!COMMISSION_MODES.includes(body[modeKey] as (typeof COMMISSION_MODES)[number])) {
        return NextResponse.json({ error: `Invalid ${modeKey}` }, { status: 400 });
      }
      updates[modeKey] = body[modeKey] as string;
    }
    if (body[flatKey] != null) {
      const v = Number(body[flatKey]);
      if (!Number.isFinite(v) || v < 0 || v > 1)
        return NextResponse.json({ error: `Invalid ${flatKey}` }, { status: 400 });
      updates[flatKey] = v;
    }
    if (body[tiersKey] != null) {
      updates[tiersKey] = JSON.stringify(normalizeTiers(body[tiersKey]));
    }
  }

  for (const role of ["sales", "tech"] as const) {
    const enabledKey = `${role}_overrides_enabled` as const;
    const rateKey = `${role}_overrides_rate` as const;
    if (body[enabledKey] != null) updates[enabledKey] = body[enabledKey] ? 1 : 0;
    if (body[rateKey] != null) {
      const v = Number(body[rateKey]);
      if (!Number.isFinite(v) || v < 0 || v > 1)
        return NextResponse.json({ error: `Invalid ${rateKey}` }, { status: 400 });
      updates[rateKey] = v;
    }
  }

  if (body.plan_sale_bonuses_enabled != null) {
    updates.plan_sale_bonuses_enabled = body.plan_sale_bonuses_enabled ? 1 : 0;
  }
  if (body.plan_sale_bonus_cents != null) {
    const v = Number(body.plan_sale_bonus_cents);
    if (!Number.isFinite(v) || v < 0)
      return NextResponse.json({ error: "Invalid plan_sale_bonus_cents" }, { status: 400 });
    updates.plan_sale_bonus_cents = Math.round(v);
  }

  if (body.exclude_one_time_services != null) {
    updates.exclude_one_time_services = body.exclude_one_time_services ? 1 : 0;
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    const row = await (await getDb())
      .prepare(`SELECT * FROM payroll_settings WHERE id = 1`)
      .get<PayrollSettings>();
    return NextResponse.json(row);
  }

  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const args = keys.map((k) => updates[k]);
  args.push(new Date().toISOString());
  const db = await getDb();
  await db
    .prepare(`UPDATE payroll_settings SET ${sets}, updated_at = ? WHERE id = 1`)
    .run(...args);
  const row = await db
    .prepare(`SELECT * FROM payroll_settings WHERE id = 1`)
    .get<PayrollSettings>();
  return NextResponse.json(row);
}
