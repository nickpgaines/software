import Link from "next/link";
import { Plus, User } from "lucide-react";
import { getDb, type Staff } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  team_lead: "Team Lead",
  salesperson_all: "Salesperson (All Jobs)",
  salesperson_own: "Salesperson (Own Jobs Only)",
  field_tech: "Field Tech",
  custom: "Custom",
};

function displayName(s: Staff): string {
  const parts = [s.first_name, s.last_name].filter((p) => p && p.trim()) as string[];
  if (parts.length > 0) return parts.join(" ");
  return s.name || "—";
}

function formatPhone(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default async function EmployeesPage() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const employees = (await db
    .prepare(
      "SELECT * FROM staff WHERE company_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(companyId)) as Staff[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Employees</h1>
        <Link
          href="/employees/new"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md px-4 py-2 text-sm font-medium"
        >
          <span className="w-5 h-5 rounded-full bg-[#0f0f12]/15 flex items-center justify-center">
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>
          Add Employee
        </Link>
      </div>

      <div className="bg-[#0f0f12] border border-[#1f1f24] rounded-2xl shadow-sm overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">
            No employees yet. Click &ldquo;Add Employee&rdquo; to add your
            first team member.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f1f24] text-left">
                <th className="px-4 py-3 w-14"></th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">
                  Role
                </th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">
                  Phone
                </th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">
                  Email
                </th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">
                  Created
                </th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const role =
                  PERMISSION_LABELS[e.permission_level] || "Manager";
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[#1f1f24] last:border-0 hover:bg-black"
                  >
                    <td className="px-4 py-4">
                      <div className="w-10 h-10 rounded-full bg-black border border-[#1f1f24] flex items-center justify-center overflow-hidden">
                        {e.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.photo_url}
                            alt={displayName(e)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User
                            className="w-5 h-5 text-zinc-500"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-white">
                      {displayName(e)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">{role}</td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {formatPhone(e.phone)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {e.email || "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {formatDate(e.created_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/employees/${e.id}/edit`}
                        className="text-sm text-white hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
