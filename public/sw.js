// Minimal service worker: keeps the expense logger and the Diet page openable with no network,
// so their offline queues actually get a chance to run.
//
// Hand-rolled rather than next-pwa (unmaintained, no Next 16 support) or @serwist/next
// (a build integration for what amounts to one fetch handler).

const VERSION = "v2";
// The pages that work offline, each its section's fallback when a page in it can't be fetched.
const SHELLS = { "/self-care": "/self-care", "/finances": "/finances/log" };
// A network that blocks the site can hang rather than fail; past this, an offline page shows its
// cached copy. Only those two: they know when they are a copy, other pages would just be stale.
const NETWORK_WAIT_MS = 4000;
const WAITS_FOR = ["/self-care", "/finances/log"];
const SHELL_CACHE = `shell-${VERSION}`;
// Not tied to VERSION, and never dropped: build files are content-hashed, so a saved one is never
// wrong, and a page saved for offline needs its scripts. Dropping them on an update left the
// cached pages unable to run, ticks and expenses included, until next opened online.
const ASSET_CACHE = "assets-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort: if the user is offline at install time, don't fail the whole SW.
      cache.addAll(Object.values(SHELLS)).catch(() => undefined)
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
          keys.filter((k) => k.startsWith("shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k))
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

  // Navigations: try the network, fall back to the cached page when offline or too slow.
  if (request.mode === "navigate") {
    const network = fetch(request).then((res) => {
      if (isCacheable(res)) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });
    // Answered by the cache, the network's late result still refreshes it, and a late failure
    // is nobody's to handle.
    network.catch(() => undefined);
    const impatient = WAITS_FOR.includes(url.pathname);
    const wait = impatient
      ? new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), NETWORK_WAIT_MS))
      : network;
    event.respondWith(
      Promise.race([network, wait]).catch(async () => {
        const shell = Object.keys(SHELLS).find((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
        const cached = (await caches.match(request)) ?? (await caches.match(SHELLS[shell] ?? "/finances/log"));
        // Nothing cached to show: keep waiting for the network after all.
        return cached ?? network.catch(() => Response.error());
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
