import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canSeeAllSettings } from "@/lib/permissions";
import { loadWidgetPermissions } from "@/lib/widget-permissions";

export class SmsRegistrationAccessError extends Error {
  readonly status: 401 | 403;

  constructor(
    status: 401 | 403,
    message: "Not signed in" | "Forbidden"
  ) {
    super(message);
    this.name = "SmsRegistrationAccessError";
    this.status = status;
  }
}

export async function requireSmsRegistrationAccess(): Promise<{
  companyId: number;
  staffId: number | null;
}> {
  const context = await getSessionContext();
  if (!context) throw new SmsRegistrationAccessError(401, "Not signed in");
  if (context.isPlatformAdmin) {
    return { companyId: context.companyId, staffId: context.staffId };
  }
  if (context.staffId == null) {
    throw new SmsRegistrationAccessError(403, "Forbidden");
  }

  const db = await getDb();
  const permissions = await loadWidgetPermissions(db, {
    tokenId: 0,
    companyId: context.companyId,
    staffId: context.staffId,
  });
  if (!canSeeAllSettings(permissions)) {
    throw new SmsRegistrationAccessError(403, "Forbidden");
  }
  return { companyId: context.companyId, staffId: context.staffId };
}
