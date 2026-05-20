"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import ImportModal from "@/components/customers/ImportModal";
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

export default function CustomersPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CustomersPage />
    </Suspense>
  );
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [attachPinId, setAttachPinId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const phone = usePhone();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-white">Customers</h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            People you clean windows for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers (⌘K)"
            className="h-auto w-64 border-line-strong rounded px-3 py-2 text-sm"
          />
          <Button
            variant="ghost"
            onClick={() => setImporting(true)}
            className="h-auto text-sm border border-line-strong bg-card hover:bg-black text-zinc-300 rounded px-3 py-2 font-bold"
          >
            Import
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCreating(true)}
            className="h-auto text-sm bg-primary hover:opacity-90 text-primary-foreground rounded px-3 py-2 font-bold"
          >
            + Customer
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400 font-bold">
            No customers yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400 font-bold">
            No customers match &ldquo;{query}&rdquo;.
          </div>
        ) : (
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
                    className="px-4 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                        className="h-auto p-0 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-transparent mr-4"
                      >
                        Call
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(c)}
                      className="h-auto p-0 text-xs font-bold text-zinc-400 hover:text-white hover:bg-transparent mr-4"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => del(c.id)}
                      className="h-auto p-0 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-transparent"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

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
    </div>
  );
}
