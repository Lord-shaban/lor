/**
 * The smallest service worker that makes this installable, and nothing more.
 *
 * A meeting is live by definition: almost nothing here is worth serving from a
 * cache, and serving the wrong thing is worse than serving nothing. So this
 * caches exactly two categories and refuses to touch anything else.
 *
 *   1. `/_next/static/…` — content-hashed by the build, so a cached copy can
 *      never be stale. A new build produces new URLs.
 *   2. One offline page, so a navigation with no network says something.
 *
 * Everything else — every API route, every room, every token — goes to the
 * network and is never stored. A cached room response would show somebody a
 * meeting that has moved on; a cached token response would be worse.
 */

const VERSION = "lor-v1";
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(OFFLINE_URL))
      // A failed precache must not leave a worker that never activates.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lor-") && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Never cached, whatever else is true of the request. */
function isLive(url) {
  return (
    url.pathname.startsWith("/api/") ||
    // The manifest and the icons are cheap and change with a deploy.
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only plain reads. A POST is a knock, a token, a moderation decision — none
  // of which have a meaningful cached answer.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isLive(url)) return;

  // Immutable by construction: the build puts a content hash in the path.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // A page. Always from the network, because a room is never the same twice.
  // The cache is only ever the last resort for having nothing to show at all.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (hit) =>
            hit ??
            new Response("", { status: 503, statusText: "Offline" }),
        ),
      ),
    );
  }
});
