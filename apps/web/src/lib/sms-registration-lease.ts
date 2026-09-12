import { randomUUID } from "node:crypto";

import type { Db } from "@/lib/db";

function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (
    code === "SQLITE_CONSTRAINT" ||
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    code === "SQLITE_CONSTRAINT_UNIQUE"
  ) {
    return true;
  }
  return /(?:UNIQUE|PRIMARY KEY) constraint failed/i.test(
    String((error as Error)?.message ?? error)
  );
}

export async function withSmsRegistrationLease<T>(
  db: Db,
  companyId: number,
  work: () => Promise<T>
): Promise<{ acquired: boolean; value?: T }> {
  const leaseToken = randomUUID();
  const acquired = await db.transaction(async (tx) => {
    await tx
      .prepare(
        `DELETE FROM sms_registration_leases
         WHERE company_id = ? AND expires_at <= datetime('now')`
      )
      .run(companyId);

    try {
      await tx
        .prepare(
          `INSERT INTO sms_registration_leases
             (company_id, lease_token, expires_at)
           VALUES (?, ?, datetime('now', '+5 minutes'))`
        )
        .run(companyId, leaseToken);
      return true;
    } catch (error) {
      if (isUniqueConstraintError(error)) return false;
      throw error;
    }
  });

  if (!acquired) return { acquired: false };

  try {
    return { acquired: true, value: await work() };
  } finally {
    await db
      .prepare(
        `DELETE FROM sms_registration_leases
         WHERE company_id = ? AND lease_token = ?`
      )
      .run(companyId, leaseToken);
  }
}
