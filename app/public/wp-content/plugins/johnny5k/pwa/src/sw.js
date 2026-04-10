self.__WB_MANIFEST

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode !== 'navigate' || !url.pathname.startsWith('/workout')) {
    return
  }

  event.respondWith(networkFirstWorkoutPage(request))
})

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

async function networkFirstWorkoutPage(request) {
  const cache = await caches.open('workout-cache')

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

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
