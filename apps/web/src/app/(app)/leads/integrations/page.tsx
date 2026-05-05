import LeadsIntegrationsClient from "@/components/LeadsIntegrationsClient";
import { getDb, type MetaIntegration, type MetaPage } from "@/lib/db";
import { getMetaConfig } from "@/lib/meta";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadsIntegrationsPage() {
  const companyId = await requireCompanyId();
  const db = await getDb();
  const integration = (await db
    .prepare("SELECT * FROM meta_integration WHERE company_id = ? LIMIT 1")
    .get(companyId)) as MetaIntegration | undefined;
  const pages = (await db
    .prepare(
      "SELECT * FROM meta_pages WHERE company_id = ? ORDER BY page_name COLLATE NOCASE ASC"
    )
    .all(companyId)) as MetaPage[];
  const configured = !!getMetaConfig();
  return (
    <LeadsIntegrationsClient
      configured={configured}
      connected={!!integration?.access_token}
      userName={integration?.user_name ?? null}
      connectedAt={integration?.connected_at ?? null}
      tokenExpiresAt={integration?.token_expires_at ?? null}
      initialPages={pages.map((p) => ({
        id: p.id,
        page_id: p.page_id,
        page_name: p.page_name,
        enabled: !!p.enabled,
      }))}
    />
  );
}
