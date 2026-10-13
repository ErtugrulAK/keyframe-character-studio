import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * DEV FRESHNESS CONTRACT — the dev entry DOCUMENT is never stored anywhere
 * between the browser and this dev server.
 *
 * Vite already revalidates the app in dev (`Cache-Control: no-cache` + ETag on
 * the document and on every source module), which is the right behaviour for a
 * LAN user: a fresh navigation always reaches this server. The one hole left is
 * an intermediary that is allowed to STORE the document — a corporate/LAN proxy,
 * an extension, a caching appliance — because `no-cache` permits storage as long
 * as the stored copy is revalidated, and a broken intermediary may not.
 *
 * So the DOCUMENT alone (`/` and any `.html`) answers `no-store` in dev. It is
 * deliberately narrow: pre-bundled dependencies and public assets keep their own
 * dev caching, and a production build is untouched (the plugin only applies to
 * the dev server, and the hashed production bundle keeps its immutable caching).
 *
 * Vite's own HTML handler sets `Cache-Control: no-cache` AFTER a
 * `configureServer` middleware has run, so the header is pinned at the write
 * instead of being set once and overwritten.
 */
export const devDocumentFreshness = (): Plugin => ({
  name: 'kcs-dev-document-freshness',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      const pathname = (req.url ?? '').split('?')[0]
      if (pathname !== '/' && !pathname.endsWith('.html')) return next()
      const setHeader = res.setHeader.bind(res)
      res.setHeader = ((name: string, value: number | string | readonly string[]) =>
        String(name).toLowerCase() === 'cache-control'
          ? setHeader('Cache-Control', 'no-store')
          : setHeader(name, value)) as typeof res.setHeader
      return next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devDocumentFreshness()],
  server: {
    host: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // The single minified bundle crossed the 500 kB advisory threshold. Split the
        // stable third-party groups out of it: they change far less often than the app
        // code, so browsers cache them across releases. No import becomes lazy and the
        // module order is unchanged, so runtime behaviour is identical.
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'geometry', test: /node_modules[\\/](polygon-clipping|fflate)[\\/]/ },
          ],
        },
      },
    },
  },
})
