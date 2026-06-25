# Global "Search Anything" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global command-palette search reachable from the dashboard box and `⌘K` anywhere, searching customers, jobs, invoices, and leads, with each result linking to its existing destination.

**Architecture:** A `GET /api/search` route runs four company-scoped, role-gated `LIKE` queries in parallel and returns grouped results. A hand-rolled `GlobalSearch` overlay (built on existing tokens/primitives, no new deps) is mounted once via a `GlobalSearchProvider` context in the app layout, which owns the global `⌘K` shortcut and exposes `openSearch()`. The dashboard's dead "Search anything" button becomes a client button that calls `openSearch()`.

**Tech Stack:** Next.js App Router (server route handlers + client components), libSQL (`@libsql/client` via `getDb()`), Tailwind design tokens, existing `PulseIcon`/`Button`/`Input` primitives.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-24-global-search-design.md`.
- Every DB query MUST filter `WHERE company_id = ?` using `ctx.companyId`. No cross-tenant leakage.
- All user input passed as parameterized `?` placeholders — never string-interpolated into SQL.
- Role gating: technicians (any `permission_level` not in `FULL_SCHEDULE_PERMISSIONS = {admin, salesperson}`) see only jobs where `technician_id = staffId`; leads are omitted entirely unless the user has the `leads.view` permission.
- Result limit: 5 per entity group.
- UI: use design tokens (`bg-card`, `border-line`, `text-fg`, `text-fg-subtle`, `text-fg-dim`, `bg-elevated`, `shadow-menu`) and existing primitives. No hardcoded hex/px/arbitrary shadows. Overlay convention: `fixed inset-0 z-50` with `bg-black/40` scrim.
- No new third-party dependency. No new test framework.
- Run `npm run build` from `apps/web` before any commit that touches TS/TSX; it must pass (typecheck + Next build).
- New command-palette pattern MUST be documented in `DESIGN_SYSTEM.md` §8 in the same commit that introduces the component (repo rule §10 #10).

---

### Task 1: `/api/search` route + smoke script

**Files:**
- Create: `apps/web/src/app/api/search/route.ts`
- Create: `apps/web/scripts/search-smoke.mjs`

**Interfaces:**
- Consumes: `getSessionContext()` from `@/lib/auth` → `{ identity, staffId, companyId, isPlatformAdmin } | null`; `loadMe()` from `@/lib/me` → `{ permissions: string[], staff: { permission_level: string | null } | null } | null`; `getDb()` from `@/lib/db` (libSQL, `.prepare(sql).all<T>(...args): Promise<T[]>`); `FULL_SCHEDULE_PERMISSIONS` (a `Set<string>`) from `@/lib/technicianColors`.
- Produces: `GET /api/search?q=` returning `{ groups: SearchGroup[] }` where
  `SearchItem = { id: number; title: string; subtitle: string | null; href: string }` and
  `SearchGroup = { type: "customer"|"job"|"invoice"|"lead"; label: string; items: SearchItem[] }`. The client (Task 2) depends on exactly this shape.

- [ ] **Step 1: Write the smoke script (the failing test)**

Create `apps/web/scripts/search-smoke.mjs`:

```js
// Smoke test for GET /api/search against the local dev server with the seeded
// local.db. Logs in as the seeded staff user, then asserts endpoint behavior.
// Prereq: `npm run dev` running on localhost:3000. Run: node scripts/search-smoke.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const USER = process.env.SMOKE_USER || "smoke@test.local";
const PASS = process.env.SMOKE_PASS || "test1234";
const NEEDLE = process.env.SMOKE_QUERY || "te";

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("ok:", msg); }
  else { console.error("FAIL:", msg); failures += 1; }
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie returned");
  return cookie.split(";")[0]; // keep only the crm_session pair
}

async function search(cookie, q) {
  return fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`, { headers: { cookie } });
}

const cookie = await login();

// 1. Unauthenticated → 401
{
  const res = await fetch(`${BASE}/api/search?q=test`);
  assert(res.status === 401, "no session → 401");
}

// 2. Short query → empty groups
{
  const res = await search(cookie, "a");
  const data = await res.json();
  assert(res.status === 200 && Array.isArray(data.groups) && data.groups.length === 0,
    "q < 2 chars → 200 + empty groups");
}

// 3. Valid query → grouped, well-formed, ≤ 5 per group
{
  const res = await search(cookie, NEEDLE);
  const data = await res.json();
  assert(res.status === 200 && Array.isArray(data.groups), "valid query → 200 + groups[]");
  for (const g of data.groups ?? []) {
    assert(["customer", "job", "invoice", "lead"].includes(g.type), `group type valid: ${g.type}`);
    assert(Array.isArray(g.items) && g.items.length <= 5, `group ${g.type} ≤ 5 items`);
    for (const it of g.items) {
      assert(typeof it.title === "string" && typeof it.href === "string" && Number.isFinite(it.id),
        `item well-formed in ${g.type}`);
    }
  }
  console.log("groups:", (data.groups ?? []).map((g) => `${g.type}:${g.items.length}`).join(", ") || "(none)");
}

process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run the smoke script to verify it fails**

Start the dev server in one shell (`cd apps/web && npm run dev`), then:

Run: `cd apps/web && node scripts/search-smoke.mjs`
Expected: FAIL — test 1 expects `401` but `/api/search` does not exist yet, so it returns `404`. (`assert "no session → 401"` fails.)

- [ ] **Step 3: Implement the route**

Create `apps/web/src/app/api/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { loadMe } from "@/lib/me";
import { getDb } from "@/lib/db";
import { FULL_SCHEDULE_PERMISSIONS } from "@/lib/technicianColors";

export const dynamic = "force-dynamic";

export type SearchItem = { id: number; title: string; subtitle: string | null; href: string };
export type SearchGroup = {
  type: "customer" | "job" | "invoice" | "lead";
  label: string;
  items: SearchItem[];
};

const LIMIT = 5;

type CustomerRow = { id: number; first_name: string | null; last_name: string | null; name: string | null; phone: string | null; email: string | null };
type JobRow = { id: number; status: string | null; scheduled_at: string | null; cust_name: string | null; cust_fallback: string | null };
type InvoiceRow = { id: number; title: string | null; status: string | null; total_cents: number | null };
type LeadRow = { id: number; first_name: string | null; last_name: string | null; stage: string | null };

function usd(cents: number | null): string {
  const v = (cents ?? 0) / 100;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function shortDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  // Role-based visibility (mirrors /api/jobs gate and leads.view).
  let canViewLeads = true;
  let restrictJobsToTech = false;
  if (!ctx.isPlatformAdmin && ctx.staffId != null) {
    const me = await loadMe();
    const perms = new Set(me?.permissions ?? []);
    canViewLeads = perms.has("leads.view");
    const level = me?.staff?.permission_level ?? "admin";
    restrictJobsToTech = !FULL_SCHEDULE_PERMISSIONS.has(level);
  }

  const db = await getDb();
  const like = `%${q.toLowerCase()}%`;
  const companyId = ctx.companyId;

  try {
    const customersP = db
      .prepare(
        `SELECT id, first_name, last_name, name, phone, email
           FROM customers
          WHERE company_id = ?
            AND ( LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ?
               OR LOWER(COALESCE(name,'')) LIKE ?
               OR COALESCE(phone,'') LIKE ?
               OR LOWER(COALESCE(email,'')) LIKE ?
               OR LOWER(COALESCE(formatted_address, address_line1, address, '')) LIKE ? )
          ORDER BY first_name COLLATE NOCASE
          LIMIT ?`
      )
      .all<CustomerRow>(companyId, like, like, like, like, like, LIMIT);

    const jobsSql =
      `SELECT j.id AS id, j.status AS status, j.scheduled_at AS scheduled_at,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS cust_name,
              c.name AS cust_fallback
         FROM jobs j
         LEFT JOIN customers c ON c.id = j.customer_id
        WHERE j.company_id = ?
          AND ( LOWER(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) LIKE ?
             OR LOWER(COALESCE(c.name,'')) LIKE ?
             OR LOWER(COALESCE(j.notes,'')) LIKE ?
             OR LOWER(COALESCE(j.status,'')) LIKE ? )
          ${restrictJobsToTech ? "AND j.technician_id = ?" : ""}
        ORDER BY j.scheduled_at DESC
        LIMIT ?`;
    const jobsP = db
      .prepare(jobsSql)
      .all<JobRow>(
        ...(restrictJobsToTech
          ? [companyId, like, like, like, like, ctx.staffId, LIMIT]
          : [companyId, like, like, like, like, LIMIT])
      );

    const invoicesP = db
      .prepare(
        `SELECT i.id AS id, i.title AS title, i.status AS status, i.total_cents AS total_cents
           FROM invoices i
           LEFT JOIN customers c ON c.id = i.customer_id
          WHERE i.company_id = ?
            AND ( LOWER(COALESCE(i.title,'')) LIKE ?
               OR LOWER(COALESCE(i.notes,'')) LIKE ?
               OR LOWER(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) LIKE ?
               OR LOWER(COALESCE(c.name,'')) LIKE ? )
          ORDER BY i.created_at DESC
          LIMIT ?`
      )
      .all<InvoiceRow>(companyId, like, like, like, like, LIMIT);

    const leadsP: Promise<LeadRow[]> = canViewLeads
      ? db
          .prepare(
            `SELECT id, first_name, last_name, stage
               FROM leads
              WHERE company_id = ?
                AND ( LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ?
                   OR LOWER(COALESCE(email,'')) LIKE ?
                   OR COALESCE(phone,'') LIKE ?
                   OR LOWER(COALESCE(address,'')) LIKE ? )
              ORDER BY created_at DESC
              LIMIT ?`
          )
          .all<LeadRow>(companyId, like, like, like, like, LIMIT)
      : Promise.resolve([]);

    const [customers, jobs, invoices, leads] = await Promise.all([
      customersP, jobsP, invoicesP, leadsP,
    ]);

    const groups: SearchGroup[] = [];

    if (customers.length) {
      groups.push({
        type: "customer",
        label: "Customers",
        items: customers.map((c) => ({
          id: c.id,
          title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || "Customer",
          subtitle: c.phone || c.email || null,
          href: `/customers/${c.id}`,
        })),
      });
    }
    if (jobs.length) {
      groups.push({
        type: "job",
        label: "Jobs",
        items: jobs.map((j) => ({
          id: j.id,
          title: (j.cust_name || "").trim() || j.cust_fallback || "Job",
          subtitle: [j.status, shortDate(j.scheduled_at)].filter(Boolean).join(" • ") || null,
          href: `/schedule/${j.id}`,
        })),
      });
    }
    if (invoices.length) {
      groups.push({
        type: "invoice",
        label: "Invoices",
        items: invoices.map((i) => ({
          id: i.id,
          title: i.title || `Invoice #${i.id}`,
          subtitle: [i.status, usd(i.total_cents)].filter(Boolean).join(" • ") || null,
          href: `/invoices/${i.id}`,
        })),
      });
    }
    if (leads.length) {
      groups.push({
        type: "lead",
        label: "Leads",
        items: leads.map((l) => ({
          id: l.id,
          title: `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Lead",
          subtitle: l.stage || null,
          href: `/leads`,
        })),
      });
    }

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[/api/search] error", err);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}
```

Note: if `.all<T>(...args)` rejects the spread-with-conditional-array typing under the repo's TS config, replace the `jobsP` block with an explicit `if (restrictJobsToTech) { ... } else { ... }` returning the same `.all<JobRow>(...)` call. Behavior identical.

- [ ] **Step 4: Run the smoke script to verify it passes**

Run: `cd apps/web && node scripts/search-smoke.mjs`
Expected: all `ok:` lines, exit 0. Final line prints the group counts (e.g. `groups: customer:2, invoice:1` or `(none)` depending on seed data — both pass; the test asserts shape, not specific hits).

- [ ] **Step 5: Typecheck/build**

Run: `cd apps/web && npm run build`
Expected: build succeeds (no TS errors).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/search/route.ts apps/web/scripts/search-smoke.mjs
git commit -m "feat(search): add /api/search endpoint with company scoping + role gating"
```

---

### Task 2: `GlobalSearch` overlay component

**Files:**
- Create: `apps/web/src/components/search/GlobalSearch.tsx`

**Interfaces:**
- Consumes: `GET /api/search?q=` → `{ groups: SearchGroup[] }` (Task 1 shape); `PulseIcon` from `@/components/pulse/Icon` (name `"search"`); `useRouter` from `next/navigation`.
- Produces: `export function GlobalSearch({ onClose }: { onClose: () => void })` — a client component rendering the full-screen overlay. Task 3 renders `<GlobalSearch onClose={closeSearch} />` only while open.

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/search/GlobalSearch.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PulseIcon } from "@/components/pulse/Icon";

type SearchItem = { id: number; title: string; subtitle: string | null; href: string };
type SearchGroup = { type: string; label: string; items: SearchItem[] };

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced fetch with an out-of-order guard.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      setError(false);
      setActiveIndex(0);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (inputRef.current && inputRef.current.value.trim() !== q) return; // stale
        if (!res.ok) {
          setError(true);
          setGroups([]);
          return;
        }
        const data = (await res.json()) as { groups: SearchGroup[] };
        setError(false);
        setGroups(data.groups ?? []);
        setActiveIndex(0);
      } catch {
        setError(true);
        setGroups([]);
      } finally {
        if (!inputRef.current || inputRef.current.value.trim() === q) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function go(item: SearchItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  }

  const q = query.trim();
  let cursor = -1; // running flat index, recomputed each render

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-menu"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <PulseIcon name="search" className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, jobs, invoices, leads…"
            className="h-14 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-dim"
          />
          {loading && (
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-fg"
              aria-hidden
            />
          )}
          <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-dim sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {q.length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">
              Type at least 2 characters to search.
            </p>
          ) : error ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">Search failed. Try again.</p>
          ) : !loading && flat.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-dim">
              No results for &ldquo;{q}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.type} className="px-2 py-1">
                <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-fg-dim">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  cursor += 1;
                  const idx = cursor;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${group.type}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm ${
                        active ? "bg-elevated" : ""
                      }`}
                    >
                      <span className="truncate text-fg">{item.title}</span>
                      {item.subtitle && (
                        <span className="shrink-0 truncate text-xs text-fg-subtle">{item.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck/build**

Run: `cd apps/web && npm run build`
Expected: build succeeds. (The component isn't mounted yet; this just confirms it compiles.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/search/GlobalSearch.tsx
git commit -m "feat(search): add GlobalSearch command-palette overlay"
```

---

### Task 3: `GlobalSearchProvider` + mount in app layout (global ⌘K)

**Files:**
- Create: `apps/web/src/components/search/GlobalSearchProvider.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `GlobalSearch` from `./GlobalSearch` (Task 2).
- Produces: `export function GlobalSearchProvider({ children })`; `export function useGlobalSearch(): { open: boolean; openSearch: () => void; closeSearch: () => void }`. Task 4's `DashboardSearchButton` calls `useGlobalSearch().openSearch()`.

- [ ] **Step 1: Implement the provider**

Create `apps/web/src/components/search/GlobalSearchProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

type GlobalSearchCtx = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const Ctx = createContext<GlobalSearchCtx | null>(null);

export function useGlobalSearch(): GlobalSearchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  return ctx;
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      {open && <GlobalSearch onClose={closeSearch} />}
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: Mount it in the app layout**

In `apps/web/src/app/(app)/layout.tsx`, add the import and wrap the `min-h-screen` div. Add near the other imports:

```tsx
import { GlobalSearchProvider } from "@/components/search/GlobalSearchProvider";
```

Change the returned tree so `GlobalSearchProvider` wraps the screen div (inside `MobileNavShell`):

```tsx
  return (
    <PhoneClientProvider>
      <MobileNavShell>
        <GlobalSearchProvider>
          <div
            className="min-h-screen"
            style={{ background: PULSE.bg, color: PULSE.text }}
          >
            <PulseSidebar initialMe={me} />
            <AppFrame>{children}</AppFrame>
            <MobileBottomNav />
            <SmsWelcomeModal />
          </div>
        </GlobalSearchProvider>
      </MobileNavShell>
    </PhoneClientProvider>
  );
```

- [ ] **Step 3: Typecheck/build**

Run: `cd apps/web && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check — global ⌘K**

With the dev server running and logged in, on any page press `⌘K` (mac) / `Ctrl+K`. Expected: overlay opens, input focused. Type 2+ chars → grouped results appear. `↑/↓` move highlight, `Enter` navigates and closes, `Esc` closes, clicking the scrim closes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/search/GlobalSearchProvider.tsx "apps/web/src/app/(app)/layout.tsx"
git commit -m "feat(search): mount GlobalSearchProvider + global Cmd-K in app layout"
```

---

### Task 4: `DashboardSearchButton` + wire into dashboard header

**Files:**
- Create: `apps/web/src/components/search/DashboardSearchButton.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useGlobalSearch()` from `@/components/search/GlobalSearchProvider` (Task 3); `Button` from `@/components/ui/button`; `PulseIcon`.
- Produces: `export function DashboardSearchButton()` — drop-in replacement for the dashboard's dead search button.

- [ ] **Step 1: Implement the button**

Create `apps/web/src/components/search/DashboardSearchButton.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { PulseIcon } from "@/components/pulse/Icon";
import { useGlobalSearch } from "@/components/search/GlobalSearchProvider";

export function DashboardSearchButton() {
  const { openSearch } = useGlobalSearch();
  return (
    <Button
      variant="outline"
      onClick={openSearch}
      className="h-11 w-72 gap-2 rounded-2xl px-4 text-[13px] bg-elevated border-line text-fg-subtle hover:bg-elevated"
    >
      <PulseIcon name="search" className="w-3.5 h-3.5" />
      Search anything
      <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-fg-dim">⌘K</kbd>
    </Button>
  );
}
```

- [ ] **Step 2: Wire it into the dashboard header**

In `apps/web/src/app/(app)/dashboard/page.tsx`:

1. Remove the now-unused `Button` import (line 23: `import { Button } from "@/components/ui/button";`). Leave the `PulseIcon` import — it's still used by the Stripe banner.
2. Add the import:

```tsx
import { DashboardSearchButton } from "@/components/search/DashboardSearchButton";
```

3. Replace the dead button in the `actions` prop:

```tsx
        actions={<DashboardSearchButton />}
```

(Removes the old `<Button …><PulseIcon name="search" …/>Search anything</Button>` block entirely.)

- [ ] **Step 3: Typecheck/build**

Run: `cd apps/web && npm run build`
Expected: build succeeds with no "unused `Button`" error.

- [ ] **Step 4: Manual check — dashboard box**

On the dashboard, click the "Search anything" box. Expected: the same overlay opens (identical behavior to `⌘K`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/search/DashboardSearchButton.tsx "apps/web/src/app/(app)/dashboard/page.tsx"
git commit -m "feat(search): wire dashboard Search-anything box to the palette"
```

---

### Task 5: Remove the Customers page local ⌘K handler

**Files:**
- Modify: `apps/web/src/app/(app)/customers/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. The Customers page keeps its own "Search customers" filter box (`query`/`setQuery`/`searchInputRef`); only its window-level `⌘K` listener is removed (now owned globally).

- [ ] **Step 1: Delete the local ⌘K effect**

In `apps/web/src/app/(app)/customers/page.tsx`, remove this block (currently lines 76–87):

```tsx
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
```

Keep `searchInputRef` (still bound to the `Input` at the page's own search box) and the `useEffect` import (still used by the `load()` and `?new=1` effects).

- [ ] **Step 2: Typecheck/build**

Run: `cd apps/web && npm run build`
Expected: build succeeds with no "unused variable" warnings (`searchInputRef` is still referenced by the `<Input ref={searchInputRef} …>`).

- [ ] **Step 3: Manual check**

On the Customers page, press `⌘K`. Expected: the global palette opens (not the in-page customer box focus). The in-page "Search customers" box still filters when typed into directly.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(app)/customers/page.tsx"
git commit -m "refactor(search): hand Cmd-K on Customers over to the global palette"
```

---

### Task 6: Document the command-palette pattern in DESIGN_SYSTEM.md

**Files:**
- Modify: `DESIGN_SYSTEM.md` (§8 component primitives section)

**Interfaces:**
- Consumes/Produces: docs only.

- [ ] **Step 1: Add the §8 sub-entry**

Open `DESIGN_SYSTEM.md`, find the §8 component-primitives section, and add a new sub-entry (match the existing heading style/numbering of neighboring §8 entries). Content:

```markdown
### 8.x Global search (command palette)

`components/search/GlobalSearch.tsx` + `GlobalSearchProvider.tsx`. A
full-screen search overlay opened by the dashboard "Search anything" box
(`DashboardSearchButton`) and by the global `⌘K` / `Ctrl+K` shortcut (owned by
`GlobalSearchProvider`, mounted once in `app/(app)/layout.tsx`).

- **Structure:** hand-rolled overlay using the accepted `fixed inset-0`
  modal-wrapper deviation (§10 #22/#23). Scrim `bg-black/40`, `z-50`. Panel:
  `rounded-2xl border border-line bg-card shadow-menu`, max-width `xl`,
  top-anchored at `pt-[12vh]`.
- **Input/icons:** native input on tokens (`text-fg`, `placeholder:text-fg-dim`)
  with a leading `PulseIcon name="search"`; spinner is a `border-t-fg`
  `animate-spin` ring; `Esc` hint via `<kbd>`.
- **Keyboard model:** `⌘K`/`Ctrl+K` toggles open; `↑/↓` move a single flat
  selection across all groups (wrapping); `Enter` navigates to the highlighted
  result; `Esc` or scrim click closes.
- **Data:** server-driven via `GET /api/search?q=` (company-scoped, role-gated,
  ≤5 results per group). Results grouped Customers → Jobs → Invoices → Leads;
  each links to its detail page (`/customers/[id]`, `/schedule/[id]`,
  `/invoices/[id]`) or the leads pipeline (`/leads`).
```

(Use the actual next sub-number in §8 in place of `8.x`.)

- [ ] **Step 2: Commit**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs(design-system): document global search command palette (§8)"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `cd apps/web && npm run build`
Expected: typecheck + Next build both pass.

- [ ] **Step 2: Re-run the smoke script**

With the dev server running: `cd apps/web && node scripts/search-smoke.mjs`
Expected: all `ok:`, exit 0.

- [ ] **Step 3: Full manual pass**

Logged in as `smoke@test.local` / `test1234`:
1. `⌘K` from dashboard, customers, schedule, and one more page → overlay opens each time.
2. Dashboard "Search anything" box opens the overlay.
3. Type a known customer name → Customers group shows; `Enter` on it → lands on `/customers/[id]`.
4. (If seed data allows) verify a job result links to `/schedule/[id]`, an invoice to `/invoices/[id]`, a lead to `/leads`.
5. `Esc` and scrim-click close; `↑/↓` move highlight; out-of-order typing shows no stale results.

- [ ] **Step 4: Push the branch (do NOT open a PR / merge without the user's go-ahead)**

```bash
git push -u origin feature/global-search
```

Then report the branch is pushed and pause for the user to review before any PR/merge.

---

## Self-Review

**Spec coverage:**
- API endpoint, scoping, role gating, 5/group, grouped shape → Task 1. ✓
- Hand-rolled overlay on primitives/tokens, debounce, keyboard nav, states → Task 2. ✓
- Provider + global ⌘K + mount in layout → Task 3. ✓
- Dashboard box → client trigger → Task 4. ✓
- Remove Customers ⌘K → Task 5. ✓
- DESIGN_SYSTEM.md §8 entry → Task 6. ✓
- Testing (smoke script + build + manual) → Tasks 1 & 7. ✓
- Destinations (customer/job/invoice → detail pages; lead → /leads) → Task 1 item mapping. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `SearchItem`/`SearchGroup` shapes identical across Tasks 1–2; `useGlobalSearch()` return shape (`open/openSearch/closeSearch`) consistent across Tasks 3–4; `GlobalSearch` prop `onClose` consistent Tasks 2–3. ✓
