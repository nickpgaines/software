import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

let database;
export const getDb = async () => database;
export const syncReplica = async () => {};

export function fixture() {
  database?.close();
  database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE staff (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT);
    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY, staff_id INTEGER, token_hash TEXT, expires_at TEXT
    );
    INSERT INTO staff VALUES (1, 'member@example.invalid', 'existing-password-hash');
  `);
  return database;
}

export async function loadResetRoute() {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "@/lib/db") return { url: import.meta.url, shortCircuit: true };
      if (specifier === "next/server") return next("next/server.js", context);
      if (specifier.startsWith("@/")) {
        return next(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
      }
      return next(specifier, context);
    },
  });
  try {
    return await import("../../src/app/api/auth/password-reset/request/route.ts");
  } finally {
    hooks.deregister();
  }
}
