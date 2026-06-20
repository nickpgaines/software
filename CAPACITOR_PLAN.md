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

- `feature/capacitor` — integration branch, off `main`. Holds the plan + the
  fresh-DB fix (cherry-picked).
- `ae/capacitor-scaffold` — Phase 1 Capacitor scaffold. **Pushed to `origin`.**
- `feature/capacitor-phase2-auth` — off `ae/capacitor-scaffold`. Holds the
  Phase 2 session-cookie persistence + remaining-items work.
- `feature/capacitor-phase3-native` — **active working branch**, off
  `feature/capacitor-phase2-auth`. Holds Phase 3 native capabilities v1
  (geolocation, camera, UX chrome).
- `feature/capacitor` — integration branch, off `main`. Holds the plan + the
  fresh-DB fix (cherry-picked).
- `ae/fix-fresh-db-schema-init` — off `main`. The fresh-DB schema-init fix +
  `.env.example` doc correction, isolated for its own PR to `main`.

### Done

- ✅ **Phase 0** — architecture decided (hybrid / remote-URL shell) and the
  production `server.url` resolved: **`https://www.forgecrm.app/login`** (see
  Phase 0 below). No dedicated subdomain or owner/DNS action needed.
- ✅ **Phase 1 (iOS simulator)** — Capacitor scaffold under `apps/mobile`,
  iOS + Android platforms added, iOS simulator build green, and the **full loop
  verified end-to-end**: native shell → loads the hosted app → **UI login
  (`POST /api/login 200`) → authenticated dashboard renders in-app**. Remaining
  for literal 100%: real-device run (needs Apple signing, Phase 5); Android
  build unverified.
- ✅ **Unblocked local dev** — fixed a pre-existing fresh-DB schema-init bug
  (`company`/`messages`/`messaging_settings` were altered before being created)
  so a fresh libSQL DB initializes; verified signup/login/dashboard + a column
  audit + prod build. Lives on `ae/fix-fresh-db-schema-init`.
- ✅ **Fixed app launching into external Safari** — Capacitor iOS opens a
  server-side redirect on the webview's initial load in the system browser, so
  a logged-in user's `/login`→`/dashboard` redirect bounced to Safari. Adding
  `server.allowNavigation` (host whitelist) keeps redirects in the webview.
  Verified on the simulator.
- ✅ **Phase 2 — session cookie now persists across restarts** — root cause was
  WebKit bug 177478: `crm_session` is delivered via the `fetch('/api/login')`
  `Set-Cookie` response, and WKWebView doesn't flush XHR-set cookies to its
  on-disk store until the app leaves the foreground; a force-quit before that
  flush lost the session. Fix is **native shell only** — `AppDelegate.swift`
  calls `WKWebsiteDataStore.default().httpCookieStore.getAllCookies` on both
  `applicationWillResignActive` and `applicationDidEnterBackground`. It is the
  foreground→inactive/background transition that triggers WebKit to persist the
  cookie; the `getAllCookies` call rides that transition (it does not itself
  write to disk) and is wrapped in a `UIBackgroundTaskIdentifier` assertion so
  the async on-disk write isn't cut off by suspension. Flushing on resign-active
  too means a **logout** that clears `crm_session` is persisted even without a
  clean background transition — otherwise an ended session could be silently
  resurrected on relaunch (deep-review finding, PR #329). **No change to the
  HMAC/session logic or cookie attributes** (the server already sets a 30-day
  persistent cookie). Approved by owner (chose native-flush-then-fallback).
  Verified on the simulator:
  fresh login → home (background) → terminate → cold relaunch → lands on the
  authenticated dashboard, not `/login`. Verified against **local dev (http)**.
  This is representative: the `Secure` attribute only governs whether the cookie
  is *sent* over http/https, not whether WKWebView persists it to disk (which is
  all the flush affects), and bug 177478 applies regardless of `Secure`. A
  faithful https re-test needs a trusted cert in the simulator OR a real account
  — deferred to **Phase 5 / TestFlight** (see checklist there) rather than
  faked locally (a `Secure` cookie over `http://localhost` is rejected outright,
  giving a misleading false negative).
- ✅ **Phase 2 — remaining items (Origin/CSRF, offline, deep-link infra)** —
  (2) **Origin/CSRF**: no change needed; the remote-`server.url` webview's
  origin equals the API host, so the middleware `sameOrigin` check passes for
  in-app POSTs. Verified (matching origin → handler/400, foreign origin → 403).
  (4) **Offline fallback**: `server.errorPath: 'index.html'` shows a branded
  offline screen on load failure, with `online`-event + "Try again" recovery.
  Verified on the simulator. (3) **Deep links**: web-side AASA route added
  (env-gated on `IOS_APP_ID`); native universal-link wiring (entitlement,
  `@capacitor/app`, `appUrlOpen` handler, signed-device test) is deferred to
  Phase 5. See the Phase 2 section for details. **Phase 2 is functionally
  complete** except the Phase-5-gated deep-link finish and the prod `Secure`
  cookie re-test.
- ✅ **Phase 3 — native capabilities v1 (geolocation, camera, UX chrome)** —
  scope chosen by owner: geolocation + camera + chrome polish; **push
  notifications and the Twilio-voice prototype deferred to Phase 5**. Approach
  (owner-approved): real native plugins, called from the hosted web app behind a
  runtime guard. Plugins installed in **both** packages — `apps/mobile` (native
  registration via `cap sync`) and `apps/web` (the JS that calls them):
  `@capacitor/{core,geolocation,camera,status-bar,splash-screen,keyboard}@^8`.
  - **Bridge:** `apps/web/src/lib/native.ts` — `isNativeApp()` plus
    `getCurrentPosition()` / `captureNativePhoto()`. Plugin modules are
    **dynamically imported** so they never load during SSR or in the browser
    bundle; each helper falls back to the web API (or no-op) off-device.
  - **Geolocation:** a "locate me" control added to `MapIconStrip` →
    `MapClient.handleLocate()` drops/moves a blue "you are here" dot and
    recenters. Native plugin in the app, `navigator.geolocation` on web. (The
    map had **no** prior location feature; pins come from the DB.)
  - **Camera:** "Take Photo" button (native-only) in `JobDetailClient`
    attachments → `Camera.getPhoto` (Prompt source) → same compress + upload
    pipeline as the file `<input>` (which still serves web).
  - **UX chrome:** `NativeChrome` (null component in the root layout) sets the
    status bar to light text and hides the splash once the app paints;
    `capacitor.config.ts` configures SplashScreen (autohide fallback, black bg)
    + Keyboard (`resize: native`). Existing safe-area CSS already covers insets.
  - **Native:** `Info.plist` usage strings (location, camera, photo library +
    **`NSPhotoLibraryAddUsageDescription`** — see bug 1); `cap sync` wrote
    `Package.swift` (5 plugins).
  - **Verified end-to-end on the iOS simulator** (local-dev build,
    `CAP_SERVER_URL=http://localhost:3000/login`): app builds + runs; status bar
    shows light text on black + splash hides (chrome ✅); login persists across
    relaunch (Phase 2 cookie flush ✅); the native-only **Take Photo** button
    renders (so `isNativeApp()` works in the webview ✅); tapping it opens the
    photo picker, and selecting a photo runs compress → `POST .../attachments
    201` → the image renders in the list (camera pipeline ✅). The map
    **locate** control couldn't be runtime-checked (no `NEXT_PUBLIC_MAPBOX_TOKEN`
    locally → tiles don't render); deferred to a tokened/device run.
  - **Two real bugs the sim test caught (both would break camera on-device):**
    1. `@capacitor/camera` (IONCameraLib) requires `NSPhotoLibraryAddUsageDescription`
       **unconditionally** — even with `saveToGallery:false`. Without it
       `getPhoto` throws "Camera will not function without it". Added the key.
    2. `CameraResultType.Uri` returns a `capacitor://`-served `webPath` that is
       **cross-origin to the hosted remote-URL app**, so `fetch(webPath)` fails
       silently and nothing uploads. Switched to `CameraResultType.DataUrl`
       (a `data:` URL, fetchable from any origin). **Lesson for remote-URL
       Capacitor apps: prefer DataUrl/Base64 over Uri for plugin file results.**

### Known open items (surfaced during Phase 1 testing → Phase 2/3)

- ✅ ~~**Session cookie persistence (Phase 2)**~~ — RESOLVED via the native
  `AppDelegate` cookie flush (see Done above). Returning users now skip `/login`
  after a force-quit + relaunch.
- **Google "Sign in with Google" (Phase 2/3)** — opens externally (different
  host; Google blocks OAuth in embedded webviews) and can't return to the app
  logged-in without deep-link plumbing + token exchange. Use username/password
  in-app for now.
- ✅ ~~**Map / geolocation (Phase 3)**~~ — DONE: native `@capacitor/geolocation`
  behind the `lib/native` guard + a "locate me" control on the map;
  `NSLocationWhenInUseUsageDescription` added. Note the map still needs
  `NEXT_PUBLIC_MAPBOX_TOKEN` (set in prod, absent in local `.env.local`) to
  render tiles for a local-dev test.

### What exists in `apps/mobile`

- `capacitor.config.ts` — `appId: com.forge.crm`, `appName: Forge`,
  `webDir: www`. `server.url` defaults to **`https://www.forgecrm.app/login`**
  (production); override with the `CAP_SERVER_URL` env var for local dev
  (e.g. `CAP_SERVER_URL=http://localhost:3000`). `server.allowNavigation`
  whitelists the app host so server-side redirects stay in the webview.
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

1. **Real-device run** — boot on a physical iPhone for Phase 1's literal exit
   criterion. Needs an Apple Developer account + signing (Phase 5 enrollment).
2. **Verify the Android build** (`cap run android` / `./gradlew assembleDebug`)
   if shipping both platforms — open question #1.
3. **Phase 2** — confirm the `crm_session` cookie persists in WKWebView across
   app restarts (so returning users skip `/login`), plus deep links. Note: auth
   changes require explicit approval per `CLAUDE.md`.
4. **Merge the DB fix** — open a PR from `ae/fix-fresh-db-schema-init` to `main`
   (shared infra; wants a real review).

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

Output of this phase: agreed approach + a stable production URL for the shell.

**Resolved: `server.url` = `https://www.forgecrm.app/login`.** We considered a
dedicated `app.forgecrm.app` subdomain but it's an optional nicety, not a
requirement — and it needs owner/DNS action we don't have. The production apex
already 307-redirects to the canonical `www.forgecrm.app`, so we point straight
at `www` to avoid a redirect hop on every cold launch. `/login` is a safe entry
point for both states: middleware 307s an already-authenticated request to
`/dashboard`, and serves the login page to logged-out users (both verified
live). No subdomain, no DNS, no owner action required.

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

1. In `apps/web`, **with Node 24 active** (the shell-default Node 16 fails:
   Next.js needs ≥18.17): `npm run dev` (serves on `:3000`). In local dev the
   built-in admin login `admin`/`admin` works (disabled in prod), which is the
   easiest way to drive the simulator without a seeded account.
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

1. ✅ **Session cookie persistence** — DONE. The `crm_session` cookie now
   survives app restarts in WKWebView via a native cookie flush in
   `AppDelegate.applicationDidEnterBackground` (forces WKWebView to persist the
   XHR-set cookie before a force-quit; WebKit bug 177478). No `CapacitorCookies`
   plugin needed for the remote-`server.url` setup. Owner-approved; verified on
   the simulator. (Prod-https `Secure`-cookie re-test still recommended.)
2. ✅ **Origin/CSRF** — DONE (verification only, no change needed). Because the
   webview uses the remote `server.url`, its origin **is** the API host
   (`www.forgecrm.app` in prod, `localhost:3000` in dev) — not a separate
   `capacitor://localhost` scheme — so the middleware `sameOrigin` check passes
   for in-app requests. Verified with the exact headers the webview sends: a
   state-changing POST with a matching `Origin` reached the route handler (got a
   400 for an empty body, **not** a 403); the same POST with a foreign `Origin`
   got 403, confirming the check is live. No allowlisting required.
3. ⏳ **Deep links / universal links** — PARTIAL (web infra done; native gated
   on Phase 5). Done now: the AASA file is served from the web app at
   `/.well-known/apple-app-site-association`
   (`apps/web/src/app/.well-known/apple-app-site-association/route.ts`), covering
   `/invoices/pay/*`, `/estimates/accept/*`, `/subscriptions/accept/*`. It is
   env-gated on `IOS_APP_ID` (`<TEAM_ID>.com.forge.crm`, **not sensitive**) and
   returns 404 until that's set, so it's safe to ship now. **Remaining (needs
   the Apple Developer Team ID → Phase 5):** (a) set the `IOS_APP_ID` env in
   prod; (b) add the Associated Domains entitlement `applinks:www.forgecrm.app`
   to the iOS app; (c) install `@capacitor/app` and handle its `appUrlOpen`
   event in the web app to navigate the webview to the link's path; (d) test on
   a signed device. Note: in-webview links to forgecrm.app *already* stay in the
   app (`server.allowNavigation`); this item is specifically about links tapped
   *outside* the app (Mail, etc.).
4. ✅ **Offline fallback** — DONE. Set `server.errorPath: 'index.html'` in
   `capacitor.config.ts`; Capacitor loads the bundled `www/index.html` (a
   branded "You're offline" screen) when the remote app can't load, instead of
   WKWebView's blank error. The page auto-returns to the hosted app on the
   `online` event and via a manual "Try again" button (stays in-webview thanks
   to `allowNavigation`). No native/storyboard changes. Verified on the
   simulator: unreachable `server.url` → offline screen renders → "Try again"
   recovers to the hosted login.

Exit criteria: log in once, force-quit, reopen — still logged in; POST actions
(create job, record payment) work without CSRF errors. ✅ **Met** on the
simulator (local-dev); residual: prod `Secure`-cookie re-test and the
Phase-5-gated Universal Links finish.

---

## Phase 3 — Add native capabilities (the "not just a website" work) (1 week)

This is what gets us past Apple Guideline 4.2 and makes the app worth
installing. Pick the high-value set:

- ✅ **Camera** (`@capacitor/camera`) for job/site photos — DONE; "Take Photo"
  button in `JobDetailClient` attachments, reusing the existing compress/upload
  pipeline.
- ✅ **Geolocation** (`@capacitor/geolocation`) — DONE; "locate me" control on
  the map (the map had no prior location feature). Native plugin in-app,
  `navigator.geolocation` on web, behind the `lib/native` guard.
- ✅ **Status bar, splash screen, keyboard resize** — DONE via `NativeChrome`
  + `capacitor.config.ts` plugin config. (Safe areas were already wired in
  Phase-1 CSS; haptics/native-share not needed for v1.)
- ⏸️ **Push notifications** (`@capacitor/push-notifications` + APNs/FCM) —
  **deferred to Phase 5** (needs the Apple Developer account / APNs key from
  enrollment). Highest-value native feature once signing exists.
- ⏸️ **Microphone / Twilio Voice** — WebRTC calling in WKWebView — **deferred
  to Phase 5** (prototype). Most likely to need a native fallback.

Each native plugin degrades gracefully if a permission is denied (helpers
return null / fall back).

**Remaining for Phase 3:** camera + chrome are verified on the simulator (see
Done above). Still unverified at runtime: the map **locate** control (needs
`NEXT_PUBLIC_MAPBOX_TOKEN` in local `.env.local` so tiles render, or a device
run), and the **camera capture** path of `CameraSource.Prompt` (the simulator
has no camera, so only the photo-library branch was exercised — the camera
branch needs a real device, Phase 5).

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
   - **Confirm the `Secure` (https) `crm_session` cookie persists** across a
     force-quit on a real device against prod — the Phase 2 cookie flush was
     verified on local-dev http; this closes the one residual gap (see Phase 2
     note). Quick to check once a real prod account exists for TestFlight.
   - **Finish Universal Links** (Phase 2 item 3 carry-over — all need the Team
     ID from enrollment): (a) set `IOS_APP_ID=<TEAM_ID>.com.forge.crm` in the
     web app's prod env (not sensitive); (b) add the Associated Domains
     entitlement `applinks:www.forgecrm.app` to the iOS target; (c) install
     `@capacitor/app` and, on its `appUrlOpen` event, navigate the webview to
     the link's path; (d) verify an emailed `/invoices/pay/<token>` link opens
     in the app on a signed device. The AASA file is already served (404 until
     `IOS_APP_ID` is set).
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
