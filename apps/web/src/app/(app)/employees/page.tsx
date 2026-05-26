import { getDb, syncReplica, type Staff, type CustomRole } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";
import { BUILT_IN_ROLE_LABELS } from "@/lib/permissions";
import EmployeesClient, { type EmployeeRow } from "./EmployeesClient";

export const dynamic = "force-dynamic";

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
  // After an Add/Edit on the employee form we land back here via
  // router.refresh(). The local replica on this Lambda instance can lag
  // behind the primary, so without an explicit sync the new row often
  // wouldn't show up until the user manually reloaded the page.
  await syncReplica();
  const employees = (await db
    .prepare(
      "SELECT * FROM staff WHERE company_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(companyId)) as Staff[];

  const customRoles = (await db
    .prepare("SELECT * FROM custom_roles WHERE company_id = ?")
    .all(companyId)) as CustomRole[];
  const customRoleNames = new Map<number, string>(
    customRoles.map((r) => [r.id, r.name])
  );

  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    name: displayName(e),
    role: e.custom_role_id
      ? customRoleNames.get(e.custom_role_id) || "Custom"
      : BUILT_IN_ROLE_LABELS[
          e.permission_level as keyof typeof BUILT_IN_ROLE_LABELS
        ] || "Admin",
    phone: formatPhone(e.phone),
    email: e.email || "",
    photoUrl: e.photo_url ?? null,
    created: formatDate(e.created_at),
  }));

  return <EmployeesClient employees={rows} />;
}
