// Minimal service worker: keeps the expense-logging screen openable with no network,
// so the offline queue actually gets a chance to run.
//
// Hand-rolled rather than next-pwa (unmaintained, no Next 16 support) or @serwist/next
// (a build integration for what amounts to one fetch handler).

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort: if the user is offline at install time, don't fail the whole SW.
      cache.addAll(["/finances/log"]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Only cache genuinely cacheable responses. Caching a 401 or a redirect to /login
// would leave the app permanently showing a logged-out shell.
function isCacheable(res) {
  return res && res.ok && res.status === 200 && res.type === "basic" && !res.redirected;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never interfere with the API — the queue needs real network results, including failures.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: try the network, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match("/finances/log")) ?? Response.error();
        })
    );
    return;
  }

  // Build assets are content-hashed, so cache-first is safe and fast.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});
