import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/pulse/PageHeader";
import { PULSE } from "@/components/pulse/theme";
import { formatCents, formatCentsShort } from "@/components/pulse/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  loadAdminCompanyDetail,
  loadAdminCompanyRecentInvoices,
  loadAdminCompanyRecentJobs,
  loadAdminCompanyStaff,
} from "@/lib/platform-admin-data";
import { relativeFromNow, shortDate, shortDateTime } from "../../_format";

export const dynamic = "force-dynamic";

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const [detail, staff, jobs, invoices] = await Promise.all([
    loadAdminCompanyDetail(id),
    loadAdminCompanyStaff(id),
    loadAdminCompanyRecentJobs(id),
    loadAdminCompanyRecentInvoices(id),
  ]);
  if (!detail) notFound();

  return (
    <>
      <div className="mb-3">
        <Link
          href="/admin"
          className="text-[12.5px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          ← All companies
        </Link>
      </div>

      <PageHeader
        kicker={`Company #${detail.id}`}
        title={detail.name || `Company #${detail.id}`}
        subtitle={
          detail.signed_up_at
            ? `Signed up ${shortDate(detail.signed_up_at)}${
                detail.last_activity_at
                  ? ` · last active ${relativeFromNow(detail.last_activity_at)}`
                  : ""
              }`
            : "No staff record yet"
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <Metric label="Staff" value={String(detail.staff_count)} />
        <Metric label="Customers" value={String(detail.customers_count)} />
        <Metric
          label="Jobs"
          value={String(detail.jobs_count)}
          sub={`${detail.jobs_30d} in last 30d`}
        />
        <Metric
          label="Stripe processed"
          value={formatCentsShort(detail.payments_total_cents)}
          sub={`${detail.invoices_paid_count} of ${detail.invoices_count} invoices paid`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <DetailCard title="Contact">
          <Row label="Name" value={detail.name} />
          <Row label="Email" value={detail.email} />
          <Row label="Phone" value={detail.phone} />
          <Row label="Website" value={detail.website} />
          <Row label="Address" value={detail.address} />
        </DetailCard>

        <DetailCard title="Stripe Connect">
          <Row
            label="Status"
            value={
              detail.stripe_account_id ? (
                detail.stripe_charges_enabled ? (
                  <span style={{ color: PULSE.green }}>Connected · charges enabled</span>
                ) : detail.stripe_details_submitted ? (
                  <span style={{ color: PULSE.cyan }}>Connected · pending review</span>
                ) : (
                  <span style={{ color: PULSE.red }}>Connected · onboarding incomplete</span>
                )
              ) : (
                <span style={{ color: PULSE.textSubtle }}>Not connected</span>
              )
            }
          />
          <Row label="Account ID" value={detail.stripe_account_id || "—"} />
          <Row
            label="Type"
            value={detail.stripe_account_type || "—"}
          />
          <Row
            label="Payouts enabled"
            value={detail.stripe_payouts_enabled ? "Yes" : "No"}
          />
          <Row
            label="Details submitted"
            value={detail.stripe_details_submitted ? "Yes" : "No"}
          />
          {detail.stripe_account_id && (
            <div className="pt-2">
              <a
                href={`https://dashboard.stripe.com/connect/accounts/${detail.stripe_account_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-extrabold"
                style={{ color: PULSE.violetVar }}
              >
                Open in Stripe →
              </a>
            </div>
          )}
        </DetailCard>

        <DetailCard title="SMS / A2P">
          <Row label="Tier" value={detail.sms_tier} />
          <Row
            label="Dedicated number"
            value={detail.sms_dedicated_number || "—"}
          />
          <Row
            label="Trial pool number"
            value={detail.sms_trial_pool_number || "—"}
          />
          <Row label="A2P state" value={detail.a2p_registration_state} />
          {detail.a2p_registration_error && (
            <Row
              label="Last A2P error"
              value={
                <span style={{ color: PULSE.red }}>
                  {detail.a2p_registration_error}
                </span>
              }
            />
          )}
        </DetailCard>

        <DetailCard title="Lifecycle">
          <Row
            label="Signed up"
            value={detail.signed_up_at ? shortDateTime(detail.signed_up_at) : "—"}
          />
          <Row
            label="Last activity"
            value={
              detail.last_activity_at
                ? `${shortDateTime(detail.last_activity_at)} (${relativeFromNow(detail.last_activity_at)})`
                : "—"
            }
          />
        </DetailCard>
      </div>

      <SectionCard title="Staff" count={staff.length}>
        {staff.length === 0 ? (
          <EmptyRow>No staff.</EmptyRow>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => {
                const displayName =
                  [s.first_name, s.last_name].filter(Boolean).join(" ") ||
                  s.name ||
                  s.email ||
                  `Staff #${s.id}`;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{displayName}</TableCell>
                    <TableCell
                      className="font-bold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {s.email || "—"}
                    </TableCell>
                    <TableCell
                      className="font-bold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {s.permission_level}
                    </TableCell>
                    <TableCell
                      className="font-bold"
                      style={{ color: PULSE.textSubtle }}
                    >
                      {shortDate(s.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Recent jobs" count={jobs.length}>
        {jobs.length === 0 ? (
          <EmptyRow>No jobs.</EmptyRow>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-bold">
                    {j.customer_name || "—"}
                  </TableCell>
                  <TableCell
                    className="font-bold capitalize"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {j.status.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCents(j.price_cents)}
                  </TableCell>
                  <TableCell
                    className="font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {shortDateTime(j.scheduled_at)}
                  </TableCell>
                  <TableCell
                    className="font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {relativeFromNow(j.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Recent invoices" count={invoices.length}>
        {invoices.length === 0 ? (
          <EmptyRow>No invoices.</EmptyRow>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-bold">
                    {inv.customer_name || "—"}
                  </TableCell>
                  <TableCell
                    className="font-bold capitalize"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {inv.status}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCents(inv.total_cents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCents(inv.paid_cents)}
                  </TableCell>
                  <TableCell
                    className="font-bold"
                    style={{ color: PULSE.textSubtle }}
                  >
                    {relativeFromNow(inv.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && (
        <div
          className="mt-2 text-[12px] font-bold"
          style={{ color: PULSE.textDim }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-5 md:p-6"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <h2 className="text-[15px] font-extrabold tracking-tight mb-4">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <div className="font-bold shrink-0" style={{ color: PULSE.textSubtle }}>
        {label}
      </div>
      <div className="font-bold text-right break-all">
        {value === null || value === undefined || value === "" ? (
          <span style={{ color: PULSE.textDim }}>—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden mb-6"
      style={{
        background: PULSE.card,
        border: `1px solid ${PULSE.cardBorder}`,
      }}
    >
      <div className="px-5 md:px-6 py-4 flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold tracking-tight">{title}</h2>
        <span
          className="text-[12px] font-bold"
          style={{ color: PULSE.textSubtle }}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="py-10 text-center text-sm font-bold"
      style={{ color: PULSE.textSubtle }}
    >
      {children}
    </div>
  );
}
