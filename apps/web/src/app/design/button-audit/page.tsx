"use client";

// Visual audit: rectangular (rounded-xl) buttons vs pill (rounded-full) buttons.
// Nick wants to standardize everything on pill. Left column shows the current
// rectangular shape; right column shows what it would look like as a pill.
// Every row below is currently rectangular in source.

import Link from "next/link";
import { Plus, Trash2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  line: number;
  label: string;
  variant:
    | "primary"
    | "outline"
    | "ghost"
    | "destructive"
    | "primary-icon"
    | "outline-icon";
  /** Override for the actual displayed label component (if non-trivial). */
  node?: React.ReactNode;
};

type Group = {
  file: string;
  surface: string;
  rows: Row[];
};

// Every entry below is CURRENTLY rectangular (`rounded-xl` from the Button
// primitive default). The pill column shows the proposed `rounded-full` swap.
const RECTANGULAR_GROUPS: Group[] = [
  {
    file: "app/(app)/customers/page.tsx",
    surface: "Customers page header (desktop)",
    rows: [
      { line: 174, label: "Import", variant: "outline" },
      { line: 181, label: "Import subs", variant: "outline" },
      {
        line: 188,
        label: "Customer",
        variant: "primary",
        node: (
          <>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
            Customer
          </>
        ),
      },
    ],
  },
  {
    file: "app/(app)/customers/page.tsx",
    surface: "Customer table row actions",
    rows: [
      { line: 279, label: "Call", variant: "ghost" },
      { line: 294, label: "Edit", variant: "ghost" },
      { line: 301, label: "Delete", variant: "ghost" },
    ],
  },
  {
    file: "app/(app)/employees/EmployeesClient.tsx",
    surface: "Employees page header",
    rows: [
      {
        line: 78,
        label: "Add Employee",
        variant: "primary",
        node: (
          <>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
            Add Employee
          </>
        ),
      },
    ],
  },
  {
    file: "components/customers/ImportModal.tsx",
    surface: "Import customers modal footer",
    rows: [
      { line: 252, label: "Cancel", variant: "outline" },
      { line: 269, label: "Back", variant: "outline" },
      { line: 278, label: "Next: preview", variant: "primary" },
      { line: 291, label: "Back", variant: "outline" },
      { line: 297, label: "Import 12 rows", variant: "primary" },
      { line: 309, label: "Importing…", variant: "primary" },
      { line: 318, label: "Close", variant: "primary" },
    ],
  },
  {
    file: "components/subscriptions/SubscriptionImportModal.tsx",
    surface: "Import subscriptions modal footer",
    rows: [
      { line: 362, label: "Done", variant: "primary" },
      { line: 374, label: "Cancel", variant: "outline" },
      { line: 379, label: "Import 12 subscriptions", variant: "primary" },
    ],
  },
  {
    file: "components/customers/CustomerForm.tsx",
    surface: "New / edit customer dialog footer",
    rows: [
      { line: 169, label: "Cancel", variant: "outline" },
      { line: 172, label: "Save", variant: "primary" },
    ],
  },
  {
    file: "components/customers/CustomerDetailClient.tsx",
    surface: "Customer detail — name row + action trio",
    rows: [
      { line: 340, label: "Edit", variant: "outline" },
      { line: 448, label: "+ Job", variant: "primary" },
      { line: 455, label: "+ Estimate", variant: "outline" },
      { line: 461, label: "Message", variant: "outline" },
    ],
  },
  {
    file: "components/jobs/PaymentsSection.tsx",
    surface: "Payments section row action",
    rows: [
      { line: 140, label: "Delete", variant: "ghost" },
    ],
  },
];

// A handful of pill examples already in production, for reference / contrast.
const PILL_REFERENCES: Group[] = [
  {
    file: "components/JobForm.tsx",
    surface: "Job form header (already pill — Nick likes this)",
    rows: [
      { line: 511, label: "Cancel", variant: "outline" },
      { line: 519, label: "Create Job", variant: "primary" },
    ],
  },
  {
    file: "components/EstimateDetailClient.tsx",
    surface: "Approve & schedule (already pill)",
    rows: [
      { line: 571, label: "Approve & Schedule Job", variant: "primary" },
      { line: 580, label: "Approve without signature", variant: "outline" },
    ],
  },
  {
    file: "components/jobs/RecordPaymentModal.tsx",
    surface: "Record payment modal (already pill)",
    rows: [
      { line: 506, label: "Record Payment", variant: "primary" },
      { line: 514, label: "Cancel", variant: "outline" },
    ],
  },
];

function renderCurrent(r: Row) {
  // Render with the canonical Button primitive (which is rounded-xl by default).
  const content = r.node ?? r.label;
  switch (r.variant) {
    case "primary":
      return <Button>{content}</Button>;
    case "outline":
      return <Button variant="outline">{content}</Button>;
    case "ghost":
      return <Button variant="ghost">{content}</Button>;
    case "destructive":
      return <Button variant="destructive">{content}</Button>;
    case "primary-icon":
      return (
        <Button size="icon" aria-label={r.label}>
          {content}
        </Button>
      );
    case "outline-icon":
      return (
        <Button size="icon" variant="outline" aria-label={r.label}>
          {content}
        </Button>
      );
  }
}

function renderPill(r: Row) {
  const content = r.node ?? r.label;
  switch (r.variant) {
    case "primary":
      return <Button className="rounded-full">{content}</Button>;
    case "outline":
      return (
        <Button variant="outline" className="rounded-full">
          {content}
        </Button>
      );
    case "ghost":
      return (
        <Button variant="ghost" className="rounded-full">
          {content}
        </Button>
      );
    case "destructive":
      return (
        <Button variant="destructive" className="rounded-full">
          {content}
        </Button>
      );
    case "primary-icon":
      return (
        <Button size="icon" className="rounded-full" aria-label={r.label}>
          {content}
        </Button>
      );
    case "outline-icon":
      return (
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          aria-label={r.label}
        >
          {content}
        </Button>
      );
  }
}

function renderPillReference(r: Row) {
  // Already-pill buttons — render as pill in both columns so they don't
  // look like they need a change.
  return renderPill(r);
}

function GroupCard({
  group,
  reference,
}: {
  group: Group;
  reference?: boolean;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-[15px] font-extrabold tracking-tight text-white">
          {group.file}
        </h2>
        <p className="mt-1 text-xs font-bold text-zinc-500">{group.surface}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-[1fr_auto_1fr_2fr] gap-4 border-b border-line bg-black px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          <div>{reference ? "Pill (current)" : "Rectangular (current)"}</div>
          <div></div>
          <div>{reference ? "Pill (no change)" : "Pill (proposed)"}</div>
          <div>Button</div>
        </div>
        {group.rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr_2fr] items-center gap-4 border-b border-line px-5 py-5 last:border-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              {reference ? renderPillReference(row) : renderCurrent(row)}
            </div>
            <div className="text-zinc-500">→</div>
            <div className="flex flex-wrap items-center gap-2">
              {reference ? renderPillReference(row) : renderPill(row)}
            </div>
            <div className="text-xs font-bold">
              <div className="text-white">{row.label}</div>
              <div className="mt-1 text-zinc-500">
                L{row.line} — {row.variant}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ButtonAuditPage() {
  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <h1 className="text-page-title text-white">
            Rectangular → Pill audit
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold text-zinc-400">
            Every button that&rsquo;s currently rectangular (
            <code>rounded-xl</code> from the canonical{" "}
            <code>&lt;Button&gt;</code> primitive). Left column is the current
            shape; right column is the proposed pill (
            <code>rounded-full</code>). Below that, a reference section of
            buttons already shipping as pills.
          </p>
        </header>

        <div className="space-y-10">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Rectangular → would become pill
          </h2>
          {RECTANGULAR_GROUPS.map((g) => (
            <GroupCard key={`${g.file}-${g.surface}`} group={g} />
          ))}
        </div>

        <div className="space-y-10 border-t border-line pt-10">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Already pill (reference)
            </h2>
            <p className="mt-2 text-sm font-bold text-zinc-500">
              These ship as pills today. Showing them here so you can see the
              visual target.
            </p>
          </div>
          {PILL_REFERENCES.map((g) => (
            <GroupCard
              key={`${g.file}-${g.surface}`}
              group={g}
              reference
            />
          ))}
        </div>

        <footer className="border-t border-line pt-6 text-xs font-bold text-zinc-500">
          <p>
            If we go pill-everywhere, the cleanest fix is to flip the{" "}
            <code>&lt;Button&gt;</code> primitive&rsquo;s default radius from{" "}
            <code>rounded-xl</code> to <code>rounded-full</code> in{" "}
            <code>components/ui/button.tsx</code>. Every call site that
            doesn&rsquo;t override <code>rounded-*</code> would update
            automatically; the existing <code>rounded-full</code> overrides
            become no-ops and can be stripped later.
          </p>
        </footer>
      </div>
    </div>
  );
}
