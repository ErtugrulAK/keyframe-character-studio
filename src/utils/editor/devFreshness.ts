/**
 * DEV FRESHNESS CONTRACT (KCS) — stale APP CODE must never be the explanation
 * for "the LAN URL shows old content".
 *
 * 1. There is NO service worker and NO PWA manifest in this repository, and the
 *    dev server is reached over plain HTTP (e.g. `http://172.16.0.172:5173`),
 *    which is not a secure context: `navigator.serviceWorker` and the Cache
 *    Storage API do not even exist there. No offline shell can be registered by
 *    this app on that origin.
 * 2. A secure dev origin (localhost / HTTPS) is the one place a stale service
 *    worker could survive a rewrite of the dev server, so a dev-only guard
 *    retires any registration it finds: see {@link retireStaleDevServiceWorker}.
 *    A retired registration no longer intercepts navigation; its caches are left
 *    alone because a cache with no controlling worker is never served.
 * 3. Vite's dev server already revalidates the app: the entry document and every
 *    source module answer `Cache-Control: no-cache` with an ETag, so a fresh
 *    navigation gets current source. The entry DOCUMENT additionally answers
 *    `no-store` in dev (see the `kcs-dev-document-freshness` plugin in
 *    `vite.config.ts`) so no intermediary between a LAN browser and the dev
 *    server may replay a stored document.
 * 4. Production asset caching is untouched: this contract is dev-only, and the
 *    hashed production bundle keeps its long-lived immutable caching.
 * 5. What is NOT stale code: the editor restores the last autosaved DOCUMENT
 *    from `localStorage` on boot, so a returning LAN user sees their previous
 *    project — the scene title and the layers — through current source. That is
 *    persistence, and it is a separate axis from code freshness.
 */

/** The slice of `ServiceWorkerContainer` this guard needs. */
interface DevServiceWorkerHost {
  getRegistrations?: () => Promise<ReadonlyArray<{ unregister: () => Promise<boolean> }>>;
}

/**
 * Retire every service worker registration on the current origin. Returns how
 * many were retired. A host without `getRegistrations` (an insecure LAN origin,
 * jsdom, an older browser) retires nothing and never throws.
 */
export async function retireStaleDevServiceWorker(host: DevServiceWorkerHost): Promise<number> {
  if (typeof host.getRegistrations !== 'function') return 0;
  const registrations = await host.getRegistrations();
  const outcomes = await Promise.all(registrations.map((registration) => registration.unregister()));
  return outcomes.filter(Boolean).length;
}
