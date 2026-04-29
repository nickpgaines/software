"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Staff = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  permission_level: string | null;
  color: string | null;
};

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  team_lead: "Team Lead",
  salesperson_all: "Salesperson",
  salesperson_own: "Salesperson",
  field_tech: "Field Tech",
  custom: "Custom",
};

function displayName(s: Staff): string {
  const parts = [s.first_name, s.last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" ");
  return s.name || "—";
}

export default function TeamSettings() {
  const [staff, setStaff] = useState<Staff[]>([]);

  async function load() {
    const res = await fetch("/api/staff");
    setStaff(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

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
        <Link
          href="/settings/team/new"
          className="text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-full px-4 py-2 font-medium"
        >
          + Person
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No team members yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {staff.map((s) => {
              const role =
                (s.permission_level &&
                  PERMISSION_LABELS[s.permission_level]) ||
                s.role ||
                null;
              return (
                <li
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 flex items-center gap-3">
                    <span className="font-medium text-slate-900">
                      {displayName(s)}
                    </span>
                    {role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {role}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/settings/team/${s.id}/edit`}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => del(s.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
