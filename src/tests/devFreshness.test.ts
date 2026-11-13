import { describe, expect, it, vi } from 'vitest';
import { retireStaleDevServiceWorker } from '../utils/editor/devFreshness';
import { devDocumentFreshness } from '../../vite.config';

/**
 * Manual QA Round 4 — R4-16: dev/LAN cache freshness.
 *
 * The contract separates two things a "stale" LAN page can actually be:
 *   - stale APP CODE, which in dev is impossible on a plain-HTTP LAN origin (no
 *     service worker can even be registered there) and which the dev server
 *     already revalidates for every source module; and
 *   - a PERSISTED USER DOCUMENT restored from localStorage, which is expected.
 *
 * These tests pin the two guards that keep the first axis true.
 */

type HeaderValue = number | string | readonly string[];

interface DevDocumentResponse {
  headers: Record<string, HeaderValue>;
  nextCalls: number;
  setHeader: (name: string, value: HeaderValue) => DevDocumentResponse;
}

/** Run the dev freshness plugin's middleware over one request. */
const runDevDocumentMiddleware = (request: { method: string; url: string }): DevDocumentResponse => {
  const plugin = devDocumentFreshness();
  let handler: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
  const configure = plugin.configureServer as unknown as (server: unknown) => void;
  configure({ middlewares: { use: (candidate: never) => { handler = candidate; } } });
  if (!handler) throw new Error('the dev freshness plugin installed no middleware');

  const response: DevDocumentResponse = {
    headers: {},
    nextCalls: 0,
    setHeader(name, value) {
      response.headers[name] = value;
      return response;
    },
  };
  handler(request, response, () => { response.nextCalls += 1; });
  // The dev server's own write, which happens AFTER this middleware has run.
  response.setHeader('Cache-Control', 'no-cache');
  return response;
};

describe('R4-16 — the dev document is never stored by an intermediary', () => {
  it('forces no-store on the entry document, even though the dev server sets no-cache afterwards', () => {
    expect(runDevDocumentMiddleware({ method: 'GET', url: '/' }).headers['Cache-Control']).toBe('no-store');
  });

  it('covers every html document and the SPA root, and nothing else', () => {
    expect(runDevDocumentMiddleware({ method: 'GET', url: '/?utm=1' }).headers['Cache-Control']).toBe('no-store');
    expect(runDevDocumentMiddleware({ method: 'GET', url: '/index.html' }).headers['Cache-Control']).toBe('no-store');

    // Modules, assets and pre-bundled dependencies keep the dev server's own
    // revalidating header: the pin must not hijack them.
    for (const url of ['/src/main.tsx', '/favicon.svg', '/node_modules/.vite/deps/react.js?v=1']) {
      const response = runDevDocumentMiddleware({ method: 'GET', url });
      expect(response.nextCalls, url).toBe(1);
      expect(response.headers['Cache-Control'], url).toBe('no-cache');
    }
  });

  it('only applies to the dev server, never to a production build', () => {
    expect(devDocumentFreshness().apply).toBe('serve');
  });
});

describe('R4-16 — a stale service worker cannot keep serving an old build in dev', () => {
  it('retires every registration on the origin', async () => {
    const unregister = vi.fn(async () => true);
    const retired = await retireStaleDevServiceWorker({ getRegistrations: async () => [{ unregister }, { unregister }] });

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(retired).toBe(2);
  });

  it('is a no-op where service workers do not exist (an insecure LAN origin, jsdom)', async () => {
    await expect(retireStaleDevServiceWorker({})).resolves.toBe(0);
  });

  it('reports only the registrations that were actually retired', async () => {
    const retired = await retireStaleDevServiceWorker({
      getRegistrations: async () => [
        { unregister: async () => true },
        { unregister: async () => false },
      ],
    });

    expect(retired).toBe(1);
  });
});
