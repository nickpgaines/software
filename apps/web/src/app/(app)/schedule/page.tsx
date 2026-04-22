"use client";

import { useEffect, useMemo, useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
};

type Staff = {
  id: number;
  name: string;
};

type Job = {
  id: number;
  customer_id: number;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: string;
  notes: string | null;
  salesperson_id: number | null;
  technician_id: number | null;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  salesperson_name: string | null;
  technician_name: string | null;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultSlot() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d.toISOString());
}

function formatDateHeading(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDay(jobs: Job[]) {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const d = new Date(j.scheduled_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(j);
  }
  return Array.from(groups.entries()).map(([, items]) => ({
    date: new Date(items[0].scheduled_at),
    items,
  }));
}

export default function SchedulePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  async function loadAll() {
    const [cRes, sRes, jRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/staff"),
      fetch("/api/jobs"),
    ]);
    setCustomers(await cRes.json());
    setStaff(await sRes.json());
    setJobs(await jRes.json());
  }

  useEffect(() => {
    loadAll();
  }, []);

  const grouped = useMemo(() => groupByDay(jobs), [jobs]);

  async function deleteJob(id: number) {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    await loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upcoming and past jobs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCustomerForm(true)}
            className="text-sm border border-slate-300 bg-white hover:bg-slate-50 rounded px-3 py-2"
          >
            + Customer
          </button>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowJobForm(true);
            }}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
          >
            + Job
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-500">No jobs scheduled yet.</p>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowJobForm(true);
            }}
            className="mt-4 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
          >
            Schedule your first job
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div
              key={g.date.toISOString()}
              className="bg-white border border-slate-200 rounded-lg"
            >
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                <h2 className="font-medium text-slate-900">
                  {formatDateHeading(g.date)}
                </h2>
              </div>
              <ul className="divide-y divide-slate-200">
                {g.items.map((j) => (
                  <li key={j.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-slate-900">
                      {formatTime(new Date(j.scheduled_at))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {j.customer_name}
                      </div>
                      <div className="text-sm text-slate-500 truncate">
                        {j.customer_address || "No address"}
                        {j.customer_phone ? ` · ${j.customer_phone}` : ""}
                      </div>
                      {(j.salesperson_name || j.technician_name) && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {j.salesperson_name && <>Sold by {j.salesperson_name}</>}
                          {j.salesperson_name && j.technician_name && " · "}
                          {j.technician_name && <>Tech: {j.technician_name}</>}
                        </div>
                      )}
                      {j.notes && (
                        <div className="text-xs text-slate-500 mt-1">{j.notes}</div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-slate-900 font-medium">
                        ${(j.price_cents / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {j.duration_minutes} min
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingJob(j);
                          setShowJobForm(true);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteJob(j.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showJobForm && (
        <JobForm
          customers={customers}
          staff={staff}
          job={editingJob}
          onClose={() => {
            setShowJobForm(false);
            setEditingJob(null);
          }}
          onSaved={async () => {
            setShowJobForm(false);
            setEditingJob(null);
            await loadAll();
          }}
          onAddCustomer={() => setShowCustomerForm(true)}
          onStaffAdded={async () => {
            const res = await fetch("/api/staff");
            setStaff(await res.json());
          }}
        />
      )}

      {showCustomerForm && (
        <CustomerForm
          onClose={() => setShowCustomerForm(false)}
          onSaved={async () => {
            setShowCustomerForm(false);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-medium">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function StaffSelect({
  value,
  staff,
  onChange,
  onAdded,
}: {
  value: number | null;
  staff: Staff[];
  onChange: (id: number | null) => void;
  onAdded: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addStaff() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      const created = (await res.json()) as Staff;
      setNewName("");
      setAdding(false);
      await onAdded();
      onChange(created.id);
    }
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addStaff();
            }
          }}
          placeholder="Name"
          className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
          autoFocus
        />
        <button
          type="button"
          onClick={addStaff}
          disabled={saving || !newName.trim()}
          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded px-3 py-2"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setNewName("");
          }}
          className="text-sm text-slate-500 hover:text-slate-900 px-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
      >
        <option value="">— unassigned —</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="text-sm border border-slate-300 bg-white hover:bg-slate-50 rounded px-3 py-2"
      >
        + New
      </button>
    </div>
  );
}

function JobForm({
  customers,
  staff,
  job,
  onClose,
  onSaved,
  onAddCustomer,
  onStaffAdded,
}: {
  customers: Customer[];
  staff: Staff[];
  job: Job | null;
  onClose: () => void;
  onSaved: () => void;
  onAddCustomer: () => void;
  onStaffAdded: () => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState<number | "">(
    job?.customer_id ?? (customers[0]?.id ?? "")
  );
  const [scheduledAt, setScheduledAt] = useState(
    job ? toLocalInputValue(job.scheduled_at) : defaultSlot()
  );
  const [duration, setDuration] = useState(job?.duration_minutes ?? 60);
  const [price, setPrice] = useState(
    job ? (job.price_cents / 100).toFixed(2) : "0.00"
  );
  const [status, setStatus] = useState(job?.status ?? "scheduled");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [salespersonId, setSalespersonId] = useState<number | null>(
    job?.salesperson_id ?? null
  );
  const [technicianId, setTechnicianId] = useState<number | null>(
    job?.technician_id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Choose a customer");
      return;
    }
    setSaving(true);
    const payload = {
      customer_id: Number(customerId),
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: Number(duration),
      price_cents: Math.round(Number(price) * 100),
      status,
      notes: notes || null,
      salesperson_id: salespersonId,
      technician_id: technicianId,
    };
    const res = await fetch(job ? `/api/jobs/${job.id}` : "/api/jobs", {
      method: job ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save job");
      return;
    }
    onSaved();
  }

  return (
    <Modal title={job ? "Edit job" : "New job"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer
          </label>
          {customers.length === 0 ? (
            <div className="text-sm text-slate-600">
              No customers yet.{" "}
              <button
                type="button"
                onClick={onAddCustomer}
                className="text-blue-600 hover:underline"
              >
                Add one
              </button>
              .
            </div>
          ) : (
            <select
              value={customerId}
              onChange={(e) =>
                setCustomerId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.address ? ` — ${c.address}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            When
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Duration (min)
            </label>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Price ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Salesperson
          </label>
          <StaffSelect
            value={salespersonId}
            staff={staff}
            onChange={setSalespersonId}
            onAdded={onStaffAdded}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Technician
          </label>
          <StaffSelect
            value={technicianId}
            staff={staff}
            onChange={setTechnicianId}
            onAdded={onStaffAdded}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          >
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-slate-300 bg-white hover:bg-slate-50 rounded px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || customers.length === 0}
            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded px-3 py-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, address, notes }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save customer");
      return;
    }
    onSaved();
  }

  return (
    <Modal title="New customer" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            autoFocus
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="123 Main St, Springfield"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm border border-slate-300 bg-white hover:bg-slate-50 rounded px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded px-3 py-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
