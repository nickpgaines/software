/**
 * Marketing screenshot — invoice detail.
 *
 * Static, server-compatible visual representation of `InvoiceDetailClient`
 * (see `apps/web/src/components/InvoiceDetailClient.tsx`). The live client
 * fetches the invoice, customer, and line-items from three API routes and
 * carries state for the "Send" / "Mark Paid" dialogs. This screenshot is
 * a hand-rolled facsimile with no state, no client directives.
 *
 * Visual language follows the dashboard tokens in `pulse/theme.ts` — a
 * `rounded-2xl` card on `PULSE.card` with a 1px `PULSE.cardBorder`, Inter
 * `font-extrabold` / `font-black` headlines, `tracking-tight`. The two
 * top-row action buttons match the styling of the live invoice page
 * (`InvoiceDetailClient.tsx:121-139`) but are rendered as `<div>` so the
 * component stays server-compatible and non-interactive.
 */

import { PULSE } from "@/components/pulse/theme";

/* --------------------------------------------------------------------- */
/*  Seeded invoice                                                       */
/* --------------------------------------------------------------------- */

type LineItem = {
  title: string;
  description?: string;
  quantity: number;
  unitCents: number;
};

const LINE_ITEMS: LineItem[] = [
  {
    title: "Window Cleaning — Exterior",
    description: "Residential, 2-story · 22 panes",
    quantity: 1,
    unitCents: 22000,
  },
  {
    title: "Window Cleaning — Interior",
    description: "Residential, 2-story · 22 panes",
    quantity: 1,
    unitCents: 14000,
  },
  {
    title: "Screen Repair",
    description: "Re-screen + frame straighten",
    quantity: 2,
    unitCents: 3000,
  },
  {
    title: "Hard Water Treatment",
    description: "South-facing front elevation",
    quantity: 1,
    unitCents: 4500,
  },
];

const SUBTOTAL_CENTS = LINE_ITEMS.reduce(
  (s, it) => s + it.quantity * it.unitCents,
  0,
);
const TAX_CENTS = Math.round(SUBTOTAL_CENTS * 0.0825);
const TOTAL_CENTS = SUBTOTAL_CENTS + TAX_CENTS;
const PAID_CENTS = TOTAL_CENTS;
const BALANCE_CENTS = Math.max(0, TOTAL_CENTS - PAID_CENTS);

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* --------------------------------------------------------------------- */
/*  Small atoms                                                          */
/* --------------------------------------------------------------------- */

function ActionPill({
  label,
  primary,
}: {
  label: string;
  primary?: boolean;
}) {
  // Static <div> styled like the live InvoiceDetailClient buttons
  // (lines 121-139). Server-compatible, non-interactive.
  if (primary) {
    return (
      <div className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold tracking-tight text-primary-foreground">
        {label}
      </div>
    );
  }
  return (
    <div
      className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold tracking-tight"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
        color: PULSE.text,
      }}
    >
      {label}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "total" | "paid" | "balance";
}) {
  const labelColor =
    emphasis === "total" ? PULSE.text : PULSE.textMuted;
  const valueColor =
    emphasis === "paid"
      ? PULSE.green
      : emphasis === "total"
        ? PULSE.text
        : PULSE.text;
  return (
    <div className="flex items-center justify-between">
      <div
        className={`text-[12px] ${emphasis === "total" ? "font-extrabold tracking-tight" : "font-bold"}`}
        style={{ color: labelColor }}
      >
        {label}
      </div>
      <div
        className={`text-[13px] tabular-nums ${emphasis === "total" ? "font-black tracking-tight" : "font-bold"}`}
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Component                                                            */
/* --------------------------------------------------------------------- */

export function PaymentsScreenshot() {
  return (
    <section
      className="w-full rounded-2xl p-6"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      {/* Top row: invoice number + status pill + actions ---------------- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Invoice
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h3
              className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums"
              style={{ color: PULSE.text }}
            >
              INV-1247
            </h3>
            {/* PAID status pill — emerald scheme (positive/paid). */}
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-tight"
              style={{
                background: `${PULSE.green}1F`,
                color: PULSE.green,
              }}
            >
              PAID
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionPill label="Send Invoice" primary />
          <ActionPill label="Record Payment" />
        </div>
      </div>

      {/* 2-column row: invoice meta (left), customer (right) ------------- */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Invoice details */}
        <div
          className="rounded-xl p-4"
          style={{
            background: PULSE.bgAlt,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <div
            className="mb-3 text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Invoice Details
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-bold"
                style={{ color: PULSE.textMuted }}
              >
                Issued
              </span>
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{ color: PULSE.text }}
              >
                Apr 10, 2026
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-bold"
                style={{ color: PULSE.textMuted }}
              >
                Due
              </span>
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{ color: PULSE.text }}
              >
                Apr 24, 2026
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-bold"
                style={{ color: PULSE.textMuted }}
              >
                Terms
              </span>
              <span
                className="text-[12px] font-bold"
                style={{ color: PULSE.text }}
              >
                Net 14
              </span>
            </div>
          </div>
        </div>

        {/* Customer card */}
        <div
          className="rounded-xl p-4"
          style={{
            background: PULSE.bgAlt,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <div
            className="mb-3 text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Customer
          </div>
          <div
            className="text-[14px] font-extrabold tracking-tight"
            style={{ color: PULSE.text }}
          >
            Mountain View Window Co.
          </div>
          <div
            className="mt-1 text-[12px] font-bold"
            style={{ color: PULSE.textMuted }}
          >
            1428 Alpine Ridge Rd
          </div>
          <div
            className="text-[12px] font-bold"
            style={{ color: PULSE.textMuted }}
          >
            Boulder, CO 80302
          </div>
          <div
            className="mt-2 text-[12px] font-bold tabular-nums"
            style={{ color: PULSE.textMuted }}
          >
            (303) 555-0142
          </div>
          <div
            className="text-[12px] font-bold"
            style={{ color: PULSE.textMuted }}
          >
            ops@mvwindow.co
          </div>
        </div>
      </div>

      {/* Line items table ----------------------------------------------- */}
      <div
        className="mb-5 overflow-hidden rounded-xl"
        style={{
          background: PULSE.bgAlt,
          border: `1px solid ${PULSE.cardBorder}`,
        }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[1fr_56px_96px_96px] gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${PULSE.cardBorder}` }}
        >
          <div
            className="text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Description
          </div>
          <div
            className="text-right text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Qty
          </div>
          <div
            className="text-right text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Unit
          </div>
          <div
            className="text-right text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Total
          </div>
        </div>

        {/* Rows */}
        {LINE_ITEMS.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_56px_96px_96px] items-start gap-3 px-4 py-3"
            style={{
              borderBottom:
                i < LINE_ITEMS.length - 1
                  ? `1px solid ${PULSE.cardBorder}`
                  : "none",
            }}
          >
            <div>
              <div
                className="text-[13px] font-bold tracking-tight"
                style={{ color: PULSE.text }}
              >
                {it.title}
              </div>
              {it.description && (
                <div
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: PULSE.textMuted }}
                >
                  {it.description}
                </div>
              )}
            </div>
            <div
              className="text-right text-[13px] font-bold tabular-nums"
              style={{ color: PULSE.text }}
            >
              {it.quantity}
            </div>
            <div
              className="text-right text-[13px] font-bold tabular-nums"
              style={{ color: PULSE.textMuted }}
            >
              {fmt(it.unitCents)}
            </div>
            <div
              className="text-right text-[13px] font-bold tabular-nums"
              style={{ color: PULSE.text }}
            >
              {fmt(it.quantity * it.unitCents)}
            </div>
          </div>
        ))}
      </div>

      {/* Summary + payment history -------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Summary */}
        <div
          className="rounded-xl p-4"
          style={{
            background: PULSE.bgAlt,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <div className="space-y-2">
            <SummaryRow label="Subtotal" value={fmt(SUBTOTAL_CENTS)} />
            <SummaryRow label="Tax (8.25%)" value={fmt(TAX_CENTS)} />
            <div
              className="pt-2"
              style={{ borderTop: `1px solid ${PULSE.cardBorder}` }}
            >
              <SummaryRow
                label="Total"
                value={fmt(TOTAL_CENTS)}
                emphasis="total"
              />
            </div>
            <SummaryRow
              label="Paid"
              value={fmt(PAID_CENTS)}
              emphasis="paid"
            />
            <SummaryRow
              label="Balance"
              value={fmt(BALANCE_CENTS)}
              emphasis="balance"
            />
          </div>
        </div>

        {/* Payment history */}
        <div
          className="rounded-xl p-4"
          style={{
            background: PULSE.bgAlt,
            border: `1px solid ${PULSE.cardBorder}`,
          }}
        >
          <div
            className="mb-3 text-[11px] font-extrabold tracking-tight"
            style={{ color: PULSE.textSubtle }}
          >
            Payment History
          </div>
          <div
            className="flex items-center gap-3 rounded-lg p-3"
            style={{
              background: PULSE.card,
              border: `1px solid ${PULSE.cardBorder}`,
            }}
          >
            {/* Card chip glyph */}
            <div
              className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md"
              style={{
                background: PULSE.bg,
                border: `1px solid ${PULSE.cardBorderHi}`,
              }}
            >
              <span
                className="text-[10px] font-black tracking-tight"
                style={{ color: PULSE.text }}
              >
                VISA
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[13px] font-bold tracking-tight tabular-nums"
                style={{ color: PULSE.text }}
              >
                Visa •••• 4242
              </div>
              <div
                className="mt-0.5 text-[11px] font-bold"
                style={{ color: PULSE.textMuted }}
              >
                Paid via Stripe · Apr 18
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[14px] font-black tracking-tight tabular-nums"
                style={{ color: PULSE.green }}
              >
                {fmt(PAID_CENTS)}
              </div>
              {/* Stripe attribution */}
              <div
                className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-extrabold tracking-tight"
                style={{ color: PULSE.textSubtle }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: PULSE.violetVar }}
                />
                stripe
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
