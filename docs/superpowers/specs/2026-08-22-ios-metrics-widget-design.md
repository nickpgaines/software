# iOS Metrics Widget Design

**Date:** 2026-08-22
**Status:** Approved in conversation

## Problem

Forge's iOS app is a Capacitor shell around the hosted Next.js application. Users want an iOS Home Screen widget for monthly and yearly revenue, sales-rep rankings, and ARR. A WidgetKit extension runs outside the Capacitor WebView, so it cannot safely depend on the WebView's `crm_session` cookie or on Forge being open.

The widget must refresh in the background, remain useful when temporarily offline, preserve tenant and employee authorization, and reuse Forge's existing metric definitions so the widget and web application do not disagree.

## Scope Boundary

This design covers only the native iOS metrics widget. The separately approved job-lifecycle SMS repair is an independent bounded change and will be implemented and reviewed separately.

## Goals

- Provide one configurable Forge widget that users can add multiple times.
- Support `systemSmall` and `systemMedium` widget families.
- Offer four configurations: Monthly Revenue, YTD Revenue, Current ARR, and Sales Leaderboard.
- Fetch fresh data while Forge is not running.
- Request a refresh every 30 minutes while accepting that WidgetKit controls the actual schedule.
- Display cached data and its age when the network is unavailable.
- Keep widget access read-only, tenant-scoped, employee-scoped, revocable, and permission-aware.
- Deep-link into the corresponding Forge report or leaderboard screen.

## Non-Goals

- Android widgets.
- Lock Screen, StandBy-specific, watchOS, or macOS widget families.
- Real-time or guaranteed 30-minute delivery.
- Push-driven WidgetKit updates in the first release.
- Editing CRM data from the widget.
- Replacing the existing web dashboards or changing their metric definitions.

## Metric Semantics

- **Monthly Revenue:** The current calendar month's `total_cents` using the same job-value calculation as `/api/revenue?range=1m`.
- **YTD Revenue:** The current calendar year's `total_cents` using the same calculation as `/api/revenue?range=ytd`.
- **Current ARR:** Current active-subscription MRR multiplied by 12, matching `revenue.arr_cents` from the subscription report.
- **Sales Leaderboard:** The top three sales-role employees for the current calendar month, ordered with the same revenue and tie-breaking rules as `/api/leaderboard?range=month&view=sales`.

Metric calculation logic will be extracted into reusable server-side functions. Existing authenticated web endpoints and the widget endpoint will call those functions rather than duplicating SQL or arithmetic.

## User Experience

Forge exposes one configurable widget in the widget gallery. An App Intent parameter selects one of the four metrics for each widget instance.

### Small

- Monthly Revenue, YTD Revenue, and Current ARR show the metric name, formatted value, a compact supporting trend where space permits, and the last-updated age.
- Sales Leaderboard shows the leading rep and a compact indication of their monthly revenue.

### Medium

- Revenue and ARR configurations show the headline value and a compact trend series.
- Sales Leaderboard shows the top three reps with rank, name, and monthly revenue.

Tapping a revenue or ARR widget opens the Forge Reports page. Tapping a leaderboard widget opens the Forge Leaderboard page. Empty data displays `$0` or an empty-state label rather than an error.

## Architecture

### Server

Add a `widget_access_tokens` table with:

- a unique SHA-256 token hash;
- a hash of a random per-installation identifier generated and retained in the shared Keychain;
- `company_id` and `staff_id` foreign keys with delete cascades;
- a fixed read-only scope;
- expiration, revocation, last-used, and creation timestamps.

The authenticated mobile WebView obtains the installation identifier from the native bridge and requests an opaque widget credential from a token-issuance endpoint. Tokens expire after 180 days and are rotated automatically when Forge opens within 30 days of expiration. Issuing a replacement revokes prior active widget tokens for that employee/device installation.

A dedicated bearer-authenticated widget summary endpoint validates the token, employee, company, expiration, revocation state, company access status, and current employee permissions. It returns only metrics the employee may view. The response contains all authorized widget metrics in one payload so multiple installed widget configurations can share one cached snapshot.

No endpoint accepts mutations through widget authentication.

### Capacitor Bridge

Add a focused iOS Capacitor plugin responsible for:

- storing and deleting the opaque credential in a Keychain access group shared by the app and widget;
- storing the latest successful metrics response in an App Group container;
- requesting a WidgetKit timeline reload after token or cached-data changes.

`NativeChrome` invokes the authenticated issuance endpoint after a native session becomes available, hands the credential to the plugin, and requests a fresh snapshot. The existing browser experience remains unchanged. The three existing native logout entry points use a shared helper that revokes the server token when possible and always clears the shared credential and cached metrics locally before completing web logout. Account or staff deletion invalidates the token through database cascades even if the client cannot call logout.

### Widget Extension

Add a WidgetKit extension and an `AppIntentTimelineProvider`:

1. Read the credential from the shared Keychain group.
2. Fetch the widget summary with `URLSession`.
3. Validate and decode the response.
4. Save a successful response to the App Group cache.
5. Return a timeline that requests another refresh after 30 minutes.

If the request fails, use the last valid cache and retain its original `updated_at`. If there is no credential, or the endpoint reports an invalid or revoked credential, render “Open Forge to reconnect” and deep-link to the app. The extension never displays data from a cache whose company or staff identity differs from the active token metadata.

The containing app calls `WidgetCenter.reloadAllTimelines()` after foreground refresh and credential changes. The 30-minute provider refresh remains the fallback for changes made on another device or by another employee.

## Authorization

- Monthly Revenue, YTD Revenue, and Current ARR require `reports.view` or the existing admin-account equivalent.
- Sales Leaderboard requires `leaderboard.view_sales` or the existing admin-account equivalent.
- Permission loss takes effect on the next endpoint request; cached unauthorized metric sections are removed when a successful restricted response arrives.
- Company access revocation, staff deletion, company deletion, token expiration, and explicit logout all prevent future API refreshes.
- Server logs and database rows store only token hashes, never bearer-token plaintext.

## Refresh Behavior

The provider requests a new timeline after 30 minutes. WidgetKit may defer or coalesce requests based on system budgets. A successful refresh replaces the shared cache atomically. Network failures do not erase a valid cache.

The first release does not use APNs widget pushes. The design leaves that as a future optimization if owners later require near-immediate changes after server-side activity while the app is closed.

## Error Handling

- **No credential:** Show “Open Forge to connect.”
- **Expired, revoked, or unauthorized credential:** Delete the local credential and cache, then show “Open Forge to reconnect.”
- **Network or server failure with cache:** Show cached values and their age.
- **Network or server failure without cache:** Show a retry-oriented unavailable state.
- **Malformed response:** Preserve the last valid cache and record a native diagnostic without exposing response contents.
- **Metric permission denied:** Show “Not available for this account” for that configuration without leaking the metric value.

## Testing

### Server

- Metric helper tests prove parity with the existing revenue, ARR, and leaderboard responses.
- Token tests cover hashing, issuance, rotation, expiration, revocation, staff/company cascades, access revocation, and permission changes.
- Endpoint tests prove tenant isolation and verify that widget tokens cannot authenticate normal mutation endpoints.

### Native

- Swift tests cover response decoding, currency formatting inputs, token metadata, atomic cache replacement, stale-cache fallback, and identity mismatch rejection.
- Timeline-provider tests use a controlled URL protocol to cover success, offline cache, invalid token, permission denial, malformed response, and 30-minute requested refresh.
- Widget previews and snapshot tests cover all four metrics in small and medium families, including zero, large-number, long-name, stale, disconnected, and permission-denied states.

### Integration

- On a physical device, sign in through the Capacitor app, add multiple configured widgets, force the app to the background, and verify the widget refreshes without reopening Forge.
- Verify deep links, logout clearing, account deletion invalidation, offline fallback, permission removal, and token rotation.
- Test background behavior outside the Xcode debugger because debug sessions do not reflect normal WidgetKit refresh budgeting.

## Delivery Order

1. Complete and deploy the independent job-lifecycle SMS repair.
2. Extract shared server metric helpers and add widget token/API support.
3. Add the Capacitor credential/cache bridge and lifecycle integration.
4. Add the configurable WidgetKit extension and deep links.
5. Run server, native, simulator, and physical-device verification.
6. Increment the iOS build number and distribute a new build only after both workstreams pass review.

## Apple Platform Constraints

WidgetKit controls actual refresh timing and applies a dynamic daily budget. The implementation requests 30-minute refreshes but does not promise exact timing. The provider performs authenticated network requests while the extension is active and preserves a cached snapshot for periods when iOS does not grant execution time or the network is unavailable.

References:

- [Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [Making network requests in a widget extension](https://developer.apple.com/documentation/widgetkit/making-network-requests-in-a-widget-extension)
- [Making a configurable widget](https://developer.apple.com/documentation/widgetkit/making-a-configurable-widget)
