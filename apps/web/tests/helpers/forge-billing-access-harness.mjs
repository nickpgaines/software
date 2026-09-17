import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";

let database;
let sessionContext = null;
let afterNextTransactionCommit = null;

export const SESSION_COOKIE = "crm_session";
export const toolCalls = [];
export let widgetPrincipal = { tokenId: 1, companyId: 1, staffId: 7 };
export let mcpPrincipal = {
  tokenId: 1,
  companyId: 1,
  staffId: 7,
  clientId: "client_test",
  scopes: ["crm.read"],
};

export async function getDb() {
  return database;
}

export async function getSessionContext() {
  return sessionContext;
}

export async function requireCompanyId() {
  if (!sessionContext) throw new Error("No session");
  return sessionContext.companyId;
}

export async function syncReplica() {}

export function setSession(value) {
  sessionContext = value;
}

export function setWidgetPrincipal(value) {
  widgetPrincipal = value;
}

export function setMcpPrincipal(value) {
  mcpPrincipal = value;
}

export function setAfterNextTransactionCommit(callback) {
  afterNextTransactionCommit = callback;
}

export async function authenticateWidgetToken() {
  return widgetPrincipal;
}

export async function resolveBearerToken() {
  return mcpPrincipal;
}

export function mcpPublicBaseUrl() {
  return "https://mcp.test";
}

export const MCP_TOOLS = [
  {
    name: "list_jobs",
    description: "List jobs",
    inputSchema: { type: "object", properties: {} },
    requiredScope: "crm.read",
    handler: async () => {
      toolCalls.push("list_jobs");
      return { jobs: [] };
    },
  },
];

export function findTool(name) {
  return MCP_TOOLS.find((tool) => tool.name === name);
}

export function isStripeConfigured() {
  return false;
}

export function getStripe() {
  throw new Error("Connected-account Stripe must not be used in these tests");
}

/** @type {{fail:boolean,cancelCalls:string[],sessions:any[],subscriptions:any[]}} */
export const provider = {
  fail: false,
  cancelCalls: [],
  sessions: [],
  subscriptions: [],
};

function list(data) {
  return {
    data,
    has_more: false,
    async *[Symbol.asyncIterator]() {
      for (const value of data) yield value;
    },
  };
}

export default class Stripe {
  constructor() {
    const check = () => {
      if (provider.fail) throw new Error("provider unavailable");
    };
    return {
      accounts: {
        retrieve: async () => {
          check();
          return { id: "acct_platform" };
        },
      },
      customers: {
        retrieve: async (id) => {
          check();
          return {
            id,
            livemode: false,
            deleted: false,
            metadata: { forge_company_id: "1" },
          };
        },
      },
      checkout: {
        sessions: {
          retrieve: async (id) => {
            check();
            return provider.sessions.find((row) => row.id === id) ?? null;
          },
          list: ({ customer }) =>
            list(provider.sessions.filter((row) => row.customer === customer)),
          expire: async () => ({}),
        },
      },
      subscriptions: {
        retrieve: async (id) => provider.subscriptions.find((row) => row.id === id),
        list: ({ customer }) =>
          list(provider.subscriptions.filter((row) => row.customer === customer)),
        cancel: async (id) => {
          check();
          provider.cancelCalls.push(id);
          const subscription = provider.subscriptions.find((row) => row.id === id);
          if (subscription) subscription.status = "canceled";
          return subscription;
        },
      },
    };
  }
}

function makeDb(sqlite) {
  let chain = Promise.resolve();
  const db = {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        get: async (...args) => statement.get(...args),
        all: async (...args) => statement.all(...args),
        run: async (...args) => {
          const result = statement.run(...args);
          return {
            changes: Number(result.changes),
            lastInsertRowid: Number(result.lastInsertRowid),
          };
        },
      };
    },
    exec: async (sql) => sqlite.exec(sql),
    transaction(fn) {
      const result = chain.then(async () => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const value = await fn({ ...db, transaction: async (nested) => nested(db) });
          sqlite.exec("COMMIT");
          const afterCommit = afterNextTransactionCommit;
          afterNextTransactionCommit = null;
          if (afterCommit) await afterCommit(db);
          return value;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      });
      chain = result.catch(() => {});
      return result;
    },
  };
  return db;
}

export function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE company (
      id INTEGER PRIMARY KEY,
      name TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      time_zone TEXT,
      default_tax_rate_bps INTEGER DEFAULT 0,
      tax_applied_by_default INTEGER DEFAULT 0,
      access_status TEXT DEFAULT 'active',
      stripe_account_id TEXT,
      stripe_account_type TEXT,
      twilio_subaccount_sid TEXT
    );
    INSERT INTO company(id,name,time_zone) VALUES
      (1,'Acme Heating','America/Chicago'),
      (2,'Other Company','America/New_York');

    CREATE TABLE staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      color TEXT DEFAULT 'blue',
      permission_level TEXT DEFAULT 'admin',
      custom_role_id INTEGER,
      photo_url TEXT,
      sales_commission_rate REAL DEFAULT 0.30,
      tech_commission_rate REAL DEFAULT 0.20,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
    INSERT INTO staff(id,company_id,name,first_name,last_name,email,permission_level)
      VALUES (7,1,'Ada Admin','Ada','Admin','ada@example.com','admin'),
             (8,1,'Terry Tech','Terry','Tech','terry@example.com','technician'),
             (20,2,'Other Admin','Other','Admin','other@example.com','admin');
    CREATE TABLE custom_roles (
      id INTEGER PRIMARY KEY,
      company_id INTEGER NOT NULL,
      name TEXT DEFAULT 'Custom',
      permissions TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE customer_reviews (id INTEGER PRIMARY KEY, company_id INTEGER);

    CREATE TABLE customers (
      id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, first_name TEXT,
      last_name TEXT, phone TEXT, email TEXT, address TEXT, address_line1 TEXT,
      unit TEXT, city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL,
      formatted_address TEXT, notes TEXT, is_recurring INTEGER, created_at TEXT,
      updated_at TEXT, private_token TEXT
    );
    INSERT INTO customers VALUES
      (40,1,'Customer One','Customer','One','555-0100','customer@example.com',
       '1 Main','1 Main',NULL,'Chicago','IL','60601',41.8,-87.6,'1 Main, Chicago',
       'Call first',0,'2026-01-01','2026-01-02','customer-secret');
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      scheduled_at TEXT, duration_minutes INTEGER, price_cents INTEGER,
      status TEXT, notes TEXT, salesperson_id INTEGER, technician_id INTEGER,
      end_time TEXT, anytime INTEGER, schedule_later INTEGER, lead_source TEXT,
      en_route_at TEXT, arrived_at TEXT, started_at TEXT, completed_at TEXT,
      recurring INTEGER, subscription_id INTEGER, subscription_visit_index INTEGER,
      created_at TEXT
    );
    INSERT INTO jobs VALUES
      (50,1,40,'2026-09-20',60,12000,'scheduled','Furnace',7,8,NULL,0,0,'web',
       NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-09-01');
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      body TEXT, direction TEXT, created_at TEXT, read_at TEXT, status TEXT
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY, company_id INTEGER, job_id INTEGER,
      amount_cents INTEGER, tip_cents INTEGER, method TEXT, payment_date TEXT,
      notes TEXT, source TEXT, created_at TEXT, stripe_payment_intent_id TEXT,
      idempotency_key TEXT, request_fingerprint TEXT
    );
    CREATE TABLE estimates (
      id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      title TEXT, notes TEXT, status TEXT, total_cents INTEGER, tax_rate_bps INTEGER,
      valid_until TEXT, sent_at TEXT, accepted_at TEXT, declined_at TEXT,
      sold_by_id INTEGER, lead_source TEXT, created_by TEXT, created_at TEXT,
      updated_at TEXT, signature_data TEXT, accept_token TEXT
    );
    CREATE TABLE estimate_items (
      id INTEGER PRIMARY KEY, estimate_id INTEGER, title TEXT, description TEXT,
      quantity REAL, price_cents INTEGER, taxable INTEGER, position INTEGER
    );
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER, job_id INTEGER,
      title TEXT, notes TEXT, status TEXT, total_cents INTEGER, paid_cents INTEGER,
      tax_rate_bps INTEGER, due_date TEXT, sent_at TEXT, paid_at TEXT, voided_at TEXT,
      sold_by_id INTEGER, created_by TEXT, lead_source TEXT, payment_method TEXT,
      created_at TEXT, updated_at TEXT, stripe_pay_token TEXT,
      stripe_checkout_session_id TEXT, stripe_payment_intent_id TEXT
    );
    CREATE TABLE invoice_items (
      id INTEGER PRIMARY KEY, invoice_id INTEGER, title TEXT, description TEXT,
      quantity REAL, price_cents INTEGER, taxable INTEGER, position INTEGER
    );
    CREATE TABLE customer_subscriptions (
      id INTEGER PRIMARY KEY, company_id INTEGER, customer_id INTEGER,
      template_id INTEGER, name TEXT, description TEXT, price_cents INTEGER,
      interval TEXT, service_interval TEXT, status TEXT, sent_at TEXT,
      accepted_at TEXT, canceled_at TEXT, created_by TEXT, terms_snapshot TEXT,
      require_signature INTEGER, signature_name TEXT, signed_at TEXT,
      start_date TEXT, sold_by_id INTEGER, created_at TEXT, signature_data TEXT,
      accept_token TEXT, default_payment_method_id TEXT, stripe_subscription_id TEXT
    );
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, company_id INTEGER, first_name TEXT, last_name TEXT,
      email TEXT, phone TEXT, address TEXT, source TEXT, stage TEXT, position INTEGER,
      notes TEXT, customer_id INTEGER, contacted_at TEXT, responded_at TEXT,
      estimate_sent_at TEXT, created_at TEXT, updated_at TEXT, raw_payload TEXT
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY, company_id INTEGER, created_by_user_id INTEGER,
      title TEXT, details TEXT, start_at TEXT, end_at TEXT, assignee_user_id INTEGER,
      is_team_task INTEGER, recurrence TEXT, recurrence_parent_id INTEGER,
      status TEXT, completed_at TEXT, completed_by_user_id INTEGER,
      created_at TEXT, updated_at TEXT
    );
  `);
  database = makeDb(sqlite);
  sessionContext = {
    companyId: 1,
    staffId: 7,
    identity: "ada@example.com",
    isPlatformAdmin: false,
  };
  widgetPrincipal = { tokenId: 1, companyId: 1, staffId: 7 };
  mcpPrincipal = {
    tokenId: 1,
    companyId: 1,
    staffId: 7,
    clientId: "client_test",
    scopes: ["crm.read"],
  };
  toolCalls.length = 0;
  provider.fail = false;
  provider.cancelCalls.length = 0;
  provider.sessions.length = 0;
  provider.subscriptions.length = 0;
  afterNextTransactionCommit = null;
  Object.assign(process.env, {
    FORGE_BILLING_ENABLED: "true",
    FORGE_BILLING_CUTOFF_AT: "2020-09-26T05:00:00.000Z",
    FORGE_BILLING_SITE_ORIGIN: "https://forge.test",
    FORGE_BILLING_STRIPE_SECRET_KEY: "sk_test_fake",
    FORGE_BILLING_STRIPE_ACCOUNT_ID: "acct_platform",
    FORGE_BILLING_STRIPE_MODE: "test",
  });
  return {
    sqlite,
    db: database,
    close: () => sqlite.close(),
  };
}

export async function loadTask2Modules() {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "stripe") {
        return { url: import.meta.url, shortCircuit: true };
      }
      if (
        specifier === "@/lib/db" ||
        specifier === "@/lib/auth" ||
        specifier === "@/lib/widget-auth" ||
        specifier === "@/lib/mcp/auth" ||
        specifier === "@/lib/mcp/tools" ||
        specifier === "@/lib/stripe"
      ) {
        return { url: import.meta.url, shortCircuit: true };
      }
      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
      }
      if (specifier === "next/navigation") {
        return nextResolve("next/navigation.js", context);
      }
      if (specifier === "./lib/widget-http") {
        return nextResolve(
          new URL("../../src/lib/widget-http.ts", import.meta.url).href,
          context
        );
      }
      if (specifier === "./lib/forge-billing/config") {
        return nextResolve(
          new URL("../../src/lib/forge-billing/config.ts", import.meta.url).href,
          context
        );
      }
      if (specifier.startsWith("@/")) {
        return nextResolve(
          new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href,
          context
        );
      }
      if (
        specifier.startsWith("./") &&
        !specifier.endsWith(".ts") &&
        context.parentURL?.includes("/src/lib/forge-billing/")
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    return {
      access: await import("../../src/lib/forge-billing/access.ts"),
      schema: await import("../../src/lib/forge-billing/schema.ts"),
      middleware: await import("../../src/middleware.ts"),
      accessRoute: await import("../../src/app/api/forge-billing/access/route.ts"),
      exportRoute: await import("../../src/app/api/forge-billing/export/route.ts"),
      administratorsRoute: await import(
        "../../src/app/api/forge-billing/administrators/route.ts"
      ),
      staffRoute: await import("../../src/app/api/staff/route.ts"),
      deletionRoute: await import("../../src/app/api/account/deletion/route.ts"),
      widgetRoute: await import("../../src/app/api/widget/summary/route.ts"),
      mcpRoute: await import("../../src/app/api/mcp/route.ts"),
    };
  } finally {
    hooks.deregister();
  }
}
