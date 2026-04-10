import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { queryClient } from './lib/queryClient'
import './index.css'

const LOCAL_SW_RESET_KEY = 'jf-local-sw-reset-v1'

void resetLocalServiceWorkerCaches()
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

async function resetLocalServiceWorkerCaches() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return
  }

  const hostname = String(window.location.hostname || '').toLowerCase()
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')

  if (!isLocalHost || !('serviceWorker' in navigator) || !('caches' in window)) {
    return
  }

  if (window.sessionStorage.getItem(LOCAL_SW_RESET_KEY) === 'done') {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  if (!registrations.length) {
    window.sessionStorage.setItem(LOCAL_SW_RESET_KEY, 'done')
    return
  }

  await Promise.all(registrations.map(registration => registration.unregister()))

  const cacheKeys = await window.caches.keys()
  await Promise.all(cacheKeys.map(cacheKey => window.caches.delete(cacheKey)))

  window.sessionStorage.setItem(LOCAL_SW_RESET_KEY, 'done')
  window.location.reload()
}
