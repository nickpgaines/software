import { registerHooks } from "node:module";

let database;
let sessionContext = null;

export const SESSION_COOKIE = "crm_session";

export async function getSessionContext() {
  return sessionContext;
}

export async function getDb() {
  return database;
}

export function setLogoutRouteHarness(input) {
  sessionContext = input.sessionContext;
  database = input.database;
}

export async function loadLogoutRoute() {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/auth" || specifier === "@/lib/db") {
        return { url: import.meta.url, shortCircuit: true };
      }
      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
      }
      if (specifier.startsWith("@/")) {
        return nextResolve(
          new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href,
          context
        );
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    return await import("../../src/app/api/logout/route.ts");
  } finally {
    hooks.deregister();
  }
}
