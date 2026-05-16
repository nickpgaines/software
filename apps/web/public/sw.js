// Minimal service worker so the app is installable on iOS/Android.
// We deliberately avoid caching app shell HTML/JS — this app changes
// frequently and stale cached bundles would break auth + Stripe flows.
// We only handle the install/activate lifecycle and pass fetches through.

const VERSION = "v1";

self.addEventListener("install", (event) => {
  // Activate the new SW immediately on next load.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim open tabs so they use this SW without a reload.
  event.waitUntil(self.clients.claim());
  // Drop any old caches from prior versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      )
    )
  );
});

// Network-only passthrough. The presence of a fetch handler is what makes
// Chrome/Android count this as a PWA for "Add to Home Screen" eligibility.
self.addEventListener("fetch", (event) => {
  // Let the browser handle it normally.
});
