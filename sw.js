/**
 * One Piece Tracker — Service Worker
 *
 * Strategy: Cache-first for all app shell assets, with a network-first
 * update check in the background (stale-while-revalidate pattern).
 *
 * Cache versioning: bump CACHE_VERSION whenever you deploy a new build
 * so the old cache is pruned automatically on the next visit.
 */

const CACHE_VERSION = 'op-tracker-v1.2.5';
const CACHE_NAME = CACHE_VERSION;
let hasNotifiedRuntimeUpdate = false;

/**
 * App shell — every file the tracker needs to run fully offline.
 * Add any additional assets (extra JS files, local icons, etc.) here.
 */
const APP_SHELL = [
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/music_track.mp3',
  './src/main.js',
  './src/components/dialogs.js',
  './src/components/arc-grid.js',
  './src/components/theme.js',
  './src/components/progress-modal.js',
  './src/components/music.js',
  './src/components/toast.js',
  './src/components/bottom-sheet.js',
  './src/components/movie-grid.js',
  './src/components/hero.js',
  './src/components/stats.js',
  './src/components/special-grid.js',
  './src/components/filler-actions.js',
  './src/data/arcs.js',
  './src/data/levels.js',
  './src/data/movies.js',
  './src/data/specials.js',
  './src/state/state.js',
  './src/state/persistence.js',
  './src/state/mutations.js',
  './src/utils/date.js',
  './src/utils/scroll.js',
  './src/utils/arc-helpers.js',
  './src/utils/validation.js',
  './src/utils/export-import.js',
  './src/utils/api.js'
];

/**
 * External resources that are nice to cache but not critical.
 * The Google Fonts request is included so the custom typefaces
 * render offline after the first visit.
 */
const OPTIONAL_CACHE = [
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

/* ── Install ──────────────────────────────────────────────────────────────────
   Pre-cache the app shell so the app is immediately available offline
   after the first visit. waitUntil() keeps the SW in the installing state
   until all critical assets are cached — if any fetch fails, the install
   fails cleanly and the browser retries on the next page load.
   ──────────────────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache critical app shell — fail install if any of these are missing
      await cache.addAll(APP_SHELL);

      // Attempt to cache optional external resources — failures are silently
      // swallowed so they don't block the install
      await Promise.allSettled(
        OPTIONAL_CACHE.map(url =>
          cache.add(url).catch(() => {
            console.warn(`[SW] Optional resource not cached: ${url}`);
          })
        )
      );
    })
  );

  // Skip the waiting phase so the new SW activates immediately
  // rather than waiting for all existing tabs to close.
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────────────────────────────
   Delete any caches from previous versions to free storage.
   Only caches whose name starts with 'op-tracker-' but doesn't match
   the current CACHE_NAME are pruned — other apps' caches are left alone.
   ──────────────────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('op-tracker-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] Pruning old cache: ${key}`);
            return caches.delete(key);
          })
      )
    )
  );

  // Take control of all open pages immediately without requiring a reload
  self.clients.claim();
});

/* ── Messages ────────────────────────────────────────────────────────────────
   Allow the page to activate a waiting worker immediately after user consent.
   ──────────────────────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

/* ── Fetch ────────────────────────────────────────────────────────────────────
   Stale-while-revalidate for same-origin requests:
     1. Serve from cache immediately (fast, offline-capable).
     2. Simultaneously fetch from network in the background.
     3. If the network response succeeds, update the cache for next time.
     4. If the request isn't in the cache AND the network fails, return a
        minimal offline fallback response.

   External API calls (Jikan, AniList) are handled network-first so they
   always reflect the latest data when online, and fail gracefully offline.
   ──────────────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── External API calls: network-only (let them fail offline naturally) ──
  const isApiCall = url.hostname.includes('jikan.moe') ||
    url.hostname.includes('anilist.co');
  if (isApiCall) return;  // don't intercept — fall through to browser default

  // ── Same-origin + Google Fonts: stale-while-revalidate ──────────────────
  if (url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')) {

    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // All other requests: let the browser handle them normally
});

/**
 * Stale-while-revalidate helper.
 * Returns the cached response immediately, then updates the cache in the
 * background. Falls back to a network fetch if there's no cached version.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Kick off a background network fetch regardless of cache state
  const networkFetch = fetch(request)
    .then(async response => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        if (
          !hasNotifiedRuntimeUpdate &&
          cached &&
          request.method === 'GET' &&
          isStaticAssetRequest(request) &&
          hasMeaningfulAssetChange(cached, response)
        ) {
          hasNotifiedRuntimeUpdate = true;
          await notifyClientsUpdateReady();
        }
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);  // network failure is non-fatal when we have a cache hit

  // Serve cache immediately; wait for network only if cache is cold
  return cached ?? (await networkFetch) ?? offlineFallback();
}

/**
 * Minimal fallback for navigations when nothing is cached and the network
 * is unavailable. This should only ever be reached on a brand-new install
 * before the first successful page load.
 */
function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>One Piece Tracker — Offline</title>
  <style>
    body {
      background: #0a0e1a;
      color: #d4c5a9;
      font-family: Georgia, serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 24px;
    }
    h1 { font-size: 24px; color: #e8b04a; margin-bottom: 12px; }
    p  { font-size: 15px; opacity: 0.7; line-height: 1.6; }
  </style>
</head>
<body>
  <div>☠️</div>
  <h1>You're out at sea</h1>
  <p>No internet connection found.<br/>Open the app once while online to cache it for offline use.</p>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

function isStaticAssetRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document' ||
    request.destination === 'manifest'
  );
}

function hasMeaningfulAssetChange(oldRes, newRes) {
  const oldTag = oldRes.headers.get('etag');
  const newTag = newRes.headers.get('etag');
  if (oldTag && newTag) return oldTag !== newTag;

  const oldMod = oldRes.headers.get('last-modified');
  const newMod = newRes.headers.get('last-modified');
  if (oldMod && newMod) return oldMod !== newMod;

  const oldLen = oldRes.headers.get('content-length');
  const newLen = newRes.headers.get('content-length');
  if (oldLen && newLen) return oldLen !== newLen;

  return false;
}

async function notifyClientsUpdateReady() {
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage({ type: 'APP_UPDATE_READY' });
  }
}
