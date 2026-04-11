export function isPushSupported() {
  return getPushSupportState().supported
}

export function getPushSupportState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'Browser notifications are not available in this environment.' }
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, reason: 'This browser does not support push notifications.' }
  }

  if (isAppleMobileDevice() && !isStandaloneWebApp()) {
    return {
      supported: false,
      reason: 'On iPhone and iPad, install Johnny5k to the Home Screen first, then open it from there to enable notifications.',
    }
  }

  return { supported: true, reason: '' }
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) {
    return null
  }

  const registration = await ensurePushRegistration()
  return registration.pushManager.getSubscription()
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function requestNotificationPermission() {
  const support = getPushSupportState()
  if (!support.supported) {
    throw new Error(support.reason || 'Browser notifications are not supported on this device.')
  }

  const maybePromise = Notification.requestPermission.length === 0
    ? Notification.requestPermission()
    : new Promise(resolve => Notification.requestPermission(resolve))

  return await maybePromise
}

export function serializeSubscription(subscription) {
  if (!subscription) {
    return null
  }

  const json = subscription.toJSON?.() ?? {}
  return {
    endpoint: json.endpoint || subscription.endpoint,
    expirationTime: json.expirationTime ?? subscription.expirationTime ?? null,
    contentEncoding: 'aes128gcm',
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    },
  }
}

export function decodeVapidPublicKey(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const encoded = normalized + padding
  const raw = window.atob(encoded)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

export async function ensurePushRegistration() {
  const support = getPushSupportState()
  if (!support.supported) {
    throw new Error(support.reason || 'Browser notifications are not supported on this device.')
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration()
  if (existingRegistration) {
    return existingRegistration
  }

  const serviceWorkerUrl = new URL('sw.js', window.location.origin + (import.meta.env.BASE_URL || '/')).pathname
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl)
  await navigator.serviceWorker.ready
  return registration
}

function isAppleMobileDevice() {
  const userAgent = String(navigator.userAgent || navigator.vendor || '').toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

function isStandaloneWebApp() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
}
