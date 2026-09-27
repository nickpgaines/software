import { randomUUID } from "node:crypto";

import type { Db } from "@/lib/db";

export class SmsRegistrationLeaseLostError extends Error {
  constructor() {
    super("This registration attempt no longer owns the company lease.");
    this.name = "SmsRegistrationLeaseLostError";
  }
}

export type SmsRegistrationLease = {
  assertOwned(): Promise<void>;
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
};

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
  work: (lease: SmsRegistrationLease) => Promise<T>
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

  let lost = false;
  const lease: SmsRegistrationLease = {
    async assertOwned() {
      await lease.transaction(async () => {});
    },
    async transaction(work) {
      if (lost) throw new SmsRegistrationLeaseLostError();
      return db.transaction(async tx => {
        // Check and renew on the primary under the same lock as every state
        // write. An expired owner may never resurrect or overwrite its lease.
        const renewed = await tx.prepare(`UPDATE sms_registration_leases
          SET expires_at = datetime('now', '+5 minutes'), updated_at = datetime('now')
          WHERE company_id = ? AND lease_token = ? AND expires_at > datetime('now')`
        ).run(companyId, leaseToken);
        if (renewed.changes !== 1) {
          lost = true;
          throw new SmsRegistrationLeaseLostError();
        }
        return work(tx);
      });
    },
  };
  let renewing: Promise<void> | undefined;
  const heartbeat = setInterval(() => {
    if (renewing) return;
    renewing = lease.assertOwned().catch(() => { lost = true; }).finally(() => { renewing = undefined; });
  }, 60_000);
  heartbeat.unref?.();
  try {
    return { acquired: true, value: await work(lease) };
  } finally {
    clearInterval(heartbeat);
    await renewing;
    await db
      .prepare(
        `DELETE FROM sms_registration_leases
         WHERE company_id = ? AND lease_token = ?`
      )
      .run(companyId, leaseToken);
  }
}
