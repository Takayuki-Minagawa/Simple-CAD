const CACHE_PREFIX = 'simple-cad-runtime-';
const BUILD_ID =
  new URL(self.location.href).searchParams.get('v')?.replace(/[^a-zA-Z0-9_-]/g, '_') ??
  'legacy';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [
  './',
  'offline-assets.json',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const manifestResponse = await cache.match('offline-assets.json', { ignoreVary: true });
  if (manifestResponse) {
    const manifest = await manifestResponse.json();
    const builtAssets = Array.isArray(manifest)
      ? manifest.filter((asset) => typeof asset === 'string')
      : [];
    // The generated list is the offline contract (lazy views and workers
    // included). Reject installation if any item is unavailable so the browser
    // retries instead of activating a permanently incomplete cache.
    await cache.addAll(builtAssets);
  }
  const documentResponse = await cache.match('./', { ignoreVary: true });
  if (!documentResponse) return;
  const html = await documentResponse.text();
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.href))
    .filter(
      (url) => url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH),
    );
  await Promise.all(
    urls.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // One optional asset must not prevent the service worker from installing.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  // Do not skip the waiting phase on updates. Existing tabs can still refer
  // to old hashed lazy chunks; the previous worker/cache must remain alive
  // until those clients close. A first install activates normally.
  event.waitUntil(precacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function matchOtherBuildCache(request) {
  const keys = await caches.keys();
  // A newly installed worker may be waiting while an existing tab is still
  // controlled by the previous generation. That tab can already reference the
  // new HTML/chunk hashes, so let the old worker read exact URL matches from the
  // waiting generation without mixing in caches owned by other applications.
  for (const key of keys.reverse()) {
    if (!key.startsWith(CACHE_PREFIX) || key === CACHE_NAME) continue;
    const response = await (await caches.open(key)).match(request, { ignoreVary: true });
    if (response) return response;
  }
  return undefined;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request)
          .then((response) => {
            const contentType = response.headers.get('content-type') ?? '';
            if (response.ok && response.type === 'basic' && contentType.includes('text/html')) {
              const copy = response.clone();
              void cache.put('./', copy);
            }
            return response;
          })
          .catch(
            async () =>
              (await cache.match(request, { ignoreVary: true })) ||
              (await cache.match('./', { ignoreVary: true })),
          ),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached =
        (await cache.match(request, { ignoreVary: true })) ||
        (await matchOtherBuildCache(request));
      const refresh = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void cache.put(request, copy);
            }
            return response;
          })
          .catch(() => cached);
      return cached || refresh;
    }),
  );
});
