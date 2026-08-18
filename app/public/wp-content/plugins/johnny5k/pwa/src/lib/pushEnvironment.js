const DEFAULT_PUSH_PRODUCTION_HOSTS = ['johnny5k.panempire.com']

export function isPushMessagingAllowed(hostname = getCurrentHostname(), configuredHosts = getConfiguredHosts()) {
  const normalizedHostname = normalizeHost(hostname)

  if (!normalizedHostname) return false

  return configuredHosts.some(pattern => hostMatchesPattern(normalizedHostname, pattern))
}

export function getPushProductionHosts() {
  return getConfiguredHosts()
}

function getCurrentHostname() {
  return typeof window !== 'undefined' ? window.location.hostname : ''
}

function getConfiguredHosts() {
  const buildHosts = typeof import.meta !== 'undefined'
    ? parseHostList(import.meta.env?.VITE_PUSH_PRODUCTION_HOSTS)
    : []
  const runtimeHosts = typeof window !== 'undefined'
    ? parseHostList(window.__JOHNNY5K_PUSH_PRODUCTION_HOSTS__)
    : []

  return [...new Set([...DEFAULT_PUSH_PRODUCTION_HOSTS, ...buildHosts, ...runtimeHosts])]
}

function parseHostList(value) {
  if (Array.isArray(value)) return value.map(normalizeHost).filter(Boolean)

  return String(value || '')
    .split(',')
    .map(normalizeHost)
    .filter(Boolean)
}

function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
}

function hostMatchesPattern(hostname, patternValue) {
  const pattern = normalizeHost(patternValue)
  if (!pattern) return false
  if (!pattern.startsWith('*.')) return hostname === pattern

  const suffix = pattern.slice(1)
  return hostname.endsWith(suffix) && hostname.length > suffix.length
}
