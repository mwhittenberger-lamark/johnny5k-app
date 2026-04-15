import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

const APP_SHELL_ALLOWLIST = [
  /^\/$/,
  /^\/dashboard(?:\/.*)?$/,
  /^\/workout(?:\/.*)?$/,
  /^\/nutrition(?:\/.*)?$/,
  /^\/body(?:\/.*)?$/,
  /^\/activity-log(?:\/.*)?$/,
  /^\/progress-photos(?:\/.*)?$/,
  /^\/rewards(?:\/.*)?$/,
  /^\/ironquest(?:\/.*)?$/,
  /^\/settings(?:\/.*)?$/,
  /^\/ai(?:\/.*)?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/onboarding(?:\/.*)?$/,
]

const navigationHandler = createHandlerBoundToURL('/index.html')

registerRoute(
  new NavigationRoute(navigationHandler, {
    allowlist: APP_SHELL_ALLOWLIST,
    denylist: [/^\/wp-admin(?:\/.*)?$/, /^\/wp-json(?:\/.*)?$/, /^\/wp-content(?:\/.*)?$/, /^\/wp-login\.php$/],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET'
    && url.origin === self.location.origin
    && url.pathname.startsWith('/wp-json/fit/v1/')
    && !url.pathname.startsWith('/wp-json/fit/v1/auth/'),
  // Authenticated app data needs fresh reads immediately after writes.
  new NetworkFirst({
    cacheName: 'jf-api-safe-reads-v2',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET'
    && url.origin === self.location.origin
    && url.pathname.startsWith('/wp-json/wp/v2/media'),
  new StaleWhileRevalidate({
    cacheName: 'jf-wp-media-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET'
    && url.origin === self.location.origin
    && (request.destination === 'image' || url.pathname.startsWith('/wp-content/uploads/')),
  new CacheFirst({
    cacheName: 'jf-images-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET'
    && url.origin === self.location.origin
    && ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'jf-static-assets-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET'
    && url.origin === self.location.origin
    && url.pathname.startsWith('/workout'),
  new NetworkFirst({
    cacheName: 'jf-workout-pages-v1',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
)

self.addEventListener('push', event => {
  const payload = readPushPayload(event)
  const title = payload.title || 'Johnny'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: {
      url: payload.url || '/dashboard',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  const targetUrl = String(event.notification?.data?.url || '/dashboard')
  event.notification.close()

  event.waitUntil(focusOrOpenClient(targetUrl))
})

function readPushPayload(event) {
  if (!event.data) {
    return {}
  }

  try {
    return event.data.json() || {}
  } catch {
    return {
      body: event.data.text(),
    }
  }
}

async function focusOrOpenClient(targetUrl) {
  const matchedClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const normalizedTarget = new URL(targetUrl, self.location.origin).toString()

  for (const client of matchedClients) {
    if (!('focus' in client)) {
      continue
    }

    const clientUrl = new URL(client.url, self.location.origin)
    if (clientUrl.origin === self.location.origin) {
      await client.navigate(normalizedTarget)
      return client.focus()
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(normalizedTarget)
  }

  return undefined
}
