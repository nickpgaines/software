import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import * as React from "react";
import ts from "typescript";

let serial = 0;
export async function loadCustomerModule(path) {
  const sourceRoot = new URL("../../src/", import.meta.url);
  const navigation = "data:text/javascript,export function useRouter(){return globalThis.__customerRouter || {push(){},replace(){},refresh(){}}}export function useSearchParams(){return new URLSearchParams(globalThis.__customerQuery || '')}export function usePathname(){return '/customers'}";
  const places = "data:text/javascript,export function APIProvider(props){return props.children}export function Map(){return null}export function Marker(){return null}export function useMapsLibrary(){return globalThis.__customerPlaces || null}";
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/navigation") return { url: navigation, shortCircuit: true };
      if (specifier === "next/link") return { url: "data:text/javascript,export default function Link(props){return props.children}", shortCircuit: true };
      if (specifier === "@vis.gl/react-google-maps") return { url: places, shortCircuit: true };
      if (specifier === "@/components/PhoneClient") return { url: "data:text/javascript,export function usePhone(){return null}", shortCircuit: true };
      if (specifier === "next/server") return nextResolve("next/server.js", context);
      if (specifier === "next/dynamic") return nextResolve("next/dynamic.js", context);
      if (specifier === "@/lib/db") return { url: "data:text/javascript,export async function getDb(){return globalThis.__customerDb}export async function syncReplica(){}", shortCircuit: true };
      if (specifier === "@/lib/auth") return { url: "data:text/javascript,export async function requireCompanyId(){return 1}", shortCircuit: true };
      if (specifier === "@/lib/email") return { url: "data:text/javascript,export function buildOriginFromRequest(){return 'https://example.com'}export async function sendWelcomeToCustomer(){}", shortCircuit: true };
      if (specifier.startsWith("@/") || (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))) {
        const base = specifier.startsWith("@/") ? new URL(specifier.slice(2), sourceRoot) : new URL(specifier, context.parentURL);
        for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
          const candidate = new URL(`${base.href}${suffix}`);
          if (/\.[cm]?[jt]sx?$/.test(candidate.pathname) && existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export default {}" };
      if (parsed.protocol === "file:" && parsed.pathname.endsWith(".tsx")) return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(parsed), "utf8"), { compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
        } }).outputText,
      };
      return nextLoad(url, context);
    },
  });
  try { return await import(`${new URL(path, sourceRoot).href}?customer=${++serial}`); }
  finally { hooks.deregister(); }
}

export function elements(node, predicate, found = []) {
  if (Array.isArray(node)) { for (const child of node) elements(child, predicate, found); return found; }
  if (!React.isValidElement(node)) return found;
  if (predicate(node)) found.push(node);
  elements(node.props.children, predicate, found);
  return found;
}
export function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? text(node.props.children) : "";
}
export function hookRenderer() {
  const slots = [];
  let cursor = 0;
  const pending = [];
  const dispatcher = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo(factory) { cursor++; return factory(); },
    useCallback(callback) { cursor++; return callback; },
    useId() { return `customer-test-${cursor++}`; },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
    useLayoutEffect() { cursor++; },
  };
  const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  return {
    render(component, props = {}) {
      cursor = 0;
      const previous = internals.ReactCurrentDispatcher.current;
      internals.ReactCurrentDispatcher.current = dispatcher;
      try { return component(props); } finally { internals.ReactCurrentDispatcher.current = previous; }
    },
    flushEffects() { for (const run of pending.splice(0)) run(); },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
