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
