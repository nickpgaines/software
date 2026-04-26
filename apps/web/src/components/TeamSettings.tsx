"use client";

import { useEffect, useState } from "react";

type Staff = {
  id: number;
  name: string;
  role: string | null;
};

const ROLES = ["Admin", "Salesperson", "Technician", "Both"];

export default function TeamSettings() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("Salesperson");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRole, setEditingRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/staff");
    setStaff(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addStaff() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), role: newRole || null }),
    });
    setSaving(false);
    if (res.ok) {
      setNewName("");
      setNewRole("Salesperson");
      setAdding(false);
      await load();
    }
  }

  async function saveEdit(id: number) {
    if (!editingName.trim()) return;
    setSaving(true);
    await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingName.trim(),
        role: editingRole || null,
      }),
    });
    setSaving(false);
    setEditingId(null);
    setEditingName("");
    setEditingRole("");
    await load();
  }

  async function del(id: number) {
    if (!confirm("Remove this person from the team?")) return;
    await fetch(`/api/staff/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="text-sm text-slate-500 mt-1">
            Salespeople and technicians. Assign them to jobs from the schedule.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
          >
            + Person
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex gap-2 flex-wrap">
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
            className="flex-1 min-w-[160px] border border-slate-300 rounded px-3 py-2 text-sm"
            autoFocus
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={addStaff}
            disabled={saving || !newName.trim()}
            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded px-3 py-2"
          >
            Add
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="text-sm text-slate-500 hover:text-slate-900 px-2"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No team members yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {staff.map((s) => (
              <li
                key={s.id}
                className="px-4 py-3 flex items-center justify-between gap-2"
              >
                {editingId === s.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit(s.id);
                        }
                      }}
                      className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm"
                      autoFocus
                    />
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm"
                    >
                      <option value="">No role</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={saving}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                        setEditingRole("");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="font-medium text-slate-900">{s.name}</span>
                      {s.role && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {s.role}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditingName(s.name);
                          setEditingRole(s.role || "");
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => del(s.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
