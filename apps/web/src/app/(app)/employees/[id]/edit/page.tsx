import { notFound } from "next/navigation";
import EmployeeForm from "@/components/EmployeeForm";
import { getDb, type Staff } from "@/lib/db";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const id = Number(params.id);
  const row = (await db
    .prepare("SELECT * FROM staff WHERE id = ? AND company_id = ?")
    .get(id, companyId)) as Staff | undefined;
  if (!row) notFound();

  return (
    <EmployeeForm
      initial={{
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone,
        email: row.email,
        color: row.color,
        permission_level: row.permission_level,
        custom_role_id: row.custom_role_id,
        photo_url: row.photo_url,
      }}
    />
  );
}
