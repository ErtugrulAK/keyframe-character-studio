import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { retireStaleDevServiceWorker } from './utils/devFreshness'

// DEV FRESHNESS CONTRACT — a dev session must never be served by a stale
// service worker left on this origin by an earlier dev server. Dev-only: a
// production build never runs this, and it is a no-op where the API is absent
// (an insecure LAN origin has no service workers at all).
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void retireStaleDevServiceWorker(navigator.serviceWorker)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
