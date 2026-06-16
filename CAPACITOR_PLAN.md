# Capacitor Mobile App Plan

How we turn the existing Next.js web app into an iOS (and Android) app with
Capacitor, and get it through App Store review.

## TL;DR

- This is a **server-rendered** Next.js app: 154 API routes, server
  components, middleware auth, libSQL, Stripe, Twilio. A static export
  (`output: 'export'`) is **not** an option — it would be a near-total rewrite.
- So we use the **hybrid approach**: keep the app hosted on Vercel exactly as
  it is, and ship a thin Capacitor native shell whose webview loads the
  production site. We then layer real native features on top so the app is
  more than a website wrapper.
- The web side is already PWA-ready (manifest, service worker, icons,
  `viewport-fit: cover`, apple-web-app meta), so we're starting from a good
  baseline.
- Biggest risks to plan around: **App Store Guideline 4.2** (pure web wrappers
  get rejected — we must add native value), session **cookie persistence** in
  the webview, and **Twilio voice** (WebRTC mic) behaving inside WKWebView.

---

## Current status (session handoff — read this first)

**Last updated after Phase 1 scaffold.** This section exists so a new session
can resume without re-investigating. Everything below is verified, not assumed.

### Branches

- `feature/capacitor` — integration branch, off `main`. Holds the plan.
- `ae/capacitor-scaffold` — active working branch, off `feature/capacitor`.
  Holds the Phase 1 Capacitor scaffold. **Nothing has been pushed.**

### Done

- ✅ **Phase 0** — architecture decided: hybrid / remote-URL shell (see below).
- ✅ **Phase 1** — Capacitor scaffold under `apps/mobile`, iOS + Android
  platforms added, **iOS simulator build verified green** (`** BUILD
  SUCCEEDED **` on iPhone 17 sim, Debug, `CODE_SIGNING_ALLOWED=NO`).

### What exists in `apps/mobile`

- `capacitor.config.ts` — `appId: com.forge.crm`, `appName: Forge`,
  `webDir: www`. The `server.url` block is **commented out** — set it to the
  production domain (or a LAN dev URL) to actually load the hosted app.
- `www/index.html` — offline/fallback shell only (shown until `server.url` is
  set or when offline). The real UI is the hosted Next.js app.
- `ios/` — native Xcode project. **Capacitor 8 uses Swift Package Manager, not
  CocoaPods** (no `Podfile`/`pod install`).
- `android/` — native Gradle project.
- Native projects + `package-lock.json` are committed; `node_modules/` and
  build output are gitignored.

### Environment gotchas (important)

- **Node:** the shell default is **v16.17.0 (too old for Capacitor)**. Use
  Node 24 via nvm for every Capacitor/npm command:
  ```bash
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 24
  ```
- **Toolchain present:** Xcode 26.3, CocoaPods 1.11.3 (unused by Cap 8).
- **No root `package.json`** — this is *not* an npm-workspaces monorepo;
  `apps/mobile` is its own standalone package with its own `node_modules`.

### Common commands (run from `apps/mobile`, Node 24 active)

```bash
npx cap sync ios          # copy web assets + sync native after config/plugin changes
npx cap open ios          # open the project in Xcode
npx cap run ios           # build + launch on simulator/device
npx cap doctor            # validate the setup (currently all green)
# verify iOS simulator build headlessly:
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' \
  -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

### Codebase facts already established (don't re-investigate)

- Server-rendered Next.js (App Router) in `apps/web`; **154 API routes**,
  server components, middleware auth → **static export is not viable**, hence
  the hybrid approach.
- Auth: cookie-based HMAC, cookie name **`crm_session`**, set/checked in
  `apps/web/src/middleware.ts`. Middleware also does an Origin/Referer CSRF
  check on POST/PUT/PATCH/DELETE — relevant to Phase 2.
- Already PWA-ready: `apps/web/public/manifest.json` (name "Forge"),
  `public/sw.js`, icons under `public/icons/`, `viewport-fit: cover` and
  apple-web-app meta in `apps/web/src/app/layout.tsx`.
- Native-API surfaces to wire up in Phase 3: `navigator.geolocation` (map /
  door-knock), Twilio Voice WebRTC mic in `components/PhoneClient.tsx`, photo
  uploads.

### Immediate next steps

1. **Phase 0 open questions still unanswered** (bottom of this file) — most
   importantly the production domain for `server.url`, and iOS-only vs both.
2. Once a URL exists, set `server.url`, `npx cap sync ios`, and boot on a real
   device to hit Phase 1's true exit criteria (log in + use the CRM).
3. Then Phase 2 (auth/cookie persistence in WKWebView) — note: auth changes
   require explicit approval per `CLAUDE.md`.

---

## Phase 0 — Decide the architecture (½ day)

**Decision: hybrid / remote-URL shell, not static export.**

- Capacitor normally bundles a static web build and runs it offline from the
  device. Our app can't be statically exported — it depends on server
  components, dynamic API routes, and middleware. Forcing a static SPA rewrite
  would cost weeks and re-introduce auth/Stripe risk.
- Instead, Capacitor's webview points at the live Vercel URL. The server,
  auth, billing, and data layer are untouched. We add native plugins for the
  things a website can't do.
- Trade-off: the app needs network to function (acceptable for a CRM). We add
  a friendly offline screen rather than true offline data sync in v1.

Output of this phase: agreed approach + a dedicated production domain for the
app (e.g. `app.<domain>`) so the shell always loads a stable origin.

---

## Phase 1 — Scaffold Capacitor & boot on a device (1–2 days)

1. Add a `apps/mobile` workspace (keeps native projects out of the web app).
2. Install Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`,
   `@capacitor/android`).
3. Set `appId` (e.g. `com.<company>.forge`), `appName`, and configure
   `server.url` / `server.hostname` to the production domain so the webview
   loads the hosted app.
4. `npx cap add ios` / `npx cap add android`, then run on the iOS simulator and
   a real device. Confirm login, dashboard, maps, and Stripe pages render.

Exit criteria: you can log in and use the core CRM from the app on a physical
iPhone.

### Local dev smoke test (before a production domain exists)

`server.url` is driven by the `CAP_SERVER_URL` env var (see
`apps/mobile/capacitor.config.ts`) so no machine-specific URL is committed.

**Simulator (recommended — zero config):** `localhost` is exempt from iOS App
Transport Security, so plain HTTP just works.

1. In `apps/web` (Node 16 is fine here): `npm run dev` (serves on `:3000`).
2. In `apps/mobile` with **Node 24** active:
   ```bash
   CAP_SERVER_URL=http://localhost:3000 npx cap run ios
   ```

**Real device on the same Wi‑Fi:** use the Mac's LAN IP (currently
`192.168.1.214`, re-check with `ipconfig getifaddr en0`):
```bash
CAP_SERVER_URL=http://192.168.1.214:3000 npx cap sync ios
```
Plain HTTP to a LAN IP needs a **temporary** App Transport Security exception
in `ios/App/App/Info.plist` (add `NSAppTransportSecurity` →
`NSAllowsArbitraryLoads = true`). **Remove it before shipping** — App Store
review rejects arbitrary-loads. Production uses `https://`, which needs no
exception. This is why the simulator path is preferred for day-to-day testing.

---

## Phase 2 — Make auth & networking solid in the webview (2–4 days)

The cookie-based HMAC session is the main thing to harden for native.

1. **Session cookie persistence** — confirm the `crm_session` cookie survives
   app restarts in WKWebView. Use `CapacitorCookies` and verify
   `SameSite`/`Secure` flags work over the native origin. This is auth-adjacent
   — per `CLAUDE.md` it needs explicit approval before any change ships.
2. **Origin/CSRF** — middleware blocks cross-origin state-changing requests by
   comparing `Origin`/`Referer` to `host`. Verify the webview sends a matching
   origin; if not, allowlist the Capacitor origin rather than weakening the
   check.
3. **Deep links / universal links** so `invoices/pay/...`, `estimates/accept`,
   and email links open in the app.
4. **Offline fallback** screen when there's no connectivity.

Exit criteria: log in once, force-quit, reopen — still logged in; POST actions
(create job, record payment) work without CSRF errors.

---

## Phase 3 — Add native capabilities (the "not just a website" work) (1 week)

This is what gets us past Apple Guideline 4.2 and makes the app worth
installing. Pick the high-value set:

- **Push notifications** (`@capacitor/push-notifications` + APNs/FCM) for new
  leads, scheduled jobs, payment received. Highest-value native feature.
- **Camera** (`@capacitor/camera`) for job/site photos — wire into the
  existing photo-upload surfaces.
- **Geolocation** (`@capacitor/geolocation`) for the map / door-knock flow,
  which already uses `navigator.geolocation`; route it through the native
  plugin for reliable permissions.
- **Microphone / Twilio Voice** — verify the WebRTC calling flow
  (`PhoneClient`) works in WKWebView; configure mic permission. **Flag:** this
  is the most likely thing to need a native fallback — prototype early.
- **Status bar, splash screen, safe areas, haptics, native share, keyboard
  resize.**

Each native plugin should degrade gracefully if a permission is denied.

---

## Phase 4 — Mobile UX polish (3–5 days)

- Respect safe-area insets (notch / home indicator) — the layout already sets
  `viewport-fit: cover`, so wire `env(safe-area-inset-*)` into the app chrome.
- Hide or simplify marketing pages inside the app; `start_url` is already
  `/login`.
- Handle the Android hardware back button.
- Tune tap targets, scrolling, and momentum for touch.
- App icon + splash for both platforms from the existing 512px icons.

All UI work goes through the design system (`DESIGN_SYSTEM.md`) and existing
primitives — no inline markup, no ad-hoc tokens.

---

## Phase 5 — App Store readiness & submission (1 week + review time)

1. **Apple Developer Program** enrollment ($99/yr) and **Google Play** account
   ($25 once).
2. **Info.plist usage strings** for location, microphone, camera, and
   notifications (required or the app crashes/rejects).
3. **App Privacy "nutrition labels"** in App Store Connect — declare what data
   is collected. We already have `/privacy` and `/data-deletion` pages to point
   to.
4. **In-app purchase review (Guideline 3.1.1)** — the app bills *customers* for
   real-world services via Stripe Connect; physical services are exempt from
   Apple IAP, so Stripe is fine for that. The grey area is charging *companies*
   for their own SaaS subscription inside the app — keep that flow as
   business/B2B (or out-of-app sign-up) to avoid the 30% IAP requirement.
   **Confirm with Apple/legal before submission.** Any change here is billing —
   needs explicit approval per `CLAUDE.md`.
5. **Screenshots, description, keywords**, support URL, marketing assets.
6. **TestFlight** beta with a few real users before public submission.
7. Submit, respond to review notes, ship.

---

## Effort summary

| Phase | Focus | Rough size |
|-------|-------|-----------|
| 0 | Architecture decision | ½ day |
| 1 | Capacitor scaffold + run on device | 1–2 days |
| 2 | Auth/cookies/deep links in webview | 2–4 days |
| 3 | Native plugins (push, camera, geo, voice) | ~1 week |
| 4 | Mobile UX polish | 3–5 days |
| 5 | App Store prep + review | ~1 week + review |

**Realistic first submission: ~4–5 weeks of focused work**, gated mainly by
the Twilio-voice-in-webview prototype (Phase 3) and the IAP/billing review
question (Phase 5).

## Open questions to resolve before starting

1. iOS only first, or iOS + Android together?
2. Is push notification infrastructure (APNs/FCM) something we want in v1?
3. Confirm the company-subscription billing path is acceptable to Apple without
   IAP, or whether it should be handled out-of-app.
4. Does Twilio voice calling need to work on mobile in v1, or can it be a
   "open in browser / fast-follow" feature?
