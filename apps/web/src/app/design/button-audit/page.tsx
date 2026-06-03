"use client";

// Visual audit of every button that doesn't conform to the design system.
// Left column = current (violating) markup copied from source, rendered
// with the exact classes from the source file.
// Right column = canonical replacement using the <Button> primitive
// variants from components/ui/button.tsx.

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  line: number;
  what: string;
  why: string;
  current: React.ReactNode;
  canonical: React.ReactNode;
};

type Group = {
  file: string;
  rows: Row[];
};

const GROUPS: Group[] = [
  {
    file: "components/customers/ImportModal.tsx",
    rows: [
      {
        line: 255,
        what: "Cancel (upload step)",
        why: "rounded px-3 py-2 h-auto, manual outline",
        current: (
          <button className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold">
            Cancel
          </button>
        ),
        canonical: <Button variant="outline">Cancel</Button>,
      },
      {
        line: 281,
        what: "Next: preview",
        why: "Manual primary on ghost variant",
        current: (
          <button className="h-auto text-sm bg-primary text-primary-foreground rounded px-3 py-2 font-bold">
            Next: preview
          </button>
        ),
        canonical: <Button>Next: preview</Button>,
      },
      {
        line: 316,
        what: "Importing… (disabled)",
        why: "Legacy bg-slate-400 (pre-design system)",
        current: (
          <button
            disabled
            className="h-auto text-sm bg-slate-400 text-white rounded px-3 py-2 font-bold"
          >
            Importing…
          </button>
        ),
        canonical: <Button disabled>Importing…</Button>,
      },
    ],
  },
  {
    file: "components/subscriptions/SubscriptionImportModal.tsx",
    rows: [
      {
        line: 380,
        what: "Cancel",
        why: "rounded px-3 py-2 h-auto, manual outline",
        current: (
          <button className="h-auto text-sm border border-line-strong bg-card hover:bg-black rounded px-3 py-2 font-bold">
            Cancel
          </button>
        ),
        canonical: <Button variant="outline">Cancel</Button>,
      },
      {
        line: 389,
        what: "Import",
        why: "Manual primary on ghost variant",
        current: (
          <button className="h-auto text-sm bg-primary text-primary-foreground rounded px-3 py-2 font-bold">
            Import
          </button>
        ),
        canonical: <Button>Import</Button>,
      },
    ],
  },
  {
    file: "components/customers/CustomerDetailClient.tsx",
    rows: [
      {
        line: 453,
        what: "Edit",
        why: "rounded px-3 py-2 h-auto, manual primary",
        current: (
          <button className="h-auto text-sm bg-primary text-primary-foreground rounded px-3 py-2 font-bold">
            Edit
          </button>
        ),
        canonical: <Button>Edit</Button>,
      },
      {
        line: 460,
        what: "Delete",
        why: "rounded px-3 py-2 h-auto, manual outline",
        current: (
          <button className="h-auto text-sm border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-2 font-bold">
            Delete
          </button>
        ),
        canonical: <Button variant="outline">Delete</Button>,
      },
      {
        line: 342,
        what: "Add note (small)",
        why: "rounded px-3 py-1.5 h-auto",
        current: (
          <button className="h-auto text-xs font-bold border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-1.5">
            Add note
          </button>
        ),
        canonical: (
          <Button variant="outline" size="sm">
            Add note
          </Button>
        ),
      },
    ],
  },
  {
    file: "app/(app)/employees/EmployeesClient.tsx",
    rows: [
      {
        line: 77,
        what: "Add Employee (desktop)",
        why: "rounded-md (DS wants rounded-xl); raw <a> instead of Button",
        current: (
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="hidden items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground rounded-md px-4 py-2 text-sm font-bold md:inline-flex"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card/15">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            Add Employee
          </a>
        ),
        canonical: (
          <Button asChild>
            <Link href="#" onClick={(e) => e.preventDefault()}>
              <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
              Add Employee
            </Link>
          </Button>
        ),
      },
    ],
  },
  {
    file: "components/LeaderboardClient.tsx",
    rows: [
      {
        line: 170,
        what: "Start new sprint",
        why: "rounded-full px-4 py-2 h-auto (pill misused on form action)",
        current: (
          <button className="h-auto text-sm font-bold border border-line bg-card hover:bg-black text-zinc-300 rounded-full px-4 py-2">
            Start new sprint
          </button>
        ),
        canonical: <Button variant="outline">Start new sprint</Button>,
      },
    ],
  },
  {
    file: "components/JobForm.tsx",
    rows: [
      {
        line: 519,
        what: "Create Job (header)",
        why: "rounded-full px-5 py-2 h-auto, manual primary",
        current: (
          <button className="text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-5 py-2 font-bold shadow-sm h-auto">
            Create Job
          </button>
        ),
        canonical: <Button>Create Job</Button>,
      },
      {
        line: 511,
        what: "Cancel (header link)",
        why: "rounded-full px-4 py-2 raw <a>",
        current: (
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300"
          >
            Cancel
          </a>
        ),
        canonical: (
          <Button asChild variant="outline">
            <Link href="#" onClick={(e) => e.preventDefault()}>
              Cancel
            </Link>
          </Button>
        ),
      },
      {
        line: 568,
        what: "Add line item (chip)",
        why: "rounded-full whitespace-nowrap h-auto",
        current: (
          <button className="text-sm border border-line bg-card hover:bg-black rounded-full px-4 py-2 text-zinc-300 whitespace-nowrap h-auto">
            + Add Item
          </button>
        ),
        canonical: <Button variant="outline">+ Add Item</Button>,
      },
    ],
  },
  {
    file: "components/NewEstimateForm.tsx",
    rows: [
      {
        line: 138,
        what: "Send Estimate",
        why: "rounded-full px-5 py-2.5 h-auto, manual primary",
        current: (
          <button className="text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-full px-5 py-2.5 font-bold shadow-sm h-auto">
            Send Estimate
          </button>
        ),
        canonical: <Button>Send Estimate</Button>,
      },
    ],
  },
  {
    file: "components/JobDetailClient.tsx",
    rows: [
      {
        line: 500,
        what: "Modal action (Mark complete)",
        why: "rounded-2xl px-4 py-3 h-auto (overrides primitive sizing)",
        current: (
          <button className="h-auto rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
            Mark Complete
          </button>
        ),
        canonical: <Button>Mark Complete</Button>,
      },
    ],
  },
  {
    file: "components/jobs/CheckoutModal.tsx (Stripe)",
    rows: [
      {
        line: 98,
        what: "Checkout action",
        why: "rounded-2xl px-4 py-3 h-auto, manual primary",
        current: (
          <button className="h-auto rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
            Charge Card
          </button>
        ),
        canonical: <Button>Charge Card</Button>,
      },
    ],
  },
  {
    file: "components/jobs/RecordPaymentModal.tsx (Stripe)",
    rows: [
      {
        line: 506,
        what: "Record payment",
        why: "rounded-full px-5 py-2 h-auto",
        current: (
          <button className="h-auto rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
            Record Payment
          </button>
        ),
        canonical: <Button>Record Payment</Button>,
      },
      {
        line: 514,
        what: "Cancel",
        why: "rounded-full px-4 py-2 h-auto",
        current: (
          <button className="h-auto rounded-full border border-line bg-card px-4 py-2 text-sm font-bold text-zinc-300">
            Cancel
          </button>
        ),
        canonical: <Button variant="outline">Cancel</Button>,
      },
    ],
  },
  {
    file: "components/jobs/PaymentsSection.tsx (Stripe)",
    rows: [
      {
        line: 81,
        what: "Add payment",
        why: "rounded-full px-4 py-1.5 h-auto",
        current: (
          <button className="h-auto rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
            + Add Payment
          </button>
        ),
        canonical: <Button>+ Add Payment</Button>,
      },
    ],
  },
  {
    file: "components/NewInvoiceForm.tsx (Stripe)",
    rows: [
      {
        line: 0,
        what: "Send Invoice",
        why: "rounded-full px-5 py-2.5 h-auto",
        current: (
          <button className="h-auto rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm">
            Send Invoice
          </button>
        ),
        canonical: <Button>Send Invoice</Button>,
      },
    ],
  },
  {
    file: "components/NewSubscriptionForm.tsx (Stripe)",
    rows: [
      {
        line: 0,
        what: "Create Subscription",
        why: "rounded-full px-5 py-2.5 h-auto",
        current: (
          <button className="h-auto rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm">
            Create Subscription
          </button>
        ),
        canonical: <Button>Create Subscription</Button>,
      },
    ],
  },
  {
    file: "components/SmsWelcomeModal.tsx (Stripe/messaging)",
    rows: [
      {
        line: 71,
        what: "I agree",
        why: "rounded-full px-6 py-2.5 h-auto",
        current: (
          <button className="h-auto rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
            I agree
          </button>
        ),
        canonical: <Button>I agree</Button>,
      },
    ],
  },
];

const BILLING_FILES = new Set([
  "components/jobs/CheckoutModal.tsx (Stripe)",
  "components/jobs/RecordPaymentModal.tsx (Stripe)",
  "components/jobs/PaymentsSection.tsx (Stripe)",
  "components/NewInvoiceForm.tsx (Stripe)",
  "components/NewSubscriptionForm.tsx (Stripe)",
  "components/SmsWelcomeModal.tsx (Stripe/messaging)",
]);

export default function ButtonAuditPage() {
  return (
    <div className="min-h-screen bg-black text-white px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <h1 className="text-page-title text-white">Button audit</h1>
          <p className="mt-3 text-sm font-bold text-zinc-400">
            Every button in the CRM that does not match the design system.
            Left column is the current rendered output; right column is the
            canonical replacement using the <code>&lt;Button&gt;</code>{" "}
            primitive variants (default / outline / sm).
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs font-bold">
            <span className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-300">
              Safe to fix
            </span>
            <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-400">
              Stripe / billing surface (visual swap only)
            </span>
          </div>
        </header>

        {GROUPS.map((group) => {
          const isBilling = BILLING_FILES.has(group.file);
          return (
            <section key={group.file}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-[15px] font-extrabold tracking-tight text-white">
                  {group.file}
                </h2>
                {isBilling && (
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
                    Stripe
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="grid grid-cols-[1fr_auto_1fr_2fr] gap-4 border-b border-line bg-black px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  <div>Current</div>
                  <div></div>
                  <div>Canonical</div>
                  <div>Why</div>
                </div>
                {group.rows.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_1fr_2fr] items-center gap-4 border-b border-line px-5 py-5 last:border-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {row.current}
                    </div>
                    <div className="text-zinc-500">→</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {row.canonical}
                    </div>
                    <div className="text-xs font-bold text-zinc-400">
                      <div className="text-white">{row.what}</div>
                      <div className="mt-1 text-zinc-500">
                        L{row.line} — {row.why}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <footer className="border-t border-line pt-6 text-xs font-bold text-zinc-500">
          Total violations across the codebase: 39 (capped). This page shows
          the representative button per pattern per file.
        </footer>
      </div>
    </div>
  );
}
