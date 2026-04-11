import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import AppErrorBoundary from './components/resilience/AppErrorBoundary'
import { initOfflineWriteQueue } from './api/core/restClient'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import './index.css'

const LOCAL_SW_RESET_KEY = 'jf-local-sw-reset-v1'

void resetLocalServiceWorkerCaches()
initOfflineWriteQueue()

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('johnny5k:pwa-offline-ready'))
    }
  },
  onNeedRefresh() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('johnny5k:pwa-update-ready'))
    }
  },
  onRegisterError(error) {
    console.error('Service worker registration failed.', error)
  },
})

if (typeof window !== 'undefined') {
  window.__jfUpdateServiceWorker = updateServiceWorker
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppErrorBoundary>
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
