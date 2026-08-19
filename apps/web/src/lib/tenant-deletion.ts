type DeletionStatement = {
  run(...args: unknown[]): Promise<{ changes: number }>;
};

export type TenantDeletionDb = {
  prepare(sql: string): DeletionStatement;
};

const TENANT_TABLES_WITHOUT_COMPANY_CASCADE = [
  "customer_reviews",
  "custom_roles",
] as const;

export async function deleteTenantDataWithoutForeignKeyCascades(
  db: TenantDeletionDb,
  companyId: number
): Promise<void> {
  for (const table of TENANT_TABLES_WITHOUT_COMPANY_CASCADE) {
    await db.prepare(`DELETE FROM ${table} WHERE company_id = ?`).run(companyId);
  }
}
