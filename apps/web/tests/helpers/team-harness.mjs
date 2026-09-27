import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

let database;
let session;
let beforeTransaction;
export const onNextTransaction = callback => { beforeTransaction = callback; };
export const getDb = async () => database;
export const syncReplica = async () => {};
export const getSessionContext = async () => session;
export const requireCompanyId = async () => session.companyId;
export const assertStaffInsertionAllowed = async () => {};
export const resolveTerminalCheckoutSeatRelease = async () => null;
export class BillingError extends Error {}
export function signIn(id = 1, companyId = 1, isPlatformAdmin = false) {
  session = id === null ? null : { staffId: id, companyId, identity: `staff:${id}`, isPlatformAdmin };
}
export function fixture() {
  database?.sqlite.close();
  const sqlite = new DatabaseSync(':memory:');
  database = {
    sqlite,
    prepare(sql) {
      return {
        get: async (...args) => sqlite.prepare(sql).get(...args),
        all: async (...args) => sqlite.prepare(sql).all(...args),
        run: async (...args) => sqlite.prepare(sql).run(...args),
      };
    },
    transaction: async work => {
      if (beforeTransaction) { const callback = beforeTransaction; beforeTransaction = null; callback(sqlite); }
      if (sqlite.isTransaction) return work(database);
      sqlite.exec('BEGIN');
      try { const result = await work(database); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  sqlite.exec(`
    CREATE TABLE staff (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, first_name TEXT,
      last_name TEXT, email TEXT, phone TEXT, password_hash TEXT, color TEXT DEFAULT 'blue',
      permission_level TEXT DEFAULT 'admin', custom_role_id INTEGER, photo_url TEXT, role TEXT,
      updated_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE custom_roles (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, color TEXT,
      permissions TEXT, updated_at TEXT);
    INSERT INTO custom_roles VALUES
      (10,1,'Team manager','blue','["team.manage","customers.view"]',NULL),
      (11,1,'Payments admin','blue','["settings.view_all"]',NULL),
      (12,2,'Other tenant','blue','["team.manage"]',NULL);
    INSERT INTO staff (id,company_id,name,first_name,last_name,email,password_hash,permission_level,custom_role_id) VALUES
      (1,1,'Admin One','Admin','One','admin@example.invalid','private-admin-hash','admin',NULL),
      (2,1,'Tech Two','Tech','Two','tech@example.invalid','private-tech-hash','technician',NULL),
      (3,1,'Manager Three','Manager','Three','manager@example.invalid','private-manager-hash','admin',10),
      (4,1,'Billing Four','Billing','Four','billing@example.invalid','private-billing-hash','admin',11),
      (5,2,'Other Five','Other','Five','other@example.invalid','private-other-hash','admin',NULL);
  `);
  signIn();
  beforeTransaction = null;
  return database;
}
export async function loadRoutes() {
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url:'data:text/javascript,export {}', shortCircuit:true };
    if (/^@\/lib\/(db|auth|forge-billing\/(access|service|config))$/.test(specifier)) return { url:import.meta.url, shortCircuit:true };
    if (specifier === 'next/server') return next('next/server.js', context);
    if (specifier.startsWith('@/')) return next(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/lib/')) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  } });
  try {
    return {
      staff: await import('../../src/app/api/staff/route.ts'),
      member: await import('../../src/app/api/staff/[id]/route.ts'),
      roles: await import('../../src/app/api/roles/route.ts'),
      role: await import('../../src/app/api/roles/[id]/route.ts'),
    };
  } finally { hooks.deregister(); }
}
