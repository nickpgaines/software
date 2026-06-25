# Global "Search Anything" — Design Spec

**Date:** 2026-06-24
**Branch:** `feature/global-search`
**Status:** Approved design, pending spec review

## Problem

The dashboard's top-right "Search anything" box is a static `<Button>` with no
handler, no input, and no backend — a placeholder that was never wired up. There
is no global search anywhere in the app. This spec defines a real global search:
a command-palette overlay, reachable from the dashboard box and from `⌘K`
anywhere, that searches across the four core entities and links straight to each
record.

## Goals

- One palette that searches **customers, jobs, invoices, and leads** in a single
  query, company-scoped and role-gated.
- Reachable two ways: clicking the dashboard "Search anything" box, and pressing
  `⌘K` / `Ctrl+K` from any page in the authenticated app.
- Every result is a direct link to an existing destination — no new detail
  views required.
- Built entirely on existing primitives, tokens, and accepted deviations. No new
  third-party dependency.

## Non-goals (v1)

- A lead detail view (none exists today; lead results land on the pipeline).
- Fuzzy ranking / typo tolerance (simple `LIKE` substring match only).
- Recent-searches / history.
- Searching other entities (estimates, messages, staff, subscriptions).
- Introducing a test framework (the repo has none; see Testing).

## Result destinations (all already exist)

| Entity    | Destination URL    | Notes                                             |
|-----------|--------------------|---------------------------------------------------|
| Customer  | `/customers/[id]`  | Real detail page.                                 |
| Invoice   | `/invoices/[id]`   | Real detail page.                                 |
| Job       | `/schedule/[id]`   | Real detail page (`JobDetailClient`).             |
| Lead      | `/leads`           | No detail view exists; land on the pipeline.      |

## Architecture

Three pieces: a search API, a palette component, and the trigger wiring.

### 1. API — `GET /api/search?q=<query>`

- **File:** `apps/web/src/app/api/search/route.ts`
- **Auth:** `getSessionContext()` (`apps/web/src/lib/auth.ts`). Returns `401` when
  there is no session. Yields `{ companyId, staffId, isPlatformAdmin }`.
- **Query handling:** trim `q`. If `q.length < 2`, return `{ groups: [] }` with
  `200` (no work, empty result). Build the case-insensitive needle once:
  `const like = `%${q.toLowerCase()}%``.
- **Per-entity queries** run in parallel via `Promise.all`, each scoped with
  `WHERE company_id = ?` and `LIMIT 5`, mirroring the existing LIKE pattern in
  `apps/web/src/app/api/leads/route.ts:20`:

  - **Customers** (all roles): match on
    `LOWER(first_name||' '||last_name)`, `LOWER(email)`, `phone`,
    `LOWER(COALESCE(formatted_address, address_line1, ''))`.
    → `{ id, title: full name, subtitle: phone || email, href: /customers/${id} }`

  - **Jobs** (role-gated): join `customers` for the name; match on customer name,
    `jobs.notes`, `jobs.status`. Apply the **same technician gate** as
    `apps/web/src/app/api/jobs/route.ts:38` — if the caller's
    `permission_level` is `technician` (or otherwise not in
    `FULL_SCHEDULE_PERMISSIONS`), add `AND jobs.technician_id = ?` with `staffId`.
    → `{ id, title: customer name, subtitle: status • date, href: /schedule/${id} }`

  - **Invoices** (all roles): join `customers` for the name; match on
    `invoices.title`, `invoices.notes`, customer name.
    → `{ id, title: title || 'Invoice #'+id, subtitle: status • amount, href: /invoices/${id} }`

  - **Leads** (excluded for technicians): only run this query when the caller has
    the `leads.view` permission — resolve via
    `resolvePermissions(permission_level, customRolePermissions)` from
    `apps/web/src/lib/permissions.ts`. Match on name/email/phone/address (reuse
    the `/api/leads` predicate).
    → `{ id, title: full name, subtitle: stage, href: /leads }`

- **Permission lookup:** one `SELECT permission_level, custom_role_permissions
  FROM staff WHERE id = ? AND company_id = ?` (skipped for `isPlatformAdmin`,
  which sees everything in company 1). Drives both the job gate and the lead
  inclusion check.
- **Response shape:**
  ```ts
  type SearchItem = { id: number; title: string; subtitle: string | null; href: string };
  type SearchGroup = { type: "customer" | "job" | "invoice" | "lead"; label: string; items: SearchItem[] };
  // { groups: SearchGroup[] }  — only non-empty groups included, fixed order: customers, jobs, invoices, leads
  ```
- All queries use parameterized `?` placeholders (no string interpolation of
  user input).

### 2. Component — `GlobalSearch` (client)

- **File:** `apps/web/src/components/search/GlobalSearch.tsx`
- Mounted **once** in `apps/web/src/app/(app)/layout.tsx` so it is available on
  every authenticated page.
- Renders nothing when closed. When open, renders a `fixed inset-0` overlay (the
  accepted hand-rolled-modal deviation, see `DESIGN_SYSTEM.md` §10 #22/#23) with
  a centered panel near the top of the viewport.
- Uses the existing `Input` primitive for the query field, `PulseIcon` for the
  search/spinner icons, and design tokens for all color/spacing/radius. No
  hardcoded hex/px.
- **Behavior:**
  - On open: autofocus the input, clear previous query/results.
  - Debounce input by 200ms, then `fetch('/api/search?q=' + encodeURIComponent(q))`.
    Guard against out-of-order responses (ignore a response whose query no longer
    matches the current input).
  - Render `groups` with a small header per group and the items beneath.
  - Maintain a single flat selection index across all items.
    `↑/↓` move it (wrapping), `Enter` navigates to the selected item's `href`,
    `Esc` closes, clicking an item navigates. Navigation uses
    `useRouter().push(href)` then closes the palette.
  - States: idle (prompt to type), loading (spinner), empty (`No results for
    "…"`), error (generic "Search failed" line; non-fatal).

### 3. Trigger wiring — `GlobalSearchProvider`

- **File:** `apps/web/src/components/search/GlobalSearchProvider.tsx`
- A React context provider wrapping the app content in
  `apps/web/src/app/(app)/layout.tsx`. Holds `open` state, renders `GlobalSearch`,
  and registers the global `keydown` listener for `⌘K` / `Ctrl+K` (preventDefault,
  toggle open). Exposes `useGlobalSearch()` → `{ open, openSearch, closeSearch }`.
- **Dashboard box:** extract the box into a small client component
  `apps/web/src/components/search/DashboardSearchButton.tsx` that calls
  `openSearch()` on click. The dashboard page (`apps/web/src/app/(app)/dashboard/
  page.tsx`) stays a server component and just renders `<DashboardSearchButton />`
  in the `PageHeader` `actions` slot, preserving the existing visual styling.

### 4. Cleanup

- Remove the local `⌘K` handler in
  `apps/web/src/app/(app)/customers/page.tsx:76-87` (the global palette now owns
  that shortcut). The page keeps its own "Search customers" filter box and its
  `searchInputRef`/`useState` for the box's value.

## Data flow

```
⌘K / click box → GlobalSearchProvider.openSearch() → GlobalSearch opens
  → user types → 200ms debounce → GET /api/search?q=…
    → route: getSessionContext() → permission lookup → 4 scoped LIKE queries (Promise.all)
    → { groups } → render → ↑/↓ select → Enter → router.push(href) → close
```

## Error handling

- API: `401` when unauthenticated; `200 { groups: [] }` for short/empty queries;
  unexpected server errors return `500` with `{ groups: [] }` and are logged. The
  client treats any non-OK response as a non-fatal "Search failed" line and keeps
  the palette open.
- Client: out-of-order responses discarded by comparing the in-flight query to
  the current input value.

## Security / tenancy

- Every query filters `company_id = ctx.companyId`. No cross-tenant leakage.
- Job results respect the technician gate (`technician_id = staffId`); lead
  results are omitted entirely for users without `leads.view`. Search therefore
  never surfaces a record the user couldn't already reach through normal
  navigation.
- All user input is parameterized.

## Testing

The repo has **no test framework** (no vitest/jest, no test files; tooling lives
in ad-hoc `apps/web/scripts/*.mjs`). Introducing one is out of scope for this
feature. Verification instead follows repo conventions:

1. **Typecheck + build:** `npm run build` from `apps/web` must pass.
2. **API smoke script:** `apps/web/scripts/search-smoke.mjs` — runs against the
   local dev server with the seeded `local.db`, asserting:
   - `q` shorter than 2 chars → empty groups.
   - A known customer/invoice/job/lead name returns the expected group + href.
   - Results are limited to 5 per group.
   - (Documented manual step) a technician session sees no lead group and only
     their own jobs.
3. **Manual UI pass:** `⌘K` opens from several pages; dashboard box opens it;
   keyboard nav + Enter navigates; Esc closes; each entity type links to the
   right destination.

## Design-system documentation

Add a `DESIGN_SYSTEM.md` §8 sub-entry for the **Global search / command palette**
pattern (overlay structure, trigger, keyboard model, that it reuses the
`fixed inset-0` deviation + `Input`/`PulseIcon`/tokens) in the **same commit** that
introduces the component, per the repo's §10 #10 rule.

## Files

**New**
- `apps/web/src/app/api/search/route.ts`
- `apps/web/src/components/search/GlobalSearch.tsx`
- `apps/web/src/components/search/GlobalSearchProvider.tsx`
- `apps/web/src/components/search/DashboardSearchButton.tsx`
- `apps/web/scripts/search-smoke.mjs`

**Modified**
- `apps/web/src/app/(app)/layout.tsx` (wrap content in `GlobalSearchProvider`)
- `apps/web/src/app/(app)/dashboard/page.tsx` (render `DashboardSearchButton`)
- `apps/web/src/app/(app)/customers/page.tsx` (drop local `⌘K` handler)
- `DESIGN_SYSTEM.md` (§8 sub-entry)

## Build sequence

1. `/api/search` route + `search-smoke.mjs`; verify with the smoke script.
2. `GlobalSearch` component (overlay, fetch, keyboard nav).
3. `GlobalSearchProvider` + mount in `(app)/layout.tsx`; global `⌘K`.
4. `DashboardSearchButton`; wire into the dashboard header.
5. Remove the Customers `⌘K` handler.
6. `DESIGN_SYSTEM.md` §8 entry.
7. `npm run build`; manual UI pass.
