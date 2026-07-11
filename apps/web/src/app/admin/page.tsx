import Link from "next/link";
import { PageHeader } from "@/components/pulse/PageHeader";
import { PULSE } from "@/components/pulse/theme";
import { formatCents, formatCentsShort } from "@/components/pulse/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  loadAdminCompanies,
  loadAdminMetrics,
} from "@/lib/platform-admin-data";
import { relativeFromNow, shortDate } from "./_format";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? "").slice(0, 100);
  const [metrics, companies] = await Promise.all([
    loadAdminMetrics(),
    loadAdminCompanies(q),
  ]);

  return (
    <>
      <PageHeader
        kicker="Overview"
        title="All companies"
        subtitle={`${metrics.total_companies} total · ${metrics.active_companies_30d} active in the last 30 days`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard
          label="Total companies"
          value={String(metrics.total_companies)}
          sub={`${metrics.active_companies_30d} active 30d`}
        />
        <MetricCard
          label="New signups"
          value={String(metrics.new_signups_7d)}
          sub={`${metrics.new_signups_30d} last 30d`}
        />
        <MetricCard
          label="Jobs created"
          value={String(metrics.jobs_30d)}
          sub="last 30 days"
        />
        <MetricCard
          label="Stripe processed"
          value={formatCentsShort(metrics.payments_cents_30d)}
          sub={`${metrics.customers_30d} new customers · 30d`}
        />
      </div>

      <form
        method="get"
        className="mb-5 flex items-center gap-2"
        role="search"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search company name, email, phone, ID, or staff email"
          className="h-10 max-w-md"
        />
        <Button type="submit" variant="secondary" className="h-10">
          Search
        </Button>
        {q && (
          <Button
            asChild
            variant="ghost"
            className="h-10"
            style={{ color: PULSE.textSubtle }}
          >
            <Link href="/admin">Clear</Link>
          </Button>
        )}
      </form>

      <section
        className="rounded-2xl overflow-hidden"
        style={{
          background: PULSE.card,
          border: `1px solid ${PULSE.cardBorder}`,
        }}
      >
        {companies.length === 0 ? (
          <div
            className="py-16 text-center text-sm font-bold"
            style={{ color: PULSE.textSubtle }}
          >
            {q ? `No companies match "${q}".` : "No companies yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Staff</TableHead>
                <TableHead className="hidden md:table-cell">Customers</TableHead>
                <TableHead className="hidden md:table-cell">Jobs</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Stripe processed
                </TableHead>
                <TableHead className="hidden lg:table-cell">Stripe</TableHead>
                <TableHead className="hidden lg:table-cell">SMS</TableHead>
                <TableHead className="hidden md:table-cell">Signed up</TableHead>
                <TableHead className="hidden md:table-cell">
                  Last activity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-bold">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="hover:underline"
                    >
                      <div className="flex items-center gap-2">
                        <span>{c.name || `Company #${c.id}`}</span>
                        {c.access_status === "revoked" && (
                          <span
                            className="text-[10.5px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide"
                            style={{
                              background: `${PULSE.red}1F`,
                              color: PULSE.red,
                            }}
                          >
                            Revoked
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[11.5px] font-bold mt-0.5"
                        style={{ color: PULSE.textSubtle }}
                      >
                        #{c.id}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums">
                    {c.staff_count}
                  </TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums">
                    {c.customers_count}
                  </TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums">
                    {c.jobs_count}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums font-bold">
                    {c.payments_total_cents > 0
                      ? formatCents(c.payments_total_cents)
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StripeBadge
                      connected={!!c.stripe_account_id}
                      chargesEnabled={!!c.stripe_charges_enabled}
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <SmsTierBadge tier={c.sms_tier} />
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell text-sm font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {c.signed_up_at ? shortDate(c.signed_up_at) : "—"}
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell text-sm font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {c.last_activity_at ? relativeFromNow(c.last_activity_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 md:px-5 md:py-5"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div
        className="text-[12.5px] font-semibold"
        style={{ color: PULSE.textSubtle }}
      >
        {label}
      </div>
      <div className="mt-2 text-[24px] md:text-[28px] font-extrabold tracking-tight tabular-nums leading-none">
        {value}
      </div>
      <div
        className="mt-2 text-[12px] font-bold"
        style={{ color: PULSE.textDim }}
      >
        {sub}
      </div>
    </div>
  );
}

function StripeBadge({
  connected,
  chargesEnabled,
}: {
  connected: boolean;
  chargesEnabled: boolean;
}) {
  if (!connected) {
    return (
      <span
        className="text-[11px] px-2 py-0.5 rounded-full font-extrabold"
        style={{
          background: PULSE.bgAlt,
          color: PULSE.textSubtle,
          border: `1px solid ${PULSE.cardBorder}`,
        }}
      >
        Not connected
      </span>
    );
  }
  if (!chargesEnabled) {
    return (
      <span
        className="text-[11px] px-2 py-0.5 rounded-full font-extrabold"
        style={{ background: `${PULSE.red}1F`, color: PULSE.red }}
      >
        Incomplete
      </span>
    );
  }
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-extrabold"
      style={{ background: `${PULSE.green}1F`, color: PULSE.green }}
    >
      Connected
    </span>
  );
}

function SmsTierBadge({ tier }: { tier: string }) {
  const label =
    tier === "paid_approved"
      ? "Approved"
      : tier === "paid_pending_registration"
      ? "Pending"
      : "Trial";
  const color =
    tier === "paid_approved"
      ? PULSE.green
      : tier === "paid_pending_registration"
      ? PULSE.cyan
      : PULSE.textSubtle;
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-extrabold"
      style={{
        background:
          tier === "trial" ? PULSE.bgAlt : `${color}1F`,
        color,
        border:
          tier === "trial" ? `1px solid ${PULSE.cardBorder}` : "none",
      }}
    >
      {label}
    </span>
  );
}
