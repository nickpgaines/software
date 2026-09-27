import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
// Node 24 exposes registerHooks; the repository's Node 20 type package does not yet declare it.
// @ts-expect-error Node 24 runtime API
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

let componentImport = 0;
async function loadComponent(path: string) {
  const sourceRoot = new URL("../src/", import.meta.url);
  const navigationUrl = "data:text/javascript,export function useRouter(){return globalThis.__lifecycleTestRouter}export function useSearchParams(){return new URLSearchParams()}export function usePathname(){return '/schedule/12'}export function notFound(){throw new Error('not found')}";
  const linkUrl = "data:text/javascript,export default function Link(props){return props.children}";
  const hooks = registerHooks({
    resolve(specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) {
      if (specifier === "next/navigation") return { url: navigationUrl, shortCircuit: true };
      if (specifier === "next/link") return { url: linkUrl, shortCircuit: true };
      if (specifier.startsWith("@/")) {
        const base = new URL(specifier.slice(2), sourceRoot);
        for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
          const candidate = new URL(`${base.href}${suffix}`);
          if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
        }
      }
      const parentURL = (context as { parentURL?: string }).parentURL;
      if (specifier.startsWith(".") && parentURL?.startsWith("file:")) {
        const base = new URL(specifier, parentURL);
        if (!/\.[cm]?[jt]sx?$/.test(base.pathname)) {
          for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
            const candidate = new URL(`${base.href}${suffix}`);
            if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
          }
        }
      }
      return nextResolve(specifier, context);
    },
    load(url: string, context: unknown, nextLoad: (url: string, context: unknown) => unknown) {
      const parsed = new URL(url);
      if (parsed.protocol === "file:" && parsed.pathname.endsWith(".tsx")) {
        const source = readFileSync(fileURLToPath(parsed), "utf8");
        return {
          format: "module",
          shortCircuit: true,
          source: ts.transpileModule(source, {
            compilerOptions: {
              jsx: ts.JsxEmit.ReactJSX,
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          }).outputText,
        };
      }
      return nextLoad(url, context);
    },
  });
  try {
    return await import(`${path}?ui=${++componentImport}`);
  } finally {
    hooks.deregister();
  }
}

type Element = React.ReactElement<Record<string, unknown>>;
function findElements(node: React.ReactNode, predicate: (element: Element) => boolean, found: Element[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, found);
    return found;
  }
  if (!React.isValidElement<Record<string, unknown>>(node)) return found;
  if (predicate(node)) found.push(node);
  findElements(node.props.children as React.ReactNode, predicate, found);
  return found;
}

function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Record<string, unknown>>(node)
    ? text(node.props.children as React.ReactNode)
    : "";
}

function hookRenderer() {
  const slots: unknown[] = [];
  let cursor = 0;
  const dispatcher = {
    useState<T>(initial: T | (() => T)) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [slots[index], (next: T | ((previous: T) => T)) => {
        slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next;
      }];
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo<T>(factory: () => T) { cursor++; return factory(); },
    useCallback<T>(callback: T) { cursor++; return callback; },
    useEffect() { cursor++; },
    useLayoutEffect() { cursor++; },
  };
  const internals = (React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
      ReactCurrentDispatcher: { current: unknown };
    };
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  return {
    render(component: (props: never) => React.ReactElement, props: unknown) {
      cursor = 0;
      const previous = internals.ReactCurrentDispatcher.current;
      internals.ReactCurrentDispatcher.current = dispatcher;
      try { return component(props as never); }
      finally { internals.ReactCurrentDispatcher.current = previous; }
    },
  };
}

function notification(id: number, outcome: string) {
  return {
    id, step: id === 1 ? "en_route" : "arrived", outcome, attempt_count: 1,
    message_id: null, error: outcome === "failed" ? "provider rejected" : "acceptance unknown",
    locked_at: null, last_attempt_at: "2026-09-11 10:00:00",
    retry_requested_at: null, retry_requested_by: null,
    created_at: "2026-09-11 09:00:00", updated_at: "2026-09-11 10:00:00",
  };
}

test("lifecycle panel renders actionable retries and gates unknown delivery through confirmation", async () => {
  const module = await loadComponent("../src/components/jobs/LifecycleNotificationPanel.tsx");
  assert.equal(typeof module.LifecycleNotificationRows, "function");
  const retries: Array<[number, boolean]> = [];
  let confirmations = 0;
  let allowUnknown = false;
  const props = {
    notifications: [notification(1, "failed"), notification(2, "unknown")],
    retryingId: null,
    onRetry: (item: { id: number }, confirmedUnknown: boolean) => retries.push([item.id, confirmedUnknown]),
    confirmUnknown: () => { confirmations++; return allowUnknown; },
  };
  const markup = renderToStaticMarkup(React.createElement(module.LifecycleNotificationRows, props));
  assert.match(markup, />Failed</);
  assert.match(markup, />Delivery unknown</);
  assert.match(markup, />Retry text</);
  assert.match(markup, />Retry text anyway</);
  assert.match(markup, /could send a duplicate text/);

  const tree = module.LifecycleNotificationRows(props) as React.ReactElement;
  const buttons = findElements(tree, element => element.type === "button");
  const failed = buttons.find(button => text(button) === "Retry text")!;
  const unknown = buttons.find(button => text(button) === "Retry text anyway")!;
  (failed.props.onClick as () => void)();
  (unknown.props.onClick as () => void)();
  assert.deepEqual(retries, [[1, false]]);
  assert.equal(confirmations, 1);
  allowUnknown = true;
  (unknown.props.onClick as () => void)();
  assert.deepEqual(retries, [[1, false], [2, true]]);
  assert.equal(confirmations, 2);
});

test("record payment modal forwards a successful API warning through its real submit callback", async () => {
  const module = await loadComponent("../src/components/jobs/RecordPaymentModal.tsx");
  const renderer = hookRenderer();
  const recorded: Array<string | null> = [];
  const props = {
    jobId: 12, customerId: 90, jobTotalCents: 5000, paidTotalCents: 0,
    customerEmail: null, customerPhone: null, onClose: () => {},
    onRecorded: (warning: string | null) => recorded.push(warning),
  };
  let tree = renderer.render(module.default, props);
  const cash = findElements(tree, element => text(element) === "Cash" && typeof element.props.onClick === "function")[0];
  (cash.props.onClick as () => void)();
  tree = renderer.render(module.default, props);
  const form = findElements(tree, element => element.type === "form")[0];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 5,
    warning: "Payment recorded, but the customer text was not delivered.",
  }), { status: 201, headers: { "Content-Type": "application/json" } });
  try {
    await (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(recorded, ["Payment recorded, but the customer text was not delivered."]);
});

test("job payment success closes the modal and renders its warning while refreshing", async () => {
  const module = await loadComponent("../src/components/JobDetailClient.tsx");
  const renderer = hookRenderer();
  (globalThis as typeof globalThis & { __lifecycleTestRouter?: unknown }).__lifecycleTestRouter = {
    refresh() {}, push() {},
  };
  const props = { initialJob: {
    id: 12, customer_id: 90, customer_name: "Ada Lovelace", customer_phone: null,
    customer_email: null, customer_address: null, customer_latitude: null,
    customer_longitude: null, customer_formatted_address: null,
    scheduled_at: "2026-09-11T15:00:00.000Z", end_time: null, duration_minutes: 120,
    price_cents: 5000, status: "scheduled", notes: null, anytime: 0, schedule_later: 0,
    lead_source: null, recurring: 0, en_route_at: null, arrived_at: null, started_at: null,
    completed_at: null, line_items: [], checklist_items: [], sales: [], techs: [], payments: [],
    paid_total_cents: 0, tip_total_cents: 0, paid_status: "unpaid", job_status: "scheduled",
    subscription_id: null, subscription_visit_index: null,
  } };
  let tree = renderer.render(module.default, props);
  const pay = findElements(tree, element => text(element) === "Pay›" && typeof element.props.onClick === "function")[0];
  (pay.props.onClick as () => void)();
  tree = renderer.render(module.default, props);
  const checkout = findElements(tree, element => typeof element.props.onChoose === "function")[0];
  (checkout.props.onChoose as (choice: string) => void)("other");
  tree = renderer.render(module.default, props);
  const modal = findElements(tree, element => typeof element.props.onRecorded === "function")[0];
  assert.ok(modal);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    await (modal.props.onRecorded as (warning: string) => Promise<void>)("Payment recorded; customer text failed.");
  } finally {
    globalThis.fetch = originalFetch;
  }
  tree = renderer.render(module.default, props);
  assert.equal(findElements(tree, element => typeof element.props.onRecorded === "function").length, 0);
  const alerts = findElements(tree, element => element.props.role === "alert");
  assert.ok(alerts.some(alert => text(alert).includes("Payment recorded; customer text failed.")));
});
