# iOS Metrics Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one configurable iOS Home Screen widget that refreshes Monthly Revenue, YTD Revenue, Current ARR, or Sales Leaderboard securely in the background.

**Architecture:** Extract shared server metric queries and expose them through a read-only, revocable widget-token endpoint. A custom Capacitor bridge stores the opaque credential in shared Keychain, while a WidgetKit extension fetches background snapshots, caches them in an App Group, and renders configurable small/medium views.

**Tech Stack:** Next.js 14, TypeScript, libSQL, Capacitor 8, Swift 5, SwiftUI, WidgetKit, App Intents, Keychain Services, App Groups, XCTest.

**Spec:** `docs/superpowers/specs/2026-08-22-ios-metrics-widget-design.md`

## Global Constraints

- Keep the containing app's deployment target at iOS 15.0. Set the WidgetKit extension and its tests to iOS 17.0 because `AppIntentConfiguration` and `WidgetConfigurationIntent` require iOS 17; users on iOS 15–16 retain the app but do not receive this widget target.
- Support only `systemSmall` and `systemMedium` in the first release.
- Offer Monthly Revenue, YTD Revenue, Current ARR, and Sales Leaderboard through one configurable widget.
- Request 30-minute refreshes without promising exact timing.
- Widget authentication is read-only, tenant/staff scoped, hashed server-side, revocable, and permission-aware.
- Use `reports.view` for revenue/ARR and `leaderboard.view_sales` for sales rankings, with the existing admin equivalent.
- Cache only validated responses whose company/staff identity matches the active token metadata.
- No APNs widget pushes, Android widget, mutation action, or WebView-cookie sharing.
- Preserve all unrelated user-owned untracked files.

---

### Task 1: Extract reusable widget metric queries

**Files:**
- Create: `apps/web/src/lib/widget-metrics.ts`
- Modify: `apps/web/src/app/api/revenue/route.ts`
- Modify: `apps/web/src/app/api/leaderboard/route.ts`
- Modify: `apps/web/src/app/api/reports/subscriptions/route.ts`
- Create: `apps/web/tests/widget-metrics.test.ts`

**Interfaces:**
- Produces: `getRevenueMetric`, `getCurrentArrCents`, `getSalesLeaderboard`, and `WidgetMetricsSnapshot`.

- [ ] **Step 1: Write failing parity tests with a recording DB fake**

```ts
test("builds the four widget metrics from existing definitions", async () => {
  const snapshot = await buildWidgetMetrics(fakeDb, 42, new Date("2026-08-22T18:00:00Z"));
  assert.equal(snapshot.monthly_revenue.total_cents, 990200);
  assert.equal(snapshot.ytd_revenue.total_cents, 4820000);
  assert.equal(snapshot.current_arr_cents, 1200000);
  assert.deepEqual(snapshot.sales_leaderboard.map((row) => row.name), ["Aubrey", "Jack", "David"]);
});
```

The fake returns fixed job, active-subscription, and staff-assignment rows and asserts every query includes `company_id = ?`.

- [ ] **Step 2: Run and verify module-not-found failure**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/widget-metrics.test.ts
```

- [ ] **Step 3: Implement focused server helpers**

```ts
export type WidgetTrendPoint = { date: string; cents: number };
export type WidgetLeaderboardRow = {
  staff_id: number;
  name: string;
  revenue_cents: number;
  job_count: number;
};
export type WidgetMetricsSnapshot = {
  monthly_revenue: { total_cents: number; trend: WidgetTrendPoint[] };
  ytd_revenue: { total_cents: number; trend: WidgetTrendPoint[] };
  current_arr_cents: number;
  sales_leaderboard: WidgetLeaderboardRow[];
};
export async function buildWidgetMetrics(
  db: Db,
  companyId: number,
  now = new Date()
): Promise<WidgetMetricsSnapshot>;
```

Move the existing date-range, job-value, active-subscription MRR × 12, and monthly sales-ranking calculations behind shared functions. Existing routes call these functions and retain their response shapes.

- [ ] **Step 4: Run parity tests, existing tests, and web build**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/widget-metrics.test.ts
npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/widget-metrics.ts apps/web/src/app/api/revenue/route.ts apps/web/src/app/api/leaderboard/route.ts apps/web/src/app/api/reports/subscriptions/route.ts apps/web/tests/widget-metrics.test.ts
git commit -m "refactor: share widget metric queries"
```

### Task 2: Add widget token persistence and validation

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/lib/widget-auth.ts`
- Create: `apps/web/tests/widget-auth.test.ts`
- Modify: `apps/web/src/lib/tenant-deletion.ts` only if schema inspection proves a missing cascade.

**Interfaces:**
- Produces: `issueWidgetToken`, `authenticateWidgetToken`, `revokeWidgetToken`, `hashWidgetSecret`, and `WidgetPrincipal`.

- [ ] **Step 1: Write failing token-policy tests**

```ts
test("stores hashes and authenticates an active matching installation", async () => {
  const issued = await issueWidgetToken(fakeDb, {
    companyId: 42, staffId: 9, installationId: "install-secret", now,
  });
  assert.notEqual(issued.token, fakeDb.inserted.token_hash);
  assert.equal((await authenticateWidgetToken(fakeDb, issued.token, now))?.staffId, 9);
});

test("rejects expired, revoked, deleted, and access-revoked principals", async () => {
  assert.equal(await authenticateWidgetToken(expiredDb, token, now), null);
  assert.equal(await authenticateWidgetToken(revokedDb, token, now), null);
  assert.equal(await authenticateWidgetToken(missingStaffDb, token, now), null);
  assert.equal(await authenticateWidgetToken(revokedCompanyDb, token, now), null);
});
```

- [ ] **Step 2: Run and verify module-not-found failure**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/widget-auth.test.ts
```

- [ ] **Step 3: Add the table and indexes**

```sql
CREATE TABLE IF NOT EXISTS widget_access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  installation_id_hash TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'widget:read',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_widget_tokens_company_staff_install
  ON widget_access_tokens(company_id, staff_id, installation_id_hash);
```

- [ ] **Step 4: Implement opaque token issuance and bearer validation**

```ts
export type WidgetPrincipal = { companyId: number; staffId: number; tokenId: number };
export const hashWidgetSecret = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
```

Use `randomBytes(32).toString("base64url")`, a 180-day expiration, and a transaction that revokes prior active rows for the same company/staff/installation hash before inserting the replacement. Authentication joins `staff` and `company`, checks expiration/revocation/access status, and updates `last_used_at` only after success.

- [ ] **Step 5: Prove cascades and run tests**

```bash
npm test
```

Inspect `PRAGMA foreign_key_list(widget_access_tokens)` in the test database. Add explicit tenant cleanup only if the active database path does not enforce the declared cascades.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/db.ts apps/web/src/lib/widget-auth.ts apps/web/tests/widget-auth.test.ts apps/web/src/lib/tenant-deletion.ts
git commit -m "feat: add scoped widget tokens"
```

### Task 3: Expose issuance, revocation, and summary APIs

**Files:**
- Create: `apps/web/src/app/api/widget/token/route.ts`
- Create: `apps/web/src/app/api/widget/summary/route.ts`
- Create: `apps/web/src/lib/widget-response.ts`
- Create: `apps/web/tests/widget-response.test.ts`
- Create: `apps/web/tests/widget-route-auth.test.ts`

**Interfaces:**
- Consumes: session auth for issuance; bearer auth for revocation/summary; metric helpers from Task 1.
- Produces: versioned `WidgetSummaryResponse` JSON.

- [ ] **Step 1: Write failing response-permission tests**

```ts
test("omits report metrics without reports.view", () => {
  const response = authorizeWidgetMetrics(snapshot, new Set(["leaderboard.view_sales"]));
  assert.equal(response.metrics.monthly_revenue, null);
  assert.equal(response.metrics.current_arr_cents, null);
  assert.equal(response.metrics.sales_leaderboard?.length, 3);
});

test("evaluates every metric for the authenticated principal's tenant", async () => {
  const calls: number[] = [];
  await buildAuthorizedWidgetSummary(
    { companyId: 42, staffId: 9, tokenId: 1 },
    new Set(["reports.view", "leaderboard.view_sales"]),
    metricLoadersThatRecordCompany(calls)
  );
  assert.deepEqual(new Set(calls), new Set([42]));
});
```

- [ ] **Step 2: Run and verify module-not-found failure**

```bash
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --no-warnings --experimental-strip-types --test tests/widget-response.test.ts
```

- [ ] **Step 3: Define the response contract**

```ts
export type WidgetSummaryResponse = {
  version: 1;
  company_id: number;
  staff_id: number;
  updated_at: string;
  permissions: { reports: boolean; sales_leaderboard: boolean };
  metrics: {
    monthly_revenue: { total_cents: number; trend: WidgetTrendPoint[] } | null;
    ytd_revenue: { total_cents: number; trend: WidgetTrendPoint[] } | null;
    current_arr_cents: number | null;
    sales_leaderboard: WidgetLeaderboardRow[] | null;
  };
};
```

- [ ] **Step 4: Add endpoint-boundary authentication tests**

Test the exported bearer parser with a cookie-only request, a malformed scheme, a valid bearer header, and a bearer-plus-cookie request. Cookie-only requests must remain unauthorized; the bearer is the sole widget principal. Exercise `GET /api/widget/summary` and `DELETE /api/widget/token` through dependency-injected route handlers to prove they pass only the authenticated principal's `companyId` to data/revocation functions. Exercise one existing mutation handler with only the widget bearer and no CRM session and require `401`, proving this credential does not enter the normal session-auth path.

- [ ] **Step 5: Implement the routes**

`POST /api/widget/token` requires a native-marked authenticated session, a real `staffId`, and `{ installation_id }`; it returns `{ token, expires_at, company_id, staff_id }`. `DELETE` requires the bearer token and revokes only that token. `GET /api/widget/summary` authenticates bearer credentials, loads current permissions through the existing permission resolver, computes only authorized sections, sends `Cache-Control: private, no-store`, and never accepts cookie authentication.

```ts
const auth = req.headers.get("authorization");
const bearer = auth?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1] ?? null;
if (!bearer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- [ ] **Step 6: Run tests/build and commit**

```bash
npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
git add apps/web/src/app/api/widget apps/web/src/lib/widget-response.ts apps/web/tests/widget-response.test.ts apps/web/tests/widget-route-auth.test.ts
git commit -m "feat: expose widget metrics API"
```

### Task 4: Add the native credential/cache bridge

**Files:**
- Create: `apps/mobile/ios/App/App/ForgeWidgetPlugin.swift`
- Create: `apps/mobile/ios/App/App/ForgeWidgetStore.swift`
- Create: `apps/web/src/lib/native-widget.ts`
- Modify: `apps/web/src/components/NativeChrome.tsx`
- Modify: `apps/web/src/components/NavBar.tsx`
- Modify: `apps/web/src/components/pulse/Sidebar.tsx`
- Modify: `apps/web/src/app/(app)/more/page.tsx`
- Modify: `apps/mobile/ios/App/App/App.entitlements`
- Create: `apps/mobile/ios/App/ForgeWidgets/ForgeWidgets.entitlements`

**Interfaces:**
- Produces native plugin methods: `getInstallation`, `storeCredential`, `credentialMetadata`, `clearCredential`, `refreshSnapshot`.

- [ ] **Step 1: Create native store tests before implementation**

Add an XCTest target in the next project task and author tests now for stable installation ID, Keychain round-trip, atomic App Group cache replacement, cache clear, and company/staff identity matching.

```swift
func testRejectsCacheFromAnotherPrincipal() throws {
    let store = ForgeWidgetStore(keychain: memoryKeychain, defaults: memoryDefaults)
    try store.saveCredential(.init(token: "a", companyID: 42, staffID: 9, expiresAt: future))
    try store.saveSnapshot(snapshot(companyID: 99, staffID: 9))
    XCTAssertNil(try store.loadSnapshot())
}
```

- [ ] **Step 2: Implement Keychain and App Group storage**

Use `$(AppIdentifierPrefix)app.forgecrm.widgets` for Keychain access and `group.app.forgecrm` for shared defaults/files. Store credential metadata separately from the snapshot and use write-to-temporary-plus-replace for snapshot JSON.

```swift
struct ForgeWidgetCredential: Codable {
    let token: String
    let companyID: Int
    let staffID: Int
    let expiresAt: Date
}
```

- [ ] **Step 3: Implement the bridged plugin**

```swift
@objc(ForgeWidgetPlugin)
public final class ForgeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ForgeWidgetPlugin"
    public let jsName = "ForgeWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        .init(name: "getInstallation", returnType: CAPPluginReturnPromise),
        .init(name: "storeCredential", returnType: CAPPluginReturnPromise),
        .init(name: "credentialMetadata", returnType: CAPPluginReturnPromise),
        .init(name: "clearCredential", returnType: CAPPluginReturnPromise),
        .init(name: "refreshSnapshot", returnType: CAPPluginReturnPromise),
    ]
}
```

Each mutation calls `WidgetCenter.shared.reloadAllTimelines()`.

- [ ] **Step 4: Add the TypeScript bridge and bootstrap**

```ts
const ForgeWidget = registerPlugin<ForgeWidgetPlugin>("ForgeWidget");
export async function ensureNativeWidgetCredential(): Promise<void>;
export async function clearNativeWidgetCredential(): Promise<void>;
```

`ensureNativeWidgetCredential` runs only on iOS native, reuses a credential with more than 30 days remaining, otherwise calls the issuance endpoint and stores the result. `NativeChrome` runs it after native startup and when the app becomes active.

- [ ] **Step 5: Centralize native logout cleanup**

Create a shared logout helper that reads the bearer credential, calls `DELETE /api/widget/token`, clears Keychain/cache even when deletion fails, then posts `/api/logout`. Replace all three existing logout implementations with it.

- [ ] **Step 6: Run web tests/build**

```bash
npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
```

Commit after Task 5 adds the Xcode references and native tests, so this task never leaves unreferenced Swift files.

### Task 5: Add the WidgetKit and XCTest targets

**Files:**
- Modify: `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`
- Create: `apps/mobile/ios/App/ForgeWidgets/Info.plist`
- Create: `apps/mobile/ios/App/ForgeWidgetTests/Info.plist`
- Modify: containing and widget entitlements from Task 4.

**Interfaces:**
- Produces: `ForgeWidgets.appex` embedded in `App.app` and runnable `ForgeWidgetTests`.

- [ ] **Step 1: Add target definitions and capabilities**

Add product references, sources/resources/framework phases, target dependencies, Embed App Extensions copy phase, configurations, and schemes. Bundle identifiers:

```text
app.forgecrm
app.forgecrm.widgets
app.forgecrm.widgettests
```

Both app and extension receive App Group `group.app.forgecrm` and Keychain group `$(AppIdentifierPrefix)app.forgecrm.widgets`. Add WidgetKit, SwiftUI, AppIntents, Security, and Capacitor dependencies only to targets that use them.

Set `IPHONEOS_DEPLOYMENT_TARGET = 17.0` for `ForgeWidgets` and `ForgeWidgetTests` only. Keep `App` at 15.0. In Signing & Capabilities, enable the App Group and Keychain Sharing groups for both the containing app and widget extension; confirm the identifiers exist for the Apple Developer team before attempting a device archive.

- [ ] **Step 2: Verify Xcode recognizes all targets**

```bash
xcodebuild -project apps/mobile/ios/App/App.xcodeproj -list
xcodebuild -project apps/mobile/ios/App/App.xcodeproj -scheme App -showBuildSettings | rg 'PRODUCT_BUNDLE_IDENTIFIER|IPHONEOS_DEPLOYMENT_TARGET'
```

Expected: schemes include App and ForgeWidgetTests; App remains iOS 15.0, while ForgeWidgets and ForgeWidgetTests are iOS 17.0.

- [ ] **Step 3: Run the initially failing native store tests**

```bash
xcodebuild test -project apps/mobile/ios/App/App.xcodeproj -scheme ForgeWidgetTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Expected before the final store implementation: tests fail on missing persistence behavior. Finish the Task 4 implementation, rerun, and require PASS.

- [ ] **Step 4: Commit Tasks 4 and 5 together**

```bash
git add apps/mobile/ios/App apps/web/src/lib/native-widget.ts apps/web/src/components/NativeChrome.tsx apps/web/src/components/NavBar.tsx apps/web/src/components/pulse/Sidebar.tsx 'apps/web/src/app/(app)/more/page.tsx'
git commit -m "feat: bridge widget credentials to iOS"
```

### Task 6: Implement the background timeline provider and cache fallback

**Files:**
- Create: `apps/mobile/ios/App/ForgeWidgets/WidgetModels.swift`
- Create: `apps/mobile/ios/App/ForgeWidgets/WidgetAPIClient.swift`
- Create: `apps/mobile/ios/App/ForgeWidgets/ForgeWidgetProvider.swift`
- Create: `apps/mobile/ios/App/ForgeWidgetTests/WidgetProviderTests.swift`

**Interfaces:**
- Produces: `ForgeWidgetSnapshot`, `ForgeWidgetEntry`, `ForgeWidgetAPIClient`, and `ForgeWidgetProvider`.

- [ ] **Step 1: Write failing decoding/provider tests**

Cover a valid version-1 response, malformed JSON preserving cache, offline cache, 401 clearing credential/cache, authorized responses with null metric sections producing a permission state, 403 producing a reconnect/server-policy state, identity mismatch rejection, and refresh date within one second of 30 minutes.

```swift
func testSuccessfulTimelineRequestsThirtyMinuteRefresh() async throws {
    let timeline = try await provider.timeline(for: .monthlyRevenue, in: testContext)
    XCTAssertEqual(timeline.entries.count, 1)
    guard case .after(let refreshDate) = timeline.policy else {
        return XCTFail("Expected an after-date reload policy")
    }
    XCTAssertEqual(refreshDate.timeIntervalSince(now), 1800, accuracy: 1)
}
```

- [ ] **Step 2: Implement Codable models matching the server contract**

```swift
struct ForgeWidgetSnapshot: Codable {
    let version: Int
    let companyID: Int
    let staffID: Int
    let updatedAt: Date
    let permissions: WidgetPermissions
    let metrics: WidgetMetrics
}
```

Use explicit `CodingKeys` for snake_case JSON and `ISO8601DateFormatter` with fractional-second fallback.

- [ ] **Step 3: Implement authenticated fetch and fallback**

```swift
var request = URLRequest(url: URL(string: "https://www.forgecrm.app/api/widget/summary")!)
request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
request.cachePolicy = .reloadIgnoringLocalCacheData
```

On 200 validate identity, replace the full cache atomically, and use null metric sections plus the permissions object for permission-denied states. On 401 clear credential/cache. On network/5xx/decode failure use the last valid cache. Return `.after(now + 1800)` for every non-gallery timeline. Treat a 403 as an invalid principal/server-policy response rather than the normal metric-permission mechanism.

- [ ] **Step 4: Run native tests and commit**

```bash
xcodebuild test -project apps/mobile/ios/App/App.xcodeproj -scheme ForgeWidgetTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
git add apps/mobile/ios/App/ForgeWidgets apps/mobile/ios/App/ForgeWidgetTests
git commit -m "feat: refresh widget metrics in background"
```

### Task 7: Build the configurable small and medium widget UI

**Files:**
- Create: `apps/mobile/ios/App/ForgeWidgets/ForgeWidgetIntent.swift`
- Create: `apps/mobile/ios/App/ForgeWidgets/ForgeWidgetView.swift`
- Create: `apps/mobile/ios/App/ForgeWidgets/ForgeWidgets.swift`
- Create: `apps/mobile/ios/App/ForgeWidgetTests/WidgetFormattingTests.swift`

**Interfaces:**
- Produces: `WidgetMetric` App Intent enum and a single configurable Forge widget.

- [ ] **Step 1: Write formatting tests**

```swift
XCTAssertEqual(formatCompactCurrency(0), "$0")
XCTAssertEqual(formatCompactCurrency(990200), "$9.9K")
XCTAssertEqual(formatCompactCurrency(1_250_000_00), "$1.3M")
```

- [ ] **Step 2: Define the configuration enum and intent**

```swift
enum WidgetMetric: String, AppEnum {
    case monthlyRevenue, ytdRevenue, currentARR, salesLeaderboard
}

struct SelectForgeMetricIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Forge Metric"
    @Parameter(title: "Metric", default: .monthlyRevenue)
    var metric: WidgetMetric
}
```

- [ ] **Step 3: Implement family-specific views and states**

Small KPI views show label, compact currency, mini trend, and relative update age. Small leaderboard shows the top rep. Medium KPI views show a larger trend; medium leaderboard shows the top three. Add explicit connected, cached/stale, zero, unavailable, permission-denied, and reconnect states. Because the extension target starts at iOS 17, use `containerBackground(for: .widget)` directly.

- [ ] **Step 4: Configure deep links and supported families**

```swift
AppIntentConfiguration(kind: "ForgeMetrics", intent: SelectForgeMetricIntent.self, provider: ForgeWidgetProvider()) { entry in
    ForgeWidgetView(entry: entry)
        .widgetURL(entry.metric == .salesLeaderboard
          ? URL(string: "https://www.forgecrm.app/leaderboard")
          : URL(string: "https://www.forgecrm.app/reports"))
}
.supportedFamilies([.systemSmall, .systemMedium])
```

- [ ] **Step 5: Run formatting tests, build extension, and commit**

```bash
xcodebuild test -project apps/mobile/ios/App/App.xcodeproj -scheme ForgeWidgetTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
xcodebuild build -project apps/mobile/ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator'
git add apps/mobile/ios/App/ForgeWidgets apps/mobile/ios/App/ForgeWidgetTests apps/mobile/ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat: add configurable Forge metrics widget"
```

### Task 8: End-to-end verification and release build

**Files:**
- Modify: `apps/mobile/ios/App/App.xcodeproj/project.pbxproj` for the next build number only after verification.

**Interfaces:**
- Consumes: deployed widget API and signed iOS app/extension.
- Produces: reviewed source and an App Store-ready build with physical-device evidence.

- [ ] **Step 1: Run all automated verification**

```bash
cd apps/web && npm test
/Users/andrewelliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build
cd ../..
xcodebuild test -project apps/mobile/ios/App/App.xcodeproj -scheme ForgeWidgetTests -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
xcodebuild build -project apps/mobile/ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator'
git diff --check
```

- [ ] **Step 2: Review security and tenant isolation**

Verify plaintext tokens never enter logs/database, bearer credentials cannot call cookie-authenticated mutation routes, permissions are re-read, App Group cache identity is checked, logout clears local data, and staff/company deletion cascades invalidate access.

- [ ] **Step 3: Confirm Apple capability provisioning**

In the Apple Developer account/Xcode Signing & Capabilities, verify `group.app.forgecrm` and the shared Keychain access group are enabled for `app.forgecrm` and `app.forgecrm.widgets`, then refresh provisioning profiles. Stop before archive if either entitlement is absent from the signed app or extension.

- [ ] **Step 4: Deploy server changes before installing the native build**

After review and explicit push authorization, deploy the widget token/summary endpoints and verify a production token can fetch only its own tenant's authorized metrics.

- [ ] **Step 5: Verify on a physical iPhone outside the debugger**

Sign in through Forge, add multiple widget instances, choose each metric, background/terminate Forge, and observe at least one system-scheduled refresh. Test offline cache age, reconnect, logout, permission removal, account deletion, deep links, small/medium layouts, long rep names, zero metrics, and multiple tenant sessions.

- [ ] **Step 6: Increment the build number, archive, and validate**

Raise `CURRENT_PROJECT_VERSION` by one, archive with automatic signing, verify `ForgeWidgets.appex` is embedded and signed, validate the archive in Organizer, then distribute through App Store Connect.

- [ ] **Step 7: Commit release metadata**

```bash
git add apps/mobile/ios/App/App.xcodeproj/project.pbxproj
git commit -m "build: prepare Forge widget release"
```
