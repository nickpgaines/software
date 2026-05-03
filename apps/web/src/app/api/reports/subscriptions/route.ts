import { NextResponse } from "next/server";
import {
  getDb,
  type CustomerSubscription,
  type SubscriptionInterval,
} from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SubRow = CustomerSubscription;

const INTERVALS_PER_YEAR: Record<SubscriptionInterval, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  triannually: 3,
  semiannually: 2,
  yearly: 1,
};

function monthlyCents(price_cents: number, interval: SubscriptionInterval) {
  return (price_cents * INTERVALS_PER_YEAR[interval]) / 12;
}

function withTax(cents: number, taxBps: number, includeTax: boolean) {
  if (!includeTax || !taxBps) return cents;
  return cents * (1 + taxBps / 10000);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function activeStartIso(s: SubRow): string | null {
  return s.start_date || s.accepted_at || s.created_at || null;
}

function intervalsToList(raw: string | null): SubscriptionInterval[] | null {
  if (!raw) return null;
  const all: SubscriptionInterval[] = [
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "triannually",
    "semiannually",
    "yearly",
  ];
  const set = new Set(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );
  return all.filter((v) => set.has(v));
}

function numbersFromCsv(raw: string | null): number[] | null {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? parts : null;
}

export async function GET(req: Request) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const url = new URL(req.url);
  const includeTax = url.searchParams.get("include_tax") !== "0";
  const includeCanceled =
    url.searchParams.get("include_paid_cancellations") !== "0";

  const customerIds = numbersFromCsv(url.searchParams.get("customers"));
  const templateIds = numbersFromCsv(url.searchParams.get("templates"));
  const soldByIds = numbersFromCsv(url.searchParams.get("sold_by"));
  const intervals = intervalsToList(url.searchParams.get("intervals"));

  const rows = (await db
    .prepare(
      `SELECT * FROM customer_subscriptions WHERE company_id = ? ORDER BY created_at ASC, id ASC`
    )
    .all(companyId)) as SubRow[];

  const filtered = rows.filter((r) => {
    if (customerIds && !customerIds.includes(r.customer_id)) return false;
    if (templateIds && (r.template_id == null || !templateIds.includes(r.template_id))) {
      return false;
    }
    if (soldByIds && (r.sold_by_id == null || !soldByIds.includes(r.sold_by_id))) {
      return false;
    }
    if (intervals && !intervals.includes(r.interval)) return false;
    return true;
  });

  const total = filtered.length;
  const active = filtered.filter((r) => r.status === "active").length;
  const pending = filtered.filter((r) => r.status === "pending").length;
  const canceled = filtered.filter((r) => r.status === "canceled").length;
  const declined = filtered.filter((r) => r.status === "declined").length;

  const now = new Date();
  const oneMonthAgoIso = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    now.getDate()
  ).toISOString();

  const currentMrr = filtered.reduce((sum, r) => {
    const isActive = r.status === "active";
    const isRecentCancel =
      includeCanceled &&
      r.status === "canceled" &&
      r.canceled_at !== null &&
      r.canceled_at >= oneMonthAgoIso;
    if (!isActive && !isRecentCancel) return sum;
    return sum + withTax(monthlyCents(r.price_cents, r.interval), r.tax_rate_bps, includeTax);
  }, 0);

  const months: { label: string; iso: string; mrr_cents: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = startOfMonth(ref);
    const mEnd = endOfMonth(ref);
    const mStartIso = mStart.toISOString();
    const mEndIso = mEnd.toISOString();

    let mrr = 0;
    for (const r of filtered) {
      const start = activeStartIso(r);
      if (!start) continue;
      if (start >= mEndIso) continue;
      const end = r.canceled_at;
      if (end && end < mStartIso) {
        if (!(includeCanceled && end >= mStartIso)) continue;
      }
      if (r.status === "pending" || r.status === "declined") continue;
      if (r.status === "canceled" && !includeCanceled) {
        if (end && end < mEndIso) continue;
      }
      mrr += withTax(monthlyCents(r.price_cents, r.interval), r.tax_rate_bps, includeTax);
    }
    months.push({
      label: ref.toLocaleString("en-US", { month: "short" }),
      iso: ref.toISOString().slice(0, 7),
      mrr_cents: Math.round(mrr),
    });
  }

  const arrAdded: {
    label: string;
    iso: string;
    arr_cents: number;
    count: number;
  }[] = [];
  for (let i = 11; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = startOfMonth(ref);
    const mEnd = endOfMonth(ref);
    const mStartIso = mStart.toISOString();
    const mEndIso = mEnd.toISOString();

    let arr = 0;
    let count = 0;
    for (const r of filtered) {
      if (r.status === "pending" || r.status === "declined") continue;
      const start = activeStartIso(r);
      if (!start) continue;
      if (start < mStartIso || start >= mEndIso) continue;
      const annualizedCents =
        monthlyCents(r.price_cents, r.interval) * 12;
      arr += withTax(annualizedCents, r.tax_rate_bps, includeTax);
      count += 1;
    }
    arrAdded.push({
      label: ref.toLocaleString("en-US", { month: "short" }),
      iso: ref.toISOString().slice(0, 7),
      arr_cents: Math.round(arr),
      count,
    });
  }

  const byTemplate = new Map<
    string,
    { template_id: number | null; name: string; count: number; mrr_cents: number }
  >();
  for (const r of filtered) {
    const key = r.template_id == null ? `name:${r.name}` : `id:${r.template_id}`;
    const cur = byTemplate.get(key) || {
      template_id: r.template_id,
      name: r.name,
      count: 0,
      mrr_cents: 0,
    };
    cur.count += 1;
    if (r.status === "active") {
      cur.mrr_cents += withTax(
        monthlyCents(r.price_cents, r.interval),
        r.tax_rate_bps,
        includeTax
      );
    }
    byTemplate.set(key, cur);
  }
  const templatesBreakdown = Array.from(byTemplate.values())
    .map((t) => ({ ...t, mrr_cents: Math.round(t.mrr_cents) }))
    .sort((a, b) => b.mrr_cents - a.mrr_cents);

  const bySoldBy = new Map<
    number,
    { sold_by_id: number; name: string; count: number; mrr_cents: number }
  >();
  const staffRows = (await db
    .prepare(`SELECT id, name FROM staff WHERE company_id = ?`)
    .all(companyId)) as { id: number; name: string }[];
  const staffById = new Map(staffRows.map((s) => [s.id, s.name]));
  for (const r of filtered) {
    if (r.sold_by_id == null) continue;
    const cur = bySoldBy.get(r.sold_by_id) || {
      sold_by_id: r.sold_by_id,
      name: staffById.get(r.sold_by_id) || `Staff #${r.sold_by_id}`,
      count: 0,
      mrr_cents: 0,
    };
    cur.count += 1;
    if (r.status === "active") {
      cur.mrr_cents += withTax(
        monthlyCents(r.price_cents, r.interval),
        r.tax_rate_bps,
        includeTax
      );
    }
    bySoldBy.set(r.sold_by_id, cur);
  }
  const soldByBreakdown = Array.from(bySoldBy.values())
    .map((s) => ({ ...s, mrr_cents: Math.round(s.mrr_cents) }))
    .sort((a, b) => b.mrr_cents - a.mrr_cents);

  const customerRows = (await db
    .prepare(
      `SELECT id, name, first_name, last_name FROM customers WHERE company_id = ? ORDER BY name COLLATE NOCASE ASC`
    )
    .all(companyId)) as { id: number; name: string; first_name: string | null; last_name: string | null }[];
  const templateRows = (await db
    .prepare(
      `SELECT id, name, active FROM subscription_templates WHERE company_id = ? ORDER BY active DESC, name COLLATE NOCASE ASC`
    )
    .all(companyId)) as { id: number; name: string; active: number }[];
  const staffOptions = staffRows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentMrrCents = Math.round(currentMrr);

  return NextResponse.json({
    filters: {
      customers: customerRows.map((c) => ({
        id: c.id,
        name:
          c.name ||
          `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
          `Customer #${c.id}`,
      })),
      templates: templateRows.map((t) => ({
        id: t.id,
        name: t.name,
        active: !!t.active,
      })),
      sold_by: staffOptions,
    },
    options: {
      include_tax: includeTax,
      include_paid_cancellations: includeCanceled,
    },
    totals: {
      total,
      active,
      pending,
      canceled,
      declined,
    },
    revenue: {
      mrr_cents: currentMrrCents,
      arr_cents: currentMrrCents * 12,
    },
    monthly: months,
    arr_added: arrAdded,
    breakdowns: {
      by_template: templatesBreakdown,
      by_sold_by: soldByBreakdown,
    },
  });
}
