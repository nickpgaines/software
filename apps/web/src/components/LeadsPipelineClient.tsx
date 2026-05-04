"use client";

import { useMemo, useState } from "react";
import { Search, Filter, LayoutGrid, List, Settings, Plus, Sparkles } from "lucide-react";
import type { Lead, LeadStage } from "@/lib/db";

const STAGES: { key: LeadStage; label: string; accent: string; text: string }[] = [
  { key: "new", label: "NEW", accent: "bg-blue-500", text: "text-blue-600" },
  {
    key: "contacted",
    label: "CONTACTED",
    accent: "bg-indigo-500",
    text: "text-indigo-600",
  },
  {
    key: "responded",
    label: "RESPONDED",
    accent: "bg-purple-500",
    text: "text-purple-600",
  },
  {
    key: "estimate_sent",
    label: "ESTIMATE SENT",
    accent: "bg-amber-500",
    text: "text-amber-600",
  },
];

function leadName(l: Lead) {
  const f = (l.first_name || "").trim();
  const last = (l.last_name || "").trim();
  const full = `${f} ${last}`.trim();
  return full || l.email || l.phone || "Untitled lead";
}

export default function LeadsPipelineClient({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const blob = [
        l.first_name,
        l.last_name,
        l.email,
        l.phone,
        l.address,
        l.source_page_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [leads, query]);

  async function moveLead(id: number, stage: LeadStage) {
    const prev = leads;
    setLeads((cur) =>
      cur.map((l) => (l.id === id ? { ...l, stage } : l))
    );
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed to move lead");
      const updated = (await res.json()) as Lead;
      setLeads((cur) => cur.map((l) => (l.id === id ? updated : l)));
    } catch {
      setLeads(prev);
    }
  }

  async function createLead(data: Partial<Lead>) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "Failed to create lead");
    }
    const created = (await res.json()) as Lead;
    setLeads((cur) => [created, ...cur]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[40px] font-extrabold tracking-tight leading-none text-white">Pipeline</h2>
        <p className="text-sm text-zinc-400 font-bold">
          Track and move leads through the sales pipeline
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, phone, or address..."
            className="w-full bg-[#0f0f12] border border-[#1f1f24] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a2a32]"
          />
        </div>
        <button
          type="button"
          className="p-2.5 rounded-lg border border-[#1f1f24] text-zinc-400 hover:text-white hover:bg-black"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex border border-[#1f1f24] rounded-lg overflow-hidden bg-[#0f0f12]">
          <button
            type="button"
            onClick={() => setView("board")}
            className={
              "px-3 py-2 " +
              (view === "board"
                ? "text-sky-500"
                : "text-zinc-500 hover:text-zinc-300")
            }
            aria-label="Board view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={
              "px-3 py-2 border-l border-[#1f1f24] " +
              (view === "list"
                ? "text-sky-500"
                : "text-zinc-500 hover:text-zinc-300")
            }
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-bold px-4 py-2 rounded-full"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>
          <button
            type="button"
            className="p-2 rounded-full border border-[#1f1f24] text-zinc-400 hover:text-white hover:bg-black"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="inline-flex bg-[#0f0f12] border border-sky-200 text-sky-600 px-4 py-1 rounded-full text-sm font-bold">
          Leads
        </div>
      </div>

      {view === "board" ? (
        <div className="border border-[#1f1f24] rounded-2xl p-4 overflow-x-auto">
          <div className="grid gap-4 min-w-[900px] grid-cols-4">
            {STAGES.map((s) => {
              const stageLeads = filtered.filter((l) => l.stage === s.key);
              return (
                <div
                  key={s.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = Number(e.dataTransfer.getData("text/plain"));
                    if (id) moveLead(id, s.key);
                    setDraggingId(null);
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="rounded-xl border border-[#1f1f24] bg-[#0f0f12] p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-1 h-8 rounded-full ${s.accent} shrink-0`}
                      />
                      <div className="flex-1">
                        <div className={`text-xs font-semibold ${s.text}`}>
                          {s.label}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {stageLeads.length === 0 ? "Empty" : ""}
                        </div>
                      </div>
                      <div className="text-zinc-500 font-bold">
                        {stageLeads.length}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-[#1f1f24] p-3 min-h-[200px]">
                    {stageLeads.length === 0 ? (
                      s.key === "new" ? (
                        <EmptyNewHint />
                      ) : (
                        <p className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 px-2 py-1">
                          No leads in this stage.
                        </p>
                      )
                    ) : (
                      <div className="space-y-2">
                        {stageLeads.map((l) => (
                          <LeadCard
                            key={l.id}
                            lead={l}
                            isDragging={draggingId === l.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", String(l.id));
                              setDraggingId(l.id);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mt-4 pt-3 border-t border-[#1f1f24]">
            <span>{filtered.length} total leads</span>
            <span>
              Each lane loads 50 at a time. Scroll within a lane and click
              &ldquo;Load more&rdquo; to see the rest.
            </span>
          </div>
        </div>
      ) : (
        <ListView leads={filtered} />
      )}

      {showNew && (
        <NewLeadDialog
          onClose={() => setShowNew(false)}
          onCreate={async (data) => {
            await createLead(data);
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyNewHint() {
  return (
    <div className="flex flex-col items-start gap-2 p-2">
      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-500">
        <Sparkles className="w-4 h-4" />
      </div>
      <div>
        <p className="font-extrabold text-white tracking-tight text-sm">No leads yet</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Publish your web form and new leads will land here first.
        </p>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={
        "rounded-lg border border-[#1f1f24] bg-[#0f0f12] p-3 cursor-grab active:cursor-grabbing " +
        (isDragging ? "opacity-50" : "")
      }
    >
      <div className="font-medium text-sm text-white truncate">
        {leadName(lead)}
      </div>
      {lead.email && (
        <div className="text-xs text-zinc-400 truncate">{lead.email}</div>
      )}
      {lead.phone && (
        <div className="text-xs text-zinc-400 truncate">{lead.phone}</div>
      )}
      {lead.source_page_name && (
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 mt-2">
          {lead.source_page_name}
        </div>
      )}
    </div>
  );
}

function ListView({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="border border-dashed border-[#1f1f24] rounded-2xl p-12 text-center text-sm text-zinc-400 font-bold">
        No leads match your filters.
      </div>
    );
  }
  return (
    <div className="border border-[#1f1f24] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-black text-xs uppercase text-zinc-400">
          <tr>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Phone</th>
            <th className="text-left px-4 py-3">Stage</th>
            <th className="text-left px-4 py-3">Source</th>
            <th className="text-left px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t border-[#1f1f24]">
              <td className="px-4 py-3 text-white font-bold">
                {leadName(l)}
              </td>
              <td className="px-4 py-3 text-zinc-400">{l.email ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400">{l.phone ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400">{l.stage}</td>
              <td className="px-4 py-3 text-zinc-400">
                {l.source_page_name || l.source}
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">
                {new Date(l.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewLeadDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: Partial<Lead>) => Promise<void>;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        first_name: first,
        last_name: last,
        email: email || null,
        phone: phone || null,
        address: address || null,
        stage,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f12] rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">New lead</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Last name">
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                className="input"
              />
            </Field>
          </div>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Stage">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as LeadStage)}
              className="input"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 font-bold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-sky-400 hover:bg-sky-500 text-white rounded-full disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
        <style jsx>{`
          .input {
            display: block;
            width: 100%;
            border: 1px solid rgb(226 232 240);
            border-radius: 0.5rem;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }
          .input:focus {
            outline: none;
            border-color: rgb(148 163 184);
            box-shadow: 0 0 0 2px rgb(203 213 225);
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-zinc-500 mb-2 block">
        {label}
      </span>
      {children}
    </label>
  );
}
