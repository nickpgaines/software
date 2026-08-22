import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db.ts";

export type WidgetPrincipal = {
  tokenId: number;
  companyId: number;
  staffId: number;
};

export function hashWidgetSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function issueWidgetToken(
  db: Db,
  input: {
    companyId: number;
    staffId: number;
    installationId: string;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 180);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashWidgetSecret(token);
  const installationIdHash = hashWidgetSecret(input.installationId);

  await db.transaction(async (tx) => {
    await tx
      .prepare(
        `UPDATE widget_access_tokens
            SET revoked_at = ?
          WHERE company_id = ? AND staff_id = ?
            AND installation_id_hash = ? AND revoked_at IS NULL`
      )
      .run(
        now.toISOString(),
        input.companyId,
        input.staffId,
        installationIdHash
      );
    const inserted = await tx
      .prepare(
        `INSERT INTO widget_access_tokens
          (token_hash, installation_id_hash, company_id, staff_id, scope, expires_at)
         SELECT ?, ?, company_id, id, 'widget:read', ?
           FROM staff WHERE id = ? AND company_id = ?`
      )
      .run(
        tokenHash,
        installationIdHash,
        expiresAt.toISOString(),
        input.staffId,
        input.companyId
      );
    if (inserted.changes !== 1) {
      throw new Error("Staff member is not active in this company.");
    }
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    companyId: input.companyId,
    staffId: input.staffId,
  };
}

export async function authenticateWidgetToken(
  db: Db,
  token: string,
  now = new Date()
): Promise<WidgetPrincipal | null> {
  const row = await db
    .prepare(
      `SELECT wat.id, wat.company_id, wat.staff_id
         FROM widget_access_tokens wat
         JOIN staff s
           ON s.id = wat.staff_id AND s.company_id = wat.company_id
         JOIN company c ON c.id = wat.company_id
        WHERE wat.token_hash = ?
          AND wat.scope = 'widget:read'
          AND wat.revoked_at IS NULL
          AND wat.expires_at > ?
          AND c.access_status = 'active'
        LIMIT 1`
    )
    .get<{ id: number; company_id: number; staff_id: number }>(
      hashWidgetSecret(token),
      now.toISOString()
    );
  if (!row) return null;

  await db
    .prepare(
      `UPDATE widget_access_tokens
          SET last_used_at = ?
        WHERE id = ? AND token_hash = ? AND revoked_at IS NULL`
    )
    .run(now.toISOString(), row.id, hashWidgetSecret(token));

  return {
    tokenId: row.id,
    companyId: row.company_id,
    staffId: row.staff_id,
  };
}

export async function revokeWidgetToken(
  db: Db,
  token: string,
  now = new Date()
) {
  const result = await db
    .prepare(
      `UPDATE widget_access_tokens
          SET revoked_at = ?
        WHERE token_hash = ? AND revoked_at IS NULL`
    )
    .run(now.toISOString(), hashWidgetSecret(token));
  return result.changes > 0;
}
