"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, Upload } from "lucide-react";
import ImportModal from "@/components/customers/ImportModal";
import SubscriptionCsvImportModal from "@/components/subscriptions/SubscriptionCsvImportModal";
import JobsImportModal from "@/components/jobs/JobsImportModal";
import CustomerForm from "@/components/customers/CustomerForm";
import { usePhone } from "@/components/PhoneClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Customer = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_line1: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  notes: string | null;
};

function fullName(c: { first_name: string | null; last_name: string | null }) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export default function CustomersPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CustomersPage />
    </Suspense>
  );
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [attachPinId, setAttachPinId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingSubs, setImportingSubs] = useState(false);
  const [importingJobs, setImportingJobs] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const phone = usePhone();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const haystack = [
        fullName(c),
        c.name,
        c.phone || "",
        c.email || "",
        c.address || "",
        c.formatted_address || "",
        c.city || "",
        c.state || "",
        c.zip || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customers, query]);

  async function load() {
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as Customer[];
      setCustomers(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const pin = searchParams.get("attach_pin");
      const pinId = pin ? Number(pin) : NaN;
      setAttachPinId(Number.isFinite(pinId) ? pinId : null);
      setCreating(true);
      router.replace("/customers");
    }
  }, [searchParams, router]);

  async function del(id: number) {
    if (!confirm("Delete this customer and all their jobs?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-page-title text-white">Customers</h1>
            <p className="hidden text-sm text-zinc-400 mt-3 font-bold md:block">
              People you clean windows for.
            </p>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              onClick={() => setImporting(true)}
              aria-label="Import customers"
              className="h-10 w-10 shrink-0 rounded-full border border-line-strong bg-card hover:bg-black text-zinc-300 p-0"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCreating(true)}
              aria-label="Add customer"
              className="h-10 w-10 shrink-0 rounded-full bg-primary hover:opacity-90 text-primary-foreground p-0"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:flex-none md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers"
              className="w-full rounded-full pl-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setImporting(true)}
            className="hidden md:inline-flex"
          >
            Import
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportingSubs(true)}
            className="hidden md:inline-flex"
            title="Upload a subscriptions CSV. Cards get collected at the next service visit via the accept link."
          >
            Import subs
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportingJobs(true)}
            className="hidden md:inline-flex"
          >
            Import jobs
          </Button>
          <Button
            onClick={() => setCreating(true)}
            className="hidden md:inline-flex"
          >
            <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
            Customer
          </Button>
        </div>
      </div>

      {loading ? (
        /* First fetch still in flight: lightweight skeleton so the page
           never flashes "No customers yet." before the data arrives. */
        <Card className="overflow-hidden divide-y divide-line" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-elevated" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="block h-3 w-40 max-w-full animate-pulse rounded bg-elevated" />
                <span className="block h-3 w-64 max-w-full animate-pulse rounded bg-elevated" />
              </span>
            </div>
          ))}
        </Card>
      ) : loadError && customers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400 font-bold">
          {loadError}{" "}
          <Button
            variant="ghost"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void load();
            }}
            className="h-auto p-0 text-sm font-bold text-primary hover:bg-transparent"
          >
            Retry
          </Button>
        </Card>
      ) : customers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400 font-bold">
          No customers yet.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400 font-bold">
          No customers match &ldquo;{query}&rdquo;.
        </Card>
      ) : (
        <>
          {/* Mobile: contact-list rows. Tap a row to open the customer. */}
          <Card className="overflow-hidden divide-y divide-line md:hidden">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-black/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-[13px] font-bold text-zinc-300">
                  {initials(fullName(c) || c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-white">
                    {fullName(c) || c.name || "—"}
                  </span>
                  {c.phone && (
                    <span className="block truncate text-[13px] font-semibold text-zinc-400">
                      {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="block truncate text-[13px] font-semibold text-zinc-400">
                      {c.email}
                    </span>
                  )}
                  {(c.address || c.formatted_address) && (
                    <span className="block truncate text-[13px] font-semibold text-zinc-500">
                      {c.address || c.formatted_address}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </Card>

          {/* Desktop: full table with inline actions. */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader className="bg-black [&_tr]:border-b [&_tr]:border-line">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto text-left px-4 py-2 text-xs font-bold text-zinc-500">Name</TableHead>
                  <TableHead className="h-auto text-left px-4 py-2 text-xs font-bold text-zinc-500">Address</TableHead>
                  <TableHead className="h-auto text-left px-4 py-2 text-xs font-bold text-zinc-500">Phone</TableHead>
                  <TableHead className="h-auto text-left px-4 py-2 text-xs font-bold text-zinc-500">Email</TableHead>
                  <TableHead className="h-auto px-4 py-2" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-line">
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-0 hover:bg-black/40 cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell className="px-4 py-2 font-bold text-white tracking-tight">
                      <Link
                        href={`/customers/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {fullName(c) || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.address || "—"}</TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.phone || "—"}</TableCell>
                    <TableCell className="px-4 py-2 text-zinc-300 font-bold">{c.email || "—"}</TableCell>
                    <TableCell
                      className="px-4 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-nowrap items-center justify-end gap-4">
                        {phone.configured && c.phone && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              phone.startCall({
                                customerId: c.id,
                                customerName: fullName(c) || c.name,
                                toPhone: c.phone || "",
                              })
                            }
                            disabled={phone.state.kind !== "idle"}
                            className="h-auto p-0 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-transparent whitespace-nowrap"
                          >
                            Call
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(c)}
                          className="h-auto p-0 text-xs font-bold text-zinc-400 hover:text-white hover:bg-transparent whitespace-nowrap"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => del(c.id)}
                          className="h-auto p-0 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-transparent whitespace-nowrap"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {(creating || editing) && (
        <CustomerForm
          customer={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setAttachPinId(null);
          }}
          onSaved={async (saved) => {
            const pinId = attachPinId;
            setCreating(false);
            setEditing(null);
            setAttachPinId(null);
            if (pinId != null && saved.id != null) {
              await fetch(`/api/map/pins/${pinId}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ customer_id: saved.id }),
              }).catch(() => {});
              router.push("/map");
              return;
            }
            await load();
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={async () => {
            await load();
          }}
        />
      )}

      {importingSubs && (
        <SubscriptionCsvImportModal
          onClose={() => setImportingSubs(false)}
          onImported={async () => {
            await load();
          }}
        />
      )}

      {importingJobs && (
        <JobsImportModal
          onClose={() => setImportingJobs(false)}
          onImported={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}
