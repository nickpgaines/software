import {
  DEFAULT_CUSTOMIZATIONS,
  mergeCustomizations,
  type CustomizationConfig,
} from "./customizations.ts";
import type { Db } from "./db.ts";

export async function loadCustomizations(
  db: Pick<Db, "prepare">,
  companyId: number
): Promise<CustomizationConfig> {
  const row = await db
    .prepare(
      "SELECT config FROM customization_settings WHERE company_id = ? LIMIT 1"
    )
    .get<{ config: string }>(companyId);
  if (!row) return DEFAULT_CUSTOMIZATIONS;
  try {
    return mergeCustomizations(JSON.parse(row.config));
  } catch {
    return DEFAULT_CUSTOMIZATIONS;
  }
}
