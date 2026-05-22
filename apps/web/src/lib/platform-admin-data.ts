import { getDb } from "@/lib/db";

export type AdminCompanyRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: number;
  sms_tier: string;
  staff_count: number;
  customers_count: number;
  jobs_count: number;
  invoices_count: number;
  signed_up_at: string | null;
  last_activity_at: string | null;
};

export type AdminMetrics = {
  total_companies: number;
  new_signups_7d: number;
  new_signups_30d: number;
  active_companies_30d: number;
  jobs_30d: number;
  customers_30d: number;
  payments_cents_30d: number;
};

// libSQL keeps ISO timestamps as text. Compare to datetime('now', '-N days')
// rather than client-side date math so the comparison happens DB-side.

export async function loadAdminMetrics(): Promise<AdminMetrics> {
  const db = await getDb();
  const [
    totalRow,
    signups7Row,
    signups30Row,
    active30Row,
    jobs30Row,
    customers30Row,
    payments30Row,
  ] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM company`)
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT company_id, MIN(created_at) AS first_at
           FROM staff
           GROUP BY company_id
         )
         WHERE first_at >= datetime('now', '-7 days')`
      )
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT company_id, MIN(created_at) AS first_at
           FROM staff
           GROUP BY company_id
         )
         WHERE first_at >= datetime('now', '-30 days')`
      )
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT company_id) AS n FROM (
           SELECT company_id FROM jobs
             WHERE created_at >= datetime('now', '-30 days')
           UNION ALL
           SELECT company_id FROM customers
             WHERE created_at >= datetime('now', '-30 days')
           UNION ALL
           SELECT company_id FROM payments
             WHERE created_at >= datetime('now', '-30 days')
         )`
      )
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM jobs
           WHERE created_at >= datetime('now', '-30 days')`
      )
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM customers
           WHERE created_at >= datetime('now', '-30 days')`
      )
      .get<{ n: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents + tip_cents), 0) AS n FROM payments
           WHERE created_at >= datetime('now', '-30 days')`
      )
      .get<{ n: number }>(),
  ]);

  return {
    total_companies: totalRow?.n ?? 0,
    new_signups_7d: signups7Row?.n ?? 0,
    new_signups_30d: signups30Row?.n ?? 0,
    active_companies_30d: active30Row?.n ?? 0,
    jobs_30d: jobs30Row?.n ?? 0,
    customers_30d: customers30Row?.n ?? 0,
    payments_cents_30d: payments30Row?.n ?? 0,
  };
}

// One query, correlated subqueries for the per-company aggregates. Fine for
// the early-stage tenant count we'll have for the foreseeable future; if the
// company list ever blows up, refactor to JOIN + GROUP BY against materialized
// per-tenant aggregates.
export async function loadAdminCompanies(
  search: string
): Promise<AdminCompanyRow[]> {
  const db = await getDb();
  const trimmed = search.trim();
  const params: (string | number)[] = [];
  let whereSql = "";
  if (trimmed.length > 0) {
    const like = `%${trimmed.toLowerCase()}%`;
    // Allow numeric ID match too — handy when reading a customer-support
    // email that references a tenant by ID.
    const asNum = /^\d+$/.test(trimmed) ? Number(trimmed) : -1;
    whereSql = `
      WHERE LOWER(COALESCE(c.name, '')) LIKE ?
         OR LOWER(COALESCE(c.email, '')) LIKE ?
         OR LOWER(COALESCE(c.phone, '')) LIKE ?
         OR c.id = ?
         OR EXISTS (
              SELECT 1 FROM staff s
              WHERE s.company_id = c.id
                AND LOWER(COALESCE(s.email, '')) LIKE ?
            )
    `;
    params.push(like, like, like, asNum, like);
  }

  const rows = await db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c.website,
         c.stripe_account_id,
         c.stripe_charges_enabled,
         c.sms_tier,
         (SELECT COUNT(*) FROM staff     WHERE company_id = c.id) AS staff_count,
         (SELECT COUNT(*) FROM customers WHERE company_id = c.id) AS customers_count,
         (SELECT COUNT(*) FROM jobs      WHERE company_id = c.id) AS jobs_count,
         (SELECT COUNT(*) FROM invoices  WHERE company_id = c.id) AS invoices_count,
         (SELECT MIN(created_at) FROM staff WHERE company_id = c.id) AS signed_up_at,
         (
           SELECT MAX(t) FROM (
             SELECT MAX(created_at) AS t FROM jobs      WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM customers WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM payments  WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM messages  WHERE company_id = c.id
           )
         ) AS last_activity_at
       FROM company c
       ${whereSql}
       ORDER BY c.id DESC`
    )
    .all<AdminCompanyRow>(...params);

  return rows;
}

export type AdminCompanyDetail = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logo_url: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: number;
  stripe_payouts_enabled: number;
  stripe_details_submitted: number;
  stripe_account_type: string | null;
  sms_tier: string;
  sms_dedicated_number: string | null;
  sms_trial_pool_number: string | null;
  a2p_registration_state: string;
  a2p_registration_error: string | null;
  signed_up_at: string | null;
  last_activity_at: string | null;
  staff_count: number;
  customers_count: number;
  jobs_count: number;
  jobs_30d: number;
  invoices_count: number;
  invoices_paid_count: number;
  payments_total_cents: number;
};

export type AdminCompanyStaff = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  permission_level: string;
  created_at: string;
};

export type AdminCompanyJob = {
  id: number;
  scheduled_at: string;
  status: string;
  price_cents: number;
  customer_name: string | null;
  created_at: string;
};

export type AdminCompanyInvoice = {
  id: number;
  status: string;
  total_cents: number;
  paid_cents: number;
  created_at: string;
  customer_name: string | null;
};

export async function loadAdminCompanyDetail(
  id: number
): Promise<AdminCompanyDetail | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT
         c.id, c.name, c.email, c.phone, c.website, c.address, c.logo_url,
         c.stripe_account_id, c.stripe_charges_enabled, c.stripe_payouts_enabled,
         c.stripe_details_submitted, c.stripe_account_type,
         c.sms_tier, c.sms_dedicated_number, c.sms_trial_pool_number,
         c.a2p_registration_state, c.a2p_registration_error,
         (SELECT MIN(created_at) FROM staff WHERE company_id = c.id) AS signed_up_at,
         (
           SELECT MAX(t) FROM (
             SELECT MAX(created_at) AS t FROM jobs      WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM customers WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM payments  WHERE company_id = c.id
             UNION ALL
             SELECT MAX(created_at) AS t FROM messages  WHERE company_id = c.id
           )
         ) AS last_activity_at,
         (SELECT COUNT(*) FROM staff     WHERE company_id = c.id) AS staff_count,
         (SELECT COUNT(*) FROM customers WHERE company_id = c.id) AS customers_count,
         (SELECT COUNT(*) FROM jobs      WHERE company_id = c.id) AS jobs_count,
         (SELECT COUNT(*) FROM jobs      WHERE company_id = c.id
            AND created_at >= datetime('now', '-30 days')) AS jobs_30d,
         (SELECT COUNT(*) FROM invoices  WHERE company_id = c.id) AS invoices_count,
         (SELECT COUNT(*) FROM invoices  WHERE company_id = c.id
            AND status = 'paid') AS invoices_paid_count,
         (SELECT COALESCE(SUM(amount_cents + tip_cents), 0) FROM payments
            WHERE company_id = c.id) AS payments_total_cents
       FROM company c
       WHERE c.id = ?
       LIMIT 1`
    )
    .get<AdminCompanyDetail>(id);
  return row ?? null;
}

export async function loadAdminCompanyStaff(
  companyId: number
): Promise<AdminCompanyStaff[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id, name, first_name, last_name, email, permission_level, created_at
         FROM staff
         WHERE company_id = ?
         ORDER BY created_at ASC`
    )
    .all<AdminCompanyStaff>(companyId);
}

export async function loadAdminCompanyRecentJobs(
  companyId: number
): Promise<AdminCompanyJob[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT j.id, j.scheduled_at, j.status, j.price_cents, j.created_at,
              COALESCE(cust.first_name || ' ' || cust.last_name, cust.name) AS customer_name
         FROM jobs j
         LEFT JOIN customers cust ON cust.id = j.customer_id
         WHERE j.company_id = ?
         ORDER BY j.created_at DESC
         LIMIT 10`
    )
    .all<AdminCompanyJob>(companyId);
}

export async function loadAdminCompanyRecentInvoices(
  companyId: number
): Promise<AdminCompanyInvoice[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT i.id, i.status, i.total_cents, i.paid_cents, i.created_at,
              COALESCE(cust.first_name || ' ' || cust.last_name, cust.name) AS customer_name
         FROM invoices i
         LEFT JOIN customers cust ON cust.id = i.customer_id
         WHERE i.company_id = ?
         ORDER BY i.created_at DESC
         LIMIT 10`
    )
    .all<AdminCompanyInvoice>(companyId);
}
